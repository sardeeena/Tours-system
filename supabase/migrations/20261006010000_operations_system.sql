-- ==============================================================================
-- MIGRATION: OPERATIONS SYSTEM (DEPARTURES, ASSIGNMENTS, MANIFESTS, FLEET)
-- ==============================================================================

-- 1. Daily Operational Tour Assignments
CREATE TABLE IF NOT EXISTS public.operational_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tour_id UUID NOT NULL REFERENCES public.tours(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    departure_time TEXT NOT NULL DEFAULT '08:30',
    vessel_id UUID REFERENCES public.vessels(id) ON DELETE SET NULL,
    guide_id UUID REFERENCES public.guides(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'Scheduled' CHECK (status IN ('Scheduled', 'Preparing', 'Ready', 'Departed', 'Completed', 'Cancelled')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tour_id, date, departure_time)
);

CREATE INDEX IF NOT EXISTS idx_op_assign_date ON public.operational_assignments(date);
CREATE INDEX IF NOT EXISTS idx_op_assign_tour ON public.operational_assignments(tour_id);
CREATE INDEX IF NOT EXISTS idx_op_assign_vessel ON public.operational_assignments(vessel_id);
CREATE INDEX IF NOT EXISTS idx_op_assign_guide ON public.operational_assignments(guide_id);

-- 2. Extend Bookings with Operational Real-Time Dispatch Fields
ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS operational_status TEXT DEFAULT 'Scheduled',
    ADD COLUMN IF NOT EXISTS pickup_status TEXT DEFAULT 'Waiting',
    ADD COLUMN IF NOT EXISTS pickup_time TEXT,
    ADD COLUMN IF NOT EXISTS driver_vehicle TEXT,
    ADD COLUMN IF NOT EXISTS assigned_vessel_id UUID REFERENCES public.vessels(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS assigned_guide_id UUID REFERENCES public.guides(id) ON DELETE SET NULL;

-- 3. Extend Booking Passengers with Manifest Requirements
ALTER TABLE public.booking_passengers
    ADD COLUMN IF NOT EXISTS date_of_birth DATE,
    ADD COLUMN IF NOT EXISTS gender TEXT,
    ADD COLUMN IF NOT EXISTS phone TEXT,
    ADD COLUMN IF NOT EXISTS special_requests TEXT,
    ADD COLUMN IF NOT EXISTS pickup_location TEXT;

-- 4. Enable RLS
ALTER TABLE public.operational_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can manage operational assignments" ON public.operational_assignments;
CREATE POLICY "Staff can manage operational assignments"
    ON public.operational_assignments FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- Ensure vessels, guides, and weather_bulletins have RLS policies
ALTER TABLE public.vessels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weather_bulletins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active vessels" ON public.vessels;
CREATE POLICY "Anyone can view active vessels" ON public.vessels
    FOR SELECT TO public USING (is_active = true OR public.is_admin());

DROP POLICY IF EXISTS "Staff can manage vessels" ON public.vessels;
CREATE POLICY "Staff can manage vessels" ON public.vessels
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Anyone can view active guides" ON public.guides;
CREATE POLICY "Anyone can view active guides" ON public.guides
    FOR SELECT TO public USING (is_active = true OR public.is_admin());

DROP POLICY IF EXISTS "Staff can manage guides" ON public.guides;
CREATE POLICY "Staff can manage guides" ON public.guides
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Anyone can read weather bulletins" ON public.weather_bulletins;
CREATE POLICY "Anyone can read weather bulletins" ON public.weather_bulletins
    FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Staff can manage weather bulletins" ON public.weather_bulletins;
CREATE POLICY "Staff can manage weather bulletins" ON public.weather_bulletins
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
