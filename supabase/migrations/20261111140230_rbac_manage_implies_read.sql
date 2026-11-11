-- Module manage grants also imply read access in RLS and app navigation.
BEGIN;
CREATE OR REPLACE FUNCTION public.has_permission(required_permission text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
 SELECT COALESCE(
  (auth.jwt()->>'role')='service_role'
  OR public.has_role('super_admin')
  OR public.has_role('admin')
  OR EXISTS(
   SELECT 1 FROM public.user_roles ur
   JOIN public.access_roles r ON r.id=ur.role_id AND r.is_active
   JOIN public.role_permissions rp ON rp.role_id=r.id
   JOIN public.access_permissions p ON p.id=rp.permission_id
   WHERE ur.user_id=auth.uid()
    AND (p.permission_key=required_permission
      OR (required_permission LIKE '%.read' AND p.permission_key=replace(required_permission,'.read','.manage')))
  ),false
 );
$function$;
COMMIT;