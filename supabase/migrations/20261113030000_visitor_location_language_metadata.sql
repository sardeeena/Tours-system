-- Add consent-gated approximate location and richer, non-invasive device locale metadata.
-- Raw IP addresses and raw user-agent strings are never stored in these columns.
BEGIN;

ALTER TABLE public.visitor_sessions
  ADD COLUMN IF NOT EXISTS country_name text,
  ADD COLUMN IF NOT EXISTS region_name text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS location_source text,
  ADD COLUMN IF NOT EXISTS locale text,
  ADD COLUMN IF NOT EXISTS language_preferences text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS platform_family text,
  ADD COLUMN IF NOT EXISTS is_mobile boolean,
  ADD COLUMN IF NOT EXISTS viewport_bucket text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'visitor_sessions_location_source_check') THEN
    ALTER TABLE public.visitor_sessions
      ADD CONSTRAINT visitor_sessions_location_source_check
      CHECK (location_source IS NULL OR location_source = 'ip_approximate');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'visitor_sessions_language_preferences_limit_check') THEN
    ALTER TABLE public.visitor_sessions
      ADD CONSTRAINT visitor_sessions_language_preferences_limit_check
      CHECK (cardinality(language_preferences) <= 8);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'visitor_sessions_locale_format_check') THEN
    ALTER TABLE public.visitor_sessions
      ADD CONSTRAINT visitor_sessions_locale_format_check
      CHECK (locale IS NULL OR locale ~ '^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'visitor_sessions_viewport_bucket_check') THEN
    ALTER TABLE public.visitor_sessions
      ADD CONSTRAINT visitor_sessions_viewport_bucket_check
      CHECK (viewport_bucket IS NULL OR viewport_bucket IN ('compact','standard','wide'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'visitor_sessions_platform_family_check') THEN
    ALTER TABLE public.visitor_sessions
      ADD CONSTRAINT visitor_sessions_platform_family_check
      CHECK (platform_family IS NULL OR platform_family IN ('Windows','macOS','Linux','Android','iOS','ChromeOS','Other'));
  END IF;
END $$;

-- Existing optional analytics choices predate the new IP-derived location notice.
-- End those sessions without deleting their historical records; visitors must
-- make a fresh version-2 choice before new optional analytics resumes.
UPDATE public.visitor_sessions
SET analytics_consent = false,
    marketing_consent = false,
    ended_at = COALESCE(ended_at, now()),
    consent_updated_at = now()
WHERE analytics_consent = true OR marketing_consent = true;

CREATE INDEX IF NOT EXISTS idx_visitor_sessions_country_started
  ON public.visitor_sessions (country_code, started_at DESC)
  WHERE country_code IS NOT NULL;

COMMENT ON COLUMN public.visitor_sessions.country_code IS
  'Approximate IP-derived country code, captured only after analytics consent; raw IP is not retained.';
COMMENT ON COLUMN public.visitor_sessions.city IS
  'Approximate IP-derived city, not GPS location; captured only after analytics consent.';
COMMENT ON COLUMN public.visitor_sessions.language_preferences IS
  'Up to eight browser-preferred language tags, captured only after analytics consent.';
COMMENT ON COLUMN public.visitor_sessions.location_source IS
  'Identifies approximate IP-derived location; never indicates precise GPS collection.';

COMMIT;
