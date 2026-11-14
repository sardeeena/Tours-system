BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(13);

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES
  ('f9100000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'pgtap-legacy-role-only@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('f9100000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'pgtap-normalized-admin@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('f9100000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'pgtap-normalized-superadmin@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, email, full_name, role, is_confirmed)
VALUES
  ('f9100000-0000-0000-0000-000000000001', 'pgtap-legacy-role-only@example.test', 'Legacy Role Only', 'admin', true),
  ('f9100000-0000-0000-0000-000000000002', 'pgtap-normalized-admin@example.test', 'Normalized Admin', 'customer', true),
  ('f9100000-0000-0000-0000-000000000003', 'pgtap-normalized-superadmin@example.test', 'Normalized Super Admin', 'customer', true)
ON CONFLICT (id) DO NOTHING;

-- Simulate a stale legacy admin profile with no normalized admin assignment.
DELETE FROM public.user_roles
WHERE user_id = 'f9100000-0000-0000-0000-000000000001';

-- The other two users receive authority only from normalized role assignments.
INSERT INTO public.user_roles (user_id, role_id)
SELECT 'f9100000-0000-0000-0000-000000000002', id
FROM public.access_roles WHERE slug = 'admin' AND is_active
ON CONFLICT (user_id, role_id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role_id)
SELECT 'f9100000-0000-0000-0000-000000000003', id
FROM public.access_roles WHERE slug = 'super_admin' AND is_active
ON CONFLICT (user_id, role_id) DO NOTHING;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"f9100000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}';
SET LOCAL request.jwt.claim.sub = 'f9100000-0000-0000-0000-000000000001';

SELECT is(private.has_role('admin'), false, 'legacy profiles.role alone cannot grant admin at AAL2');
SELECT is(private.has_permission('customers.update'), false, 'legacy profiles.role alone cannot grant database permissions');
SELECT is(private.is_admin(), false, 'legacy profiles.role alone cannot satisfy database admin checks');

SET LOCAL request.jwt.claims = '{"sub":"f9100000-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}';
SET LOCAL request.jwt.claim.sub = 'f9100000-0000-0000-0000-000000000002';

SELECT is(private.has_role('admin'), true, 'normalized admin assignment is recognized');
SELECT is(private.has_permission('customers.update'), true, 'normalized admin retains ordinary module permissions');
SELECT is(private.has_permission('settings.manage'), false, 'ordinary Admin cannot access site settings');
SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM public.role_permissions rp
    JOIN public.access_roles r ON r.id = rp.role_id
    JOIN public.access_permissions p ON p.id = rp.permission_id
    WHERE r.slug = 'admin' AND p.permission_key = 'settings.manage'
  ),
  'settings.manage is not assigned to the ordinary Admin role'
);

SET LOCAL request.jwt.claims = '{"sub":"f9100000-0000-0000-0000-000000000003","role":"authenticated","aal":"aal2"}';
SET LOCAL request.jwt.claim.sub = 'f9100000-0000-0000-0000-000000000003';

SELECT is(private.has_role('super_admin'), true, 'normalized Super Admin assignment is recognized');
SELECT is(private.has_permission('settings.manage'), true, 'Super Admin with AAL2 can manage site settings');
SELECT ok(
  position('public.profiles' in pg_get_functiondef('private.has_role(text)'::regprocedure)) = 0,
  'database role helper contains no legacy profile-role lookup'
);
SELECT ok(
  position('public.profiles' in pg_get_functiondef('private.has_permission(text)'::regprocedure)) = 0,
  'database permission helper contains no legacy profile-role lookup'
);
SELECT is(
  (SELECT count(*)::integer FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'site_settings'
     AND policyname IN ('rbac_site_settings_read','rbac_site_settings_create','rbac_site_settings_update','rbac_site_settings_delete')),
  4,
  'all four site-settings management policies remain explicitly defined'
);

SELECT * FROM finish();
ROLLBACK;
