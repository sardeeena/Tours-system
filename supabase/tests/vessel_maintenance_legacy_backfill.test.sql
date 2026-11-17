BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(4);

SELECT has_column(
  'public', 'vessels', 'next_maintenance',
  'legacy vessel maintenance date remains available for compatibility'
);

SELECT has_column(
  'public', 'vessels', 'next_maintenance_date',
  'canonical vessel maintenance date exists'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM public.vessels
    WHERE next_maintenance IS NOT NULL
      AND next_maintenance_date IS NULL
  ),
  'existing legacy maintenance dates are backfilled into the canonical field'
);

SELECT ok(
  position(
    'v_vessel.next_maintenance_date' IN pg_get_functiondef(
      'private.upsert_departure_with_availability(uuid,uuid,date,text,text,integer,text,uuid,uuid,uuid,text)'::regprocedure
    )
  ) > 0,
  'departure scheduling validates the canonical maintenance date'
);

SELECT * FROM finish();

ROLLBACK;
