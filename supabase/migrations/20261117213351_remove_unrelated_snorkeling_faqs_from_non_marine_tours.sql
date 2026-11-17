-- Remove inherited snorkeling-only FAQs from tours whose published source content is not a snorkeling activity.
-- Delete only the exact, previously verified generic FAQ pair; fail closed on any changed row.
BEGIN;
DO $migration$
DECLARE
  target_slug text;
  target_tour uuid;
  found_rows integer;
  exact_rows integer;
BEGIN
  FOREACH target_slug IN ARRAY ARRAY[
      'afternoon-desert-safari-with-echo-mountains-bedouin-village',
      'cairo-pyramids-sphinx-egyptian-museum-day-trip-from-sharm-el-sheikh',
      'el-gouna-jeep-desert-safari-bbq-dinner-stargazing-experience',
      'from-hurghada-luxor-day-trip-karnak-temple-valley-of-the-kings',
      'grand-egyptian-museum-guided-tour-with-entry-ticket',
      'hurghada-airport-to-hotel-private-arrival-transfer',
      'hurghada-desert-quad-safari-atv-adventure-camel-ride-bedouin-village',
      'hurghada-desert-stargazing-safari-jeep-adventure-bedouin-dinner-telescope-experience',
      'hurghada-parasailing-banana-boat-adventure-with-hotel-pickup',
      'hurghada-quad-bike-safari-desert-ride-camel-experience-bedouin-village',
      'mount-sinai-sunrise-hike-st-catherines-monastery-from-sharm-el-sheikh',
      'old-cairo-full-day-tour-islamic-coptic-heritage-with-lunch',
      'sharm-el-sheikh-private-city-tour-old-market-mosque-cathedral',
      'st-catherine-monastery-dahab-day-trip-from-sharm-el-sheikh',
      'ultimate-sinai-desert-safari-quad-camel-bbq-adventure',
      'ultimate-sinai-desert-safari-quad-camel-bbq-adventure-copy-757'
  ]::text[]
  LOOP
    SELECT id INTO target_tour FROM public.tours WHERE slug = target_slug;
    IF target_tour IS NOT NULL THEN
      SELECT count(*),
             count(*) FILTER (WHERE
               (question = 'Is snorkeling equipment provided or should I bring my own?'
                AND answer = 'Sanitized masks, snorkels, and fins in adult and child sizes are provided onboard free of charge.')
               OR
               (question = 'Can non-swimmers participate safely?'
                AND answer = 'Yes! Coast Guard approved flotation vests are provided and certified dive masters accompany guests in the water.')
             )
        INTO found_rows, exact_rows
        FROM public.tour_faqs
       WHERE tour_id = target_tour
         AND question IN (
           'Is snorkeling equipment provided or should I bring my own?',
           'Can non-swimmers participate safely?'
         );
      IF found_rows = 0 THEN
        NULL;
      ELSIF found_rows = 2 AND exact_rows = 2 THEN
        DELETE FROM public.tour_faqs
         WHERE tour_id = target_tour
           AND (
             (question = 'Is snorkeling equipment provided or should I bring my own?'
              AND answer = 'Sanitized masks, snorkels, and fins in adult and child sizes are provided onboard free of charge.')
             OR
             (question = 'Can non-swimmers participate safely?'
              AND answer = 'Yes! Coast Guard approved flotation vests are provided and certified dive masters accompany guests in the water.')
           );
      ELSE
        RAISE EXCEPTION 'Unexpected inherited snorkeling FAQ content on tour %; refusing to delete changed FAQ content.', target_slug;
      END IF;
    END IF;
  END LOOP;
END
$migration$;
COMMIT;
