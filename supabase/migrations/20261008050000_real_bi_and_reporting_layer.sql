-- ==============================================================================
-- MIGRATION: PRODUCTION REAL REPORTING & BUSINESS INTELLIGENCE LAYER
-- High-Performance Composite Indexes, Server-Side SQL Aggregation RPCs, 
-- Multi-Dimensional Report Querying Engine
-- Migration ID: 20261008050000
-- ==============================================================================

-- 1. COMPOSITE INDEXES FOR FAST REPORTING & ANALYTICS
CREATE INDEX IF NOT EXISTS idx_bookings_reporting_composite 
    ON public.bookings (created_at, booking_date, status, payment_status);

CREATE INDEX IF NOT EXISTS idx_bookings_reporting_customer 
    ON public.bookings (customer_id, booking_date);

CREATE INDEX IF NOT EXISTS idx_bookings_reporting_tour 
    ON public.bookings (tour_id, booking_date);

CREATE INDEX IF NOT EXISTS idx_leads_reporting_composite 
    ON public.leads (created_at, source, stage);

CREATE INDEX IF NOT EXISTS idx_leads_reporting_staff 
    ON public.leads (assigned_staff_name);

CREATE INDEX IF NOT EXISTS idx_payments_reporting_date 
    ON public.payment_transactions (payment_date, status);

CREATE INDEX IF NOT EXISTS idx_refunds_reporting_date 
    ON public.refund_records (created_at, status);

CREATE INDEX IF NOT EXISTS idx_assignments_reporting_date 
    ON public.operational_assignments (date, status);


-- 2. SERVER-SIDE RPC: EXECUTIVE BI METRICS
-- Aggregates executive KPIs server-side in one database roundtrip
CREATE OR REPLACE FUNCTION public.get_executive_bi_metrics(
    p_start_date DATE,
    p_end_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
    -- Bookings in range
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

    -- Collected payments in range
    SELECT COALESCE(SUM(amount), 0)
    INTO v_collected_revenue
    FROM public.payment_transactions
    WHERE status IN ('paid', 'Paid')
      AND (
          (payment_date::DATE BETWEEN p_start_date AND p_end_date)
          OR (created_at::DATE BETWEEN p_start_date AND p_end_date)
      );

    v_outstanding_revenue := GREATEST(0, v_total_revenue - v_collected_revenue);

    -- Leads count in range
    SELECT COUNT(*)
    INTO v_leads_count
    FROM public.leads
    WHERE created_at::DATE BETWEEN p_start_date AND p_end_date;

    -- Conversion rate: confirmed bookings / (leads + confirmed bookings)
    IF (v_leads_count + v_confirmed_bookings_count) > 0 THEN
        v_conversion_rate := ROUND((v_confirmed_bookings_count::NUMERIC / (v_leads_count + v_confirmed_bookings_count)::NUMERIC) * 100.0, 1);
    ELSE
        v_conversion_rate := 0;
    END IF;

    -- Cancellation rate
    IF v_bookings_count > 0 THEN
        v_cancellation_rate := ROUND((v_cancellations_count::NUMERIC / v_bookings_count::NUMERIC) * 100.0, 1);
    ELSE
        v_cancellation_rate := 0;
    END IF;

    -- Average Booking Value
    IF v_confirmed_bookings_count > 0 THEN
        v_abv := ROUND(v_total_revenue / v_confirmed_bookings_count::NUMERIC, 2);
    ELSE
        v_abv := 0;
    END IF;

    -- Customers breakdown
    SELECT 
        COUNT(DISTINCT customer_id),
        COUNT(DISTINCT customer_id) FILTER (WHERE lifetime_bookings = 1),
        COUNT(DISTINCT customer_id) FILTER (WHERE lifetime_bookings > 1)
    INTO
        v_total_customers,
        v_new_customers,
        v_repeat_customers
    FROM (
        SELECT customer_id, COUNT(*) AS lifetime_bookings
        FROM public.bookings
        WHERE customer_id IS NOT NULL
        GROUP BY customer_id
    ) c_stats;

    v_res := jsonb_build_object(
        'totalRevenueEur', v_total_revenue,
        'revenueEur', v_total_revenue,
        'collectedRevenueEur', v_collected_revenue,
        'outstandingRevenueEur', v_outstanding_revenue,
        'outstandingBalancesEur', v_outstanding_revenue,
        'bookingsCount', v_bookings_count,
        'confirmedBookingsCount', v_confirmed_bookings_count,
        'cancellationsCount', v_cancellations_count,
        'passengersCount', v_total_passengers,
        'adultsCount', v_adults,
        'childrenCount', v_children,
        'infantsCount', v_infants,
        'totalCustomersCount', v_total_customers,
        'newCustomersCount', v_new_customers,
        'repeatCustomersCount', v_repeat_customers,
        'leadsCount', v_leads_count,
        'conversionRate', v_conversion_rate,
        'cancellationRate', v_cancellation_rate,
        'averageBookingValueEur', v_abv
    );

    RETURN v_res;
END;
$$;


-- 3. SERVER-SIDE RPC: REPORT BUILDER QUERY
CREATE OR REPLACE FUNCTION public.query_custom_bi_report(
    p_filters JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_start_date DATE := (p_filters->>'startDate')::DATE;
    v_end_date DATE := (p_filters->>'endDate')::DATE;
    v_tour_id TEXT := p_filters->>'tourId';
    v_destination TEXT := p_filters->>'destination';
    v_booking_status TEXT := p_filters->>'bookingStatus';
    v_payment_status TEXT := p_filters->>'paymentStatus';
    v_lead_source TEXT := p_filters->>'leadSource';
    v_staff_name TEXT := p_filters->>'staffName';
    v_customer_query TEXT := p_filters->>'customerQuery';
    v_rows JSONB;
BEGIN
    SELECT COALESCE(jsonb_agg(r), '[]'::jsonb)
    INTO v_rows
    FROM (
        SELECT 
            b.id AS booking_id,
            b.booking_reference,
            b.booking_date,
            b.created_at,
            b.status AS booking_status,
            b.payment_status,
            b.payment_method,
            (b.adult_count + b.child_count + b.infant_count) AS total_guests,
            b.subtotal,
            b.discount,
            b.total,
            b.currency,
            t.title AS tour_title,
            d.name AS destination_name,
            COALESCE(c.first_name || ' ' || c.last_name, 'Guest') AS customer_name,
            c.email AS customer_email,
            c.phone AS customer_phone,
            COALESCE(l.source, 'Website') AS lead_source,
            l.assigned_staff_name AS staff_name
        FROM public.bookings b
        LEFT JOIN public.tours t ON b.tour_id = t.id
        LEFT JOIN public.destinations d ON t.destination_id = d.id
        LEFT JOIN public.customers c ON b.customer_id = c.id
        LEFT JOIN public.leads l ON b.customer_id = l.customer_id
        WHERE 
            (v_start_date IS NULL OR b.booking_date >= v_start_date OR b.created_at::DATE >= v_start_date)
            AND (v_end_date IS NULL OR b.booking_date <= v_end_date OR b.created_at::DATE <= v_end_date)
            AND (v_tour_id IS NULL OR v_tour_id = 'all' OR b.tour_id::TEXT = v_tour_id)
            AND (v_destination IS NULL OR v_destination = 'all' OR LOWER(d.name) = LOWER(v_destination))
            AND (v_booking_status IS NULL OR v_booking_status = 'all' OR b.status = v_booking_status)
            AND (v_payment_status IS NULL OR v_payment_status = 'all' OR b.payment_status = v_payment_status)
            AND (v_lead_source IS NULL OR v_lead_source = 'all' OR LOWER(l.source) = LOWER(v_lead_source))
            AND (v_staff_name IS NULL OR v_staff_name = 'all' OR LOWER(l.assigned_staff_name) LIKE '%' || LOWER(v_staff_name) || '%')
            AND (
                v_customer_query IS NULL 
                OR v_customer_query = '' 
                OR LOWER(c.email) LIKE '%' || LOWER(v_customer_query) || '%'
                OR LOWER(c.first_name) LIKE '%' || LOWER(v_customer_query) || '%'
                OR LOWER(c.last_name) LIKE '%' || LOWER(v_customer_query) || '%'
                OR LOWER(b.booking_reference) LIKE '%' || LOWER(v_customer_query) || '%'
            )
        ORDER BY b.booking_date DESC, b.created_at DESC
        LIMIT 500
    ) r;

    RETURN v_rows;
END;
$$;
