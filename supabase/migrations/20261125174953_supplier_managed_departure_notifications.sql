-- Reconcile the second production migration-history entry for supplier-managed departures.
-- The schema change is implemented by 20261125140000 and the final scanner predicate
-- is enforced by 20261125175011. Production records this additional version under
-- the same migration name; keep it represented without replaying the DDL or data updates.
DO $$
DECLARE
  v_definition TEXT;
  v_predicate CONSTANT TEXT := 'AND d.resource_management_mode = ''internal'' AND (d.guide_id IS NULL OR d.vessel_id IS NULL)';
  v_count INTEGER;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'departures'
      AND column_name = 'resource_management_mode'
      AND is_nullable = 'NO'
      AND column_default = '''supplier''::text'
  ) THEN
    RAISE EXCEPTION 'Supplier-managed departure mode is not installed as expected';
  END IF;

  SELECT pg_get_functiondef('public.scan_staff_notifications()'::regprocedure)
  INTO v_definition;

  IF v_definition IS NULL THEN
    RAISE EXCEPTION 'Expected public.scan_staff_notifications() to exist';
  END IF;

  v_count := (length(v_definition) - length(replace(v_definition, v_predicate, ''))) / length(v_predicate);
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one internal-resource scanner predicate; found %', v_count;
  END IF;
END;
$$;
