-- One-time, guarded corrections for the catalogue already present in the live Awesome Adventure Tours project.
-- This is intentionally separate from the insert-only seed. Do not run without operator approval.
-- Every UPDATE is restricted by both the deterministic record ID and slug, and by the old value.

BEGIN;

DO $preflight$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.tours
    WHERE id = '10000000-0000-0000-0000-000000000005'::uuid
      AND slug = 'desert-quad-safari'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.tours
    WHERE id = '10000000-0000-0000-0000-000000000006'::uuid
      AND slug = 'desert-safari-bedouin-experience'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.tours
    WHERE id = '10000000-0000-0000-0000-000000000012'::uuid
      AND slug = 'sahl-hasheesh-glass-bottom-boat'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.tours
    WHERE id = '10000000-0000-0000-0000-000000000009'::uuid
      AND slug = 'introductory-scuba-diving-experience'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.destinations
    WHERE id = 'a1000000-0000-0000-0000-000000000003'::uuid
      AND slug = 'makadi-bay'
  ) THEN
    RAISE EXCEPTION 'Catalogue correction aborted: one or more expected seeded records do not match their IDs and slugs';
  END IF;
END;
$preflight$;

UPDATE public.tours
SET departure_time = '08:00 AM or 02:00 PM'
WHERE id = '10000000-0000-0000-0000-000000000005'::uuid
  AND slug = 'desert-quad-safari'
  AND departure_time = '08:00 AM or 14:00 PM';

UPDATE public.tours
SET departure_time = '01:30 PM'
WHERE id = '10000000-0000-0000-0000-000000000006'::uuid
  AND slug = 'desert-safari-bedouin-experience'
  AND departure_time = '13:30 PM';

UPDATE public.tours
SET departure_time = '10:00 AM or 02:00 PM'
WHERE id = '10000000-0000-0000-0000-000000000012'::uuid
  AND slug = 'sahl-hasheesh-glass-bottom-boat'
  AND departure_time = '10:00 AM or 14:00 PM';

UPDATE public.tours
SET age_restrictions = 'Minimum age 10 years'
WHERE id = '10000000-0000-0000-0000-000000000009'::uuid
  AND slug = 'introductory-scuba-diving-experience'
  AND age_restrictions IS NULL;

-- Makadi Bay is shown in the public destination directory with zero tours.
UPDATE public.destinations
SET status = 'published'
WHERE id = 'a1000000-0000-0000-0000-000000000003'::uuid
  AND slug = 'makadi-bay'
  AND status = 'draft';

SELECT json_build_object(
  'desert_quad_departure_correct', (
    SELECT departure_time = '08:00 AM or 02:00 PM'
    FROM public.tours WHERE slug = 'desert-quad-safari'
  ),
  'desert_safari_departure_correct', (
    SELECT departure_time = '01:30 PM'
    FROM public.tours WHERE slug = 'desert-safari-bedouin-experience'
  ),
  'glass_bottom_departure_correct', (
    SELECT departure_time = '10:00 AM or 02:00 PM'
    FROM public.tours WHERE slug = 'sahl-hasheesh-glass-bottom-boat'
  ),
  'scuba_minimum_age_preserved', (
    SELECT age_restrictions = 'Minimum age 10 years'
    FROM public.tours WHERE slug = 'introductory-scuba-diving-experience'
  ),
  'makadi_destination_published', (
    SELECT status = 'published'
    FROM public.destinations WHERE slug = 'makadi-bay'
  )
) AS correction_verification;

COMMIT;
