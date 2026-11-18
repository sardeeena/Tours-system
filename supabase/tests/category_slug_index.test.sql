BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(2);
SELECT ok(to_regclass('public.idx_categories_slug') IS NULL,
  'redundant unused non-unique categories slug index is removed');
SELECT ok(to_regclass('public.categories_slug_key') IS NOT NULL,
  'categories slug uniqueness constraint index remains intact');
SELECT * FROM finish();
ROLLBACK;
