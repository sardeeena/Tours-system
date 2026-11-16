BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(5);

SELECT ok(
  position('AAT-' IN pg_get_functiondef(to_regprocedure('private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text)'))) > 0
  AND position('extensions.gen_random_bytes(8)' IN pg_get_functiondef(to_regprocedure('private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text)'))) > 0,
  'new bookings use compact cryptographically random references'
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
  position('booking.completed' IN pg_get_functiondef(to_regprocedure('private.enqueue_booking_completed_review_event()'))) > 0
  AND position('pgmq.send' IN pg_get_functiondef(to_regprocedure('private.enqueue_booking_completed_review_event()'))) > 0
  AND position('NEW.payment_status = ''paid''' IN pg_get_functiondef(to_regprocedure('private.enqueue_booking_completed_review_event()'))) > 0,
  'review event is queued only after a completed booking is fully paid'
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
