-- Preserve the primary category and deterministic display order for each tour.
ALTER TABLE public.tour_categories
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.tour_categories.sort_order IS
  'Ordering of categories for a tour; the first item is its primary category.';
