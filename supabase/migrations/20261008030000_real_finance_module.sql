-- ==============================================================================
-- MIGRATION: PRODUCTION REAL FINANCE MODULE
-- Payments, Payment Providers, Controlled Refunds, Invoices, Balances, RLS
-- Migration ID: 20261008030000
-- ==============================================================================

-- 1. PAYMENT PROVIDERS TABLE (Honest integration registry)
CREATE TABLE IF NOT EXISTS public.payment_providers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    provider_type TEXT NOT NULL CHECK (provider_type IN ('manual', 'gateway', 'bank_transfer', 'wallet')),
    is_connected BOOLEAN NOT NULL DEFAULT false,
    is_manual BOOLEAN NOT NULL DEFAULT true,
    supported_currencies TEXT[] NOT NULL DEFAULT ARRAY['EUR', 'USD', 'GBP', 'EGP'],
    description TEXT,
    config JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed Payment Providers
INSERT INTO public.payment_providers (id, name, provider_type, is_connected, is_manual, supported_currencies, description)
VALUES
    ('cash', 'Marina Office Cash Desk', 'manual', true, true, ARRAY['EUR', 'USD', 'GBP', 'EGP'], 'In-person physical cash collection at Hurghada Marina pier or hotel pickup.'),
    ('pos_terminal', 'Pier Mobile POS Terminal', 'manual', true, true, ARRAY['EUR', 'USD', 'GBP', 'EGP'], 'Physical chip & PIN / contactless terminal managed by pier desk supervisor.'),
    ('bank_transfer', 'CIB Bank Official Wire', 'bank_transfer', true, true, ARRAY['EUR', 'USD', 'GBP', 'EGP'], 'Direct wire transfer to Commercial International Bank (Egypt) account.'),
    ('stripe', 'Stripe Payments', 'gateway', false, false, ARRAY['EUR', 'USD', 'GBP'], 'Online credit/debit card processing. Currently disconnected (No server-side Stripe secret key configured).'),
    ('paypal', 'PayPal Gateway', 'gateway', false, false, ARRAY['EUR', 'USD', 'GBP'], 'Digital wallet gateway. Currently disconnected (PayPal client ID not provisioned).')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    provider_type = EXCLUDED.provider_type,
    is_connected = EXCLUDED.is_connected,
    is_manual = EXCLUDED.is_manual,
    description = EXCLUDED.description;

-- 2. ENHANCE PAYMENT TRANSACTIONS TABLE
ALTER TABLE public.payment_transactions 
    ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'cash',
    ADD COLUMN IF NOT EXISTS is_manual BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS customer_name TEXT,
    ADD COLUMN IF NOT EXISTS customer_email TEXT,
    ADD COLUMN IF NOT EXISTS customer_phone TEXT,
    ADD COLUMN IF NOT EXISTS booking_reference TEXT;

-- Indexing for payment lookups
CREATE INDEX IF NOT EXISTS idx_payments_provider ON public.payment_transactions(provider);
CREATE INDEX IF NOT EXISTS idx_payments_is_manual ON public.payment_transactions(is_manual);
CREATE INDEX IF NOT EXISTS idx_payments_booking_ref ON public.payment_transactions(booking_reference);

-- 3. ENHANCE REFUND RECORDS TABLE (Full approval & processing lifecycle)
ALTER TABLE public.refund_records
    ADD COLUMN IF NOT EXISTS requested_amount NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS approved_amount NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'processed' CHECK (status IN ('requested', 'pending_approval', 'approved', 'processed', 'rejected')),
    ADD COLUMN IF NOT EXISTS requested_by TEXT DEFAULT 'Staff',
    ADD COLUMN IF NOT EXISTS approved_by TEXT,
    ADD COLUMN IF NOT EXISTS processed_date TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS customer_name TEXT,
    ADD COLUMN IF NOT EXISTS customer_email TEXT,
    ADD COLUMN IF NOT EXISTS booking_reference TEXT,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Backfill existing refunds if needed
UPDATE public.refund_records
SET 
    requested_amount = COALESCE(requested_amount, amount),
    approved_amount = COALESCE(approved_amount, amount),
    processed_date = COALESCE(processed_date, created_at)
WHERE requested_amount IS NULL;

CREATE INDEX IF NOT EXISTS idx_refunds_status ON public.refund_records(status);
CREATE INDEX IF NOT EXISTS idx_refunds_booking_ref ON public.refund_records(booking_reference);

-- 4. ENHANCE INVOICES TABLE
ALTER TABLE public.invoices
    ADD COLUMN IF NOT EXISTS customer_name TEXT,
    ADD COLUMN IF NOT EXISTS customer_email TEXT,
    ADD COLUMN IF NOT EXISTS customer_phone TEXT,
    ADD COLUMN IF NOT EXISTS tour_title TEXT,
    ADD COLUMN IF NOT EXISTS tour_date DATE;

-- 5. ROW LEVEL SECURITY POLICIES
ALTER TABLE public.payment_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refund_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Payment Providers: Read-only for authenticated staff, full manage for admins
DROP POLICY IF EXISTS "Anyone authenticated can view payment providers" ON public.payment_providers;
CREATE POLICY "Anyone authenticated can view payment providers" ON public.payment_providers
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can manage payment providers" ON public.payment_providers;
CREATE POLICY "Admins can manage payment providers" ON public.payment_providers
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Payments: Staff can view and record, Admins can edit
DROP POLICY IF EXISTS "Staff can manage payment transactions" ON public.payment_transactions;
CREATE POLICY "Staff can manage payment transactions" ON public.payment_transactions
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Refunds: Staff can view and request, Admins/Auditors can approve and process
DROP POLICY IF EXISTS "Staff can manage refund records" ON public.refund_records;
CREATE POLICY "Staff can manage refund records" ON public.refund_records
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Invoices: Staff can manage
DROP POLICY IF EXISTS "Staff can manage invoices" ON public.invoices;
CREATE POLICY "Staff can manage invoices" ON public.invoices
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Customers can view their own financial records linked to their bookings
DROP POLICY IF EXISTS "Customers can view their own payment transactions" ON public.payment_transactions;
CREATE POLICY "Customers can view their own payment transactions" ON public.payment_transactions
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.bookings b
            WHERE b.id = payment_transactions.booking_id
              AND b.user_id = (SELECT auth.uid())
        )
    );

DROP POLICY IF EXISTS "Customers can view their own refund records" ON public.refund_records;
CREATE POLICY "Customers can view their own refund records" ON public.refund_records
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.bookings b
            WHERE b.id = refund_records.booking_id
              AND b.user_id = (SELECT auth.uid())
        )
    );

DROP POLICY IF EXISTS "Customers can view their own invoices" ON public.invoices;
CREATE POLICY "Customers can view their own invoices" ON public.invoices
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.bookings b
            WHERE b.id = invoices.booking_id
              AND b.user_id = (SELECT auth.uid())
        )
    );
