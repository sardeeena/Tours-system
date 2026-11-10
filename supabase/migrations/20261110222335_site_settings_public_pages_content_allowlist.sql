DROP POLICY IF EXISTS "Public can read approved site settings" ON public.site_settings;
CREATE POLICY "Public can read approved site settings"
  ON public.site_settings
  FOR SELECT
  TO public
  USING (key IN ('company_info', 'booking_policies', 'social_links', 'footer_content', 'pages_content'));
