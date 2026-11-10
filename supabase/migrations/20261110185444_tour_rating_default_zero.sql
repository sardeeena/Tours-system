-- New tours have no rating until real, published guest reviews exist.
ALTER TABLE public.tours
  ALTER COLUMN rating SET DEFAULT 0;

COMMENT ON COLUMN public.tours.rating IS
  'Average rating derived from genuine published guest reviews; 0 means no published rating exists.';
COMMENT ON COLUMN public.tours.review_count IS
  'Number of genuine published guest reviews associated with this tour.';
