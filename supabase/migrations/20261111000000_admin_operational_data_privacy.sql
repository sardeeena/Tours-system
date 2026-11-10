-- Remove public SELECT access from operational and administrative tables.
-- Their consumers are staff/admin modules; customer-facing availability remains
-- available through the validated get_tour_availability_schedule RPC.
DROP POLICY IF EXISTS "Public can read active coupons" ON public.coupons;
DROP POLICY IF EXISTS "Public can view departures" ON public.departures;
DROP POLICY IF EXISTS "Anyone can view active guides" ON public.guides;
DROP POLICY IF EXISTS "Public can view media assets" ON public.media_assets;
DROP POLICY IF EXISTS "Public can read availability" ON public.tour_availability;
DROP POLICY IF EXISTS "Public can view tour vessel links" ON public.tour_vessels;
DROP POLICY IF EXISTS "Anyone can view active vessels" ON public.vessels;
DROP POLICY IF EXISTS "Anyone can read weather bulletins" ON public.weather_bulletins;

-- Public pages read only the four explicitly public settings keys. Admins retain
-- full access through the separate authenticated is_admin() policy.
DROP POLICY IF EXISTS "Public can read site settings" ON public.site_settings;
CREATE POLICY "Public can read approved site settings"
  ON public.site_settings
  FOR SELECT
  TO public
  USING (key IN ('company_info', 'booking_policies', 'social_links', 'footer_content'));
