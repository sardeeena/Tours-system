-- Protect administrator continuity and retain accurate before/after role audit data.
BEGIN;
CREATE OR REPLACE FUNCTION public.admin_assign_user_roles(p_user_id uuid,p_role_slugs text[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE
 requested text[];
 previous_roles text[];
 current_is_super boolean;
 current_is_admin boolean;
 requested_super boolean;
 requested_admin boolean;
 next_legacy_role text;
BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'Administrator authorization required.' USING ERRCODE='42501'; END IF;
 IF p_user_id IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_user_id) THEN RAISE EXCEPTION 'Target user was not found.'; END IF;
 SELECT COALESCE(array_agg(DISTINCT x),ARRAY['customer']::text[]) INTO requested
 FROM unnest(COALESCE(p_role_slugs,ARRAY['customer']::text[])) AS x WHERE x IS NOT NULL AND btrim(x)<>'';
 IF cardinality(requested)>12 THEN RAISE EXCEPTION 'A user may have at most 12 roles.'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(requested) x LEFT JOIN public.access_roles r ON r.slug=x AND r.is_active WHERE r.id IS NULL)
 THEN RAISE EXCEPTION 'One or more requested roles are missing or inactive.'; END IF;
 requested_super:='super_admin'=ANY(requested);
 requested_admin:='admin'=ANY(requested) OR requested_super;
 IF requested_super AND NOT public.has_role('super_admin') THEN
  RAISE EXCEPTION 'Only a super-admin can assign the super_admin role.' USING ERRCODE='42501';
 END IF;
 SELECT COALESCE(array_agg(r.slug ORDER BY r.slug),ARRAY[]::text[]),
        COALESCE(bool_or(r.slug='super_admin'),false),
        COALESCE(bool_or(r.slug IN ('admin','super_admin')),false)
 INTO previous_roles,current_is_super,current_is_admin
 FROM public.user_roles ur JOIN public.access_roles r ON r.id=ur.role_id WHERE ur.user_id=p_user_id;
 IF current_is_super AND NOT public.has_role('super_admin') THEN
  RAISE EXCEPTION 'Only a super-admin can modify a super-admin account.' USING ERRCODE='42501';
 END IF;
 IF current_is_super AND NOT requested_super AND
  (SELECT count(*) FROM public.user_roles ur JOIN public.access_roles r ON r.id=ur.role_id WHERE r.slug='super_admin')<=1
 THEN RAISE EXCEPTION 'The last super-admin cannot be removed.' USING ERRCODE='23514'; END IF;
 IF p_user_id=auth.uid() AND current_is_admin AND NOT requested_admin THEN
  RAISE EXCEPTION 'You cannot remove your own administrator access in this session.' USING ERRCODE='23514';
 END IF;
 IF current_is_admin AND NOT requested_admin AND
  (SELECT count(DISTINCT ur.user_id) FROM public.user_roles ur JOIN public.access_roles r ON r.id=ur.role_id WHERE r.slug IN ('admin','super_admin'))<=1
 THEN RAISE EXCEPTION 'The last administrator cannot be removed.' USING ERRCODE='23514'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_user_id) THEN RAISE EXCEPTION 'Target user profile was not found.'; END IF;

 DELETE FROM public.user_roles WHERE user_id=p_user_id;
 INSERT INTO public.user_roles(user_id,role_id,assigned_by)
 SELECT p_user_id,r.id,auth.uid() FROM public.access_roles r WHERE r.slug=ANY(requested) AND r.is_active;
 next_legacy_role:=CASE WHEN 'super_admin'=ANY(requested) THEN 'super_admin'
  WHEN 'admin'=ANY(requested) THEN 'admin' WHEN 'manager'=ANY(requested) THEN 'manager'
  WHEN 'staff'=ANY(requested) THEN 'staff' ELSE 'customer' END;
 UPDATE public.profiles SET role=next_legacy_role,updated_at=now() WHERE id=p_user_id;
 UPDATE auth.users SET raw_app_meta_data=COALESCE(raw_app_meta_data,'{}'::jsonb)
  || jsonb_build_object('role',next_legacy_role,'roles',to_jsonb(requested)) WHERE id=p_user_id;
 INSERT INTO public.audit_logs(user_id,action,entity_type,entity_id,old_data,new_data)
 VALUES(auth.uid(),'RBAC_USER_ROLES_UPDATED','profile',p_user_id::text,
  jsonb_build_object('roles',to_jsonb(previous_roles)),jsonb_build_object('roles',to_jsonb(requested)));
 RETURN jsonb_build_object('success',true,'user_id',p_user_id,'roles',to_jsonb(requested),'legacy_role',next_legacy_role);
END;
$function$;
COMMIT;