-- Preserve existing vessel maintenance dates when the canonical field was introduced.
-- The earlier hardening migration added next_maintenance_date but did not copy
-- the populated legacy next_maintenance values. That left the departure RPC
-- checking an empty field and could allow a vessel overdue for maintenance.
BEGIN;

ALTER TABLE public.vessels
  ADD COLUMN IF NOT EXISTS next_maintenance_date DATE;

UPDATE public.vessels
SET next_maintenance_date = next_maintenance
WHERE next_maintenance_date IS NULL
  AND next_maintenance IS NOT NULL;

COMMENT ON COLUMN public.vessels.next_maintenance_date IS
  'Canonical next maintenance due date. Existing values are backfilled from legacy next_maintenance; update this field after maintenance is verified.';

NOTIFY pgrst, 'reload schema';
COMMIT;
