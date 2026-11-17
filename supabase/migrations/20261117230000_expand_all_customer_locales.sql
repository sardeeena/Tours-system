-- Expand the atomic booking locale allowlist to every locale supported by the
-- public translation registry. The private SECURITY DEFINER implementation
-- remains private; the public wrapper remains SECURITY INVOKER.
BEGIN;

DO $expand_customer_locale_allowlist$
DECLARE
  v_definition text;
  v_old_guard text := $old$
  IF p_customer_locale IS NULL OR p_customer_locale NOT IN ('en', 'de', 'it', 'ro', 'ru', 'fr', 'es', 'nl', 'pl', 'pt') THEN
$old$;
  v_new_guard text := $new$
  IF p_customer_locale IS NULL OR p_customer_locale NOT IN (
    'en', 'de', 'fr', 'it', 'es', 'nl', 'pl', 'pt', 'ro', 'ru',
    'sv', 'da', 'nb', 'fi', 'el', 'bg', 'hr', 'cs', 'sk', 'sl',
    'hu', 'et', 'lv', 'lt', 'uk', 'sr', 'sq', 'tr', 'ar'
  ) THEN
$new$;
BEGIN
  SELECT pg_get_functiondef(
    'private.create_booking_atomic_with_locale(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text,text,text)'::regprocedure
  ) INTO v_definition;

  IF position(v_old_guard IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Expected customer locale allowlist was not found in the private booking implementation; refusing to modify it.';
  END IF;

  v_definition := replace(v_definition, v_old_guard, v_new_guard);

  IF position('''ar''' IN v_definition) = 0
     OR position('''tr''' IN v_definition) = 0
     OR position('''uk''' IN v_definition) = 0
     OR position('Unsupported customer locale.' IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Expanded customer locale allowlist postconditions failed.';
  END IF;

  EXECUTE v_definition;
END;
$expand_customer_locale_allowlist$;

NOTIFY pgrst, 'reload schema';
COMMIT;
