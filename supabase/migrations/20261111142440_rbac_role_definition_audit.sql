-- Keep an audit trail for custom role creation, permission changes and deletion.
BEGIN;
CREATE OR REPLACE FUNCTION public.admin_upsert_access_role(
 p_slug text,p_name text,p_description text,p_permission_keys text[]
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE target_role_id uuid; old_role jsonb; old_permissions jsonb; new_permissions jsonb;
BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'Administrator authorization required.' USING ERRCODE='42501'; END IF;
 IF p_slug IS NULL OR p_slug !~ '^[a-z][a-z0-9_]{1,49}$' OR p_name IS NULL OR btrim(p_name)='' THEN
  RAISE EXCEPTION 'A valid role slug and name are required.';
 END IF;
 IF EXISTS(SELECT 1 FROM public.access_roles WHERE slug=p_slug AND is_system) THEN
  RAISE EXCEPTION 'Built-in system roles cannot be modified.';
 END IF;
 IF EXISTS(SELECT 1 FROM unnest(COALESCE(p_permission_keys,ARRAY[]::text[])) x
  LEFT JOIN public.access_permissions p ON p.permission_key=x WHERE p.id IS NULL)
 THEN RAISE EXCEPTION 'One or more permissions are invalid.'; END IF;
 SELECT jsonb_build_object('slug',r.slug,'name',r.name,'description',r.description)
 INTO old_role FROM public.access_roles r WHERE r.slug=p_slug;
 SELECT COALESCE(jsonb_agg(p.permission_key ORDER BY p.permission_key),'[]'::jsonb)
 INTO old_permissions FROM public.role_permissions rp JOIN public.access_roles r ON r.id=rp.role_id
 JOIN public.access_permissions p ON p.id=rp.permission_id WHERE r.slug=p_slug;
 INSERT INTO public.access_roles(slug,name,description,is_system,is_active)
 VALUES(p_slug,btrim(p_name),NULLIF(btrim(p_description),''),false,true)
 ON CONFLICT(slug) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description,is_active=true,updated_at=now()
 WHERE public.access_roles.is_system=false RETURNING id INTO target_role_id;
 IF target_role_id IS NULL THEN RAISE EXCEPTION 'Role could not be created or updated.'; END IF;
 DELETE FROM public.role_permissions WHERE role_id=target_role_id;
 INSERT INTO public.role_permissions(role_id,permission_id)
 SELECT target_role_id,p.id FROM public.access_permissions p
 WHERE p.permission_key=ANY(COALESCE(p_permission_keys,ARRAY[]::text[])) ON CONFLICT DO NOTHING;
 SELECT COALESCE(jsonb_agg(p.permission_key ORDER BY p.permission_key),'[]'::jsonb)
 INTO new_permissions FROM public.role_permissions rp JOIN public.access_permissions p ON p.id=rp.permission_id
 WHERE rp.role_id=target_role_id;
 INSERT INTO public.audit_logs(user_id,action,entity_type,entity_id,old_data,new_data)
 VALUES(auth.uid(),CASE WHEN old_role IS NULL THEN 'RBAC_ROLE_CREATED' ELSE 'RBAC_ROLE_UPDATED' END,
  'access_role',target_role_id::text,
  CASE WHEN old_role IS NULL THEN NULL ELSE old_role||jsonb_build_object('permissions',old_permissions) END,
  jsonb_build_object('slug',p_slug,'name',btrim(p_name),'description',NULLIF(btrim(p_description),''),
   'permissions',new_permissions));
 RETURN jsonb_build_object('success',true,'slug',p_slug,'role_id',target_role_id);
END;
$function$;
CREATE OR REPLACE FUNCTION public.admin_delete_access_role(p_slug text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE target_role_id uuid; old_role jsonb; old_permissions jsonb;
BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'Administrator authorization required.' USING ERRCODE='42501'; END IF;
 SELECT r.id,jsonb_build_object('slug',r.slug,'name',r.name,'description',r.description)
 INTO target_role_id,old_role FROM public.access_roles r WHERE r.slug=p_slug;
 IF target_role_id IS NULL THEN RAISE EXCEPTION 'Role not found.'; END IF;
 IF EXISTS(SELECT 1 FROM public.access_roles WHERE slug=p_slug AND is_system) THEN
  RAISE EXCEPTION 'Built-in system roles cannot be deleted.';
 END IF;
 IF EXISTS(SELECT 1 FROM public.user_roles ur WHERE ur.role_id=target_role_id) THEN
  RAISE EXCEPTION 'This role is assigned to users. Reassign them before deleting it.';
 END IF;
 SELECT COALESCE(jsonb_agg(p.permission_key ORDER BY p.permission_key),'[]'::jsonb)
 INTO old_permissions FROM public.role_permissions rp JOIN public.access_permissions p ON p.id=rp.permission_id
 WHERE rp.role_id=target_role_id;
 DELETE FROM public.access_roles WHERE id=target_role_id;
 INSERT INTO public.audit_logs(user_id,action,entity_type,entity_id,old_data,new_data)
 VALUES(auth.uid(),'RBAC_ROLE_DELETED','access_role',target_role_id::text,
  old_role||jsonb_build_object('permissions',old_permissions),NULL);
 RETURN jsonb_build_object('success',true,'slug',p_slug);
END;
$function$;
COMMIT;