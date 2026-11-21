-- Public inquiry and newsletter submissions must pass through server-side endpoints.
-- This migration removes unrestricted anonymous writes and bypassed RBAC predicates.
DROP POLICY IF EXISTS "Public can insert inquiry" ON public.inquiries;
DROP POLICY IF EXISTS "Public can insert newsletter subscription" ON public.newsletter_subscriptions;
DROP POLICY IF EXISTS rbac_inquiries_create ON public.inquiries;
DROP POLICY IF EXISTS rbac_newsletter_subscriptions_create ON public.newsletter_subscriptions;

CREATE POLICY rbac_inquiries_create ON public.inquiries
  FOR INSERT TO authenticated
  WITH CHECK (private.has_permission('crm.create'::text));

CREATE POLICY rbac_newsletter_subscriptions_create ON public.newsletter_subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (private.has_permission('content.create'::text));

-- Anonymous public submission writes are intentionally absent: the server uses its
-- server-only Supabase key and applies IP rate limits, validation and honeypots.

-- Remove every direct anonymous table privilege. Public submissions use the
-- server-only service-role client; anon must not retain TRUNCATE or other grants.
REVOKE ALL PRIVILEGES ON TABLE public.inquiries, public.newsletter_subscriptions FROM anon;
