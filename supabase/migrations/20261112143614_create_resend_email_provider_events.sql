-- Durable, idempotent audit trail for Resend webhook events.
CREATE TABLE IF NOT EXISTS public.email_provider_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  provider_message_id TEXT NOT NULL,
  recipient_address TEXT,
  occurred_at TIMESTAMPTZ NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_provider_events_message
  ON public.email_provider_events(provider_message_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_provider_events_type
  ON public.email_provider_events(event_type, occurred_at DESC);

ALTER TABLE public.email_provider_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.email_provider_events FROM anon, authenticated;
GRANT SELECT ON TABLE public.email_provider_events TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.email_provider_events TO service_role;

DROP POLICY IF EXISTS "Staff can read email provider events" ON public.email_provider_events;
CREATE POLICY "Staff can read email provider events"
  ON public.email_provider_events FOR SELECT TO authenticated
  USING (private.has_permission('content.read'::text));
