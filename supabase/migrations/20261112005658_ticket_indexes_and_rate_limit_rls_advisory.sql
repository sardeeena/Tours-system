-- Remediate the three unindexed foreign keys introduced by ticket management.
-- The rate-limit table is intentionally server-only: API roles retain no table grants.
-- Explicit deny policy documents this isolation and clears the advisor's no-policy notice
-- without granting anon/authenticated any access. service_role continues to bypass RLS.
BEGIN;

CREATE INDEX IF NOT EXISTS support_ticket_events_actor_id_idx
  ON public.support_ticket_events (actor_id);

CREATE INDEX IF NOT EXISTS support_ticket_messages_author_id_idx
  ON public.support_ticket_messages (author_id);

CREATE INDEX IF NOT EXISTS support_tickets_customer_id_idx
  ON public.support_tickets (customer_id);

DROP POLICY IF EXISTS rate_limit_buckets_deny_api_roles ON public.rate_limit_buckets;
CREATE POLICY rate_limit_buckets_deny_api_roles
  ON public.rate_limit_buckets
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

COMMIT;
