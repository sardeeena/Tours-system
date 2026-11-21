-- Shorten overlong article SEO titles so search snippets are not cut off.
-- The visible article H1s, slugs and body content remain unchanged.
-- The coral-reef guide is aligned to the Search Console query "coral reef etiquette".
UPDATE public.blog_posts AS posts
SET
  seo_title = updates.seo_title,
  seo_description = COALESCE(updates.seo_description, posts.seo_description),
  updated_at = now()
FROM (
  VALUES
    ('karnak-temple-valley-of-the-kings-guide', 'Karnak Temple & Valley of the Kings: Luxor Guide', NULL::text),
    ('orange-bay-vs-hula-hula-island-hurghada', 'Orange Bay vs Hula Hula: Which Hurghada Island Trip?', NULL::text),
    ('ras-mohammed-national-park-visitor-guide', 'Ras Mohammed National Park: Sinai Visitor Guide', NULL::text),
    ('cairo-first-time-visitor-sightseeing-plan', 'Cairo Sightseeing: First-Time Visitor Guide', NULL::text),
    ('responsible-travel-red-sea-coast-practical-guide', 'Responsible Travel on Egypt’s Red Sea Coast', NULL::text),
    ('red-sea-marine-wildlife-respectful-encounters', 'Red Sea Marine Wildlife: Responsible Encounters', NULL::text),
    ('egypt-family-travel-children-sea-sightseeing', 'Egypt Family Travel: Sea & Sightseeing Tips', NULL::text),
    ('bedouin-village-visit-cultural-etiquette-egypt', 'Bedouin Village Etiquette for Desert Visits', NULL::text),
    ('hurghada-to-luxor-day-trip-preparation', 'Hurghada to Luxor: Day Trip Planning Guide', NULL::text),
    ('jeep-safari-vs-quad-bike-egypt', 'Jeep Safari vs Quad Bike in Egypt: Which to Choose?', NULL::text),
    ('dahab-from-sharm-el-sheikh-day-trip-guide', 'Dahab from Sharm El Sheikh: Blue Hole & Coast', NULL::text),
    ('hurghada-couples-sea-desert-itinerary', 'Hurghada for Couples: Sea & Desert Itinerary', NULL::text),
    ('white-island-ras-mohammed-boat-trip-guide', 'White Island & Ras Mohammed Boat Trip Guide', NULL::text),
    ('sinai-desert-landscapes-mountains-canyons-coast', 'Sinai Landscapes: Mountains, Canyons & Coast', NULL::text),
    ('scuba-diving-vs-snorkeling-hurghada', 'Scuba Diving vs Snorkelling in Hurghada', NULL::text),
    ('accessible-excursions-egypt-mobility-planning', 'Accessible Excursions in Egypt: Mobility Checklist', NULL::text),
    ('hurghada-airport-arrival-hotel-transfer-guide', 'Hurghada Airport Arrival & Hotel Transfer Guide', NULL::text),
    ('combine-red-sea-holiday-luxor-cairo-itinerary', 'Red Sea Holiday & Egypt Heritage: Itinerary Guide', NULL::text),
    ('egypt-desert-stargazing-what-to-expect', 'Egypt Desert Stargazing: What to Expect', NULL::text),
    ('sharm-el-sheikh-travel-guide-sea-desert-city', 'Sharm El Sheikh Travel Guide: Sea, Desert & City', NULL::text),
    ('red-sea-coral-reefs-underwater-world', 'Red Sea Coral Reefs: Underwater World Guide', NULL::text),
    ('grand-egyptian-museum-first-time-visitor-guide', 'Grand Egyptian Museum: First-Time Visitor Guide', NULL::text),
    ('underwater-photography-red-sea-reef-safety', 'Underwater Photography: Protecting Red Sea Reefs', NULL::text),
    ('responsible-snorkeling-protect-coral-reefs', 'Coral Reef Etiquette: Responsible Snorkeling Guide', 'Learn coral reef etiquette for Red Sea snorkeling: keep fins clear, never touch or feed marine life, follow local guidance and take rubbish with you.')
) AS updates(slug, seo_title, seo_description)
WHERE posts.slug = updates.slug
  AND posts.status = 'published';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.blog_posts
    WHERE status = 'published'
      AND slug IN ('karnak-temple-valley-of-the-kings-guide', 'orange-bay-vs-hula-hula-island-hurghada', 'ras-mohammed-national-park-visitor-guide', 'cairo-first-time-visitor-sightseeing-plan', 'responsible-travel-red-sea-coast-practical-guide', 'red-sea-marine-wildlife-respectful-encounters', 'egypt-family-travel-children-sea-sightseeing', 'bedouin-village-visit-cultural-etiquette-egypt', 'hurghada-to-luxor-day-trip-preparation', 'jeep-safari-vs-quad-bike-egypt', 'dahab-from-sharm-el-sheikh-day-trip-guide', 'hurghada-couples-sea-desert-itinerary', 'white-island-ras-mohammed-boat-trip-guide', 'sinai-desert-landscapes-mountains-canyons-coast', 'scuba-diving-vs-snorkeling-hurghada', 'accessible-excursions-egypt-mobility-planning', 'hurghada-airport-arrival-hotel-transfer-guide', 'combine-red-sea-holiday-luxor-cairo-itinerary', 'egypt-desert-stargazing-what-to-expect', 'sharm-el-sheikh-travel-guide-sea-desert-city', 'red-sea-coral-reefs-underwater-world', 'grand-egyptian-museum-first-time-visitor-guide', 'underwater-photography-red-sea-reef-safety', 'responsible-snorkeling-protect-coral-reefs')
      AND char_length(COALESCE(seo_title, '')) > 60
  ) THEN
    RAISE EXCEPTION 'One or more targeted blog SEO titles still exceed 60 characters';
  END IF;
END
$$;
