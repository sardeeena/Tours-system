-- Keep booking payment status derived from net settled ledger activity.
-- A processed refund reduces the balance available for subsequent collections.
BEGIN;

CREATE OR REPLACE FUNCTION private.record_payment_atomic(
  p_booking_reference TEXT,
  p_amount NUMERIC,
  p_currency TEXT,
  p_payment_method TEXT,
  p_provider TEXT,
  p_status TEXT,
  p_transaction_reference TEXT,
  p_notes TEXT,
  p_recorded_by TEXT,
  p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_provider public.payment_providers%ROWTYPE;
  v_payment public.payment_transactions%ROWTYPE;
  v_existing public.payment_transactions%ROWTYPE;
  v_currency TEXT := upper(btrim(p_currency));
  v_method TEXT := btrim(p_payment_method);
  v_status TEXT;
  v_paid_before NUMERIC(10,2) := 0;
  v_paid_after NUMERIC(10,2) := 0;
  v_refunded_before NUMERIC(10,2) := 0;
  v_refunded_after NUMERIC(10,2) := 0;
  v_net_paid_after NUMERIC(10,2) := 0;
  v_payment_status TEXT;
BEGIN
  IF NOT (
    auth.role() = 'service_role'
    OR (auth.uid() IS NOT NULL AND public.is_admin())
  ) THEN
    RAISE EXCEPTION 'Not authorized to record payments' USING ERRCODE = '42501';
  END IF;

  IF p_idempotency_key IS NULL OR length(btrim(p_idempotency_key)) < 16 OR length(p_idempotency_key) > 200 THEN
    RAISE EXCEPTION 'A valid idempotency key is required' USING ERRCODE = '22023';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount > 99999999.99 OR p_amount <> round(p_amount, 2) THEN
    RAISE EXCEPTION 'Payment amount must be positive, have at most two decimal places, and be within supported limits' USING ERRCODE = '22023';
  END IF;
  IF v_currency IS NULL OR v_currency !~ '^[A-Z]{3}$' THEN
    RAISE EXCEPTION 'Invalid payment currency' USING ERRCODE = '22023';
  END IF;
  IF v_method IS NULL OR v_method NOT IN ('Cash', 'Card', 'Bank Transfer', 'Other') THEN
    RAISE EXCEPTION 'Unsupported payment method. Online gateway payments must be completed through a connected gateway.' USING ERRCODE = '22023';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('Pending', 'Paid', 'Partially Paid', 'Failed', 'pending', 'paid', 'partially_paid', 'failed') THEN
    RAISE EXCEPTION 'Unsupported payment status' USING ERRCODE = '22023';
  END IF;

  v_status := CASE lower(p_status)
    WHEN 'pending' THEN 'Pending'
    WHEN 'paid' THEN 'Paid'
    WHEN 'partially paid' THEN 'Partially Paid'
    WHEN 'partially_paid' THEN 'Partially Paid'
    WHEN 'failed' THEN 'Failed'
    ELSE NULL
  END;

  IF p_booking_reference IS NULL OR length(btrim(p_booking_reference)) < 3 OR length(btrim(p_booking_reference)) > 160 THEN
    RAISE EXCEPTION 'A valid booking reference is required' USING ERRCODE = '22023';
  END IF;
  IF p_transaction_reference IS NULL OR length(btrim(p_transaction_reference)) < 3 OR length(p_transaction_reference) > 160 THEN
    RAISE EXCEPTION 'A transaction reference is required' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_idempotency_key, 0));

  SELECT * INTO v_existing
  FROM public.payment_transactions
  WHERE idempotency_key = p_idempotency_key;

  IF FOUND THEN
    IF v_existing.amount <> p_amount
      OR upper(v_existing.currency) <> v_currency
      OR v_existing.payment_method <> v_method
      OR coalesce(v_existing.provider, '') <> coalesce(p_provider, '')
      OR upper(coalesce(v_existing.booking_reference, '')) <> upper(btrim(p_booking_reference))
      OR lower(v_existing.transaction_reference) <> lower(btrim(p_transaction_reference)) THEN
      RAISE EXCEPTION 'Idempotency key was already used for a different payment' USING ERRCODE = '23505';
    END IF;
    RETURN jsonb_build_object('success', true, 'duplicate', true, 'payment', to_jsonb(v_existing));
  END IF;

  SELECT * INTO v_booking
  FROM public.bookings
  WHERE booking_reference = upper(btrim(p_booking_reference))
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found' USING ERRCODE = 'P0002';
  END IF;
  IF upper(v_booking.currency) <> v_currency THEN
    RAISE EXCEPTION 'Payment currency must match the booking currency' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_provider
  FROM public.payment_providers
  WHERE id = p_provider
  FOR SHARE;

  IF NOT FOUND OR NOT v_provider.is_connected THEN
    RAISE EXCEPTION 'Selected payment provider is not connected or does not exist' USING ERRCODE = '22023';
  END IF;
  IF NOT (v_provider.supported_currencies @> ARRAY[v_currency]) THEN
    RAISE EXCEPTION 'Selected provider does not support this currency' USING ERRCODE = '22023';
  END IF;
  IF v_provider.is_manual = false THEN
    RAISE EXCEPTION 'Online payment gateway processing is not configured; use a verified manual provider' USING ERRCODE = '0A000';
  END IF;

  SELECT coalesce(sum(amount), 0)
  INTO v_paid_before
  FROM public.payment_transactions
  WHERE booking_id = v_booking.id
    AND upper(currency) = v_currency
    AND status IN ('Paid', 'Partially Paid');

  SELECT coalesce(sum(coalesce(approved_amount, requested_amount, amount)), 0)
  INTO v_refunded_before
  FROM public.refund_records
  WHERE booking_id = v_booking.id
    AND upper(currency) = v_currency
    AND status = 'processed';

  -- Only money still retained by the business counts against the booking balance.
  v_paid_before := greatest(0, v_paid_before - v_refunded_before);

  IF v_status IN ('Paid', 'Partially Paid') AND v_paid_before + p_amount > v_booking.total THEN
    RAISE EXCEPTION 'Payment exceeds the remaining booking balance' USING ERRCODE = '22023';
  END IF;

  IF v_status IN ('Paid', 'Partially Paid') THEN
    IF v_paid_before + p_amount >= v_booking.total THEN
      v_status := 'Paid';
    ELSE
      v_status := 'Partially Paid';
    END IF;
  END IF;

  INSERT INTO public.payment_transactions (
    booking_id, customer_id, amount, currency, payment_method, status,
    transaction_reference, notes, recorded_by, provider, is_manual,
    customer_name, customer_email, customer_phone, booking_reference,
    idempotency_key
  ) VALUES (
    v_booking.id, v_booking.customer_id, p_amount, v_currency, v_method, v_status,
    btrim(p_transaction_reference), nullif(btrim(coalesce(p_notes, '')), ''),
    nullif(btrim(coalesce(p_recorded_by, '')), ''), p_provider, v_provider.is_manual,
    (SELECT concat_ws(' ', c.first_name, c.last_name) FROM public.customers c WHERE c.id = v_booking.customer_id),
    (SELECT c.email FROM public.customers c WHERE c.id = v_booking.customer_id),
    (SELECT c.phone FROM public.customers c WHERE c.id = v_booking.customer_id),
    v_booking.booking_reference, p_idempotency_key
  )
  RETURNING * INTO v_payment;

  SELECT coalesce(sum(amount), 0)
  INTO v_paid_after
  FROM public.payment_transactions
  WHERE booking_id = v_booking.id
    AND upper(currency) = v_currency
    AND status IN ('Paid', 'Partially Paid');

  SELECT coalesce(sum(coalesce(approved_amount, requested_amount, amount)), 0)
  INTO v_refunded_after
  FROM public.refund_records
  WHERE booking_id = v_booking.id
    AND upper(currency) = v_currency
    AND status = 'processed';

  v_net_paid_after := greatest(0, v_paid_after - v_refunded_after);
  v_payment_status := CASE
    WHEN v_paid_after > 0 AND v_net_paid_after <= 0 THEN 'refunded'
    WHEN v_net_paid_after >= v_booking.total AND v_paid_after > 0 THEN 'paid'
    WHEN v_net_paid_after > 0 THEN 'partially_paid'
    ELSE 'pending'
  END;

  UPDATE public.bookings
  SET payment_status = v_payment_status,
      updated_at = now()
  WHERE id = v_booking.id;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, old_data, new_data)
  VALUES (
    auth.uid(), 'payment.recorded', 'payment_transaction', v_payment.id::text,
    jsonb_build_object('booking_payment_status', v_booking.payment_status),
    jsonb_build_object('payment', to_jsonb(v_payment), 'booking_payment_status', v_payment_status)
  );

  RETURN jsonb_build_object('success', true, 'duplicate', false, 'payment', to_jsonb(v_payment));
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_booking_payment_status_ledger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_paid numeric(12,2) := 0;
  v_refunded numeric(12,2) := 0;
  v_net_paid numeric(12,2) := 0;
  v_expected_status text := 'pending';
  v_currency text := upper(coalesce(NEW.currency, 'EUR'));
  v_actual_status text := lower(replace(btrim(coalesce(NEW.payment_status, 'pending')), ' ', '_'));
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.payment_status IS NOT DISTINCT FROM OLD.payment_status
     AND NEW.total IS NOT DISTINCT FROM OLD.total
     AND NEW.currency IS NOT DISTINCT FROM OLD.currency THEN
    RETURN NEW;
  END IF;

  SELECT coalesce(sum(amount), 0)
  INTO v_paid
  FROM public.payment_transactions
  WHERE booking_id = NEW.id
    AND upper(currency) = v_currency
    AND status IN ('Paid', 'Partially Paid');

  SELECT coalesce(sum(coalesce(approved_amount, requested_amount, amount)), 0)
  INTO v_refunded
  FROM public.refund_records
  WHERE booking_id = NEW.id
    AND upper(currency) = v_currency
    AND status = 'processed';

  v_net_paid := greatest(0, v_paid - v_refunded);
  v_expected_status := CASE
    WHEN v_paid > 0 AND v_net_paid <= 0 THEN 'refunded'
    WHEN v_paid > 0 AND v_net_paid >= NEW.total THEN 'paid'
    WHEN v_net_paid > 0 THEN 'partially_paid'
    ELSE 'pending'
  END;

  IF v_actual_status <> v_expected_status THEN
    RAISE EXCEPTION 'Booking payment status must match the financial ledger (expected %, received %).',
      v_expected_status, v_actual_status
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_enforce_booking_payment_status_ledger ON public.bookings;
CREATE TRIGGER trg_enforce_booking_payment_status_ledger
BEFORE INSERT OR UPDATE OF payment_status, total, currency
ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.enforce_booking_payment_status_ledger();

REVOKE ALL ON FUNCTION public.enforce_booking_payment_status_ledger() FROM PUBLIC, anon, authenticated;

COMMIT;
