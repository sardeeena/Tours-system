-- Site settings are controlled by the dedicated settings permission, not content permissions.
BEGIN;
DROP POLICY IF EXISTS rbac_site_settings_read ON public.site_settings;
DROP POLICY IF EXISTS rbac_site_settings_create ON public.site_settings;
DROP POLICY IF EXISTS rbac_site_settings_update ON public.site_settings;
DROP POLICY IF EXISTS rbac_site_settings_delete ON public.site_settings;
CREATE POLICY rbac_site_settings_read ON public.site_settings
 FOR SELECT TO authenticated USING (public.has_permission('settings.manage'));
CREATE POLICY rbac_site_settings_create ON public.site_settings
 FOR INSERT TO authenticated WITH CHECK (public.has_permission('settings.manage'));
CREATE POLICY rbac_site_settings_update ON public.site_settings
 FOR UPDATE TO authenticated USING (public.has_permission('settings.manage'))
 WITH CHECK (public.has_permission('settings.manage'));
CREATE POLICY rbac_site_settings_delete ON public.site_settings
 FOR DELETE TO authenticated USING (public.has_permission('settings.manage'));
COMMIT;