-- Keep executive dashboard collections and receivables aligned with the net payment ledger.
-- Only processed refunds reduce retained collections; requested, approved, and rejected
-- refunds are not treated as completed payouts.

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
  v_refunded_revenue numeric(12,2) := 0;
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
    AND b.status NOT IN ('cancelled','cancellation_requested')
    AND (b.booking_date BETWEEN p_start_date AND p_end_date
         OR b.created_at::date BETWEEN p_start_date AND p_end_date)
    AND upper(pt.currency) = upper(b.currency);

  SELECT COALESCE(SUM(COALESCE(r.approved_amount, r.requested_amount, r.amount)),0)
  INTO v_refunded_revenue
  FROM public.refund_records r
  JOIN public.bookings b ON b.id = r.booking_id
  WHERE r.status = 'processed'
    AND b.status NOT IN ('cancelled','cancellation_requested')
    AND (b.booking_date BETWEEN p_start_date AND p_end_date
         OR b.created_at::date BETWEEN p_start_date AND p_end_date)
    AND upper(r.currency) = upper(b.currency)
    AND (
      r.payment_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.payment_transactions linked_payment
        WHERE linked_payment.id = r.payment_id
          AND linked_payment.booking_id = b.id
          AND linked_payment.status IN ('paid','Paid','Partially Paid','partially_paid')
          AND upper(linked_payment.currency) = upper(r.currency)
      )
    );

  v_collected_revenue := GREATEST(0, v_collected_revenue - v_refunded_revenue);
  v_outstanding_revenue := GREATEST(0, v_total_revenue - v_collected_revenue);

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
