BEGIN;
SELECT plan(4);
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
SELECT * FROM finish();
ROLLBACK;
