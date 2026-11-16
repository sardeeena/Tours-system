-- Keep the About page's database SEO override consistent with its public HTML renderer.
-- This row was left noindex even after the application explicitly made /about indexable.
BEGIN;

UPDATE public.seo_metadata
SET robots_index = TRUE,
    robots_follow = TRUE,
    meta_description = 'Meet Awesome Adventure Tours in Hurghada, Egypt. Learn about our local team, Red Sea excursions, booking support and how to plan your trip.',
    updated_at = NOW()
WHERE entity_type = 'page'
  AND page_slug = 'about'
  AND robots_index IS DISTINCT FROM TRUE;

COMMIT;
