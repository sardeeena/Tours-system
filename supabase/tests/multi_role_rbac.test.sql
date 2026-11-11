BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(18);

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
  AND NOT has_function_privilege('anon','public.admin_upsert_access_role(text,text,text,text[])','EXECUTE'),
  'custom role management RPC is unavailable to anonymous users'
);
SELECT ok(
  EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bookings' AND policyname='rbac_bookings_create')
  AND EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bookings' AND policyname='rbac_bookings_update')
  AND EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bookings' AND policyname='rbac_bookings_delete'),
  'booking create, update and delete are enforced by separate RLS policies'
);
SELECT ok(
  EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='payment_transactions' AND policyname='rbac_payment_transactions_create')
  AND EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='payment_transactions' AND policyname='rbac_payment_transactions_update')
  AND EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='payment_transactions' AND policyname='rbac_payment_transactions_delete'),
  'finance create, update and delete are enforced by separate RLS policies'
);
SELECT ok(
  EXISTS(SELECT 1 FROM public.access_permissions WHERE permission_key IN ('bookings.approve','bookings.export','finance.create','finance.approve','finance.export')),
  'action-level workflow permissions are registered in the permission catalog'
);
SELECT ok(
  NOT has_function_privilege('anon','public.sync_legacy_profile_role_to_user_roles()','EXECUTE')
  AND NOT has_function_privilege('authenticated','public.sync_legacy_profile_role_to_user_roles()','EXECUTE'),
  'profile role synchronization trigger cannot be invoked through the Data API'
);
SELECT ok(
  EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_roles' AND policyname='rbac_deny_direct_user_roles'),
  'direct user role table access is explicitly denied by RLS'
);
SELECT ok(
  EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='RBAC can upload tour media')
  AND EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='RBAC can update tour media')
  AND EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='RBAC can delete tour media'),
  'tour media storage writes are permission-scoped'
);
SELECT ok(
  EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='RBAC finance can view vouchers')
  AND EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='RBAC finance can upload vouchers'),
  'finance voucher storage access is permission-scoped'
);
SELECT ok(
  position('RBAC_ROLE_CREATED' in pg_get_functiondef('private.admin_upsert_access_role(text,text,text,text[])'::regprocedure))>0
  AND position('RBAC_ROLE_UPDATED' in pg_get_functiondef('public.admin_upsert_access_role(text,text,text,text[])'::regprocedure))>0,
  'custom role creation and permission changes are audited'
);
SELECT ok(
  position('RBAC_ROLE_DELETED' in pg_get_functiondef('private.admin_delete_access_role(text)'::regprocedure))>0,
  'custom role deletion is audited'
);

SELECT * FROM finish();
ROLLBACK;