-- Reconciliation marker for the production migration-history repair performed on 2026-11-28.
-- The production schema changes are contained in the versioned migrations that follow:
--   20261128090000_booking_lifecycle_analytics_events.sql
--   20261128093000_optimize_responsible_snorkeling_article.sql
-- This migration intentionally makes no schema or data changes. Its purpose is to keep
-- the local migration directory aligned with the already-recorded historical version
-- 20261128020709 so Supabase branch/preview validation can resolve every remote version.
DO $migration$
BEGIN
  NULL;
END;
$migration$;
