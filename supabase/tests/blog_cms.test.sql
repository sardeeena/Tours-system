BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(12);

SELECT ok(to_regclass('public.blog_categories') IS NOT NULL, 'blog categories table exists');
SELECT ok(to_regclass('public.blog_posts') IS NOT NULL, 'blog posts table exists');
SELECT ok((SELECT count(*)=1 FROM information_schema.columns WHERE table_schema='public' AND table_name='blog_posts' AND column_name='reading_time_minutes'), 'blog posts persist reading time for lightweight catalogue reads');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid='public.blog_categories'::regclass), 'blog categories have RLS enabled');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid='public.blog_posts'::regclass), 'blog posts have RLS enabled');

SELECT is(
  (SELECT count(*)::integer FROM pg_policies WHERE schemaname='public' AND tablename='blog_posts' AND cmd='SELECT'),
  1,
  'blog posts use one combined public/editor SELECT policy'
);
SELECT is(
  (SELECT count(*)::integer FROM pg_policies WHERE schemaname='public' AND tablename='blog_categories' AND cmd='SELECT'),
  1,
  'blog categories use one public SELECT policy'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='blog_posts'
      AND policyname='blog_posts_public_and_editor_read'
      AND roles @> ARRAY['anon']::name[]
      AND roles @> ARRAY['authenticated']::name[]
      AND qual LIKE '%published%'
      AND qual LIKE '%has_permission%'
  ),
  'published content is public while drafts require content.manage'
);

SELECT ok(
  EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='blog_posts' AND cmd='INSERT' AND with_check LIKE '%private.has_permission%')
  AND EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='blog_posts' AND cmd='UPDATE' AND qual LIKE '%private.has_permission%' AND with_check LIKE '%private.has_permission%')
  AND EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='blog_posts' AND cmd='DELETE' AND qual LIKE '%private.has_permission%'),
  'all editorial mutations require content.manage'
);

SELECT ok(
  EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='blog_categories' AND cmd='INSERT' AND with_check LIKE '%private.has_permission%')
  AND EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='blog_categories' AND cmd='UPDATE' AND qual LIKE '%private.has_permission%' AND with_check LIKE '%private.has_permission%')
  AND EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='blog_categories' AND cmd='DELETE' AND qual LIKE '%private.has_permission%'),
  'all category mutations require content.manage'
);

SELECT ok(
  NOT has_table_privilege('anon','public.blog_posts','INSERT')
  AND NOT has_table_privilege('anon','public.blog_posts','UPDATE')
  AND NOT has_table_privilege('anon','public.blog_posts','DELETE'),
  'anonymous users have no blog write privileges'
);

SELECT ok(
  EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='blog_posts' AND indexname='blog_posts_publication_idx')
  AND EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='blog_posts' AND indexname='blog_posts_category_idx'),
  'publication and category lookups have supporting indexes'
);

SELECT * FROM finish();
ROLLBACK;
