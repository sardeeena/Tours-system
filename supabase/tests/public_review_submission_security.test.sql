BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(11);

SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid='public.reviews'::regclass),
  'reviews table keeps row-level security enabled'
);
SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM information_schema.role_table_grants g
    WHERE g.table_schema='public'
      AND g.grantee='anon'
      AND NOT EXISTS (
        SELECT 1 FROM pg_policies p
        WHERE p.schemaname=g.table_schema
          AND p.tablename=g.table_name
          AND ('anon'=ANY(p.roles::text[]) OR 'public'=ANY(p.roles::text[]))
      )
  ),
  'anonymous table grants are absent wherever no public RLS policy exists'
);
SELECT ok(
  NOT has_table_privilege('anon','public.reviews','INSERT'),
  'anonymous visitors cannot insert directly into reviews'
);
SELECT ok(
  NOT has_table_privilege('anon','public.reviews','UPDATE')
  AND NOT has_table_privilege('anon','public.reviews','DELETE'),
  'anonymous visitors cannot modify or delete reviews'
);
SELECT ok(
  has_table_privilege('anon','public.reviews','SELECT'),
  'anonymous visitors can read approved reviews'
);
SELECT ok(
  has_table_privilege('authenticated','public.reviews','SELECT'),
  'signed-in customers can read approved reviews'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='reviews'
      AND policyname='Public can read published reviews'
      AND cmd='SELECT'
      AND roles @> ARRAY['anon']::name[]
      AND NOT (roles @> ARRAY['authenticated']::name[])
      AND qual ILIKE '%is_published%'
  ),
  'anonymous public read policy exposes only published reviews'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='reviews'
      AND policyname='rbac_reviews_read'
      AND cmd='SELECT'
      AND roles @> ARRAY['authenticated']::name[]
      AND qual ILIKE '%is_published%'
      AND qual ILIKE '%has_permission%'
  ),
  'signed-in customers read published reviews through the existing single RBAC read policy'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='reviews'
      AND policyname='rbac_reviews_create'
      AND cmd='INSERT'
      AND roles @> ARRAY['authenticated']::name[]
      AND coalesce(with_check,'') ILIKE '%has_permission%'
  ),
  'direct authenticated inserts remain restricted by staff content permission'
);
SELECT ok(
  (SELECT column_default IN ('false','false::boolean') FROM information_schema.columns
   WHERE table_schema='public' AND table_name='reviews' AND column_name='is_published'),
  'new reviews default to pending moderation'
);
SELECT ok(
  (SELECT column_default IN ('false','false::boolean') FROM information_schema.columns
   WHERE table_schema='public' AND table_name='reviews' AND column_name='verified_booking'),
  'new reviews are never marked as verified by default'
);

SELECT * FROM finish();
ROLLBACK;
