-- Restrict invoice billing and bank details to authenticated finance/settings roles.
-- The public site_settings allowlist intentionally does not include invoice_billing.
BEGIN;
DROP POLICY IF EXISTS rbac_invoice_billing_read ON public.site_settings;
CREATE POLICY rbac_invoice_billing_read
  ON public.site_settings
  FOR SELECT
  TO authenticated
  USING (
    key = 'invoice_billing'
    AND (
      public.has_permission('finance.read')
      OR public.has_permission('finance.create')
      OR public.has_permission('finance.manage')
      OR public.has_permission('settings.manage')
    )
  );
COMMIT;
