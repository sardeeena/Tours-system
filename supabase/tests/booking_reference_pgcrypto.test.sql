BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(8);

SELECT ok(
  position('private.generate_booking_reference(p_booking_date)' IN pg_get_functiondef(to_regprocedure('private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text)'))) > 0
  AND position('AWE-' IN pg_get_functiondef(to_regprocedure('private.generate_booking_reference(date)'))) > 0,
  'atomic booking function delegates to the date-based AWE reference generator'
);

SELECT ok(
  position('ON CONFLICT (booking_date)' IN pg_get_functiondef(to_regprocedure('private.generate_booking_reference(date)'))) > 0,
  'reference generator atomically upserts the per-date counter'
);

SELECT ok(
  position('last_value < 999999' IN pg_get_functiondef(to_regprocedure('private.generate_booking_reference(date)'))) > 0,
  'reference generator enforces the six-digit per-date capacity'
);

SELECT ok(
  position('to_char(p_booking_date' IN pg_get_functiondef(to_regprocedure('private.generate_booking_reference(date)'))) > 0,
  'reference generator embeds the excursion date'
);

SELECT ok(
  position('CONTINUE;' IN pg_get_functiondef(to_regprocedure('private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text)'))) > 0,
  'atomic booking retries if a unique reference collision occurs'
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
  EXISTS (
    SELECT 1
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'private'
      AND p.proname = 'generate_booking_reference'
      AND p.prosecdef
      AND p.proconfig @> ARRAY['search_path=""']
  ),
  'reference generator runs as a hardened SECURITY DEFINER function'
);

SELECT * FROM finish();

ROLLBACK;
