-- Ensure the supplier-managed scanner predicate appears exactly once.
DO $fix$
DECLARE
  v_definition TEXT;
  v_duplicate CONSTANT TEXT := 'AND d.resource_management_mode = ''internal'' AND d.resource_management_mode = ''internal'' AND (d.guide_id IS NULL OR d.vessel_id IS NULL)';
  v_correct CONSTANT TEXT := 'AND d.resource_management_mode = ''internal'' AND (d.guide_id IS NULL OR d.vessel_id IS NULL)';
  v_duplicate_count INTEGER;
  v_correct_count INTEGER;
BEGIN
  SELECT pg_get_functiondef('public.scan_staff_notifications()'::regprocedure) INTO v_definition;
  v_duplicate_count := (length(v_definition)-length(replace(v_definition,v_duplicate,'')))/length(v_duplicate);
  v_correct_count := (length(v_definition)-length(replace(v_definition,v_correct,'')))/length(v_correct);

  IF v_duplicate_count = 1 AND v_correct_count = 0 THEN
    EXECUTE replace(v_definition,v_duplicate,v_correct);
  ELSIF v_duplicate_count = 0 AND v_correct_count = 1 THEN
    -- Already correct on a clean database; keep migration replay safe.
    NULL;
  ELSE
    RAISE EXCEPTION 'Unexpected supplier-mode predicate state (duplicate %, correct %)',v_duplicate_count,v_correct_count;
  END IF;
END;
$fix$;
