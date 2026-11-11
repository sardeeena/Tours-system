BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(11);

SELECT ok(to_regclass('public.access_roles') IS NOT NULL,'access role catalog exists');
SELECT ok(to_regclass('public.access_permissions') IS NOT NULL,'permission catalog exists');
SELECT ok(to_regclass('public.user_roles') IS NOT NULL,'many-to-many user role assignments exist');
SELECT ok(to_regclass('public.role_permissions') IS NOT NULL,'role permission assignments exist');

SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid='public.user_roles'::regclass),
  'user role assignments have RLS enabled'
);
SELECT ok(
  NOT has_table_privilege('authenticated','public.user_roles','SELECT'),
  'authenticated clients cannot read or mutate role assignment tables directly'
);
SELECT ok(
  has_function_privilege('authenticated','public.get_my_access_context()','EXECUTE')
  AND NOT has_function_privilege('anon','public.get_my_access_context()','EXECUTE'),
  'only authenticated users can request their own access context'
);
SELECT ok(
  has_function_privilege('authenticated','public.admin_assign_user_roles(uuid,text[])','EXECUTE')
  AND NOT has_function_privilege('anon','public.admin_assign_user_roles(uuid,text[])','EXECUTE'),
  'role assignment RPC is unavailable to anonymous users'
);
SELECT ok(
  has_function_privilege('authenticated','public.admin_upsert_access_role(text,text,text,text[])','EXECUTE')
  AND NOT has_function_privilege('anon','public.admin_upsert_access_role(text,text,text[])','EXECUTE'),
  'custom role management RPC is unavailable to anonymous users'
);
SELECT ok(
  EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bookings' AND policyname='rbac_bookings_manage'),
  'booking mutations have a permission-based RLS policy'
);
SELECT ok(
  EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='payment_transactions' AND policyname='rbac_payment_transactions_manage'),
  'payment mutations have a finance permission-based RLS policy'
);

SELECT * FROM finish();
ROLLBACK;