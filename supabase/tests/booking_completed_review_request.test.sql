BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(6);

SELECT ok(
  position('AWE-' IN pg_get_functiondef(to_regprocedure('private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text)'))) > 0
  AND position('private.generate_booking_reference(p_booking_date)' IN pg_get_functiondef(to_regprocedure('private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text)'))) > 0
  AND position('ON CONFLICT (booking_date)' IN pg_get_functiondef(to_regprocedure('private.generate_booking_reference(date)'))) > 0
  AND position('last_value < 999999' IN pg_get_functiondef(to_regprocedure('private.generate_booking_reference(date)'))) > 0
  AND position('to_char(p_booking_date, ''YYYYMMDD'')' IN pg_get_functiondef(to_regprocedure('private.generate_booking_reference(date)'))) > 0
  AND position('CONTINUE;' IN pg_get_functiondef(to_regprocedure('private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text)'))) > 0,
  'new bookings use compact date-based references with an atomic per-date counter'
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
    SELECT 1
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'private'
      AND p.proname = 'enqueue_booking_completed_review_event'
      AND p.prosecdef
      AND p.proconfig @> ARRAY['search_path=""']
  ),
  'review event trigger runs as a hardened SECURITY DEFINER function'
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
