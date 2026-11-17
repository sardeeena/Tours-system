-- Remove two inherited boat/snorkeling FAQs from the El Gouna desert quad safari.
-- Delete only the exact, previously verified unrelated rows; fail closed on drift.

BEGIN;

DO $migration$
DECLARE
  target_tour uuid;
  found_rows integer;
  exact_rows integer;
BEGIN
  SELECT id INTO target_tour
    FROM public.tours
   WHERE slug = 'el-gouna-desert-quad-safari-bedouin-village-camel-ride';

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
      NULL; -- Already removed or not seeded in this database.
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
      RAISE EXCEPTION 'El Gouna quad FAQ rows no longer match the two verified unrelated snorkeling FAQs; refusing to delete changed FAQ content.';
    END IF;
  END IF;
END
$migration$;

COMMIT;
