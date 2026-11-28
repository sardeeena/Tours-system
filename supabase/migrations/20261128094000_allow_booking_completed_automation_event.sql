-- The booking-completion review trigger already emits this event. Production has
-- the intended contract; this migration reconciles clean installs with production.
BEGIN;

ALTER TABLE public.automation_events
  DROP CONSTRAINT IF EXISTS automation_events_event_name_check;

ALTER TABLE public.automation_events
  ADD CONSTRAINT automation_events_event_name_check
  CHECK (event_name = ANY (ARRAY[
    'booking.created'::text,
    'booking.updated'::text,
    'booking.completed'::text,
    'payment.received'::text,
    'payment.failed'::text,
    'booking.cancelled'::text,
    'booking.cancellation_requested'::text,
    'departure.tomorrow'::text,
    'followup.due'::text
  ]));

COMMIT;
