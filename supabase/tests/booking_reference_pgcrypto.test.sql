BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(6);

SELECT ok(
  to_regprocedure('extensions.gen_random_bytes(integer)') IS NOT NULL,
  'pgcrypto random-byte generator is installed in the extensions schema'
);

SELECT ok(
  position(
    'gen_random_bytes('
    IN regexp_replace(
      pg_get_functiondef(to_regprocedure('private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text)')),
      'extensions\.gen_random_bytes',
      '',
      'gi'
    )
  ) = 0,
  'atomic booking function has no unqualified pgcrypto random-byte call'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'private'
      AND p.proname = 'create_booking_atomic'
      AND p.pronargs = 18
      AND p.prosecdef
      AND p.proconfig @> ARRAY['search_path=""']
  ),
  'atomic booking function remains SECURITY DEFINER with an empty search_path'
);

SELECT ok(
  to_regprocedure('private.assign_short_booking_reference()') IS NOT NULL,
  'new bookings receive a compact public reference from a dedicated trigger'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.bookings'::regclass
      AND tgname = 'trg_assign_short_booking_reference'
      AND NOT tgisinternal
  ),
  'short-reference trigger is attached to the bookings table'
);

SELECT ok(
  position('AAT-' IN pg_get_functiondef(to_regprocedure('private.assign_short_booking_reference()'))) > 0,
  'new booking references use the short AAT prefix'
);

SELECT * FROM finish();

ROLLBACK;
