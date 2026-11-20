-- Public submissions must use the validated same-origin server endpoints.
-- Anonymous clients must not write directly to CRM/newsletter tables.
DROP POLICY IF EXISTS "Public can insert inquiry" ON public.inquiries;
DROP POLICY IF EXISTS "rbac_inquiries_create" ON public.inquiries;
CREATE POLICY "rbac_inquiries_create"
  ON public.inquiries FOR INSERT TO authenticated
  WITH CHECK (private.has_permission('crm.create'::text));
REVOKE ALL ON TABLE public.inquiries FROM PUBLIC, anon;

DROP POLICY IF EXISTS "Public can insert newsletter subscription" ON public.newsletter_subscriptions;
DROP POLICY IF EXISTS "Public can view own newsletter status" ON public.newsletter_subscriptions;
DROP POLICY IF EXISTS "Public can update own subscription" ON public.newsletter_subscriptions;
DROP POLICY IF EXISTS "rbac_newsletter_subscriptions_create" ON public.newsletter_subscriptions;
CREATE POLICY "rbac_newsletter_subscriptions_create"
  ON public.newsletter_subscriptions FOR INSERT TO authenticated
  WITH CHECK (private.has_permission('content.create'::text));
REVOKE ALL ON TABLE public.newsletter_subscriptions FROM PUBLIC, anon;
