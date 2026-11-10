-- Public catalogue policies must not invoke the authenticated-only is_admin() RPC.
-- Admins retain access to unpublished rows through their separate authenticated
-- management policies; anonymous visitors can read only each table's public condition.
DO $migration$
DECLARE
  policy_record record;
  revised_qual text;
  updated_count integer := 0;
BEGIN
  FOR policy_record IN
    SELECT schemaname, tablename, policyname, qual
    FROM pg_policies
    WHERE schemaname = 'public'
      AND 'public' = ANY(roles)
      AND qual IS NOT NULL
      AND qual ~* '\mOR\M\s+is_admin\s*\(\s*\)'
  LOOP
    revised_qual := regexp_replace(
      policy_record.qual,
      '\s+OR\s+is_admin\s*\(\s*\)',
      '',
      'gi'
    );

    EXECUTE format(
      'ALTER POLICY %I ON %I.%I USING (%s)',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename,
      revised_qual
    );
    updated_count := updated_count + 1;
  END LOOP;

  IF updated_count = 0 THEN
    RAISE EXCEPTION 'Expected public policies containing OR is_admin() but found none; refusing a silent no-op';
  END IF;
END
$migration$;

DO $validation$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND 'public' = ANY(roles)
      AND coalesce(qual, '') ~* 'is_admin\s*\('
  ) THEN
    RAISE EXCEPTION 'Public policies still call is_admin(); migration validation failed';
  END IF;
END
$validation$;
