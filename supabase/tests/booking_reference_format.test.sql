BEGIN;
SELECT plan(3);
SELECT matches(
  private.generate_booking_reference('2026-11-18'),
  '^AWE-20261118-[0-9]{6}$',
  'booking reference includes the departure date and exactly six digits'
);
SELECT isnt(
  private.generate_booking_reference('2026-11-18'),
  private.generate_booking_reference('2026-11-18'),
  'concurrent-safe sequence issues distinct references for the same date'
);
SELECT matches(
  private.generate_booking_reference('2026-12-01'),
  '^AWE-20261201-[0-9]{6}$',
  'booking reference uses the requested excursion date'
);
SELECT * FROM finish();
ROLLBACK;
