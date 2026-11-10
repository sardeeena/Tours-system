-- Finance ledger integrity: all payment/refund writes are transactional and server-authorized.
-- No historical data is rewritten by this migration.

ALTER TABLE public.payment_transactions
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

ALTER TABLE public.refund_records
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS payment_transactions_idempotency_key_uidx
  ON public.payment_transactions (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS payment_transactions_provider_reference_uidx
  ON public.payment_transactions (provider, lower(btrim(transaction_reference)))
  WHERE transaction_reference IS NOT NULL AND btrim(transaction_reference) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS refund_records_idempotency_key_uidx
  ON public.refund_records (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Keep reads governed by existing RLS, but prevent clients from bypassing the
-- transactional RPCs for payment and refund mutations.
REVOKE ALL PRIVILEGES ON TABLE public.payment_transactions FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.refund_records FROM anon, authenticated;
GRANT SELECT ON TABLE public.payment_transactions TO authenticated;
GRANT SELECT ON TABLE public.refund_records TO authenticated;

-- Provider configuration can contain credentials in the future. Expose only safe metadata.
REVOKE ALL PRIVILEGES ON TABLE public.payment_providers FROM anon, authenticated;
GRANT SELECT (id, name, provider_type, is_connected, is_manual, supported_currencies, description)
  ON TABLE public.payment_providers TO authenticated;

CREATE OR REPLACE FUNCTION public.record_payment_atomic(
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
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount > 100000000 THEN
    RAISE EXCEPTION 'Payment amount must be positive and within supported limits' USING ERRCODE = '22023';
  END IF;
  IF v_currency !~ '^[A-Z]{3}$' THEN
    RAISE EXCEPTION 'Invalid payment currency' USING ERRCODE = '22023';
  END IF;
  IF v_method NOT IN ('Cash', 'Card', 'Bank Transfer', 'Other') THEN
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
    AND currency = v_currency
    AND status IN ('Paid', 'Partially Paid');

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
    AND currency = v_currency
    AND status IN ('Paid', 'Partially Paid');

  v_payment_status := CASE
    WHEN v_paid_after >= v_booking.total THEN 'paid'
    WHEN v_paid_after > 0 THEN 'partially_paid'
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

CREATE OR REPLACE FUNCTION public.request_refund_atomic(
  p_booking_reference TEXT,
  p_payment_id UUID,
  p_requested_amount NUMERIC,
  p_currency TEXT,
  p_reason TEXT,
  p_refund_method TEXT,
  p_requested_by TEXT,
  p_notes TEXT,
  p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_payment public.payment_transactions%ROWTYPE;
  v_refund public.refund_records%ROWTYPE;
  v_existing public.refund_records%ROWTYPE;
  v_currency TEXT := upper(btrim(p_currency));
  v_paid NUMERIC(10,2) := 0;
  v_committed NUMERIC(10,2) := 0;
BEGIN
  IF NOT (
    auth.role() = 'service_role'
    OR (auth.uid() IS NOT NULL AND public.is_admin())
  ) THEN
    RAISE EXCEPTION 'Not authorized to request refunds' USING ERRCODE = '42501';
  END IF;
  IF p_idempotency_key IS NULL OR length(btrim(p_idempotency_key)) < 16 OR length(p_idempotency_key) > 200 THEN
    RAISE EXCEPTION 'A valid idempotency key is required' USING ERRCODE = '22023';
  END IF;
  IF p_requested_amount IS NULL OR p_requested_amount <= 0 OR p_requested_amount > 100000000 THEN
    RAISE EXCEPTION 'Refund amount must be positive and within supported limits' USING ERRCODE = '22023';
  END IF;
  IF v_currency !~ '^[A-Z]{3}$' OR nullif(btrim(coalesce(p_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Valid currency and refund reason are required' USING ERRCODE = '22023';
  END IF;
  IF p_refund_method NOT IN ('Card Reversal', 'Cash Return', 'Bank Wire', 'Store Credit / Voucher', 'Other') THEN
    RAISE EXCEPTION 'Unsupported refund method' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_idempotency_key, 0));

  SELECT * INTO v_existing
  FROM public.refund_records
  WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_existing.requested_amount <> p_requested_amount
      OR upper(v_existing.currency) <> v_currency
      OR v_existing.booking_reference <> upper(btrim(p_booking_reference)) THEN
      RAISE EXCEPTION 'Idempotency key was already used for a different refund' USING ERRCODE = '23505';
    END IF;
    RETURN jsonb_build_object('success', true, 'duplicate', true, 'refund', to_jsonb(v_existing));
  END IF;

  SELECT * INTO v_booking
  FROM public.bookings
  WHERE booking_reference = upper(btrim(p_booking_reference))
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found' USING ERRCODE = 'P0002';
  END IF;
  IF upper(v_booking.currency) <> v_currency THEN
    RAISE EXCEPTION 'Refund currency must match the booking currency' USING ERRCODE = '22023';
  END IF;

  IF p_payment_id IS NOT NULL THEN
    SELECT * INTO v_payment
    FROM public.payment_transactions
    WHERE id = p_payment_id AND booking_id = v_booking.id
      AND currency = v_currency AND status IN ('Paid', 'Partially Paid')
    FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Selected payment does not belong to this booking or is not settled' USING ERRCODE = '22023';
    END IF;
  END IF;

  SELECT coalesce(sum(amount), 0)
  INTO v_paid
  FROM public.payment_transactions
  WHERE booking_id = v_booking.id AND currency = v_currency
    AND status IN ('Paid', 'Partially Paid');

  SELECT coalesce(sum(coalesce(approved_amount, requested_amount, amount)), 0)
  INTO v_committed
  FROM public.refund_records
  WHERE booking_id = v_booking.id AND currency = v_currency
    AND status IN ('pending_approval', 'approved', 'processed');

  IF p_requested_amount > greatest(0, v_paid - v_committed) THEN
    RAISE EXCEPTION 'Refund exceeds the remaining refundable balance' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.refund_records (
    booking_id, payment_id, customer_id, amount, requested_amount, currency,
    reason, refund_method, status, requested_by, customer_name, customer_email,
    booking_reference, notes, idempotency_key
  ) VALUES (
    v_booking.id, p_payment_id, v_booking.customer_id, p_requested_amount,
    p_requested_amount, v_currency, btrim(p_reason), p_refund_method,
    'pending_approval', nullif(btrim(coalesce(p_requested_by, '')), ''),
    (SELECT concat_ws(' ', c.first_name, c.last_name) FROM public.customers c WHERE c.id = v_booking.customer_id),
    (SELECT c.email FROM public.customers c WHERE c.id = v_booking.customer_id),
    v_booking.booking_reference, nullif(btrim(coalesce(p_notes, '')), ''),
    p_idempotency_key
  )
  RETURNING * INTO v_refund;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, old_data, new_data)
  VALUES (
    auth.uid(), 'refund.requested', 'refund_record', v_refund.id::text, NULL,
    jsonb_build_object('refund', to_jsonb(v_refund))
  );

  RETURN jsonb_build_object('success', true, 'duplicate', false, 'refund', to_jsonb(v_refund));
END;
$function$;

CREATE OR REPLACE FUNCTION public.transition_refund_atomic(
  p_refund_id UUID,
  p_action TEXT,
  p_amount NUMERIC,
  p_actor TEXT,
  p_reason TEXT,
  p_transaction_reference TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_refund public.refund_records%ROWTYPE;
  v_booking public.bookings%ROWTYPE;
  v_updated public.refund_records%ROWTYPE;
  v_paid NUMERIC(10,2) := 0;
  v_refunded NUMERIC(10,2) := 0;
  v_net NUMERIC(10,2) := 0;
  v_new_payment_status TEXT;
BEGIN
  IF NOT (
    auth.role() = 'service_role'
    OR (auth.uid() IS NOT NULL AND public.is_admin())
  ) THEN
    RAISE EXCEPTION 'Not authorized to transition refunds' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_refund
  FROM public.refund_records
  WHERE id = p_refund_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Refund record not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_booking
  FROM public.bookings
  WHERE id = v_refund.booking_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Refund booking not found' USING ERRCODE = 'P0002';
  END IF;

  IF p_action = 'approve' THEN
    IF v_refund.status <> 'pending_approval' THEN
      RAISE EXCEPTION 'Only pending refunds can be approved' USING ERRCODE = '22023';
    END IF;
    IF p_amount IS NULL OR p_amount <= 0 OR p_amount > v_refund.requested_amount THEN
      RAISE EXCEPTION 'Approved amount must be positive and cannot exceed the requested amount' USING ERRCODE = '22023';
    END IF;

    UPDATE public.refund_records
    SET approved_amount = p_amount,
        amount = p_amount,
        status = 'approved',
        approved_by = nullif(btrim(coalesce(p_actor, '')), ''),
        updated_at = now()
    WHERE id = p_refund_id
    RETURNING * INTO v_updated;

  ELSIF p_action = 'process' THEN
    IF v_refund.status <> 'approved' THEN
      RAISE EXCEPTION 'Only approved refunds can be processed' USING ERRCODE = '22023';
    END IF;
    IF nullif(btrim(coalesce(p_transaction_reference, '')), '') IS NULL THEN
      RAISE EXCEPTION 'A payout transaction reference is required before processing' USING ERRCODE = '22023';
    END IF;

    UPDATE public.refund_records
    SET status = 'processed',
        amount = coalesce(approved_amount, requested_amount),
        processed_date = now(),
        processed_by = nullif(btrim(coalesce(p_actor, '')), ''),
        transaction_reference = btrim(p_transaction_reference),
        updated_at = now()
    WHERE id = p_refund_id
    RETURNING * INTO v_updated;

    SELECT coalesce(sum(amount), 0)
    INTO v_paid
    FROM public.payment_transactions
    WHERE booking_id = v_booking.id AND currency = v_refund.currency
      AND status IN ('Paid', 'Partially Paid');

    SELECT coalesce(sum(coalesce(approved_amount, requested_amount, amount)), 0)
    INTO v_refunded
    FROM public.refund_records
    WHERE booking_id = v_booking.id AND currency = v_refund.currency
      AND status = 'processed';

    v_net := greatest(0, v_paid - v_refunded);
    v_new_payment_status := CASE
      WHEN v_net <= 0 AND v_paid > 0 THEN 'refunded'
      WHEN v_net > 0 AND v_net < v_booking.total THEN 'partially_paid'
      WHEN v_net >= v_booking.total THEN 'paid'
      ELSE 'pending'
    END;

    UPDATE public.bookings
    SET payment_status = v_new_payment_status,
        updated_at = now()
    WHERE id = v_booking.id;

  ELSIF p_action = 'reject' THEN
    IF v_refund.status <> 'pending_approval' THEN
      RAISE EXCEPTION 'Only pending refunds can be rejected' USING ERRCODE = '22023';
    END IF;

    UPDATE public.refund_records
    SET status = 'rejected',
        notes = concat_ws(E'\n', notes, nullif(btrim(coalesce(p_reason, '')), '')),
        updated_at = now()
    WHERE id = p_refund_id
    RETURNING * INTO v_updated;

  ELSE
    RAISE EXCEPTION 'Unsupported refund action' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, old_data, new_data)
  VALUES (
    auth.uid(), 'refund.' || p_action, 'refund_record', v_updated.id::text,
    jsonb_build_object('status', v_refund.status, 'amount', v_refund.amount),
    jsonb_build_object('refund', to_jsonb(v_updated))
  );

  RETURN jsonb_build_object('success', true, 'refund', to_jsonb(v_updated));
END;
$function$;

REVOKE ALL ON FUNCTION public.record_payment_atomic(TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.request_refund_atomic(TEXT, UUID, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.transition_refund_atomic(UUID, TEXT, NUMERIC, TEXT, TEXT, TEXT) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.record_payment_atomic(TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.request_refund_atomic(TEXT, UUID, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.transition_refund_atomic(UUID, TEXT, NUMERIC, TEXT, TEXT, TEXT) TO authenticated, service_role;


-- A booking can have at most one issued invoice. Sequence allocation is server-side
-- so concurrent invoice requests cannot generate the same invoice number.
CREATE UNIQUE INDEX IF NOT EXISTS invoices_booking_id_uidx
  ON public.invoices (booking_id);

CREATE SEQUENCE IF NOT EXISTS public.invoice_number_seq
  START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

CREATE OR REPLACE FUNCTION public.next_invoice_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_sequence BIGINT;
BEGIN
  IF NOT (
    auth.role() = 'service_role'
    OR (auth.uid() IS NOT NULL AND public.is_admin())
  ) THEN
    RAISE EXCEPTION 'Not authorized to issue invoices' USING ERRCODE = '42501';
  END IF;

  v_sequence := pg_catalog.nextval('public.invoice_number_seq'::regclass);
  RETURN pg_catalog.format('INV-%s-%s', pg_catalog.to_char(CURRENT_DATE, 'YYYY'), pg_catalog.lpad(v_sequence::TEXT, 6, '0'));
END;
$function$;

REVOKE ALL ON FUNCTION public.next_invoice_number() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_invoice_number() TO authenticated, service_role;
