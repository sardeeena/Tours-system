BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(5);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p')
      AND has_table_privilege('anon', c.oid, 'TRUNCATE')
  ),
  'anon cannot TRUNCATE any public table'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p')
      AND has_table_privilege('authenticated', c.oid, 'TRUNCATE')
  ),
  'authenticated cannot TRUNCATE any public table'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p')
      AND (has_table_privilege('anon', c.oid, 'MAINTAIN') OR has_table_privilege('authenticated', c.oid, 'MAINTAIN'))
  ),
  'browser roles cannot run MAINTAIN on public tables'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_default_acl d
    CROSS JOIN LATERAL aclexplode(d.defaclacl) a
    WHERE d.defaclnamespace='public'::regnamespace AND d.defaclobjtype='r'
      AND a.grantee IN ('anon'::regrole::oid, 'authenticated'::regrole::oid)
      AND a.privilege_type IN ('TRUNCATE','MAINTAIN','REFERENCES','TRIGGER')
  ),
  'default table privileges do not reintroduce RLS-bypass grants'
);

SELECT ok(
  NOT has_table_privilege('anon','public.inquiries','INSERT')
  AND NOT has_table_privilege('anon','public.newsletter_subscriptions','INSERT'),
  'anonymous roles cannot insert directly into public form tables'
);

SELECT * FROM finish();
ROLLBACK;
