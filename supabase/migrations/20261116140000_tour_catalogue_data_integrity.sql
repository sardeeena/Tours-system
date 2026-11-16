-- Correct verified public excursion data inconsistencies without changing prices or booking history.
BEGIN;

-- "Italy" was stored as a spoken-language label; the correct language name is Italian.
UPDATE public.tours
SET languages = array_replace(languages, 'Italy', 'Italian'),
    updated_at = NOW()
WHERE languages @> ARRAY['Italy']::text[];

-- The Sharm El Sheikh city tour must not promise pickup across Hurghada.
UPDATE public.tours
SET pickup_info = 'Complimentary lobby pickup and return across Sharm El Sheikh included.',
    updated_at = NOW()
WHERE slug = 'sharm-el-sheikh-private-city-tour-old-market-mosque-cathedral'
  AND pickup_info = 'Complimentary lobby pickup and return across Hurghada included.';

-- These published tours are explicitly classified as half-day excursions and have 3-hour durations.
UPDATE public.tours
SET duration = 'Half Day (approx. 3 hours)',
    updated_at = NOW()
WHERE slug IN (
  'grand-egyptian-museum-guided-tour-with-entry-ticket',
  'el-gouna-desert-quad-safari-bedouin-village-camel-ride',
  'hurghada-desert-quad-safari-atv-adventure-camel-ride-bedouin-village',
  'hurghada-quad-bike-safari-desert-ride-camel-experience-bedouin-village',
  'sharm-el-sheikh-private-city-tour-old-market-mosque-cathedral'
)
  AND duration_type = 'Half Day'
  AND duration_hours::numeric = 3
  AND duration IS DISTINCT FROM 'Half Day (approx. 3 hours)';

-- The Ras Mohammed trip is classified as half-day and lasts approximately five hours.
UPDATE public.tours
SET duration = 'Half Day (approx. 5 hours)',
    updated_at = NOW()
WHERE slug = 'sharm-el-sheikh-ras-mohammed-magic-lake-snorkeling-adventure'
  AND duration_type = 'Half Day'
  AND duration_hours::numeric = 5
  AND duration IS DISTINCT FROM 'Half Day (approx. 5 hours)';

-- Remove accidental whitespace in duration labels without changing their meaning.
UPDATE public.tours
SET duration = btrim(duration),
    updated_at = NOW()
WHERE duration IS DISTINCT FROM btrim(duration);

COMMIT;
