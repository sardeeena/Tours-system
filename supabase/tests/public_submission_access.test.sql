BEGIN;
SELECT plan(12);

SELECT ok(
  NOT has_table_privilege('anon', 'public.inquiries', 'INSERT'),
  'Anonymous users cannot insert directly into inquiries'
);
SELECT ok(
  NOT has_table_privilege('anon', 'public.inquiries', 'SELECT'),
  'Anonymous users cannot read inquiry records'
);
SELECT ok(
  NOT has_table_privilege('anon', 'public.newsletter_subscriptions', 'INSERT'),
  'Anonymous users cannot insert directly into newsletter subscriptions'
);
SELECT ok(
  NOT has_table_privilege('anon', 'public.newsletter_subscriptions', 'SELECT'),
  'Anonymous users cannot read newsletter subscriptions'
);
SELECT ok(
  has_table_privilege('service_role', 'public.inquiries', 'INSERT'),
  'The validated server endpoint retains inquiry insert access'
);
SELECT ok(
  has_table_privilege('service_role', 'public.newsletter_subscriptions', 'INSERT'),
  'The validated server endpoint retains newsletter insert access'
);
SELECT ok(
  has_function_privilege('service_role', 'public.check_atomic_rate_limit(text,text,interval,integer,text)', 'EXECUTE'),
  'Server-side endpoints can use the atomic per-email rate limiter'
);
SELECT ok(
  NOT has_function_privilege('anon', 'public.check_atomic_rate_limit(text,text,interval,integer,text)', 'EXECUTE'),
  'Anonymous users cannot manipulate arbitrary rate-limit buckets'
);
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'inquiries'
      AND policyname = 'Public can insert inquiry'
  ),
  'The anonymous inquiry insert policy is removed'
);
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'newsletter_subscriptions'
      AND policyname = 'Public can insert newsletter subscription'
  ),
  'The anonymous newsletter insert policy is removed'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'inquiries'
      AND policyname = 'rbac_inquiries_create'
      AND with_check LIKE '%crm.create%'
      AND with_check NOT LIKE '%OR true%'
  ),
  'CRM inquiry creation requires the crm.create permission'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'newsletter_subscriptions'
      AND policyname = 'rbac_newsletter_subscriptions_create'
      AND with_check LIKE '%content.create%'
      AND with_check NOT LIKE '%OR true%'
  ),
  'Newsletter admin creation requires the content.create permission'
);

SELECT * FROM finish();
ROLLBACK;
