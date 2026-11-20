-- Remove direct public form writes; these forms now use server-side endpoints with rate limiting.
DROP POLICY IF EXISTS "Public can insert inquiry" ON public.inquiries;
DROP POLICY IF EXISTS "Public can insert newsletter subscription" ON public.newsletter_subscriptions;

-- Remove accidental permissive authenticated policies and restore permission-based checks.
DROP POLICY IF EXISTS rbac_inquiries_create ON public.inquiries;
CREATE POLICY rbac_inquiries_create ON public.inquiries
  FOR INSERT TO authenticated WITH CHECK (private.has_permission('crm.create'::text));

DROP POLICY IF EXISTS rbac_newsletter_subscriptions_create ON public.newsletter_subscriptions;
CREATE POLICY rbac_newsletter_subscriptions_create ON public.newsletter_subscriptions
  FOR INSERT TO authenticated WITH CHECK (private.has_permission('content.create'::text));

NOTIFY pgrst, 'reload schema';
