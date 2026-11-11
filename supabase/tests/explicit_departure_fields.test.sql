BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(8);

SELECT ok(
  (SELECT column_default IS NULL FROM information_schema.columns
   WHERE table_schema='public' AND table_name='departures' AND column_name='start_time'),
  'new departures require an explicit start time'
);

SELECT ok(
  (SELECT column_default IS NULL FROM information_schema.columns
   WHERE table_schema='public' AND table_name='departures' AND column_name='end_time'),
  'new departures require an explicit end time'
);

SELECT ok(
  (SELECT column_default IS NULL FROM information_schema.columns
   WHERE table_schema='public' AND table_name='departures' AND column_name='capacity'),
  'new departures require an explicit capacity'
);

SELECT ok(
  (SELECT column_default IS NULL FROM information_schema.columns
   WHERE table_schema='public' AND table_name='departures' AND column_name='remaining_capacity'),
  'remaining capacity is not fabricated on insert'
);

SELECT ok(
  (SELECT column_default IS NULL FROM information_schema.columns
   WHERE table_schema='public' AND table_name='operational_assignments' AND column_name='departure_time'),
  'new operational assignments require an explicit departure time'
);

SELECT ok(
  (SELECT column_default LIKE '%{}%' FROM information_schema.columns
   WHERE table_schema='public' AND table_name='tours' AND column_name='available_days'),
  'new tours have no assumed operating days'
);

SELECT ok(
  (SELECT column_default IS NULL FROM information_schema.columns
   WHERE table_schema='public' AND table_name='tours' AND column_name='departure_time'),
  'new tours have no assumed departure time'
);

SELECT ok(
  (SELECT column_default IS NULL FROM information_schema.columns
   WHERE table_schema='public' AND table_name='tours' AND column_name='max_guests'),
  'new tours require an explicit group-size limit'
);

SELECT * FROM finish();

ROLLBACK;
