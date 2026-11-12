-- Add indexes for foreign-key columns used by telemetry joins and retention workflows.
-- These indexes improve delete/update checks and common actor/session lookups without
-- changing row visibility, retention, or any existing application data.
BEGIN;

CREATE INDEX IF NOT EXISTS idx_technical_events_actor_user_id
  ON public.technical_events (actor_user_id)
  WHERE actor_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_visitor_analytics_settings_updated_by
  ON public.visitor_analytics_settings (updated_by)
  WHERE updated_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_visitor_consent_records_visitor_session_id
  ON public.visitor_consent_records (visitor_session_id)
  WHERE visitor_session_id IS NOT NULL;

COMMIT;
