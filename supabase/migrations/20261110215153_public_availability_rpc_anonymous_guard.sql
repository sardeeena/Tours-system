-- Public availability RPC is callable by anon. Do not invoke the admin-only
-- SECURITY DEFINER helper for anonymous callers; only signed-in users may
-- evaluate the administrator check. Preserve service-role bypass behavior.
DO $migration$
DECLARE
  v_definition text;
  v_old text := 'OR public.is_admin();';
  v_new text := 'OR (auth.uid() IS NOT NULL AND public.is_admin());';
BEGIN
  v_definition := pg_get_functiondef(
    'public.get_tour_availability_schedule(text,date,date)'::regprocedure
  );

  IF position(v_old in v_definition) = 0 THEN
    RAISE EXCEPTION 'Expected admin guard expression was not found; refusing to modify function';
  END IF;

  v_definition := replace(v_definition, v_old, v_new);

  IF position(v_new in v_definition) = 0 THEN
    RAISE EXCEPTION 'Availability function guard replacement failed validation';
  END IF;

  EXECUTE v_definition;
END
$migration$;

DO $validation$
BEGIN
  IF position(
    'auth.uid() IS NOT NULL AND public.is_admin()'
    in pg_get_functiondef('public.get_tour_availability_schedule(text,date,date)'::regprocedure)
  ) = 0 THEN
    RAISE EXCEPTION 'Availability RPC anonymous-safe admin guard validation failed';
  END IF;
END
$validation$;
