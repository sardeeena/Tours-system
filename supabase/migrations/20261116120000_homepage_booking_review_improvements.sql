-- Short, readable references for new bookings and an idempotent review request
-- after an excursion is marked completed and its payment ledger is settled.
BEGIN;

CREATE OR REPLACE FUNCTION private.assign_short_booking_reference()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  NEW.booking_reference :=
    'AAT-' || TO_CHAR(CURRENT_DATE, 'YY') || '-' ||
    UPPER(SUBSTRING(ENCODE(extensions.gen_random_bytes(8), 'hex') FROM 1 FOR 16));
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.assign_short_booking_reference() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_assign_short_booking_reference ON public.bookings;
CREATE TRIGGER trg_assign_short_booking_reference
BEFORE INSERT ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION private.assign_short_booking_reference();

CREATE UNIQUE INDEX IF NOT EXISTS idx_automation_events_booking_completed_once
  ON public.automation_events (event_name, entity_id)
  WHERE event_name = 'booking.completed' AND entity_id IS NOT NULL;

CREATE OR REPLACE FUNCTION private.enqueue_booking_completed_review_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_event_id UUID;
BEGIN
  IF NEW.status = 'completed'
     AND NEW.payment_status = 'paid'
     AND (OLD.status IS DISTINCT FROM NEW.status OR OLD.payment_status IS DISTINCT FROM NEW.payment_status) THEN
    INSERT INTO public.automation_events (
      event_name, payload, entity_type, entity_id, processed
    )
    VALUES (
      'booking.completed',
      jsonb_build_object(
        'booking_id', NEW.id,
        'booking_reference', NEW.booking_reference
      ),
      'booking',
      NEW.id::text,
      FALSE
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_event_id;

    IF v_event_id IS NOT NULL THEN
      PERFORM pgmq.send(
        'booking_notifications',
        jsonb_build_object(
          'event_id', v_event_id,
          'event_name', 'booking.completed'
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.enqueue_booking_completed_review_event() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_enqueue_booking_completed_review_event ON public.bookings;
CREATE TRIGGER trg_enqueue_booking_completed_review_event
AFTER UPDATE OF status, payment_status ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION private.enqueue_booking_completed_review_event();

INSERT INTO public.communication_templates (
  template_key, name, channel, subject, body_text, variables, is_active
)
VALUES (
  'booking_review_request',
  'Completed Booking Review Request',
  'Email',
  'How was {{tour_name}}? We would love your feedback',
  E'Hello {{customer_name}},\n\nThank you for joining us on {{tour_name}} (booking {{booking_reference}}). We hope you had a wonderful experience.\n\nIf you have a moment, we would really appreciate an honest review:\n\nGoogle: {{google_review_url}}\nTripadvisor: {{tripadvisor_review_url}}\nYour exact tour page: {{tour_review_url}}\n\nThank you for choosing Awesome Adventure Tours. We hope to welcome you again soon!',
  '["customer_name","booking_reference","tour_name","google_review_url","tripadvisor_review_url","tour_review_url"]'::jsonb,
  TRUE
)
ON CONFLICT (template_key) DO NOTHING;

COMMIT;
