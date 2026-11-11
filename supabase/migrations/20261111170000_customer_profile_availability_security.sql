-- Protect customer-owned CRM fields, server-controlled profile metadata, and public availability.
-- SECURITY DEFINER trigger helpers remain in the non-exposed private schema.
-- All privileged customer/profile writes require service_role or a verified user with the relevant permission.

CREATE OR REPLACE FUNCTION private.protect_customer_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_is_verified_manager boolean := false;
BEGIN
  IF COALESCE(auth.jwt() ->> 'role', '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.profiles AS p
      WHERE p.id = auth.uid()
        AND p.is_confirmed = TRUE
    ) AND private.has_permission('customers.update')
    INTO v_is_verified_manager;
  END IF;

  IF v_is_verified_manager THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL OR OLD.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'You are not authorized to update this customer record.'
      USING ERRCODE = '42501';
  END IF;

  -- Customer self-service is restricted to contact and preference fields.
  -- CRM ownership (user_id), status, notes, tags, source, total_revenue,
  -- outstanding_amount, booking counters/dates and every future column remain protected.
  IF (TO_JSONB(NEW) - ARRAY[
        'first_name', 'last_name', 'email', 'phone', 'whatsapp',
        'country', 'country_code', 'hotel', 'preferred_currency', 'updated_at'
      ]) IS DISTINCT FROM
     (TO_JSONB(OLD) - ARRAY[
        'first_name', 'last_name', 'email', 'phone', 'whatsapp',
        'country', 'country_code', 'hotel', 'preferred_currency', 'updated_at'
      ]) THEN
    RAISE EXCEPTION 'Customers may only update their contact details and preferences. CRM and booking-derived fields are protected.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.protect_customer_self_update() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS customers_protect_self_update_trigger ON public.customers;
CREATE TRIGGER customers_protect_self_update_trigger
BEFORE UPDATE ON public.customers
FOR EACH ROW
EXECUTE FUNCTION private.protect_customer_self_update();

-- Extend the existing role-protection trigger to protect all trusted profile
-- metadata while retaining the existing controlled role-provisioning nonce.
CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  active_nonce text;
  active_target text;
  is_trusted_operator_provisioning boolean := false;
  v_is_verified_manager boolean := false;
  v_is_service_role boolean := COALESCE(auth.jwt() ->> 'role', '') = 'service_role';
BEGIN
  IF auth.uid() IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.profiles AS p
      WHERE p.id = auth.uid()
        AND p.is_confirmed = TRUE
    ) AND private.has_permission('users.manage')
    INTO v_is_verified_manager;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    -- Keep the existing explicit provisioning guard for service-role role changes.
    IF session_user = 'postgres' OR v_is_service_role THEN
      active_nonce := NULLIF(current_setting('app.admin_provisioning_nonce', true), '');
      active_target := NULLIF(current_setting('app.admin_provisioning_active_user', true), '');
      IF active_nonce IS NOT NULL AND active_target = NEW.id::text THEN
        is_trusted_operator_provisioning := true;
      END IF;
    END IF;

    IF NOT is_trusted_operator_provisioning AND NOT v_is_verified_manager THEN
      NEW.role := OLD.role;
    END IF;
  END IF;

  IF NOT v_is_service_role AND NOT v_is_verified_manager THEN
    IF is_trusted_operator_provisioning THEN
      -- Trusted provisioning may change role and is_confirmed only for its nonce-bound target.
      -- Email, confirmation_sent_at, identity, and other server-managed metadata remain protected.
      IF (TO_JSONB(NEW) - ARRAY[
            'full_name', 'avatar_url', 'phone', 'country', 'country_code',
            'updated_at', 'role', 'is_confirmed'
          ]) IS DISTINCT FROM
         (TO_JSONB(OLD) - ARRAY[
            'full_name', 'avatar_url', 'phone', 'country', 'country_code',
            'updated_at', 'role', 'is_confirmed'
          ]) THEN
        RAISE EXCEPTION 'Trusted provisioning cannot change email or unrelated server-managed profile fields.'
          USING ERRCODE = '42501';
      END IF;
    ELSE
      -- Ordinary self-edits may change only the approved profile fields.
      -- The JSON diff protects email, role, is_confirmed, confirmation_sent_at,
      -- identity and creation metadata by default.
      IF (TO_JSONB(NEW) - ARRAY[
            'full_name', 'avatar_url', 'phone', 'country', 'country_code', 'updated_at'
          ]) IS DISTINCT FROM
         (TO_JSONB(OLD) - ARRAY[
            'full_name', 'avatar_url', 'phone', 'country', 'country_code', 'updated_at'
          ]) THEN
        RAISE EXCEPTION 'Profile email, role, confirmation and server-managed fields cannot be changed directly.'
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- A write-capable function must be VOLATILE. The public RPC remains an
-- invoker-rights wrapper; the SECURITY DEFINER implementation stays private.
CREATE OR REPLACE FUNCTION private.get_tour_availability_schedule(
  p_tour_identifier text,
  p_start_date date,
  p_end_date date
)
RETURNS TABLE(
  tour_id uuid,
  date date,
  status text,
  max_capacity integer,
  booked_count integer,
  remaining_capacity integer,
  is_available boolean,
  is_blackout boolean,
  departure_time text,
  notes text
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_tour RECORD;
  v_tour_identifier TEXT := NULLIF(BTRIM(p_tour_identifier), '');
  v_is_admin BOOLEAN := COALESCE(
    auth.jwt() ->> 'role' = 'service_role'
    OR (
      auth.uid() IS NOT NULL
      AND (public.has_permission('operations.read') OR public.has_permission('bookings.read'))
    ),
    FALSE
  );
  v_is_privileged BOOLEAN := FALSE;
  v_client_ip TEXT;
  v_today DATE := (now() AT TIME ZONE 'Africa/Cairo')::date;
BEGIN
  IF v_tour_identifier IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Tour identifier is required';
  END IF;

  IF p_start_date IS NULL OR p_end_date IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Availability start and end dates are required';
  END IF;

  IF p_end_date < p_start_date THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Availability start date must not be after end date';
  END IF;

  IF p_end_date - p_start_date > 365 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Availability date range cannot exceed 366 days';
  END IF;

  IF NOT v_is_admin AND p_start_date < v_today THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Public availability lookup cannot include past dates';
  END IF;

  -- Verified staff with users.manage may bypass the public IP throttle.
  IF auth.uid() IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.profiles AS p
      WHERE p.id = auth.uid() AND p.is_confirmed = TRUE
    ) AND private.has_permission('users.manage')
    INTO v_is_privileged;
  END IF;
  v_is_privileged := v_is_privileged OR COALESCE(auth.jwt() ->> 'role' = 'service_role', FALSE);

  IF NOT v_is_privileged THEN
    -- Prefer the platform-provided Cloudflare address, then the forwarded
    -- address used by the other public Kemet Spirit RPCs.
    BEGIN
      v_client_ip := NULLIF(current_setting('request.headers', true)::jsonb ->> 'cf-connecting-ip', '');
      IF v_client_ip IS NULL THEN
        v_client_ip := NULLIF(current_setting('request.headers', true)::jsonb ->> 'x-forwarded-for', '');
        IF v_client_ip LIKE '%,%' THEN
          v_client_ip := BTRIM(SPLIT_PART(v_client_ip, ',', 1));
        END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_client_ip := NULL;
    END;

    IF v_client_ip IS NOT NULL THEN
      v_client_ip := LEFT(BTRIM(v_client_ip), 64);
      -- Hash the address before storing it in the shared rate-limit bucket table.
      PERFORM public.check_atomic_rate_limit(
        'tour_availability_ip',
        MD5(v_client_ip),
        INTERVAL '1 minute',
        60,
        'Too many public availability requests. Please wait a moment and try again.'
      );
    END IF;
  END IF;

  SELECT t.*
  INTO v_tour
  FROM public.tours AS t
  WHERE t.slug = v_tour_identifier
     OR t.id::text = v_tour_identifier;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Public booking pages may query only published tours. Internal staff retain
  -- access to draft/archived tours through the existing permission check.
  IF v_tour.status <> 'published' AND NOT v_is_admin THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH date_series AS (
    SELECT d::date AS calendar_date
    FROM generate_series(p_start_date, p_end_date, '1 day'::interval) AS d
  ),
  live_bookings AS (
    SELECT
      b.booking_date,
      COALESCE(SUM(b.adult_count + b.child_count + b.infant_count), 0)::int AS reserved_count
    FROM public.bookings AS b
    WHERE b.tour_id = v_tour.id
      AND b.booking_date >= p_start_date
      AND b.booking_date <= p_end_date
      AND b.status NOT IN ('cancelled')
    GROUP BY b.booking_date
  )
  SELECT
    v_tour.id AS tour_id,
    ds.calendar_date AS date,
    CASE
      WHEN ta.status = 'unavailable' THEN 'unavailable'
      WHEN ta.status = 'sold_out' THEN 'sold_out'
      WHEN GREATEST(COALESCE(ta.booked_count, 0), COALESCE(lb.reserved_count, 0))
        >= COALESCE(ta.max_capacity, v_tour.max_guests, 30) THEN 'sold_out'
      ELSE 'available'
    END AS status,
    COALESCE(ta.max_capacity, v_tour.max_guests, 30)::int AS max_capacity,
    GREATEST(COALESCE(ta.booked_count, 0), COALESCE(lb.reserved_count, 0))::int AS booked_count,
    GREATEST(
      0,
      COALESCE(ta.max_capacity, v_tour.max_guests, 30)
        - GREATEST(COALESCE(ta.booked_count, 0), COALESCE(lb.reserved_count, 0))
    )::int AS remaining_capacity,
    CASE
      WHEN ta.status IN ('unavailable', 'sold_out') THEN FALSE
      WHEN ds.calendar_date < v_today THEN FALSE
      WHEN GREATEST(COALESCE(ta.booked_count, 0), COALESCE(lb.reserved_count, 0))
        >= COALESCE(ta.max_capacity, v_tour.max_guests, 30) THEN FALSE
      ELSE TRUE
    END AS is_available,
    (COALESCE(ta.status, '') = 'unavailable') AS is_blackout,
    COALESCE(v_tour.departure_time, '08:30 AM') AS departure_time,
    CASE WHEN v_is_admin THEN ta.notes ELSE NULL END AS notes
  FROM date_series AS ds
  LEFT JOIN public.tour_availability AS ta
    ON ta.tour_id = v_tour.id AND ta.date = ds.calendar_date
  LEFT JOIN live_bookings AS lb
    ON lb.booking_date = ds.calendar_date
  ORDER BY ds.calendar_date ASC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_tour_availability_schedule(
  p_tour_identifier text,
  p_start_date date,
  p_end_date date
)
RETURNS TABLE(
  tour_id uuid,
  date date,
  status text,
  max_capacity integer,
  booked_count integer,
  remaining_capacity integer,
  is_available boolean,
  is_blackout boolean,
  departure_time text,
  notes text
)
LANGUAGE sql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $function$
  SELECT * FROM private.get_tour_availability_schedule($1, $2, $3);
$function$;

NOTIFY pgrst, 'reload schema';
