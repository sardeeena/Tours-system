BEGIN;
SELECT plan(5);

SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.technical_events'::regclass),
  'technical_events has row-level security enabled'
);

SELECT ok(
  NOT has_table_privilege('anon', 'public.technical_events', 'SELECT'),
  'anon cannot read technical events'
);

SELECT ok(
  NOT has_table_privilege('authenticated', 'public.technical_events', 'SELECT'),
  'authenticated users including ordinary admins cannot read technical events directly'
);

SELECT ok(
  has_table_privilege('service_role', 'public.technical_events', 'SELECT'),
  'server service role can read technical events'
);

SELECT ok(
  has_table_privilege('service_role', 'public.technical_events', 'INSERT'),
  'server service role can write technical events'
);

SELECT * FROM finish();
ROLLBACK;
