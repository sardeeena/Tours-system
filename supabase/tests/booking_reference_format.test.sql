BEGIN;
SELECT plan(6);
SELECT matches(
  private.generate_booking_reference('2026-11-18'),
  '^AA[A-Z0-9]{7}$',
  'new booking references use the compact nine-character format'
);
SELECT is(
  length(private.generate_booking_reference('2026-11-18')),
  9,
  'new booking references never exceed nine characters'
);
SELECT isnt(
  private.generate_booking_reference('2026-11-18'),
  private.generate_booking_reference('2026-11-18'),
  'cryptographically random generator returns distinct references on the same date'
);
SELECT isnt(
  private.generate_booking_reference('2026-11-18'),
  private.generate_booking_reference('2026-12-01'),
  'random generator also distinguishes bookings across departure dates'
);
SELECT ok(
  position(
    'private.generate_booking_reference(p_booking_date)'
    IN pg_get_functiondef(to_regprocedure('private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text,text)'))
  ) > 0
  AND position(
    'RST-'
    IN pg_get_functiondef(to_regprocedure('private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text,text)'))
  ) = 0,
  'language-aware guest checkout uses the compact reference generator instead of the legacy RST UUID format'
);
SELECT ok(
  position(
    'CONTINUE;'
    IN pg_get_functiondef(to_regprocedure('private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text,text)'))
  ) > 0,
  'language-aware guest checkout retries a concurrent compact-reference collision'
);
SELECT * FROM finish();
ROLLBACK;
