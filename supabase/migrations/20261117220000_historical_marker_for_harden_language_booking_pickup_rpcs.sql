-- Historical marker for a production migration-history repair.
-- The executable SQL for this change was applied and recorded under
-- 20261117025516_harden_language_booking_pickup_rpcs. Production also contains
-- version 20261117220000 with no stored SQL statements. Keep this later version
-- as a no-op so clean database resets execute the pickup hardening exactly once
-- while preserving the production migration-version history.
DO $migration_history_marker$
BEGIN
  NULL;
END;
$migration_history_marker$;
