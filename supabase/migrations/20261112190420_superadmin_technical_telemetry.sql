-- Superadmin-only technical telemetry. The server writes via its private service-role
-- client; browser roles, including ordinary admins, have no table privileges.
BEGIN;

CREATE TABLE IF NOT EXISTS public.technical_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  severity text NOT NULL CHECK (severity IN ('info','warning','error')),
  event_type text NOT NULL,
  source text NOT NULL,
  message text NOT NULL,
  request_method text,
  request_path text,
  status_code integer CHECK (status_code IS NULL OR status_code BETWEEN 100 AND 599),
  duration_ms integer CHECK (duration_ms IS NULL OR duration_ms >= 0),
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_technical_events_created_at
  ON public.technical_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_technical_events_severity_created_at
  ON public.technical_events (severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_technical_events_type_created_at
  ON public.technical_events (event_type, created_at DESC);

ALTER TABLE public.technical_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.technical_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.technical_events TO service_role;

COMMENT ON TABLE public.technical_events IS
  'Sanitized server-side operational telemetry. Read/write only through privileged server endpoints; never expose raw secrets or request bodies.';

COMMIT;
