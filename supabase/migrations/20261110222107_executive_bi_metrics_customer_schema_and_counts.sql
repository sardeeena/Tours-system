CREATE OR REPLACE FUNCTION public.get_executive_bi_metrics(
    p_start_date date,
    p_end_date date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    v_total_revenue NUMERIC(12,2) := 0;
    v_collected_revenue NUMERIC(12,2) := 0;
    v_outstanding_revenue NUMERIC(12,2) := 0;
    v_bookings_count INT := 0;
    v_confirmed_bookings_count INT := 0;
    v_cancellations_count INT := 0;
    v_total_passengers INT := 0;
    v_adults INT := 0;
    v_children INT := 0;
    v_infants INT := 0;
    v_total_customers INT := 0;
    v_new_customers INT := 0;
    v_repeat_customers INT := 0;
    v_leads_count INT := 0;
    v_conversion_rate NUMERIC(5,2) := 0;
    v_cancellation_rate NUMERIC(5,2) := 0;
    v_abv NUMERIC(10,2) := 0;
    v_res JSONB;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Access Denied: Executive BI metrics are restricted to authorized administrators.'
            USING ERRCODE = '42501';
    END IF;

    SELECT
        COUNT(*),
        COUNT(*) FILTER (WHERE status NOT IN ('cancelled', 'cancellation_requested')),
        COUNT(*) FILTER (WHERE status IN ('cancelled', 'cancellation_requested')),
        COALESCE(SUM(total) FILTER (WHERE status NOT IN ('cancelled', 'cancellation_requested')), 0),
        COALESCE(SUM(adult_count) FILTER (WHERE status NOT IN ('cancelled', 'cancellation_requested')), 0),
        COALESCE(SUM(child_count) FILTER (WHERE status NOT IN ('cancelled', 'cancellation_requested')), 0),
        COALESCE(SUM(infant_count) FILTER (WHERE status NOT IN ('cancelled', 'cancellation_requested')), 0)
    INTO
        v_bookings_count,
        v_confirmed_bookings_count,
        v_cancellations_count,
        v_total_revenue,
        v_adults,
        v_children,
        v_infants
    FROM public.bookings
    WHERE (booking_date BETWEEN p_start_date AND p_end_date)
       OR (created_at::DATE BETWEEN p_start_date AND p_end_date);

    v_total_passengers := v_adults + v_children + v_infants;

    SELECT COALESCE(SUM(amount), 0)
    INTO v_collected_revenue
    FROM public.payment_transactions
    WHERE status IN ('paid', 'Paid')
      AND (
          (payment_date::DATE BETWEEN p_start_date AND p_end_date)
          OR (created_at::DATE BETWEEN p_start_date AND p_end_date)
      );

    v_outstanding_revenue := GREATEST(0, v_total_revenue - v_collected_revenue);

    SELECT
        (SELECT COUNT(*) FROM public.leads WHERE created_at::DATE BETWEEN p_start_date AND p_end_date)
        +
        (SELECT COUNT(*) FROM public.inquiries WHERE created_at::DATE BETWEEN p_start_date AND p_end_date)
    INTO v_leads_count;

    SELECT COUNT(*)
    INTO v_total_customers
    FROM public.customers;

    SELECT
        COUNT(*) FILTER (WHERE total_bookings_count = 1),
        COUNT(*) FILTER (WHERE total_bookings_count > 1)
    INTO
        v_new_customers,
        v_repeat_customers
    FROM public.customers
    WHERE (created_at::DATE BETWEEN p_start_date AND p_end_date)
       OR (latest_booking_date BETWEEN p_start_date AND p_end_date);

    IF (v_confirmed_bookings_count + v_cancellations_count) > 0 THEN
        v_cancellation_rate := ROUND(
            (v_cancellations_count::NUMERIC /
             (v_confirmed_bookings_count + v_cancellations_count)::NUMERIC) * 100,
            2
        );
    END IF;

    IF (v_leads_count + v_confirmed_bookings_count) > 0 THEN
        v_conversion_rate := ROUND(
            (v_confirmed_bookings_count::NUMERIC /
             (v_leads_count + v_confirmed_bookings_count)::NUMERIC) * 100,
            2
        );
    END IF;

    IF v_confirmed_bookings_count > 0 THEN
        v_abv := ROUND(v_total_revenue / v_confirmed_bookings_count::NUMERIC, 2);
    END IF;

    v_res := jsonb_build_object(
        'startDate', p_start_date,
        'endDate', p_end_date,
        'revenue', jsonb_build_object(
            'total', v_total_revenue,
            'collected', v_collected_revenue,
            'outstanding', v_outstanding_revenue,
            'currency', 'EUR',
            'averageBookingValue', v_abv
        ),
        'bookings', jsonb_build_object(
            'total', v_bookings_count,
            'confirmed', v_confirmed_bookings_count,
            'cancelled', v_cancellations_count,
            'cancellationRatePercent', v_cancellation_rate,
            'conversionRatePercent', v_conversion_rate
        ),
        'passengers', jsonb_build_object(
            'total', v_total_passengers,
            'adults', v_adults,
            'children', v_children,
            'infants', v_infants
        ),
        'customers', jsonb_build_object(
            'totalActive', v_total_customers,
            'new', v_new_customers,
            'repeat', v_repeat_customers
        ),
        'leads', jsonb_build_object(
            'total', v_leads_count
        )
    );

    RETURN v_res;
END;
$function$;
