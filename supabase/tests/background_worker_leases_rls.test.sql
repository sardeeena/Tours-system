BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(1);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'private'
      AND tablename = 'background_worker_leases'
      AND policyname = 'background_worker_leases_deny_client_access'
      AND cmd = 'ALL'
      AND qual = 'false'
      AND with_check = 'false'
      AND roles @> ARRAY['anon'::name, 'authenticated'::name]
  ),
  'background worker leases explicitly deny all browser-role reads and writes'
);

SELECT * FROM finish();
ROLLBACK;
