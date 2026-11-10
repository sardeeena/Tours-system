-- The original invoice schema already provides this unique index.
-- Keep the used canonical index and remove the redundant alias added by the
-- invoice synchronization migration.

BEGIN;
DROP INDEX IF EXISTS public.idx_invoices_booking_id;
COMMIT;
