-- Require verified AAL2 MFA for Admin and Superadmin identities across all shared RBAC helpers.
-- Manager and Staff roles remain governed by their existing permissions and are not newly
-- forced into administrator MFA. Service-role operations remain trusted.
BEGIN;

CREATE OR REPLACE FUNCTION private.has_role(required_role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT COALESCE(
    (auth.jwt() ->> 'role') = 'service_role'
    OR (
      (
        (
          NOT EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role IN ('super_admin','admin')
          )
          AND NOT EXISTS (
            SELECT 1
            FROM public.user_roles ur
            JOIN public.access_roles r ON r.id = ur.role_id
            WHERE ur.user_id = auth.uid()
              AND r.slug IN ('super_admin','admin')
              AND r.is_active
          )
        )
        OR auth.jwt() ->> 'aal' = 'aal2'
      )
      AND (required_role NOT IN ('super_admin','admin') OR auth.jwt() ->> 'aal' = 'aal2')
      AND (
        EXISTS (
          SELECT 1
          FROM public.user_roles ur
          JOIN public.access_roles r ON r.id = ur.role_id
          WHERE ur.user_id = auth.uid()
            AND r.slug = required_role
            AND r.is_active
        )
        OR EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.role = required_role
        )
      )
    ),
    false
  );
$function$;

CREATE OR REPLACE FUNCTION private.has_permission(required_permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT COALESCE(
    (auth.jwt() ->> 'role') = 'service_role'
    OR (
      (
        public.has_role('super_admin')
        OR public.has_role('admin')
        OR EXISTS (
          SELECT 1
          FROM public.user_roles ur
          JOIN public.access_roles r ON r.id = ur.role_id AND r.is_active
          JOIN public.role_permissions rp ON rp.role_id = r.id
          JOIN public.access_permissions p ON p.id = rp.permission_id
          WHERE ur.user_id = auth.uid()
            AND (
              p.permission_key = required_permission
              OR p.permission_key = split_part(required_permission, '.', 1) || '.manage'
              OR (
                required_permission LIKE '%.read'
                AND p.permission_key = ANY(ARRAY[
                  split_part(required_permission, '.', 1) || '.create',
                  split_part(required_permission, '.', 1) || '.update',
                  split_part(required_permission, '.', 1) || '.delete',
                  split_part(required_permission, '.', 1) || '.approve',
                  split_part(required_permission, '.', 1) || '.export'
                ])
              )
            )
        )
      )
      AND (
        (
          NOT EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role IN ('super_admin','admin')
          )
          AND NOT EXISTS (
            SELECT 1
            FROM public.user_roles ur
            JOIN public.access_roles r ON r.id = ur.role_id
            WHERE ur.user_id = auth.uid()
              AND r.slug IN ('super_admin','admin')
              AND r.is_active
          )
        )
        OR auth.jwt() ->> 'aal' = 'aal2'
      )
    ),
    false
  );
$function$;

CREATE OR REPLACE FUNCTION private.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT COALESCE(
    (auth.jwt() ->> 'role') = 'service_role'
    OR (
      (public.has_role('super_admin') OR public.has_role('admin'))
      AND auth.jwt() ->> 'aal' = 'aal2'
    ),
    false
  );
$function$;

NOTIFY pgrst, 'reload schema';
COMMIT;
