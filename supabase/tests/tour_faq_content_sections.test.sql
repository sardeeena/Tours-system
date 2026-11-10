BEGIN;
SELECT plan(3);

SELECT has_column(
  'public',
  'tour_faqs',
  'section',
  'tour FAQ records can identify preparation-detail sections'
);

SELECT is(
  (
    SELECT column_default::text
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tour_faqs'
      AND column_name = 'section'
  ),
  '''faq''::text',
  'existing and newly-created FAQ records default to the normal FAQ section'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.tour_faqs'::regclass
      AND conname = 'tour_faqs_section_check'
  ),
  'tour FAQ section values are constrained'
);

SELECT * FROM finish();
ROLLBACK;
