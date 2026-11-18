-- Allow the atomic guest booking RPC to persist the requested customer locale.
--
-- The booking RPC creates the reservation under a SECURITY DEFINER function,
-- then updates only customer_locale. The general booking protection trigger
-- incorrectly treated that internal, locale-only update as a guest editing a
-- reservation. Keep all booking ownership, payment, price, passenger and
-- inventory protections intact; allow only a supported locale-only update.
BEGIN;

CREATE OR REPLACE FUNCTION public.protect_booking_customer_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF OLD.status = 'completed'
     AND OLD.payment_status = 'paid'
     AND NEW.status IS DISTINCT FROM OLD.status
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'This booking is completed and paid. Only Admin or Superadmin can change its status.'
      USING ERRCODE = '42501';
  END IF;

  IF COALESCE(auth.jwt() ->> 'role', '') = 'service_role' OR public.has_permission('bookings.update') THEN
    RETURN NEW;
  END IF;

  -- Guest checkout has no auth.uid(). Its SECURITY DEFINER booking RPC may
  -- persist only the communication locale after creating the booking. This
  -- exception cannot alter ownership, status, payment, pricing, passengers,
  -- pickup, inventory, customer data, or any other booking field.
  IF NEW.customer_locale IN (
       'en', 'de', 'fr', 'it', 'es', 'nl', 'pl', 'pt', 'ro', 'ru',
       'sv', 'da', 'nb', 'fi', 'el', 'bg', 'hr', 'cs', 'sk', 'sl',
       'hu', 'et', 'lv', 'lt', 'uk', 'sr', 'sq', 'tr', 'ar'
     )
     AND (TO_JSONB(NEW) - ARRAY['customer_locale', 'updated_at'])
         IS NOT DISTINCT FROM
         (TO_JSONB(OLD) - ARRAY['customer_locale', 'updated_at']) THEN
    RETURN NEW;
  END IF;

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
$function$;

COMMENT ON FUNCTION public.protect_booking_customer_updates() IS
  'Protects booking ownership and financial fields while allowing the atomic guest checkout RPC to persist only a supported customer locale.';


-- The same locale-persistence RPC also updates the guest CRM customer record.
-- Permit only preferred_locale to change; guest identity, CRM ownership, notes,
-- status, financial totals and booking-derived fields remain protected.
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

  -- Guest checkout has no auth.uid(). Its SECURITY DEFINER booking RPC may
  -- update only the supported communication preference on the new customer.
  IF NEW.preferred_locale IN (
       'en', 'de', 'fr', 'it', 'es', 'nl', 'pl', 'pt', 'ro', 'ru',
       'sv', 'da', 'nb', 'fi', 'el', 'bg', 'hr', 'cs', 'sk', 'sl',
       'hu', 'et', 'lv', 'lt', 'uk', 'sr', 'sq', 'tr', 'ar'
     )
     AND (TO_JSONB(NEW) - ARRAY['preferred_locale', 'updated_at'])
         IS NOT DISTINCT FROM
         (TO_JSONB(OLD) - ARRAY['preferred_locale', 'updated_at']) THEN
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
        'country', 'country_code', 'hotel', 'preferred_currency', 'preferred_locale', 'updated_at'
      ]) IS DISTINCT FROM
     (TO_JSONB(OLD) - ARRAY[
        'first_name', 'last_name', 'email', 'phone', 'whatsapp',
        'country', 'country_code', 'hotel', 'preferred_currency', 'preferred_locale', 'updated_at'
      ]) THEN
    RAISE EXCEPTION 'Customers may only update their contact details and preferences. CRM and booking-derived fields are protected.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION private.protect_customer_self_update() IS
  'Protects customer CRM fields while allowing only a supported preferred-locale update from the atomic guest checkout RPC.';

NOTIFY pgrst, 'reload schema';
COMMIT;
