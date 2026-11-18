-- Historical marker for the production migration-history reconciliation.
-- The guest booking locale trigger exception was applied and recorded under
-- 20261118145947_allow_guest_booking_locale_persistence. Keep this later
-- version as a no-op so clean resets apply the executable migration exactly
-- once while preserving the production migration-version history.
DO $guest_locale_history_marker$
BEGIN
  NULL;
END;
$guest_locale_history_marker$;
