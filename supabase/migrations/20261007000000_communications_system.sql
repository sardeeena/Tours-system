-- ==============================================================================
-- MIGRATION: COMMUNICATIONS SYSTEM (EMAIL, WHATSAPP, TEMPLATES, NOTIFICATIONS)
-- ==============================================================================

-- 1. Communication Message Log (Email & WhatsApp audit trail)
CREATE TABLE IF NOT EXISTS public.communication_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel TEXT NOT NULL CHECK (channel IN ('Email', 'WhatsApp')),
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    customer_name TEXT,
    recipient_address TEXT NOT NULL, -- Email address or WhatsApp phone number
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
    booking_reference TEXT,
    template_key TEXT,
    subject TEXT,
    content TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Queued' CHECK (status IN ('Queued', 'Sent', 'Delivered', 'Failed')),
    provider_name TEXT DEFAULT 'None', -- 'Resend', 'SendGrid', 'Twilio', 'Meta Cloud API', 'None'
    provider_message_id TEXT,
    failure_reason TEXT,
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    staff_name TEXT NOT NULL DEFAULT 'System Dispatcher',
    staff_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comm_msgs_channel ON public.communication_messages(channel);
CREATE INDEX IF NOT EXISTS idx_comm_msgs_status ON public.communication_messages(status);
CREATE INDEX IF NOT EXISTS idx_comm_msgs_customer ON public.communication_messages(customer_id);
CREATE INDEX IF NOT EXISTS idx_comm_msgs_booking ON public.communication_messages(booking_id);
CREATE INDEX IF NOT EXISTS idx_comm_msgs_created ON public.communication_messages(created_at);

-- 2. Communication Templates Table
CREATE TABLE IF NOT EXISTS public.communication_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    channel TEXT NOT NULL DEFAULT 'Both' CHECK (channel IN ('Email', 'WhatsApp', 'Both')),
    subject TEXT,
    body_text TEXT NOT NULL,
    variables JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Staff Internal Notifications Table (Deduplicated, non-spamming)
CREATE TABLE IF NOT EXISTS public.staff_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL CHECK (category IN (
        'new_booking',
        'new_inquiry',
        'payment_pending',
        'cancellation',
        'new_review',
        'followup_due',
        'operational_issue'
    )),
    dedup_key TEXT UNIQUE, -- Prevents notification spam
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical', 'success')),
    entity_type TEXT, -- 'booking', 'inquiry', 'customer', 'departure', 'review'
    entity_id TEXT,
    link_tab TEXT,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_notif_unread ON public.staff_notifications(is_read, created_at);
CREATE INDEX IF NOT EXISTS idx_staff_notif_category ON public.staff_notifications(category);

-- 4. Enable Row Level Security
ALTER TABLE public.communication_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_notifications ENABLE ROW LEVEL SECURITY;

-- Staff and Admins have full access
DROP POLICY IF EXISTS "Staff can manage communication messages" ON public.communication_messages;
CREATE POLICY "Staff can manage communication messages" ON public.communication_messages
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Staff can manage templates" ON public.communication_templates;
CREATE POLICY "Staff can manage templates" ON public.communication_templates
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Staff can manage notifications" ON public.staff_notifications;
CREATE POLICY "Staff can manage notifications" ON public.staff_notifications
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
