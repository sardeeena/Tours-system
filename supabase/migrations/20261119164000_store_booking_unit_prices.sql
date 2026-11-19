-- Persist the actual per-person rates captured at booking time. Existing
-- bookings receive zero-valued defaults only; their historical totals and
-- all other fields remain untouched.

BEGIN;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS unit_price_adult NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unit_price_child NUMERIC(12,2) NOT NULL DEFAULT 0;

DO $migration$
DECLARE
  v_signature REGPROCEDURE;
  v_definition TEXT;
  v_old_columns TEXT := E'    idempotency_key, idempotency_payload, tour_language, customer_locale';
  v_new_columns TEXT := v_old_columns || E',\n    unit_price_adult, unit_price_child';
  v_old_values TEXT := E'    p_idempotency_key, v_idempotency_payload, v_tour_language, v_customer_locale';
  v_new_values TEXT := v_old_values || E',\n' ||
    '    CASE WHEN COALESCE(v_tour.tour_type, ''Shared'') = ''Private'' THEN v_tour.private_price ELSE v_tour.price END,' || E'\n' ||
    '    CASE WHEN COALESCE(v_tour.tour_type, ''Shared'') = ''Private'' THEN v_tour.private_price ELSE COALESCE(v_tour.child_price, ROUND(v_tour.price * 0.50, 2)) END';
  v_patched INTEGER := 0;
BEGIN
  FOR v_signature IN
    SELECT p.oid::regprocedure
    FROM pg_proc AS p
    WHERE p.pronamespace = 'private'::regnamespace
      AND p.proname = 'create_booking_atomic'
      AND p.pronargs IN (18,19)
  LOOP
    v_definition := pg_get_functiondef(v_signature);
    IF position(v_old_columns in v_definition) = 0
       OR position(v_old_values in v_definition) = 0 THEN
      RAISE EXCEPTION 'Booking function % no longer matches the reviewed unit-price insert anchors.', v_signature;
    END IF;

    v_definition := replace(v_definition,v_old_columns,v_new_columns);
    v_definition := replace(v_definition,v_old_values,v_new_values);
    EXECUTE v_definition;
    v_patched := v_patched + 1;
  END LOOP;

  IF v_patched <> 2 THEN
    RAISE EXCEPTION 'Expected to patch both booking implementations with stored unit prices; patched %.', v_patched;
  END IF;
END;
$migration$;

COMMENT ON COLUMN public.bookings.unit_price_adult
IS 'Adult per-person rate captured when this booking was created; legacy rows remain zero until explicitly reconciled.';
COMMENT ON COLUMN public.bookings.unit_price_child
IS 'Child per-person rate captured when this booking was created; private tours store the same per-person rate for adults and children.';

NOTIFY pgrst, 'reload schema';
COMMIT;
