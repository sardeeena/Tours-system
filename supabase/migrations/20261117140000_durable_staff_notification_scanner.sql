-- Durable server-side staff notification scan.
-- The scan reads authoritative production tables and uses stable dedup keys.
BEGIN;

CREATE OR REPLACE FUNCTION public.scan_staff_notifications()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_inserted INTEGER := 0;
  v_rows INTEGER := 0;
BEGIN
  IF NOT (
    auth.role() = 'service_role'
    OR (auth.uid() IS NOT NULL AND public.is_admin())
  ) THEN
    RAISE EXCEPTION 'Not authorized to scan staff notifications' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.staff_notifications
    (category,dedup_key,title,message,severity,entity_type,entity_id,link_tab,is_read,created_at)
  SELECT
    'new_booking','booking-created:' || b.id::TEXT,
    'New Booking: ' || b.booking_reference,
    concat_ws(' ',c.first_name,c.last_name) || ' booked ' || coalesce(t.title,'an excursion') ||
      ' for ' || b.booking_date::TEXT || ' (' || coalesce(b.currency,'EUR') || ' ' || to_char(b.total,'FM999999990.00') || ').',
    'success','booking',b.booking_reference,'bookings',FALSE,coalesce(b.created_at,now())
  FROM public.bookings b
  LEFT JOIN public.customers c ON c.id=b.customer_id
  LEFT JOIN public.tours t ON t.id=b.tour_id
  ON CONFLICT (dedup_key) DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT; v_inserted := v_inserted + v_rows;

  INSERT INTO public.staff_notifications
    (category,dedup_key,title,message,severity,entity_type,entity_id,link_tab,is_read,created_at)
  SELECT
    'payment_overdue','payment_overdue_' || b.booking_reference || '_' || b.booking_date::TEXT,
    'Payment Overdue: ' || b.booking_reference,
    'Reservation ' || b.booking_reference || ' for ' || b.booking_date::TEXT || ' has an outstanding payment balance.',
    'warning','booking',b.booking_reference,'fin_balances',FALSE,now()
  FROM public.bookings b
  WHERE b.booking_date <= current_date AND b.payment_status <> 'paid' AND b.status <> 'cancelled'
  ON CONFLICT (dedup_key) DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT; v_inserted := v_inserted + v_rows;

  INSERT INTO public.staff_notifications
    (category,dedup_key,title,message,severity,entity_type,entity_id,link_tab,is_read,created_at)
  SELECT
    'payment_pending','payment_pending_' || b.booking_reference,
    'Payment Pending: ' || b.booking_reference,
    'Upcoming reservation ' || b.booking_reference || ' has an unpaid or partially paid balance.',
    'warning','booking',b.booking_reference,'fin_balances',FALSE,now()
  FROM public.bookings b
  WHERE b.booking_date > current_date
    AND b.payment_status IN ('pending','partially_paid')
    AND b.status NOT IN ('cancelled','completed')
  ON CONFLICT (dedup_key) DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT; v_inserted := v_inserted + v_rows;

  INSERT INTO public.staff_notifications
    (category,dedup_key,title,message,severity,entity_type,entity_id,link_tab,is_read,created_at)
  SELECT
    'cancellation','cancellation_' || b.booking_reference,
    'Cancellation Request: ' || b.booking_reference,
    'A customer has requested cancellation for booking ' || b.booking_reference || '. Review the request and applicable refund terms.',
    'warning','booking',b.booking_reference,'bookings',FALSE,now()
  FROM public.bookings b
  WHERE b.status = 'cancellation_requested'
  ON CONFLICT (dedup_key) DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT; v_inserted := v_inserted + v_rows;

  INSERT INTO public.staff_notifications
    (category,dedup_key,title,message,severity,entity_type,entity_id,link_tab,is_read,created_at)
  SELECT
    'new_inquiry','new_inquiry_' || i.id::TEXT,
    'New Inquiry: ' || i.customer_name,
    i.customer_name || ' asked about "' || i.subject || '". Email: ' || i.email,
    'info','inquiry',i.id::TEXT,'inquiries',FALSE,i.created_at
  FROM public.inquiries i
  WHERE i.status='new'
  ON CONFLICT (dedup_key) DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT; v_inserted := v_inserted + v_rows;

  INSERT INTO public.staff_notifications
    (category,dedup_key,title,message,severity,entity_type,entity_id,link_tab,is_read,created_at)
  SELECT
    'new_payment','new_payment_' || p.id::TEXT,
    'New Payment: ' || p.currency || ' ' || to_char(p.amount,'FM999999990.00'),
    'Received ' || p.payment_method || ' from ' ||
      coalesce(nullif(concat_ws(' ',c.first_name,c.last_name),''),'Guest') ||
      ' for ' || coalesce(b.booking_reference,'a booking') || '.',
    'success','payment',p.id::TEXT,'fin_payments',FALSE,coalesce(p.payment_date,now())
  FROM public.payment_transactions p
  LEFT JOIN public.bookings b ON b.id=p.booking_id
  LEFT JOIN public.customers c ON c.id=coalesce(p.customer_id,b.customer_id)
  WHERE p.status IN ('Paid','Partially Paid')
  ON CONFLICT (dedup_key) DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT; v_inserted := v_inserted + v_rows;

  INSERT INTO public.staff_notifications
    (category,dedup_key,title,message,severity,entity_type,entity_id,link_tab,is_read,created_at)
  SELECT
    'new_lead','new_lead_' || l.id::TEXT,
    'New CRM Lead: ' || l.name,
    l.name || ' (' || coalesce(l.country,'International') || '). Estimated value: ' ||
      coalesce(l.currency,'EUR') || ' ' || to_char(coalesce(l.estimated_value,0),'FM999999990.00') || '.',
    'info','customer',l.id::TEXT,'crm_leads',FALSE,l.created_at
  FROM public.leads l
  WHERE lower(coalesce(l.stage,''))='new'
  ON CONFLICT (dedup_key) DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT; v_inserted := v_inserted + v_rows;

  INSERT INTO public.staff_notifications
    (category,dedup_key,title,message,severity,entity_type,entity_id,link_tab,is_read,created_at)
  SELECT
    'followup_due','followup_due_' || l.id::TEXT || '_' || l.follow_up_date::DATE::TEXT,
    'Follow-up Due: ' || l.name,
    'Follow-up required for ' || l.name || '. Target date: ' || l.follow_up_date::DATE::TEXT || '.',
    'warning','customer',l.id::TEXT,'crm_followups',FALSE,now()
  FROM public.leads l
  WHERE l.follow_up_date IS NOT NULL
    AND l.follow_up_date::DATE <= current_date
    AND lower(coalesce(l.stage,'')) NOT IN ('won','lost')
  ON CONFLICT (dedup_key) DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT; v_inserted := v_inserted + v_rows;

  INSERT INTO public.staff_notifications
    (category,dedup_key,title,message,severity,entity_type,entity_id,link_tab,is_read,created_at)
  SELECT
    'task_overdue','task_overdue_' || t.id::TEXT || '_' || t.due_date::DATE::TEXT,
    'Task Overdue: ' || t.title,
    'Assigned to ' || coalesce(t.assigned_staff_name,'Staff') || '. Due on ' || t.due_date::DATE::TEXT || '.',
    'critical','task',t.id::TEXT,'crm_tasks',FALSE,now()
  FROM public.crm_tasks t
  WHERE t.due_date IS NOT NULL AND t.due_date < now()
    AND lower(coalesce(t.status,'')) NOT IN ('completed','cancelled')
  ON CONFLICT (dedup_key) DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT; v_inserted := v_inserted + v_rows;

  INSERT INTO public.staff_notifications
    (category,dedup_key,title,message,severity,entity_type,entity_id,link_tab,is_read,created_at)
  SELECT
    'departure_unassigned','departure_unassigned_' || d.id::TEXT,
    'Departure Unassigned: ' || d.date::TEXT,
    coalesce(t.title,'Tour') || ' on ' || d.date::TEXT || ' is missing ' ||
      CASE WHEN d.guide_id IS NULL AND d.vessel_id IS NULL THEN 'guide and vessel'
           WHEN d.guide_id IS NULL THEN 'guide' ELSE 'vessel' END || ' assignment.',
    'critical','departure',d.id::TEXT,'ops_departures',FALSE,now()
  FROM public.departures d
  LEFT JOIN public.tours t ON t.id=d.tour_id
  WHERE d.date >= current_date AND d.status NOT IN ('cancelled','completed')
    AND (d.guide_id IS NULL OR d.vessel_id IS NULL)
  ON CONFLICT (dedup_key) DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT; v_inserted := v_inserted + v_rows;

  INSERT INTO public.staff_notifications
    (category,dedup_key,title,message,severity,entity_type,entity_id,link_tab,is_read,created_at)
  SELECT
    'pickup_pending','pickup_pending_' || p.id::TEXT,
    'Pickup Pending: ' || coalesce(p.hotel,'Hotel'),
    'Passenger pickup for ' || coalesce(p.customer_name,'Guest') || ' at ' ||
      coalesce(nullif(p.pickup_time,''),'an unconfirmed time') ||
      ' requires driver confirmation. Booking ' || p.booking_reference || '.',
    'warning','departure',p.id::TEXT,'ops_pickups',FALSE,now()
  FROM public.pickup_schedules p
  WHERE p.tour_date <= current_date + 1 AND p.status='pending'
  ON CONFLICT (dedup_key) DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT; v_inserted := v_inserted + v_rows;

  RETURN jsonb_build_object('success',true,'inserted',v_inserted,'scanned_at',now());
END;
$function$;

REVOKE ALL ON FUNCTION public.scan_staff_notifications() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.scan_staff_notifications() TO authenticated, service_role;

COMMIT;
