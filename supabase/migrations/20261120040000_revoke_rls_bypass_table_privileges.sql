-- Remove table privileges that bypass row-level security or are not needed by
-- browser clients. SELECT/INSERT/UPDATE/DELETE remain governed by the existing
-- least-privilege grants and RLS policies.
BEGIN;

REVOKE TRUNCATE, MAINTAIN, REFERENCES, TRIGGER
  ON ALL TABLES IN SCHEMA public
  FROM anon, authenticated;

-- Apply the same boundary to tables created by either supported migration owner.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE TRUNCATE, MAINTAIN, REFERENCES, TRIGGER ON TABLES FROM anon, authenticated;
-- User-managed migrations execute as postgres; platform-owned objects remain
-- governed by Supabase's own administrative lifecycle.

COMMIT;
