-- Correct two verified English source-content defects before any locale is published.
-- Resolve records by their unique, human-maintained slugs; do not pin generated UUIDs.
-- Safe on clean local databases where these production content records are not seeded.

BEGIN;

DO $migration$
DECLARE
  target_quad_tour uuid;
  target_ras_tour uuid;
  itinerary_count integer;
  known_old_rows integer;
  corrected_rows integer;
  current_faq_answer text;
  corrupted_faq_answer text := 'Yes! Coast Guard approved flotationA: Yes, the itinerary includes a snorkeling stop at Coral Gardens. Snorkeling equipment may depend on the selected booking option.vests are provided and certified dive masters accompany guests in the water.';
  corrected_faq_answer text := 'A: The itinerary includes a snorkeling stop at Coral Gardens. Snorkeling equipment may depend on the selected booking option.';
BEGIN
  SELECT id INTO target_quad_tour
    FROM public.tours
   WHERE slug = 'el-gouna-desert-quad-safari-bedouin-village-camel-ride';

  IF target_quad_tour IS NOT NULL THEN
    SELECT count(*),
           count(*) FILTER (WHERE (time, title) IN (
             ('08:00', 'Hotel pickup'),
             ('09:00', 'Departure from marina'),
             ('10:00', 'First snorkeling stop'),
             ('12:30', 'Lunch onboard'),
             ('14:00', 'Island beach time'),
             ('16:30', 'Return to marina'),
             ('17:00', 'Hotel drop-off')
           ))
      INTO itinerary_count, known_old_rows
      FROM public.tour_itinerary
     WHERE tour_id = target_quad_tour;

    SELECT count(*) INTO corrected_rows
      FROM public.tour_itinerary
     WHERE tour_id = target_quad_tour
       AND title IN (
         'Hotel pickup from El Gouna',
         'Safety briefing and practice',
         'Guided desert quad ride',
         'Bedouin village and camel ride',
         'Return transfer to El Gouna'
       );

    IF itinerary_count = 7 AND known_old_rows = 7 THEN
      DELETE FROM public.tour_itinerary WHERE tour_id = target_quad_tour;
    ELSIF itinerary_count = 5 AND corrected_rows = 5 THEN
      NULL;
    ELSIF itinerary_count = 0 THEN
      NULL;
    ELSE
      RAISE EXCEPTION 'Unexpected El Gouna quad itinerary state (% rows, % known old rows, % corrected rows); refusing to overwrite unreviewed content.',
        itinerary_count, known_old_rows, corrected_rows;
    END IF;

    IF NOT (itinerary_count = 5 AND corrected_rows = 5) THEN
      INSERT INTO public.tour_itinerary (tour_id, time, title, description, sort_order)
      VALUES
        (target_quad_tour, 'Hotel pickup', 'Hotel pickup from El Gouna',
         'Air-conditioned transfer from your hotel in El Gouna to the quad bike station in the Hurghada desert area.', 1),
        (target_quad_tour, 'Before the ride', 'Safety briefing and practice',
         'Meet the desert team, get familiar with the quad bike and receive a safety briefing before setting off.', 2),
        (target_quad_tour, 'Desert ride', 'Guided desert quad ride',
         'Follow your guide across the desert trails, with the Red Sea mountain range in the distance.', 3),
        (target_quad_tour, 'Bedouin village', 'Bedouin village and camel ride',
         'Visit a traditional Bedouin village, enjoy Bedouin tea, learn about local customs and take a short camel ride.', 4),
        (target_quad_tour, 'Return', 'Return transfer to El Gouna',
         'Ride the quad bike back to the starting point, then transfer to your hotel in El Gouna.', 5);
    END IF;
  END IF;

  SELECT id INTO target_ras_tour
    FROM public.tours
   WHERE slug = 'sharm-el-sheikh-ras-mohammed-magic-lake-snorkeling-adventure';

  IF target_ras_tour IS NOT NULL THEN
    SELECT answer INTO current_faq_answer
      FROM public.tour_faqs
     WHERE tour_id = target_ras_tour
       AND question = 'Q: Is snorkeling included in the tour?';

    IF current_faq_answer = corrupted_faq_answer THEN
      UPDATE public.tour_faqs
         SET answer = corrected_faq_answer
       WHERE tour_id = target_ras_tour
         AND question = 'Q: Is snorkeling included in the tour?'
         AND answer = corrupted_faq_answer;
    ELSIF current_faq_answer = corrected_faq_answer THEN
      NULL;
    ELSIF current_faq_answer IS NULL THEN
      RAISE EXCEPTION 'Expected Ras Mohammed FAQ row was not found; refusing to silently skip the source correction.';
    ELSE
      RAISE EXCEPTION 'Ras Mohammed FAQ differs from both the verified corrupted text and the approved correction; refusing to overwrite it.';
    END IF;
  END IF;
END
$migration$;

COMMIT;
