BEGIN;
SELECT plan(4);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM public.tours
    WHERE slug = 'ultimate-sinai-desert-safari-quad-camel-bbq-adventure-copy-757'
  ),
  'The legacy Sharm Super Safari slug is no longer assigned'
);

SELECT ok(
  to_regclass('public.idx_tour_images_primary') IS NULL,
  'The duplicate non-unique primary-image index is removed'
);

SELECT ok(
  to_regclass('public.uq_tour_images_one_primary_per_tour') IS NOT NULL,
  'The unique primary-image constraint index remains'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM public.tours
    WHERE slug = 'sharm-super-safari-atv-camel-stargazing-bbq-dinner'
  )
  OR EXISTS (
    SELECT 1
    FROM public.tours AS tour
    WHERE tour.slug = 'sharm-super-safari-atv-camel-stargazing-bbq-dinner'
      AND tour.title = 'Sharm: Super Safari ATV, Camel Ride, Stargazing & BBQ Dinner'
      AND EXISTS (SELECT 1 FROM public.departures AS departure WHERE departure.tour_id = tour.id)
      AND EXISTS (
        SELECT 1 FROM public.seo_metadata AS seo
        WHERE seo.entity_type = 'tour'
          AND seo.entity_id = tour.id
          AND seo.page_slug = 'sharm-super-safari-atv-camel-stargazing-bbq-dinner'
      )
  ),
  'The renamed tour retains its departures and matching SEO metadata when catalogue data exists'
);

SELECT * FROM finish();
ROLLBACK;
