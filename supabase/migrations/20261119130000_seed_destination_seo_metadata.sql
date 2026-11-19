-- Seed explicit, destination-specific metadata and keep thin destination pages noindex.
-- The public renderer and sitemap apply the same inventory/content threshold:
-- at least two published tours OR at least 650 characters of original description + tagline.
WITH destination_seo AS (
  SELECT *
  FROM (VALUES
    (
      'hurghada',
      'Hurghada Excursions & Boat Trips | Awesome Adventure Tours',
      'Explore Hurghada boat trips, Red Sea island excursions, snorkeling, diving and desert safaris. Compare tour details, pickup options and booking terms.',
      ARRAY['Hurghada boat trips', 'Hurghada excursions', 'Red Sea snorkeling', 'Hurghada desert safari']::text[],
      TRUE
    ),
    (
      'sharm-el-sheikh',
      'Sharm El Sheikh Excursions | Awesome Adventure Tours',
      'Discover Sharm El Sheikh excursions, Ras Mohammed boat trips, White Island, Sinai desert safaris and day tours. Check itineraries, pickup and booking terms.',
      ARRAY['Sharm El Sheikh excursions', 'Ras Mohammed tours', 'White Island boat trip', 'Sinai desert safari']::text[],
      TRUE
    ),
    (
      'el-gouna',
      'El Gouna Tours & Excursions | Awesome Adventure Tours',
      'Explore El Gouna excursions, desert safaris and nearby Red Sea experiences. Compare available trips, transfer details and current booking conditions.',
      ARRAY['El Gouna excursions', 'El Gouna desert safari', 'Red Sea tours']::text[],
      TRUE
    ),
    (
      'cairo',
      'Cairo Tours & Excursions | Awesome Adventure Tours',
      'Explore Cairo at the Grand Egyptian Museum and historic Old Cairo. Discover pharaonic collections, Islamic and Coptic heritage, and guided city experiences.',
      ARRAY['Cairo tours', 'Grand Egyptian Museum tour', 'Old Cairo tour', 'Islamic and Coptic Cairo']::text[],
      TRUE
    ),
    (
      'luxor',
      'Luxor Tours & Day Trips | Awesome Adventure Tours',
      'Explore Luxor temples and ancient sites. Check this page for verified, published day trips and current availability before planning your visit.',
      ARRAY['Luxor tours', 'Luxor day trips', 'Karnak Temple', 'Valley of the Kings']::text[],
      FALSE
    ),
    (
      'sahl-hasheesh',
      'Sahl Hasheesh Excursions | Awesome Adventure Tours',
      'Explore Sahl Hasheesh and nearby Red Sea experiences. Bookable excursions will appear here when verified destination inventory is available.',
      ARRAY['Sahl Hasheesh excursions', 'Sahl Hasheesh tours', 'Red Sea experiences']::text[],
      FALSE
    ),
    (
      'makadi-bay',
      'Makadi Bay Excursions | Awesome Adventure Tours',
      'Explore Makadi Bay and nearby Red Sea experiences. Bookable excursions will appear here when verified destination inventory is available.',
      ARRAY['Makadi Bay excursions', 'Makadi Bay tours', 'Red Sea experiences']::text[],
      FALSE
    )
  ) AS v(slug, seo_title, meta_description, seo_keywords, robots_index)
)
UPDATE public.destinations AS d
SET
  seo_title = s.seo_title,
  seo_description = s.meta_description,
  updated_at = now()
FROM destination_seo AS s
WHERE d.slug = s.slug;

WITH destination_seo AS (
  SELECT *
  FROM (VALUES
    ('hurghada', 'Hurghada Excursions & Boat Trips | Awesome Adventure Tours', 'Explore Hurghada boat trips, Red Sea island excursions, snorkeling, diving and desert safaris. Compare tour details, pickup options and booking terms.', ARRAY['Hurghada boat trips', 'Hurghada excursions', 'Red Sea snorkeling', 'Hurghada desert safari']::text[], TRUE),
    ('sharm-el-sheikh', 'Sharm El Sheikh Excursions | Awesome Adventure Tours', 'Discover Sharm El Sheikh excursions, Ras Mohammed boat trips, White Island, Sinai desert safaris and day tours. Check itineraries, pickup and booking terms.', ARRAY['Sharm El Sheikh excursions', 'Ras Mohammed tours', 'White Island boat trip', 'Sinai desert safari']::text[], TRUE),
    ('el-gouna', 'El Gouna Tours & Excursions | Awesome Adventure Tours', 'Explore El Gouna excursions, desert safaris and nearby Red Sea experiences. Compare available trips, transfer details and current booking conditions.', ARRAY['El Gouna excursions', 'El Gouna desert safari', 'Red Sea tours']::text[], TRUE),
    ('cairo', 'Cairo Tours & Excursions | Awesome Adventure Tours', 'Explore Cairo at the Grand Egyptian Museum and historic Old Cairo. Discover pharaonic collections, Islamic and Coptic heritage, and guided city experiences.', ARRAY['Cairo tours', 'Grand Egyptian Museum tour', 'Old Cairo tour', 'Islamic and Coptic Cairo']::text[], TRUE),
    ('luxor', 'Luxor Tours & Day Trips | Awesome Adventure Tours', 'Explore Luxor temples and ancient sites. Check this page for verified, published day trips and current availability before planning your visit.', ARRAY['Luxor tours', 'Luxor day trips', 'Karnak Temple', 'Valley of the Kings']::text[], FALSE),
    ('sahl-hasheesh', 'Sahl Hasheesh Excursions | Awesome Adventure Tours', 'Explore Sahl Hasheesh and nearby Red Sea experiences. Bookable excursions will appear here when verified destination inventory is available.', ARRAY['Sahl Hasheesh excursions', 'Sahl Hasheesh tours', 'Red Sea experiences']::text[], FALSE),
    ('makadi-bay', 'Makadi Bay Excursions | Awesome Adventure Tours', 'Explore Makadi Bay and nearby Red Sea experiences. Bookable excursions will appear here when verified destination inventory is available.', ARRAY['Makadi Bay excursions', 'Makadi Bay tours', 'Red Sea experiences']::text[], FALSE)
  ) AS v(slug, seo_title, meta_description, seo_keywords, robots_index)
)
INSERT INTO public.seo_metadata (
  entity_type, entity_id, page_slug, seo_title, meta_description, seo_keywords,
  canonical_url, og_title, og_description, robots_index, robots_follow
)
SELECT
  'destination',
  d.id,
  NULL,
  s.seo_title,
  s.meta_description,
  s.seo_keywords,
  'https://awesomeadventure.tours/destinations/' || d.slug,
  s.seo_title,
  s.meta_description,
  s.robots_index,
  TRUE
FROM public.destinations AS d
JOIN destination_seo AS s ON s.slug = d.slug
ON CONFLICT (entity_type, entity_id) DO UPDATE SET
  seo_title = EXCLUDED.seo_title,
  meta_description = EXCLUDED.meta_description,
  seo_keywords = EXCLUDED.seo_keywords,
  canonical_url = EXCLUDED.canonical_url,
  og_title = EXCLUDED.og_title,
  og_description = EXCLUDED.og_description,
  robots_index = EXCLUDED.robots_index,
  robots_follow = EXCLUDED.robots_follow,
  updated_at = now();
