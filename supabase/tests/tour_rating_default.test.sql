BEGIN;
SELECT plan(1);

SELECT is(
  (
    SELECT column_default::text
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tours'
      AND column_name = 'rating'
  ),
  '0',
  'new tours remain unrated until genuine published reviews exist'
);

SELECT * FROM finish();
ROLLBACK;
