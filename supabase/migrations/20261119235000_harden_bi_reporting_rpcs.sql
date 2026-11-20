-- Harden the BI RPC surface after the reporting data-integrity migration.
-- Keep SECURITY DEFINER implementations in private and expose invoker-rights wrappers only.
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
  v_bookings_count integer := 0;
  v_confirmed_bookings_count integer := 0;
  v_completed_bookings_count integer := 0;
  v_revenue_bookings_count integer := 0;
  v_cancellations_count integer := 0;
  v_total_passengers integer := 0;
  v_adults integer := 0;
  v_children integer := 0;
  v_infants integer := 0;
  v_total_customers integer := 0;
  v_new_customers integer := 0;
  v_repeat_customers integer := 0;
  v_leads_count integer := 0;
  v_converted_leads_count integer := 0;
  v_conversion_rate numeric(5,2) := 0;
  v_cancellation_rate numeric(5,2) := 0;
  v_abv numeric(10,2) := 0;
BEGIN
  IF p_start_date IS NOT NULL AND p_end_date IS NOT NULL AND p_start_date > p_end_date THEN
    RAISE EXCEPTION 'Report start date must be on or before end date.'
      USING ERRCODE = '22007';
  END IF;

  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access Denied: Executive BI metrics are restricted to authorized administrators.'
      USING ERRCODE = '42501';
  END IF;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE b.status IN ('confirmed', 'boarding', 'in_progress', 'completed')),
    COUNT(*) FILTER (WHERE b.status = 'completed'),
    COUNT(*) FILTER (WHERE b.status IN ('cancelled', 'cancellation_requested')),
    COUNT(*) FILTER (
      WHERE b.status NOT IN ('cancelled', 'cancellation_requested')
        AND upper(COALESCE(b.currency, '')) = 'EUR'
    ),
    COALESCE(SUM(b.total) FILTER (
      WHERE b.status NOT IN ('cancelled', 'cancellation_requested')
        AND upper(COALESCE(b.currency, '')) = 'EUR'
    ), 0),
    COALESCE(SUM(COALESCE(b.adult_count, 0)) FILTER (
      WHERE b.status NOT IN ('cancelled', 'cancellation_requested', 'no_show')
    ), 0),
    COALESCE(SUM(COALESCE(b.child_count, 0)) FILTER (
      WHERE b.status NOT IN ('cancelled', 'cancellation_requested', 'no_show')
    ), 0),
    COALESCE(SUM(COALESCE(b.infant_count, 0)) FILTER (
      WHERE b.status NOT IN ('cancelled', 'cancellation_requested', 'no_show')
    ), 0)
  INTO
    v_bookings_count,
    v_confirmed_bookings_count,
    v_completed_bookings_count,
    v_cancellations_count,
    v_revenue_bookings_count,
    v_total_revenue,
    v_adults,
    v_children,
    v_infants
  FROM public.bookings AS b
  WHERE COALESCE(b.booking_date, b.created_at::date) BETWEEN p_start_date AND p_end_date;

  v_total_passengers := v_adults + v_children + v_infants;

  SELECT COALESCE(SUM(pt.amount), 0)
  INTO v_collected_revenue
  FROM public.payment_transactions AS pt
  JOIN public.bookings AS b ON b.id = pt.booking_id
  WHERE lower(COALESCE(pt.status, '')) IN ('paid', 'partially_paid', 'partially paid')
    AND upper(COALESCE(pt.currency, '')) = 'EUR'
    AND b.status NOT IN ('cancelled', 'cancellation_requested')
    AND upper(COALESCE(b.currency, '')) = 'EUR'
    AND COALESCE(b.booking_date, b.created_at::date) BETWEEN p_start_date AND p_end_date;

  SELECT COALESCE(SUM(COALESCE(r.approved_amount, r.requested_amount, r.amount)), 0)
  INTO v_refunded_revenue
  FROM public.refund_records AS r
  JOIN public.bookings AS b ON b.id = r.booking_id
  WHERE r.status = 'processed'
    AND upper(COALESCE(r.currency, '')) = 'EUR'
    AND b.status NOT IN ('cancelled', 'cancellation_requested')
    AND upper(COALESCE(b.currency, '')) = 'EUR'
    AND COALESCE(b.booking_date, b.created_at::date) BETWEEN p_start_date AND p_end_date
    AND (
      r.payment_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.payment_transactions AS linked_payment
        WHERE linked_payment.id = r.payment_id
          AND linked_payment.booking_id = b.id
          AND lower(COALESCE(linked_payment.status, '')) IN ('paid', 'partially_paid', 'partially paid')
          AND upper(COALESCE(linked_payment.currency, '')) = 'EUR'
      )
    );

  v_collected_revenue := GREATEST(0, v_collected_revenue - v_refunded_revenue);
  v_outstanding_revenue := GREATEST(0, v_total_revenue - v_collected_revenue);

  SELECT
    (SELECT COUNT(*)
       FROM public.leads AS l
      WHERE l.created_at::date BETWEEN p_start_date AND p_end_date)
    +
    (SELECT COUNT(*)
       FROM public.inquiries AS i
      WHERE i.created_at::date BETWEEN p_start_date AND p_end_date
        AND lower(COALESCE(i.status, '')) <> 'converted')
  INTO v_leads_count;

  SELECT COUNT(*)
  INTO v_converted_leads_count
  FROM public.leads AS l
  WHERE l.created_at::date BETWEEN p_start_date AND p_end_date
    AND lower(COALESCE(l.stage, '')) IN ('won', 'booked', 'completed');

  SELECT COUNT(*) INTO v_total_customers FROM public.customers;

  SELECT COUNT(*)
  INTO v_new_customers
  FROM public.customers AS c
  WHERE c.created_at::date BETWEEN p_start_date AND p_end_date;

  SELECT COUNT(*)
  INTO v_repeat_customers
  FROM public.customers AS c
  WHERE COALESCE(c.total_bookings_count, 0) > 1
    AND c.latest_booking_date BETWEEN p_start_date AND p_end_date;

  IF v_bookings_count > 0 THEN
    v_cancellation_rate := ROUND(
      (v_cancellations_count::numeric / v_bookings_count::numeric) * 100,
      2
    );
  END IF;

  IF v_leads_count > 0 THEN
    v_conversion_rate := ROUND(
      (v_converted_leads_count::numeric / v_leads_count::numeric) * 100,
      2
    );
  END IF;

  IF v_revenue_bookings_count > 0 THEN
    v_abv := ROUND(v_total_revenue / v_revenue_bookings_count::numeric, 2);
  END IF;

  RETURN jsonb_build_object(
    'startDate', p_start_date,
    'endDate', p_end_date,
    'revenue', jsonb_build_object(
      'total', v_total_revenue,
      'collected', v_collected_revenue,
      'refunded', v_refunded_revenue,
      'outstanding', v_outstanding_revenue,
      'currency', 'EUR',
      'averageBookingValue', v_abv
    ),
    'bookings', jsonb_build_object(
      'total', v_bookings_count,
      'confirmed', v_confirmed_bookings_count,
      'completed', v_completed_bookings_count,
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
    'leads', jsonb_build_object('total', v_leads_count)
  );
END;
$function$;


CREATE OR REPLACE FUNCTION private.query_custom_bi_report(p_filters jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_start_date date := NULLIF(p_filters->>'startDate', '')::date;
  v_end_date date := NULLIF(p_filters->>'endDate', '')::date;
  v_tour_id text := p_filters->>'tourId';
  v_destination text := p_filters->>'destination';
  v_booking_status text := p_filters->>'bookingStatus';
  v_payment_status text := p_filters->>'paymentStatus';
  v_lead_source text := p_filters->>'leadSource';
  v_staff_name text := p_filters->>'staffName';
  v_customer_query text := p_filters->>'customerQuery';
  v_rows jsonb;
BEGIN
  IF v_start_date IS NOT NULL AND v_end_date IS NOT NULL AND v_start_date > v_end_date THEN
    RAISE EXCEPTION 'Report start date must be on or before end date.'
      USING ERRCODE = '22007';
  END IF;

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
      COALESCE(b.booking_date, b.created_at::date) AS booking_date,
      b.created_at,
      b.status AS booking_status,
      b.payment_status,
      b.payment_method,
      COALESCE(b.adult_count, 0) + COALESCE(b.child_count, 0) + COALESCE(b.infant_count, 0) AS total_guests,
      b.subtotal,
      b.discount,
      b.total,
      b.currency,
      t.title AS tour_title,
      d.name AS destination_name,
      NULLIF(BTRIM(CONCAT_WS(' ', NULLIF(c.first_name, ''), NULLIF(c.last_name, ''))), '') AS customer_name,
      c.email AS customer_email,
      c.phone AS customer_phone,
      COALESCE(l.normalized_source, 'Other') AS lead_source,
      COALESCE(NULLIF(BTRIM(l.assigned_staff_name), ''), 'Unassigned') AS staff_name
    FROM public.bookings AS b
    LEFT JOIN public.tours AS t ON b.tour_id = t.id
    LEFT JOIN public.destinations AS d ON t.destination_id = d.id
    LEFT JOIN public.customers AS c ON b.customer_id = c.id
    LEFT JOIN LATERAL (
      SELECT
        lead.assigned_staff_name,
        CASE
          WHEN lower(BTRIM(COALESCE(lead.source, ''))) IN ('web', 'website', 'online', 'online checkout') THEN 'Website'
          WHEN lower(BTRIM(COALESCE(lead.source, ''))) LIKE '%whatsapp%' THEN 'WhatsApp'
          WHEN lower(BTRIM(COALESCE(lead.source, ''))) IN ('phone', 'call', 'telephone') THEN 'Phone'
          WHEN lower(BTRIM(COALESCE(lead.source, ''))) = 'email' THEN 'Email'
          WHEN lower(BTRIM(COALESCE(lead.source, ''))) = 'hotel' THEN 'Hotel'
          WHEN lower(BTRIM(COALESCE(lead.source, ''))) = 'referral' THEN 'Referral'
          WHEN lower(BTRIM(COALESCE(lead.source, ''))) IN ('walk-in', 'walkin') THEN 'Walk-in'
          WHEN lower(BTRIM(COALESCE(lead.source, ''))) LIKE '%social%' THEN 'Social Media'
          ELSE 'Other'
        END AS normalized_source
      FROM public.leads AS lead
      WHERE lead.customer_id = b.customer_id
      ORDER BY lead.created_at DESC NULLS LAST, lead.id DESC
      LIMIT 1
    ) AS l ON TRUE
    WHERE
      (v_start_date IS NULL OR COALESCE(b.booking_date, b.created_at::date) >= v_start_date)
      AND (v_end_date IS NULL OR COALESCE(b.booking_date, b.created_at::date) <= v_end_date)
      AND (v_tour_id IS NULL OR v_tour_id = 'all' OR b.tour_id::text = v_tour_id)
      AND (v_destination IS NULL OR v_destination = 'all' OR lower(d.name) = lower(v_destination))
      AND (v_booking_status IS NULL OR v_booking_status = 'all' OR b.status = v_booking_status)
      AND (v_payment_status IS NULL OR v_payment_status = 'all' OR b.payment_status = v_payment_status)
      AND (v_lead_source IS NULL OR v_lead_source = 'all' OR COALESCE(l.normalized_source, 'Other') = v_lead_source)
      AND (
        v_staff_name IS NULL OR v_staff_name = 'all'
        OR lower(COALESCE(NULLIF(BTRIM(l.assigned_staff_name), ''), 'Unassigned')) LIKE '%' || lower(v_staff_name) || '%'
      )
      AND (
        v_customer_query IS NULL
        OR v_customer_query = ''
        OR lower(COALESCE(c.email, '')) LIKE '%' || lower(v_customer_query) || '%'
        OR lower(COALESCE(c.first_name, '')) LIKE '%' || lower(v_customer_query) || '%'
        OR lower(COALESCE(c.last_name, '')) LIKE '%' || lower(v_customer_query) || '%'
        OR lower(COALESCE(b.booking_reference, '')) LIKE '%' || lower(v_customer_query) || '%'
      )
    ORDER BY COALESCE(b.booking_date, b.created_at::date) DESC, b.created_at DESC
    LIMIT 500
  ) AS r;

  RETURN v_rows;
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_executive_bi_metrics(
  p_start_date date,
  p_end_date date
)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path TO ''
AS $function$
  SELECT private.get_executive_bi_metrics($1, $2);
$function$;

CREATE OR REPLACE FUNCTION public.query_custom_bi_report(p_filters jsonb)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path TO ''
AS $function$
  SELECT private.query_custom_bi_report($1);
$function$;

GRANT USAGE ON SCHEMA private TO authenticated, service_role;

REVOKE ALL ON FUNCTION private.get_executive_bi_metrics(date, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.query_custom_bi_report(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.get_executive_bi_metrics(date, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.query_custom_bi_report(jsonb) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_executive_bi_metrics(date, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.query_custom_bi_report(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_executive_bi_metrics(date, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.query_custom_bi_report(jsonb) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
