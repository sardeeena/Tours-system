BEGIN;
SELECT plan(9);

SELECT ok(
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='visitor_sessions' AND column_name='city'),
  'visitor sessions store approximate city'
);
SELECT ok(
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='visitor_sessions' AND column_name='country_name'),
  'visitor sessions store country name'
);
SELECT ok(
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='visitor_sessions' AND column_name='region_name'),
  'visitor sessions store region name'
);
SELECT ok(
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='visitor_sessions' AND column_name='locale'),
  'visitor sessions store browser locale'
);
SELECT ok(
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='visitor_sessions' AND column_name='language_preferences'),
  'visitor sessions store preferred language list'
);
SELECT ok(
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='visitor_sessions' AND column_name='platform_family'),
  'visitor sessions store platform family'
);
SELECT ok(
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='visitor_sessions' AND column_name='is_mobile'),
  'visitor sessions store mobile classification'
);
SELECT ok(
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='visitor_sessions' AND column_name='viewport_bucket'),
  'visitor sessions store viewport category'
);
SELECT ok(
  EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='visitor_sessions' AND indexname='idx_visitor_sessions_country_started'),
  'visitor country/time index exists'
);

SELECT * FROM finish();
ROLLBACK;
