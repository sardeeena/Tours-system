-- Fully roll back PR #122's additional authenticated site_settings read access.
-- Restore the policy that existed immediately before PR #122:
-- authenticated users require settings.manage; the separate public allowlist
-- policy continues to permit the five approved public-content keys.
BEGIN;

DROP POLICY IF EXISTS rbac_invoice_billing_read ON public.site_settings;
DROP POLICY IF EXISTS rbac_site_settings_read ON public.site_settings;

CREATE POLICY rbac_site_settings_read
  ON public.site_settings
  FOR SELECT
  TO authenticated
  USING (public.has_permission('settings.manage'));

COMMIT;
