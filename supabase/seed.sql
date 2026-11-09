-- ==============================================================================
-- RED SEA VOYAGES & MARITIME EXCURSIONS - COMPLETE PRODUCTION CATALOGUE SEED
-- ==============================================================================
-- 1. DESTINATIONS (All 7 Coastal Hubs)
INSERT INTO public.destinations (id, name, slug, tagline, description, main_image, gallery, distance_from_airport, status, sort_order)
VALUES
('a1000000-0000-0000-0000-000000000001', 'Hurghada', 'hurghada', 'Main departure hub for boat trips and coral reefs', 'The main resort city on the Red Sea with direct boat trips to Giftun Island, Orange Bay, and desert safari centers.', 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=800&q=80', ARRAY['https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=800&q=80'], '15 mins from Hurghada Airport (HRG)', 'published', 1),
('a1000000-0000-0000-0000-000000000002', 'El Gouna', 'el-gouna', 'Quiet lagoon town with marinas and private boat charters', 'A quiet resort town 30 minutes north of Hurghada, connected by lagoons, with private yacht charters from Abu Tig Marina.', 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=800&q=80', ARRAY['https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=800&q=80'], '30 mins north of Hurghada (HRG)', 'published', 2),
('a1000000-0000-0000-0000-000000000003', 'Makadi Bay', 'makadi-bay', 'Calm bay with house reefs right off the beach', 'Located south of Hurghada with house reefs right in front of the hotels, great for snorkeling from the shore and desert tours.', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80', ARRAY['https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80'], '25 mins south of Hurghada (HRG)', 'published', 3),
('a1000000-0000-0000-0000-000000000004', 'Sahl Hasheesh', 'sahl-hasheesh', 'Relaxed resort bay with walking promenade and glass bottom boats', 'A relaxed bay with a pedestrian promenade, calm waters, sunken pharaonic pillars, and glass-bottom boat trips.', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80', ARRAY['https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80'], '20 mins south of Hurghada (HRG)', 'published', 4),
('a1000000-0000-0000-0000-000000000005', 'Safaga', 'safaga', 'Wide bays and Sharm El Naga beach nature reserve', 'A quieter coastal area south of Hurghada, home to the protected Sharm El Naga marine bay where you snorkel right from the sand.', 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80', ARRAY['https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80'], '45 mins south of Hurghada (HRG)', 'published', 5),
('a1000000-0000-0000-0000-000000000007', 'Marsa Alam', 'marsa-alam', 'Protected marine bays with sea turtles and wild dolphins', 'Egypt’s southern marine destination where wild spinner dolphins, sea turtles, and untouched reefs thrive.', 'https://images.unsplash.com/photo-1682687220063-4742bd7fd538?auto=format&fit=crop&w=800&q=80', ARRAY['https://images.unsplash.com/photo-1682687220063-4742bd7fd538?auto=format&fit=crop&w=800&q=80'], '10-45 mins from Marsa Alam Airport (RMF)', 'published', 6),
('a1000000-0000-0000-0000-000000000006', 'Sharm El-Sheikh', 'sharm-el-sheikh', 'Sinai marine jewel with Ras Mohammed drop-offs & White Island', 'The premier resort of the southern Sinai peninsula, famed for dramatic drop-off reef walls at Ras Mohammed National Park, the crystal waters of White Island, and the straits of Tiran.', 'https://images.unsplash.com/photo-1544551763-77ef2d0cfc6c?auto=format&fit=crop&w=800&q=80', ARRAY['https://images.unsplash.com/photo-1544551763-77ef2d0cfc6c?auto=format&fit=crop&w=800&q=80'], '15 mins from Sharm El-Sheikh Airport (SSH)', 'published', 7)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, status = EXCLUDED.status;

-- 2. CATEGORIES (All 6 Primary Categories)
INSERT INTO public.categories (id, name, slug, description, image, icon_name, status, sort_order)
VALUES
('c1000000-0000-0000-0000-000000000001', 'Boat Trips', 'boat-trips', 'Full-day motor yachts, catamarans, and island-hopping trips with sun decks and open buffet lunches.', 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=600&q=80', 'Ship', 'published', 1),
('c1000000-0000-0000-0000-000000000002', 'Snorkeling', 'snorkeling', 'Guided encounters with clownfish, rays, and sea turtles over vibrant shallow coral gardens.', 'https://images.unsplash.com/photo-1544551763-77ef2d0cfc6c?auto=format&fit=crop&w=600&q=80', 'Waves', 'published', 2),
('c1000000-0000-0000-0000-000000000003', 'Diving', 'diving', 'Certified 2-tank boat dives and beginner intro discovery dives led by PADI divemasters.', 'https://images.unsplash.com/photo-1544551763-92ab472cad5d?auto=format&fit=crop&w=600&q=80', 'Compass', 'published', 3),
('c1000000-0000-0000-0000-000000000004', 'Safari', 'safari', 'ATV quad biking through Red Sea mountain canyons, Bedouin camp visits, camel rides & stargazing.', 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=600&q=80', 'Sun', 'published', 4),
('c1000000-0000-0000-0000-000000000005', 'Private Tours', 'private-tours', 'Tailored private yachts and high-speed RIBs for couples, families, and custom itineraries.', 'https://images.unsplash.com/photo-1569263979104-865ab7cd8d17?auto=format&fit=crop&w=600&q=80', 'Anchor', 'published', 5),
('c1000000-0000-0000-0000-000000000006', 'Water Sports', 'water-sports', 'Parasailing, glass-bottom boats, and banana boat adventures for the entire family.', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80', 'Waves', 'published', 6)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- 3. PICKUP LOCATIONS
INSERT INTO public.pickup_locations (id, code, name, area, fee_eur_per_person, fee_eur_flat, description, is_active, sort_order)
VALUES
('b1000000-0000-0000-0000-000000000001', 'hurghada', 'Hurghada Hotels (Central)', 'Hurghada (Mamsha, Dahar, Sheraton, Marina)', 0.00, 0.00, 'Complimentary return transfer included from all standard Hurghada hotel lobbies.', TRUE, 1),
('b1000000-0000-0000-0000-000000000002', 'el-gouna', 'El Gouna Resorts', 'El Gouna Peninsula & Lagoons', 5.00, 0.00, 'Transfers from northern El Gouna resorts to Hurghada Marina.', TRUE, 2),
('b1000000-0000-0000-0000-000000000003', 'makadi-bay', 'Makadi Bay Resorts', 'Makadi Bay Coast', 5.00, 0.00, 'Air-conditioned shuttle from Makadi Bay resorts.', TRUE, 3),
('b1000000-0000-0000-0000-000000000004', 'sahl-hasheesh', 'Sahl Hasheesh Resorts', 'Sahl Hasheesh Old Town & Promenade', 5.00, 0.00, 'Transfers from Sahl Hasheesh gate hotels.', TRUE, 4),
('b1000000-0000-0000-0000-000000000005', 'safaga', 'Safaga & Soma Bay', 'Soma Bay Peninsula & Safaga Port', 10.00, 0.00, 'Dedicated long-range transport service.', TRUE, 5),
('b1000000-0000-0000-0000-000000000006', 'sharm-el-sheikh', 'Sharm El-Sheikh Hotels (All Zones)', 'Naama Bay, Nabq Bay, Sharks Bay, Hadaba, Ras Um Sid', 0.00, 0.00, 'Complimentary return transfer included from all Sharm El-Sheikh hotel lobbies.', TRUE, 6)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- 4. TOUR EXTRAS
INSERT INTO public.tour_extras (id, name, description, price_eur, currency, pricing_type, is_active, sort_order)
VALUES
('e1000000-0000-0000-0000-000000000001', 'GoPro Underwater Camera Rental (16GB SD Included)', 'Full day waterproof 4K camera rental. Keep the 16GB micro-SD card loaded with your coral reef clips.', 25.00, 'EUR', 'per_booking', TRUE, 1),
('e1000000-0000-0000-0000-000000000002', 'Private VIP Van Transfer Upgrade', 'Upgrade your group transfer to a private luxury Mercedes/HiAce van direct from hotel to vessel without intermediate hotel stops.', 30.00, 'EUR', 'per_booking', TRUE, 2),
('e1000000-0000-0000-0000-000000000003', 'Fresh Grilled Jumbo Shrimp & Calamari Lunch Upgrade', 'Add a sizzling platter of freshly grilled Mediterranean jumbo prawns, calamari, and seafood soup to your onboard lunch.', 15.00, 'EUR', 'per_person', TRUE, 3),
('e1000000-0000-0000-0000-000000000004', 'Introductory Scuba Dive (20 Minutes Guided)', 'Experience real underwater breathing with a certified PADI instructor. No license or prior experience required.', 20.00, 'EUR', 'per_person', TRUE, 4)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- 5. TOURS (All 13 Authoritative Excursions)
INSERT INTO public.tours (
    id, title, slug, short_description, description, destination_id,
    duration, duration_type, duration_hours, tour_type, status, featured,
    price, child_price, infant_price, private_price, currency,
    max_guests, minimum_booking_notice_hours, pickup_available, pickup_info,
    cancellation_policy, departure_time, badge, rating, review_count, sort_order
)
VALUES
('10000000-0000-0000-0000-000000000001', 'Orange Bay Island & Snorkeling', 'orange-bay-island-snorkeling', 'Take a boat trip to Giftun Island’s Orange Bay beach with shallow turquoise water, two guided snorkeling stops at coral reefs, and buffet lunch onboard.', 'Spend a relaxing day sailing across the Red Sea to Giftun Island. Disembark at Orange Bay where wooden swings, shallow white sandbars, and shaded beanbag cabanas await. Enjoy two hours of island leisure before re-boarding for a freshly prepared buffet lunch and two distinct open-sea snorkeling sessions over living coral heads.', 'a1000000-0000-0000-0000-000000000001', 'Full Day (approx. 7 hours)', 'hours', 7, 'shared', 'published', TRUE, 35.00, 18.00, 0.00, 260.00, 'EUR', 35, 12, TRUE, 'Complimentary hotel transfer across standard resort lobbies included.', 'Free cancellation up to 24 hours prior to excursion departure', '08:30 AM', 'Popular', 4.80, 126, 1),
('10000000-0000-0000-0000-000000000002', 'Paradise Island Snorkeling Trip', 'paradise-island-snorkeling-trip', 'Sail to Paradise Beach on Giftun Island with white sand, parasols, folklore dance show, and two coral reef snorkeling stops.', 'Visit Paradise Beach on Giftun Island for a relaxing beach day. Enjoy 2.5 hours on the white sand with shaded parasols and calm water for swimming. The boat stops at two coral reefs along the way where guides help you spot reef fish, followed by a warm buffet lunch on the yacht.', 'a1000000-0000-0000-0000-000000000001', 'Full Day (approx. 7 hours)', 'hours', 7, 'shared', 'published', TRUE, 32.00, 16.00, 0.00, 240.00, 'EUR', 35, 12, TRUE, 'Complimentary hotel transfer across standard resort lobbies included.', 'Free cancellation up to 24 hours prior to excursion departure', '08:30 AM', 'Great Value', 4.70, 98, 2),
('10000000-0000-0000-0000-000000000003', 'Dolphin House Snorkeling', 'dolphin-house-snorkeling', 'Take a boat trip to Shaab El Erg reef to see wild dolphins in open water, with two coral snorkeling stops and lunch.', 'Shaab El Erg is a protected reef where pods of spinner dolphins rest and swim. We travel by comfortable boat to observe dolphins in their natural environment without chasing. Guided snorkeling stops follow over colorful coral reefs, with an open buffet lunch and water sports onboard.', 'a1000000-0000-0000-0000-000000000001', 'Full Day (approx. 7.5 hours)', 'hours', 8, 'shared', 'published', TRUE, 40.00, 20.00, 0.00, 310.00, 'EUR', 35, 12, TRUE, 'Complimentary hotel transfer across standard resort lobbies included.', 'Free cancellation up to 24 hours prior to excursion departure', '08:30 AM', 'Top Rated', 4.90, 154, 3),
('10000000-0000-0000-0000-000000000004', 'Giftun Island Boat Trip', 'giftun-island-boat-trip', 'The classic Red Sea boat trip featuring sandbar swimming on Giftun Island National Park, relaxing on sun decks, and snorkeling over living coral.', 'Giftun Island is the quintessential Red Sea excursion. Set out from the marina on a spacious double-decker boat, soak up the sun on open decks, and spend over an hour on the island’s sandy shores before heading to two prime snorkeling reefs.', 'a1000000-0000-0000-0000-000000000001', 'Full Day (approx. 7 hours)', 'hours', 7, 'shared', 'published', TRUE, 30.00, 15.00, 0.00, 230.00, 'EUR', 35, 12, TRUE, 'Complimentary hotel transfer across standard resort lobbies included.', 'Free cancellation up to 24 hours prior to excursion departure', '08:30 AM', 'Classic', 4.70, 87, 4),
('10000000-0000-0000-0000-000000000005', 'Desert Quad Safari', 'desert-quad-safari', 'Ride a 250cc ATV quad bike across desert trails and mountain canyons. Includes test drive and Bedouin tea.', 'Drive a quad bike through the Eastern Desert near Hurghada. After a safety briefing and practice drive at the safari center, follow your guide through wide gravel trails and natural valleys framed by mountains. Stop at a Bedouin tent for herbal tea and rest before riding back.', 'a1000000-0000-0000-0000-000000000001', 'Half Day (approx. 3.5 hours)', 'hours', 4, 'shared', 'published', FALSE, 28.00, 15.00, 0.00, 160.00, 'EUR', 35, 12, TRUE, 'Complimentary hotel transfer across standard resort lobbies included.', 'Free cancellation up to 24 hours prior to excursion departure', '08:30 AM', 'Adventure', 4.80, 112, 5),
('10000000-0000-0000-0000-000000000006', 'Desert Safari & Bedouin Experience', 'desert-safari-bedouin-experience', 'Quad biking, spider dune buggy driving, camel ride, Bedouin village visit, BBQ dinner, and evening folklore show.', 'An afternoon and evening tour in the desert. Drive a quad bike and dune buggy, visit a Bedouin village to see how bread is baked on iron plates, ride a camel at sunset, and dine on an open-air barbecue buffet with music and folklore performances.', 'a1000000-0000-0000-0000-000000000001', 'Half Day (approx. 5 hours)', 'hours', 5, 'shared', 'published', FALSE, 35.00, 18.00, 0.00, 210.00, 'EUR', 35, 12, TRUE, 'Complimentary hotel transfer across standard resort lobbies included.', 'Free cancellation up to 24 hours prior to excursion departure', '08:30 AM', 'Sunset Special', 4.80, 91, 6),
('10000000-0000-0000-0000-000000000007', 'Private Red Sea Yacht', 'private-red-sea-yacht', 'Private yacht charter for up to 8 guests. Choose your stops, snorkel quiet reefs, and enjoy a freshly cooked lunch.', 'Rent a private yacht exclusively for your family or friends. Your captain coordinates the route according to your wishes—visit secluded sandbars, Orange Bay, or quiet snorkeling reefs away from crowds. The onboard cook prepares a fresh lunch while you swim and relax on the sun deck.', 'a1000000-0000-0000-0000-000000000001', 'Full Day (approx. 8 hours)', 'hours', 8, 'private', 'published', FALSE, 250.00, 0.00, 0.00, 250.00, 'EUR', 35, 12, TRUE, 'Complimentary hotel transfer across standard resort lobbies included.', 'Free cancellation up to 24 hours prior to excursion departure', '08:30 AM', 'VIP Private', 5.00, 24, 7),
('10000000-0000-0000-0000-000000000008', 'El Gouna Private Boat Trip', 'el-gouna-private-boat-trip', 'Private cruiser departing Abu Tig Marina. Cruise through El Gouna channels, visit quiet northern reefs, and relax on sandbars.', 'Depart directly from Abu Tig Marina in El Gouna on a private boat for up to 6 guests. Cruise along lagoon waterways into open water to snorkel northern reefs known for clear visibility and marine life. Includes soft drinks, fruit platter, and snorkeling gear.', 'a1000000-0000-0000-0000-000000000002', 'Full Day (approx. 6 hours)', 'hours', 6, 'private', 'published', FALSE, 220.00, 0.00, 0.00, 220.00, 'EUR', 35, 12, TRUE, 'Complimentary hotel transfer across standard resort lobbies included.', 'Free cancellation up to 24 hours prior to excursion departure', '08:30 AM', 'Boutique', 4.90, 31, 8),
('10000000-0000-0000-0000-000000000009', 'Introductory Scuba Diving Experience', 'introductory-scuba-diving-experience', 'No license needed. Try scuba diving with a certified PADI instructor by your side. Includes 2 shallow boat dives and lunch.', 'Designed for complete beginners who want to try scuba diving safely. On the cruise out, your instructor explains breathing, equalizing, and hand signals. You do two separate 20-minute shallow dives (max 6-7 meters) with your instructor holding your hand throughout. Between dives, relax on the sun deck and enjoy lunch.', 'a1000000-0000-0000-0000-000000000001', 'Full Day (approx. 8 hours)', 'hours', 8, 'shared', 'published', FALSE, 65.00, 45.00, 0.00, 340.00, 'EUR', 35, 12, TRUE, 'Complimentary hotel transfer across standard resort lobbies included.', 'Free cancellation up to 24 hours prior to excursion departure', '08:30 AM', 'Instructor Led', 4.90, 143, 9),
('10000000-0000-0000-0000-000000000010', 'Marsa Alam Dolphin House', 'marsa-alam-dolphin-house', 'Sail to the protected Sha’ab Samadai marine reserve to snorkel near wild dolphins in calm natural lagoons.', 'Sha’ab Samadai is a protected marine reserve in southern Egypt where families of spinner dolphins rest in natural lagoons. Snorkel in the designated lagoon zone with marine guides, then explore outer coral drop-offs. Includes hotel pickup across Marsa Alam and lunch onboard.', 'a1000000-0000-0000-0000-000000000007', 'Full Day (approx. 8 hours)', 'hours', 8, 'shared', 'published', FALSE, 55.00, 28.00, 0.00, 380.00, 'EUR', 35, 12, TRUE, 'Complimentary hotel transfer across standard resort lobbies included.', 'Free cancellation up to 24 hours prior to excursion departure', '08:30 AM', 'Marine Reserve', 4.80, 76, 10),
('10000000-0000-0000-0000-000000000011', 'Sharm El Naga Beach & Snorkeling Day', 'sharm-el-naga-beach-reef-day', 'Snorkel straight from a sandy beach without a boat. Includes private bay entry, sun loungers, swimming pool, and lunch.', 'Sharm El Naga is a protected bay south of Hurghada where coral reefs grow just a few meters from the shore. Ideal for families, children, and travelers who prefer walking into the water from the beach rather than taking a boat. Loungers, freshwater pool, and restaurant buffet lunch are included.', 'a1000000-0000-0000-0000-000000000005', 'Full Day (approx. 7 hours)', 'hours', 7, 'shared', 'published', FALSE, 38.00, 20.00, 0.00, 220.00, 'EUR', 35, 12, TRUE, 'Complimentary hotel transfer across standard resort lobbies included.', 'Free cancellation up to 24 hours prior to excursion departure', '08:30 AM', 'Shore Entry', 4.80, 62, 11),
('10000000-0000-0000-0000-000000000012', 'Sahl Hasheesh Glass Bottom Boat', 'sahl-hasheesh-glass-bottom-boat', 'View corals and fish through underwater glass windows without getting wet. Sail past sunken pillars with an optional swim stop.', 'Great for children, non-swimmers, and anyone wanting a short 2.5-hour trip. Look through deep panoramic glass panels to watch coral reefs and marine life in calm bay waters. Includes a short swimming stop and hotel transfer.', 'a1000000-0000-0000-0000-000000000004', 'Half Day (approx. 2.5 hours)', 'hours', 3, 'shared', 'published', FALSE, 25.00, 12.00, 0.00, 140.00, 'EUR', 35, 12, TRUE, 'Complimentary hotel transfer across standard resort lobbies included.', 'Free cancellation up to 24 hours prior to excursion departure', '08:30 AM', 'Family Favorite', 4.70, 45, 12),
('10000000-0000-0000-0000-000000000013', 'Ras Mohammed National Park & White Island Luxury Yacht Cruise', 'ras-mohammed-white-island-cruise', 'Cruise through the marine sanctuary of Ras Mohammed National Park, step onto the crystal sandbar of White Island, snorkel coral walls, and enjoy an onboard seafood buffet.', 'Sail along the dramatic coastline of South Sinai into the protected marine sanctuary of Ras Mohammed National Park. Cruise to the famous White Island sandbar, explore vibrant coral reef walls, and enjoy a freshly prepared open seafood & grill buffet onboard.', 'a1000000-0000-0000-0000-000000000006', 'Full Day (approx. 8 hours)', 'hours', 8, 'shared', 'published', FALSE, 45.00, 25.00, 0.00, 380.00, 'EUR', 35, 12, TRUE, 'Complimentary hotel transfer across standard resort lobbies included.', 'Free cancellation up to 24 hours prior to excursion departure', '08:30 AM', 'Best in Sharm', 4.90, 168, 13)
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, price = EXCLUDED.price, destination_id = EXCLUDED.destination_id;

-- 6. TOUR CATEGORIES LINK TABLE
INSERT INTO public.tour_categories (tour_id, category_id)
VALUES
('10000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001'),
('10000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002'),
('10000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001'),
('10000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000001'),
('10000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000002'),
('10000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000001'),
('10000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000002'),
('10000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000001'),
('10000000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000001'),
('10000000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000001'),
('10000000-0000-0000-0000-000000000005', 'c1000000-0000-0000-0000-000000000004'),
('10000000-0000-0000-0000-000000000005', 'c1000000-0000-0000-0000-000000000004'),
('10000000-0000-0000-0000-000000000006', 'c1000000-0000-0000-0000-000000000004'),
('10000000-0000-0000-0000-000000000006', 'c1000000-0000-0000-0000-000000000004'),
('10000000-0000-0000-0000-000000000007', 'c1000000-0000-0000-0000-000000000005'),
('10000000-0000-0000-0000-000000000007', 'c1000000-0000-0000-0000-000000000001'),
('10000000-0000-0000-0000-000000000008', 'c1000000-0000-0000-0000-000000000005'),
('10000000-0000-0000-0000-000000000008', 'c1000000-0000-0000-0000-000000000001'),
('10000000-0000-0000-0000-000000000009', 'c1000000-0000-0000-0000-000000000003'),
('10000000-0000-0000-0000-000000000009', 'c1000000-0000-0000-0000-000000000001'),
('10000000-0000-0000-0000-000000000010', 'c1000000-0000-0000-0000-000000000002'),
('10000000-0000-0000-0000-000000000010', 'c1000000-0000-0000-0000-000000000001'),
('10000000-0000-0000-0000-000000000011', 'c1000000-0000-0000-0000-000000000002'),
('10000000-0000-0000-0000-000000000011', 'c1000000-0000-0000-0000-000000000001'),
('10000000-0000-0000-0000-000000000012', 'c1000000-0000-0000-0000-000000000006'),
('10000000-0000-0000-0000-000000000012', 'c1000000-0000-0000-0000-000000000001'),
('10000000-0000-0000-0000-000000000013', 'c1000000-0000-0000-0000-000000000001'),
('10000000-0000-0000-0000-000000000013', 'c1000000-0000-0000-0000-000000000002'),
('10000000-0000-0000-0000-000000000013', 'c1000000-0000-0000-0000-000000000001')
ON CONFLICT (tour_id, category_id) DO NOTHING;

-- 7. TOUR IMAGES
INSERT INTO public.tour_images (tour_id, image_url, alt_text, caption, is_primary, sort_order)
VALUES
('10000000-0000-0000-0000-000000000001', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80', 'Orange Bay Island & Snorkeling primary photo', 'Orange Bay Island & Snorkeling', TRUE, 1),
('10000000-0000-0000-0000-000000000001', 'https://images.unsplash.com/photo-1544551763-77ef2d0cfc6c?auto=format&fit=crop&w=1200&q=80', 'Orange Bay Island & Snorkeling gallery photo 2', 'Orange Bay Island & Snorkeling', FALSE, 3),
('10000000-0000-0000-0000-000000000001', 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80', 'Orange Bay Island & Snorkeling gallery photo 3', 'Orange Bay Island & Snorkeling', FALSE, 4),
('10000000-0000-0000-0000-000000000001', 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=1200&q=80', 'Orange Bay Island & Snorkeling gallery photo 4', 'Orange Bay Island & Snorkeling', FALSE, 5),
('10000000-0000-0000-0000-000000000002', 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80', 'Paradise Island Snorkeling Trip primary photo', 'Paradise Island Snorkeling Trip', TRUE, 1),
('10000000-0000-0000-0000-000000000002', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80', 'Paradise Island Snorkeling Trip gallery photo 2', 'Paradise Island Snorkeling Trip', FALSE, 3),
('10000000-0000-0000-0000-000000000002', 'https://images.unsplash.com/photo-1544551763-77ef2d0cfc6c?auto=format&fit=crop&w=1200&q=80', 'Paradise Island Snorkeling Trip gallery photo 3', 'Paradise Island Snorkeling Trip', FALSE, 4),
('10000000-0000-0000-0000-000000000003', 'https://images.unsplash.com/photo-1544551763-77ef2d0cfc6c?auto=format&fit=crop&w=1200&q=80', 'Dolphin House Snorkeling primary photo', 'Dolphin House Snorkeling', TRUE, 1),
('10000000-0000-0000-0000-000000000003', 'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?auto=format&fit=crop&w=1200&q=80', 'Dolphin House Snorkeling gallery photo 2', 'Dolphin House Snorkeling', FALSE, 3),
('10000000-0000-0000-0000-000000000003', 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80', 'Dolphin House Snorkeling gallery photo 3', 'Dolphin House Snorkeling', FALSE, 4),
('10000000-0000-0000-0000-000000000004', 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80', 'Giftun Island Boat Trip primary photo', 'Giftun Island Boat Trip', TRUE, 1),
('10000000-0000-0000-0000-000000000004', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80', 'Giftun Island Boat Trip gallery photo 2', 'Giftun Island Boat Trip', FALSE, 3),
('10000000-0000-0000-0000-000000000005', 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=1200&q=80', 'Desert Quad Safari primary photo', 'Desert Quad Safari', TRUE, 1),
('10000000-0000-0000-0000-000000000005', 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80', 'Desert Quad Safari gallery photo 2', 'Desert Quad Safari', FALSE, 3),
('10000000-0000-0000-0000-000000000006', 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80', 'Desert Safari & Bedouin Experience primary photo', 'Desert Safari & Bedouin Experience', TRUE, 1),
('10000000-0000-0000-0000-000000000006', 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=1200&q=80', 'Desert Safari & Bedouin Experience gallery photo 2', 'Desert Safari & Bedouin Experience', FALSE, 3),
('10000000-0000-0000-0000-000000000007', 'https://images.unsplash.com/photo-1569263979104-865ab7cd8d17?auto=format&fit=crop&w=1200&q=80', 'Private Red Sea Yacht primary photo', 'Private Red Sea Yacht', TRUE, 1),
('10000000-0000-0000-0000-000000000007', 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80', 'Private Red Sea Yacht gallery photo 2', 'Private Red Sea Yacht', FALSE, 3),
('10000000-0000-0000-0000-000000000008', 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=1200&q=80', 'El Gouna Private Boat Trip primary photo', 'El Gouna Private Boat Trip', TRUE, 1),
('10000000-0000-0000-0000-000000000008', 'https://images.unsplash.com/photo-1569263979104-865ab7cd8d17?auto=format&fit=crop&w=1200&q=80', 'El Gouna Private Boat Trip gallery photo 2', 'El Gouna Private Boat Trip', FALSE, 3),
('10000000-0000-0000-0000-000000000009', 'https://images.unsplash.com/photo-1544551763-92ab472cad5d?auto=format&fit=crop&w=1200&q=80', 'Introductory Scuba Diving Experience primary photo', 'Introductory Scuba Diving Experience', TRUE, 1),
('10000000-0000-0000-0000-000000000009', 'https://images.unsplash.com/photo-1544551763-77ef2d0cfc6c?auto=format&fit=crop&w=1200&q=80', 'Introductory Scuba Diving Experience gallery photo 2', 'Introductory Scuba Diving Experience', FALSE, 3),
('10000000-0000-0000-0000-000000000010', 'https://images.unsplash.com/photo-1682687220063-4742bd7fd538?auto=format&fit=crop&w=1200&q=80', 'Marsa Alam Dolphin House primary photo', 'Marsa Alam Dolphin House', TRUE, 1),
('10000000-0000-0000-0000-000000000010', 'https://images.unsplash.com/photo-1544551763-77ef2d0cfc6c?auto=format&fit=crop&w=1200&q=80', 'Marsa Alam Dolphin House gallery photo 2', 'Marsa Alam Dolphin House', FALSE, 3),
('10000000-0000-0000-0000-000000000011', 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80', 'Sharm El Naga Beach & Snorkeling Day primary photo', 'Sharm El Naga Beach & Snorkeling Day', TRUE, 1),
('10000000-0000-0000-0000-000000000011', 'https://images.unsplash.com/photo-1544551763-77ef2d0cfc6c?auto=format&fit=crop&w=1200&q=80', 'Sharm El Naga Beach & Snorkeling Day gallery photo 2', 'Sharm El Naga Beach & Snorkeling Day', FALSE, 3),
('10000000-0000-0000-0000-000000000012', 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80', 'Sahl Hasheesh Glass Bottom Boat primary photo', 'Sahl Hasheesh Glass Bottom Boat', TRUE, 1),
('10000000-0000-0000-0000-000000000013', 'https://images.unsplash.com/photo-1544551763-77ef2d0cfc6c?auto=format&fit=crop&w=1200&q=80', 'Ras Mohammed National Park & White Island Luxury Yacht Cruise primary photo', 'Ras Mohammed National Park & White Island Luxury Yacht Cruise', TRUE, 1),
('10000000-0000-0000-0000-000000000013', 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80', 'Ras Mohammed National Park & White Island Luxury Yacht Cruise gallery photo 1', 'Ras Mohammed National Park & White Island Luxury Yacht Cruise', FALSE, 2),
('10000000-0000-0000-0000-000000000013', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80', 'Ras Mohammed National Park & White Island Luxury Yacht Cruise gallery photo 2', 'Ras Mohammed National Park & White Island Luxury Yacht Cruise', FALSE, 3),
('10000000-0000-0000-0000-000000000013', 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=1200&q=80', 'Ras Mohammed National Park & White Island Luxury Yacht Cruise gallery photo 3', 'Ras Mohammed National Park & White Island Luxury Yacht Cruise', FALSE, 4)
ON CONFLICT DO NOTHING;

-- 8. TOUR HIGHLIGHTS
INSERT INTO public.tour_highlights (tour_id, item, sort_order)
VALUES
('10000000-0000-0000-0000-000000000001', '2 hours on Orange Bay beach with shaded loungers and shallow turquoise water', 1),
('10000000-0000-0000-0000-000000000001', 'Two 45-minute guided snorkeling stops at vibrant offshore reefs', 2),
('10000000-0000-0000-0000-000000000001', 'Fresh open buffet lunch served onboard with soft drinks & bottled water', 3),
('10000000-0000-0000-0000-000000000001', 'Complimentary snorkeling equipment and flotation jackets provided', 4),
('10000000-0000-0000-0000-000000000001', 'Hotel lobby pickup and return across Hurghada included', 5),
('10000000-0000-0000-0000-000000000002', '2.5 hours at Paradise Beach on Giftun Island', 1),
('10000000-0000-0000-0000-000000000002', 'Two stops at protected coral gardens with guide', 2),
('10000000-0000-0000-0000-000000000002', 'Oriental folkloric show and music on the beach', 3),
('10000000-0000-0000-0000-000000000002', 'Open buffet lunch on the boat with hot drinks', 4),
('10000000-0000-0000-0000-000000000002', 'Hotel pickup and drop-off included', 5),
('10000000-0000-0000-0000-000000000003', 'Observe pods of wild dolphins in their natural habitat', 1),
('10000000-0000-0000-0000-000000000003', 'Two guided reef snorkeling stops with marine guides', 2),
('10000000-0000-0000-0000-000000000003', 'Sanitized premium masks, fins, and life jackets', 3),
('10000000-0000-0000-0000-000000000003', 'Hot buffet lunch and unlimited refreshments onboard', 4),
('10000000-0000-0000-0000-000000000003', 'Banana boat and sofa water ride included', 5),
('10000000-0000-0000-0000-000000000004', 'Relaxation on Giftun Island National Park sandbars', 1),
('10000000-0000-0000-0000-000000000004', 'Two coral snorkeling sessions with guide', 2),
('10000000-0000-0000-0000-000000000004', 'Open buffet lunch and refreshments included', 3),
('10000000-0000-0000-0000-000000000004', 'Hotel pickup and drop-off included', 4),
('10000000-0000-0000-0000-000000000005', 'Dedicated single quad bike for each participant', 1),
('10000000-0000-0000-0000-000000000005', 'Comprehensive safety test drive and instruction', 2),
('10000000-0000-0000-0000-000000000005', 'Approximately 45km total riding through scenic desert trails', 3),
('10000000-0000-0000-0000-000000000005', 'Traditional Bedouin herbal tea stop', 4),
('10000000-0000-0000-0000-000000000005', 'Round-trip hotel transfer included', 5),
('10000000-0000-0000-0000-000000000006', 'ATV quad ride and spider dune buggy drive', 1),
('10000000-0000-0000-0000-000000000006', 'Authentic Bedouin village tour with bread making demonstration', 2),
('10000000-0000-0000-0000-000000000006', 'Sunset camel ride across desert ridges', 3),
('10000000-0000-0000-0000-000000000006', 'Barbecue buffet dinner with soft drinks included', 4),
('10000000-0000-0000-0000-000000000006', 'Evening fire show and folkloric Tanoura performance', 5),
('10000000-0000-0000-0000-000000000007', 'Exclusive private yacht for your party only (up to 8 guests)', 1),
('10000000-0000-0000-0000-000000000007', 'Customized route: Orange Bay, Magawish, or Dolphin Reefs', 2),
('10000000-0000-0000-0000-000000000007', 'Private onboard chef preparing fresh gourmet lunch', 3),
('10000000-0000-0000-0000-000000000007', 'Snorkeling gear, fresh tropical fruits, and unlimited drinks', 4),
('10000000-0000-0000-0000-000000000007', 'Private Mercedes / minivan hotel transfers included', 5),
('10000000-0000-0000-0000-000000000008', 'Direct departure from Abu Tig Marina in El Gouna', 1),
('10000000-0000-0000-0000-000000000008', 'Private boat with sun shade and swimming ladder', 2),
('10000000-0000-0000-0000-000000000008', 'Explore quiet northern coral reefs and shallow sandbars', 3),
('10000000-0000-0000-0000-000000000008', 'Flexible departure time for your group', 4),
('10000000-0000-0000-0000-000000000008', 'Snorkeling equipment and cold drinks included', 5),
('10000000-0000-0000-0000-000000000009', 'No previous diving experience or swimming expertise required', 1),
('10000000-0000-0000-0000-000000000009', 'Two separate shallow dives with your own instructor', 2),
('10000000-0000-0000-0000-000000000009', 'Safe maximum depth of 6 to 7 meters', 3),
('10000000-0000-0000-0000-000000000009', 'Clean dive equipment, wetsuit, mask, and fins included', 4),
('10000000-0000-0000-0000-000000000009', 'Full-day boat cruise with open buffet lunch', 5),
('10000000-0000-0000-0000-000000000010', 'Protected national marine park with regulated dolphin access', 1),
('10000000-0000-0000-0000-000000000010', 'High chance to see spinner dolphins in calm waters', 2),
('10000000-0000-0000-0000-000000000010', 'Two guided snorkeling stops accompanied by marine guides', 3),
('10000000-0000-0000-0000-000000000010', 'Hot buffet lunch and cold drinks on the boat', 4),
('10000000-0000-0000-0000-000000000010', 'Hotel pickup and drop-off across Marsa Alam included', 5),
('10000000-0000-0000-0000-000000000011', 'Direct beach-entry snorkeling without needing a boat', 1),
('10000000-0000-0000-0000-000000000011', 'Access to fresh-water swimming pool, showers, and shaded loungers', 2),
('10000000-0000-0000-0000-000000000011', 'Buffet lunch served at beachfront restaurant', 3),
('10000000-0000-0000-0000-000000000011', 'Snorkeling gear and guide included', 4),
('10000000-0000-0000-0000-000000000012', 'Large submerged glass viewing windows', 1),
('10000000-0000-0000-0000-000000000012', 'Cruise past Sahl Hasheesh sunken columns', 2),
('10000000-0000-0000-0000-000000000012', 'Ideal for small children and non-swimmers', 3),
('10000000-0000-0000-0000-000000000012', 'Short 2.5-hour tour with hotel pickup', 4),
('10000000-0000-0000-0000-000000000013', 'Cruise to Ras Mohammed National Park, Egypt’s oldest protected marine reserve', 1),
('10000000-0000-0000-0000-000000000013', 'Walk on the pristine shifting sands of White Island', 2),
('10000000-0000-0000-0000-000000000013', 'Two guided reef drop-off snorkeling sessions at Shark & Yolanda Reefs', 3),
('10000000-0000-0000-0000-000000000013', 'Freshly prepared onboard buffet with seafood, grilled chicken, and fresh salads', 4),
('10000000-0000-0000-0000-000000000013', 'Complimentary hotel pickup and drop-off from any resort in Sharm El-Sheikh', 5)
ON CONFLICT DO NOTHING;

-- 9. TOUR ITINERARY
INSERT INTO public.tour_itinerary (tour_id, time, title, description, sort_order)
VALUES
('10000000-0000-0000-0000-000000000001', '08:00', 'Hotel pickup', 'Air-conditioned transfer from your resort lobby to Hurghada Marina.', 1),
('10000000-0000-0000-0000-000000000001', '09:00', 'Departure from marina', 'Safety briefing and scenic sail across the Red Sea toward Giftun Island.', 2),
('10000000-0000-0000-0000-000000000001', '10:00', 'First snorkeling stop', 'Guided reef snorkeling session observing parrotfish, rays, and clownfish.', 3),
('10000000-0000-0000-0000-000000000001', '12:30', 'Lunch onboard', 'Warm buffet lunch with fish, chicken, rice, salads, and seasonal fruits.', 4),
('10000000-0000-0000-0000-000000000001', '14:00', 'Island beach time', 'Disembark at Orange Bay for relaxation, photography, and swimming in shallow lagoons.', 5),
('10000000-0000-0000-0000-000000000001', '16:30', 'Return to marina', 'Leisurely cruise back as afternoon sun reflects on coastal mountains.', 6),
('10000000-0000-0000-0000-000000000001', '17:00', 'Hotel drop-off', 'Return transfer back to your hotel lobby.', 7),
('10000000-0000-0000-0000-000000000002', '08:30', 'Hotel pickup', 'Pickup from hotel and transfer to the pier.', 1),
('10000000-0000-0000-0000-000000000002', '09:30', 'Boat departure', 'Cruise across the Red Sea towards Giftun Island.', 2),
('10000000-0000-0000-0000-000000000002', '10:30', 'Reef snorkeling stop', '45 minutes over living coral formations.', 3),
('10000000-0000-0000-0000-000000000002', '12:00', 'Paradise Beach leisure', 'Sunbathing, beach volleyball, and optional beach bar refreshments.', 4),
('10000000-0000-0000-0000-000000000002', '14:30', 'Lunch onboard', 'Fresh buffet served in shaded dining salon.', 5),
('10000000-0000-0000-0000-000000000002', '15:30', 'Second snorkeling session', 'Exploring shallow reef pinnacles.', 6),
('10000000-0000-0000-0000-000000000002', '17:00', 'Return to hotel', 'Docking and transfer back to hotel.', 7),
('10000000-0000-0000-0000-000000000003', '08:00', 'Hotel pickup', 'Air-conditioned transfer from your resort.', 1),
('10000000-0000-0000-0000-000000000003', '09:00', 'Departure from marina', 'Cruising toward Shaab El Erg reef.', 2),
('10000000-0000-0000-0000-000000000003', '10:30', 'Dolphin observation lagoon', 'Search and swimming opportunities near dolphin pods.', 3),
('10000000-0000-0000-0000-000000000003', '12:30', 'Lunch onboard', 'Fresh hot buffet prepared by onboard chef.', 4),
('10000000-0000-0000-0000-000000000003', '13:45', 'Reef snorkeling stop', 'Guided exploration of vibrant coral walls.', 5),
('10000000-0000-0000-0000-000000000003', '15:15', 'Water sports fun', 'Banana boat and sofa ride behind speedboat.', 6),
('10000000-0000-0000-0000-000000000003', '16:30', 'Return to marina', 'Disembarkation and hotel transfer.', 7),
('10000000-0000-0000-0000-000000000004', '08:30', 'Pickup from hotel', 'Lobby pickup and transfer to boat pier.', 1),
('10000000-0000-0000-0000-000000000004', '09:30', 'Cruise departure', 'Scenic sail across calm coastal waters.', 2),
('10000000-0000-0000-0000-000000000004', '11:00', 'Giftun Island stop', 'Swim and relax on the sandy beach.', 3),
('10000000-0000-0000-0000-000000000004', '13:00', 'Buffet lunch', 'Warm lunch onboard.', 4),
('10000000-0000-0000-0000-000000000004', '14:15', 'Reef snorkeling', 'Exploring colorful coral gardens.', 5),
('10000000-0000-0000-0000-000000000004', '16:00', 'Return cruise', 'Sail back to Hurghada pier.', 6),
('10000000-0000-0000-0000-000000000005', '08:00 or 14:00', 'Hotel pickup', 'Air-conditioned transfer to desert base station.', 1),
('10000000-0000-0000-0000-000000000005', '08:45 or 14:45', 'Safety briefing & test drive', 'Learn controls and practice in enclosed training yard.', 2),
('10000000-0000-0000-0000-000000000005', '09:15 or 15:15', 'Quad trail ride', 'Guided convoy across wide sand plains and rocky valleys.', 3),
('10000000-0000-0000-0000-000000000005', '10:30 or 16:30', 'Bedouin tent break', 'Rest, herbal tea, and photo opportunities.', 4),
('10000000-0000-0000-0000-000000000005', '11:15 or 17:15', 'Return ride & hotel drop-off', 'Ride back to safari center and transfer to hotel.', 5),
('10000000-0000-0000-0000-000000000006', '13:30', 'Hotel pickup', 'Transfer from resort lobby to safari station.', 1),
('10000000-0000-0000-0000-000000000006', '14:30', 'Quad & buggy drives', 'Action-packed driving across desert trails.', 2),
('10000000-0000-0000-0000-000000000006', '16:00', 'Bedouin village arrival', 'Tour village, pharmacy, and taste fresh flatbread.', 3),
('10000000-0000-0000-0000-000000000006', '17:00', 'Sunset camel ride', 'Scenic ride as sun sinks behind mountain ridge.', 4),
('10000000-0000-0000-0000-000000000006', '18:00', 'BBQ dinner & show', 'Open-air buffet dinner and folkloric show.', 5),
('10000000-0000-0000-0000-000000000006', '19:30', 'Return transfer', 'Drop-off at your hotel.', 6),
('10000000-0000-0000-0000-000000000007', '09:00', 'Private hotel transfer', 'Direct pickup in private executive vehicle.', 1),
('10000000-0000-0000-0000-000000000007', '09:45', 'Boarding & captain consultation', 'Discuss preferred stops and customize your itinerary.', 2),
('10000000-0000-0000-0000-000000000007', '10:30', 'Secluded reef snorkeling', 'Anchor at quiet reef away from group boats.', 3),
('10000000-0000-0000-0000-000000000007', '13:00', 'Fresh gourmet lunch', 'Seafood and barbecue prepared by private cook.', 4),
('10000000-0000-0000-0000-000000000007', '14:30', 'Sandbar or island stop', 'Swim in shallow turquoise waters at your leisure.', 5),
('10000000-0000-0000-0000-000000000007', '16:45', 'Sunset cruise to marina', 'Champagne or fresh juice toast during return sail.', 6),
('10000000-0000-0000-0000-000000000008', '09:30', 'Pickup or Marina meet', 'Meet captain at Abu Tig Marina Berth 4.', 1),
('10000000-0000-0000-0000-000000000008', '10:00', 'Lagoon & coastal cruise', 'Scenic pass through El Gouna channels.', 2),
('10000000-0000-0000-0000-000000000008', '11:00', 'First reef stop', 'Snorkeling over pristine northern corals.', 3),
('10000000-0000-0000-0000-000000000008', '13:00', 'Sandbar lunch break', 'Sandwiches, fresh fruit platter, and cold drinks.', 4),
('10000000-0000-0000-0000-000000000008', '14:30', 'Second snorkeling stop', 'Search for turtles and rays in calm waters.', 5),
('10000000-0000-0000-0000-000000000008', '16:00', 'Return to Abu Tig Marina', 'Docking and transfer.', 6),
('10000000-0000-0000-0000-000000000009', '08:00', 'Hotel transfer', 'Pickup and transfer to dive boat.', 1),
('10000000-0000-0000-0000-000000000009', '09:00', 'Departure & theory briefing', 'Instructor explains breathing, equalization, and hand signals.', 2),
('10000000-0000-0000-0000-000000000009', '10:30', 'First introductory dive', '20 minutes hand-in-hand underwater at shallow reef.', 3),
('10000000-0000-0000-0000-000000000009', '12:30', 'Buffet lunch onboard', 'Rest on sun deck and enjoy warm lunch.', 4),
('10000000-0000-0000-0000-000000000009', '14:00', 'Second dive or snorkeling', 'Second guided dive exploring coral pinnacle.', 5),
('10000000-0000-0000-0000-000000000009', '16:30', 'Return to harbor', 'Docking and transfer back to hotel.', 6),
('10000000-0000-0000-0000-000000000010', '07:30', 'Hotel pickup', 'Transfer to Marsa Alam marina pier.', 1),
('10000000-0000-0000-0000-000000000010', '08:30', 'Sail to Samadai Reef', 'Cruising toward the offshore horseshoe reef.', 2),
('10000000-0000-0000-0000-000000000010', '10:00', 'First dolphin snorkeling', 'Snorkeling in the designated tourist zone of Samadai.', 3),
('10000000-0000-0000-0000-000000000010', '12:30', 'Buffet lunch onboard', 'Warm lunch served on the boat.', 4),
('10000000-0000-0000-0000-000000000010', '14:00', 'Second coral reef stop', 'Explore steep coral walls on the outer reef.', 5),
('10000000-0000-0000-0000-000000000010', '16:00', 'Return to marina', 'Transfer back to hotel.', 6),
('10000000-0000-0000-0000-000000000011', '08:30', 'Hotel transfer', 'Air-conditioned transfer to Sharm El Naga bay.', 1),
('10000000-0000-0000-0000-000000000011', '09:30', 'Beach arrival & briefing', 'Settle into loungers and receive snorkeling equipment.', 2),
('10000000-0000-0000-0000-000000000011', '10:30', 'Guided shore snorkeling', 'Explore the drop-off with guide.', 3),
('10000000-0000-0000-0000-000000000011', '13:00', 'Beachfront buffet lunch', 'Hot lunch at the reserve restaurant.', 4),
('10000000-0000-0000-0000-000000000011', '14:30', 'Free beach & pool time', 'Relaxation and secondary snorkeling.', 5),
('10000000-0000-0000-0000-000000000011', '16:00', 'Return transfer', 'Drop-off at your hotel.', 6),
('10000000-0000-0000-0000-000000000012', '10:00 or 14:00', 'Hotel pickup', 'Transfer to Sahl Hasheesh pier.', 1),
('10000000-0000-0000-0000-000000000012', '10:30 or 14:30', 'Boarding & glass viewing', 'Cruise over living reefs and sunken columns.', 2),
('10000000-0000-0000-0000-000000000012', '11:45 or 15:45', 'Optional swim stop', 'Jump into shallow calm water or stay on sun deck.', 3),
('10000000-0000-0000-0000-000000000012', '12:30 or 16:30', 'Return transfer', 'Back to hotel.', 4),
('10000000-0000-0000-0000-000000000013', '08:00', 'Hotel Pickup', 'Air-conditioned transfer from your Sharm resort to the marina.', 1),
('10000000-0000-0000-0000-000000000013', '09:00', 'Yacht Departure', 'Welcome briefing, safety orientation, and cruise out towards South Sinai.', 2),
('10000000-0000-0000-0000-000000000013', '10:30', 'First Snorkeling Session', 'Guided exploration along protected coral reef walls with clownfish and sea turtles.', 3),
('10000000-0000-0000-0000-000000000013', '12:00', 'White Island Sandbar Stop', 'Tender boat transfer to the turquoise shallows and sandbar of White Island.', 4),
('10000000-0000-0000-0000-000000000013', '13:30', 'Fresh Buffet Lunch Onboard', 'Generous open buffet featuring grilled fish, chicken, pastas, and oriental mezze.', 5),
('10000000-0000-0000-0000-000000000013', '14:45', 'Second Snorkeling Stop', 'Afternoon swim among sea fans and schooling anthias.', 6),
('10000000-0000-0000-0000-000000000013', '16:30', 'Return to Marina & Hotel Drop-off', 'Scenic sail back to Sharm El-Sheikh and transfer back to your lobby.', 7)
ON CONFLICT DO NOTHING;

-- 10. TOUR INCLUSIONS & EXCLUSIONS
INSERT INTO public.tour_inclusions (tour_id, item, sort_order)
VALUES
('10000000-0000-0000-0000-000000000001', 'Hotel pickup and return transfer', 1),
('10000000-0000-0000-0000-000000000001', 'Full-day boat cruise on passenger yacht', 2),
('10000000-0000-0000-0000-000000000001', 'Snorkeling equipment (mask, snorkel, fins)', 3),
('10000000-0000-0000-0000-000000000001', 'Orange Bay island national park admission', 4),
('10000000-0000-0000-0000-000000000001', 'Buffet lunch prepared fresh onboard', 5),
('10000000-0000-0000-0000-000000000001', 'Unlimited soft drinks, mineral water, tea & coffee', 6),
('10000000-0000-0000-0000-000000000001', 'Life jackets in adult and child sizes', 7),
('10000000-0000-0000-0000-000000000002', 'Hotel pickup and return transfer', 1),
('10000000-0000-0000-0000-000000000002', 'Boat cruise and crew assistance', 2),
('10000000-0000-0000-0000-000000000002', 'Paradise Island entrance ticket', 3),
('10000000-0000-0000-0000-000000000002', 'Snorkeling gear & buoyancy vests', 4),
('10000000-0000-0000-0000-000000000002', 'Buffet lunch and soft drinks', 5),
('10000000-0000-0000-0000-000000000003', 'Hotel pickup and return transfer', 1),
('10000000-0000-0000-0000-000000000003', 'Full-day boat cruise', 2),
('10000000-0000-0000-0000-000000000003', 'Snorkeling gear & life jackets', 3),
('10000000-0000-0000-0000-000000000003', 'Marine park environmental fees', 4),
('10000000-0000-0000-0000-000000000003', 'Hot buffet lunch & soft drinks', 5),
('10000000-0000-0000-0000-000000000003', 'Water sports inflatables', 6),
('10000000-0000-0000-0000-000000000004', 'Hotel transfers', 1),
('10000000-0000-0000-0000-000000000004', 'Boat trip & national park fee', 2),
('10000000-0000-0000-0000-000000000004', 'Snorkeling equipment', 3),
('10000000-0000-0000-0000-000000000004', 'Lunch & soft drinks', 4),
('10000000-0000-0000-0000-000000000005', 'Hotel transfers', 1),
('10000000-0000-0000-0000-000000000005', 'Single quad bike per driver', 2),
('10000000-0000-0000-0000-000000000005', 'Safety helmet & instructor', 3),
('10000000-0000-0000-0000-000000000005', 'Bedouin tea & water', 4),
('10000000-0000-0000-0000-000000000006', 'Round-trip transfers', 1),
('10000000-0000-0000-0000-000000000006', 'Quad bike & spider buggy', 2),
('10000000-0000-0000-0000-000000000006', 'Bedouin guide & camel ride', 3),
('10000000-0000-0000-0000-000000000006', 'BBQ dinner & drinks', 4),
('10000000-0000-0000-0000-000000000006', 'Show', 5),
('10000000-0000-0000-0000-000000000007', 'Entire private yacht charter', 1),
('10000000-0000-0000-0000-000000000007', 'Captain and 2 crew members', 2),
('10000000-0000-0000-0000-000000000007', 'Private chef lunch & drinks', 3),
('10000000-0000-0000-0000-000000000007', 'All park fees & snorkeling gear', 4),
('10000000-0000-0000-0000-000000000007', 'Private hotel transfers', 5),
('10000000-0000-0000-0000-000000000008', 'Private boat and captain', 1),
('10000000-0000-0000-0000-000000000008', 'Fuel and marina permits', 2),
('10000000-0000-0000-0000-000000000008', 'Snorkeling equipment', 3),
('10000000-0000-0000-0000-000000000008', 'Fruit platter & soft drinks', 4),
('10000000-0000-0000-0000-000000000008', 'Hotel transfer in El Gouna', 5),
('10000000-0000-0000-0000-000000000009', 'Hotel transfers', 1),
('10000000-0000-0000-0000-000000000009', 'Two intro dives with 1-on-1 instructor', 2),
('10000000-0000-0000-0000-000000000009', 'Full scuba equipment set', 3),
('10000000-0000-0000-0000-000000000009', 'Buffet lunch & drinks', 4),
('10000000-0000-0000-0000-000000000009', 'Marine conservation permit', 5),
('10000000-0000-0000-0000-000000000010', 'Hotel pickup and drop-off', 1),
('10000000-0000-0000-0000-000000000010', 'Boat trip to Samadai', 2),
('10000000-0000-0000-0000-000000000010', 'National Park permit fee', 3),
('10000000-0000-0000-0000-000000000010', 'Snorkeling equipment', 4),
('10000000-0000-0000-0000-000000000010', 'Buffet lunch & drinks', 5),
('10000000-0000-0000-0000-000000000011', 'Round-trip transfer', 1),
('10000000-0000-0000-0000-000000000011', 'Reserve entrance ticket', 2),
('10000000-0000-0000-0000-000000000011', 'Beach loungers & pool use', 3),
('10000000-0000-0000-0000-000000000011', 'Snorkeling equipment', 4),
('10000000-0000-0000-0000-000000000011', 'Buffet lunch', 5),
('10000000-0000-0000-0000-000000000012', 'Hotel transfers', 1),
('10000000-0000-0000-0000-000000000012', 'Glass bottom boat cruise', 2),
('10000000-0000-0000-0000-000000000012', 'Soft drinks and water', 3),
('10000000-0000-0000-0000-000000000013', 'Hotel pickup and return across all Sharm El-Sheikh resorts', 1),
('10000000-0000-0000-0000-000000000013', 'National park entry permit and marine clearance', 2),
('10000000-0000-0000-0000-000000000013', 'Open buffet lunch (seafood, grilled meats, salads, pastas)', 3),
('10000000-0000-0000-0000-000000000013', 'Unlimited tea, coffee, mineral water, and soft drinks throughout the day', 4),
('10000000-0000-0000-0000-000000000013', 'Professional certified snorkeling guide and buoyancy aids', 5)
ON CONFLICT DO NOTHING;

INSERT INTO public.tour_exclusions (tour_id, item, sort_order)
VALUES
('10000000-0000-0000-0000-000000000001', 'Personal photo & video packages from boat photographer', 1),
('10000000-0000-0000-0000-000000000001', 'Beach bar drinks on the island', 2),
('10000000-0000-0000-0000-000000000001', 'Tips / gratuities for the crew', 3),
('10000000-0000-0000-0000-000000000002', 'Island bar drinks', 1),
('10000000-0000-0000-0000-000000000002', 'Water sports rides', 2),
('10000000-0000-0000-0000-000000000002', 'Tips for crew', 3),
('10000000-0000-0000-0000-000000000003', 'Professional video/photo album', 1),
('10000000-0000-0000-0000-000000000003', 'Crew gratuities', 2),
('10000000-0000-0000-0000-000000000004', 'Personal expenses', 1),
('10000000-0000-0000-0000-000000000004', 'Tips', 2),
('10000000-0000-0000-0000-000000000005', 'Dust scarf & goggles (rent for €3 or bring own)', 1),
('10000000-0000-0000-0000-000000000005', 'Photo CD', 2),
('10000000-0000-0000-0000-000000000006', 'Scarf & goggles rental', 1),
('10000000-0000-0000-0000-000000000006', 'Personal photos', 2),
('10000000-0000-0000-0000-000000000007', 'Crew gratuities (discretionary)', 1),
('10000000-0000-0000-0000-000000000008', 'Full warm restaurant lunch (can stop at beach club upon request)', 1),
('10000000-0000-0000-0000-000000000009', 'Underwater photo/video package', 1),
('10000000-0000-0000-0000-000000000009', 'Tips for dive crew', 2),
('10000000-0000-0000-0000-000000000010', 'Photo album', 1),
('10000000-0000-0000-0000-000000000010', 'Gratuities', 2),
('10000000-0000-0000-0000-000000000011', 'Drinks at restaurant', 1),
('10000000-0000-0000-0000-000000000011', 'Camel riding on beach', 2),
('10000000-0000-0000-0000-000000000012', 'Personal photos', 1),
('10000000-0000-0000-0000-000000000013', 'Snorkeling gear rental (masks & fins available at marina for €5)', 1),
('10000000-0000-0000-0000-000000000013', 'Professional underwater photo & video package', 2)
ON CONFLICT DO NOTHING;

-- 11. TOUR SEO METADATA
INSERT INTO public.seo_metadata (entity_type, entity_id, seo_title, meta_description, seo_keywords, canonical_url, og_title, og_description)
VALUES
('tour', '10000000-0000-0000-0000-000000000001', 'Orange Bay Island & Snorkeling | Red Sea Voyages', 'Take a boat trip to Giftun Island’s Orange Bay beach with shallow turquoise water, two guided snorkeling stops at coral reefs, and buffet lunch onboard.', ARRAY['hurghada', 'boat trip', 'orange-bay-island-snorkeling'], 'https://redseavoyages.com/excursions/orange-bay-island-snorkeling', 'Orange Bay Island & Snorkeling', 'Take a boat trip to Giftun Island’s Orange Bay beach with shallow turquoise water, two guided snorkeling stops at coral reefs, and buffet lunch onboard.'),
('tour', '10000000-0000-0000-0000-000000000002', 'Paradise Island Snorkeling Trip | Red Sea Voyages', 'Sail to Paradise Beach on Giftun Island with white sand, parasols, folklore dance show, and two coral reef snorkeling stops.', ARRAY['hurghada', 'boat trip', 'paradise-island-snorkeling-trip'], 'https://redseavoyages.com/excursions/paradise-island-snorkeling-trip', 'Paradise Island Snorkeling Trip', 'Sail to Paradise Beach on Giftun Island with white sand, parasols, folklore dance show, and two coral reef snorkeling stops.'),
('tour', '10000000-0000-0000-0000-000000000003', 'Dolphin House Snorkeling | Red Sea Voyages', 'Take a boat trip to Shaab El Erg reef to see wild dolphins in open water, with two coral snorkeling stops and lunch.', ARRAY['hurghada', 'snorkeling', 'dolphin-house-snorkeling'], 'https://redseavoyages.com/excursions/dolphin-house-snorkeling', 'Dolphin House Snorkeling', 'Take a boat trip to Shaab El Erg reef to see wild dolphins in open water, with two coral snorkeling stops and lunch.'),
('tour', '10000000-0000-0000-0000-000000000004', 'Giftun Island Boat Trip | Red Sea Voyages', 'The classic Red Sea boat trip featuring sandbar swimming on Giftun Island National Park, relaxing on sun decks, and snorkeling over living coral.', ARRAY['hurghada', 'boat trip', 'giftun-island-boat-trip'], 'https://redseavoyages.com/excursions/giftun-island-boat-trip', 'Giftun Island Boat Trip', 'The classic Red Sea boat trip featuring sandbar swimming on Giftun Island National Park, relaxing on sun decks, and snorkeling over living coral.'),
('tour', '10000000-0000-0000-0000-000000000005', 'Desert Quad Safari | Red Sea Voyages', 'Ride a 250cc ATV quad bike across desert trails and mountain canyons. Includes test drive and Bedouin tea.', ARRAY['hurghada', 'safari', 'desert-quad-safari'], 'https://redseavoyages.com/excursions/desert-quad-safari', 'Desert Quad Safari', 'Ride a 250cc ATV quad bike across desert trails and mountain canyons. Includes test drive and Bedouin tea.'),
('tour', '10000000-0000-0000-0000-000000000006', 'Desert Safari & Bedouin Experience | Red Sea Voyages', 'Quad biking, spider dune buggy driving, camel ride, Bedouin village visit, BBQ dinner, and evening folklore show.', ARRAY['hurghada', 'safari', 'desert-safari-bedouin-experience'], 'https://redseavoyages.com/excursions/desert-safari-bedouin-experience', 'Desert Safari & Bedouin Experience', 'Quad biking, spider dune buggy driving, camel ride, Bedouin village visit, BBQ dinner, and evening folklore show.'),
('tour', '10000000-0000-0000-0000-000000000007', 'Private Red Sea Yacht | Red Sea Voyages', 'Private yacht charter for up to 8 guests. Choose your stops, snorkel quiet reefs, and enjoy a freshly cooked lunch.', ARRAY['hurghada', 'private tour', 'private-red-sea-yacht'], 'https://redseavoyages.com/excursions/private-red-sea-yacht', 'Private Red Sea Yacht', 'Private yacht charter for up to 8 guests. Choose your stops, snorkel quiet reefs, and enjoy a freshly cooked lunch.'),
('tour', '10000000-0000-0000-0000-000000000008', 'El Gouna Private Boat Trip | Red Sea Voyages', 'Private cruiser departing Abu Tig Marina. Cruise through El Gouna channels, visit quiet northern reefs, and relax on sandbars.', ARRAY['el gouna', 'private tour', 'el-gouna-private-boat-trip'], 'https://redseavoyages.com/excursions/el-gouna-private-boat-trip', 'El Gouna Private Boat Trip', 'Private cruiser departing Abu Tig Marina. Cruise through El Gouna channels, visit quiet northern reefs, and relax on sandbars.'),
('tour', '10000000-0000-0000-0000-000000000009', 'Introductory Scuba Diving Experience | Red Sea Voyages', 'No license needed. Try scuba diving with a certified PADI instructor by your side. Includes 2 shallow boat dives and lunch.', ARRAY['hurghada', 'diving', 'introductory-scuba-diving-experience'], 'https://redseavoyages.com/excursions/introductory-scuba-diving-experience', 'Introductory Scuba Diving Experience', 'No license needed. Try scuba diving with a certified PADI instructor by your side. Includes 2 shallow boat dives and lunch.'),
('tour', '10000000-0000-0000-0000-000000000010', 'Marsa Alam Dolphin House | Red Sea Voyages', 'Sail to the protected Sha’ab Samadai marine reserve to snorkel near wild dolphins in calm natural lagoons.', ARRAY['marsa alam', 'snorkeling', 'marsa-alam-dolphin-house'], 'https://redseavoyages.com/excursions/marsa-alam-dolphin-house', 'Marsa Alam Dolphin House', 'Sail to the protected Sha’ab Samadai marine reserve to snorkel near wild dolphins in calm natural lagoons.'),
('tour', '10000000-0000-0000-0000-000000000011', 'Sharm El Naga Beach & Snorkeling Day | Red Sea Voyages', 'Snorkel straight from a sandy beach without a boat. Includes private bay entry, sun loungers, swimming pool, and lunch.', ARRAY['safaga', 'snorkeling', 'sharm-el-naga-beach-reef-day'], 'https://redseavoyages.com/excursions/sharm-el-naga-beach-reef-day', 'Sharm El Naga Beach & Snorkeling Day', 'Snorkel straight from a sandy beach without a boat. Includes private bay entry, sun loungers, swimming pool, and lunch.'),
('tour', '10000000-0000-0000-0000-000000000012', 'Sahl Hasheesh Glass Bottom Boat | Red Sea Voyages', 'View corals and fish through underwater glass windows without getting wet. Sail past sunken pillars with an optional swim stop.', ARRAY['sahl hasheesh', 'water sports', 'sahl-hasheesh-glass-bottom-boat'], 'https://redseavoyages.com/excursions/sahl-hasheesh-glass-bottom-boat', 'Sahl Hasheesh Glass Bottom Boat', 'View corals and fish through underwater glass windows without getting wet. Sail past sunken pillars with an optional swim stop.'),
('tour', '10000000-0000-0000-0000-000000000013', 'Ras Mohammed National Park & White Island Luxury Yacht Cruise | Red Sea Voyages', 'Cruise through the marine sanctuary of Ras Mohammed National Park, step onto the crystal sandbar of White Island, snorkel coral walls, and enjoy an onboard seafood buffet.', ARRAY['sharm el-sheikh', 'boat trips', 'ras-mohammed-white-island-cruise'], 'https://redseavoyages.com/excursions/ras-mohammed-white-island-cruise', 'Ras Mohammed National Park & White Island Luxury Yacht Cruise', 'Cruise through the marine sanctuary of Ras Mohammed National Park, step onto the crystal sandbar of White Island, snorkel coral walls, and enjoy an onboard seafood buffet.')
ON CONFLICT (entity_type, entity_id) DO UPDATE SET seo_title = EXCLUDED.seo_title;

-- 12. PROMO CODES
INSERT INTO public.coupons (code, description, discount_type, discount_value, min_spend, max_discount, is_active)
VALUES
('WELCOME10', 'Welcome discount 10% off for first-time Red Sea explorers', 'percentage', 10.00, 50.00, 30.00, TRUE),
('SUMMER15', 'Summer holiday 15% special discount on all island trips', 'percentage', 15.00, 75.00, 50.00, TRUE),
('FAMILY20', '€20 flat voucher for group and family bookings over €120', 'fixed', 20.00, 120.00, 20.00, TRUE)
ON CONFLICT (code) DO NOTHING;

-- 13. FLEET VESSELS
INSERT INTO public.vessels (id, name, vessel_type, registration_number, port_marina, passenger_capacity, amenities, is_active)
VALUES
('01000000-0000-0000-0000-000000000001', 'Royal Sea Breeze I', 'motor_yacht', 'HRG-MAR-2024-08', 'Hurghada Marina', 45, ARRAY['Flybridge Sundeck', 'Air-Conditioned Saloon', 'Snorkel Platform', 'Freshwater Showers', 'Full Galley Buffet'], TRUE),
('01000000-0000-0000-0000-000000000002', 'Dolphin Star IV', 'speedboat', 'HRG-SPD-2023-14', 'Hurghada Marina', 12, ARRAY['Twin Yamaha 300HP Engines', 'Bimini Sun Canopy', 'Swim Ladder', 'Padded Bucket Seating'], TRUE),
('01000000-0000-0000-0000-000000000003', 'Lagoon Princess', 'catamaran', 'ELG-CAT-2025-01', 'Abu Tig Marina (El Gouna)', 30, ARRAY['Twin Trampoline Nets', 'Shaded Cockpit Lounge', 'Bluetooth Sound System', 'Swim Deck'], TRUE)
ON CONFLICT (id) DO NOTHING;

-- 14. TOUR VESSEL ASSIGNMENTS
INSERT INTO public.tour_vessels (tour_id, vessel_id, is_default)
VALUES
('10000000-0000-0000-0000-000000000001', '01000000-0000-0000-0000-000000000001', TRUE),
('10000000-0000-0000-0000-000000000002', '01000000-0000-0000-0000-000000000001', TRUE),
('10000000-0000-0000-0000-000000000003', '01000000-0000-0000-0000-000000000002', TRUE)
ON CONFLICT (tour_id, vessel_id) DO NOTHING;

-- 15. GUIDES & STAFF
INSERT INTO public.guides (full_name, role, languages, phone, rating, is_active)
VALUES
('Captain Mahmoud Hassan', 'captain', ARRAY['English', 'Arabic'], '+20 100 555 4321', 4.95, TRUE),
('Sven Richter', 'dive_master', ARRAY['German', 'English'], '+20 101 222 9876', 5.00, TRUE),
('Youssef El-Gamal', 'snorkel_guide', ARRAY['English', 'French', 'Russian', 'Arabic'], '+20 102 333 1122', 4.90, TRUE)
ON CONFLICT DO NOTHING;

-- 16. FREQUENTLY ASKED QUESTIONS
INSERT INTO public.faqs (category, question, answer, sort_order, is_published)
VALUES
('booking', 'Can I pay in cash upon arrival at the harbor or hotel pickup?', 'Yes! We offer a guaranteed "Pay at Hotel Pickup" option so you can reserve your spots in advance and settle with our coordinator in Cash (EUR, USD, GBP, or EGP) on the day of your trip.', 1, TRUE),
('cancellation', 'What is your cancellation policy if our flight or travel plans change?', 'We provide a flexible 100% free cancellation guarantee up to 24 hours prior to your scheduled excursion departure with zero cancellation penalties.', 2, TRUE),
('marine_safety', 'Are life jackets and safety gear provided onboard for children and non-swimmers?', 'Yes. Every vessel in our fleet exceeds Egyptian Coast Guard standards and carries certified US Coast Guard life vests in all sizes, including specialized flotation jackets for children and infants.', 3, TRUE),
('transfers', 'Where will the driver pick us up from our resort?', 'Our professional driver will arrive directly outside your resort main security gate / hotel lobby entrance holding a greeting card with your booking reference.', 4, TRUE)
ON CONFLICT DO NOTHING;

-- 17. WEATHER BULLETIN
INSERT INTO public.weather_bulletins (harbor_location, water_temperature_c, air_temperature_c, swell_height_m, wind_speed_knots, wind_direction, visibility_meters, coast_guard_cleared, advisory_notes, bulletin_date)
VALUES ('Hurghada Marina', 25.5, 29.0, 0.3, 8.5, 'NNE', 35, TRUE, 'Superb calm sea conditions across Giftun Island archipelago. Crystal clear visibility exceeding 30 meters.', CURRENT_DATE)
ON CONFLICT DO NOTHING;
