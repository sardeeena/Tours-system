-- ==============================================================================
-- MIGRATION: PRODUCTION REAL COMMUNICATIONS & AUTOMATION SYSTEM
-- Templates, Email, WhatsApp, Deduplicated Notifications, Customer Timeline,
-- Event-Driven Automation Bus, Security & RLS
-- Migration ID: 20261008040000
-- ==============================================================================

-- 1. Enhance Communication Messages Table
DO $$
BEGIN
    -- Update status constraint to allow lowercase and 'opened'
    ALTER TABLE public.communication_messages DROP CONSTRAINT IF EXISTS communication_messages_status_check;
    ALTER TABLE public.communication_messages ADD CONSTRAINT communication_messages_status_check
        CHECK (status IN ('queued', 'sent', 'delivered', 'failed', 'opened', 'Queued', 'Sent', 'Delivered', 'Failed', 'Opened'));

    -- Add opened_at if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'communication_messages' AND column_name = 'opened_at') THEN
        ALTER TABLE public.communication_messages ADD COLUMN opened_at TIMESTAMPTZ;
    END IF;

    -- Add task_id if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'communication_messages' AND column_name = 'task_id') THEN
        ALTER TABLE public.communication_messages ADD COLUMN task_id UUID;
    END IF;

    -- Add inquiry_id if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'communication_messages' AND column_name = 'inquiry_id') THEN
        ALTER TABLE public.communication_messages ADD COLUMN inquiry_id UUID;
    END IF;
END $$;

-- 2. Enhance Staff Notifications Table
DO $$
BEGIN
    ALTER TABLE public.staff_notifications DROP CONSTRAINT IF EXISTS staff_notifications_category_check;
    ALTER TABLE public.staff_notifications ADD CONSTRAINT staff_notifications_category_check
        CHECK (category IN (
            'new_booking',
            'new_inquiry',
            'new_payment',
            'payment_overdue',
            'new_lead',
            'followup_due',
            'task_overdue',
            'departure_unassigned',
            'pickup_pending',
            'document_expiring',
            'cancellation',
            'new_review',
            'operational_issue',
            'payment_pending'
        ));
END $$;

-- 3. Create Automation Events Table (Event-Driven Architecture)
CREATE TABLE IF NOT EXISTS public.automation_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_name TEXT NOT NULL CHECK (event_name IN (
        'booking.created',
        'booking.updated',
        'payment.received',
        'payment.failed',
        'booking.cancelled',
        'departure.tomorrow',
        'followup.due'
    )),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    entity_type TEXT, -- 'booking', 'payment', 'departure', 'lead', 'task'
    entity_id TEXT,
    processed BOOLEAN NOT NULL DEFAULT FALSE,
    processed_at TIMESTAMPTZ,
    actions_triggered JSONB DEFAULT '[]'::jsonb,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auto_events_name ON public.automation_events(event_name);
CREATE INDEX IF NOT EXISTS idx_auto_events_processed ON public.automation_events(processed, created_at);
CREATE INDEX IF NOT EXISTS idx_auto_events_entity ON public.automation_events(entity_type, entity_id);

-- RLS for automation events
ALTER TABLE public.automation_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can manage automation events" ON public.automation_events;
CREATE POLICY "Staff can manage automation events" ON public.automation_events
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Customers can view their own communication messages
DROP POLICY IF EXISTS "Customers can view their own communication messages" ON public.communication_messages;
CREATE POLICY "Customers can view their own communication messages" ON public.communication_messages
    FOR SELECT TO authenticated
    USING (
        customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid()) OR
        public.is_admin()
    );
