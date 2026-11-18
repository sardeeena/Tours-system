-- Remove one confirmed, unused duplicate of the categories.slug unique index.
-- The unique constraint/index remains authoritative and provides the same lookup.
BEGIN;
DROP INDEX IF EXISTS public.idx_categories_slug;
COMMIT;
