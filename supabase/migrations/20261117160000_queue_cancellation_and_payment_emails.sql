-- Queue customer-facing cancellation and settled-payment emails in the same
-- database transaction as the corresponding state change. Delivery remains
-- idempotent through per-entity event indexes and Resend idempotency keys.

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS idx_automation_booking_cancelled_once
  ON public.automation_events(event_name,entity_type,entity_id)
  WHERE event_name='booking.cancelled';

CREATE UNIQUE INDEX IF NOT EXISTS idx_automation_payment_received_once
  ON public.automation_events(event_name,entity_type,entity_id)
  WHERE event_name='payment.received';

CREATE OR REPLACE FUNCTION public.enqueue_booking_cancellation_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_event_id UUID;
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.automation_events(event_name,payload,entity_type,entity_id,processed)
    VALUES (
      'booking.cancelled',
      jsonb_build_object('booking_id',NEW.id,'booking_reference',NEW.booking_reference),
      'booking',
      NEW.id::TEXT,
      FALSE
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_event_id;

    IF v_event_id IS NOT NULL THEN
      PERFORM pgmq.send('booking_notifications',jsonb_build_object(
        'event_id',v_event_id,'event_name','booking.cancelled'
      ));
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_enqueue_booking_cancellation_email ON public.bookings;
CREATE TRIGGER trg_enqueue_booking_cancellation_email
AFTER UPDATE OF status ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_booking_cancellation_email();

CREATE OR REPLACE FUNCTION public.enqueue_payment_received_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_should_enqueue BOOLEAN := FALSE;
  v_event_id UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_should_enqueue := NEW.status IN ('Paid','Partially Paid');
  ELSE
    v_should_enqueue := NEW.status IN ('Paid','Partially Paid')
      AND OLD.status IS DISTINCT FROM NEW.status;
  END IF;

  IF v_should_enqueue THEN
    INSERT INTO public.automation_events(event_name,payload,entity_type,entity_id,processed)
    VALUES (
      'payment.received',
      jsonb_build_object(
        'booking_id',NEW.booking_id,
        'payment_id',NEW.id
      ),
      'payment',
      NEW.id::TEXT,
      FALSE
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_event_id;

    IF v_event_id IS NOT NULL THEN
      PERFORM pgmq.send('booking_notifications',jsonb_build_object(
        'event_id',v_event_id,'event_name','payment.received'
      ));
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_enqueue_payment_received_email ON public.payment_transactions;
CREATE TRIGGER trg_enqueue_payment_received_email
AFTER INSERT OR UPDATE OF status ON public.payment_transactions
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_payment_received_email();

REVOKE ALL ON FUNCTION public.enqueue_booking_cancellation_email() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enqueue_payment_received_email() FROM PUBLIC, anon, authenticated;

COMMIT;
