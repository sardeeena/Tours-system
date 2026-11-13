-- Keep site_settings SELECT access in one permissive policy per role/action.
-- Preserve the five approved public-content keys for authenticated visitors,
-- while finance roles can read only the private invoice_billing row.
-- Settings managers retain their existing full settings access.
BEGIN;

DROP POLICY IF EXISTS rbac_invoice_billing_read ON public.site_settings;
DROP POLICY IF EXISTS rbac_site_settings_read ON public.site_settings;

CREATE POLICY rbac_site_settings_read
  ON public.site_settings
  FOR SELECT
  TO authenticated
  USING (
    key = ANY (ARRAY[
      'company_info',
      'booking_policies',
      'social_links',
      'footer_content',
      'pages_content'
    ]::text[])
    OR public.has_permission('settings.manage')
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
