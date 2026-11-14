# Database RBAC authority

## Authorization source of truth

The active normalized `public.user_roles` assignments joined to active `public.access_roles` are the only source of role authorization. `public.profiles.role` remains a compatibility/display field and is not an authorization fallback.

`private.has_role(text)`, `private.has_permission(text)`, and `private.is_admin()` are the shared database authorization helpers used by RLS policies and protected database functions. Admin and Super Admin roles require AAL2. Missing assignments or unavailable context fail closed.

## Site Settings

Site Settings management is restricted to an active normalized `super_admin` assignment at AAL2. The ordinary Admin role and custom roles cannot gain `settings.manage` through role permission assignments.

The existing anonymous read policy is intentionally preserved for the small approved public-settings key allowlist used by the public website. It does not expose the administrative settings interface or unrestricted settings rows.

## Verification

`supabase/tests/normalized_rbac_authority.test.sql` verifies legacy-profile-only denial, normalized Admin and Super Admin behavior, AAL2-sensitive access, and the Site Settings boundary.

The migration changes database function definitions and removes the obsolete `settings.manage` assignment from the ordinary Admin role. It does not change user role assignments, customer records, booking records, or historical audit evidence.
