BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(7);

SELECT has_column('public', 'seo_metadata', 'meta_description',
  'SEO metadata uses the live meta_description column');

SELECT has_column('public', 'seo_metadata', 'structured_data',
  'SEO metadata persists JSON-LD structured data');

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.seo_metadata'::regclass
      AND conname = 'seo_metadata_entity_type_page_slug_key'
  ),
  'page SEO records have a unique entity_type and page_slug key'
);

SELECT lives_ok(
  $$
    INSERT INTO public.seo_metadata (
      entity_type, entity_id, page_slug, seo_title, meta_description,
      canonical_url, robots_index, robots_follow, structured_data
    )
    VALUES (
      'page', NULL, 'pgtap-seo-contract', 'Initial SEO Title',
      'Initial description', 'https://kemetspirit.com/pgtap-seo-contract',
      TRUE, TRUE, '{"@context":"https://schema.org","@type":"WebPage"}'::jsonb
    )
    ON CONFLICT (entity_type, page_slug)
    DO UPDATE SET seo_title = EXCLUDED.seo_title
  $$,
  'page SEO metadata can be inserted using page_slug'
);

SELECT lives_ok(
  $$
    INSERT INTO public.seo_metadata (
      entity_type, entity_id, page_slug, seo_title, meta_description,
      canonical_url, robots_index, robots_follow, structured_data
    )
    VALUES (
      'page', NULL, 'pgtap-seo-contract', 'Updated SEO Title',
      'Updated description', 'https://kemetspirit.com/pgtap-seo-contract',
      TRUE, TRUE, '{"@context":"https://schema.org","@type":"WebPage"}'::jsonb
    )
    ON CONFLICT (entity_type, page_slug)
    DO UPDATE SET
      seo_title = EXCLUDED.seo_title,
      meta_description = EXCLUDED.meta_description
  $$,
  'page SEO metadata updates the existing row instead of duplicating it'
);

SELECT is(
  (SELECT count(*)::integer FROM public.seo_metadata
   WHERE entity_type = 'page' AND page_slug = 'pgtap-seo-contract'),
  1,
  'repeated page SEO saves keep exactly one row'
);

SELECT is(
  (SELECT seo_title FROM public.seo_metadata
   WHERE entity_type = 'page' AND page_slug = 'pgtap-seo-contract'),
  'Updated SEO Title',
  'page SEO upsert stores the latest title'
);

SELECT * FROM finish();
ROLLBACK;
