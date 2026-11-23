BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(16);

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
  NOT EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
    WHERE table_schema='public' AND grantee='anon'
      AND privilege_type IN ('INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER')
  ),
  'anonymous users have no direct write or table-maintenance grants anywhere in the public schema'
);
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM information_schema.role_table_grants g
    WHERE g.table_schema='public' AND g.grantee='anon' AND g.privilege_type='SELECT'
      AND NOT EXISTS (
        SELECT 1 FROM pg_policies p
        WHERE p.schemaname='public' AND p.tablename=g.table_name AND p.cmd='SELECT'
          AND ('anon'=ANY(p.roles::text[]) OR 'public'=ANY(p.roles::text[]))
      )
  ),
  'anonymous SELECT grants exist only for tables with an explicit public read policy'
);
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='S'
      AND (
        has_sequence_privilege('anon',c.oid,'USAGE')
        OR has_sequence_privilege('anon',c.oid,'SELECT')
        OR has_sequence_privilege('anon',c.oid,'UPDATE')
      )
  ),
  'anonymous users have no direct sequence privileges'
);
SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_default_acl d
    CROSS JOIN LATERAL aclexplode(d.defaclacl) acl
    JOIN pg_roles grantee ON grantee.oid=acl.grantee
    WHERE d.defaclnamespace='public'::regnamespace
      AND grantee.rolname='anon'
      AND d.defaclobjtype IN ('r','S','f')
  ),
  'future public tables, sequences and functions do not inherit anonymous privileges'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='create_booking_atomic'
      AND has_function_privilege('anon',p.oid,'EXECUTE')
  )
  AND EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='create_booking_atomic_with_departure'
      AND has_function_privilege('anon',p.oid,'EXECUTE')
  )
  AND EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='get_tour_availability_schedule'
      AND has_function_privilege('anon',p.oid,'EXECUTE')
  )
  AND EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='lookup_booking_secure'
      AND has_function_privilege('anon',p.oid,'EXECUTE')
  )
  AND EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='request_booking_cancellation_secure'
      AND has_function_privilege('anon',p.oid,'EXECUTE')
  ),
  'intentional guest booking, availability, lookup and cancellation RPCs retain explicit execute grants'
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
