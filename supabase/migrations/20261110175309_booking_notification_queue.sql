-- Durable booking notification outbox using Supabase Queues (PGMQ).
-- Booking events and queue messages are committed in the same transaction as the booking.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgmq;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pgmq.list_queues() WHERE queue_name = 'booking_notifications'
  ) THEN
    PERFORM pgmq.create('booking_notifications');
  END IF;
END;
$$;

ALTER TABLE public.communication_messages
  ADD COLUMN IF NOT EXISTS automation_event_id UUID
  REFERENCES public.automation_events(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_comm_messages_automation_event_channel
  ON public.communication_messages (automation_event_id, channel)
  WHERE automation_event_id IS NOT NULL;

INSERT INTO public.communication_templates (
  template_key, name, channel, subject, body_text, variables, is_active
)
VALUES (
  'booking_received',
  'Booking Received',
  'Email',
  'We received your booking request {{booking_reference}}',
  E'Hello {{customer_name}},\n\nWe received your reservation request for {{tour_name}} on {{tour_date}}.\n\nBooking reference: {{booking_reference}}\nBooking status: {{booking_status}}\nTotal: {{currency}} {{amount}}\n\nYour request is recorded. Our team will review it and send any further confirmation or pickup details separately.\n\nThank you,\nKemet Spirit',
  '["customer_name","booking_reference","tour_name","tour_date","booking_status","currency","amount"]'::jsonb,
  TRUE
)
ON CONFLICT (template_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.enqueue_booking_notification_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_event_id UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.automation_events (
      event_name, payload, entity_type, entity_id, processed
    )
    VALUES (
      'booking.created',
      jsonb_build_object(
        'booking_id', NEW.id,
        'booking_reference', NEW.booking_reference
      ),
      'booking',
      NEW.id::text,
      FALSE
    )
    RETURNING id INTO v_event_id;

    PERFORM pgmq.send(
      'booking_notifications',
      jsonb_build_object(
        'event_id', v_event_id,
        'event_name', 'booking.created'
      )
    );

    INSERT INTO public.staff_notifications (
      category, dedup_key, title, message, severity,
      entity_type, entity_id, link_tab
    )
    VALUES (
      'new_booking',
      'booking-created:' || NEW.id::text,
      'New booking received',
      'Booking ' || NEW.booking_reference || ' was received and is awaiting review.',
      'info',
      'booking',
      NEW.id::text,
      'bookings'
    )
    ON CONFLICT (dedup_key) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_enqueue_booking_notification_event ON public.bookings;
CREATE TRIGGER trg_enqueue_booking_notification_event
AFTER INSERT ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_booking_notification_event();

CREATE OR REPLACE FUNCTION public.read_booking_notification_queue(p_qty INTEGER DEFAULT 5)
RETURNS TABLE (
  msg_id BIGINT,
  read_ct BIGINT,
  message JSONB
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT q.msg_id, q.read_ct, q.message
  FROM pgmq.read(
    'booking_notifications',
    120,
    GREATEST(1, LEAST(COALESCE(p_qty, 5), 10))
  ) AS q;
$function$;

CREATE OR REPLACE FUNCTION public.delete_booking_notification_message(p_msg_id BIGINT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT pgmq.delete('booking_notifications', p_msg_id);
$function$;

CREATE OR REPLACE FUNCTION public.archive_booking_notification_message(p_msg_id BIGINT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT pgmq.archive('booking_notifications', p_msg_id);
$function$;

CREATE OR REPLACE FUNCTION public.retry_booking_notification_message(
  p_msg_id BIGINT,
  p_delay_seconds INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  PERFORM pgmq.set_vt(
    'booking_notifications',
    p_msg_id,
    GREATEST(30, LEAST(COALESCE(p_delay_seconds, 60), 3600))
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.enqueue_booking_notification_event() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.read_booking_notification_queue(INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_booking_notification_message(BIGINT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.archive_booking_notification_message(BIGINT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.retry_booking_notification_message(BIGINT, INTEGER) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.read_booking_notification_queue(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_booking_notification_message(BIGINT) TO service_role;
GRANT EXECUTE ON FUNCTION public.archive_booking_notification_message(BIGINT) TO service_role;
GRANT EXECUTE ON FUNCTION public.retry_booking_notification_message(BIGINT, INTEGER) TO service_role;

COMMIT;
