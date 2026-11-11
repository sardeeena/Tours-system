BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(3);

WITH redundant(tablename, policyname) AS (
  VALUES
    ('bookings','Staff can manage all bookings'),
    ('crm_activities','Staff can view crm activities'),
    ('customers','Staff can manage all customers'),
    ('customers','Admins can view all customers'),
    ('guides','Staff can manage guides'),
    ('payment_transactions','Staff can manage payments'),
    ('profiles','Admins can view all profiles'),
    ('refund_records','Staff can manage refunds'),
    ('vessels','Staff can manage vessels'),
    ('weather_bulletins','Staff can manage weather bulletins'),
    ('guides','Public can view active guides'),
    ('vessels','Public can view active vessels'),
    ('weather_bulletins','Public can view weather bulletins')
)
SELECT is(
  (
    SELECT count(*)::integer
    FROM redundant r
    JOIN pg_policies p
      ON p.schemaname='public'
     AND p.tablename=r.tablename
     AND p.policyname=r.policyname
  ),
  0,
  'all 13 verified duplicate policies are removed'
);

WITH legacy_admin(tablename, policyname) AS (
  VALUES
    ('bookings','Admins manage bookings'),
    ('crm_activities','Staff can manage activities'),
    ('customers','Admins can manage customers'),
    ('guides','Admins can manage guides'),
    ('payment_transactions','Staff can manage payment transactions'),
    ('profiles','Admins can manage all profiles'),
    ('refund_records','Staff can manage refund records'),
    ('vessels','Admins can manage vessels'),
    ('weather_bulletins','Admins can manage weather bulletins')
),
rbac(tablename, policyname) AS (
  VALUES
    ('bookings','rbac_bookings_read'),
    ('crm_activities','rbac_crm_activities_read'),
    ('customers','rbac_customers_read'),
    ('guides','rbac_guides_read'),
    ('payment_transactions','rbac_payment_transactions_read'),
    ('profiles','rbac_profiles_read'),
    ('refund_records','rbac_refund_records_read'),
    ('vessels','rbac_vessels_read'),
    ('weather_bulletins','rbac_weather_bulletins_read')
)
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM legacy_admin l
    JOIN pg_policies p
      ON p.schemaname='public'
     AND p.tablename=l.tablename
     AND p.policyname=l.policyname
  )
  AND (
    SELECT count(*) = 9
    FROM rbac r
    JOIN pg_policies p
      ON p.schemaname='public'
     AND p.tablename=r.tablename
     AND p.policyname=r.policyname
  ),
  'legacy admin policies are replaced by the nine canonical RBAC read policies'
);

SELECT ok(
  (
    SELECT count(*) = 3
    FROM pg_proc p
    WHERE p.oid IN (
      'private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text)'::regprocedure,
      'private.replace_extra_tour_assignments_atomic(uuid,jsonb)'::regprocedure,
      'private.replace_tour_extra_assignments_atomic(uuid,jsonb)'::regprocedure
    )
    AND p.prosecdef
    AND p.proconfig @> ARRAY['search_path=""']::text[]
  )
  AND (
    SELECT count(*) = 3
    FROM pg_proc p
    WHERE p.oid IN (
      'public.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text)'::regprocedure,
      'public.replace_extra_tour_assignments_atomic(uuid,jsonb)'::regprocedure,
      'public.replace_tour_extra_assignments_atomic(uuid,jsonb)'::regprocedure
    )
    AND NOT p.prosecdef
    AND p.proconfig @> ARRAY['search_path=""']::text[]
  ),
  'private SECURITY DEFINER implementations use empty search_path behind invoker-rights public wrappers'
);

SELECT * FROM finish();
ROLLBACK;
