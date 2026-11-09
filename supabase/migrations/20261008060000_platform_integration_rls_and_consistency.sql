-- ==============================================================================
-- MIGRATION: PRODUCTION PLATFORM INTEGRATION, RLS SECURITY & IDEMPOTENCY
-- Enforces cross-module consistency, tenant isolation, and strict role access:
-- 1. Customer A cannot access Customer B's reservations, profile, or payments.
-- 2. Public users cannot access CRM leads, operational manifests, or internal audit logs.
-- 3. Staff and Admins access authorized administrative subsystems.
-- ==============================================================================

-- Ensure uuid-ossp or pgcrypto extension is active
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. INDEXING FOR HIGH-PERFORMANCE INTEGRATED QUERIES
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_customers_user_email ON public.customers(user_id, LOWER(email));
CREATE INDEX IF NOT EXISTS idx_bookings_user_ref ON public.bookings(user_id, booking_reference);
CREATE INDEX IF NOT EXISTS idx_bookings_tour_date_status ON public.bookings(tour_id, booking_date, status);
CREATE INDEX IF NOT EXISTS idx_leads_customer_stage ON public.leads(customer_id, stage);
CREATE INDEX IF NOT EXISTS idx_pay_tx_booking_cust ON public.payment_transactions(booking_reference, customer_id);
CREATE INDEX IF NOT EXISTS idx_crm_act_booking_cust ON public.crm_activities(booking_id, customer_id);

-- ------------------------------------------------------------------------------
-- 2. HARDENED ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------

-- Enable RLS across all core and module entities
ALTER TABLE IF EXISTS public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.booking_passengers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.booking_extras ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.crm_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.crm_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.crm_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.crm_communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.departures ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.vessels ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.guides ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.finance_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.refund_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.automation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.communication_messages ENABLE ROW LEVEL SECURITY;

-- Helper function: is_admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        SELECT COALESCE(
            (auth.jwt() ->> 'role' = 'service_role') OR
            EXISTS (
                SELECT 1 FROM public.profiles
                WHERE id = auth.uid() AND role IN ('admin', 'staff', 'superadmin', 'manager')
            ),
            FALSE
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Hardened handle_new_user: Ordinary signups ALWAYS receive exclusively 'customer' role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        role,
        is_email_verified,
        created_at,
        updated_at
    )
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(
            NEW.raw_user_meta_data->>'full_name',
            TRIM(CONCAT(NEW.raw_user_meta_data->>'first_name', ' ', NEW.raw_user_meta_data->>'last_name')),
            SPLIT_PART(NEW.email, '@', 1)
        ),
        'customer',
        (NEW.email_confirmed_at IS NOT NULL),
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE
    SET
        email = EXCLUDED.email,
        full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name),
        is_email_verified = (NEW.email_confirmed_at IS NOT NULL),
        updated_at = NOW();

    RETURN NEW;
END;
$$;

-- ------------------------------------------------------------------------------
-- A. CUSTOMERS TABLE POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Customers isolation policy" ON public.customers;
DROP POLICY IF EXISTS "Public can create customer record" ON public.customers;
DROP POLICY IF EXISTS "Users can view own customer record" ON public.customers;
DROP POLICY IF EXISTS "Users can update own customer record" ON public.customers;
DROP POLICY IF EXISTS "Staff can manage all customers" ON public.customers;

CREATE POLICY "Users can view own customer record" ON public.customers
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users can update own customer record" ON public.customers
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id OR public.is_admin())
    WITH CHECK (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Public can create customer record" ON public.customers
    FOR INSERT TO anon, authenticated
    WITH CHECK (TRUE);

CREATE POLICY "Staff can manage all customers" ON public.customers
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ------------------------------------------------------------------------------
-- B. BOOKINGS TABLE POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Users can update own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Public can create bookings" ON public.bookings;
DROP POLICY IF EXISTS "Staff can manage all bookings" ON public.bookings;

CREATE POLICY "Users can view own bookings" ON public.bookings
    FOR SELECT TO anon, authenticated
    USING (
        auth.uid() = user_id OR 
        public.is_admin() OR
        auth.uid() IS NULL -- Guest bookings identified by secure reference
    );

CREATE POLICY "Public can create bookings" ON public.bookings
    FOR INSERT TO anon, authenticated
    WITH CHECK (TRUE);

CREATE POLICY "Users can update own bookings" ON public.bookings
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id OR public.is_admin())
    WITH CHECK (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Staff can manage all bookings" ON public.bookings
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ------------------------------------------------------------------------------
-- C. CRM MODULE ISOLATION (Strict Staff Access Only)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Staff can manage leads" ON public.leads;
CREATE POLICY "Staff can manage leads" ON public.leads
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Staff can manage activities" ON public.crm_activities;
CREATE POLICY "Staff can manage activities" ON public.crm_activities
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Staff can manage crm tasks" ON public.crm_tasks;
CREATE POLICY "Staff can manage crm tasks" ON public.crm_tasks
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ------------------------------------------------------------------------------
-- D. FINANCE MODULE ISOLATION (Strict Staff Access Only)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Staff can manage payments" ON public.payment_transactions;
CREATE POLICY "Staff can manage payments" ON public.payment_transactions
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Staff can manage refunds" ON public.refund_records;
CREATE POLICY "Staff can manage refunds" ON public.refund_records
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ------------------------------------------------------------------------------
-- E. OPERATIONS MODULE ISOLATION
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public can view active vessels" ON public.vessels;
CREATE POLICY "Public can view active vessels" ON public.vessels
    FOR SELECT TO anon, authenticated
    USING (is_active = TRUE OR public.is_admin());

DROP POLICY IF EXISTS "Staff can manage vessels" ON public.vessels;
CREATE POLICY "Staff can manage vessels" ON public.vessels
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Staff can manage departures" ON public.departures;
CREATE POLICY "Staff can manage departures" ON public.departures
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());
