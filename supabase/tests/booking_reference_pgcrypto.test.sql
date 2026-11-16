BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(4);

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
  position('AAT-' IN pg_get_functiondef(to_regprocedure('private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text)'))) > 0
  AND position('extensions.gen_random_bytes(8)' IN pg_get_functiondef(to_regprocedure('private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text)'))) > 0,
  'atomic booking function generates compact AAT references using cryptographic randomness'
);

SELECT * FROM finish();

ROLLBACK;
