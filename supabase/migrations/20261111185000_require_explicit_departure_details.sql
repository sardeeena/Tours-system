-- Prevent new tour/departure records from silently inheriting invented
-- operating days, times, or passenger capacities. Existing rows are untouched.
BEGIN;

ALTER TABLE public.departures
  ALTER COLUMN start_time DROP DEFAULT,
  ALTER COLUMN end_time DROP DEFAULT,
  ALTER COLUMN capacity DROP DEFAULT,
  ALTER COLUMN remaining_capacity DROP DEFAULT;

ALTER TABLE public.operational_assignments
  ALTER COLUMN departure_time DROP DEFAULT;

ALTER TABLE public.tours
  ALTER COLUMN available_days SET DEFAULT '{}'::text[],
  ALTER COLUMN departure_time DROP DEFAULT,
  ALTER COLUMN max_guests DROP DEFAULT;

COMMIT;
