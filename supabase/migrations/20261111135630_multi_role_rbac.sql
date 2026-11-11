-- Kemet Spirit multi-role RBAC foundation.
-- user_roles is the canonical many-to-many role assignment table.
-- profiles.role remains a compatibility field for legacy integrations.
BEGIN;

CREATE TABLE IF NOT EXISTS public.access_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z][a-z0-9_]{1,49}$'),
  name text NOT NULL,
  description text,
  is_system boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.access_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  permission_key text NOT NULL UNIQUE,
  module text NOT NULL,
  action text NOT NULL,
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.access_roles(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,role_id)
);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON public.user_roles(role_id);
CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_id uuid NOT NULL REFERENCES public.access_roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.access_permissions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(role_id,permission_id)
);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON public.role_permissions(permission_id);

INSERT INTO public.access_roles(slug,name,description,is_system) VALUES
 ('super_admin','Super Admin','Unrestricted platform authority, including protected security controls.',true),
 ('admin','Admin','Full administration except protected super-admin controls.',true),
 ('manager','Manager','Cross-department management and reporting.',true),
 ('staff','Staff','Operational staff access.',true),
 ('customer','Customer','Customer account and own bookings.',true),
 ('operations_manager','Operations Manager','Bookings and day-to-day tour operations.',true),
 ('finance_manager','Finance Manager','Payments, invoices, refunds and finance reporting.',true),
 ('sales_manager','Sales Manager','CRM, customers, leads and sales communications.',true),
 ('content_manager','Content Manager','Tour catalogue, website content, media and SEO.',true),
 ('support_agent','Support Agent','Customer support, inquiries and booking visibility.',true),
 ('guide','Tour Guide','Guide identity/assignment role; add assignment-scoped permissions when that workflow is enabled.',true)
ON CONFLICT(slug) DO UPDATE SET name=excluded.name,description=excluded.description,is_system=true,updated_at=now();

INSERT INTO public.access_permissions(permission_key,module,action,description) VALUES
 ('tours.read','tours','read','View tours and tour catalogue records'),
 ('tours.manage','tours','manage','Create, edit and delete tours'),
 ('bookings.read','bookings','read','View bookings and booking details'),
 ('bookings.manage','bookings','manage','Create, update, cancel and manage bookings'),
 ('customers.read','customers','read','View customer profiles and records'),
 ('customers.manage','customers','manage','Create and update customer records'),
 ('crm.read','crm','read','View CRM leads, inquiries, tasks and conversations'),
 ('crm.manage','crm','manage','Manage CRM records, leads, tasks and inquiries'),
 ('operations.read','operations','read','View operations, departures, guides, vessels and schedules'),
 ('operations.manage','operations','manage','Manage operations, departures, guides, vessels and schedules'),
 ('finance.read','finance','read','View financial records and reports'),
 ('finance.manage','finance','manage','Manage payments, invoices, refunds and financial records'),
 ('communications.read','communications','read','View communications and message history'),
 ('communications.manage','communications','manage','Send and manage communications, templates and notifications'),
 ('content.read','content','read','View website content, media and SEO records'),
 ('content.manage','content','manage','Manage catalogue content, media, pages and SEO'),
 ('analytics.read','analytics','read','View dashboards and reports'),
 ('analytics.manage','analytics','manage','Build and export analytics reports'),
 ('settings.manage','settings','manage','Manage platform and site settings'),
 ('users.read','users','read','View user directory and role assignments'),
 ('users.manage','users','manage','Manage user profiles and assign non-super-admin roles'),
 ('roles.manage','roles','manage','Create and configure custom roles and permissions'),
 ('audit.read','audit','read','View security and administrative audit logs')
ON CONFLICT(permission_key) DO UPDATE SET module=excluded.module,action=excluded.action,description=excluded.description;

-- Backfill all existing single-role profiles into the normalized assignment model.
INSERT INTO public.user_roles(user_id,role_id)
SELECT p.id,r.id FROM public.profiles p JOIN public.access_roles r ON r.slug=p.role
ON CONFLICT DO NOTHING;

-- Admin and Super Admin have every permission. Admin assignment functions still
-- prevent ordinary admins from granting or removing the protected super_admin role.
INSERT INTO public.role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM public.access_roles r CROSS JOIN public.access_permissions p
WHERE r.slug IN ('admin','super_admin') ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM public.access_roles r JOIN public.access_permissions p
ON p.permission_key=ANY(ARRAY[
 'tours.read','tours.manage','bookings.read','bookings.manage','customers.read','customers.manage',
 'crm.read','crm.manage','operations.read','operations.manage','finance.read',
 'communications.read','communications.manage','content.read','content.manage','analytics.read','analytics.manage'
]) WHERE r.slug='manager' ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM public.access_roles r JOIN public.access_permissions p
ON p.permission_key=ANY(ARRAY[
 'tours.read','bookings.read','customers.read','crm.read','crm.manage','operations.read','communications.read','content.read'
]) WHERE r.slug='staff' ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM public.access_roles r JOIN public.access_permissions p
ON p.permission_key=ANY(ARRAY['bookings.read','bookings.manage','customers.read','operations.read','operations.manage','communications.read'])
WHERE r.slug='operations_manager' ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM public.access_roles r JOIN public.access_permissions p
ON p.permission_key=ANY(ARRAY['finance.read','finance.manage','bookings.read','customers.read','analytics.read'])
WHERE r.slug='finance_manager' ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM public.access_roles r JOIN public.access_permissions p
ON p.permission_key=ANY(ARRAY['crm.read','crm.manage','customers.read','customers.manage','bookings.read','analytics.read','communications.read','communications.manage'])
WHERE r.slug='sales_manager' ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM public.access_roles r JOIN public.access_permissions p
ON p.permission_key=ANY(ARRAY['tours.read','tours.manage','content.read','content.manage','analytics.read'])
WHERE r.slug='content_manager' ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM public.access_roles r JOIN public.access_permissions p
ON p.permission_key=ANY(ARRAY['bookings.read','customers.read','crm.read','crm.manage','communications.read','communications.manage'])
WHERE r.slug='support_agent' ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.has_role(required_role text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
 SELECT COALESCE(
  (auth.jwt()->>'role')='service_role'
  OR EXISTS(SELECT 1 FROM public.user_roles ur JOIN public.access_roles r ON r.id=ur.role_id
            WHERE ur.user_id=auth.uid() AND r.slug=required_role AND r.is_active)
  OR EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.role=required_role),
  false
 );
$function$;

CREATE OR REPLACE FUNCTION public.has_permission(required_permission text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
 SELECT COALESCE(
  (auth.jwt()->>'role')='service_role' OR public.has_role('super_admin') OR public.has_role('admin')
  OR EXISTS(
   SELECT 1 FROM public.user_roles ur
   JOIN public.access_roles r ON r.id=ur.role_id AND r.is_active
   JOIN public.role_permissions rp ON rp.role_id=r.id
   JOIN public.access_permissions p ON p.id=rp.permission_id
   WHERE ur.user_id=auth.uid() AND p.permission_key=required_permission
  ),false
 );
$function$;

-- Preserve the old helper name but restrict its global bypass to full administrators.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
 SELECT COALESCE((auth.jwt()->>'role')='service_role'
   OR public.has_role('super_admin') OR public.has_role('admin'),false);
$function$;

CREATE OR REPLACE FUNCTION public.sync_legacy_profile_role_to_user_roles()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE role_id_value uuid;
BEGIN
 IF TG_OP='UPDATE' AND NEW.role IS DISTINCT FROM OLD.role THEN
  DELETE FROM public.user_roles ur USING public.access_roles r
  WHERE ur.role_id=r.id AND ur.user_id=NEW.id AND r.slug=OLD.role;
 END IF;
 SELECT id INTO role_id_value FROM public.access_roles WHERE slug=NEW.role AND is_active;
 IF role_id_value IS NOT NULL THEN
  INSERT INTO public.user_roles(user_id,role_id) VALUES(NEW.id,role_id_value) ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS trigger_sync_legacy_profile_role_to_user_roles ON public.profiles;
CREATE TRIGGER trigger_sync_legacy_profile_role_to_user_roles
AFTER INSERT OR UPDATE OF role ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_legacy_profile_role_to_user_roles();

CREATE OR REPLACE FUNCTION public.get_my_access_context()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
 SELECT jsonb_build_object(
  'roles',COALESCE((SELECT jsonb_agg(r.slug ORDER BY r.slug) FROM public.user_roles ur
    JOIN public.access_roles r ON r.id=ur.role_id WHERE ur.user_id=auth.uid() AND r.is_active),'[]'::jsonb),
  'permissions',COALESCE((SELECT jsonb_agg(DISTINCT p.permission_key ORDER BY p.permission_key)
    FROM public.user_roles ur JOIN public.access_roles r ON r.id=ur.role_id AND r.is_active
    JOIN public.role_permissions rp ON rp.role_id=r.id
    JOIN public.access_permissions p ON p.id=rp.permission_id WHERE ur.user_id=auth.uid()),'[]'::jsonb),
  'is_admin',public.is_admin()
 ) WHERE auth.uid() IS NOT NULL;
$function$;

CREATE OR REPLACE FUNCTION public.admin_list_access_control()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $function$
DECLARE result jsonb;
BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'Administrator authorization required.' USING ERRCODE='42501'; END IF;
 SELECT jsonb_build_object(
  'users',COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'id',p.id,'email',p.email,'full_name',p.full_name,'legacy_role',p.role,
    'is_confirmed',p.is_confirmed,'created_at',p.created_at,
    'roles',COALESCE((SELECT jsonb_agg(r.slug ORDER BY r.slug) FROM public.user_roles ur
      JOIN public.access_roles r ON r.id=ur.role_id WHERE ur.user_id=p.id AND r.is_active),'[]'::jsonb)
   ) ORDER BY p.created_at DESC) FROM public.profiles p),'[]'::jsonb),
  'roles',COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'slug',r.slug,'name',r.name,'description',r.description,'is_system',r.is_system,'is_active',r.is_active,
    'permissions',COALESCE((SELECT jsonb_agg(ap.permission_key ORDER BY ap.permission_key)
      FROM public.role_permissions rp JOIN public.access_permissions ap ON ap.id=rp.permission_id
      WHERE rp.role_id=r.id),'[]'::jsonb)
   ) ORDER BY r.is_system DESC,r.name) FROM public.access_roles r),'[]'::jsonb),
  'permissions',COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'key',p.permission_key,'module',p.module,'action',p.action,'description',p.description
   ) ORDER BY p.module,p.action) FROM public.access_permissions p),'[]'::jsonb)
 ) INTO result;
 RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_assign_user_roles(p_user_id uuid,p_role_slugs text[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE requested text[]; previous_roles text[]; current_is_super boolean; requested_super boolean; next_legacy_role text;
BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'Administrator authorization required.' USING ERRCODE='42501'; END IF;
 IF p_user_id IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_user_id) THEN RAISE EXCEPTION 'Target user was not found.'; END IF;
 SELECT COALESCE(array_agg(DISTINCT x),ARRAY['customer']::text[]) INTO requested
 FROM unnest(COALESCE(p_role_slugs,ARRAY['customer']::text[])) AS x WHERE x IS NOT NULL AND btrim(x)<>'';
 IF cardinality(requested)>12 THEN RAISE EXCEPTION 'A user may have at most 12 roles.'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(requested) x LEFT JOIN public.access_roles r ON r.slug=x AND r.is_active WHERE r.id IS NULL)
 THEN RAISE EXCEPTION 'One or more requested roles are missing or inactive.'; END IF;
 requested_super:='super_admin'=ANY(requested);
 IF requested_super AND NOT public.has_role('super_admin') THEN
  RAISE EXCEPTION 'Only a super-admin can assign the super_admin role.' USING ERRCODE='42501';
 END IF;
 SELECT COALESCE(array_agg(r.slug ORDER BY r.slug),ARRAY[]::text[]),
        COALESCE(bool_or(r.slug='super_admin'),false)
 INTO previous_roles,current_is_super
 FROM public.user_roles ur JOIN public.access_roles r ON r.id=ur.role_id WHERE ur.user_id=p_user_id;
 IF current_is_super AND NOT public.has_role('super_admin') THEN
  RAISE EXCEPTION 'Only a super-admin can modify a super-admin account.' USING ERRCODE='42501';
 END IF;
 IF current_is_super AND NOT requested_super AND
  (SELECT count(*) FROM public.user_roles ur JOIN public.access_roles r ON r.id=ur.role_id WHERE r.slug='super_admin')<=1
 THEN RAISE EXCEPTION 'The last super-admin cannot be removed.' USING ERRCODE='23514'; END IF;
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

CREATE OR REPLACE FUNCTION public.admin_upsert_access_role(p_slug text,p_name text,p_description text,p_permission_keys text[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE target_role_id uuid;
BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'Administrator authorization required.' USING ERRCODE='42501'; END IF;
 IF p_slug IS NULL OR p_slug !~ '^[a-z][a-z0-9_]{1,49}$' OR p_name IS NULL OR btrim(p_name)=''
 THEN RAISE EXCEPTION 'A valid role slug and name are required.'; END IF;
 IF EXISTS(SELECT 1 FROM public.access_roles WHERE slug=p_slug AND is_system)
 THEN RAISE EXCEPTION 'Built-in system roles cannot be modified.'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(COALESCE(p_permission_keys,ARRAY[]::text[])) x
   LEFT JOIN public.access_permissions p ON p.permission_key=x WHERE p.id IS NULL)
 THEN RAISE EXCEPTION 'One or more permissions are invalid.'; END IF;
 INSERT INTO public.access_roles(slug,name,description,is_system,is_active)
 VALUES(p_slug,btrim(p_name),NULLIF(btrim(p_description),''),false,true)
 ON CONFLICT(slug) DO UPDATE SET name=excluded.name,description=excluded.description,is_active=true,updated_at=now()
 WHERE public.access_roles.is_system=false RETURNING id INTO target_role_id;
 IF target_role_id IS NULL THEN RAISE EXCEPTION 'Role could not be created or updated.'; END IF;
 DELETE FROM public.role_permissions WHERE role_id=target_role_id;
 INSERT INTO public.role_permissions(role_id,permission_id)
 SELECT target_role_id,p.id FROM public.access_permissions p
 WHERE p.permission_key=ANY(COALESCE(p_permission_keys,ARRAY[]::text[])) ON CONFLICT DO NOTHING;
 RETURN jsonb_build_object('success',true,'slug',p_slug);
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_delete_access_role(p_slug text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'Administrator authorization required.' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM public.access_roles WHERE slug=p_slug AND is_system)
 THEN RAISE EXCEPTION 'Built-in system roles cannot be deleted.'; END IF;
 IF EXISTS(SELECT 1 FROM public.user_roles ur JOIN public.access_roles r ON r.id=ur.role_id WHERE r.slug=p_slug)
 THEN RAISE EXCEPTION 'This role is assigned to users. Reassign them before deleting it.'; END IF;
 DELETE FROM public.access_roles WHERE slug=p_slug;
 RETURN jsonb_build_object('success',true,'slug',p_slug);
END;
$function$;

-- Add module-scoped policies while preserving customer ownership/public policies.
DO $policies$
DECLARE item record; section_end integer;
BEGIN
 FOR item IN SELECT * FROM (VALUES
  ('tours','tours'),
  ('bookings','bookings'),('booking_extras','bookings'),('booking_passengers','bookings'),('tour_availability','operations'),('coupons','bookings'),
  ('customers','customers'),('inquiries','crm'),('leads','crm'),('crm_activities','crm'),('crm_communications','crm'),
  ('crm_conversations','crm'),('crm_lead_stages','crm'),('crm_notes','crm'),('crm_segments','crm'),('crm_tags','crm'),('crm_tasks','crm'),
  ('departures','operations'),('guides','operations'),('operational_assignments','operations'),('pickup_schedules','operations'),
  ('pickup_locations','operations'),('vessels','operations'),('tour_vessels','operations'),('weather_bulletins','operations'),
  ('invoices','finance'),('payment_providers','finance'),('payment_transactions','finance'),('refund_records','finance'),
  ('communication_messages','communications'),('communication_templates','communications'),('staff_notifications','communications'),('automation_events','communications'),
  ('categories','content'),('destinations','content'),('faqs','content'),('media_assets','content'),('newsletter_subscriptions','content'),
  ('seo_metadata','content'),('site_settings','content'),('tour_assigned_extras','content'),('tour_categories','content'),('tour_exclusions','content'),
  ('tour_extras','content'),('tour_faqs','content'),('tour_highlights','content'),('tour_images','content'),('tour_inclusions','content'),
  ('tour_itinerary','content'),('tour_pickup_locations','content'),('tour_videos','content'),('reviews','content')
 ) AS v(table_name,module)
 LOOP
  IF to_regclass('public.'||item.table_name) IS NOT NULL THEN
   EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I','rbac_'||item.table_name||'_read',item.table_name);
   EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I','rbac_'||item.table_name||'_manage',item.table_name);
   EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.has_permission(%L) OR public.has_permission(%L))',
    'rbac_'||item.table_name||'_read',item.table_name,item.module||'.read',item.module||'.manage');
   EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.has_permission(%L)) WITH CHECK (public.has_permission(%L))',
    'rbac_'||item.table_name||'_manage',item.table_name,item.module||'.manage',item.module||'.manage');
  END IF;
 END LOOP;
 DROP POLICY IF EXISTS rbac_profiles_read ON public.profiles;
 DROP POLICY IF EXISTS rbac_profiles_manage ON public.profiles;
 CREATE POLICY rbac_profiles_read ON public.profiles FOR SELECT TO authenticated
  USING(public.has_permission('users.read') OR public.has_permission('users.manage'));
 CREATE POLICY rbac_profiles_manage ON public.profiles FOR ALL TO authenticated
  USING(public.has_permission('users.manage')) WITH CHECK(public.has_permission('users.manage'));
 DROP POLICY IF EXISTS rbac_audit_logs_read ON public.audit_logs;
 CREATE POLICY rbac_audit_logs_read ON public.audit_logs FOR SELECT TO authenticated
  USING(public.has_permission('audit.read'));
END;
$policies$;

ALTER TABLE public.access_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.access_roles,public.access_permissions,public.user_roles,public.role_permissions FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.has_role(text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.has_permission(text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.get_my_access_context() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.admin_list_access_control() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.admin_assign_user_roles(uuid,text[]) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.admin_upsert_access_role(text,text,text,text[]) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.admin_delete_access_role(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.has_role(text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.has_permission(text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_my_access_context() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_access_control() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_assign_user_roles(uuid,text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_upsert_access_role(text,text,text,text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_access_role(text) TO authenticated;
COMMENT ON TABLE public.user_roles IS 'Canonical many-to-many user-to-role assignments for Kemet Spirit RBAC.';
COMMENT ON TABLE public.access_roles IS 'System and custom application roles; protected role changes occur through admin RPCs.';
COMMENT ON TABLE public.role_permissions IS 'Permission grants attached to roles; users inherit the union of all assigned role permissions.';
COMMIT;