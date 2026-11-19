-- Persist the authoritative per-person tour rates on each newly created booking.
-- A BEFORE INSERT trigger is used instead of rewriting booking RPC source text:
-- both legacy and locale-aware RPCs receive identical price snapshots, while
-- existing bookings remain untouched (their historical totals are preserved).

BEGIN;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS unit_price_adult NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unit_price_child NUMERIC(12,2) NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION private.set_booking_unit_prices()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_tour_type TEXT;
  v_adult_price NUMERIC(12,2);
  v_child_price NUMERIC(12,2);
  v_private_price NUMERIC(12,2);
BEGIN
  SELECT
    t.tour_type,
    t.price,
    t.child_price,
    t.private_price
  INTO
    v_tour_type,
    v_adult_price,
    v_child_price,
    v_private_price
  FROM public.tours AS t
  WHERE t.id = NEW.tour_id
    AND t.status = 'published';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'A published tour is required to snapshot booking unit prices.'
      USING ERRCODE = '23503';
  END IF;

  IF COALESCE(v_tour_type, 'Shared') = 'Private' THEN
    IF v_private_price IS NULL OR v_private_price <= 0 THEN
      RAISE EXCEPTION 'The private per-person rate is not configured for this excursion.'
        USING ERRCODE = '23514';
    END IF;
    NEW.unit_price_adult := v_private_price;
    NEW.unit_price_child := v_private_price;
  ELSE
    NEW.unit_price_adult := COALESCE(v_adult_price, 0);
    NEW.unit_price_child := COALESCE(v_child_price, ROUND(COALESCE(v_adult_price, 0) * 0.50, 2));
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.set_booking_unit_prices() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_set_booking_unit_prices ON public.bookings;
CREATE TRIGGER trg_set_booking_unit_prices
BEFORE INSERT ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION private.set_booking_unit_prices();

COMMENT ON COLUMN public.bookings.unit_price_adult
IS 'Adult per-person rate captured at booking creation. Existing legacy rows remain zero and are not rewritten.';
COMMENT ON COLUMN public.bookings.unit_price_child
IS 'Child per-person rate captured at booking creation; private tours use the same per-person rate for adults and children.';

NOTIFY pgrst, 'reload schema';
COMMIT;
