-- Make normalized user_roles the sole authority for database RBAC.
-- Site settings remain Super Admin-only; the public website retains its narrow approved-read allowlist.
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
        NOT EXISTS (
          SELECT 1
          FROM public.user_roles ur
          JOIN public.access_roles r ON r.id = ur.role_id
          WHERE ur.user_id = auth.uid()
            AND r.slug IN ('super_admin', 'admin')
            AND r.is_active
        )
        OR auth.jwt() ->> 'aal' = 'aal2'
      )
      AND (required_role NOT IN ('super_admin', 'admin') OR auth.jwt() ->> 'aal' = 'aal2')
      AND EXISTS (
        SELECT 1
        FROM public.user_roles ur
        JOIN public.access_roles r ON r.id = ur.role_id
        WHERE ur.user_id = auth.uid()
          AND r.slug = required_role
          AND r.is_active
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
        CASE
          -- Site settings are a platform-level control and are never delegated
          -- through the ordinary Admin role or a custom permission assignment.
          WHEN required_permission = 'settings.manage' THEN
            public.has_role('super_admin')
          ELSE
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
        END
      )
      AND (
        NOT EXISTS (
          SELECT 1
          FROM public.user_roles ur
          JOIN public.access_roles r ON r.id = ur.role_id
          WHERE ur.user_id = auth.uid()
            AND r.slug IN ('super_admin', 'admin')
            AND r.is_active
        )
        OR auth.jwt() ->> 'aal' = 'aal2'
      )
    ),
    false
  );
$function$;

-- Keep the permission catalogue aligned with the explicit Super Admin-only rule.
DELETE FROM public.role_permissions rp
USING public.access_roles r, public.access_permissions p
WHERE rp.role_id = r.id
  AND rp.permission_id = p.id
  AND r.slug = 'admin'
  AND p.permission_key = 'settings.manage';

COMMENT ON FUNCTION private.has_role(text) IS
  'Evaluates roles exclusively from active normalized user_roles assignments. profiles.role is compatibility/display data, never an authorization fallback.';
COMMENT ON FUNCTION private.has_permission(text) IS
  'Evaluates normalized RBAC assignments; settings.manage is restricted to an active Super Admin at AAL2.';

NOTIFY pgrst, 'reload schema';
COMMIT;
