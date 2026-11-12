-- Persist the guest's chosen guide language as an immutable booking snapshot.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS tour_language text;

COMMENT ON COLUMN public.bookings.tour_language IS
  'Language selected by the customer for this booking; snapshot retained if tour language options later change.';

CREATE OR REPLACE FUNCTION public.create_booking_atomic_with_language(
  p_tour_identifier text,
  p_booking_date date,
  p_adult_count integer,
  p_child_count integer,
  p_infant_count integer,
  p_customer_first_name text,
  p_customer_last_name text,
  p_customer_email text,
  p_customer_phone text,
  p_customer_country text,
  p_customer_hotel text,
  p_pickup_location_id text,
  p_pickup_room_number text,
  p_extras jsonb,
  p_coupon_code text,
  p_payment_method text,
  p_special_requests text,
  p_idempotency_key text,
  p_tour_language text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_tour_id uuid;
  v_languages text[];
  v_language text;
  v_result jsonb;
  v_booking_id uuid;
  v_existing_language text;
BEGIN
  SELECT t.id,
         COALESCE(NULLIF(t.languages, ARRAY[]::text[]), ARRAY['English']::text[])
    INTO v_tour_id, v_languages
  FROM public.tours AS t
  WHERE t.id::text = p_tour_identifier OR t.slug = p_tour_identifier
  LIMIT 1;

  IF FOUND THEN
    v_language := COALESCE(NULLIF(BTRIM(p_tour_language), ''), v_languages[1]);
    IF NOT EXISTS (
      SELECT 1
      FROM unnest(v_languages) AS offered(language)
      WHERE LOWER(BTRIM(offered.language)) = LOWER(v_language)
    ) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Please select a language offered for this tour.'
      );
    END IF;
  ELSE
    v_language := NULLIF(BTRIM(p_tour_language), '');
  END IF;

  v_result := private.create_booking_atomic(
    p_tour_identifier,
    p_booking_date,
    p_adult_count,
    p_child_count,
    p_infant_count,
    p_customer_first_name,
    p_customer_last_name,
    p_customer_email,
    p_customer_phone,
    p_customer_country,
    p_customer_hotel,
    p_pickup_location_id,
    p_pickup_room_number,
    p_extras,
    p_coupon_code,
    p_payment_method,
    p_special_requests,
    p_idempotency_key
  );

  IF COALESCE((v_result->>'success')::boolean, false) THEN
    v_booking_id := NULLIF(v_result->>'bookingId', '')::uuid;

    SELECT b.tour_language
      INTO v_existing_language
    FROM public.bookings AS b
    WHERE b.id = v_booking_id
    FOR UPDATE;

    IF v_existing_language IS NOT NULL
       AND LOWER(v_existing_language) <> LOWER(COALESCE(v_language, '')) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'This reservation request has already been used with a different tour language.'
      );
    END IF;

    UPDATE public.bookings
    SET tour_language = v_language,
        updated_at = NOW()
    WHERE id = v_booking_id;
  END IF;

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_booking_atomic_with_language(
  text, date, integer, integer, integer, text, text, text, text, text,
  text, text, text, jsonb, text, text, text, text, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_booking_atomic_with_language(
  text, date, integer, integer, integer, text, text, text, text, text,
  text, text, text, jsonb, text, text, text, text, text
) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.lookup_booking_secure_with_language(
  p_reference text,
  p_verification text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_result jsonb;
  v_language text;
BEGIN
  v_result := private.lookup_booking_secure(p_reference, p_verification);
  IF v_result IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT b.tour_language
    INTO v_language
  FROM public.bookings AS b
  WHERE b.booking_reference = v_result->>'bookingReference';

  RETURN v_result || jsonb_build_object('tourLanguage', v_language);
END;
$function$;

REVOKE ALL ON FUNCTION public.lookup_booking_secure_with_language(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_booking_secure_with_language(text, text)
  TO anon, authenticated, service_role;
