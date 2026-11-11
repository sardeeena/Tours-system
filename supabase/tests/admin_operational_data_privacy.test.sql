BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(4);

SELECT is(
  (
    SELECT count(*)::integer
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'coupons',
        'departures',
        'guides',
        'media_assets',
        'tour_availability',
        'tour_vessels',
        'vessels',
        'weather_bulletins'
      )
      AND cmd = 'SELECT'
      AND roles @> ARRAY['public']::name[]
  ),
  0,
  'anonymous users have no direct SELECT policies on administrative and operational tables'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        (tablename = 'coupons' AND policyname = 'Admins can manage coupons')
        OR (tablename = 'departures' AND policyname = 'Staff can manage departures')
        OR (tablename = 'guides' AND policyname = 'Admins can manage guides')
        OR (tablename = 'media_assets' AND policyname = 'Admins can manage media assets')
        OR (tablename = 'tour_availability' AND policyname = 'Admins manage availability')
        OR (tablename = 'tour_vessels' AND policyname = 'Admins can manage tour vessels')
        OR (tablename = 'vessels' AND policyname = 'Admins can manage vessels')
        OR (tablename = 'weather_bulletins' AND policyname = 'Admins can manage weather bulletins')
      )
      AND cmd = 'ALL'
      AND roles @> ARRAY['authenticated']::name[]
      AND qual LIKE '%is_admin%'
      AND with_check LIKE '%is_admin%'
  ),
  0,
  'legacy broad admin policies are removed in favor of action-level RBAC policies'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'site_settings'
      AND policyname = 'Public can read approved site settings'
      AND cmd = 'SELECT'
      AND roles @> ARRAY['anon']::name[]
      AND qual LIKE '%company_info%'
      AND qual LIKE '%booking_policies%'
      AND qual LIKE '%social_links%'
      AND qual LIKE '%footer_content%'
      AND qual LIKE '%pages_content%'
  )
  AND EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'site_settings'
      AND policyname = 'rbac_site_settings_read'
      AND roles @> ARRAY['authenticated']::name[]
      AND qual LIKE '%company_info%'
      AND qual LIKE '%booking_policies%'
      AND qual LIKE '%social_links%'
      AND qual LIKE '%footer_content%'
      AND qual LIKE '%pages_content%'
  ),
  'public site settings reads are limited to the five approved public content keys'
);

SELECT ok(
  has_function_privilege(
    'anon',
    'public.get_tour_availability_schedule(text,date,date)',
    'EXECUTE'
  ),
  'public booking availability remains available through the guarded RPC'
);

SELECT * FROM finish();
ROLLBACK;
