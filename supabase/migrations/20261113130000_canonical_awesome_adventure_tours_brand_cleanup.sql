BEGIN;

-- Canonicalize only the two draft invoice snapshots that still carry retired branding.
UPDATE public.invoices
SET company_details = company_details || jsonb_build_object(
  'name', 'Awesome Adventure Tours',
  'website', 'https://awesomeadventure.tours'
)
WHERE status = 'draft'
  AND company_details::text ILIKE '%Kemet%'
  AND invoice_number IN ('INV-2026-000001', 'INV-2026-000002');

-- Remove the retired phrase from published editorial content without changing article substance.
UPDATE public.blog_posts
SET title = replace(title, 'Choosing a Family-Friendly Red Sea Excursion', 'Choosing a Family-Friendly Hurghada Boat Trip'),
    content = replace(
      replace(content, 'Choosing a Family-Friendly Red Sea Excursion', 'Choosing a Family-Friendly Hurghada Boat Trip'),
      'Red Sea Excursion',
      'coastal boat trip'
    ),
    seo_description = regexp_replace(seo_description, 'Red Sea excursions?', 'boat trips and coastal experiences', 'gi')
WHERE to_jsonb(blog_posts)::text ILIKE '%Kemet%'
   OR to_jsonb(blog_posts)::text ILIKE '%Red Sea Excursion%';

-- Keep the page identity anchored to the actual company brand, not a geographic phrase.
UPDATE public.seo_metadata
SET seo_title = CASE page_slug
      WHEN 'about' THEN 'About Awesome Adventure Tours | Egypt Tours & Experiences'
      WHEN 'why-us' THEN 'Why Choose Awesome Adventure Tours | Local Expertise'
      WHEN 'marine-safety' THEN 'Marine Safety Information | Awesome Adventure Tours'
      ELSE seo_title
    END,
    meta_description = CASE page_slug
      WHEN 'why-us' THEN 'Compare available trips and review practical details before making a reservation.'
      WHEN 'marine-safety' THEN 'Review departure, weather and safety information for your selected trip.'
      ELSE meta_description
    END
WHERE page_slug IN ('about', 'why-us', 'marine-safety')
  AND (
    coalesce(seo_title, '') ILIKE '%Red Sea Excursion%'
    OR coalesce(meta_description, '') ILIKE '%Red Sea Excursion%'
    OR coalesce(seo_title, '') ILIKE '%Kemet%'
    OR coalesce(meta_description, '') ILIKE '%Kemet%'
  );

UPDATE public.crm_tags
SET description = 'Traveled more than once with Awesome Adventure Tours'
WHERE id = '51507abc-4f69-4828-8146-611c4ffe76c3'
  AND description = 'Traveled more than once with Red Sea Excursions';

-- Update historical visitor page-title snapshots only; preserve event identity, paths and timestamps.
UPDATE public.visitor_events
SET page_title = CASE
  WHEN page_title ILIKE '%Red Sea Excursions & Boat Trips%' THEN 'Boat Trips & Island Tours in Egypt | Awesome Adventure Tours'
  WHEN page_title ILIKE '%All Red Sea Excursions%' THEN 'Boat Trips & Island Tours in Egypt | Awesome Adventure Tours'
  WHEN page_title ILIKE '%Awesome Adventure Tours%Red Sea Excursions%' THEN 'Awesome Adventure Tours | Boat Trips, Island Tours & Safaris'
  ELSE page_title
END
WHERE page_title ILIKE '%Red Sea Excursion%'
   OR page_title ILIKE '%Kemet%'
   OR page_title ILIKE '%Red Sea Voyages%';

COMMIT;
