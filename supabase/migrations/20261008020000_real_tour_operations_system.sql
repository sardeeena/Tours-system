-- ==============================================================================
-- MIGRATION: PRODUCTION TOUR OPERATIONS MANAGEMENT SYSTEM
-- Departures, Calendar, Manifests, Pickups, Vessels, Staff, Assignments, Weather
-- Migration ID: 20261008020000
-- ==============================================================================

-- 1. DEPARTURES TABLE (First-class Scheduled Tour Departures)
CREATE TABLE IF NOT EXISTS public.departures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tour_id UUID NOT NULL REFERENCES public.tours(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    start_time TEXT NOT NULL DEFAULT '08:30',
    end_time TEXT NOT NULL DEFAULT '16:30',
    capacity INT NOT NULL DEFAULT 35,
    booked_passengers INT NOT NULL DEFAULT 0,
    remaining_capacity INT NOT NULL DEFAULT 35,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (
        status IN ('scheduled', 'confirmed', 'boarding', 'in_progress', 'completed', 'cancelled')
    ),
    guide_id UUID REFERENCES public.guides(id) ON DELETE SET NULL,
    vessel_id UUID REFERENCES public.vessels(id) ON DELETE SET NULL,
    captain_id UUID REFERENCES public.guides(id) ON DELETE SET NULL,
    driver_id UUID REFERENCES public.guides(id) ON DELETE SET NULL,
    driver_name TEXT,
    vehicle_name TEXT,
    crew_ids UUID[] DEFAULT ARRAY[]::UUID[],
    notes TEXT,
    weather_status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tour_id, date, start_time)
);

CREATE INDEX IF NOT EXISTS idx_departures_date ON public.departures(date);
CREATE INDEX IF NOT EXISTS idx_departures_tour ON public.departures(tour_id);
CREATE INDEX IF NOT EXISTS idx_departures_vessel ON public.departures(vessel_id);
CREATE INDEX IF NOT EXISTS idx_departures_guide ON public.departures(guide_id);
CREATE INDEX IF NOT EXISTS idx_departures_status ON public.departures(status);

DROP TRIGGER IF EXISTS trigger_departures_updated_at ON public.departures;
CREATE TRIGGER trigger_departures_updated_at
    BEFORE UPDATE ON public.departures
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 2. EXTEND VESSELS TABLE WITH MAINTENANCE, STATUS, AND CREW
ALTER TABLE public.vessels
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS maintenance_notes TEXT,
    ADD COLUMN IF NOT EXISTS next_maintenance DATE,
    ADD COLUMN IF NOT EXISTS crew TEXT;

-- Normalize existing vessel status values
UPDATE public.vessels SET status = 'active' WHERE status IS NULL OR status = '';

-- 3. EXTEND GUIDES / OPERATIONAL STAFF TABLE
-- Update check constraint on role to allow guide, captain, driver, crew, photographer, other, etc.
ALTER TABLE public.guides DROP CONSTRAINT IF EXISTS guides_role_check;
ALTER TABLE public.guides ADD CONSTRAINT guides_role_check CHECK (
    role IN (
        'guide', 'tour_guide', 'captain', 'driver', 'crew', 'photographer',
        'dive_master', 'snorkel_guide', 'safari_lead', 'other'
    )
);

ALTER TABLE public.guides
    ADD COLUMN IF NOT EXISTS availability_status TEXT DEFAULT 'available',
    ADD COLUMN IF NOT EXISTS notes TEXT;

-- 4. PICKUP SCHEDULES / BOARD TABLE
CREATE TABLE IF NOT EXISTS public.pickup_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
    booking_reference TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    hotel TEXT NOT NULL,
    location TEXT NOT NULL DEFAULT 'Hurghada',
    pickup_time TEXT NOT NULL DEFAULT '07:30',
    driver_id UUID REFERENCES public.guides(id) ON DELETE SET NULL,
    driver_name TEXT,
    vehicle TEXT,
    passenger_count INT NOT NULL DEFAULT 1,
    departure_id UUID REFERENCES public.departures(id) ON DELETE SET NULL,
    tour_title TEXT,
    tour_date DATE NOT NULL DEFAULT CURRENT_DATE,
    departure_time TEXT DEFAULT '08:30',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (
        status IN ('pending', 'confirmed', 'picked_up', 'no_show', 'cancelled')
    ),
    special_requests TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pickups_date ON public.pickup_schedules(tour_date);
CREATE INDEX IF NOT EXISTS idx_pickups_status ON public.pickup_schedules(status);
CREATE INDEX IF NOT EXISTS idx_pickups_booking ON public.pickup_schedules(booking_reference);
CREATE INDEX IF NOT EXISTS idx_pickups_driver ON public.pickup_schedules(driver_id);

DROP TRIGGER IF EXISTS trigger_pickup_schedules_updated_at ON public.pickup_schedules;
CREATE TRIGGER trigger_pickup_schedules_updated_at
    BEFORE UPDATE ON public.pickup_schedules
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 5. WEATHER BULLETINS ENHANCEMENTS
ALTER TABLE public.weather_bulletins
    ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'open-meteo',
    ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS raw_data JSONB;

-- 6. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.departures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pickup_schedules ENABLE ROW LEVEL SECURITY;

-- Departures RLS
DROP POLICY IF EXISTS "Public can view departures" ON public.departures;
CREATE POLICY "Public can view departures" ON public.departures
    FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Staff can manage departures" ON public.departures;
CREATE POLICY "Staff can manage departures" ON public.departures
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Pickup schedules RLS
DROP POLICY IF EXISTS "Staff can manage pickup schedules" ON public.pickup_schedules;
CREATE POLICY "Staff can manage pickup schedules" ON public.pickup_schedules
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 7. INITIAL FLEET & STAFF SEED DATA (IF EMPTY)
INSERT INTO public.vessels (id, name, vessel_type, registration_number, port_marina, passenger_capacity, crew_capacity, year_built, safety_inspection_expiry, amenities, is_active, status, maintenance_notes, next_maintenance, crew)
VALUES
    ('c0000001-0000-0000-0000-000000000001', 'M/Y Red Sea Star VIP', 'motor_yacht', 'HUR-8841-VIP', 'Hurghada Marina', 45, 5, 2021, '2027-04-15', ARRAY['Air Conditioning', 'Sundeck with loungers', 'VIP Dining Saloon', 'Snorkel Gear Deck', 'Freshwater Showers'], TRUE, 'active', 'Regular monthly engine maintenance completed.', '2026-11-15', 'Captain Tarek + 3 Marine Crew'),
    ('c0000001-0000-0000-0000-000000000002', 'Dolphin Express II', 'speedboat', 'HUR-3209-SPD', 'Hurghada Marina', 12, 2, 2023, '2027-08-20', ARRAY['Twin 300HP Yamaha Engines', 'Bluetooth Marine Audio', 'Canopy Shade', 'Safety Life Vests'], TRUE, 'active', 'Hull cleaned and inspected.', '2026-12-01', 'Captain Farouk + 1 Deckhand'),
    ('c0000001-0000-0000-0000-000000000003', 'Blue Horizon Catamaran', 'catamaran', 'ELG-5512-CAT', 'Abu Tig Marina, El Gouna', 35, 4, 2020, '2027-06-01', ARRAY['Trampoline Netting', 'Full Bar', 'Sound System', 'Snorkeling Platform'], TRUE, 'active', 'Sails inspected; rigging verified.', '2026-11-20', 'Captain Nabil + 2 Stewards'),
    ('c0000001-0000-0000-0000-000000000004', 'Submarine Coral Explorer', 'semi_submarine', 'MAK-1104-SUB', 'Makadi Bay Jetty', 30, 3, 2022, '2027-05-10', ARRAY['Panoramic Underwater Windows', 'Reef Identification Charts', 'Air-Conditioned Observation Hull'], TRUE, 'active', 'Sub-surface glass seals certified watertight.', '2026-12-10', 'Captain Hossam + 1 Marine Biologist')
ON CONFLICT (id) DO UPDATE SET
    status = EXCLUDED.status,
    maintenance_notes = EXCLUDED.maintenance_notes,
    next_maintenance = EXCLUDED.next_maintenance,
    crew = EXCLUDED.crew;

INSERT INTO public.guides (id, full_name, role, languages, phone, email, license_number, rating, is_active, availability_status, notes)
VALUES
    ('d0000001-0000-0000-0000-000000000001', 'Captain Tarek Mansour', 'captain', ARRAY['Arabic', 'English', 'German'], '+20 100 456 7891', 'captain.tarek@redseavoyages.com', 'EGY-MAR-MASTER-8842', 4.95, TRUE, 'available', 'Senior Yacht Master with 15+ years Red Sea navigation.'),
    ('d0000001-0000-0000-0000-000000000002', 'Captain Farouk El-Sayed', 'captain', ARRAY['Arabic', 'English', 'Russian'], '+20 100 123 4567', 'captain.farouk@redseavoyages.com', 'EGY-MAR-MASTER-7210', 5.00, TRUE, 'available', 'Speedboat and marine rescue certified.'),
    ('d0000001-0000-0000-0000-000000000003', 'Youssef Al-Bahr', 'dive_master', ARRAY['English', 'German', 'French', 'Arabic'], '+20 111 889 9001', 'youssef.diving@redseavoyages.com', 'PADI-DM-491023', 4.90, TRUE, 'available', 'PADI Master Scuba Diver Trainer; reef conservation expert.'),
    ('d0000001-0000-0000-0000-000000000004', 'Mona Zaki', 'guide', ARRAY['English', 'Italian', 'Russian', 'Arabic'], '+20 102 334 5566', 'mona.guide@redseavoyages.com', 'EGY-TOUR-GUIDE-3391', 4.98, TRUE, 'available', 'Ministry of Tourism licensed guide; Egyptology specialist.'),
    ('d0000001-0000-0000-0000-000000000005', 'Mahmoud Hassan', 'driver', ARRAY['Arabic', 'English'], '+20 101 223 4455', 'mahmoud.driver@redseavoyages.com', 'EGY-COMM-DRV-4412', 4.92, TRUE, 'available', 'Air-conditioned Mercedes Sprinter VIP transfer driver.'),
    ('d0000001-0000-0000-0000-000000000006', 'Karim Bedouin', 'crew', ARRAY['Arabic', 'English', 'German'], '+20 122 778 9911', 'karim.crew@redseavoyages.com', 'EGY-MAR-CREW-0981', 4.88, TRUE, 'available', 'Marine deckhand and first aid responder.')
ON CONFLICT (id) DO UPDATE SET
    availability_status = EXCLUDED.availability_status,
    notes = EXCLUDED.notes;
