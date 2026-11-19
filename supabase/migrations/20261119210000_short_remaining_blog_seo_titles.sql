-- Shorten the remaining published blog SEO titles identified in the full 50-post review.
-- Content, URLs, descriptions and publication state are intentionally unchanged.
-- This migration is intentionally safe on clean CI databases where production blog rows are not seeded.
-- It updates only matching published rows; zero matching rows is valid in local migration tests.
UPDATE public.blog_posts AS p SET seo_title = v.seo_title, updated_at = now()
FROM (VALUES
  ('0cd117c2-37e2-4990-b183-d88aaebdb214'::uuid, 'Hurghada Quad Biking: First Ride Safety'),
  ('01c3aa8c-878d-48c6-aa0c-83bfc889c51c'::uuid, 'Mount Sinai Sunrise Hike: Preparation Guide'),
  ('c72f01f4-d37e-4067-916f-e1a9ea2ea5c2'::uuid, 'Old Cairo: Mosques, Churches & Khan El Khalili'),
  ('bc62ae9c-a1ef-46ef-addd-e40514139817'::uuid, 'Hurghada Parasailing: First-Time Flyer Guide'),
  ('210e5227-8805-4ae7-bb60-d4954ad3dd95'::uuid, 'Red Sea Wind & Weather: Boat Trip Changes'),
  ('63514379-b25f-4fb7-a1b3-fe34b3914d29'::uuid, 'Responsible Dolphin Watching in Hurghada'),
  ('30b82c66-2ce1-49c6-a463-ae19dba9123d'::uuid, 'Sinai Colored Canyon: Guided Walk Guide'),
  ('b7c75969-d8fb-4f62-ba33-6c54ea61df90'::uuid, 'Private Yacht vs Shared Boat in Hurghada'),
  ('32fd41b6-d956-4f8f-936e-e9a9708a98eb'::uuid, 'St Catherine''s Monastery Visitor Guide'),
  ('2b4079aa-a132-43b1-8cc7-f94563f8e90d'::uuid, 'El Gouna Desert Safari: Quad Bike or Jeep'),
  ('024bbe57-65d4-499c-af1f-4205d9ed86b9'::uuid, 'Best Time for a Hurghada Desert Safari'),
  ('1634d50e-5ada-4667-aeb3-461aa4d53993'::uuid, 'El Gouna Travel Guide: Beyond the Resort'),
  ('0a5edd6d-7747-4589-9ca8-3dcd7086476b'::uuid, 'Snorkeling in the Red Sea Without Swimming'),
  ('eda14d13-1b7c-4708-8d6d-1125da736d2a'::uuid, 'Sun Protection for Red Sea Snorkeling'),
  ('49b0e165-8c27-4984-8470-99e9e58f74b7'::uuid, 'Prevent Seasickness on a Red Sea Boat Trip'),
  ('66c1f90d-4fdf-43b7-acbb-98a1f5492d1e'::uuid, 'What to Wear for Luxor Sightseeing'),
  ('806e538c-6b71-4f1e-9b98-0e3f88096d48'::uuid, 'Red Sea Snorkeling: Beginner''s Guide'),
  ('45b40823-0eae-404f-8b83-1210738be0c9'::uuid, 'Hurghada Travel Guide for First-Time Visitors'),
  ('369637bd-bf30-4a19-a852-5cb868e05ac9'::uuid, 'Family Desert Safari Guide: Hurghada'),
  ('59bc9510-a388-4c23-b46a-df67c1d83339'::uuid, 'Things to Do in Hurghada Beyond the Beach'),
  ('eb7be3a9-81bc-4136-86b4-464d3fb48df2'::uuid, 'Red Sea Boat Trip Packing List')
) AS v(id,seo_title)
WHERE p.id=v.id AND p.status='published' AND p.seo_title IS DISTINCT FROM v.seo_title;
