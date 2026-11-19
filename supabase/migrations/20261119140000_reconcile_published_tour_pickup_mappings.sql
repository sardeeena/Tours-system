-- Ensure every published pickup-enabled excursion has at least one active,
-- tour-specific pickup zone so the guest booking flow can complete StepPickup.
-- The locations below are derived from each published tour's existing pickup_info
-- and inclusion records. Existing paid outer-area zones remain unchanged.

BEGIN;

INSERT INTO public.pickup_locations (
  code,
  name,
  area,
  fee_eur_per_person,
  fee_eur_flat,
  is_active,
  sort_order,
  description
)
VALUES
  (
    'cairo-giza',
    'Cairo & Giza Hotels',
    'Cairo, Giza and the hotel areas listed on the excursion page',
    0,
    0,
    TRUE,
    8,
    'Complimentary lobby pickup and return across Cairo and Giza for the published Cairo excursions.'
  ),
  (
    'el-gouna-local-excursions',
    'El Gouna Hotels (Local Excursions)',
    'El Gouna, Downtown El Gouna, Abu Tig Marina, Mangroovy Beach and El Gouna hotels',
    0,
    0,
    TRUE,
    9,
    'Complimentary hotel pickup for local El Gouna excursions. The separate El Gouna Hotels zone and its €10 per-person supplement remain available for Hurghada-based excursions.'
  ),
  (
    'hurghada-airport',
    'Hurghada International Airport',
    'Hurghada International Airport arrivals terminal',
    0,
    0,
    TRUE,
    10,
    'Airport arrival pickup with drop-off at the hotel selected for the booking. Add flight number and arrival time to booking notes.'
  )
ON CONFLICT (code) DO NOTHING;

-- Add the destination-appropriate complimentary pickup zone only to published
-- pickup-enabled tours that currently have no mapping. Existing tour-specific
-- paid-zone assignments are preserved.
INSERT INTO public.tour_pickup_locations (tour_id, pickup_location_id)
SELECT
  t.id,
  pl.id
FROM public.tours AS t
JOIN public.destinations AS d
  ON d.id = t.destination_id
JOIN public.pickup_locations AS pl
  ON pl.code = CASE
    WHEN d.slug = 'hurghada'
      AND t.title = 'Hurghada Airport to Hotel – Private Arrival Transfer'
      THEN 'hurghada-airport'
    WHEN d.slug = 'hurghada' THEN 'hurghada-city'
    WHEN d.slug = 'sharm-el-sheikh' THEN 'sharm-el-sheikh'
    WHEN d.slug = 'cairo' THEN 'cairo-giza'
    WHEN d.slug = 'el-gouna' THEN 'el-gouna-local-excursions'
  END
 AND pl.is_active = TRUE
WHERE t.status = 'published'
  AND t.pickup_available = TRUE
  AND d.slug IN ('hurghada', 'sharm-el-sheikh', 'cairo', 'el-gouna')
  AND NOT EXISTS (
    SELECT 1
    FROM public.tour_pickup_locations AS existing_mapping
    WHERE existing_mapping.tour_id = t.id
  )
ON CONFLICT (tour_id, pickup_location_id) DO NOTHING;

-- Keep the public pickup explanation aligned with the actual mapped zones and
-- fee table. The airport transfer has a distinct airport pickup point.
UPDATE public.tours AS t
SET pickup_info = CASE
  WHEN t.title = 'Hurghada Airport to Hotel – Private Arrival Transfer'
    THEN 'Pickup at Hurghada International Airport with drop-off at your selected hotel. Add your flight number and arrival time in the booking notes.'
  ELSE 'Hotel pickup is available from the active zones listed during booking. Hurghada City Hotels pickup is complimentary; any applicable supplements for additional zones are shown before confirmation.'
END
FROM public.destinations AS d
WHERE t.destination_id = d.id
  AND d.slug = 'hurghada'
  AND t.status = 'published'
  AND t.pickup_available = TRUE;

-- A Sharm pickup zone was accidentally assigned to a Hurghada quad safari.
-- Keep the correct Hurghada zones and remove only this cross-destination mapping.
DELETE FROM public.tour_pickup_locations AS mapping
USING public.tours AS t,
      public.destinations AS d,
      public.pickup_locations AS pl
WHERE mapping.tour_id = t.id
  AND mapping.pickup_location_id = pl.id
  AND t.destination_id = d.id
  AND d.slug = 'hurghada'
  AND t.title = 'Hurghada Quad Bike Safari: Desert Ride, Camel Experience & Bedouin Village'
  AND pl.code = 'sharm-el-sheikh';

DO $$
DECLARE
  unmapped_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO unmapped_count
  FROM public.tours AS t
  WHERE t.status = 'published'
    AND t.pickup_available = TRUE
    AND NOT EXISTS (
      SELECT 1
      FROM public.tour_pickup_locations AS mapping
      JOIN public.pickup_locations AS location
        ON location.id = mapping.pickup_location_id
       AND location.is_active = TRUE
      WHERE mapping.tour_id = t.id
    );

  IF unmapped_count > 0 THEN
    RAISE EXCEPTION
      'Pickup mapping remediation incomplete: % published pickup-enabled tour(s) still have no active pickup zone.',
      unmapped_count;
  END IF;
END;
$$;

COMMIT;
