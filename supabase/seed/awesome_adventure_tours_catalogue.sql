-- Awesome Adventure Tours catalogue seed. Imported from the currently published site and repository.
-- Tour, destination and category records are published to preserve the existing public catalogue.
-- Ratings/reviews are intentionally zero/empty. Stock imagery is explicitly labelled illustrative.
-- Pickup fee records are inactive pending a separate operational fee review.
-- Existing tour_extras rows are preserved; only per-tour add-ons are added and assigned.
-- This file is idempotent and non-destructive: it uses INSERT ... ON CONFLICT DO NOTHING only.
BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.tours t
    JOIN (VALUES ('orange-bay-island-snorkeling', '10000000-0000-0000-0000-000000000001'::uuid), ('paradise-island-snorkeling-trip', '10000000-0000-0000-0000-000000000002'::uuid), ('dolphin-house-snorkeling', '10000000-0000-0000-0000-000000000003'::uuid), ('giftun-island-boat-trip', '10000000-0000-0000-0000-000000000004'::uuid), ('desert-quad-safari', '10000000-0000-0000-0000-000000000005'::uuid), ('desert-safari-bedouin-experience', '10000000-0000-0000-0000-000000000006'::uuid), ('private-red-sea-yacht', '10000000-0000-0000-0000-000000000007'::uuid), ('el-gouna-private-boat-trip', '10000000-0000-0000-0000-000000000008'::uuid), ('introductory-scuba-diving-experience', '10000000-0000-0000-0000-000000000009'::uuid), ('marsa-alam-dolphin-house', '10000000-0000-0000-0000-000000000010'::uuid), ('sharm-el-naga-beach-reef-day', '10000000-0000-0000-0000-000000000011'::uuid), ('sahl-hasheesh-glass-bottom-boat', '10000000-0000-0000-0000-000000000012'::uuid), ('ras-mohammed-white-island-cruise', '10000000-0000-0000-0000-000000000013'::uuid)) AS seed(slug, id)
      ON seed.slug = t.slug
    WHERE t.id <> seed.id
  ) THEN
    RAISE EXCEPTION 'Catalogue seed aborted: a tour slug already exists with a different ID';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.destinations d
    JOIN (VALUES ('hurghada', 'a1000000-0000-0000-0000-000000000001'::uuid), ('el-gouna', 'a1000000-0000-0000-0000-000000000002'::uuid), ('makadi-bay', 'a1000000-0000-0000-0000-000000000003'::uuid), ('sahl-hasheesh', 'a1000000-0000-0000-0000-000000000004'::uuid), ('safaga', 'a1000000-0000-0000-0000-000000000005'::uuid), ('marsa-alam', 'a1000000-0000-0000-0000-000000000007'::uuid), ('sharm-el-sheikh', 'a1000000-0000-0000-0000-000000000006'::uuid)) AS seed(slug, id)
      ON seed.slug = d.slug
    WHERE d.id <> seed.id
  ) THEN
    RAISE EXCEPTION 'Catalogue seed aborted: a destination slug already exists with a different ID';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.categories c
    JOIN (VALUES ('boat-trips', 'c1000000-0000-0000-0000-000000000001'::uuid), ('snorkeling', 'c1000000-0000-0000-0000-000000000002'::uuid), ('diving', 'c1000000-0000-0000-0000-000000000003'::uuid), ('safari', 'c1000000-0000-0000-0000-000000000004'::uuid), ('private-tours', 'c1000000-0000-0000-0000-000000000005'::uuid), ('water-sports', 'c1000000-0000-0000-0000-000000000006'::uuid)) AS seed(slug, id)
      ON seed.slug = c.slug
    WHERE c.id <> seed.id
  ) THEN
    RAISE EXCEPTION 'Catalogue seed aborted: a category slug already exists with a different ID';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.tours t
    JOIN (VALUES
      ('10000000-0000-0000-0000-000000000001'::uuid, 'orange-bay-island-snorkeling'),
      ('10000000-0000-0000-0000-000000000002'::uuid, 'paradise-island-snorkeling-trip'),
      ('10000000-0000-0000-0000-000000000003'::uuid, 'dolphin-house-snorkeling'),
      ('10000000-0000-0000-0000-000000000004'::uuid, 'giftun-island-boat-trip'),
      ('10000000-0000-0000-0000-000000000005'::uuid, 'desert-quad-safari'),
      ('10000000-0000-0000-0000-000000000006'::uuid, 'desert-safari-bedouin-experience'),
      ('10000000-0000-0000-0000-000000000007'::uuid, 'private-red-sea-yacht'),
      ('10000000-0000-0000-0000-000000000008'::uuid, 'el-gouna-private-boat-trip'),
      ('10000000-0000-0000-0000-000000000009'::uuid, 'introductory-scuba-diving-experience'),
      ('10000000-0000-0000-0000-000000000010'::uuid, 'marsa-alam-dolphin-house'),
      ('10000000-0000-0000-0000-000000000011'::uuid, 'sharm-el-naga-beach-reef-day'),
      ('10000000-0000-0000-0000-000000000012'::uuid, 'sahl-hasheesh-glass-bottom-boat'),
      ('10000000-0000-0000-0000-000000000013'::uuid, 'ras-mohammed-white-island-cruise')
    ) AS seed(id, slug) ON seed.id = t.id
    WHERE t.slug <> seed.slug
  ) THEN
    RAISE EXCEPTION 'Catalogue seed aborted: a deterministic tour ID already belongs to a different slug';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.destinations d
    JOIN (VALUES
      ('a1000000-0000-0000-0000-000000000001'::uuid, 'hurghada'),
      ('a1000000-0000-0000-0000-000000000002'::uuid, 'el-gouna'),
      ('a1000000-0000-0000-0000-000000000003'::uuid, 'makadi-bay'),
      ('a1000000-0000-0000-0000-000000000004'::uuid, 'sahl-hasheesh'),
      ('a1000000-0000-0000-0000-000000000005'::uuid, 'safaga'),
      ('a1000000-0000-0000-0000-000000000006'::uuid, 'sharm-el-sheikh'),
      ('a1000000-0000-0000-0000-000000000007'::uuid, 'marsa-alam')
    ) AS seed(id, slug) ON seed.id = d.id
    WHERE d.slug <> seed.slug
  ) THEN
    RAISE EXCEPTION 'Catalogue seed aborted: a deterministic destination ID already belongs to a different slug';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.categories c
    JOIN (VALUES
      ('c1000000-0000-0000-0000-000000000001'::uuid, 'boat-trips'),
      ('c1000000-0000-0000-0000-000000000002'::uuid, 'snorkeling'),
      ('c1000000-0000-0000-0000-000000000003'::uuid, 'diving'),
      ('c1000000-0000-0000-0000-000000000004'::uuid, 'safari'),
      ('c1000000-0000-0000-0000-000000000005'::uuid, 'private-tours'),
      ('c1000000-0000-0000-0000-000000000006'::uuid, 'water-sports')
    ) AS seed(id, slug) ON seed.id = c.id
    WHERE c.slug <> seed.slug
  ) THEN
    RAISE EXCEPTION 'Catalogue seed aborted: a deterministic category ID already belongs to a different slug';
  END IF;
END;
$;

INSERT INTO public.destinations (id,name,slug,tagline,description,main_image,gallery,distance_from_airport,seo_title,seo_description,seo_keywords,status,sort_order)
VALUES
('a1000000-0000-0000-0000-000000000001'::uuid, 'Hurghada', 'hurghada', 'Main departure hub for boat trips and coral reefs', 'The main resort city on the Red Sea with direct boat trips to Giftun Island, Orange Bay, and desert safari centers.', 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=800&q=80', ARRAY['https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=800&q=80']::text[], '15 mins from Hurghada Airport (HRG)', 'Hurghada Excursions' , 'The main resort city on the Red Sea with direct boat trips to Giftun Island, Orange Bay, and desert safari centers.', ARRAY['Hurghada', 'Red Sea excursions', 'Egypt tours']::text[], 'published', 1),
('a1000000-0000-0000-0000-000000000002'::uuid, 'El Gouna', 'el-gouna', 'Quiet lagoon town with marinas and private boat charters', 'A quiet resort town 30 minutes north of Hurghada, connected by lagoons, with private yacht charters from Abu Tig Marina.', 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=800&q=80', ARRAY['https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=800&q=80']::text[], '30 mins north of Hurghada (HRG)', 'El Gouna Excursions' , 'A quiet resort town 30 minutes north of Hurghada, connected by lagoons, with private yacht charters from Abu Tig Marina.', ARRAY['El Gouna', 'Red Sea excursions', 'Egypt tours']::text[], 'published', 2),
('a1000000-0000-0000-0000-000000000003'::uuid, 'Makadi Bay', 'makadi-bay', 'Calm bay with house reefs right off the beach', 'Located south of Hurghada with house reefs right in front of the hotels, great for snorkeling from the shore and desert tours.', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80', ARRAY['https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80']::text[], '25 mins south of Hurghada (HRG)', 'Makadi Bay Excursions' , 'Located south of Hurghada with house reefs right in front of the hotels, great for snorkeling from the shore and desert tours.', ARRAY['Makadi Bay', 'Red Sea excursions', 'Egypt tours']::text[], 'published', 3),
('a1000000-0000-0000-0000-000000000004'::uuid, 'Sahl Hasheesh', 'sahl-hasheesh', 'Relaxed resort bay with walking promenade and glass bottom boats', 'A relaxed bay with a pedestrian promenade, calm waters, sunken pharaonic pillars, and glass-bottom boat trips.', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80', ARRAY['https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80']::text[], '20 mins south of Hurghada (HRG)', 'Sahl Hasheesh Excursions' , 'A relaxed bay with a pedestrian promenade, calm waters, sunken pharaonic pillars, and glass-bottom boat trips.', ARRAY['Sahl Hasheesh', 'Red Sea excursions', 'Egypt tours']::text[], 'published', 4),
('a1000000-0000-0000-0000-000000000005'::uuid, 'Safaga', 'safaga', 'Wide bays and Sharm El Naga beach nature reserve', 'A quieter coastal area south of Hurghada, home to the protected Sharm El Naga marine bay where you snorkel right from the sand.', 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80', ARRAY['https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80']::text[], '45 mins south of Hurghada (HRG)', 'Safaga Excursions' , 'A quieter coastal area south of Hurghada, home to the protected Sharm El Naga marine bay where you snorkel right from the sand.', ARRAY['Safaga', 'Red Sea excursions', 'Egypt tours']::text[], 'published', 5),
('a1000000-0000-0000-0000-000000000007'::uuid, 'Marsa Alam', 'marsa-alam', 'Protected marine bays with sea turtles and wild dolphins', 'Egypt’s southern marine destination where wild spinner dolphins, sea turtles, and untouched reefs thrive.', 'https://images.unsplash.com/photo-1682687220063-4742bd7fd538?auto=format&fit=crop&w=800&q=80', ARRAY['https://images.unsplash.com/photo-1682687220063-4742bd7fd538?auto=format&fit=crop&w=800&q=80']::text[], '10-45 mins from Marsa Alam Airport (RMF)', 'Marsa Alam Excursions' , 'Egypt’s southern marine destination where wild spinner dolphins, sea turtles, and untouched reefs thrive.', ARRAY['Marsa Alam', 'Red Sea excursions', 'Egypt tours']::text[], 'published', 6),
('a1000000-0000-0000-0000-000000000006'::uuid, 'Sharm El-Sheikh', 'sharm-el-sheikh', 'Sinai marine jewel with Ras Mohammed drop-offs & White Island', 'The premier resort of the southern Sinai peninsula, famed for dramatic drop-off reef walls at Ras Mohammed National Park, the crystal waters of White Island, and the straits of Tiran.', 'https://images.unsplash.com/photo-1544551763-77ef2d0cfc6c?auto=format&fit=crop&w=800&q=80', ARRAY['https://images.unsplash.com/photo-1544551763-77ef2d0cfc6c?auto=format&fit=crop&w=800&q=80']::text[], '15 mins from Sharm El-Sheikh Airport (SSH)', 'Sharm El-Sheikh Excursions' , 'The premier resort of the southern Sinai peninsula, famed for dramatic drop-off reef walls at Ras Mohammed National Park, the crystal waters of White Island, and the straits of Tiran.', ARRAY['Sharm El-Sheikh', 'Red Sea excursions', 'Egypt tours']::text[], 'published', 7)
ON CONFLICT DO NOTHING;

INSERT INTO public.categories (id,name,slug,description,image,icon_name,seo_title,seo_description,seo_keywords,status,sort_order)
VALUES
('c1000000-0000-0000-0000-000000000001'::uuid, 'Boat Trips', 'boat-trips', 'Full-day motor yachts, catamarans, and island-hopping trips with sun decks and open buffet lunches.', 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=600&q=80', 'Ship', 'Boat Trips in the Red Sea', 'Full-day motor yachts, catamarans, and island-hopping trips with sun decks and open buffet lunches.', ARRAY['Boat Trips', 'Red Sea tours', 'Egypt excursions']::text[], 'published', 1),
('c1000000-0000-0000-0000-000000000002'::uuid, 'Snorkeling', 'snorkeling', 'Guided encounters with clownfish, rays, and sea turtles over vibrant shallow coral gardens.', 'https://images.unsplash.com/photo-1544551763-77ef2d0cfc6c?auto=format&fit=crop&w=600&q=80', 'Waves', 'Snorkeling in the Red Sea', 'Guided encounters with clownfish, rays, and sea turtles over vibrant shallow coral gardens.', ARRAY['Snorkeling', 'Red Sea tours', 'Egypt excursions']::text[], 'published', 2),
('c1000000-0000-0000-0000-000000000003'::uuid, 'Diving', 'diving', 'Certified 2-tank boat dives and beginner intro discovery dives led by PADI divemasters.', 'https://images.unsplash.com/photo-1544551763-92ab472cad5d?auto=format&fit=crop&w=600&q=80', 'Compass', 'Diving in the Red Sea', 'Certified 2-tank boat dives and beginner intro discovery dives led by PADI divemasters.', ARRAY['Diving', 'Red Sea tours', 'Egypt excursions']::text[], 'published', 3),
('c1000000-0000-0000-0000-000000000004'::uuid, 'Safari', 'safari', 'ATV quad biking through Red Sea mountain canyons, Bedouin camp visits, camel rides & stargazing.', 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=600&q=80', 'Sun', 'Safari in the Red Sea', 'ATV quad biking through Red Sea mountain canyons, Bedouin camp visits, camel rides & stargazing.', ARRAY['Safari', 'Red Sea tours', 'Egypt excursions']::text[], 'published', 4),
('c1000000-0000-0000-0000-000000000005'::uuid, 'Private Tours', 'private-tours', 'Tailored private yachts and high-speed RIBs for couples, families, and custom itineraries.', 'https://images.unsplash.com/photo-1569263979104-865ab7cd8d17?auto=format&fit=crop&w=600&q=80', 'Anchor', 'Private Tours in the Red Sea', 'Tailored private yachts and high-speed RIBs for couples, families, and custom itineraries.', ARRAY['Private Tours', 'Red Sea tours', 'Egypt excursions']::text[], 'published', 5),
('c1000000-0000-0000-0000-000000000006'::uuid, 'Water Sports', 'water-sports', 'Parasailing, glass-bottom boats, and banana boat adventures for the entire family.', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80', 'Waves', 'Water Sports in the Red Sea', 'Parasailing, glass-bottom boats, and banana boat adventures for the entire family.', ARRAY['Water Sports', 'Red Sea tours', 'Egypt excursions']::text[], 'published', 6)
ON CONFLICT DO NOTHING;

INSERT INTO public.pickup_locations (id,code,name,area,fee_eur_per_person,fee_eur_flat,description,is_active,sort_order)
VALUES
('b1000000-0000-0000-0000-000000000001'::uuid, 'hurghada', 'Hurghada Hotels', 'Hurghada (Mamsha, Dahar, Sheraton, Marina)', 0, 0, 'Free pickup from any hotel in Hurghada.', FALSE, 1),
('b1000000-0000-0000-0000-000000000002'::uuid, 'el-gouna', 'El Gouna', 'El Gouna Resorts & Marina', 5, 0, '+€5 per person (approx. 25-30 km north of Hurghada).', FALSE, 2),
('b1000000-0000-0000-0000-000000000003'::uuid, 'makadi-bay', 'Makadi Bay', 'Makadi Bay & Madinat Makadi', 5, 0, '+€5 per person (approx. 30 km south of Hurghada).', FALSE, 3),
('b1000000-0000-0000-0000-000000000004'::uuid, 'sahl-hasheesh', 'Sahl Hasheesh', 'Sahl Hasheesh Bay & Old Town', 5, 0, '+€5 per person (approx. 18 km south of Hurghada).', FALSE, 4),
('b1000000-0000-0000-0000-000000000005'::uuid, 'safaga', 'Safaga & Soma Bay', 'Port Safaga, Soma Bay Peninsula', 10, 0, '+€10 per person (approx. 50 km south of Hurghada).', FALSE, 5),
('b1000000-0000-0000-0000-000000000006'::uuid, 'marsa-alam', 'Marsa Alam', 'Marsa Alam / Port Ghalib (for local tours)', 10, 0, '+€10 per person for regional pickup.', FALSE, 6),
('b1000000-0000-0000-0000-000000000007'::uuid, 'sharm-el-sheikh', 'Sharm El-Sheikh Hotels', 'Naama Bay, Nabq, Sharks Bay, Hadaba, Ras Um Sid', 0, 0, 'Free lobby pickup from any hotel across Sharm El-Sheikh.', FALSE, 7)
ON CONFLICT DO NOTHING;

INSERT INTO public.tours (id,title,slug,short_description,description,destination_id,duration,duration_type,duration_hours,tour_type,status,featured,price,child_price,infant_price,private_price,currency,max_guests,minimum_booking_notice_hours,pickup_available,pickup_info,cancellation_policy,departure_time,available_days,languages,difficulty,age_restrictions,badge,rating,review_count,sort_order)
VALUES
('10000000-0000-0000-0000-000000000001'::uuid, 'Orange Bay Island & Snorkeling', 'orange-bay-island-snorkeling', 'Take a boat trip to Giftun Island’s Orange Bay beach with shallow turquoise water, two guided snorkeling stops at coral reefs, and buffet lunch onboard.', 'Spend a relaxing day sailing across the Red Sea to Giftun Island. Disembark at Orange Bay where wooden swings, shallow white sandbars, and shaded beanbag cabanas await. Enjoy two hours of island leisure before re-boarding for a freshly prepared buffet lunch and two distinct open-sea snorkeling sessions over living coral heads.', 'a1000000-0000-0000-0000-000000000001'::uuid, 'Full Day (approx. 7 hours)', 'Full Day', 7, 'Shared', 'published', TRUE, 35, 18, NULL, 260, 'EUR', 35, 12, TRUE, 'Complimentary lobby pickup from Hurghada hotels. Small supplement for El Gouna or Makadi Bay.', 'Free cancellation up to 24 hours prior to departure for a full refund.', '08:00 AM', ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']::text[], ARRAY['English', 'German', 'Italian', 'Romanian', 'Russian', 'French']::text[], 'Easy', NULL, 'Popular', 0, 0, 1),
('10000000-0000-0000-0000-000000000002'::uuid, 'Paradise Island Snorkeling Trip', 'paradise-island-snorkeling-trip', 'Sail to Paradise Beach on Giftun Island with white sand, parasols, folklore dance show, and two coral reef snorkeling stops.', 'Visit Paradise Beach on Giftun Island for a relaxing beach day. Enjoy 2.5 hours on the white sand with shaded parasols and calm water for swimming. The boat stops at two coral reefs along the way where guides help you spot reef fish, followed by a warm buffet lunch on the yacht.', 'a1000000-0000-0000-0000-000000000001'::uuid, 'Full Day (approx. 7 hours)', 'Full Day', 7, 'Shared', 'published', TRUE, 32, 16, NULL, 240, 'EUR', 35, 12, TRUE, 'Hotel lobby pickup included across Hurghada.', 'Free cancellation up to 24 hours prior to tour departure.', '08:30 AM', ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']::text[], ARRAY['English', 'German', 'Italian', 'Romanian']::text[], 'Easy', NULL, 'Great Value', 0, 0, 2),
('10000000-0000-0000-0000-000000000003'::uuid, 'Dolphin House Snorkeling', 'dolphin-house-snorkeling', 'Take a boat trip to Shaab El Erg reef to see wild dolphins in open water, with two coral snorkeling stops and lunch.', 'Shaab El Erg is a protected reef where pods of spinner dolphins rest and swim. We travel by comfortable boat to observe dolphins in their natural environment without chasing. Guided snorkeling stops follow over colorful coral reefs, with an open buffet lunch and water sports onboard.', 'a1000000-0000-0000-0000-000000000001'::uuid, 'Full Day (approx. 7.5 hours)', 'Full Day', 7.5, 'Shared', 'published', FALSE, 40, 20, NULL, 310, 'EUR', 30, 12, TRUE, 'Pickup from Hurghada resorts between 07:45 - 08:30 AM.', 'Free cancellation up to 24 hours prior to departure.', '08:00 AM', ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']::text[], ARRAY['English', 'German', 'Italian', 'Romanian', 'French', 'Russian']::text[], 'Easy', NULL, NULL, 0, 0, 3),
('10000000-0000-0000-0000-000000000004'::uuid, 'Giftun Island Boat Trip', 'giftun-island-boat-trip', 'The classic Red Sea boat trip featuring sandbar swimming on Giftun Island National Park, relaxing on sun decks, and snorkeling over living coral.', 'Giftun Island is the quintessential Red Sea excursion. Set out from the marina on a spacious double-decker boat, soak up the sun on open decks, and spend over an hour on the island’s sandy shores before heading to two prime snorkeling reefs.', 'a1000000-0000-0000-0000-000000000001'::uuid, 'Full Day (approx. 7 hours)', 'Full Day', 7, 'Shared', 'published', TRUE, 30, 15, NULL, 230, 'EUR', 35, 12, TRUE, 'Lobby pickup included.', 'Free cancellation up to 24 hours before tour start.', '08:30 AM', ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']::text[], ARRAY['English', 'German', 'Russian']::text[], 'Easy', NULL, 'Classic', 0, 0, 4),
('10000000-0000-0000-0000-000000000005'::uuid, 'Desert Quad Safari', 'desert-quad-safari', 'Ride a 250cc ATV quad bike across desert trails and mountain canyons. Includes test drive and Bedouin tea.', 'Drive a quad bike through the Eastern Desert near Hurghada. After a safety briefing and practice drive at the safari center, follow your guide through wide gravel trails and natural valleys framed by mountains. Stop at a Bedouin tent for herbal tea and rest before riding back.', 'a1000000-0000-0000-0000-000000000001'::uuid, 'Half Day (approx. 3.5 hours)', 'Half Day', 3.5, 'Shared', 'published', TRUE, 28, 15, NULL, 160, 'EUR', 20, 12, TRUE, 'Morning or afternoon departure options available.', 'Free cancellation up to 24 hours prior to departure.', '08:00 AM or 02:00 PM', ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']::text[], ARRAY['English', 'German', 'French', 'Russian']::text[], 'Adventurous', NULL, 'Adventure', 0, 0, 5),
('10000000-0000-0000-0000-000000000006'::uuid, 'Desert Safari & Bedouin Experience', 'desert-safari-bedouin-experience', 'Quad biking, spider dune buggy driving, camel ride, Bedouin village visit, BBQ dinner, and evening folklore show.', 'An afternoon and evening tour in the desert. Drive a quad bike and dune buggy, visit a Bedouin village to see how bread is baked on iron plates, ride a camel at sunset, and dine on an open-air barbecue buffet with music and folklore performances.', 'a1000000-0000-0000-0000-000000000001'::uuid, 'Half Day (approx. 5 hours)', 'Half Day', 5, 'Shared', 'published', TRUE, 35, 18, NULL, 210, 'EUR', 25, 12, TRUE, 'Afternoon pickup directly from hotel.', 'Free cancellation up to 24 hours before tour.', '01:30 PM', ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']::text[], ARRAY['English', 'German', 'Italian', 'French']::text[], 'Adventurous', NULL, 'Sunset Special', 0, 0, 6),
('10000000-0000-0000-0000-000000000007'::uuid, 'Private Red Sea Yacht', 'private-red-sea-yacht', 'Private yacht charter for up to 8 guests. Choose your stops, snorkel quiet reefs, and enjoy a freshly cooked lunch.', 'Rent a private yacht exclusively for your family or friends. Your captain coordinates the route according to your wishes—visit secluded sandbars, Orange Bay, or quiet snorkeling reefs away from crowds. The onboard cook prepares a fresh lunch while you swim and relax on the sun deck.', 'a1000000-0000-0000-0000-000000000001'::uuid, 'Full Day (approx. 8 hours)', 'Full Day', 8, 'Private', 'published', TRUE, 250, 0, NULL, 250, 'EUR', 8, 12, TRUE, 'Custom pickup time available between 08:30 and 10:00 AM.', 'Free cancellation up to 48 hours prior to charter.', '09:00 AM (Flexible)', ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']::text[], ARRAY['English', 'German', 'Arabic', 'French']::text[], 'Easy', NULL, 'VIP Private', 0, 0, 7),
('10000000-0000-0000-0000-000000000008'::uuid, 'El Gouna Private Boat Trip', 'el-gouna-private-boat-trip', 'Private cruiser departing Abu Tig Marina. Cruise through El Gouna channels, visit quiet northern reefs, and relax on sandbars.', 'Depart directly from Abu Tig Marina in El Gouna on a private boat for up to 6 guests. Cruise along lagoon waterways into open water to snorkel northern reefs known for clear visibility and marine life. Includes soft drinks, fruit platter, and snorkeling gear.', 'a1000000-0000-0000-0000-000000000002'::uuid, 'Full Day (approx. 6 hours)', 'Full Day', 6, 'Private', 'published', TRUE, 220, 0, NULL, 220, 'EUR', 6, 12, TRUE, 'Pickup from all El Gouna hotels included.', 'Free cancellation up to 24 hours prior to departure.', '09:30 AM', ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']::text[], ARRAY['English', 'German']::text[], 'Easy', NULL, 'Boutique', 0, 0, 8),
('10000000-0000-0000-0000-000000000009'::uuid, 'Introductory Scuba Diving Experience', 'introductory-scuba-diving-experience', 'No license needed. Try scuba diving with a certified PADI instructor by your side. Includes 2 shallow boat dives and lunch.', 'Designed for complete beginners who want to try scuba diving safely. On the cruise out, your instructor explains breathing, equalizing, and hand signals. You do two separate 20-minute shallow dives (max 6-7 meters) with your instructor holding your hand throughout. Between dives, relax on the sun deck and enjoy lunch.', 'a1000000-0000-0000-0000-000000000001'::uuid, 'Full Day (approx. 8 hours)', 'Full Day', 8, 'Shared', 'published', TRUE, 65, 45, NULL, 340, 'EUR', 15, 12, TRUE, 'Pickup from Hurghada hotels around 08:00 AM.', 'Free cancellation up to 24 hours prior to departure.', '08:00 AM', ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']::text[], ARRAY['English', 'German', 'Russian', 'French']::text[], 'Moderate', 'Minimum age 10 years', 'Instructor Led', 0, 0, 9),
('10000000-0000-0000-0000-000000000010'::uuid, 'Marsa Alam Dolphin House', 'marsa-alam-dolphin-house', 'Sail to the protected Sha’ab Samadai marine reserve to snorkel near wild dolphins in calm natural lagoons.', 'Sha’ab Samadai is a protected marine reserve in southern Egypt where families of spinner dolphins rest in natural lagoons. Snorkel in the designated lagoon zone with marine guides, then explore outer coral drop-offs. Includes hotel pickup across Marsa Alam and lunch onboard.', 'a1000000-0000-0000-0000-000000000007'::uuid, 'Full Day (approx. 8 hours)', 'Full Day', 8, 'Shared', 'published', TRUE, 55, 28, NULL, 380, 'EUR', 25, 12, TRUE, 'Lobby pickup from Marsa Alam hotels.', 'Free cancellation up to 24 hours prior to departure.', '07:30 AM', ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']::text[], ARRAY['English', 'German', 'Italian']::text[], 'Easy', NULL, 'Marine Reserve', 0, 0, 10),
('10000000-0000-0000-0000-000000000011'::uuid, 'Sharm El Naga Beach & Snorkeling Day', 'sharm-el-naga-beach-reef-day', 'Snorkel straight from a sandy beach without a boat. Includes private bay entry, sun loungers, swimming pool, and lunch.', 'Sharm El Naga is a protected bay south of Hurghada where coral reefs grow just a few meters from the shore. Ideal for families, children, and travelers who prefer walking into the water from the beach rather than taking a boat. Loungers, freshwater pool, and restaurant buffet lunch are included.', 'a1000000-0000-0000-0000-000000000005'::uuid, 'Full Day (approx. 7 hours)', 'Full Day', 7, 'Shared', 'published', TRUE, 38, 20, NULL, 220, 'EUR', 30, 12, TRUE, 'Pickup from Hurghada, Sahl Hasheesh, and Makadi Bay hotels.', 'Free cancellation up to 24 hours prior to departure.', '08:30 AM', ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']::text[], ARRAY['English', 'German']::text[], 'Easy', NULL, 'Shore Entry', 0, 0, 11),
('10000000-0000-0000-0000-000000000012'::uuid, 'Sahl Hasheesh Glass Bottom Boat', 'sahl-hasheesh-glass-bottom-boat', 'View corals and fish through underwater glass windows without getting wet. Sail past sunken pillars with an optional swim stop.', 'Great for children, non-swimmers, and anyone wanting a short 2.5-hour trip. Look through deep panoramic glass panels to watch coral reefs and marine life in calm bay waters. Includes a short swimming stop and hotel transfer.', 'a1000000-0000-0000-0000-000000000004'::uuid, 'Half Day (approx. 2.5 hours)', 'Half Day', 2.5, 'Shared', 'published', TRUE, 25, 12, NULL, 140, 'EUR', 25, 12, TRUE, 'Pickup from Sahl Hasheesh, Makadi Bay, and Hurghada.', 'Free cancellation up to 24 hours prior to departure.', '10:00 AM or 02:00 PM', ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']::text[], ARRAY['English', 'German', 'Russian']::text[], 'Easy', NULL, 'Family Favorite', 0, 0, 12),
('10000000-0000-0000-0000-000000000013'::uuid, 'Ras Mohammed National Park & White Island Luxury Yacht Cruise', 'ras-mohammed-white-island-cruise', 'Cruise through the marine sanctuary of Ras Mohammed National Park, step onto the crystal sandbar of White Island, snorkel coral walls, and enjoy an onboard seafood buffet.', 'Sail along the dramatic coastline of South Sinai into the protected marine sanctuary of Ras Mohammed National Park. Cruise to the famous White Island sandbar, explore vibrant coral reef walls, and enjoy a freshly prepared open seafood & grill buffet onboard.', 'a1000000-0000-0000-0000-000000000006'::uuid, 'Full Day (approx. 8 hours)', 'Full Day', 8, 'Shared', 'published', FALSE, 45, 25, NULL, 380, 'EUR', 30, 12, TRUE, 'Complimentary lobby pickup from all hotels in Sharm El-Sheikh (Naama Bay, Nabq, Sharks Bay, Hadaba, Ras Um Sid).', 'Free cancellation up to 24 hours prior to departure with 100% refund.', '08:00 AM', ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']::text[], ARRAY['English', 'German', 'Russian', 'Italian']::text[], 'Easy', NULL, NULL, 0, 0, 13)
ON CONFLICT DO NOTHING;

INSERT INTO public.tour_categories (tour_id,category_id,sort_order)
VALUES
('10000000-0000-0000-0000-000000000001'::uuid, 'c1000000-0000-0000-0000-000000000001'::uuid, 1),
('10000000-0000-0000-0000-000000000001'::uuid, 'c1000000-0000-0000-0000-000000000002'::uuid, 2),
('10000000-0000-0000-0000-000000000002'::uuid, 'c1000000-0000-0000-0000-000000000001'::uuid, 1),
('10000000-0000-0000-0000-000000000002'::uuid, 'c1000000-0000-0000-0000-000000000002'::uuid, 2),
('10000000-0000-0000-0000-000000000003'::uuid, 'c1000000-0000-0000-0000-000000000002'::uuid, 1),
('10000000-0000-0000-0000-000000000003'::uuid, 'c1000000-0000-0000-0000-000000000001'::uuid, 2),
('10000000-0000-0000-0000-000000000004'::uuid, 'c1000000-0000-0000-0000-000000000001'::uuid, 1),
('10000000-0000-0000-0000-000000000005'::uuid, 'c1000000-0000-0000-0000-000000000004'::uuid, 1),
('10000000-0000-0000-0000-000000000006'::uuid, 'c1000000-0000-0000-0000-000000000004'::uuid, 1),
('10000000-0000-0000-0000-000000000007'::uuid, 'c1000000-0000-0000-0000-000000000005'::uuid, 1),
('10000000-0000-0000-0000-000000000007'::uuid, 'c1000000-0000-0000-0000-000000000001'::uuid, 2),
('10000000-0000-0000-0000-000000000008'::uuid, 'c1000000-0000-0000-0000-000000000005'::uuid, 1),
('10000000-0000-0000-0000-000000000008'::uuid, 'c1000000-0000-0000-0000-000000000001'::uuid, 2),
('10000000-0000-0000-0000-000000000009'::uuid, 'c1000000-0000-0000-0000-000000000003'::uuid, 1),
('10000000-0000-0000-0000-000000000009'::uuid, 'c1000000-0000-0000-0000-000000000001'::uuid, 2),
('10000000-0000-0000-0000-000000000010'::uuid, 'c1000000-0000-0000-0000-000000000002'::uuid, 1),
('10000000-0000-0000-0000-000000000010'::uuid, 'c1000000-0000-0000-0000-000000000001'::uuid, 2),
('10000000-0000-0000-0000-000000000011'::uuid, 'c1000000-0000-0000-0000-000000000002'::uuid, 1),
('10000000-0000-0000-0000-000000000011'::uuid, 'c1000000-0000-0000-0000-000000000001'::uuid, 2),
('10000000-0000-0000-0000-000000000012'::uuid, 'c1000000-0000-0000-0000-000000000006'::uuid, 1),
('10000000-0000-0000-0000-000000000012'::uuid, 'c1000000-0000-0000-0000-000000000001'::uuid, 2),
('10000000-0000-0000-0000-000000000013'::uuid, 'c1000000-0000-0000-0000-000000000001'::uuid, 1),
('10000000-0000-0000-0000-000000000013'::uuid, 'c1000000-0000-0000-0000-000000000002'::uuid, 2)
ON CONFLICT DO NOTHING;

INSERT INTO public.tour_images (id,tour_id,image_url,alt_text,caption,is_primary,sort_order) VALUES
('20000000-0000-4000-8000-000000000001'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80', 'Illustrative stock photo for Orange Bay Island & Snorkeling', 'Illustrative stock photo; replace with operator-approved photography before publication.', TRUE, 1),
('20000000-0000-4000-8000-000000000002'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'https://images.unsplash.com/photo-1544551763-77ef2d0cfc6c?auto=format&fit=crop&w=1200&q=80', 'Illustrative stock photo for Orange Bay Island & Snorkeling', 'Illustrative stock photo; replace with operator-approved photography before publication.', FALSE, 2),
('20000000-0000-4000-8000-000000000003'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80', 'Illustrative stock photo for Orange Bay Island & Snorkeling', 'Illustrative stock photo; replace with operator-approved photography before publication.', FALSE, 3),
('20000000-0000-4000-8000-000000000004'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=1200&q=80', 'Illustrative stock photo for Orange Bay Island & Snorkeling', 'Illustrative stock photo; replace with operator-approved photography before publication.', FALSE, 4),
('20000000-0000-4000-8000-000000000005'::uuid, '10000000-0000-0000-0000-000000000002'::uuid, 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80', 'Illustrative stock photo for Paradise Island Snorkeling Trip', 'Illustrative stock photo; replace with operator-approved photography before publication.', TRUE, 1),
('20000000-0000-4000-8000-000000000006'::uuid, '10000000-0000-0000-0000-000000000002'::uuid, 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80', 'Illustrative stock photo for Paradise Island Snorkeling Trip', 'Illustrative stock photo; replace with operator-approved photography before publication.', FALSE, 2),
('20000000-0000-4000-8000-000000000007'::uuid, '10000000-0000-0000-0000-000000000002'::uuid, 'https://images.unsplash.com/photo-1544551763-77ef2d0cfc6c?auto=format&fit=crop&w=1200&q=80', 'Illustrative stock photo for Paradise Island Snorkeling Trip', 'Illustrative stock photo; replace with operator-approved photography before publication.', FALSE, 3),
('20000000-0000-4000-8000-000000000008'::uuid, '10000000-0000-0000-0000-000000000003'::uuid, 'https://images.unsplash.com/photo-1544551763-77ef2d0cfc6c?auto=format&fit=crop&w=1200&q=80', 'Illustrative stock photo for Dolphin House Snorkeling', 'Illustrative stock photo; replace with operator-approved photography before publication.', TRUE, 1),
('20000000-0000-4000-8000-000000000009'::uuid, '10000000-0000-0000-0000-000000000003'::uuid, 'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?auto=format&fit=crop&w=1200&q=80', 'Illustrative stock photo for Dolphin House Snorkeling', 'Illustrative stock photo; replace with operator-approved photography before publication.', FALSE, 2),
('20000000-0000-4000-8000-000000000010'::uuid, '10000000-0000-0000-0000-000000000003'::uuid, 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80', 'Illustrative stock photo for Dolphin House Snorkeling', 'Illustrative stock photo; replace with operator-approved photography before publication.', FALSE, 3),
('20000000-0000-4000-8000-000000000011'::uuid, '10000000-0000-0000-0000-000000000004'::uuid, 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80', 'Illustrative stock photo for Giftun Island Boat Trip', 'Illustrative stock photo; replace with operator-approved photography before publication.', TRUE, 1),
('20000000-0000-4000-8000-000000000012'::uuid, '10000000-0000-0000-0000-000000000004'::uuid, 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80', 'Illustrative stock photo for Giftun Island Boat Trip', 'Illustrative stock photo; replace with operator-approved photography before publication.', FALSE, 2),
('20000000-0000-4000-8000-000000000013'::uuid, '10000000-0000-0000-0000-000000000005'::uuid, 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=1200&q=80', 'Illustrative stock photo for Desert Quad Safari', 'Illustrative stock photo; replace with operator-approved photography before publication.', TRUE, 1),
('20000000-0000-4000-8000-000000000014'::uuid, '10000000-0000-0000-0000-000000000005'::uuid, 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80', 'Illustrative stock photo for Desert Quad Safari', 'Illustrative stock photo; replace with operator-approved photography before publication.', FALSE, 2),
('20000000-0000-4000-8000-000000000015'::uuid, '10000000-0000-0000-0000-000000000006'::uuid, 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80', 'Illustrative stock photo for Desert Safari & Bedouin Experience', 'Illustrative stock photo; replace with operator-approved photography before publication.', TRUE, 1),
('20000000-0000-4000-8000-000000000016'::uuid, '10000000-0000-0000-0000-000000000006'::uuid, 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=1200&q=80', 'Illustrative stock photo for Desert Safari & Bedouin Experience', 'Illustrative stock photo; replace with operator-approved photography before publication.', FALSE, 2),
('20000000-0000-4000-8000-000000000017'::uuid, '10000000-0000-0000-0000-000000000007'::uuid, 'https://images.unsplash.com/photo-1569263979104-865ab7cd8d17?auto=format&fit=crop&w=1200&q=80', 'Illustrative stock photo for Private Red Sea Yacht', 'Illustrative stock photo; replace with operator-approved photography before publication.', TRUE, 1),
('20000000-0000-4000-8000-000000000018'::uuid, '10000000-0000-0000-0000-000000000007'::uuid, 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80', 'Illustrative stock photo for Private Red Sea Yacht', 'Illustrative stock photo; replace with operator-approved photography before publication.', FALSE, 2),
('20000000-0000-4000-8000-000000000019'::uuid, '10000000-0000-0000-0000-000000000008'::uuid, 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=1200&q=80', 'Illustrative stock photo for El Gouna Private Boat Trip', 'Illustrative stock photo; replace with operator-approved photography before publication.', TRUE, 1),
('20000000-0000-4000-8000-000000000020'::uuid, '10000000-0000-0000-0000-000000000008'::uuid, 'https://images.unsplash.com/photo-1569263979104-865ab7cd8d17?auto=format&fit=crop&w=1200&q=80', 'Illustrative stock photo for El Gouna Private Boat Trip', 'Illustrative stock photo; replace with operator-approved photography before publication.', FALSE, 2),
('20000000-0000-4000-8000-000000000021'::uuid, '10000000-0000-0000-0000-000000000009'::uuid, 'https://images.unsplash.com/photo-1544551763-92ab472cad5d?auto=format&fit=crop&w=1200&q=80', 'Illustrative stock photo for Introductory Scuba Diving Experience', 'Illustrative stock photo; replace with operator-approved photography before publication.', TRUE, 1),
('20000000-0000-4000-8000-000000000022'::uuid, '10000000-0000-0000-0000-000000000009'::uuid, 'https://images.unsplash.com/photo-1544551763-77ef2d0cfc6c?auto=format&fit=crop&w=1200&q=80', 'Illustrative stock photo for Introductory Scuba Diving Experience', 'Illustrative stock photo; replace with operator-approved photography before publication.', FALSE, 2),
('20000000-0000-4000-8000-000000000023'::uuid, '10000000-0000-0000-0000-000000000010'::uuid, 'https://images.unsplash.com/photo-1682687220063-4742bd7fd538?auto=format&fit=crop&w=1200&q=80', 'Illustrative stock photo for Marsa Alam Dolphin House', 'Illustrative stock photo; replace with operator-approved photography before publication.', TRUE, 1),
('20000000-0000-4000-8000-000000000024'::uuid, '10000000-0000-0000-0000-000000000010'::uuid, 'https://images.unsplash.com/photo-1544551763-77ef2d0cfc6c?auto=format&fit=crop&w=1200&q=80', 'Illustrative stock photo for Marsa Alam Dolphin House', 'Illustrative stock photo; replace with operator-approved photography before publication.', FALSE, 2),
('20000000-0000-4000-8000-000000000025'::uuid, '10000000-0000-0000-0000-000000000011'::uuid, 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80', 'Illustrative stock photo for Sharm El Naga Beach & Snorkeling Day', 'Illustrative stock photo; replace with operator-approved photography before publication.', TRUE, 1),
('20000000-0000-4000-8000-000000000026'::uuid, '10000000-0000-0000-0000-000000000011'::uuid, 'https://images.unsplash.com/photo-1544551763-77ef2d0cfc6c?auto=format&fit=crop&w=1200&q=80', 'Illustrative stock photo for Sharm El Naga Beach & Snorkeling Day', 'Illustrative stock photo; replace with operator-approved photography before publication.', FALSE, 2),
('20000000-0000-4000-8000-000000000027'::uuid, '10000000-0000-0000-0000-000000000012'::uuid, 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80', 'Illustrative stock photo for Sahl Hasheesh Glass Bottom Boat', 'Illustrative stock photo; replace with operator-approved photography before publication.', TRUE, 1),
('20000000-0000-4000-8000-000000000028'::uuid, '10000000-0000-0000-0000-000000000013'::uuid, 'https://images.unsplash.com/photo-1544551763-77ef2d0cfc6c?auto=format&fit=crop&w=1200&q=80', 'Illustrative stock photo for Ras Mohammed National Park & White Island Luxury Yacht Cruise', 'Illustrative stock photo; replace with operator-approved photography before publication.', TRUE, 1),
('20000000-0000-4000-8000-000000000029'::uuid, '10000000-0000-0000-0000-000000000013'::uuid, 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80', 'Illustrative stock photo for Ras Mohammed National Park & White Island Luxury Yacht Cruise', 'Illustrative stock photo; replace with operator-approved photography before publication.', FALSE, 2),
('20000000-0000-4000-8000-000000000030'::uuid, '10000000-0000-0000-0000-000000000013'::uuid, 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80', 'Illustrative stock photo for Ras Mohammed National Park & White Island Luxury Yacht Cruise', 'Illustrative stock photo; replace with operator-approved photography before publication.', FALSE, 3),
('20000000-0000-4000-8000-000000000031'::uuid, '10000000-0000-0000-0000-000000000013'::uuid, 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=1200&q=80', 'Illustrative stock photo for Ras Mohammed National Park & White Island Luxury Yacht Cruise', 'Illustrative stock photo; replace with operator-approved photography before publication.', FALSE, 4)
ON CONFLICT DO NOTHING;

INSERT INTO public.tour_itinerary (id,tour_id,time,title,description,sort_order) VALUES
('30000000-0000-4000-8000-000000000001'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, '08:00', 'Hotel pickup', 'Air-conditioned transfer from your resort lobby to Hurghada Marina.', 1),
('30000000-0000-4000-8000-000000000002'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, '09:00', 'Departure from marina', 'Safety briefing and scenic sail across the Red Sea toward Giftun Island.', 2),
('30000000-0000-4000-8000-000000000003'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, '10:00', 'First snorkeling stop', 'Guided reef snorkeling session observing parrotfish, rays, and clownfish.', 3),
('30000000-0000-4000-8000-000000000004'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, '12:30', 'Lunch onboard', 'Warm buffet lunch with fish, chicken, rice, salads, and seasonal fruits.', 4),
('30000000-0000-4000-8000-000000000005'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, '14:00', 'Island beach time', 'Disembark at Orange Bay for relaxation, photography, and swimming in shallow lagoons.', 5),
('30000000-0000-4000-8000-000000000006'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, '16:30', 'Return to marina', 'Leisurely cruise back as afternoon sun reflects on coastal mountains.', 6),
('30000000-0000-4000-8000-000000000007'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, '17:00', 'Hotel drop-off', 'Return transfer back to your hotel lobby.', 7),
('30000000-0000-4000-8000-000000000008'::uuid, '10000000-0000-0000-0000-000000000002'::uuid, '08:30', 'Hotel pickup', 'Pickup from hotel and transfer to the pier.', 1),
('30000000-0000-4000-8000-000000000009'::uuid, '10000000-0000-0000-0000-000000000002'::uuid, '09:30', 'Boat departure', 'Cruise across the Red Sea towards Giftun Island.', 2),
('30000000-0000-4000-8000-000000000010'::uuid, '10000000-0000-0000-0000-000000000002'::uuid, '10:30', 'Reef snorkeling stop', '45 minutes over living coral formations.', 3),
('30000000-0000-4000-8000-000000000011'::uuid, '10000000-0000-0000-0000-000000000002'::uuid, '12:00', 'Paradise Beach leisure', 'Sunbathing, beach volleyball, and optional beach bar refreshments.', 4),
('30000000-0000-4000-8000-000000000012'::uuid, '10000000-0000-0000-0000-000000000002'::uuid, '14:30', 'Lunch onboard', 'Fresh buffet served in shaded dining salon.', 5),
('30000000-0000-4000-8000-000000000013'::uuid, '10000000-0000-0000-0000-000000000002'::uuid, '15:30', 'Second snorkeling session', 'Exploring shallow reef pinnacles.', 6),
('30000000-0000-4000-8000-000000000014'::uuid, '10000000-0000-0000-0000-000000000002'::uuid, '17:00', 'Return to hotel', 'Docking and transfer back to hotel.', 7),
('30000000-0000-4000-8000-000000000015'::uuid, '10000000-0000-0000-0000-000000000003'::uuid, '08:00', 'Hotel pickup', 'Air-conditioned transfer from your resort.', 1),
('30000000-0000-4000-8000-000000000016'::uuid, '10000000-0000-0000-0000-000000000003'::uuid, '09:00', 'Departure from marina', 'Cruising toward Shaab El Erg reef.', 2),
('30000000-0000-4000-8000-000000000017'::uuid, '10000000-0000-0000-0000-000000000003'::uuid, '10:30', 'Dolphin observation lagoon', 'Search and swimming opportunities near dolphin pods.', 3),
('30000000-0000-4000-8000-000000000018'::uuid, '10000000-0000-0000-0000-000000000003'::uuid, '12:30', 'Lunch onboard', 'Fresh hot buffet prepared by onboard chef.', 4),
('30000000-0000-4000-8000-000000000019'::uuid, '10000000-0000-0000-0000-000000000003'::uuid, '13:45', 'Reef snorkeling stop', 'Guided exploration of vibrant coral walls.', 5),
('30000000-0000-4000-8000-000000000020'::uuid, '10000000-0000-0000-0000-000000000003'::uuid, '15:15', 'Water sports fun', 'Banana boat and sofa ride behind speedboat.', 6),
('30000000-0000-4000-8000-000000000021'::uuid, '10000000-0000-0000-0000-000000000003'::uuid, '16:30', 'Return to marina', 'Disembarkation and hotel transfer.', 7),
('30000000-0000-4000-8000-000000000022'::uuid, '10000000-0000-0000-0000-000000000004'::uuid, '08:30', 'Pickup from hotel', 'Lobby pickup and transfer to boat pier.', 1),
('30000000-0000-4000-8000-000000000023'::uuid, '10000000-0000-0000-0000-000000000004'::uuid, '09:30', 'Cruise departure', 'Scenic sail across calm coastal waters.', 2),
('30000000-0000-4000-8000-000000000024'::uuid, '10000000-0000-0000-0000-000000000004'::uuid, '11:00', 'Giftun Island stop', 'Swim and relax on the sandy beach.', 3),
('30000000-0000-4000-8000-000000000025'::uuid, '10000000-0000-0000-0000-000000000004'::uuid, '13:00', 'Buffet lunch', 'Warm lunch onboard.', 4),
('30000000-0000-4000-8000-000000000026'::uuid, '10000000-0000-0000-0000-000000000004'::uuid, '14:15', 'Reef snorkeling', 'Exploring colorful coral gardens.', 5),
('30000000-0000-4000-8000-000000000027'::uuid, '10000000-0000-0000-0000-000000000004'::uuid, '16:00', 'Return cruise', 'Sail back to Hurghada pier.', 6),
('30000000-0000-4000-8000-000000000028'::uuid, '10000000-0000-0000-0000-000000000005'::uuid, '08:00 or 14:00', 'Hotel pickup', 'Air-conditioned transfer to desert base station.', 1),
('30000000-0000-4000-8000-000000000029'::uuid, '10000000-0000-0000-0000-000000000005'::uuid, '08:45 or 14:45', 'Safety briefing & test drive', 'Learn controls and practice in enclosed training yard.', 2),
('30000000-0000-4000-8000-000000000030'::uuid, '10000000-0000-0000-0000-000000000005'::uuid, '09:15 or 15:15', 'Quad trail ride', 'Guided convoy across wide sand plains and rocky valleys.', 3),
('30000000-0000-4000-8000-000000000031'::uuid, '10000000-0000-0000-0000-000000000005'::uuid, '10:30 or 16:30', 'Bedouin tent break', 'Rest, herbal tea, and photo opportunities.', 4),
('30000000-0000-4000-8000-000000000032'::uuid, '10000000-0000-0000-0000-000000000005'::uuid, '11:15 or 17:15', 'Return ride & hotel drop-off', 'Ride back to safari center and transfer to hotel.', 5),
('30000000-0000-4000-8000-000000000033'::uuid, '10000000-0000-0000-0000-000000000006'::uuid, '13:30', 'Hotel pickup', 'Transfer from resort lobby to safari station.', 1),
('30000000-0000-4000-8000-000000000034'::uuid, '10000000-0000-0000-0000-000000000006'::uuid, '14:30', 'Quad & buggy drives', 'Action-packed driving across desert trails.', 2),
('30000000-0000-4000-8000-000000000035'::uuid, '10000000-0000-0000-0000-000000000006'::uuid, '16:00', 'Bedouin village arrival', 'Tour village, pharmacy, and taste fresh flatbread.', 3),
('30000000-0000-4000-8000-000000000036'::uuid, '10000000-0000-0000-0000-000000000006'::uuid, '17:00', 'Sunset camel ride', 'Scenic ride as sun sinks behind mountain ridge.', 4),
('30000000-0000-4000-8000-000000000037'::uuid, '10000000-0000-0000-0000-000000000006'::uuid, '18:00', 'BBQ dinner & show', 'Open-air buffet dinner and folkloric show.', 5),
('30000000-0000-4000-8000-000000000038'::uuid, '10000000-0000-0000-0000-000000000006'::uuid, '19:30', 'Return transfer', 'Drop-off at your hotel.', 6),
('30000000-0000-4000-8000-000000000039'::uuid, '10000000-0000-0000-0000-000000000007'::uuid, '09:00', 'Private hotel transfer', 'Direct pickup in private executive vehicle.', 1),
('30000000-0000-4000-8000-000000000040'::uuid, '10000000-0000-0000-0000-000000000007'::uuid, '09:45', 'Boarding & captain consultation', 'Discuss preferred stops and customize your itinerary.', 2),
('30000000-0000-4000-8000-000000000041'::uuid, '10000000-0000-0000-0000-000000000007'::uuid, '10:30', 'Secluded reef snorkeling', 'Anchor at quiet reef away from group boats.', 3),
('30000000-0000-4000-8000-000000000042'::uuid, '10000000-0000-0000-0000-000000000007'::uuid, '13:00', 'Fresh gourmet lunch', 'Seafood and barbecue prepared by private cook.', 4),
('30000000-0000-4000-8000-000000000043'::uuid, '10000000-0000-0000-0000-000000000007'::uuid, '14:30', 'Sandbar or island stop', 'Swim in shallow turquoise waters at your leisure.', 5),
('30000000-0000-4000-8000-000000000044'::uuid, '10000000-0000-0000-0000-000000000007'::uuid, '16:45', 'Sunset cruise to marina', 'Champagne or fresh juice toast during return sail.', 6),
('30000000-0000-4000-8000-000000000045'::uuid, '10000000-0000-0000-0000-000000000008'::uuid, '09:30', 'Pickup or Marina meet', 'Meet captain at Abu Tig Marina Berth 4.', 1),
('30000000-0000-4000-8000-000000000046'::uuid, '10000000-0000-0000-0000-000000000008'::uuid, '10:00', 'Lagoon & coastal cruise', 'Scenic pass through El Gouna channels.', 2),
('30000000-0000-4000-8000-000000000047'::uuid, '10000000-0000-0000-0000-000000000008'::uuid, '11:00', 'First reef stop', 'Snorkeling over pristine northern corals.', 3),
('30000000-0000-4000-8000-000000000048'::uuid, '10000000-0000-0000-0000-000000000008'::uuid, '13:00', 'Sandbar lunch break', 'Sandwiches, fresh fruit platter, and cold drinks.', 4),
('30000000-0000-4000-8000-000000000049'::uuid, '10000000-0000-0000-0000-000000000008'::uuid, '14:30', 'Second snorkeling stop', 'Search for turtles and rays in calm waters.', 5),
('30000000-0000-4000-8000-000000000050'::uuid, '10000000-0000-0000-0000-000000000008'::uuid, '16:00', 'Return to Abu Tig Marina', 'Docking and transfer.', 6),
('30000000-0000-4000-8000-000000000051'::uuid, '10000000-0000-0000-0000-000000000009'::uuid, '08:00', 'Hotel transfer', 'Pickup and transfer to dive boat.', 1),
('30000000-0000-4000-8000-000000000052'::uuid, '10000000-0000-0000-0000-000000000009'::uuid, '09:00', 'Departure & theory briefing', 'Instructor explains breathing, equalization, and hand signals.', 2),
('30000000-0000-4000-8000-000000000053'::uuid, '10000000-0000-0000-0000-000000000009'::uuid, '10:30', 'First introductory dive', '20 minutes hand-in-hand underwater at shallow reef.', 3),
('30000000-0000-4000-8000-000000000054'::uuid, '10000000-0000-0000-0000-000000000009'::uuid, '12:30', 'Buffet lunch onboard', 'Rest on sun deck and enjoy warm lunch.', 4),
('30000000-0000-4000-8000-000000000055'::uuid, '10000000-0000-0000-0000-000000000009'::uuid, '14:00', 'Second dive or snorkeling', 'Second guided dive exploring coral pinnacle.', 5),
('30000000-0000-4000-8000-000000000056'::uuid, '10000000-0000-0000-0000-000000000009'::uuid, '16:30', 'Return to harbor', 'Docking and transfer back to hotel.', 6),
('30000000-0000-4000-8000-000000000057'::uuid, '10000000-0000-0000-0000-000000000010'::uuid, '07:30', 'Hotel pickup', 'Transfer to Marsa Alam marina pier.', 1),
('30000000-0000-4000-8000-000000000058'::uuid, '10000000-0000-0000-0000-000000000010'::uuid, '08:30', 'Sail to Samadai Reef', 'Cruising toward the offshore horseshoe reef.', 2),
('30000000-0000-4000-8000-000000000059'::uuid, '10000000-0000-0000-0000-000000000010'::uuid, '10:00', 'First dolphin snorkeling', 'Snorkeling in the designated tourist zone of Samadai.', 3),
('30000000-0000-4000-8000-000000000060'::uuid, '10000000-0000-0000-0000-000000000010'::uuid, '12:30', 'Buffet lunch onboard', 'Warm lunch served on the boat.', 4),
('30000000-0000-4000-8000-000000000061'::uuid, '10000000-0000-0000-0000-000000000010'::uuid, '14:00', 'Second coral reef stop', 'Explore steep coral walls on the outer reef.', 5),
('30000000-0000-4000-8000-000000000062'::uuid, '10000000-0000-0000-0000-000000000010'::uuid, '16:00', 'Return to marina', 'Transfer back to hotel.', 6),
('30000000-0000-4000-8000-000000000063'::uuid, '10000000-0000-0000-0000-000000000011'::uuid, '08:30', 'Hotel transfer', 'Air-conditioned transfer to Sharm El Naga bay.', 1),
('30000000-0000-4000-8000-000000000064'::uuid, '10000000-0000-0000-0000-000000000011'::uuid, '09:30', 'Beach arrival & briefing', 'Settle into loungers and receive snorkeling equipment.', 2),
('30000000-0000-4000-8000-000000000065'::uuid, '10000000-0000-0000-0000-000000000011'::uuid, '10:30', 'Guided shore snorkeling', 'Explore the drop-off with guide.', 3),
('30000000-0000-4000-8000-000000000066'::uuid, '10000000-0000-0000-0000-000000000011'::uuid, '13:00', 'Beachfront buffet lunch', 'Hot lunch at the reserve restaurant.', 4),
('30000000-0000-4000-8000-000000000067'::uuid, '10000000-0000-0000-0000-000000000011'::uuid, '14:30', 'Free beach & pool time', 'Relaxation and secondary snorkeling.', 5),
('30000000-0000-4000-8000-000000000068'::uuid, '10000000-0000-0000-0000-000000000011'::uuid, '16:00', 'Return transfer', 'Drop-off at your hotel.', 6),
('30000000-0000-4000-8000-000000000069'::uuid, '10000000-0000-0000-0000-000000000012'::uuid, '10:00 or 14:00', 'Hotel pickup', 'Transfer to Sahl Hasheesh pier.', 1),
('30000000-0000-4000-8000-000000000070'::uuid, '10000000-0000-0000-0000-000000000012'::uuid, '10:30 or 14:30', 'Boarding & glass viewing', 'Cruise over living reefs and sunken columns.', 2),
('30000000-0000-4000-8000-000000000071'::uuid, '10000000-0000-0000-0000-000000000012'::uuid, '11:45 or 15:45', 'Optional swim stop', 'Jump into shallow calm water or stay on sun deck.', 3),
('30000000-0000-4000-8000-000000000072'::uuid, '10000000-0000-0000-0000-000000000012'::uuid, '12:30 or 16:30', 'Return transfer', 'Back to hotel.', 4),
('30000000-0000-4000-8000-000000000073'::uuid, '10000000-0000-0000-0000-000000000013'::uuid, '08:00', 'Hotel Pickup', 'Air-conditioned transfer from your Sharm resort to the marina.', 1),
('30000000-0000-4000-8000-000000000074'::uuid, '10000000-0000-0000-0000-000000000013'::uuid, '09:00', 'Yacht Departure', 'Welcome briefing, safety orientation, and cruise out towards South Sinai.', 2),
('30000000-0000-4000-8000-000000000075'::uuid, '10000000-0000-0000-0000-000000000013'::uuid, '10:30', 'First Snorkeling Session', 'Guided exploration along protected coral reef walls with clownfish and sea turtles.', 3),
('30000000-0000-4000-8000-000000000076'::uuid, '10000000-0000-0000-0000-000000000013'::uuid, '12:00', 'White Island Sandbar Stop', 'Tender boat transfer to the turquoise shallows and sandbar of White Island.', 4),
('30000000-0000-4000-8000-000000000077'::uuid, '10000000-0000-0000-0000-000000000013'::uuid, '13:30', 'Fresh Buffet Lunch Onboard', 'Generous open buffet featuring grilled fish, chicken, pastas, and oriental mezze.', 5),
('30000000-0000-4000-8000-000000000078'::uuid, '10000000-0000-0000-0000-000000000013'::uuid, '14:45', 'Second Snorkeling Stop', 'Afternoon swim among sea fans and schooling anthias.', 6),
('30000000-0000-4000-8000-000000000079'::uuid, '10000000-0000-0000-0000-000000000013'::uuid, '16:30', 'Return to Marina & Hotel Drop-off', 'Scenic sail back to Sharm El-Sheikh and transfer back to your lobby.', 7)
ON CONFLICT DO NOTHING;

INSERT INTO public.tour_highlights (id,tour_id,item,sort_order) VALUES
('40000000-0000-4000-8000-000000000001'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, '2 hours on Orange Bay beach with shaded loungers and shallow turquoise water', 1),
('40000000-0000-4000-8000-000000000002'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'Two 45-minute guided snorkeling stops at vibrant offshore reefs', 2),
('40000000-0000-4000-8000-000000000003'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'Fresh open buffet lunch served onboard with soft drinks & bottled water', 3),
('40000000-0000-4000-8000-000000000004'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'Complimentary snorkeling equipment and flotation jackets provided', 4),
('40000000-0000-4000-8000-000000000005'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'Hotel lobby pickup and return across Hurghada included', 5),
('40000000-0000-4000-8000-000000000006'::uuid, '10000000-0000-0000-0000-000000000002'::uuid, '2.5 hours at Paradise Beach on Giftun Island', 1),
('40000000-0000-4000-8000-000000000007'::uuid, '10000000-0000-0000-0000-000000000002'::uuid, 'Two stops at protected coral gardens with guide', 2),
('40000000-0000-4000-8000-000000000008'::uuid, '10000000-0000-0000-0000-000000000002'::uuid, 'Oriental folkloric show and music on the beach', 3),
('40000000-0000-4000-8000-000000000009'::uuid, '10000000-0000-0000-0000-000000000002'::uuid, 'Open buffet lunch on the boat with hot drinks', 4),
('40000000-0000-4000-8000-000000000010'::uuid, '10000000-0000-0000-0000-000000000002'::uuid, 'Hotel pickup and drop-off included', 5),
('40000000-0000-4000-8000-000000000011'::uuid, '10000000-0000-0000-0000-000000000003'::uuid, 'Observe pods of wild dolphins in their natural habitat', 1),
('40000000-0000-4000-8000-000000000012'::uuid, '10000000-0000-0000-0000-000000000003'::uuid, 'Two guided reef snorkeling stops with marine guides', 2),
('40000000-0000-4000-8000-000000000013'::uuid, '10000000-0000-0000-0000-000000000003'::uuid, 'Sanitized premium masks, fins, and life jackets', 3),
('40000000-0000-4000-8000-000000000014'::uuid, '10000000-0000-0000-0000-000000000003'::uuid, 'Hot buffet lunch and unlimited refreshments onboard', 4),
('40000000-0000-4000-8000-000000000015'::uuid, '10000000-0000-0000-0000-000000000003'::uuid, 'Banana boat and sofa water ride included', 5),
('40000000-0000-4000-8000-000000000016'::uuid, '10000000-0000-0000-0000-000000000004'::uuid, 'Relaxation on Giftun Island National Park sandbars', 1),
('40000000-0000-4000-8000-000000000017'::uuid, '10000000-0000-0000-0000-000000000004'::uuid, 'Two coral snorkeling sessions with guide', 2),
('40000000-0000-4000-8000-000000000018'::uuid, '10000000-0000-0000-0000-000000000004'::uuid, 'Open buffet lunch and refreshments included', 3),
('40000000-0000-4000-8000-000000000019'::uuid, '10000000-0000-0000-0000-000000000004'::uuid, 'Hotel pickup and drop-off included', 4),
('40000000-0000-4000-8000-000000000020'::uuid, '10000000-0000-0000-0000-000000000005'::uuid, 'Dedicated single quad bike for each participant', 1),
('40000000-0000-4000-8000-000000000021'::uuid, '10000000-0000-0000-0000-000000000005'::uuid, 'Comprehensive safety test drive and instruction', 2),
('40000000-0000-4000-8000-000000000022'::uuid, '10000000-0000-0000-0000-000000000005'::uuid, 'Approximately 45km total riding through scenic desert trails', 3),
('40000000-0000-4000-8000-000000000023'::uuid, '10000000-0000-0000-0000-000000000005'::uuid, 'Traditional Bedouin herbal tea stop', 4),
('40000000-0000-4000-8000-000000000024'::uuid, '10000000-0000-0000-0000-000000000005'::uuid, 'Round-trip hotel transfer included', 5),
('40000000-0000-4000-8000-000000000025'::uuid, '10000000-0000-0000-0000-000000000006'::uuid, 'ATV quad ride and spider dune buggy drive', 1),
('40000000-0000-4000-8000-000000000026'::uuid, '10000000-0000-0000-0000-000000000006'::uuid, 'Authentic Bedouin village tour with bread making demonstration', 2),
('40000000-0000-4000-8000-000000000027'::uuid, '10000000-0000-0000-0000-000000000006'::uuid, 'Sunset camel ride across desert ridges', 3),
('40000000-0000-4000-8000-000000000028'::uuid, '10000000-0000-0000-0000-000000000006'::uuid, 'Barbecue buffet dinner with soft drinks included', 4),
('40000000-0000-4000-8000-000000000029'::uuid, '10000000-0000-0000-0000-000000000006'::uuid, 'Evening fire show and folkloric Tanoura performance', 5),
('40000000-0000-4000-8000-000000000030'::uuid, '10000000-0000-0000-0000-000000000007'::uuid, 'Exclusive private yacht for your party only (up to 8 guests)', 1),
('40000000-0000-4000-8000-000000000031'::uuid, '10000000-0000-0000-0000-000000000007'::uuid, 'Customized route: Orange Bay, Magawish, or Dolphin Reefs', 2),
('40000000-0000-4000-8000-000000000032'::uuid, '10000000-0000-0000-0000-000000000007'::uuid, 'Private onboard chef preparing fresh gourmet lunch', 3),
('40000000-0000-4000-8000-000000000033'::uuid, '10000000-0000-0000-0000-000000000007'::uuid, 'Snorkeling gear, fresh tropical fruits, and unlimited drinks', 4),
('40000000-0000-4000-8000-000000000034'::uuid, '10000000-0000-0000-0000-000000000007'::uuid, 'Private Mercedes / minivan hotel transfers included', 5),
('40000000-0000-4000-8000-000000000035'::uuid, '10000000-0000-0000-0000-000000000008'::uuid, 'Direct departure from Abu Tig Marina in El Gouna', 1),
('40000000-0000-4000-8000-000000000036'::uuid, '10000000-0000-0000-0000-000000000008'::uuid, 'Private boat with sun shade and swimming ladder', 2),
('40000000-0000-4000-8000-000000000037'::uuid, '10000000-0000-0000-0000-000000000008'::uuid, 'Explore quiet northern coral reefs and shallow sandbars', 3),
('40000000-0000-4000-8000-000000000038'::uuid, '10000000-0000-0000-0000-000000000008'::uuid, 'Flexible departure time for your group', 4),
('40000000-0000-4000-8000-000000000039'::uuid, '10000000-0000-0000-0000-000000000008'::uuid, 'Snorkeling equipment and cold drinks included', 5),
('40000000-0000-4000-8000-000000000040'::uuid, '10000000-0000-0000-0000-000000000009'::uuid, 'No previous diving experience or swimming expertise required', 1),
('40000000-0000-4000-8000-000000000041'::uuid, '10000000-0000-0000-0000-000000000009'::uuid, 'Two separate shallow dives with your own instructor', 2),
('40000000-0000-4000-8000-000000000042'::uuid, '10000000-0000-0000-0000-000000000009'::uuid, 'Safe maximum depth of 6 to 7 meters', 3),
('40000000-0000-4000-8000-000000000043'::uuid, '10000000-0000-0000-0000-000000000009'::uuid, 'Clean dive equipment, wetsuit, mask, and fins included', 4),
('40000000-0000-4000-8000-000000000044'::uuid, '10000000-0000-0000-0000-000000000009'::uuid, 'Full-day boat cruise with open buffet lunch', 5),
('40000000-0000-4000-8000-000000000045'::uuid, '10000000-0000-0000-0000-000000000010'::uuid, 'Protected national marine park with regulated dolphin access', 1),
('40000000-0000-4000-8000-000000000046'::uuid, '10000000-0000-0000-0000-000000000010'::uuid, 'High chance to see spinner dolphins in calm waters', 2),
('40000000-0000-4000-8000-000000000047'::uuid, '10000000-0000-0000-0000-000000000010'::uuid, 'Two guided snorkeling stops accompanied by marine guides', 3),
('40000000-0000-4000-8000-000000000048'::uuid, '10000000-0000-0000-0000-000000000010'::uuid, 'Hot buffet lunch and cold drinks on the boat', 4),
('40000000-0000-4000-8000-000000000049'::uuid, '10000000-0000-0000-0000-000000000010'::uuid, 'Hotel pickup and drop-off across Marsa Alam included', 5),
('40000000-0000-4000-8000-000000000050'::uuid, '10000000-0000-0000-0000-000000000011'::uuid, 'Direct beach-entry snorkeling without needing a boat', 1),
('40000000-0000-4000-8000-000000000051'::uuid, '10000000-0000-0000-0000-000000000011'::uuid, 'Access to fresh-water swimming pool, showers, and shaded loungers', 2),
('40000000-0000-4000-8000-000000000052'::uuid, '10000000-0000-0000-0000-000000000011'::uuid, 'Buffet lunch served at beachfront restaurant', 3),
('40000000-0000-4000-8000-000000000053'::uuid, '10000000-0000-0000-0000-000000000011'::uuid, 'Snorkeling gear and guide included', 4),
('40000000-0000-4000-8000-000000000054'::uuid, '10000000-0000-0000-0000-000000000012'::uuid, 'Large submerged glass viewing windows', 1),
('40000000-0000-4000-8000-000000000055'::uuid, '10000000-0000-0000-0000-000000000012'::uuid, 'Cruise past Sahl Hasheesh sunken columns', 2),
('40000000-0000-4000-8000-000000000056'::uuid, '10000000-0000-0000-0000-000000000012'::uuid, 'Ideal for small children and non-swimmers', 3),
('40000000-0000-4000-8000-000000000057'::uuid, '10000000-0000-0000-0000-000000000012'::uuid, 'Short 2.5-hour tour with hotel pickup', 4),
('40000000-0000-4000-8000-000000000058'::uuid, '10000000-0000-0000-0000-000000000013'::uuid, 'Cruise to Ras Mohammed National Park, Egypt’s oldest protected marine reserve', 1),
('40000000-0000-4000-8000-000000000059'::uuid, '10000000-0000-0000-0000-000000000013'::uuid, 'Walk on the pristine shifting sands of White Island', 2),
('40000000-0000-4000-8000-000000000060'::uuid, '10000000-0000-0000-0000-000000000013'::uuid, 'Two guided reef drop-off snorkeling sessions at Shark & Yolanda Reefs', 3),
('40000000-0000-4000-8000-000000000061'::uuid, '10000000-0000-0000-0000-000000000013'::uuid, 'Freshly prepared onboard buffet with seafood, grilled chicken, and fresh salads', 4),
('40000000-0000-4000-8000-000000000062'::uuid, '10000000-0000-0000-0000-000000000013'::uuid, 'Complimentary hotel pickup and drop-off from any resort in Sharm El-Sheikh', 5)
ON CONFLICT DO NOTHING;

INSERT INTO public.tour_inclusions (id,tour_id,item,sort_order) VALUES
('50000000-0000-4000-8000-000000000001'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'Hotel pickup and return transfer', 1),
('50000000-0000-4000-8000-000000000002'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'Full-day boat cruise on passenger yacht', 2),
('50000000-0000-4000-8000-000000000003'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'Snorkeling equipment (mask, snorkel, fins)', 3),
('50000000-0000-4000-8000-000000000004'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'Orange Bay island national park admission', 4),
('50000000-0000-4000-8000-000000000005'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'Buffet lunch prepared fresh onboard', 5),
('50000000-0000-4000-8000-000000000006'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'Unlimited soft drinks, mineral water, tea & coffee', 6),
('50000000-0000-4000-8000-000000000007'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'Life jackets in adult and child sizes', 7),
('50000000-0000-4000-8000-000000000008'::uuid, '10000000-0000-0000-0000-000000000002'::uuid, 'Hotel pickup and return transfer', 1),
('50000000-0000-4000-8000-000000000009'::uuid, '10000000-0000-0000-0000-000000000002'::uuid, 'Boat cruise and crew assistance', 2),
('50000000-0000-4000-8000-000000000010'::uuid, '10000000-0000-0000-0000-000000000002'::uuid, 'Paradise Island entrance ticket', 3),
('50000000-0000-4000-8000-000000000011'::uuid, '10000000-0000-0000-0000-000000000002'::uuid, 'Snorkeling gear & buoyancy vests', 4),
('50000000-0000-4000-8000-000000000012'::uuid, '10000000-0000-0000-0000-000000000002'::uuid, 'Buffet lunch and soft drinks', 5),
('50000000-0000-4000-8000-000000000013'::uuid, '10000000-0000-0000-0000-000000000003'::uuid, 'Hotel pickup and return transfer', 1),
('50000000-0000-4000-8000-000000000014'::uuid, '10000000-0000-0000-0000-000000000003'::uuid, 'Full-day boat cruise', 2),
('50000000-0000-4000-8000-000000000015'::uuid, '10000000-0000-0000-0000-000000000003'::uuid, 'Snorkeling gear & life jackets', 3),
('50000000-0000-4000-8000-000000000016'::uuid, '10000000-0000-0000-0000-000000000003'::uuid, 'Marine park environmental fees', 4),
('50000000-0000-4000-8000-000000000017'::uuid, '10000000-0000-0000-0000-000000000003'::uuid, 'Hot buffet lunch & soft drinks', 5),
('50000000-0000-4000-8000-000000000018'::uuid, '10000000-0000-0000-0000-000000000003'::uuid, 'Water sports inflatables', 6),
('50000000-0000-4000-8000-000000000019'::uuid, '10000000-0000-0000-0000-000000000004'::uuid, 'Hotel transfers', 1),
('50000000-0000-4000-8000-000000000020'::uuid, '10000000-0000-0000-0000-000000000004'::uuid, 'Boat trip & national park fee', 2),
('50000000-0000-4000-8000-000000000021'::uuid, '10000000-0000-0000-0000-000000000004'::uuid, 'Snorkeling equipment', 3),
('50000000-0000-4000-8000-000000000022'::uuid, '10000000-0000-0000-0000-000000000004'::uuid, 'Lunch & soft drinks', 4),
('50000000-0000-4000-8000-000000000023'::uuid, '10000000-0000-0000-0000-000000000005'::uuid, 'Hotel transfers', 1),
('50000000-0000-4000-8000-000000000024'::uuid, '10000000-0000-0000-0000-000000000005'::uuid, 'Single quad bike per driver', 2),
('50000000-0000-4000-8000-000000000025'::uuid, '10000000-0000-0000-0000-000000000005'::uuid, 'Safety helmet & instructor', 3),
('50000000-0000-4000-8000-000000000026'::uuid, '10000000-0000-0000-0000-000000000005'::uuid, 'Bedouin tea & water', 4),
('50000000-0000-4000-8000-000000000027'::uuid, '10000000-0000-0000-0000-000000000006'::uuid, 'Round-trip transfers', 1),
('50000000-0000-4000-8000-000000000028'::uuid, '10000000-0000-0000-0000-000000000006'::uuid, 'Quad bike & spider buggy', 2),
('50000000-0000-4000-8000-000000000029'::uuid, '10000000-0000-0000-0000-000000000006'::uuid, 'Bedouin guide & camel ride', 3),
('50000000-0000-4000-8000-000000000030'::uuid, '10000000-0000-0000-0000-000000000006'::uuid, 'BBQ dinner & drinks', 4),
('50000000-0000-4000-8000-000000000031'::uuid, '10000000-0000-0000-0000-000000000006'::uuid, 'Show', 5),
('50000000-0000-4000-8000-000000000032'::uuid, '10000000-0000-0000-0000-000000000007'::uuid, 'Entire private yacht charter', 1),
('50000000-0000-4000-8000-000000000033'::uuid, '10000000-0000-0000-0000-000000000007'::uuid, 'Captain and 2 crew members', 2),
('50000000-0000-4000-8000-000000000034'::uuid, '10000000-0000-0000-0000-000000000007'::uuid, 'Private chef lunch & drinks', 3),
('50000000-0000-4000-8000-000000000035'::uuid, '10000000-0000-0000-0000-000000000007'::uuid, 'All park fees & snorkeling gear', 4),
('50000000-0000-4000-8000-000000000036'::uuid, '10000000-0000-0000-0000-000000000007'::uuid, 'Private hotel transfers', 5),
('50000000-0000-4000-8000-000000000037'::uuid, '10000000-0000-0000-0000-000000000008'::uuid, 'Private boat and captain', 1),
('50000000-0000-4000-8000-000000000038'::uuid, '10000000-0000-0000-0000-000000000008'::uuid, 'Fuel and marina permits', 2),
('50000000-0000-4000-8000-000000000039'::uuid, '10000000-0000-0000-0000-000000000008'::uuid, 'Snorkeling equipment', 3),
('50000000-0000-4000-8000-000000000040'::uuid, '10000000-0000-0000-0000-000000000008'::uuid, 'Fruit platter & soft drinks', 4),
('50000000-0000-4000-8000-000000000041'::uuid, '10000000-0000-0000-0000-000000000008'::uuid, 'Hotel transfer in El Gouna', 5),
('50000000-0000-4000-8000-000000000042'::uuid, '10000000-0000-0000-0000-000000000009'::uuid, 'Hotel transfers', 1),
('50000000-0000-4000-8000-000000000043'::uuid, '10000000-0000-0000-0000-000000000009'::uuid, 'Two intro dives with 1-on-1 instructor', 2),
('50000000-0000-4000-8000-000000000044'::uuid, '10000000-0000-0000-0000-000000000009'::uuid, 'Full scuba equipment set', 3),
('50000000-0000-4000-8000-000000000045'::uuid, '10000000-0000-0000-0000-000000000009'::uuid, 'Buffet lunch & drinks', 4),
('50000000-0000-4000-8000-000000000046'::uuid, '10000000-0000-0000-0000-000000000009'::uuid, 'Marine conservation permit', 5),
('50000000-0000-4000-8000-000000000047'::uuid, '10000000-0000-0000-0000-000000000010'::uuid, 'Hotel pickup and drop-off', 1),
('50000000-0000-4000-8000-000000000048'::uuid, '10000000-0000-0000-0000-000000000010'::uuid, 'Boat trip to Samadai', 2),
('50000000-0000-4000-8000-000000000049'::uuid, '10000000-0000-0000-0000-000000000010'::uuid, 'National Park permit fee', 3),
('50000000-0000-4000-8000-000000000050'::uuid, '10000000-0000-0000-0000-000000000010'::uuid, 'Snorkeling equipment', 4),
('50000000-0000-4000-8000-000000000051'::uuid, '10000000-0000-0000-0000-000000000010'::uuid, 'Buffet lunch & drinks', 5),
('50000000-0000-4000-8000-000000000052'::uuid, '10000000-0000-0000-0000-000000000011'::uuid, 'Round-trip transfer', 1),
('50000000-0000-4000-8000-000000000053'::uuid, '10000000-0000-0000-0000-000000000011'::uuid, 'Reserve entrance ticket', 2),
('50000000-0000-4000-8000-000000000054'::uuid, '10000000-0000-0000-0000-000000000011'::uuid, 'Beach loungers & pool use', 3),
('50000000-0000-4000-8000-000000000055'::uuid, '10000000-0000-0000-0000-000000000011'::uuid, 'Snorkeling equipment', 4),
('50000000-0000-4000-8000-000000000056'::uuid, '10000000-0000-0000-0000-000000000011'::uuid, 'Buffet lunch', 5),
('50000000-0000-4000-8000-000000000057'::uuid, '10000000-0000-0000-0000-000000000012'::uuid, 'Hotel transfers', 1),
('50000000-0000-4000-8000-000000000058'::uuid, '10000000-0000-0000-0000-000000000012'::uuid, 'Glass bottom boat cruise', 2),
('50000000-0000-4000-8000-000000000059'::uuid, '10000000-0000-0000-0000-000000000012'::uuid, 'Soft drinks and water', 3),
('50000000-0000-4000-8000-000000000060'::uuid, '10000000-0000-0000-0000-000000000013'::uuid, 'Hotel pickup and return across all Sharm El-Sheikh resorts', 1),
('50000000-0000-4000-8000-000000000061'::uuid, '10000000-0000-0000-0000-000000000013'::uuid, 'National park entry permit and marine clearance', 2),
('50000000-0000-4000-8000-000000000062'::uuid, '10000000-0000-0000-0000-000000000013'::uuid, 'Open buffet lunch (seafood, grilled meats, salads, pastas)', 3),
('50000000-0000-4000-8000-000000000063'::uuid, '10000000-0000-0000-0000-000000000013'::uuid, 'Unlimited tea, coffee, mineral water, and soft drinks throughout the day', 4),
('50000000-0000-4000-8000-000000000064'::uuid, '10000000-0000-0000-0000-000000000013'::uuid, 'Professional certified snorkeling guide and buoyancy aids', 5)
ON CONFLICT DO NOTHING;

INSERT INTO public.tour_exclusions (id,tour_id,item,sort_order) VALUES
('60000000-0000-4000-8000-000000000001'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'Personal photo & video packages from boat photographer', 1),
('60000000-0000-4000-8000-000000000002'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'Beach bar drinks on the island', 2),
('60000000-0000-4000-8000-000000000003'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'Tips / gratuities for the crew', 3),
('60000000-0000-4000-8000-000000000004'::uuid, '10000000-0000-0000-0000-000000000002'::uuid, 'Island bar drinks', 1),
('60000000-0000-4000-8000-000000000005'::uuid, '10000000-0000-0000-0000-000000000002'::uuid, 'Water sports rides', 2),
('60000000-0000-4000-8000-000000000006'::uuid, '10000000-0000-0000-0000-000000000002'::uuid, 'Tips for crew', 3),
('60000000-0000-4000-8000-000000000007'::uuid, '10000000-0000-0000-0000-000000000003'::uuid, 'Professional video/photo album', 1),
('60000000-0000-4000-8000-000000000008'::uuid, '10000000-0000-0000-0000-000000000003'::uuid, 'Crew gratuities', 2),
('60000000-0000-4000-8000-000000000009'::uuid, '10000000-0000-0000-0000-000000000004'::uuid, 'Personal expenses', 1),
('60000000-0000-4000-8000-000000000010'::uuid, '10000000-0000-0000-0000-000000000004'::uuid, 'Tips', 2),
('60000000-0000-4000-8000-000000000011'::uuid, '10000000-0000-0000-0000-000000000005'::uuid, 'Dust scarf & goggles (rent for €3 or bring own)', 1),
('60000000-0000-4000-8000-000000000012'::uuid, '10000000-0000-0000-0000-000000000005'::uuid, 'Photo CD', 2),
('60000000-0000-4000-8000-000000000013'::uuid, '10000000-0000-0000-0000-000000000006'::uuid, 'Scarf & goggles rental', 1),
('60000000-0000-4000-8000-000000000014'::uuid, '10000000-0000-0000-0000-000000000006'::uuid, 'Personal photos', 2),
('60000000-0000-4000-8000-000000000015'::uuid, '10000000-0000-0000-0000-000000000007'::uuid, 'Crew gratuities (discretionary)', 1),
('60000000-0000-4000-8000-000000000016'::uuid, '10000000-0000-0000-0000-000000000008'::uuid, 'Full warm restaurant lunch (can stop at beach club upon request)', 1),
('60000000-0000-4000-8000-000000000017'::uuid, '10000000-0000-0000-0000-000000000009'::uuid, 'Underwater photo/video package', 1),
('60000000-0000-4000-8000-000000000018'::uuid, '10000000-0000-0000-0000-000000000009'::uuid, 'Tips for dive crew', 2),
('60000000-0000-4000-8000-000000000019'::uuid, '10000000-0000-0000-0000-000000000010'::uuid, 'Photo album', 1),
('60000000-0000-4000-8000-000000000020'::uuid, '10000000-0000-0000-0000-000000000010'::uuid, 'Gratuities', 2),
('60000000-0000-4000-8000-000000000021'::uuid, '10000000-0000-0000-0000-000000000011'::uuid, 'Drinks at restaurant', 1),
('60000000-0000-4000-8000-000000000022'::uuid, '10000000-0000-0000-0000-000000000011'::uuid, 'Camel riding on beach', 2),
('60000000-0000-4000-8000-000000000023'::uuid, '10000000-0000-0000-0000-000000000012'::uuid, 'Personal photos', 1),
('60000000-0000-4000-8000-000000000024'::uuid, '10000000-0000-0000-0000-000000000013'::uuid, 'Snorkeling gear rental (masks & fins available at marina for €5)', 1),
('60000000-0000-4000-8000-000000000025'::uuid, '10000000-0000-0000-0000-000000000013'::uuid, 'Professional underwater photo & video package', 2)
ON CONFLICT DO NOTHING;

INSERT INTO public.tour_faqs (id,tour_id,question,answer,section,sort_order) VALUES
('70000000-0000-4000-8000-000000000001'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'What to bring', 'Swimwear and beach towel', 'what_to_bring', 1),
('70000000-0000-4000-8000-000000000002'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'What to bring', 'Sunscreen (reef-safe recommended)', 'what_to_bring', 2),
('70000000-0000-4000-8000-000000000003'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'What to bring', 'Sunglasses and sun hat', 'what_to_bring', 3),
('70000000-0000-4000-8000-000000000004'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'What to bring', 'Comfortable sandals or water shoes', 'what_to_bring', 4),
('70000000-0000-4000-8000-000000000005'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'What to bring', 'Pocket cash for optional island extras', 'what_to_bring', 5),
('70000000-0000-4000-8000-000000000006'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'Important information', 'Please bring your original passport or hotel card for maritime coast guard check.', 'important_information', 1),
('70000000-0000-4000-8000-000000000007'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'Important information', 'Child rate applies to ages 2–11. Infants under 2 join free of charge.', 'important_information', 2),
('70000000-0000-4000-8000-000000000008'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'Important information', 'Life vests are mandatory for non-swimmers during snorkeling sessions.', 'important_information', 3),
('70000000-0000-4000-8000-000000000009'::uuid, '10000000-0000-0000-0000-000000000002'::uuid, 'What to bring', 'Beach towel', 'what_to_bring', 1),
('70000000-0000-4000-8000-000000000010'::uuid, '10000000-0000-0000-0000-000000000002'::uuid, 'What to bring', 'Sunscreen', 'what_to_bring', 2),
('70000000-0000-4000-8000-000000000011'::uuid, '10000000-0000-0000-0000-000000000002'::uuid, 'What to bring', 'Swimwear', 'what_to_bring', 3),
('70000000-0000-4000-8000-000000000012'::uuid, '10000000-0000-0000-0000-000000000002'::uuid, 'What to bring', 'Sunglasses', 'what_to_bring', 4),
('70000000-0000-4000-8000-000000000013'::uuid, '10000000-0000-0000-0000-000000000002'::uuid, 'What to bring', 'Cash for island bar', 'what_to_bring', 5),
('70000000-0000-4000-8000-000000000014'::uuid, '10000000-0000-0000-0000-000000000002'::uuid, 'Important information', 'Suitable for all age groups including infants and seniors.', 'important_information', 1),
('70000000-0000-4000-8000-000000000015'::uuid, '10000000-0000-0000-0000-000000000003'::uuid, 'What to bring', 'Towel', 'what_to_bring', 1),
('70000000-0000-4000-8000-000000000016'::uuid, '10000000-0000-0000-0000-000000000003'::uuid, 'What to bring', 'Swimsuit', 'what_to_bring', 2),
('70000000-0000-4000-8000-000000000017'::uuid, '10000000-0000-0000-0000-000000000003'::uuid, 'What to bring', 'Sun protection', 'what_to_bring', 3),
('70000000-0000-4000-8000-000000000018'::uuid, '10000000-0000-0000-0000-000000000003'::uuid, 'What to bring', 'Camera', 'what_to_bring', 4),
('70000000-0000-4000-8000-000000000019'::uuid, '10000000-0000-0000-0000-000000000003'::uuid, 'Important information', 'Dolphin encounters are natural and cannot be 100% guaranteed, but success rate is high.', 'important_information', 1),
('70000000-0000-4000-8000-000000000020'::uuid, '10000000-0000-0000-0000-000000000004'::uuid, 'What to bring', 'Beach towel', 'what_to_bring', 1),
('70000000-0000-4000-8000-000000000021'::uuid, '10000000-0000-0000-0000-000000000004'::uuid, 'What to bring', 'Swimwear', 'what_to_bring', 2),
('70000000-0000-4000-8000-000000000022'::uuid, '10000000-0000-0000-0000-000000000004'::uuid, 'What to bring', 'Sunscreen', 'what_to_bring', 3),
('70000000-0000-4000-8000-000000000023'::uuid, '10000000-0000-0000-0000-000000000004'::uuid, 'Important information', 'Family-friendly trip suitable for all swimming levels.', 'important_information', 1),
('70000000-0000-4000-8000-000000000024'::uuid, '10000000-0000-0000-0000-000000000005'::uuid, 'What to bring', 'Closed shoes / sneakers', 'what_to_bring', 1),
('70000000-0000-4000-8000-000000000025'::uuid, '10000000-0000-0000-0000-000000000005'::uuid, 'What to bring', 'Comfortable clothes (will get dusty)', 'what_to_bring', 2),
('70000000-0000-4000-8000-000000000026'::uuid, '10000000-0000-0000-0000-000000000005'::uuid, 'What to bring', 'Sunglasses', 'what_to_bring', 3),
('70000000-0000-4000-8000-000000000027'::uuid, '10000000-0000-0000-0000-000000000005'::uuid, 'Important information', 'Minimum driving age for quad is 16 years. Children can ride as passengers with parents.', 'important_information', 1),
('70000000-0000-4000-8000-000000000028'::uuid, '10000000-0000-0000-0000-000000000006'::uuid, 'What to bring', 'Comfortable clothing', 'what_to_bring', 1),
('70000000-0000-4000-8000-000000000029'::uuid, '10000000-0000-0000-0000-000000000006'::uuid, 'What to bring', 'Closed footwear', 'what_to_bring', 2),
('70000000-0000-4000-8000-000000000030'::uuid, '10000000-0000-0000-0000-000000000006'::uuid, 'What to bring', 'Light jacket for evening', 'what_to_bring', 3),
('70000000-0000-4000-8000-000000000031'::uuid, '10000000-0000-0000-0000-000000000006'::uuid, 'Important information', 'Suitable for couples, groups, and families with children aged 4+.', 'important_information', 1),
('70000000-0000-4000-8000-000000000032'::uuid, '10000000-0000-0000-0000-000000000007'::uuid, 'What to bring', 'Swimwear', 'what_to_bring', 1),
('70000000-0000-4000-8000-000000000033'::uuid, '10000000-0000-0000-0000-000000000007'::uuid, 'What to bring', 'Towels', 'what_to_bring', 2),
('70000000-0000-4000-8000-000000000034'::uuid, '10000000-0000-0000-0000-000000000007'::uuid, 'What to bring', 'Sunglasses', 'what_to_bring', 3),
('70000000-0000-4000-8000-000000000035'::uuid, '10000000-0000-0000-0000-000000000007'::uuid, 'What to bring', 'Camera', 'what_to_bring', 4),
('70000000-0000-4000-8000-000000000036'::uuid, '10000000-0000-0000-0000-000000000007'::uuid, 'Important information', 'Price is total for the entire vessel (up to 8 guests included). Extra guests €25/person.', 'important_information', 1),
('70000000-0000-4000-8000-000000000037'::uuid, '10000000-0000-0000-0000-000000000008'::uuid, 'What to bring', 'Beach wear', 'what_to_bring', 1),
('70000000-0000-4000-8000-000000000038'::uuid, '10000000-0000-0000-0000-000000000008'::uuid, 'What to bring', 'Towel', 'what_to_bring', 2),
('70000000-0000-4000-8000-000000000039'::uuid, '10000000-0000-0000-0000-000000000008'::uuid, 'What to bring', 'Sunscreen', 'what_to_bring', 3),
('70000000-0000-4000-8000-000000000040'::uuid, '10000000-0000-0000-0000-000000000008'::uuid, 'Important information', 'Rate is per boat for up to 6 passengers.', 'important_information', 1),
('70000000-0000-4000-8000-000000000041'::uuid, '10000000-0000-0000-0000-000000000009'::uuid, 'What to bring', 'Swimwear', 'what_to_bring', 1),
('70000000-0000-4000-8000-000000000042'::uuid, '10000000-0000-0000-0000-000000000009'::uuid, 'What to bring', 'Towel', 'what_to_bring', 2),
('70000000-0000-4000-8000-000000000043'::uuid, '10000000-0000-0000-0000-000000000009'::uuid, 'What to bring', 'Dry clothes', 'what_to_bring', 3),
('70000000-0000-4000-8000-000000000044'::uuid, '10000000-0000-0000-0000-000000000009'::uuid, 'Important information', 'Must be at least 10 years old. Medical questionnaire required before diving (must not have severe asthma or heart conditions).', 'important_information', 1),
('70000000-0000-4000-8000-000000000045'::uuid, '10000000-0000-0000-0000-000000000010'::uuid, 'What to bring', 'Towel', 'what_to_bring', 1),
('70000000-0000-4000-8000-000000000046'::uuid, '10000000-0000-0000-0000-000000000010'::uuid, 'What to bring', 'Swimsuit', 'what_to_bring', 2),
('70000000-0000-4000-8000-000000000047'::uuid, '10000000-0000-0000-0000-000000000010'::uuid, 'What to bring', 'Reef-safe sunscreen', 'what_to_bring', 3),
('70000000-0000-4000-8000-000000000048'::uuid, '10000000-0000-0000-0000-000000000010'::uuid, 'What to bring', 'Sunglasses', 'what_to_bring', 4),
('70000000-0000-4000-8000-000000000049'::uuid, '10000000-0000-0000-0000-000000000010'::uuid, 'Important information', 'Touching or chasing dolphins is strictly prohibited by Egyptian environmental law.', 'important_information', 1),
('70000000-0000-4000-8000-000000000050'::uuid, '10000000-0000-0000-0000-000000000011'::uuid, 'What to bring', 'Beach towel', 'what_to_bring', 1),
('70000000-0000-4000-8000-000000000051'::uuid, '10000000-0000-0000-0000-000000000011'::uuid, 'What to bring', 'Swimwear', 'what_to_bring', 2),
('70000000-0000-4000-8000-000000000052'::uuid, '10000000-0000-0000-0000-000000000011'::uuid, 'What to bring', 'Sunscreen', 'what_to_bring', 3),
('70000000-0000-4000-8000-000000000053'::uuid, '10000000-0000-0000-0000-000000000011'::uuid, 'Important information', 'Great for young children and travelers prone to seasickness.', 'important_information', 1),
('70000000-0000-4000-8000-000000000054'::uuid, '10000000-0000-0000-0000-000000000012'::uuid, 'What to bring', 'Sunglasses', 'what_to_bring', 1),
('70000000-0000-4000-8000-000000000055'::uuid, '10000000-0000-0000-0000-000000000012'::uuid, 'What to bring', 'Camera', 'what_to_bring', 2),
('70000000-0000-4000-8000-000000000056'::uuid, '10000000-0000-0000-0000-000000000012'::uuid, 'Important information', 'Stroller friendly and completely safe for all ages.', 'important_information', 1),
('70000000-0000-4000-8000-000000000057'::uuid, '10000000-0000-0000-0000-000000000013'::uuid, 'What to bring', 'Swimwear', 'what_to_bring', 1),
('70000000-0000-4000-8000-000000000058'::uuid, '10000000-0000-0000-0000-000000000013'::uuid, 'What to bring', 'Beach towel', 'what_to_bring', 2),
('70000000-0000-4000-8000-000000000059'::uuid, '10000000-0000-0000-0000-000000000013'::uuid, 'What to bring', 'Passport or ID photocopy', 'what_to_bring', 3),
('70000000-0000-4000-8000-000000000060'::uuid, '10000000-0000-0000-0000-000000000013'::uuid, 'What to bring', 'Sunscreen (reef safe)', 'what_to_bring', 4),
('70000000-0000-4000-8000-000000000061'::uuid, '10000000-0000-0000-0000-000000000013'::uuid, 'What to bring', 'Sunglasses & hat', 'what_to_bring', 5),
('70000000-0000-4000-8000-000000000062'::uuid, '10000000-0000-0000-0000-000000000013'::uuid, 'Important information', 'Please bring a passport photocopy as required by Egyptian Coast Guard regulations.', 'important_information', 1),
('70000000-0000-4000-8000-000000000063'::uuid, '10000000-0000-0000-0000-000000000013'::uuid, 'Important information', 'White Island visibility is subject to daily tidal conditions and sea clearance.', 'important_information', 2)
ON CONFLICT DO NOTHING;

INSERT INTO public.tour_extras (id,name,description,price_eur,currency,pricing_type,is_active,min_quantity,max_quantity,sort_order) SELECT 'e2000000-0000-4000-8000-000000000001'::uuid, 'Underwater GoPro Camera Rental', 'Includes 16GB SD card you take home.', 15, 'EUR', 'per_booking', TRUE, 1, 1, 1 WHERE NOT EXISTS (SELECT 1 FROM public.tour_extras WHERE name = 'Underwater GoPro Camera Rental') ON CONFLICT DO NOTHING;

INSERT INTO public.tour_extras (id,name,description,price_eur,currency,pricing_type,is_active,min_quantity,max_quantity,sort_order) SELECT 'e2000000-0000-4000-8000-000000000002'::uuid, 'Seafood Platter Upgrade', 'Fresh jumbo grilled prawns and calamari.', 10, 'EUR', 'per_booking', TRUE, 1, 1, 2 WHERE NOT EXISTS (SELECT 1 FROM public.tour_extras WHERE name = 'Seafood Platter Upgrade') ON CONFLICT DO NOTHING;

INSERT INTO public.tour_extras (id,name,description,price_eur,currency,pricing_type,is_active,min_quantity,max_quantity,sort_order) SELECT 'e2000000-0000-4000-8000-000000000003'::uuid, 'Private Hotel Transfer Van', 'Direct pickup without sharing with other resorts.', 20, 'EUR', 'per_booking', TRUE, 1, 1, 3 WHERE NOT EXISTS (SELECT 1 FROM public.tour_extras WHERE name = 'Private Hotel Transfer Van') ON CONFLICT DO NOTHING;

INSERT INTO public.tour_extras (id,name,description,price_eur,currency,pricing_type,is_active,min_quantity,max_quantity,sort_order) SELECT 'e2000000-0000-4000-8000-000000000004'::uuid, 'Banana Boat & Tube Ride', '10 minutes of fun watersports behind speedboat.', 8, 'EUR', 'per_booking', TRUE, 1, 1, 4 WHERE NOT EXISTS (SELECT 1 FROM public.tour_extras WHERE name = 'Banana Boat & Tube Ride') ON CONFLICT DO NOTHING;

INSERT INTO public.tour_extras (id,name,description,price_eur,currency,pricing_type,is_active,min_quantity,max_quantity,sort_order) SELECT 'e2000000-0000-4000-8000-000000000005'::uuid, 'Professional Underwater Photos', 'Delivered digitally by evening.', 20, 'EUR', 'per_booking', TRUE, 1, 1, 5 WHERE NOT EXISTS (SELECT 1 FROM public.tour_extras WHERE name = 'Professional Underwater Photos') ON CONFLICT DO NOTHING;

INSERT INTO public.tour_assigned_extras (tour_id,extra_id,custom_price_eur,is_active,sort_order) VALUES
('10000000-0000-0000-0000-000000000001'::uuid, (SELECT id FROM public.tour_extras WHERE name='Underwater GoPro Camera Rental' ORDER BY created_at ASC LIMIT 1), 15, TRUE, 1),
('10000000-0000-0000-0000-000000000001'::uuid, (SELECT id FROM public.tour_extras WHERE name='Seafood Platter Upgrade' ORDER BY created_at ASC LIMIT 1), 10, TRUE, 2),
('10000000-0000-0000-0000-000000000001'::uuid, (SELECT id FROM public.tour_extras WHERE name='Private Hotel Transfer Van' ORDER BY created_at ASC LIMIT 1), 20, TRUE, 3),
('10000000-0000-0000-0000-000000000002'::uuid, (SELECT id FROM public.tour_extras WHERE name='Banana Boat & Tube Ride' ORDER BY created_at ASC LIMIT 1), 8, TRUE, 1),
('10000000-0000-0000-0000-000000000003'::uuid, (SELECT id FROM public.tour_extras WHERE name='Professional Underwater Photos' ORDER BY created_at ASC LIMIT 1), 20, TRUE, 1)
ON CONFLICT DO NOTHING;

INSERT INTO public.seo_metadata (id,entity_type,entity_id,page_slug,seo_title,meta_description,seo_keywords,canonical_url,og_title,og_description,og_image,social_image,robots_index,robots_follow)
VALUES
('90000000-0000-4000-8000-000000000001'::uuid, 'tour', '10000000-0000-0000-0000-000000000001'::uuid, '/excursions/orange-bay-island-snorkeling', 'Orange Bay Island & Snorkeling | Hurghada | Awesome Adventure Tours', 'Take a boat trip to Giftun Island’s Orange Bay beach with shallow turquoise water, two guided snorkeling stops at coral reefs, and buffet lunch onboard. Review pickup details, inclusions and cancellation terms before booking.', ARRAY['Orange Bay Island & Snorkeling', 'Hurghada', 'Boat Trip', 'Red Sea excursions']::text[], 'https://awesomeadventure.tours/excursions/orange-bay-island-snorkeling', 'Orange Bay Island & Snorkeling | Hurghada | Awesome Adventure Tours', 'Take a boat trip to Giftun Island’s Orange Bay beach with shallow turquoise water, two guided snorkeling stops at coral reefs, and buffet lunch onboard. Review pickup details, inclusions and cancellation terms before booking.', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80', TRUE, TRUE),
('90000000-0000-4000-8000-000000000002'::uuid, 'tour', '10000000-0000-0000-0000-000000000002'::uuid, '/excursions/paradise-island-snorkeling-trip', 'Paradise Island Snorkeling Trip | Hurghada | Awesome Adventure Tours', 'Sail to Paradise Beach on Giftun Island with white sand, parasols, folklore dance show, and two coral reef snorkeling stops. Review pickup details, inclusions and cancellation terms before booking.', ARRAY['Paradise Island Snorkeling Trip', 'Hurghada', 'Boat Trip', 'Red Sea excursions']::text[], 'https://awesomeadventure.tours/excursions/paradise-island-snorkeling-trip', 'Paradise Island Snorkeling Trip | Hurghada | Awesome Adventure Tours', 'Sail to Paradise Beach on Giftun Island with white sand, parasols, folklore dance show, and two coral reef snorkeling stops. Review pickup details, inclusions and cancellation terms before booking.', 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80', 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80', TRUE, TRUE),
('90000000-0000-4000-8000-000000000003'::uuid, 'tour', '10000000-0000-0000-0000-000000000003'::uuid, '/excursions/dolphin-house-snorkeling', 'Dolphin House Snorkeling | Hurghada | Awesome Adventure Tours', 'Take a boat trip to Shaab El Erg reef to see wild dolphins in open water, with two coral snorkeling stops and lunch. Review pickup details, inclusions and cancellation terms before booking.', ARRAY['Dolphin House Snorkeling', 'Hurghada', 'Snorkeling', 'Red Sea excursions']::text[], 'https://awesomeadventure.tours/excursions/dolphin-house-snorkeling', 'Dolphin House Snorkeling | Hurghada | Awesome Adventure Tours', 'Take a boat trip to Shaab El Erg reef to see wild dolphins in open water, with two coral snorkeling stops and lunch. Review pickup details, inclusions and cancellation terms before booking.', 'https://images.unsplash.com/photo-1544551763-77ef2d0cfc6c?auto=format&fit=crop&w=1200&q=80', 'https://images.unsplash.com/photo-1544551763-77ef2d0cfc6c?auto=format&fit=crop&w=1200&q=80', TRUE, TRUE),
('90000000-0000-4000-8000-000000000004'::uuid, 'tour', '10000000-0000-0000-0000-000000000004'::uuid, '/excursions/giftun-island-boat-trip', 'Giftun Island Boat Trip | Hurghada | Awesome Adventure Tours', 'The classic Red Sea boat trip featuring sandbar swimming on Giftun Island National Park, relaxing on sun decks, and snorkeling over living coral. Review pickup details, inclusions and cancellation terms before booking.', ARRAY['Giftun Island Boat Trip', 'Hurghada', 'Boat Trip', 'Red Sea excursions']::text[], 'https://awesomeadventure.tours/excursions/giftun-island-boat-trip', 'Giftun Island Boat Trip | Hurghada | Awesome Adventure Tours', 'The classic Red Sea boat trip featuring sandbar swimming on Giftun Island National Park, relaxing on sun decks, and snorkeling over living coral. Review pickup details, inclusions and cancellation terms before booking.', 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80', 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80', TRUE, TRUE),
('90000000-0000-4000-8000-000000000005'::uuid, 'tour', '10000000-0000-0000-0000-000000000005'::uuid, '/excursions/desert-quad-safari', 'Desert Quad Safari | Hurghada | Awesome Adventure Tours', 'Ride a 250cc ATV quad bike across desert trails and mountain canyons. Includes test drive and Bedouin tea. Review pickup details, inclusions and cancellation terms before booking.', ARRAY['Desert Quad Safari', 'Hurghada', 'Safari', 'Red Sea excursions']::text[], 'https://awesomeadventure.tours/excursions/desert-quad-safari', 'Desert Quad Safari | Hurghada | Awesome Adventure Tours', 'Ride a 250cc ATV quad bike across desert trails and mountain canyons. Includes test drive and Bedouin tea. Review pickup details, inclusions and cancellation terms before booking.', 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=1200&q=80', 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=1200&q=80', TRUE, TRUE),
('90000000-0000-4000-8000-000000000006'::uuid, 'tour', '10000000-0000-0000-0000-000000000006'::uuid, '/excursions/desert-safari-bedouin-experience', 'Desert Safari & Bedouin Experience | Hurghada | Awesome Adventure Tours', 'Quad biking, spider dune buggy driving, camel ride, Bedouin village visit, BBQ dinner, and evening folklore show. Review pickup details, inclusions and cancellation terms before booking.', ARRAY['Desert Safari & Bedouin Experience', 'Hurghada', 'Safari', 'Red Sea excursions']::text[], 'https://awesomeadventure.tours/excursions/desert-safari-bedouin-experience', 'Desert Safari & Bedouin Experience | Hurghada | Awesome Adventure Tours', 'Quad biking, spider dune buggy driving, camel ride, Bedouin village visit, BBQ dinner, and evening folklore show. Review pickup details, inclusions and cancellation terms before booking.', 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80', 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80', TRUE, TRUE),
('90000000-0000-4000-8000-000000000007'::uuid, 'tour', '10000000-0000-0000-0000-000000000007'::uuid, '/excursions/private-red-sea-yacht', 'Private Red Sea Yacht | Hurghada | Awesome Adventure Tours', 'Private yacht charter for up to 8 guests. Choose your stops, snorkel quiet reefs, and enjoy a freshly cooked lunch. Review pickup details, inclusions and cancellation terms before booking.', ARRAY['Private Red Sea Yacht', 'Hurghada', 'Private Tour', 'Red Sea excursions']::text[], 'https://awesomeadventure.tours/excursions/private-red-sea-yacht', 'Private Red Sea Yacht | Hurghada | Awesome Adventure Tours', 'Private yacht charter for up to 8 guests. Choose your stops, snorkel quiet reefs, and enjoy a freshly cooked lunch. Review pickup details, inclusions and cancellation terms before booking.', 'https://images.unsplash.com/photo-1569263979104-865ab7cd8d17?auto=format&fit=crop&w=1200&q=80', 'https://images.unsplash.com/photo-1569263979104-865ab7cd8d17?auto=format&fit=crop&w=1200&q=80', TRUE, TRUE),
('90000000-0000-4000-8000-000000000008'::uuid, 'tour', '10000000-0000-0000-0000-000000000008'::uuid, '/excursions/el-gouna-private-boat-trip', 'El Gouna Private Boat Trip | El Gouna | Awesome Adventure Tours', 'Private cruiser departing Abu Tig Marina. Cruise through El Gouna channels, visit quiet northern reefs, and relax on sandbars. Review pickup details, inclusions and cancellation terms before booking.', ARRAY['El Gouna Private Boat Trip', 'El Gouna', 'Private Tour', 'Red Sea excursions']::text[], 'https://awesomeadventure.tours/excursions/el-gouna-private-boat-trip', 'El Gouna Private Boat Trip | El Gouna | Awesome Adventure Tours', 'Private cruiser departing Abu Tig Marina. Cruise through El Gouna channels, visit quiet northern reefs, and relax on sandbars. Review pickup details, inclusions and cancellation terms before booking.', 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=1200&q=80', 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=1200&q=80', TRUE, TRUE),
('90000000-0000-4000-8000-000000000009'::uuid, 'tour', '10000000-0000-0000-0000-000000000009'::uuid, '/excursions/introductory-scuba-diving-experience', 'Introductory Scuba Diving Experience | Hurghada | Awesome Adventure Tours', 'No license needed. Try scuba diving with a certified PADI instructor by your side. Includes 2 shallow boat dives and lunch. Review pickup details, inclusions and cancellation terms before booking.', ARRAY['Introductory Scuba Diving Experience', 'Hurghada', 'Diving', 'Red Sea excursions']::text[], 'https://awesomeadventure.tours/excursions/introductory-scuba-diving-experience', 'Introductory Scuba Diving Experience | Hurghada | Awesome Adventure Tours', 'No license needed. Try scuba diving with a certified PADI instructor by your side. Includes 2 shallow boat dives and lunch. Review pickup details, inclusions and cancellation terms before booking.', 'https://images.unsplash.com/photo-1544551763-92ab472cad5d?auto=format&fit=crop&w=1200&q=80', 'https://images.unsplash.com/photo-1544551763-92ab472cad5d?auto=format&fit=crop&w=1200&q=80', TRUE, TRUE),
('90000000-0000-4000-8000-000000000010'::uuid, 'tour', '10000000-0000-0000-0000-000000000010'::uuid, '/excursions/marsa-alam-dolphin-house', 'Marsa Alam Dolphin House | Marsa Alam | Awesome Adventure Tours', 'Sail to the protected Sha’ab Samadai marine reserve to snorkel near wild dolphins in calm natural lagoons. Review pickup details, inclusions and cancellation terms before booking.', ARRAY['Marsa Alam Dolphin House', 'Marsa Alam', 'Snorkeling', 'Red Sea excursions']::text[], 'https://awesomeadventure.tours/excursions/marsa-alam-dolphin-house', 'Marsa Alam Dolphin House | Marsa Alam | Awesome Adventure Tours', 'Sail to the protected Sha’ab Samadai marine reserve to snorkel near wild dolphins in calm natural lagoons. Review pickup details, inclusions and cancellation terms before booking.', 'https://images.unsplash.com/photo-1682687220063-4742bd7fd538?auto=format&fit=crop&w=1200&q=80', 'https://images.unsplash.com/photo-1682687220063-4742bd7fd538?auto=format&fit=crop&w=1200&q=80', TRUE, TRUE),
('90000000-0000-4000-8000-000000000011'::uuid, 'tour', '10000000-0000-0000-0000-000000000011'::uuid, '/excursions/sharm-el-naga-beach-reef-day', 'Sharm El Naga Beach & Snorkeling Day | Safaga | Awesome Adventure Tours', 'Snorkel straight from a sandy beach without a boat. Includes private bay entry, sun loungers, swimming pool, and lunch. Review pickup details, inclusions and cancellation terms before booking.', ARRAY['Sharm El Naga Beach & Snorkeling Day', 'Safaga', 'Snorkeling', 'Red Sea excursions']::text[], 'https://awesomeadventure.tours/excursions/sharm-el-naga-beach-reef-day', 'Sharm El Naga Beach & Snorkeling Day | Safaga | Awesome Adventure Tours', 'Snorkel straight from a sandy beach without a boat. Includes private bay entry, sun loungers, swimming pool, and lunch. Review pickup details, inclusions and cancellation terms before booking.', 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80', 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80', TRUE, TRUE),
('90000000-0000-4000-8000-000000000012'::uuid, 'tour', '10000000-0000-0000-0000-000000000012'::uuid, '/excursions/sahl-hasheesh-glass-bottom-boat', 'Sahl Hasheesh Glass Bottom Boat | Sahl Hasheesh | Awesome Adventure Tours', 'View corals and fish through underwater glass windows without getting wet. Sail past sunken pillars with an optional swim stop. Review pickup details, inclusions and cancellation terms before booking.', ARRAY['Sahl Hasheesh Glass Bottom Boat', 'Sahl Hasheesh', 'Water Sports', 'Red Sea excursions']::text[], 'https://awesomeadventure.tours/excursions/sahl-hasheesh-glass-bottom-boat', 'Sahl Hasheesh Glass Bottom Boat | Sahl Hasheesh | Awesome Adventure Tours', 'View corals and fish through underwater glass windows without getting wet. Sail past sunken pillars with an optional swim stop. Review pickup details, inclusions and cancellation terms before booking.', 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80', 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80', TRUE, TRUE),
('90000000-0000-4000-8000-000000000013'::uuid, 'tour', '10000000-0000-0000-0000-000000000013'::uuid, '/excursions/ras-mohammed-white-island-cruise', 'Ras Mohammed National Park & White Island Luxury Yacht Cruise | Sharm El-Sheikh | Awesome Adventure Tours', 'Cruise through the marine sanctuary of Ras Mohammed National Park, step onto the crystal sandbar of White Island, snorkel coral walls, and enjoy an onboard seafood buffet. Review pickup details, inclusions and cancellation terms before booking.', ARRAY['Ras Mohammed National Park & White Island Luxury Yacht Cruise', 'Sharm El-Sheikh', 'Boat Trips', 'Red Sea excursions']::text[], 'https://awesomeadventure.tours/excursions/ras-mohammed-white-island-cruise', 'Ras Mohammed National Park & White Island Luxury Yacht Cruise | Sharm El-Sheikh | Awesome Adventure Tours', 'Cruise through the marine sanctuary of Ras Mohammed National Park, step onto the crystal sandbar of White Island, snorkel coral walls, and enjoy an onboard seafood buffet. Review pickup details, inclusions and cancellation terms before booking.', 'https://images.unsplash.com/photo-1544551763-77ef2d0cfc6c?auto=format&fit=crop&w=1200&q=80', 'https://images.unsplash.com/photo-1544551763-77ef2d0cfc6c?auto=format&fit=crop&w=1200&q=80', TRUE, TRUE)
ON CONFLICT DO NOTHING;

COMMIT;

-- Import verification snapshot
SELECT json_build_object(
  'tours_total', (SELECT count(*) FROM public.tours),
  'tours_published', (SELECT count(*) FROM public.tours WHERE status='published'),
  'destinations_total', (SELECT count(*) FROM public.destinations),
  'destinations_published', (SELECT count(*) FROM public.destinations WHERE status='published'),
  'categories_total', (SELECT count(*) FROM public.categories),
  'pickup_locations_inactive', (SELECT count(*) FROM public.pickup_locations WHERE is_active=false),
  'tour_extras_existing_and_seeded', (SELECT count(*) FROM public.tour_extras),
  'tour_extra_assignments_active', (SELECT count(*) FROM public.tour_assigned_extras WHERE is_active=true),
  'tour_reviews', (SELECT count(*) FROM public.reviews),
  'rated_tours', (SELECT count(*) FROM public.tours WHERE rating > 0 OR review_count > 0),
  'tour_images', (SELECT count(*) FROM public.tour_images),
  'itinerary_steps', (SELECT count(*) FROM public.tour_itinerary),
  'highlights', (SELECT count(*) FROM public.tour_highlights),
  'inclusions', (SELECT count(*) FROM public.tour_inclusions),
  'exclusions', (SELECT count(*) FROM public.tour_exclusions),
  'preparation_items', (SELECT count(*) FROM public.tour_faqs WHERE section IN ('what_to_bring','important_information')),
  'seo_metadata', (SELECT count(*) FROM public.seo_metadata WHERE entity_type='tour')
) AS catalogue_seed_verification;