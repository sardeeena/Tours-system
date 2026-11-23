-- Restrict customer-facing locale writes to the exact eleven languages approved
-- for the public storefront. Historical rows are not rewritten; the RPC rejects
-- any new booking request outside this allowlist.
BEGIN;

DO $restrict_customer_locale_allowlist$
DECLARE
  v_definition text;
  v_old_guard text := $old$
  IF p_customer_locale IS NULL OR p_customer_locale NOT IN (
    'en', 'de', 'fr', 'it', 'es', 'nl', 'pl', 'pt', 'ro', 'ru',
    'sv', 'da', 'nb', 'fi', 'el', 'bg', 'hr', 'cs', 'sk', 'sl',
    'hu', 'et', 'lv', 'lt', 'uk', 'sr', 'sq', 'tr', 'ar'
  ) THEN
$old$;
  v_new_guard text := $new$
  IF p_customer_locale IS NULL OR p_customer_locale NOT IN (
    'en', 'de', 'it', 'ro', 'ru', 'fr', 'nl', 'pl', 'cs', 'sv', 'es'
  ) THEN
$new$;
BEGIN
  SELECT pg_get_functiondef(
    'private.create_booking_atomic_with_locale(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text,text,text)'::regprocedure
  ) INTO v_definition;

  IF position(v_old_guard IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Expected expanded locale allowlist was not found; refusing to modify the booking function.';
  END IF;

  v_definition := replace(v_definition, v_old_guard, v_new_guard);

  IF position('''cs''' IN v_definition) = 0
     OR position('''sv''' IN v_definition) = 0
     OR position('''es''' IN v_definition) = 0
     OR position('''ar''' IN v_definition) > 0
     OR position('''pt''' IN v_definition) > 0
     OR position('Unsupported customer locale.' IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Eleven-language customer locale allowlist postconditions failed.';
  END IF;

  EXECUTE v_definition;
END;
$restrict_customer_locale_allowlist$;

NOTIFY pgrst, 'reload schema';
COMMIT;
