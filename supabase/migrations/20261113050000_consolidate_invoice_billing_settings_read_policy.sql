-- Keep site_settings SELECT access in one permissive policy per role/action.
-- Finance users may read only the private invoice_billing row; settings managers
-- retain access to all settings. This preserves the RLS policy-deduplication
-- invariant enforced by advisor_hardening.test.sql.
BEGIN;

DROP POLICY IF EXISTS rbac_invoice_billing_read ON public.site_settings;
DROP POLICY IF EXISTS rbac_site_settings_read ON public.site_settings;

CREATE POLICY rbac_site_settings_read
  ON public.site_settings
  FOR SELECT
  TO authenticated
  USING (
    public.has_permission('settings.manage')
    OR (
      key = 'invoice_billing'
      AND (
        public.has_permission('finance.read')
        OR public.has_permission('finance.create')
        OR public.has_permission('finance.manage')
      )
    )
  );

COMMIT;
