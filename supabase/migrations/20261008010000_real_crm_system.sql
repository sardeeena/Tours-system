-- ==============================================================================
-- MIGRATION: PRODUCTION CRM UPGRADE (LEADS, CUSTOMERS, TASKS, FOLLOW-UPS,
--            CONVERSATIONS, TAGS, SEGMENTS, UNIFIED TIMELINE, RLS)
-- Migration ID: 20261008010000_real_crm_system.sql
-- ==============================================================================

-- 1. Enhance and ensure complete columns for public.leads
ALTER TABLE public.leads
    ADD COLUMN IF NOT EXISTS score INT NOT NULL DEFAULT 50,
    ADD COLUMN IF NOT EXISTS destination TEXT,
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS last_contact_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS contact_attempts_count INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_score ON public.leads(score DESC);
CREATE INDEX IF NOT EXISTS idx_leads_email ON public.leads(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_leads_phone ON public.leads(phone);

-- 2. Enhance public.customers with comprehensive CRM profile attributes
ALTER TABLE public.customers
    ADD COLUMN IF NOT EXISTS whatsapp TEXT,
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'Website Booking',
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active', -- ('active', 'vip', 'inactive', 'archived')
    ADD COLUMN IF NOT EXISTS last_contact_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS total_revenue NUMERIC(10,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS outstanding_amount NUMERIC(10,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_bookings_count INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS completed_bookings_count INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS cancelled_bookings_count INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS first_booking_date DATE,
    ADD COLUMN IF NOT EXISTS latest_booking_date DATE,
    ADD COLUMN IF NOT EXISTS upcoming_booking_date DATE,
    ADD COLUMN IF NOT EXISTS preferred_currency TEXT DEFAULT 'EUR';

CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_status ON public.customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_tags ON public.customers USING GIN (tags);

-- 3. CRM Lead Stages Table (Configurable Lead Stages)
CREATE TABLE IF NOT EXISTS public.crm_lead_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    label TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#2dd4bf',
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_won BOOLEAN NOT NULL DEFAULT FALSE,
    is_lost BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed standard CRM stages
INSERT INTO public.crm_lead_stages (name, label, color, sort_order, is_won, is_lost)
VALUES
    ('New', 'New Lead', '#38bdf8', 1, FALSE, FALSE),
    ('Contacted', 'Contacted', '#818cf8', 2, FALSE, FALSE),
    ('Qualified', 'Qualified Prospect', '#a78bfa', 3, FALSE, FALSE),
    ('Proposal', 'Proposal / Quotation', '#fbbf24', 4, FALSE, FALSE),
    ('Follow-up', 'Follow-up Due', '#f97316', 5, FALSE, FALSE),
    ('Won', 'Won / Converted', '#10b981', 6, TRUE, FALSE),
    ('Lost', 'Lost Deal', '#ef4444', 7, FALSE, TRUE)
ON CONFLICT (name) DO UPDATE SET
    label = EXCLUDED.label,
    sort_order = EXCLUDED.sort_order;

-- 4. CRM Customer Tags Table (Admin-Configured & System Tags)
CREATE TABLE IF NOT EXISTS public.crm_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    color TEXT NOT NULL DEFAULT '#2dd4bf',
    category TEXT DEFAULT 'general',
    usage_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.crm_tags (name, description, color, category)
VALUES
    ('VIP', 'High value or celebrity guests requiring executive concierge', '#fbbf24', 'tier'),
    ('repeat_customer', 'Traveled more than once with Red Sea Excursions', '#34d399', 'loyalty'),
    ('family', 'Traveling with children or multi-generational groups', '#60a5fa', 'interest'),
    ('diving', 'Certified scuba divers or looking for PADI courses', '#06b6d4', 'interest'),
    ('snorkeling', 'Interested in boat trips, coral reefs & dolphin watching', '#2dd4bf', 'interest'),
    ('safari', 'Desert quad, buggy, and Bedouin evening safari interest', '#f97316', 'interest'),
    ('honeymoon', 'Couples celebrating wedding, anniversary or honeymoon', '#f43f5e', 'interest'),
    ('high_value', 'High booking value spenders (€500+)', '#a855f7', 'tier')
ON CONFLICT (name) DO NOTHING;

-- 5. CRM Customer Segments Table (Dynamic Rule-Based Customer Cohorts)
CREATE TABLE IF NOT EXISTS public.crm_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    badge_label TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#2dd4bf',
    icon TEXT NOT NULL DEFAULT 'Tag',
    rule_type TEXT NOT NULL, -- 'repeat', 'high_value', 'dormant_12m', 'upcoming_trip', 'interest_diving', 'unconverted_inquiry'
    filter_criteria JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.crm_segments (name, slug, description, badge_label, color, icon, rule_type)
VALUES
    ('VIP Repeat Travelers', 'repeat_customers', 'Travelers who have completed 2 or more excursions across the Red Sea', 'Repeat Guest', '#fbbf24', 'Crown', 'repeat'),
    ('High Lifetime Value (€500+)', 'high_value', 'Guests with over €500 total spend on yachts, diving, or private safaris', 'High Value', '#a855f7', 'Diamond', 'high_value'),
    ('Dormant (No Booking in 12 Months)', 'dormant_12m', 'Past customers who have not made a reservation in the last 12 months', 'Win-Back', '#f97316', 'Clock', 'dormant_12m'),
    ('Upcoming Trips (Next 14 Days)', 'upcoming_trips', 'Confirmed travelers with excursions scheduled within the next two weeks', 'Active Trip', '#34d399', 'Calendar', 'upcoming_trip'),
    ('Diving & Watersports Enthusiasts', 'diving_enthusiasts', 'Guests who have booked or tagged with Scuba Diving and Snorkeling', 'Marine Sports', '#06b6d4', 'Anchor', 'interest_diving'),
    ('Unconverted Inquiry Leads', 'unconverted_leads', 'Prospects who submitted inquiries or custom requests without booking yet', 'Prospect', '#38bdf8', 'Target', 'unconverted_inquiry')
ON CONFLICT (slug) DO NOTHING;

-- 6. Enhance CRM Tasks & Follow-ups Table
ALTER TABLE public.crm_tasks
    ADD COLUMN IF NOT EXISTS follow_up_channel TEXT DEFAULT 'Phone', -- ('Phone', 'Email', 'WhatsApp', 'Note', 'Other')
    ADD COLUMN IF NOT EXISTS outcome_notes TEXT,
    ADD COLUMN IF NOT EXISTS completed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS completed_by_name TEXT;

CREATE INDEX IF NOT EXISTS idx_crm_tasks_follow_up ON public.crm_tasks(is_follow_up, due_date) WHERE status = 'Pending';

-- 7. Persistent Conversations System (Email & WhatsApp Integration)
CREATE TABLE IF NOT EXISTS public.crm_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
    channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'email', 'phone', 'web_chat', 'sms')),
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    sender_identifier TEXT NOT NULL,
    recipient_identifier TEXT NOT NULL,
    subject TEXT,
    message_body TEXT NOT NULL,
    provider TEXT NOT NULL DEFAULT 'unconfigured', -- ('resend', 'sendgrid', 'meta_whatsapp', 'twilio', 'manual', 'unconfigured')
    provider_message_id TEXT,
    provider_status TEXT NOT NULL DEFAULT 'logged', -- ('queued', 'sent', 'delivered', 'read', 'failed', 'logged', 'provider_not_configured')
    error_details TEXT,
    staff_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    staff_name TEXT NOT NULL DEFAULT 'Admin Staff',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_conversations_customer ON public.crm_conversations(customer_id);
CREATE INDEX IF NOT EXISTS idx_crm_conversations_lead ON public.crm_conversations(lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_conversations_booking ON public.crm_conversations(booking_id);
CREATE INDEX IF NOT EXISTS idx_crm_conversations_created_at ON public.crm_conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_conversations_channel ON public.crm_conversations(channel);

-- 8. Enhanced Unified Activity Timeline Table
-- Add rich columns to crm_activities
ALTER TABLE public.crm_activities
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS staff_name TEXT,
    ADD COLUMN IF NOT EXISTS is_system_generated BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_crm_activities_timeline ON public.crm_activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_activities_customer ON public.crm_activities(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_activities_lead ON public.crm_activities(lead_id, created_at DESC);

-- 9. Row-Level Security Policies for CRM Data
ALTER TABLE public.crm_lead_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_conversations ENABLE ROW LEVEL SECURITY;

-- Admins and Staff have full management access to all CRM tables
DROP POLICY IF EXISTS "Staff can manage crm_lead_stages" ON public.crm_lead_stages;
CREATE POLICY "Staff can manage crm_lead_stages"
    ON public.crm_lead_stages FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Staff can manage crm_tags" ON public.crm_tags;
CREATE POLICY "Staff can manage crm_tags"
    ON public.crm_tags FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Staff can manage crm_segments" ON public.crm_segments;
CREATE POLICY "Staff can manage crm_segments"
    ON public.crm_segments FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Staff can manage crm_conversations" ON public.crm_conversations;
CREATE POLICY "Staff can manage crm_conversations"
    ON public.crm_conversations FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- Ensure customers table RLS policy allows staff full access while customers only read their own record
DROP POLICY IF EXISTS "Staff can manage all customers" ON public.customers;
CREATE POLICY "Staff can manage all customers"
    ON public.customers FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Users can read own customer record" ON public.customers;
CREATE POLICY "Users can read own customer record"
    ON public.customers FOR SELECT
    TO authenticated
    USING (user_id = (SELECT auth.uid()));

-- 10. Automated Customer Recalculation Trigger Function
-- Automatically recalculates customer lifetime spending, total bookings, and dates when bookings update
CREATE OR REPLACE FUNCTION public.recalculate_customer_stats(p_customer_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_total_spent NUMERIC(10,2) := 0;
    v_outstanding NUMERIC(10,2) := 0;
    v_total_count INT := 0;
    v_completed_count INT := 0;
    v_cancelled_count INT := 0;
    v_first_date DATE;
    v_latest_date DATE;
    v_upcoming_date DATE;
    v_current_tags TEXT[];
BEGIN
    IF p_customer_id IS NULL THEN
        RETURN;
    END IF;

    -- Aggregate stats from bookings
    SELECT
        COALESCE(SUM(CASE WHEN status != 'cancelled' THEN total_price ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN status != 'cancelled' AND payment_status != 'paid' THEN total_price ELSE 0 END), 0),
        COUNT(*),
        COUNT(*) FILTER (WHERE status = 'completed'),
        COUNT(*) FILTER (WHERE status = 'cancelled'),
        MIN(booking_date),
        MAX(booking_date),
        MIN(booking_date) FILTER (WHERE booking_date >= CURRENT_DATE AND status IN ('confirmed', 'pending'))
    INTO
        v_total_spent,
        v_outstanding,
        v_total_count,
        v_completed_count,
        v_cancelled_count,
        v_first_date,
        v_latest_date,
        v_upcoming_date
    FROM public.bookings
    WHERE customer_id = p_customer_id;

    -- Fetch current tags
    SELECT tags INTO v_current_tags FROM public.customers WHERE id = p_customer_id;
    IF v_current_tags IS NULL THEN
        v_current_tags := '{}';
    END IF;

    -- Automatically attach VIP or repeat tag if qualified
    IF v_total_count >= 2 AND NOT ('repeat_customer' = ANY(v_current_tags)) THEN
        v_current_tags := array_append(v_current_tags, 'repeat_customer');
    END IF;
    IF v_total_spent >= 500 AND NOT ('high_value' = ANY(v_current_tags)) THEN
        v_current_tags := array_append(v_current_tags, 'high_value');
    END IF;

    -- Update customer record
    UPDATE public.customers
    SET
        total_revenue = v_total_spent,
        outstanding_amount = v_outstanding,
        total_bookings_count = v_total_count,
        completed_bookings_count = v_completed_count,
        cancelled_bookings_count = v_cancelled_count,
        first_booking_date = v_first_date,
        latest_booking_date = v_latest_date,
        upcoming_booking_date = v_upcoming_date,
        tags = v_current_tags,
        updated_at = NOW()
    WHERE id = p_customer_id;
END;
$$;
