BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(11);

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES
  ('f9000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'pgtap-superadmin@example.test', '', NULL, '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('f9000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'pgtap-admin-aal@example.test', '', NULL, '{}'::jsonb, '{}'::jsonb, now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, email, full_name, role, is_confirmed)
VALUES
  ('f9000000-0000-0000-0000-000000000003', 'pgtap-superadmin@example.test', 'PgTAP Super Admin', 'customer', false),
  ('f9000000-0000-0000-0000-000000000004', 'pgtap-admin-aal@example.test', 'PgTAP Admin', 'customer', false)
ON CONFLICT (id) DO NOTHING;

SELECT set_config('app.admin_provisioning_nonce', 'pgtap-aal2-superadmin', true);
SELECT set_config('app.admin_provisioning_active_user', 'f9000000-0000-0000-0000-000000000003', true);
UPDATE public.profiles SET role = 'super_admin', is_confirmed = TRUE
WHERE id = 'f9000000-0000-0000-0000-000000000003';
SELECT set_config('app.admin_provisioning_active_user', 'f9000000-0000-0000-0000-000000000004', true);
UPDATE public.profiles SET role = 'admin', is_confirmed = TRUE
WHERE id = 'f9000000-0000-0000-0000-000000000004';
SELECT set_config('app.admin_provisioning_nonce', '', true);
SELECT set_config('app.admin_provisioning_active_user', '', true);

-- Model a legacy super-admin that also has an admin role assignment.
INSERT INTO public.user_roles (user_id, role_id)
SELECT 'f9000000-0000-0000-0000-000000000003', id
FROM public.access_roles
WHERE slug = 'admin'
ON CONFLICT (user_id, role_id) DO NOTHING;

SET LOCAL request.jwt.claims = '{"sub":"f9000000-0000-0000-0000-000000000003","role":"authenticated","aal":"aal1"}';
SET LOCAL request.jwt.claim.sub = 'f9000000-0000-0000-0000-000000000003';
SET LOCAL ROLE authenticated;

SELECT is(private.has_role('super_admin'), false, 'super_admin role is denied at AAL1');
SELECT is(private.has_role('admin'), false, 'super_admin cannot use an additional admin role at AAL1');
SELECT is(private.has_permission('customers.update'), false, 'super_admin permissions are denied at AAL1');
SELECT is(private.is_admin(), false, 'super_admin admin checks are denied at AAL1');

SET LOCAL request.jwt.claims = '{"sub":"f9000000-0000-0000-0000-000000000003","role":"authenticated","aal":"aal2"}';
SELECT is(private.has_role('super_admin'), true, 'super_admin role is granted at AAL2');
SELECT is(private.has_role('admin'), true, 'super_admin additional admin role is granted at AAL2');
SELECT is(private.has_permission('customers.update'), true, 'super_admin permissions are granted at AAL2');
SELECT is(private.is_admin(), true, 'super_admin admin checks are granted at AAL2');

SET LOCAL request.jwt.claims = '{"sub":"f9000000-0000-0000-0000-000000000004","role":"authenticated","aal":"aal1"}';
SET LOCAL request.jwt.claim.sub = 'f9000000-0000-0000-0000-000000000004';
SELECT is(private.has_role('admin'), true, 'ordinary admin role remains available at AAL1');
SELECT is(private.has_permission('customers.update'), true, 'ordinary admin permissions remain available at AAL1');

SET LOCAL request.jwt.claims = '{"role":"service_role","aal":"aal1"}';
SET LOCAL request.jwt.claim.role = 'service_role';
RESET ROLE;
SET LOCAL ROLE service_role;
SELECT is(private.has_permission('customers.update'), true, 'service_role remains trusted regardless of AAL');

SELECT * FROM finish();
ROLLBACK;
