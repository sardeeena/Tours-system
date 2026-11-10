-- Remove exact duplicate permissive policies and pin SECURITY DEFINER helpers to an empty search_path.
-- The retained policies have identical role, command, USING, and WITH CHECK behavior.

BEGIN;

-- Duplicate staff/admin ALL policies with identical predicates.
DROP POLICY IF EXISTS "Staff can manage all bookings" ON public.bookings;
DROP POLICY IF EXISTS "Staff can view crm activities" ON public.crm_activities;
DROP POLICY IF EXISTS "Staff can manage all customers" ON public.customers;
DROP POLICY IF EXISTS "Admins can view all customers" ON public.customers;
DROP POLICY IF EXISTS "Staff can manage guides" ON public.guides;
DROP POLICY IF EXISTS "Staff can manage payments" ON public.payment_transactions;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Staff can manage refunds" ON public.refund_records;
DROP POLICY IF EXISTS "Staff can manage vessels" ON public.vessels;
DROP POLICY IF EXISTS "Staff can manage weather bulletins" ON public.weather_bulletins;

-- Public policies: PUBLIC already includes anon and authenticated. The retained
-- PUBLIC policies have the same predicates as the narrower duplicates.
DROP POLICY IF EXISTS "Public can view active guides" ON public.guides;
DROP POLICY IF EXISTS "Public can view active vessels" ON public.vessels;
DROP POLICY IF EXISTS "Public can view weather bulletins" ON public.weather_bulletins;

-- Pin all three SECURITY DEFINER functions to an empty search_path. Their
-- relations and auth helpers are schema-qualified; pg_catalog built-ins remain
-- available without adding exposed schemas to the search path.
ALTER FUNCTION public.create_booking_atomic(
  text, date, integer, integer, integer,
  text, text, text, text, text, text, text, text,
  jsonb, text, text, text, text
) SET search_path = '';

ALTER FUNCTION public.replace_extra_tour_assignments_atomic(uuid, jsonb)
  SET search_path = '';

ALTER FUNCTION public.replace_tour_extra_assignments_atomic(uuid, jsonb)
  SET search_path = '';

COMMIT;
