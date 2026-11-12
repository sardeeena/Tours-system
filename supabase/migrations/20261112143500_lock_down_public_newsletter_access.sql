-- Keep public newsletter signup open while preventing anonymous access to the subscriber directory.
DROP POLICY IF EXISTS "Public can view own newsletter status" ON public.newsletter_subscriptions;
DROP POLICY IF EXISTS "Public can update own subscription" ON public.newsletter_subscriptions;
DROP POLICY IF EXISTS "Public can view newsletter subscriptions" ON public.newsletter_subscriptions;
DROP POLICY IF EXISTS "Public can update newsletter subscriptions" ON public.newsletter_subscriptions;

REVOKE ALL PRIVILEGES ON TABLE public.newsletter_subscriptions FROM anon;
GRANT INSERT ON TABLE public.newsletter_subscriptions TO anon;

-- Admin access remains governed by the existing authenticated RBAC policies.
