-- Keep the About page's database SEO override consistent with its public HTML renderer.
-- This row was left noindex even after the application explicitly made /about indexable.
BEGIN;

UPDATE public.seo_metadata
SET robots_index = TRUE,
    robots_follow = TRUE,
    updated_at = NOW()
WHERE entity_type = 'page'
  AND page_slug = 'about'
  AND robots_index IS DISTINCT FROM TRUE;

COMMIT;
