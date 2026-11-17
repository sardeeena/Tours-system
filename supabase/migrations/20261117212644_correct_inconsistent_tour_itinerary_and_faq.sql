-- Correct two verified English source-content defects before any locale is published.
-- This migration only changes the two identified records. It is safe on clean local
-- databases where these production content records are not seeded.

BEGIN;

DO $migration$
DECLARE
  target_quad_tour uuid := '18375e31-b866-4f07-b3a8-c13b2a5c243b';
  target_ras_tour uuid := '2f7cbd8c-bda2-4915-b5e4-5fc98927a388';
  itinerary_count integer;
  known_old_rows integer;
  corrected_rows integer;
  current_faq_answer text;
  corrupted_faq_answer text := 'Yes! Coast Guard approved flotationA: Yes, the itinerary includes a snorkeling stop at Coral Gardens. Snorkeling equipment may depend on the selected booking option.vests are provided and certified dive masters accompany guests in the water.';
  corrected_faq_answer text := 'A: The itinerary includes a snorkeling stop at Coral Gardens. Snorkeling equipment may depend on the selected booking option.';
BEGIN
  IF EXISTS (SELECT 1 FROM public.tours WHERE id = target_quad_tour) THEN
    SELECT count(*),
           count(*) FILTER (WHERE id IN (
             '84b610b0-f847-45fc-8f7d-635cce8fc0ed',
             'a6746548-c0ba-4293-9b9e-e04581b43f82',
             'b1d4d7f0-7d26-4d33-911c-e01b67014bdd',
             '6dd99cf6-838d-4bf2-a1d8-e1d1e787d041',
             '99766122-56db-4ecc-a9da-792a9efe7064',
             '189f04e7-4948-4698-bba0-121c6ec1e363',
             '708e633b-2a9d-46c2-812e-7dca7a3f7e6f'
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
      NULL; -- Already corrected; keep the verified rows.
    ELSIF itinerary_count = 0 THEN
      NULL; -- Fresh database or an empty itinerary; insert the verified itinerary below.
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

  IF EXISTS (SELECT 1 FROM public.tours WHERE id = target_ras_tour) THEN
    SELECT answer INTO current_faq_answer
      FROM public.tour_faqs
     WHERE id = '9fef1847-5c71-412a-aa69-cf330bad85db'
       AND tour_id = target_ras_tour;

    IF current_faq_answer = corrupted_faq_answer THEN
      UPDATE public.tour_faqs
         SET answer = corrected_faq_answer
       WHERE id = '9fef1847-5c71-412a-aa69-cf330bad85db'
         AND tour_id = target_ras_tour;
    ELSIF current_faq_answer = corrected_faq_answer THEN
      NULL; -- Already corrected.
    ELSIF current_faq_answer IS NULL THEN
      RAISE EXCEPTION 'Expected Ras Mohammed FAQ row was not found; refusing to silently skip the source correction.';
    ELSE
      RAISE EXCEPTION 'Ras Mohammed FAQ differs from both the verified corrupted text and the approved correction; refusing to overwrite it.';
    END IF;
  END IF;
END
$migration$;

COMMIT;
