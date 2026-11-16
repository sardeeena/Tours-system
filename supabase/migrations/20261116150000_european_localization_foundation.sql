-- Europe-wide localization foundation.
-- Translation records remain server-only until reviewed locale routes and publication checks ship.
BEGIN;

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS preferred_locale text NOT NULL DEFAULT 'en';

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS customer_locale text NOT NULL DEFAULT 'en';

ALTER TABLE public.communication_templates
  ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'en';

-- A template key can now have one reviewed version per locale.
DO $
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.communication_templates'::regclass
      AND conname = 'communication_templates_template_key_key'
  ) THEN
    ALTER TABLE public.communication_templates
      DROP CONSTRAINT communication_templates_template_key_key;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.communication_templates'::regclass
      AND conname = 'communication_templates_template_key_locale_key'
  ) THEN
    ALTER TABLE public.communication_templates
      ADD CONSTRAINT communication_templates_template_key_locale_key
      UNIQUE (template_key, locale);
  END IF;
END $;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customers_preferred_locale_format_check') THEN
    ALTER TABLE public.customers
      ADD CONSTRAINT customers_preferred_locale_format_check
      CHECK (preferred_locale ~ '^[a-z]{2}(-[A-Z]{2})?$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_customer_locale_format_check') THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_customer_locale_format_check
      CHECK (customer_locale ~ '^[a-z]{2}(-[A-Z]{2})?$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'communication_templates_locale_format_check') THEN
    ALTER TABLE public.communication_templates
      ADD CONSTRAINT communication_templates_locale_format_check
      CHECK (locale ~ '^[a-z]{2}(-[A-Z]{2})?$');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.content_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN (
    'tour', 'tour_itinerary', 'tour_highlight', 'tour_inclusion',
    'tour_exclusion', 'tour_faq', 'destination', 'blog_post', 'static_page', 'ui_catalog'
  )),
  entity_key text NOT NULL,
  locale text NOT NULL CHECK (locale ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  translated_slug text,
  title text,
  summary text,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  seo_title text,
  seo_description text,
  source_checksum text,
  translation_state text NOT NULL DEFAULT 'draft'
    CHECK (translation_state IN ('draft', 'review', 'published', 'outdated')),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT content_translations_entity_locale_unique UNIQUE (entity_type, entity_key, locale),
  CONSTRAINT content_translations_published_timestamp_check
    CHECK (translation_state <> 'published' OR published_at IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS content_translations_locale_slug_unique
  ON public.content_translations(locale, translated_slug)
  WHERE translated_slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS content_translations_publication_lookup_idx
  ON public.content_translations(entity_type, locale, translation_state);

ALTER TABLE public.content_translations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.content_translations FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.content_translations TO service_role;

-- The generic audit function redacts JSON/content fields before storing snapshots.
-- Keep translation lifecycle changes auditable without exposing translated body text.
CREATE TRIGGER trg_capture_business_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.content_translations
  FOR EACH ROW EXECUTE FUNCTION private.capture_business_audit();

COMMENT ON TABLE public.content_translations IS
  'Server-managed reviewed translations. Do not publish or index draft, review, or outdated rows.';
COMMENT ON COLUMN public.bookings.customer_locale IS
  'Customer-facing booking language; separate from tour_language, which records the requested guide language.';
COMMENT ON COLUMN public.customers.preferred_locale IS
  'Customer communication preference, independent of tour guide language.';
COMMENT ON COLUMN public.communication_templates.locale IS
  'Language of this communication template; English remains the default.';

COMMIT;
