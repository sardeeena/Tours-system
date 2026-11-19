BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(5);

SELECT ok(
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'booking_passengers'
      AND column_name = 'passenger_index'
      AND is_nullable = 'NO'
      AND data_type = 'integer'
  ),
  'booking passengers have a required integer passenger_index'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.booking_passengers'::regclass
      AND contype = 'u'
      AND pg_get_constraintdef(oid) LIKE '%(booking_id, passenger_index)%'
  ),
  'booking_id and passenger_index are unique together'
);

SELECT is(
  (SELECT COUNT(*)::integer FROM public.booking_passengers WHERE passenger_index IS NULL),
  0,
  'existing passenger rows are backfilled'
);

SELECT is(
  (SELECT COUNT(*)::integer FROM (
    SELECT booking_id, passenger_index
    FROM public.booking_passengers
    GROUP BY booking_id, passenger_index
    HAVING COUNT(*) > 1
  ) duplicates),
  0,
  'no booking has duplicate passenger indexes'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM public.booking_passengers
    WHERE is_lead_passenger = true AND passenger_index <> 0
  ),
  'lead passenger records occupy index zero'
);

SELECT * FROM finish();
ROLLBACK;
