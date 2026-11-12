-- Restrict status changes on completed and paid bookings to Admin/Superadmin.
-- Payment recording and refund workflows remain governed by their own finance permissions.
CREATE OR REPLACE FUNCTION public.protect_booking_customer_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
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


-- Add a separate completed-bookings metric and attribute collections to the
-- selected booking cohort (not to unrelated transactions in the date window).
CREATE OR REPLACE FUNCTION private.get_executive_bi_metrics(
  p_start_date date,
  p_end_date date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_total_revenue numeric(12,2) := 0;
  v_collected_revenue numeric(12,2) := 0;
  v_outstanding_revenue numeric(12,2) := 0;
  v_bookings_count int := 0;
  v_confirmed_bookings_count int := 0;
  v_completed_bookings_count int := 0;
  v_cancellations_count int := 0;
  v_adults int := 0;
  v_children int := 0;
  v_infants int := 0;
  v_total_passengers int := 0;
  v_total_customers int := 0;
  v_new_customers int := 0;
  v_repeat_customers int := 0;
  v_leads_count int := 0;
  v_conversion_rate numeric(5,2) := 0;
  v_cancellation_rate numeric(5,2) := 0;
  v_abv numeric(10,2) := 0;
BEGIN
  IF NOT public.has_permission('analytics.read') THEN
    RAISE EXCEPTION 'Access Denied: Executive BI metrics are restricted to authorized administrators.'
      USING ERRCODE = '42501';
  END IF;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status NOT IN ('cancelled','cancellation_requested')),
    COUNT(*) FILTER (WHERE status = 'completed'),
    COUNT(*) FILTER (WHERE status IN ('cancelled','cancellation_requested')),
    COALESCE(SUM(total) FILTER (WHERE status NOT IN ('cancelled','cancellation_requested')),0),
    COALESCE(SUM(adult_count) FILTER (WHERE status NOT IN ('cancelled','cancellation_requested')),0),
    COALESCE(SUM(child_count) FILTER (WHERE status NOT IN ('cancelled','cancellation_requested')),0),
    COALESCE(SUM(infant_count) FILTER (WHERE status NOT IN ('cancelled','cancellation_requested')),0)
  INTO
    v_bookings_count,v_confirmed_bookings_count,v_completed_bookings_count,
    v_cancellations_count,v_total_revenue,v_adults,v_children,v_infants
  FROM public.bookings
  WHERE booking_date BETWEEN p_start_date AND p_end_date
     OR created_at::date BETWEEN p_start_date AND p_end_date;

  v_total_passengers := v_adults + v_children + v_infants;

  SELECT COALESCE(SUM(pt.amount),0)
  INTO v_collected_revenue
  FROM public.payment_transactions pt
  JOIN public.bookings b ON b.id = pt.booking_id
  WHERE pt.status IN ('paid','Paid','Partially Paid','partially_paid')
    AND (b.status NOT IN ('cancelled','cancellation_requested'))
    AND (b.booking_date BETWEEN p_start_date AND p_end_date
         OR b.created_at::date BETWEEN p_start_date AND p_end_date)
    AND upper(pt.currency) = upper(b.currency);

  v_outstanding_revenue := GREATEST(0,v_total_revenue-v_collected_revenue);

  SELECT
    (SELECT COUNT(*) FROM public.leads WHERE created_at::date BETWEEN p_start_date AND p_end_date)
    + (SELECT COUNT(*) FROM public.inquiries WHERE created_at::date BETWEEN p_start_date AND p_end_date)
  INTO v_leads_count;

  SELECT COUNT(*) INTO v_total_customers FROM public.customers;

  SELECT
    COUNT(*) FILTER (WHERE total_bookings_count = 1),
    COUNT(*) FILTER (WHERE total_bookings_count > 1)
  INTO v_new_customers,v_repeat_customers
  FROM public.customers
  WHERE created_at::date BETWEEN p_start_date AND p_end_date
     OR latest_booking_date BETWEEN p_start_date AND p_end_date;

  IF (v_confirmed_bookings_count+v_cancellations_count)>0 THEN
    v_cancellation_rate := ROUND(
      (v_cancellations_count::numeric/(v_confirmed_bookings_count+v_cancellations_count)::numeric)*100,2
    );
  END IF;
  IF (v_leads_count+v_confirmed_bookings_count)>0 THEN
    v_conversion_rate := ROUND(
      (v_confirmed_bookings_count::numeric/(v_leads_count+v_confirmed_bookings_count)::numeric)*100,2
    );
  END IF;
  IF v_confirmed_bookings_count>0 THEN
    v_abv := ROUND(v_total_revenue/v_confirmed_bookings_count::numeric,2);
  END IF;

  RETURN jsonb_build_object(
    'startDate',p_start_date,
    'endDate',p_end_date,
    'revenue',jsonb_build_object(
      'total',v_total_revenue,'collected',v_collected_revenue,
      'outstanding',v_outstanding_revenue,'currency','EUR',
      'averageBookingValue',v_abv
    ),
    'bookings',jsonb_build_object(
      'total',v_bookings_count,'confirmed',v_confirmed_bookings_count,
      'completed',v_completed_bookings_count,'cancelled',v_cancellations_count,
      'cancellationRatePercent',v_cancellation_rate,
      'conversionRatePercent',v_conversion_rate
    ),
    'passengers',jsonb_build_object(
      'total',v_total_passengers,'adults',v_adults,'children',v_children,'infants',v_infants
    ),
    'customers',jsonb_build_object(
      'totalActive',v_total_customers,'new',v_new_customers,'repeat',v_repeat_customers
    ),
    'leads',jsonb_build_object('total',v_leads_count)
  );
END;
$function$;
