-- Consent-aware visitor analytics and privacy-safe session history.
-- All writes/reads are performed by the authenticated server using its server-only
-- Supabase secret. Browser roles receive no direct table privileges.
BEGIN;

CREATE TABLE IF NOT EXISTS public.visitor_sessions (
  id uuid PRIMARY KEY,
  visitor_id uuid NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  landing_path text NOT NULL DEFAULT '/',
  referrer_host text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  device_type text CHECK (device_type IS NULL OR device_type IN ('desktop','mobile','tablet','other')),
  browser_family text,
  os_family text,
  screen_bucket text,
  language text,
  timezone text,
  country_code text,
  region_code text,
  analytics_consent boolean NOT NULL DEFAULT false,
  marketing_consent boolean NOT NULL DEFAULT false,
  consent_updated_at timestamptz,
  CONSTRAINT visitor_sessions_path_length CHECK (length(landing_path) <= 512)
);

CREATE INDEX IF NOT EXISTS idx_visitor_sessions_visitor_started
  ON public.visitor_sessions (visitor_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_visitor_sessions_started_at
  ON public.visitor_sessions (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_visitor_sessions_user_started
  ON public.visitor_sessions (user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_visitor_sessions_last_seen
  ON public.visitor_sessions (last_seen_at DESC);

CREATE TABLE IF NOT EXISTS public.visitor_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  session_id uuid NOT NULL REFERENCES public.visitor_sessions(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_name text NOT NULL CHECK (event_name IN (
    'page_view','page_exit','navigation','tour_view','search',
    'booking_started','booking_step_completed','booking_submitted',
    'booking_confirmed','booking_cancelled','custom'
  )),
  page_path text,
  page_title text,
  duration_ms integer CHECK (duration_ms IS NULL OR duration_ms BETWEEN 0 AND 86400000),
  event_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT visitor_events_path_length CHECK (page_path IS NULL OR length(page_path) <= 512),
  CONSTRAINT visitor_events_title_length CHECK (page_title IS NULL OR length(page_title) <= 160),
  CONSTRAINT visitor_events_payload_size CHECK (pg_column_size(event_data) <= 4096)
);

CREATE INDEX IF NOT EXISTS idx_visitor_events_occurred_at
  ON public.visitor_events (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_visitor_events_session_time
  ON public.visitor_events (session_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_visitor_events_name_time
  ON public.visitor_events (event_name, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_visitor_events_user_time
  ON public.visitor_events (user_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.visitor_consent_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_session_id uuid REFERENCES public.visitor_sessions(id) ON DELETE SET NULL,
  visitor_id uuid,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  necessary boolean NOT NULL DEFAULT true CHECK (necessary),
  analytics boolean NOT NULL DEFAULT false,
  marketing boolean NOT NULL DEFAULT false,
  consent_version text NOT NULL DEFAULT '1',
  consent_source text NOT NULL DEFAULT 'cookie_banner'
    CHECK (consent_source IN ('cookie_banner','privacy_settings','account_settings')),
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_visitor_consent_recorded_at
  ON public.visitor_consent_records (recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_visitor_consent_user_time
  ON public.visitor_consent_records (user_id, recorded_at DESC);

CREATE TABLE IF NOT EXISTS public.visitor_analytics_settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  event_retention_days integer NOT NULL DEFAULT 90 CHECK (event_retention_days BETWEEN 7 AND 730),
  session_retention_days integer NOT NULL DEFAULT 180 CHECK (session_retention_days BETWEEN 7 AND 1095),
  consent_retention_days integer NOT NULL DEFAULT 730 CHECK (consent_retention_days BETWEEN 90 AND 3650),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

INSERT INTO public.visitor_analytics_settings (singleton)
VALUES (true)
ON CONFLICT (singleton) DO NOTHING;

ALTER TABLE public.visitor_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitor_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitor_consent_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitor_analytics_settings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.visitor_sessions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.visitor_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.visitor_consent_records FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.visitor_analytics_settings FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public.visitor_sessions TO service_role;
GRANT ALL ON TABLE public.visitor_events TO service_role;
GRANT ALL ON TABLE public.visitor_consent_records TO service_role;
GRANT ALL ON TABLE public.visitor_analytics_settings TO service_role;

COMMENT ON TABLE public.visitor_sessions IS
  'Pseudonymous consent-gated visitor sessions. Never store raw IP addresses, full user-agent strings, cookies, tokens, or secrets.';
COMMENT ON TABLE public.visitor_events IS
  'Allowlisted consent-gated visitor activity. Event payloads must be schema-validated and must not contain PII, credentials, or payment data.';
COMMENT ON TABLE public.visitor_consent_records IS
  'Append-only history of privacy choices. Necessary consent evidence is retained independently from optional analytics.';
COMMENT ON TABLE public.visitor_analytics_settings IS
  'Superadmin-controlled retention periods for visitor analytics and consent records.';

COMMIT;
