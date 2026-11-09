-- ==============================================================================
-- MIGRATION: CRM SYSTEM (LEADS, TASKS, COMMUNICATIONS, NOTES, ACTIVITIES)
-- ==============================================================================

-- 1. Extend Customers table if needed
ALTER TABLE public.customers
    ADD COLUMN IF NOT EXISTS whatsapp TEXT,
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'Website',
    ADD COLUMN IF NOT EXISTS last_contact_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS total_revenue NUMERIC(10,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS outstanding_amount NUMERIC(10,2) DEFAULT 0;

-- 2. Leads Pipeline Table
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    whatsapp TEXT,
    country TEXT,
    hotel TEXT,
    source TEXT NOT NULL DEFAULT 'Website',
    interested_tour_id UUID REFERENCES public.tours(id) ON DELETE SET NULL,
    interested_tour_title TEXT,
    travel_date DATE,
    number_of_guests INT NOT NULL DEFAULT 1,
    estimated_value NUMERIC(10,2) NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'EUR',
    stage TEXT NOT NULL DEFAULT 'New', -- ('New', 'Contacted', 'Interested', 'Quotation Sent', 'Booking Pending', 'Booked', 'Completed', 'Lost')
    notes TEXT,
    assigned_staff_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    assigned_staff_name TEXT,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    follow_up_date TIMESTAMPTZ,
    lost_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_stage ON public.leads(stage);
CREATE INDEX IF NOT EXISTS idx_leads_assigned ON public.leads(assigned_staff_id);
CREATE INDEX IF NOT EXISTS idx_leads_follow_up ON public.leads(follow_up_date);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads(created_at DESC);

-- Automated Timestamp Trigger for Leads
DROP TRIGGER IF EXISTS trigger_leads_updated_at ON public.leads;
CREATE TRIGGER trigger_leads_updated_at
    BEFORE UPDATE ON public.leads
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 3. CRM Tasks & Follow-ups Table
CREATE TABLE IF NOT EXISTS public.crm_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    customer_name TEXT,
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    lead_name TEXT,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
    booking_reference TEXT,
    assigned_staff_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    assigned_staff_name TEXT,
    due_date TIMESTAMPTZ,
    priority TEXT NOT NULL DEFAULT 'Medium', -- ('Low', 'Medium', 'High', 'Urgent')
    status TEXT NOT NULL DEFAULT 'Pending', -- ('Pending', 'In Progress', 'Completed', 'Cancelled')
    is_follow_up BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_tasks_status ON public.crm_tasks(status);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_due_date ON public.crm_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_customer ON public.crm_tasks(customer_id);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_lead ON public.crm_tasks(lead_id);

DROP TRIGGER IF EXISTS trigger_crm_tasks_updated_at ON public.crm_tasks;
CREATE TRIGGER trigger_crm_tasks_updated_at
    BEFORE UPDATE ON public.crm_tasks
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 4. Communications Log Table
CREATE TABLE IF NOT EXISTS public.crm_communications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    customer_name TEXT,
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
    channel TEXT NOT NULL DEFAULT 'WhatsApp', -- ('WhatsApp', 'Email', 'Phone', 'In-Person', 'Web Chat', 'SMS')
    direction TEXT NOT NULL DEFAULT 'outbound', -- ('inbound', 'outbound')
    summary TEXT NOT NULL,
    content TEXT,
    staff_name TEXT NOT NULL DEFAULT 'Admin Staff',
    staff_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_comms_customer ON public.crm_communications(customer_id);
CREATE INDEX IF NOT EXISTS idx_crm_comms_created_at ON public.crm_communications(created_at DESC);

-- 5. Staff Notes Table
CREATE TABLE IF NOT EXISTS public.crm_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    staff_name TEXT NOT NULL DEFAULT 'Staff Member',
    staff_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_notes_customer ON public.crm_notes(customer_id);

-- 6. Unified Activity Timeline Table
CREATE TABLE IF NOT EXISTS public.crm_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    actor TEXT NOT NULL DEFAULT 'System',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_act_customer ON public.crm_activities(customer_id);
CREATE INDEX IF NOT EXISTS idx_crm_act_created ON public.crm_activities(created_at DESC);

-- 7. Row Level Security Policies
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;

-- Admins and Staff full access
DROP POLICY IF EXISTS "Staff can manage leads" ON public.leads;
CREATE POLICY "Staff can manage leads"
    ON public.leads FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Staff can manage crm tasks" ON public.crm_tasks;
CREATE POLICY "Staff can manage crm tasks"
    ON public.crm_tasks FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Staff can manage crm communications" ON public.crm_communications;
CREATE POLICY "Staff can manage crm communications"
    ON public.crm_communications FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Staff can manage crm notes" ON public.crm_notes;
CREATE POLICY "Staff can manage crm notes"
    ON public.crm_notes FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Staff can view crm activities" ON public.crm_activities;
CREATE POLICY "Staff can view crm activities"
    ON public.crm_activities FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());
