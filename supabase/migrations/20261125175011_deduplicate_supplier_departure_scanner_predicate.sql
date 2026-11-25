-- Ensure the supplier-managed scanner predicate appears exactly once.
DO $fix$
DECLARE
  v_definition TEXT;
  v_duplicate CONSTANT TEXT := 'AND d.resource_management_mode = ''internal'' AND d.resource_management_mode = ''internal'' AND (d.guide_id IS NULL OR d.vessel_id IS NULL)';
  v_correct CONSTANT TEXT := 'AND d.resource_management_mode = ''internal'' AND (d.guide_id IS NULL OR d.vessel_id IS NULL)';
  v_count INTEGER;
BEGIN
  SELECT pg_get_functiondef('public.scan_staff_notifications()'::regprocedure) INTO v_definition;
  v_count := (length(v_definition)-length(replace(v_definition,v_duplicate,'')))/length(v_duplicate);
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Expected one duplicated supplier-mode predicate; found %',v_count;
  END IF;
  EXECUTE replace(v_definition,v_duplicate,v_correct);
END;
$fix$;
