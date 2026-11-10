CREATE OR REPLACE FUNCTION public.query_custom_bi_report(p_filters jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    v_start_date DATE := NULLIF(p_filters->>'startDate', '')::DATE;
    v_end_date DATE := NULLIF(p_filters->>'endDate', '')::DATE;
    v_tour_id TEXT := p_filters->>'tourId';
    v_destination TEXT := p_filters->>'destination';
    v_booking_status TEXT := p_filters->>'bookingStatus';
    v_payment_status TEXT := p_filters->>'paymentStatus';
    v_lead_source TEXT := p_filters->>'leadSource';
    v_staff_name TEXT := p_filters->>'staffName';
    v_customer_query TEXT := p_filters->>'customerQuery';
    v_rows JSONB;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Access Denied: BI reports are restricted to authorized administrators.'
            USING ERRCODE = '42501';
    END IF;

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
            COALESCE(l.assigned_staff_name, 'Direct') AS staff_name
        FROM public.bookings b
        LEFT JOIN public.tours t ON b.tour_id = t.id
        LEFT JOIN public.destinations d ON t.destination_id = d.id
        LEFT JOIN public.customers c ON b.customer_id = c.id
        LEFT JOIN LATERAL (
            SELECT lead.source, lead.assigned_staff_name
            FROM public.leads AS lead
            WHERE lead.customer_id = b.customer_id
            ORDER BY lead.created_at DESC NULLS LAST, lead.id DESC
            LIMIT 1
        ) AS l ON TRUE
        WHERE
            (
                (
                    (v_start_date IS NULL OR b.booking_date >= v_start_date)
                    AND (v_end_date IS NULL OR b.booking_date <= v_end_date)
                )
                OR
                (
                    (v_start_date IS NULL OR b.created_at::DATE >= v_start_date)
                    AND (v_end_date IS NULL OR b.created_at::DATE <= v_end_date)
                )
            )
            AND (v_tour_id IS NULL OR v_tour_id = 'all' OR b.tour_id::TEXT = v_tour_id)
            AND (v_destination IS NULL OR v_destination = 'all' OR LOWER(d.name) = LOWER(v_destination))
            AND (v_booking_status IS NULL OR v_booking_status = 'all' OR b.status = v_booking_status)
            AND (v_payment_status IS NULL OR v_payment_status = 'all' OR b.payment_status = v_payment_status)
            AND (v_lead_source IS NULL OR v_lead_source = 'all' OR LOWER(COALESCE(l.source, 'Website')) = LOWER(v_lead_source))
            AND (v_staff_name IS NULL OR v_staff_name = 'all' OR LOWER(COALESCE(l.assigned_staff_name, 'Direct')) LIKE '%' || LOWER(v_staff_name) || '%')
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
    ) AS r;

    RETURN v_rows;
END;
$function$;
