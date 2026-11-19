-- New tour drafts must start unconfigured instead of inheriting Hurghada boat-trip claims.
-- Published tours are validated in the admin editor before they can become public.
ALTER TABLE public.tours
  ALTER COLUMN duration SET DEFAULT '',
  ALTER COLUMN duration_type SET DEFAULT 'Unspecified',
  ALTER COLUMN duration_hours SET DEFAULT 0,
  ALTER COLUMN minimum_booking_notice_hours SET DEFAULT 0,
  ALTER COLUMN pickup_available SET DEFAULT FALSE,
  ALTER COLUMN pickup_info DROP DEFAULT,
  ALTER COLUMN cancellation_policy DROP DEFAULT,
  ALTER COLUMN languages SET DEFAULT '{}'::text[],
  ALTER COLUMN difficulty DROP DEFAULT,
  ALTER COLUMN age_restrictions DROP DEFAULT;

ALTER TABLE public.tours
  DROP CONSTRAINT IF EXISTS tours_duration_type_check;

ALTER TABLE public.tours
  ADD CONSTRAINT tours_duration_type_check
  CHECK (duration_type = ANY (ARRAY['Half Day'::text, 'Full Day'::text, 'Multi Day'::text, 'Unspecified'::text]));

COMMENT ON COLUMN public.tours.duration IS
  'Human-readable duration entered for this specific excursion; empty values are allowed only while a tour is a draft.';
COMMENT ON COLUMN public.tours.duration_type IS
  'Duration category. Unspecified is a draft-only editor state and must be replaced before publication.';
COMMENT ON COLUMN public.tours.pickup_available IS
  'Whether this specific excursion offers pickup. Defaults to false until explicitly configured.';
COMMENT ON COLUMN public.tours.pickup_info IS
  'Excursion-specific pickup details. No universal complimentary-pickup promise is assumed.';
COMMENT ON COLUMN public.tours.cancellation_policy IS
  'Excursion-specific cancellation policy. No generic cancellation promise is assumed.';
