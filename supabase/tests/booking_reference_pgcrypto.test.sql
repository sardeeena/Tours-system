BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(3);

SELECT ok(
  to_regprocedure('extensions.gen_random_bytes(integer)') IS NOT NULL,
  'pgcrypto random-byte generator is installed in the extensions schema'
);

SELECT ok(
  position(
    'ENCODE(extensions.gen_random_bytes(10), ''hex'')'
    IN pg_get_functiondef(to_regprocedure('private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text)'))
  ) > 0,
  'atomic booking reference generation schema-qualifies pgcrypto'
);

SELECT ok(
  position(
    'ENCODE(gen_random_bytes(10), ''hex'')'
    IN pg_get_functiondef(to_regprocedure('private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text)'))
  ) = 0,
  'atomic booking reference generation does not depend on search_path'
);

SELECT * FROM finish();

ROLLBACK;
