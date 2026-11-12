BEGIN;
SELECT plan(3);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'technical_events'
      AND indexname = 'idx_technical_events_actor_user_id'
  ),
  'technical event actor foreign key is indexed'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'visitor_analytics_settings'
      AND indexname = 'idx_visitor_analytics_settings_updated_by'
  ),
  'analytics settings updater foreign key is indexed'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'visitor_consent_records'
      AND indexname = 'idx_visitor_consent_records_visitor_session_id'
  ),
  'consent session foreign key is indexed'
);

SELECT * FROM finish();
ROLLBACK;
