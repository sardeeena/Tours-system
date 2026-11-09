-- ==============================================================================
-- MIGRATION: FINANCE SYSTEM (PAYMENTS, INVOICES, REFUNDS, AUDIT TRAIL)
-- ==============================================================================

-- 1. Payments Ledger (Auditable transaction records)
CREATE TABLE IF NOT EXISTS public.payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE RESTRICT,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    currency TEXT NOT NULL DEFAULT 'EUR',
    payment_method TEXT NOT NULL CHECK (payment_method IN ('Cash', 'Card', 'Bank Transfer', 'Online Payment', 'Other')),
    status TEXT NOT NULL DEFAULT 'Paid' CHECK (status IN ('Pending', 'Paid', 'Partially Paid', 'Failed', 'Refunded')),
    transaction_reference TEXT,
    notes TEXT,
    recorded_by TEXT DEFAULT 'Staff',
    payment_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_booking ON public.payment_transactions(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer ON public.payment_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON public.payment_transactions(payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payments_currency ON public.payment_transactions(currency);

-- 2. Controlled Refund Records (Never silently modify historical payments)
CREATE TABLE IF NOT EXISTS public.refund_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE RESTRICT,
    payment_id UUID REFERENCES public.payment_transactions(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    currency TEXT NOT NULL DEFAULT 'EUR',
    reason TEXT NOT NULL,
    refund_method TEXT NOT NULL DEFAULT 'Card Reversal',
    transaction_reference TEXT,
    notes TEXT,
    processed_by TEXT DEFAULT 'Staff',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refunds_booking ON public.refund_records(booking_id);
CREATE INDEX IF NOT EXISTS idx_refunds_customer ON public.refund_records(customer_id);
CREATE INDEX IF NOT EXISTS idx_refunds_date ON public.refund_records(created_at);

-- 3. Invoices Table
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number TEXT NOT NULL UNIQUE,
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE RESTRICT,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL DEFAULT CURRENT_DATE,
    subtotal NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    discount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    tax_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    total NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    paid NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    balance NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    currency TEXT NOT NULL DEFAULT 'EUR',
    status TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('draft', 'issued', 'paid', 'partially_paid', 'overdue', 'cancelled')),
    line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
    company_details JSONB NOT NULL DEFAULT '{}'::jsonb,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_number ON public.invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_booking ON public.invoices(booking_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);

-- 4. Enable Row Level Security
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refund_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Staff and Admins have full access
DROP POLICY IF EXISTS "Staff can manage payments" ON public.payment_transactions;
CREATE POLICY "Staff can manage payments" ON public.payment_transactions
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Staff can manage refunds" ON public.refund_records;
CREATE POLICY "Staff can manage refunds" ON public.refund_records
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Staff can manage invoices" ON public.invoices;
CREATE POLICY "Staff can manage invoices" ON public.invoices
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Customers can only read their own payments / invoices via booking association
DROP POLICY IF EXISTS "Customers can view their own payments" ON public.payment_transactions;
CREATE POLICY "Customers can view their own payments" ON public.payment_transactions
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.bookings b
            WHERE b.id = payment_transactions.booking_id
            AND b.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Customers can view their own invoices" ON public.invoices;
CREATE POLICY "Customers can view their own invoices" ON public.invoices
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.bookings b
            WHERE b.id = invoices.booking_id
            AND b.user_id = auth.uid()
        )
    );
