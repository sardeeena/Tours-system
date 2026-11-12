BEGIN;

-- These four non-unique indexes are exact duplicates of existing UNIQUE
-- constraint indexes. Their usage counters had remained at zero since the
-- database statistics reset on 2026-11-03. Removing the redundant copies
-- keeps the uniqueness guarantees and indexed lookup paths intact.
DROP INDEX IF EXISTS public.idx_bookings_reference;
DROP INDEX IF EXISTS public.idx_invoices_number;
DROP INDEX IF EXISTS public.idx_media_assets_storage_path;
DROP INDEX IF EXISTS public.idx_pickup_locations_code;

COMMIT;
