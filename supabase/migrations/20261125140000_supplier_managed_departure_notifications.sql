-- Treat supplier-managed departures as valid; keep internal resource modules intact.
BEGIN;
ALTER TABLE public.departures ADD COLUMN IF NOT EXISTS resource_management_mode TEXT;
UPDATE public.departures SET resource_management_mode = 'supplier' WHERE resource_management_mode IS NULL;
ALTER TABLE public.departures ALTER COLUMN resource_management_mode SET DEFAULT 'supplier', ALTER COLUMN resource_management_mode SET NOT NULL;
DO $constraint$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.departures'::regclass AND conname='departures_resource_management_mode_check') THEN
    ALTER TABLE public.departures ADD CONSTRAINT departures_resource_management_mode_check CHECK (resource_management_mode IN ('supplier','internal'));
  END IF;
END;
$constraint$;
CREATE INDEX IF NOT EXISTS idx_departures_internal_unassigned_date ON public.departures(date)
  WHERE resource_management_mode='internal' AND status NOT IN ('cancelled','completed') AND (guide_id IS NULL OR vessel_id IS NULL);
CREATE INDEX IF NOT EXISTS idx_staff_notifications_created_at_id ON public.staff_notifications(created_at DESC,id DESC);
-- Preserve old false alerts as history but remove them from the unread queue.
UPDATE public.staff_notifications SET is_read=TRUE,read_at=COALESCE(read_at,now())
WHERE category='departure_unassigned' AND is_read=FALSE;
-- Retain every other scanner rule and authorization check; change only this exact predicate.
DO $scanner$
DECLARE
  v_definition TEXT;
  v_old CONSTANT TEXT := 'AND (d.guide_id IS NULL OR d.vessel_id IS NULL)';
  v_new CONSTANT TEXT := 'AND d.resource_management_mode = ''internal'' AND (d.guide_id IS NULL OR d.vessel_id IS NULL)';
  v_count INTEGER;
BEGIN
  SELECT pg_get_functiondef('public.scan_staff_notifications()'::regprocedure) INTO v_definition;
  IF v_definition IS NULL THEN RAISE EXCEPTION 'Expected public.scan_staff_notifications() to exist'; END IF;
  v_count := (length(v_definition)-length(replace(v_definition,v_old,'')))/length(v_old);
  IF v_count <> 1 THEN RAISE EXCEPTION 'Expected one departure predicate in scanner; found %',v_count; END IF;
  EXECUTE replace(v_definition,v_old,v_new);
END;
$scanner$;
COMMIT;
