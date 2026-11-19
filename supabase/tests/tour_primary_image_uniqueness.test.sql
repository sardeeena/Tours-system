BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(2);

SELECT ok(
  to_regclass('public.uq_tour_images_one_primary_per_tour') IS NOT NULL,
  'database enforces at most one primary image per tour'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM public.tour_images
    WHERE is_primary = TRUE
    GROUP BY tour_id
    HAVING count(*) > 1
  ),
  'no tour has duplicate primary images'
);

SELECT * FROM finish();
ROLLBACK;
