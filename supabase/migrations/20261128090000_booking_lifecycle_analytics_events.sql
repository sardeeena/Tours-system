-- Privacy-safe, authoritative operational analytics for booking and payment lifecycle changes.
-- This ledger is separate from consent-gated visitor analytics: it contains no customer PII
-- and records business transactions needed for operations and finance reporting.
BEGIN;

CREATE TABLE IF NOT EXISTS public.booking_lifecycle_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE RESTRICT,
  event_type text NOT NULL CHECK (event_type IN (
    'booking_submitted',
    'booking_status_confirmed',
    'booking_cancellation_requested',
    'booking_cancelled',
    'booking_completed',
    'booking_no_show',
    'payment_received',
    'payment_partially_received',
    'payment_failed',
    'payment_transaction_refunded',
    'refund_processed'
  )),
  source_table text NOT NULL CHECK (source_table IN ('bookings', 'payment_transactions', 'refund_records')),
  source_record_id uuid NOT NULL,
  event_key text NOT NULL UNIQUE,
  previous_status text,
  new_status text,
  amount numeric,
  currency text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT booking_lifecycle_events_amount_nonnegative CHECK (amount IS NULL OR amount >= 0),
  CONSTRAINT booking_lifecycle_events_metadata_size CHECK (pg_column_size(metadata) <= 2048)
);

CREATE INDEX IF NOT EXISTS idx_booking_lifecycle_events_booking_time
  ON public.booking_lifecycle_events (booking_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_booking_lifecycle_events_type_time
  ON public.booking_lifecycle_events (event_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_booking_lifecycle_events_source
  ON public.booking_lifecycle_events (source_table, source_record_id);

ALTER TABLE public.booking_lifecycle_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.booking_lifecycle_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.booking_lifecycle_events TO service_role;
COMMENT ON TABLE public.booking_lifecycle_events IS
  'Operational booking/payment event ledger. Contains a pseudonymous booking UUID but no direct customer contact details; not visitor tracking and accessible only to trusted server/service-role workflows.';

CREATE OR REPLACE FUNCTION private.record_booking_lifecycle_event(
  p_booking_id uuid,
  p_event_type text,
  p_source_table text,
  p_source_record_id uuid,
  p_event_key text,
  p_previous_status text DEFAULT NULL,
  p_new_status text DEFAULT NULL,
  p_amount numeric DEFAULT NULL,
  p_currency text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_occurred_at timestamptz DEFAULT now()
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF p_booking_id IS NULL OR p_source_record_id IS NULL OR p_event_key IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.booking_lifecycle_events (
    booking_id, event_type, source_table, source_record_id, event_key,
    previous_status, new_status, amount, currency, metadata, occurred_at
  )
  VALUES (
    p_booking_id, p_event_type, p_source_table, p_source_record_id, p_event_key,
    p_previous_status, p_new_status, p_amount, upper(NULLIF(p_currency, '')),
    COALESCE(p_metadata, '{}'::jsonb), COALESCE(p_occurred_at, now())
  )
  ON CONFLICT (event_key) DO NOTHING;
END;
$function$;

CREATE OR REPLACE FUNCTION private.capture_booking_lifecycle_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_event_type text;
  v_event_key text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM private.record_booking_lifecycle_event(
      NEW.id, 'booking_submitted', 'bookings', NEW.id,
      'booking:' || NEW.id::text || ':submitted',
      NULL, NEW.status, NEW.total, NEW.currency,
      jsonb_build_object('booking_kind', NEW.booking_kind),
      COALESCE(NEW.created_at, now())
    );
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    v_event_type := CASE NEW.status
      WHEN 'confirmed' THEN 'booking_status_confirmed'
      WHEN 'cancellation_requested' THEN 'booking_cancellation_requested'
      WHEN 'cancelled' THEN 'booking_cancelled'
      WHEN 'no_show' THEN 'booking_no_show'
      ELSE NULL
    END;

    IF v_event_type IS NOT NULL THEN
      v_event_key := 'booking:' || NEW.id::text || ':status:' ||
        COALESCE(OLD.status, 'none') || '->' || NEW.status || ':' ||
        to_char(COALESCE(NEW.updated_at, now()) AT TIME ZONE 'UTC', 'YYYYMMDDHH24MISSUS');
      PERFORM private.record_booking_lifecycle_event(
        NEW.id, v_event_type, 'bookings', NEW.id, v_event_key,
        OLD.status, NEW.status, NEW.total, NEW.currency,
        jsonb_build_object('booking_kind', NEW.booking_kind),
        COALESCE(NEW.updated_at, now())
      );
    END IF;
  END IF;

  -- A booking is only a completed sale/experience when both operational completion
  -- and ledger-authoritative payment are true. A status-only update is insufficient.
  IF NEW.status = 'completed' AND NEW.payment_status = 'paid'
     AND (OLD.status IS DISTINCT FROM 'completed' OR OLD.payment_status IS DISTINCT FROM 'paid') THEN
    v_event_key := 'booking:' || NEW.id::text || ':completed-paid:' ||
      to_char(COALESCE(NEW.updated_at, now()) AT TIME ZONE 'UTC', 'YYYYMMDDHH24MISSUS');
    PERFORM private.record_booking_lifecycle_event(
      NEW.id, 'booking_completed', 'bookings', NEW.id, v_event_key,
      OLD.status || '/' || OLD.payment_status, NEW.status || '/' || NEW.payment_status,
      NEW.total, NEW.currency, jsonb_build_object('booking_kind', NEW.booking_kind),
      COALESCE(NEW.updated_at, now())
    );
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION private.capture_payment_lifecycle_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_event_type text;
  v_event_key text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  v_event_type := CASE lower(trim(NEW.status))
    WHEN 'paid' THEN 'payment_received'
    WHEN 'partially paid' THEN 'payment_partially_received'
    WHEN 'failed' THEN 'payment_failed'
    WHEN 'refunded' THEN 'payment_transaction_refunded'
    ELSE NULL
  END;

  IF v_event_type IS NOT NULL THEN
    v_event_key := 'payment:' || NEW.id::text || ':' || lower(replace(NEW.status, ' ', '_')) || ':' ||
      to_char(COALESCE(NEW.updated_at, now()) AT TIME ZONE 'UTC', 'YYYYMMDDHH24MISSUS');
    PERFORM private.record_booking_lifecycle_event(
      NEW.booking_id, v_event_type, 'payment_transactions', NEW.id, v_event_key,
      CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NULL END,
      NEW.status, NEW.amount, NEW.currency,
      jsonb_build_object('payment_method', NEW.payment_method, 'is_manual', NEW.is_manual),
      COALESCE(NEW.payment_date, NEW.updated_at, now())
    );
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION private.capture_refund_lifecycle_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_event_key text;
BEGIN
  IF lower(trim(NEW.status)) = 'processed'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    v_event_key := 'refund:' || NEW.id::text || ':processed:' ||
      to_char(COALESCE(NEW.updated_at, now()) AT TIME ZONE 'UTC', 'YYYYMMDDHH24MISSUS');
    PERFORM private.record_booking_lifecycle_event(
      NEW.booking_id, 'refund_processed', 'refund_records', NEW.id, v_event_key,
      CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NULL END,
      NEW.status, COALESCE(NEW.approved_amount, NEW.amount), NEW.currency,
      jsonb_build_object('refund_method', NEW.refund_method),
      COALESCE(NEW.processed_date, NEW.updated_at, now())
    );
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_capture_booking_lifecycle_event ON public.bookings;
CREATE TRIGGER trg_capture_booking_lifecycle_event
AFTER INSERT OR UPDATE OF status, payment_status ON public.bookings
FOR EACH ROW EXECUTE FUNCTION private.capture_booking_lifecycle_event();

DROP TRIGGER IF EXISTS trg_capture_payment_lifecycle_event ON public.payment_transactions;
CREATE TRIGGER trg_capture_payment_lifecycle_event
AFTER INSERT OR UPDATE OF status ON public.payment_transactions
FOR EACH ROW EXECUTE FUNCTION private.capture_payment_lifecycle_event();

DROP TRIGGER IF EXISTS trg_capture_refund_lifecycle_event ON public.refund_records;
CREATE TRIGGER trg_capture_refund_lifecycle_event
AFTER INSERT OR UPDATE OF status ON public.refund_records
FOR EACH ROW EXECUTE FUNCTION private.capture_refund_lifecycle_event();

REVOKE ALL ON FUNCTION private.record_booking_lifecycle_event(uuid,text,text,uuid,text,text,text,numeric,text,jsonb,timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.capture_booking_lifecycle_event() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.capture_payment_lifecycle_event() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.capture_refund_lifecycle_event() FROM PUBLIC, anon, authenticated;

COMMIT;
