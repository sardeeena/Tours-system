BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(6);

SELECT ok(
  to_regprocedure('private.assign_short_booking_reference()') IS NOT NULL,
  'short booking reference trigger function exists'
);

SELECT ok(
  position('AAT-' IN pg_get_functiondef(to_regprocedure('private.assign_short_booking_reference()'))) > 0
  AND position('extensions.gen_random_bytes(8)' IN pg_get_functiondef(to_regprocedure('private.assign_short_booking_reference()'))) > 0,
  'new references use the short AAT year-prefixed format and cryptographic randomness'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.bookings'::regclass
      AND tgname = 'trg_assign_short_booking_reference'
      AND NOT tgisinternal
  ),
  'short booking references are assigned before every booking insert'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_automation_events_booking_completed_once'
  ),
  'only one completed-booking event can be queued per booking'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.bookings'::regclass
      AND tgname = 'trg_enqueue_booking_completed_review_event'
      AND NOT tgisinternal
  ),
  'completed and paid booking transitions enqueue review requests'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM public.communication_templates
    WHERE template_key = 'booking_review_request'
      AND channel = 'Email'
      AND is_active = TRUE
      AND variables @> '["google_review_url","tripadvisor_review_url","tour_review_url"]'::jsonb
  ),
  'active review email template contains all three review destinations'
);

SELECT * FROM finish();
ROLLBACK;
