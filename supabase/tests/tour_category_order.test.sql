BEGIN;
SELECT plan(2);

SELECT has_column(
  'public',
  'tour_categories',
  'sort_order',
  'tour category relationships preserve their display order'
);

SELECT is(
  (
    SELECT column_default::text
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tour_categories'
      AND column_name = 'sort_order'
  ),
  '0',
  'new category links have a deterministic default order'
);

SELECT * FROM finish();
ROLLBACK;
