-- Remove one confirmed, unused duplicate of the categories.slug unique index.
-- The unique constraint/index remains authoritative and provides the same lookup.
BEGIN;
DROP INDEX IF EXISTS public.idx_categories_slug;
DROP INDEX IF EXISTS public.idx_destinations_slug;
DROP INDEX IF EXISTS public.idx_tours_slug;
DROP INDEX IF EXISTS public.idx_tour_availability_tour_date;
DROP INDEX IF EXISTS public.idx_seo_lookup;
COMMIT;
