-- Booking lookup and cancellation lifecycle hardening.
-- This migration is additive and does not touch the remote database until explicitly applied.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS cancellation_previous_status TEXT,
  ADD COLUMN IF NOT EXISTS cancellation_requested_at TIMESTAMPTZ;

-- Keep the cancellation-request event distinct from a completed cancellation.
ALTER TABLE public.automation_events
  DROP CONSTRAINT IF EXISTS automation_events_event_name_check;
ALTER TABLE public.automation_events
  ADD CONSTRAINT automation_events_event_name_check
  CHECK (event_name IN (
    'booking.created',
    'booking.updated',
    'payment.received',
    'payment.failed',
    'booking.cancelled',
    'booking.cancellation_requested',
    'departure.tomorrow',
    'followup.due'
  ));

CREATE OR REPLACE FUNCTION public.lookup_booking_secure(
  p_reference TEXT,
  p_verification TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $lookup$
DECLARE
  v_clean_ref TEXT;
  v_clean_contact TEXT;
  v_digits_contact TEXT;
  v_cust_email TEXT;
  v_cust_phone_digits TEXT;
  v_client_ip TEXT;
  v_booking RECORD;
  v_tour RECORD;
  v_customer RECORD;
  v_extras JSONB;
  v_masked_email TEXT;
  v_masked_phone TEXT;
  v_email_parts TEXT[];
BEGIN
  IF p_reference IS NULL OR LENGTH(TRIM(p_reference)) < 10 OR LENGTH(TRIM(p_reference)) > 80
     OR p_verification IS NULL OR LENGTH(TRIM(p_verification)) < 3 OR LENGTH(TRIM(p_verification)) > 254 THEN
    RETURN NULL;
  END IF;

  v_clean_ref := UPPER(TRIM(p_reference));
  v_clean_contact := LOWER(TRIM(p_verification));
  v_digits_contact := REGEXP_REPLACE(p_verification, '[^0-9]', '', 'g');

  PERFORM public.check_atomic_rate_limit(
    'lookup_booking_reference', v_clean_ref, INTERVAL '1 minute', 10,
    'Too many verification attempts for this reservation. Please wait a moment.'
  );
  PERFORM public.check_atomic_rate_limit(
    'lookup_booking_contact', MD5(v_clean_contact), INTERVAL '1 minute', 20,
    'Too many reservation verification attempts. Please wait a moment.'
  );

  BEGIN
    v_client_ip := NULLIF(current_setting('request.headers', true)::json->>'cf-connecting-ip', '');
    IF v_client_ip IS NULL THEN
      v_client_ip := NULLIF(current_setting('request.headers', true)::json->>'x-forwarded-for', '');
      IF v_client_ip LIKE '%,%' THEN
        v_client_ip := TRIM(SPLIT_PART(v_client_ip, ',', 1));
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_client_ip := NULL;
  END;

  IF v_client_ip IS NOT NULL THEN
    PERFORM public.check_atomic_rate_limit(
      'lookup_booking_ip', v_client_ip, INTERVAL '1 minute', 30,
      'Too many reservation lookup requests from this network. Please wait a moment.'
    );
  END IF;

  SELECT b.* INTO v_booking
  FROM public.bookings AS b
  WHERE b.booking_reference = v_clean_ref;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT c.* INTO v_customer
  FROM public.customers AS c
  WHERE c.id = v_booking.customer_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  v_cust_email := LOWER(TRIM(COALESCE(v_customer.email, '')));
  v_cust_phone_digits := REGEXP_REPLACE(COALESCE(v_customer.phone, ''), '[^0-9]', '', 'g');

  -- Normalize Egypt's +20 and domestic leading-zero formats before exact comparison.
  IF LEFT(v_digits_contact, 2) = '20' THEN v_digits_contact := SUBSTRING(v_digits_contact FROM 3); END IF;
  IF LEFT(v_digits_contact, 1) = '0' THEN v_digits_contact := SUBSTRING(v_digits_contact FROM 2); END IF;
  IF LEFT(v_cust_phone_digits, 2) = '20' THEN v_cust_phone_digits := SUBSTRING(v_cust_phone_digits FROM 3); END IF;
  IF LEFT(v_cust_phone_digits, 1) = '0' THEN v_cust_phone_digits := SUBSTRING(v_cust_phone_digits FROM 2); END IF;

  IF v_cust_email = v_clean_contact THEN
    NULL;
  ELSIF LENGTH(v_digits_contact) >= 8 AND v_cust_phone_digits = v_digits_contact THEN
    NULL;
  ELSE
    RETURN NULL;
  END IF;

  SELECT t.id, t.title, t.slug, t.departure_time, t.duration,
         d.name AS destination_name
  INTO v_tour
  FROM public.tours AS t
  LEFT JOIN public.destinations AS d ON d.id = t.destination_id
  WHERE t.id = v_booking.tour_id;

  SELECT COALESCE(
    JSONB_AGG(
      JSONB_BUILD_OBJECT(
        'name', be.name,
        'quantity', be.quantity,
        'unitPrice', be.unit_price,
        'totalPrice', be.total_price,
        'pricingType', be.pricing_type
      ) ORDER BY be.created_at
    ),
    '[]'::jsonb
  )
  INTO v_extras
  FROM public.booking_extras AS be
  WHERE be.booking_id = v_booking.id;

  IF POSITION('@' IN COALESCE(v_customer.email, '')) > 0 THEN
    v_email_parts := STRING_TO_ARRAY(v_customer.email, '@');
    IF LENGTH(v_email_parts[1]) > 2 THEN
      v_masked_email := SUBSTRING(v_email_parts[1] FROM 1 FOR 1) || '***' ||
        SUBSTRING(v_email_parts[1] FROM LENGTH(v_email_parts[1]) FOR 1) || '@' || v_email_parts[2];
    ELSE
      v_masked_email := '***@' || v_email_parts[2];
    END IF;
  ELSE
    v_masked_email := '***';
  END IF;

  IF LENGTH(COALESCE(v_customer.phone, '')) > 4 THEN
    v_masked_phone := '***' || RIGHT(v_customer.phone, 4);
  ELSE
    v_masked_phone := '***';
  END IF;

  RETURN JSONB_BUILD_OBJECT(
    'found', TRUE,
    'bookingReference', v_booking.booking_reference,
    'status', v_booking.status,
    'paymentStatus', v_booking.payment_status,
    'paymentMethod', v_booking.payment_method,
    'bookingDate', v_booking.booking_date,
    'createdAt', v_booking.created_at,
    'guests', JSONB_BUILD_OBJECT(
      'adults', v_booking.adult_count,
      'children', v_booking.child_count,
      'infants', v_booking.infant_count,
      'total', v_booking.adult_count + v_booking.child_count + v_booking.infant_count
    ),
    'tour', JSONB_BUILD_OBJECT(
      'id', v_tour.id,
      'title', COALESCE(v_tour.title, 'Red Sea Excursion'),
      'slug', v_tour.slug,
      'destination', COALESCE(v_tour.destination_name, 'Hurghada'),
      'departureTime', COALESCE(v_tour.departure_time, '08:30 AM'),
      'duration', v_tour.duration
    ),
    'pickup', JSONB_BUILD_OBJECT(
      'hotelName', v_booking.pickup_hotel_name,
      'roomNumber', v_booking.pickup_room_number
    ),
    'pricing', JSONB_BUILD_OBJECT(
      'subtotal', v_booking.subtotal,
      'extrasTotal', v_booking.extras_total,
      'discount', v_booking.discount,
      'total', v_booking.total,
      'currency', v_booking.currency,
      'paymentStatus', v_booking.payment_status,
      'paymentMethod', v_booking.payment_method
    ),
    'customer', JSONB_BUILD_OBJECT(
      'firstName', v_customer.first_name,
      'lastName', COALESCE(SUBSTRING(v_customer.last_name FROM 1 FOR 1), '') || '.',
      'emailMasked', v_masked_email,
      'phoneMasked', v_masked_phone,
      'country', v_customer.country
    ),
    'extras', v_extras,
    'specialRequests', v_booking.special_requests
  );
END;
$lookup$;

REVOKE ALL ON FUNCTION public.lookup_booking_secure(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_booking_secure(TEXT, TEXT) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.request_booking_cancellation_secure(
  p_reference TEXT,
  p_verification TEXT,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $cancel_request$
DECLARE
  v_clean_ref TEXT;
  v_clean_contact TEXT;
  v_digits_contact TEXT;
  v_cust_email TEXT;
  v_cust_phone_digits TEXT;
  v_client_ip TEXT;
  v_booking RECORD;
  v_customer RECORD;
  v_reason TEXT;
BEGIN
  IF p_reference IS NULL OR LENGTH(TRIM(p_reference)) < 10 OR LENGTH(TRIM(p_reference)) > 80
     OR p_verification IS NULL OR LENGTH(TRIM(p_verification)) < 3 OR LENGTH(TRIM(p_verification)) > 254 THEN
    RETURN JSONB_BUILD_OBJECT('success', FALSE, 'error', 'Reservation details could not be verified.');
  END IF;

  v_clean_ref := UPPER(TRIM(p_reference));
  v_clean_contact := LOWER(TRIM(p_verification));
  v_digits_contact := REGEXP_REPLACE(p_verification, '[^0-9]', '', 'g');
  v_reason := LEFT(COALESCE(NULLIF(TRIM(p_reason), ''), 'Guest requested online cancellation'), 500);

  PERFORM public.check_atomic_rate_limit(
    'cancel_booking_reference', v_clean_ref, INTERVAL '1 minute', 5,
    'Too many cancellation requests for this reservation. Please wait a moment.'
  );
  PERFORM public.check_atomic_rate_limit(
    'cancel_booking_contact', MD5(v_clean_contact), INTERVAL '1 minute', 10,
    'Too many cancellation requests. Please wait a moment.'
  );

  BEGIN
    v_client_ip := NULLIF(current_setting('request.headers', true)::json->>'cf-connecting-ip', '');
    IF v_client_ip IS NULL THEN
      v_client_ip := NULLIF(current_setting('request.headers', true)::json->>'x-forwarded-for', '');
      IF v_client_ip LIKE '%,%' THEN
        v_client_ip := TRIM(SPLIT_PART(v_client_ip, ',', 1));
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_client_ip := NULL;
  END;

  IF v_client_ip IS NOT NULL THEN
    PERFORM public.check_atomic_rate_limit(
      'cancel_booking_ip', v_client_ip, INTERVAL '1 minute', 10,
      'Too many cancellation requests from this network. Please wait a moment.'
    );
  END IF;

  SELECT b.* INTO v_booking
  FROM public.bookings AS b
  WHERE b.booking_reference = v_clean_ref
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN JSONB_BUILD_OBJECT('success', FALSE, 'error', 'Reservation details could not be verified.');
  END IF;

  SELECT c.* INTO v_customer
  FROM public.customers AS c
  WHERE c.id = v_booking.customer_id;

  IF NOT FOUND THEN
    RETURN JSONB_BUILD_OBJECT('success', FALSE, 'error', 'Reservation details could not be verified.');
  END IF;

  v_cust_email := LOWER(TRIM(COALESCE(v_customer.email, '')));
  v_cust_phone_digits := REGEXP_REPLACE(COALESCE(v_customer.phone, ''), '[^0-9]', '', 'g');

  -- Normalize Egypt's +20 and domestic leading-zero formats before exact comparison.
  IF LEFT(v_digits_contact, 2) = '20' THEN v_digits_contact := SUBSTRING(v_digits_contact FROM 3); END IF;
  IF LEFT(v_digits_contact, 1) = '0' THEN v_digits_contact := SUBSTRING(v_digits_contact FROM 2); END IF;
  IF LEFT(v_cust_phone_digits, 2) = '20' THEN v_cust_phone_digits := SUBSTRING(v_cust_phone_digits FROM 3); END IF;
  IF LEFT(v_cust_phone_digits, 1) = '0' THEN v_cust_phone_digits := SUBSTRING(v_cust_phone_digits FROM 2); END IF;

  IF v_cust_email <> v_clean_contact AND NOT (
    LENGTH(v_digits_contact) >= 8 AND v_cust_phone_digits = v_digits_contact
  ) THEN
    RETURN JSONB_BUILD_OBJECT('success', FALSE, 'error', 'Reservation details could not be verified.');
  END IF;

  IF v_booking.status IN ('cancelled', 'completed', 'no_show') THEN
    RETURN JSONB_BUILD_OBJECT('success', FALSE, 'error', 'This reservation cannot be cancelled in its current state.');
  END IF;

  IF v_booking.status = 'cancellation_requested' THEN
    RETURN JSONB_BUILD_OBJECT(
      'success', TRUE,
      'bookingReference', v_booking.booking_reference,
      'status', 'cancellation_requested',
      'alreadyRequested', TRUE,
      'message', 'Your cancellation request is already awaiting review.'
    );
  END IF;

  UPDATE public.bookings
  SET status = 'cancellation_requested',
      cancellation_previous_status = v_booking.status,
      cancellation_requested_at = NOW(),
      cancellation_reason = v_reason,
      updated_at = NOW()
  WHERE id = v_booking.id;

  INSERT INTO public.audit_logs (action, entity_type, entity_id, old_data, new_data)
  VALUES (
    'BOOKING_CANCELLATION_REQUESTED',
    'booking',
    v_booking.id::text,
    JSONB_BUILD_OBJECT('status', v_booking.status),
    JSONB_BUILD_OBJECT('status', 'cancellation_requested', 'reason', v_reason)
  );

  INSERT INTO public.automation_events (event_name, payload, entity_type, entity_id)
  VALUES (
    'booking.cancellation_requested',
    JSONB_BUILD_OBJECT('bookingReference', v_booking.booking_reference, 'reason', v_reason),
    'booking',
    v_booking.id::text
  );

  RETURN JSONB_BUILD_OBJECT(
    'success', TRUE,
    'bookingReference', v_booking.booking_reference,
    'status', 'cancellation_requested',
    'message', 'Your cancellation request has been submitted and is awaiting staff approval.'
  );
END;
$cancel_request$;

REVOKE ALL ON FUNCTION public.request_booking_cancellation_secure(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_booking_cancellation_secure(TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_resolve_booking_cancellation(
  p_reference TEXT,
  p_decision TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $cancel_resolution$
DECLARE
  v_booking RECORD;
  v_previous_status TEXT;
  v_guest_count INTEGER;
  v_new_booked_count INTEGER;
BEGIN
  IF COALESCE(auth.jwt() ->> 'role', '') <> 'service_role' AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Administrator authorization is required to resolve cancellation requests.'
      USING ERRCODE = '42501';
  END IF;

  IF p_decision IS NULL OR p_decision NOT IN ('approve', 'reject') THEN
    RETURN JSONB_BUILD_OBJECT('success', FALSE, 'error', 'Decision must be approve or reject.');
  END IF;

  SELECT b.* INTO v_booking
  FROM public.bookings AS b
  WHERE b.booking_reference = UPPER(TRIM(p_reference))
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN JSONB_BUILD_OBJECT('success', FALSE, 'error', 'Booking not found.');
  END IF;

  IF p_decision = 'approve' AND v_booking.status = 'cancelled' THEN
    RETURN JSONB_BUILD_OBJECT('success', TRUE, 'bookingReference', v_booking.booking_reference, 'status', 'cancelled', 'alreadyResolved', TRUE);
  END IF;

  IF p_decision = 'reject' AND v_booking.status <> 'cancellation_requested' THEN
    RETURN JSONB_BUILD_OBJECT('success', FALSE, 'error', 'This booking has no pending cancellation request.');
  END IF;

  IF p_decision = 'approve' AND v_booking.status NOT IN ('cancellation_requested', 'pending', 'confirmed') THEN
    RETURN JSONB_BUILD_OBJECT('success', FALSE, 'error', 'This booking cannot be cancelled in its current state.');
  END IF;

  v_previous_status := COALESCE(
    v_booking.cancellation_previous_status,
    CASE WHEN v_booking.status = 'cancellation_requested' THEN 'confirmed' ELSE v_booking.status END
  );

  IF p_decision = 'reject' THEN
    UPDATE public.bookings
    SET status = v_previous_status,
        cancellation_previous_status = NULL,
        cancellation_requested_at = NULL,
        updated_at = NOW()
    WHERE id = v_booking.id;

    INSERT INTO public.audit_logs (action, entity_type, entity_id, old_data, new_data)
    VALUES (
      'BOOKING_CANCELLATION_REJECTED',
      'booking',
      v_booking.id::text,
      JSONB_BUILD_OBJECT('status', 'cancellation_requested'),
      JSONB_BUILD_OBJECT('status', v_previous_status, 'reason', LEFT(COALESCE(p_reason, ''), 500))
    );

    INSERT INTO public.automation_events (event_name, payload, entity_type, entity_id)
    VALUES (
      'booking.updated',
      JSONB_BUILD_OBJECT('bookingReference', v_booking.booking_reference, 'status', v_previous_status, 'cancellationDecision', 'rejected'),
      'booking',
      v_booking.id::text
    );

    RETURN JSONB_BUILD_OBJECT('success', TRUE, 'bookingReference', v_booking.booking_reference, 'status', v_previous_status);
  END IF;

  v_guest_count := COALESCE(v_booking.adult_count, 0) + COALESCE(v_booking.child_count, 0) + COALESCE(v_booking.infant_count, 0);

  UPDATE public.bookings
  SET status = 'cancelled',
      cancellation_previous_status = NULL,
      cancellation_requested_at = NULL,
      cancellation_reason = COALESCE(NULLIF(LEFT(TRIM(p_reason), 500), ''), cancellation_reason),
      updated_at = NOW()
  WHERE id = v_booking.id;

  UPDATE public.tour_availability AS ta
  SET booked_count = ta.booked_count - v_guest_count,
      status = CASE
        WHEN ta.status = 'sold_out' AND (ta.booked_count - v_guest_count) < ta.max_capacity THEN 'available'
        ELSE ta.status
      END,
      updated_at = NOW()
  WHERE ta.tour_id = v_booking.tour_id
    AND ta.date = v_booking.booking_date
    AND ta.booked_count >= v_guest_count;

  GET DIAGNOSTICS v_new_booked_count = ROW_COUNT;
  IF v_new_booked_count <> 1 THEN
    RAISE EXCEPTION 'Cannot approve cancellation: availability capacity is missing or inconsistent for booking %.', v_booking.booking_reference
      USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.audit_logs (action, entity_type, entity_id, old_data, new_data)
  VALUES (
    'BOOKING_CANCELLATION_APPROVED',
    'booking',
    v_booking.id::text,
    JSONB_BUILD_OBJECT('status', 'cancellation_requested', 'guestCount', v_guest_count),
    JSONB_BUILD_OBJECT('status', 'cancelled', 'reason', LEFT(COALESCE(p_reason, ''), 500), 'availabilityRowsUpdated', v_new_booked_count)
  );

  INSERT INTO public.automation_events (event_name, payload, entity_type, entity_id)
  VALUES (
    'booking.cancelled',
    JSONB_BUILD_OBJECT('bookingReference', v_booking.booking_reference, 'reason', LEFT(COALESCE(p_reason, ''), 500), 'capacityReleased', v_guest_count),
    'booking',
    v_booking.id::text
  );

  RETURN JSONB_BUILD_OBJECT('success', TRUE, 'bookingReference', v_booking.booking_reference, 'status', 'cancelled', 'capacityReleased', v_guest_count);
END;
$cancel_resolution$;

REVOKE ALL ON FUNCTION public.admin_resolve_booking_cancellation(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_resolve_booking_cancellation(TEXT, TEXT, TEXT) TO authenticated, service_role;

-- Direct table writes must not bypass the booking RPCs.
-- Guest creation is exclusively through create_booking_atomic; customer updates are limited
-- to non-financial pickup/contact-note fields. Staff changes remain server-authorized by RLS.
DROP POLICY IF EXISTS "Controlled booking creation" ON public.bookings;
REVOKE INSERT, DELETE ON public.bookings FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.protect_booking_customer_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $protect_booking$
BEGIN
  IF COALESCE(auth.jwt() ->> 'role', '') = 'service_role' OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- A customer-owned booking may transition once into cancellation review. This
  -- transition never releases inventory; only the admin approval RPC can do that.
  IF NEW.status = 'cancellation_requested'
     AND OLD.status IN ('pending', 'confirmed')
     AND NEW.cancellation_previous_status = OLD.status
     AND NEW.cancellation_requested_at IS NOT NULL
     AND (TO_JSONB(NEW) - ARRAY[
       'status', 'cancellation_previous_status', 'cancellation_requested_at',
       'cancellation_reason', 'pickup_hotel_name', 'pickup_room_number',
       'special_requests', 'updated_at'
     ]) IS NOT DISTINCT FROM
     (TO_JSONB(OLD) - ARRAY[
       'status', 'cancellation_previous_status', 'cancellation_requested_at',
       'cancellation_reason', 'pickup_hotel_name', 'pickup_room_number',
       'special_requests', 'updated_at'
     ]) THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL OR OLD.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'You are not authorized to update this reservation.'
      USING ERRCODE = '42501';
  END IF;

  IF (TO_JSONB(NEW) - ARRAY['pickup_hotel_name', 'pickup_room_number', 'special_requests', 'updated_at'])
     IS DISTINCT FROM
     (TO_JSONB(OLD) - ARRAY['pickup_hotel_name', 'pickup_room_number', 'special_requests', 'updated_at']) THEN
    RAISE EXCEPTION 'Customers may only update pickup details and special requests. Booking status, payment, price, guest counts, and inventory are protected.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$protect_booking$;

REVOKE ALL ON FUNCTION public.protect_booking_customer_updates() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS protect_booking_customer_updates_trigger ON public.bookings;
CREATE TRIGGER protect_booking_customer_updates_trigger
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_booking_customer_updates();

-- Harden the shared atomic rate limiter used by public booking lookup and cancellation RPCs.
CREATE OR REPLACE FUNCTION public.check_atomic_rate_limit(
  p_action TEXT,
  p_identifier TEXT,
  p_window_interval INTERVAL,
  p_max_hits INT,
  p_error_message TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $rate_limit$
DECLARE
  v_clean_id TEXT;
  v_window_start TIMESTAMPTZ;
  v_hits INT;
BEGIN
  IF p_identifier IS NULL OR TRIM(p_identifier) = '' THEN
    RETURN;
  END IF;

  v_clean_id := LOWER(TRIM(p_identifier));
  v_window_start := date_trunc('minute', NOW()) -
    (((EXTRACT(minute FROM NOW())::int) % GREATEST(1, (EXTRACT(epoch FROM p_window_interval)::int / 60))) * INTERVAL '1 minute');

  INSERT INTO public.rate_limit_buckets (bucket_key, bucket_window, hit_count)
  VALUES (p_action || ':' || v_clean_id, v_window_start, 1)
  ON CONFLICT (bucket_key, bucket_window)
  DO UPDATE SET hit_count = public.rate_limit_buckets.hit_count + 1
  RETURNING hit_count INTO v_hits;

  IF v_hits > p_max_hits THEN
    RAISE EXCEPTION '%', p_error_message USING ERRCODE = 'P0001';
  END IF;

  -- The same helper is used by lookup/cancellation RPCs, not only table triggers;
  -- clean stale buckets here so those public endpoints cannot grow the table forever.
  IF random() < 0.01 THEN
    DELETE FROM public.rate_limit_buckets
    WHERE bucket_window < (NOW() - INTERVAL '2 hours');
  END IF;
END;
$rate_limit$;

REVOKE ALL ON FUNCTION public.check_atomic_rate_limit(TEXT, TEXT, INTERVAL, INT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_atomic_rate_limit(TEXT, TEXT, INTERVAL, INT, TEXT) TO postgres, service_role;

-- Replace the shared public-submission trigger with an empty search_path and a
-- trusted JWT service-role bypass (session_user is authenticator under PostgREST).
CREATE OR REPLACE FUNCTION public.check_public_submission_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $submission_limit$
DECLARE
  client_ip TEXT;
  clean_email TEXT;
BEGIN
  IF session_user = 'postgres' OR COALESCE(auth.jwt() ->> 'role', '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME IN ('inquiries', 'newsletter_subscriptions') THEN
    IF NEW.website_url_hp IS NOT NULL AND TRIM(NEW.website_url_hp) <> '' THEN
      RAISE EXCEPTION 'Bot submission blocked by honeypot verification.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  BEGIN
    client_ip := NULLIF(current_setting('request.headers', true)::json->>'cf-connecting-ip', '');
    IF client_ip IS NULL THEN
      client_ip := NULLIF(current_setting('request.headers', true)::json->>'x-forwarded-for', '');
      IF client_ip LIKE '%,%' THEN
        client_ip := TRIM(split_part(client_ip, ',', 1));
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    client_ip := NULL;
  END;

  IF client_ip IS NOT NULL THEN
    client_ip := TRIM(client_ip);
    IF LENGTH(client_ip) > 64 THEN
      client_ip := SUBSTRING(client_ip FROM 1 FOR 64);
    END IF;
  END IF;

  IF TG_TABLE_NAME = 'inquiries' THEN
    IF TRIM(COALESCE(NEW.customer_name, '')) = ''
       OR TRIM(COALESCE(NEW.email, '')) = ''
       OR TRIM(COALESCE(NEW.message, '')) = '' THEN
      RAISE EXCEPTION 'Invalid inquiry submission: Customer name, email, and message are required.'
        USING ERRCODE = 'P0001';
    END IF;

    clean_email := LOWER(TRIM(NEW.email));
    IF NOT (clean_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$') THEN
      RAISE EXCEPTION 'Invalid email address format for customer inquiry.'
        USING ERRCODE = 'P0001';
    END IF;

    NEW.status := 'new';
    NEW.email := clean_email;

    IF (NEW.ip_address IS NULL OR NEW.ip_address = '') AND client_ip IS NOT NULL THEN
      NEW.ip_address := client_ip;
    END IF;

    PERFORM public.check_atomic_rate_limit(
      'inquiry_email', clean_email, INTERVAL '10 minutes', 5,
      'Rate limit exceeded: Too many inquiries submitted for this email address. Please wait a few minutes before trying again.'
    );

    IF client_ip IS NOT NULL AND client_ip <> '' THEN
      PERFORM public.check_atomic_rate_limit(
        'inquiry_ip', client_ip, INTERVAL '10 minutes', 10,
        'Rate limit exceeded: Too many inquiries submitted from your IP address. Please wait a few minutes before trying again.'
      );
    END IF;

  ELSIF TG_TABLE_NAME = 'newsletter_subscriptions' THEN
    clean_email := LOWER(TRIM(NEW.email));
    IF clean_email = '' OR NOT (clean_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$') THEN
      RAISE EXCEPTION 'Invalid email address format for newsletter subscription.'
        USING ERRCODE = 'P0001';
    END IF;

    NEW.email := clean_email;
    NEW.status := 'subscribed';

    PERFORM public.check_atomic_rate_limit(
      'newsletter_email', clean_email, INTERVAL '10 minutes', 3,
      'Rate limit exceeded: Too many newsletter subscription requests for this email.'
    );

    IF client_ip IS NOT NULL AND client_ip <> '' THEN
      PERFORM public.check_atomic_rate_limit(
        'newsletter_ip', client_ip, INTERVAL '10 minutes', 10,
        'Rate limit exceeded: Too many newsletter subscriptions from this network. Please try again later.'
      );
    END IF;

  ELSIF TG_TABLE_NAME = 'bookings' THEN
    IF NEW.payment_status NOT IN ('pending', 'pay_at_pickup') THEN
      NEW.payment_status := 'pending';
    END IF;
    IF NEW.status NOT IN ('pending', 'confirmed') THEN
      NEW.status := 'confirmed';
    END IF;
    IF NEW.operational_status IS DISTINCT FROM 'Scheduled' THEN
      NEW.operational_status := 'Scheduled';
    END IF;

    IF NEW.customer_id IS NOT NULL THEN
      PERFORM public.check_atomic_rate_limit(
        'booking_customer', NEW.customer_id::text, INTERVAL '30 minutes', 5,
        'Rate limit exceeded: Too many bookings initiated in a short period. Please contact reservations or wait 30 minutes.'
      );
    END IF;

    IF client_ip IS NOT NULL AND client_ip <> '' THEN
      PERFORM public.check_atomic_rate_limit(
        'booking_ip', client_ip, INTERVAL '30 minutes', 10,
        'Rate limit exceeded: Too many bookings submitted from your network. Please wait a few minutes before trying again.'
      );
    END IF;
  END IF;

  IF random() < 0.05 THEN
    DELETE FROM public.rate_limit_buckets
    WHERE bucket_window < (NOW() - INTERVAL '2 hours');
  END IF;

  RETURN NEW;
END;
$submission_limit$;

REVOKE ALL ON FUNCTION public.check_public_submission_rate_limit() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_public_submission_rate_limit() TO postgres, service_role;


-- Close remaining public-data and RPC privilege gaps found by live Supabase advisors.
-- SECURITY DEFINER trigger functions are invoked by triggers; API roles do not need
-- direct EXECUTE permission on them.
REVOKE ALL ON FUNCTION public.handle_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_user_confirmed() FROM PUBLIC, anon, authenticated;

-- These assignment RPCs already perform an internal trusted-admin check.
-- Guests must not be able to invoke them at all.
REVOKE ALL ON FUNCTION public.replace_extra_tour_assignments_atomic(UUID, JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.replace_tour_extra_assignments_atomic(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.replace_extra_tour_assignments_atomic(UUID, JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.replace_tour_extra_assignments_atomic(UUID, JSONB) TO authenticated, service_role;

-- The recalculation helper previously rejected only anon, allowing any signed-in
-- customer to alter aggregate statistics for an arbitrary customer UUID.
CREATE OR REPLACE FUNCTION public.recalculate_customer_stats(p_customer_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $recalculate$
DECLARE
  v_total_spent NUMERIC(10,2) := 0;
  v_outstanding NUMERIC(10,2) := 0;
  v_total_count INT := 0;
  v_completed_count INT := 0;
  v_cancelled_count INT := 0;
  v_first_date DATE;
  v_latest_date DATE;
  v_upcoming_date DATE;
  v_current_tags TEXT[];
BEGIN
  IF COALESCE(auth.jwt() ->> 'role', '') <> 'service_role'
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: customer statistics recalculation is restricted to authorized staff.'
      USING ERRCODE = '42501';
  END IF;

  IF p_customer_id IS NULL THEN
    RETURN;
  END IF;

  SELECT
    COALESCE(SUM(CASE WHEN status <> 'cancelled' THEN total ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN status <> 'cancelled' AND payment_status <> 'paid' THEN total ELSE 0 END), 0),
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'completed'),
    COUNT(*) FILTER (WHERE status = 'cancelled'),
    MIN(booking_date),
    MAX(booking_date),
    MIN(booking_date) FILTER (WHERE booking_date >= CURRENT_DATE AND status IN ('confirmed', 'pending'))
  INTO
    v_total_spent, v_outstanding, v_total_count, v_completed_count,
    v_cancelled_count, v_first_date, v_latest_date, v_upcoming_date
  FROM public.bookings
  WHERE customer_id = p_customer_id;

  SELECT tags INTO v_current_tags
  FROM public.customers
  WHERE id = p_customer_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_current_tags := COALESCE(v_current_tags, '{}'::TEXT[]);

  IF v_total_spent >= 1000 OR v_total_count >= 5 THEN
    IF NOT ('VIP' = ANY(v_current_tags)) THEN
      v_current_tags := array_append(v_current_tags, 'VIP');
    END IF;
  END IF;

  IF v_total_count >= 2 THEN
    IF NOT ('Repeat Guest' = ANY(v_current_tags)) THEN
      v_current_tags := array_append(v_current_tags, 'Repeat Guest');
    END IF;
  END IF;

  UPDATE public.customers
  SET
    total_spent = v_total_spent,
    outstanding_balance = v_outstanding,
    total_bookings = v_total_count,
    completed_bookings = v_completed_count,
    cancelled_bookings = v_cancelled_count,
    first_booking_date = v_first_date,
    last_booking_date = v_latest_date,
    upcoming_booking_date = v_upcoming_date,
    tags = v_current_tags,
    updated_at = NOW()
  WHERE id = p_customer_id;
END;
$recalculate$;

REVOKE ALL ON FUNCTION public.recalculate_customer_stats(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recalculate_customer_stats(UUID) TO authenticated, service_role;

-- These records contain guest PII or payment-provider configuration. Public
-- newsletter insertion remains enabled; reads and updates are staff-only.
DROP POLICY IF EXISTS "Public can view own newsletter status" ON public.newsletter_subscriptions;
DROP POLICY IF EXISTS "Public can update own subscription" ON public.newsletter_subscriptions;
DROP POLICY IF EXISTS "Anyone authenticated can view payment providers" ON public.payment_providers;

-- Guest-specific booking children are available only to their authenticated owner
-- (or trusted staff). Inserts are made inside create_booking_atomic, not directly.
DROP POLICY IF EXISTS "Public insert booking extras" ON public.booking_extras;
DROP POLICY IF EXISTS "Public view booking extras" ON public.booking_extras;
CREATE POLICY "Customers can view their own booking extras"
  ON public.booking_extras
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.bookings AS b
      WHERE b.id = booking_extras.booking_id
        AND (
          b.user_id = (SELECT auth.uid())
          OR b.customer_id IN (
            SELECT c.id FROM public.customers AS c
            WHERE c.user_id = (SELECT auth.uid())
          )
        )
    )
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "Public insert booking passengers" ON public.booking_passengers;
DROP POLICY IF EXISTS "Users can view linked booking passengers" ON public.booking_passengers;
CREATE POLICY "Customers can view their own booking passengers"
  ON public.booking_passengers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.bookings AS b
      WHERE b.id = booking_passengers.booking_id
        AND (
          b.user_id = (SELECT auth.uid())
          OR b.customer_id IN (
            SELECT c.id FROM public.customers AS c
            WHERE c.user_id = (SELECT auth.uid())
          )
        )
    )
    OR public.is_admin()
  );

-- Customer rows are created by the atomic booking RPC or staff workflows.
-- Anonymous direct inserts are unnecessary and permit customer-table pollution.
DROP POLICY IF EXISTS "Public can create customer record" ON public.customers;
DROP POLICY IF EXISTS "Public can insert customer on booking" ON public.customers;

-- Keep the customer cancellation/status trigger as the only route for owner
-- status transitions. Remove a duplicate RLS policy; the general owner policy
-- is still narrowed by protect_booking_customer_updates().
DROP POLICY IF EXISTS "Users can request booking cancellation" ON public.bookings;

-- BI SECURITY DEFINER RPCs already perform a trusted profile-role check. Their
-- referenced tables and helper functions are schema-qualified, so an empty path
-- is safe and avoids relying on the mutable session search path.
ALTER FUNCTION public.get_executive_bi_metrics(DATE, DATE) SET search_path = '';
ALTER FUNCTION public.query_custom_bi_report(JSONB) SET search_path = '';

ALTER FUNCTION public.handle_updated_at() SET search_path = '';
ALTER FUNCTION public.handle_user_confirmed() SET search_path = '';
