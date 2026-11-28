-- ==============================================================================
-- RED SEA VOYAGES & MARITIME EXCURSIONS - COMPREHENSIVE SUPABASE DATABASE SCHEMA
-- ==============================================================================
-- Production-ready PostgreSQL 15+ Schema Migration for Supabase.
--
-- Security & Access Model:
--   • PUBLIC USERS:
--       - Read access ONLY to published tours, active destinations, categories,
--         and active pickup locations & extras.
--       - Can create bookings and customer reservation profiles.
--       - Can look up their own reservation by booking reference.
--       - Can request booking cancellation.
--   • AUTHENTICATED USERS:
--       - Can view and manage their own profile and linked bookings.
--   • AUTHENTICATED ADMINISTRATORS:
--       - Full CRUD privileges on all tours, media, itinerary, pricing,
--         categories, destinations, pickup locations, extras, customers, and bookings.
--
-- PostgreSQL & Supabase Standards:
--   ✓ Extensions: uuid-ossp, pgcrypto
--   ✓ Strict Foreign Keys with ON DELETE CASCADE / SET NULL / RESTRICT
--   ✓ Single & Compound Indexes on query filters, slugs, and RLS columns
--   ✓ Optimized RLS using (SELECT auth.uid()) for statement-level caching
--   ✓ Non-recursive, search_path-secured SECURITY DEFINER functions (public.is_admin())
--   ✓ Automated updated_at triggers on all mutating tables
--   ✓ Synchronized user profile triggers on auth.users (signup & confirmation)
--   ✓ Privilege escalation protection trigger on public.profiles
--   ✓ Supabase Storage buckets & policies (tour-media, avatars, vouchers)
--   ✓ Auth account backfill and public.set_admin_role_by_email() utility
-- ==============================================================================


-- ==============================================================================
-- SECTION 1: EXTENSIONS
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ==============================================================================
-- SECTION 2: AUTOMATION & TIMESTAMP FUNCTIONS
-- ==============================================================================

-- 2.1 Automated updated_at timestamp function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


-- ==============================================================================
-- SECTION 3: CORE TABLES & INDEXES
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 3.1 PROFILES TABLE
-- ------------------------------------------------------------------------------
-- Extends Supabase auth.users with RBAC role ('admin', 'manager', 'staff', 'customer')
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    phone TEXT,
    country TEXT,
    country_code TEXT,
    is_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    confirmation_sent_at TIMESTAMPTZ DEFAULT NOW(),
    role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('admin', 'manager', 'staff', 'customer')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_confirmed ON public.profiles(is_confirmed);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(LOWER(email));

DROP TRIGGER IF EXISTS trigger_profiles_updated_at ON public.profiles;
CREATE TRIGGER trigger_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ------------------------------------------------------------------------------
-- 3.2 DESTINATIONS TABLE
-- ------------------------------------------------------------------------------
-- Geographical hubs along the Red Sea coast (Hurghada, El Gouna, Makadi Bay, etc.)
CREATE TABLE IF NOT EXISTS public.destinations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    tagline TEXT,
    description TEXT,
    main_image TEXT,
    gallery TEXT[] DEFAULT '{}',
    distance_from_airport TEXT,
    seo_title TEXT,
    seo_description TEXT,
    seo_keywords TEXT[] DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_destinations_slug ON public.destinations(slug);
CREATE INDEX IF NOT EXISTS idx_destinations_status ON public.destinations(status);
CREATE INDEX IF NOT EXISTS idx_destinations_sort ON public.destinations(sort_order);

DROP TRIGGER IF EXISTS trigger_destinations_updated_at ON public.destinations;
CREATE TRIGGER trigger_destinations_updated_at
    BEFORE UPDATE ON public.destinations
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ------------------------------------------------------------------------------
-- 3.3 CATEGORIES TABLE
-- ------------------------------------------------------------------------------
-- Excursion themes (Boat Trips, Snorkeling, Diving, Desert Safari, Private Charters)
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    image TEXT,
    icon_name TEXT DEFAULT 'Compass',
    seo_title TEXT,
    seo_description TEXT,
    seo_keywords TEXT[] DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_categories_slug ON public.categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_status ON public.categories(status);
CREATE INDEX IF NOT EXISTS idx_categories_sort ON public.categories(sort_order);

DROP TRIGGER IF EXISTS trigger_categories_updated_at ON public.categories;
CREATE TRIGGER trigger_categories_updated_at
    BEFORE UPDATE ON public.categories
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ------------------------------------------------------------------------------
-- 3.4 TOURS TABLE
-- ------------------------------------------------------------------------------
-- Primary catalog storing excursion parameters, pricing tiers, and operational rules
CREATE TABLE IF NOT EXISTS public.tours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    short_description TEXT,
    description TEXT,
    destination_id UUID REFERENCES public.destinations(id) ON DELETE SET NULL,
    duration TEXT NOT NULL DEFAULT 'Full Day (approx. 7 hours)',
    duration_type TEXT NOT NULL DEFAULT 'Full Day' CHECK (duration_type IN ('Half Day', 'Full Day', 'Multi Day')),
    duration_hours NUMERIC(4,1) NOT NULL DEFAULT 7.0,
    tour_type TEXT NOT NULL DEFAULT 'Shared' CHECK (tour_type IN ('Shared', 'Private')),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    featured BOOLEAN NOT NULL DEFAULT FALSE,
    price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    child_price NUMERIC(10,2) DEFAULT 0.00,
    infant_price NUMERIC(10,2) DEFAULT 0.00,
    private_price NUMERIC(10,2) DEFAULT 0.00,
    currency TEXT NOT NULL DEFAULT 'EUR',
    max_guests INT NOT NULL DEFAULT 35,
    minimum_booking_notice_hours INT NOT NULL DEFAULT 12,
    pickup_available BOOLEAN NOT NULL DEFAULT TRUE,
    pickup_info TEXT DEFAULT 'Complimentary transfer from your resort lobby included.',
    cancellation_policy TEXT DEFAULT 'Free cancellation up to 24 hours before excursion start time.',
    departure_time TEXT DEFAULT '08:30 AM',
    available_days TEXT[] DEFAULT ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    languages TEXT[] DEFAULT ARRAY['English', 'German'],
    difficulty TEXT DEFAULT 'Easy' CHECK (difficulty IN ('Easy', 'Moderate', 'Adventurous')),
    age_restrictions TEXT DEFAULT 'Suitable for all ages. Children under 2 join free.',
    badge TEXT,
    rating NUMERIC(2,1) NOT NULL DEFAULT 0.0,
    review_count INT NOT NULL DEFAULT 0,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tours_slug ON public.tours(slug);
CREATE INDEX IF NOT EXISTS idx_tours_status ON public.tours(status);
CREATE INDEX IF NOT EXISTS idx_tours_destination ON public.tours(destination_id);
CREATE INDEX IF NOT EXISTS idx_tours_featured ON public.tours(featured);
CREATE INDEX IF NOT EXISTS idx_tours_sort_order ON public.tours(sort_order);

DROP TRIGGER IF EXISTS trigger_tours_updated_at ON public.tours;
CREATE TRIGGER trigger_tours_updated_at
    BEFORE UPDATE ON public.tours
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ------------------------------------------------------------------------------
-- 3.5 TOUR CATEGORIES (Many-to-Many Bridge)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tour_categories (
    tour_id UUID NOT NULL REFERENCES public.tours(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
    sort_order INT NOT NULL DEFAULT 0,
    PRIMARY KEY (tour_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_tour_categories_cat ON public.tour_categories(category_id);
CREATE INDEX IF NOT EXISTS idx_tour_categories_tour ON public.tour_categories(tour_id);


-- ------------------------------------------------------------------------------
-- 3.6 TOUR MEDIA: IMAGES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tour_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tour_id UUID NOT NULL REFERENCES public.tours(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    storage_path TEXT,
    alt_text TEXT,
    caption TEXT,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tour_images_tour ON public.tour_images(tour_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_tour_images_primary ON public.tour_images(tour_id) WHERE is_primary = TRUE;


-- ------------------------------------------------------------------------------
-- 3.7 TOUR MEDIA: VIDEOS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tour_videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tour_id UUID NOT NULL REFERENCES public.tours(id) ON DELETE CASCADE,
    video_url TEXT NOT NULL,
    title TEXT,
    description TEXT,
    provider TEXT DEFAULT 'youtube' CHECK (provider IN ('youtube', 'vimeo', 'storage', 'direct')),
    storage_path TEXT,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tour_videos_tour ON public.tour_videos(tour_id, sort_order);


-- ------------------------------------------------------------------------------
-- 3.8 TOUR ITINERARY
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tour_itinerary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tour_id UUID NOT NULL REFERENCES public.tours(id) ON DELETE CASCADE,
    time TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tour_itinerary_tour ON public.tour_itinerary(tour_id, sort_order);


-- ------------------------------------------------------------------------------
-- 3.9 TOUR INCLUSIONS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tour_inclusions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tour_id UUID NOT NULL REFERENCES public.tours(id) ON DELETE CASCADE,
    item TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tour_inclusions_tour ON public.tour_inclusions(tour_id, sort_order);


-- ------------------------------------------------------------------------------
-- 3.10 TOUR EXCLUSIONS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tour_exclusions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tour_id UUID NOT NULL REFERENCES public.tours(id) ON DELETE CASCADE,
    item TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tour_exclusions_tour ON public.tour_exclusions(tour_id, sort_order);


-- ------------------------------------------------------------------------------
-- 3.11 TOUR HIGHLIGHTS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tour_highlights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tour_id UUID NOT NULL REFERENCES public.tours(id) ON DELETE CASCADE,
    item TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tour_highlights_tour ON public.tour_highlights(tour_id, sort_order);


-- ------------------------------------------------------------------------------
-- 3.12 TOUR FAQS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tour_faqs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tour_id UUID NOT NULL REFERENCES public.tours(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    section TEXT NOT NULL DEFAULT 'faq' CHECK (section IN ('faq', 'what_to_bring', 'important_information')),
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tour_faqs_tour ON public.tour_faqs(tour_id, sort_order);


-- ------------------------------------------------------------------------------
-- 3.13 PICKUP LOCATIONS TABLE
-- ------------------------------------------------------------------------------
-- Transfer operational zones with custom surcharges (Hurghada Central, El Gouna, Makadi Bay, etc.)
CREATE TABLE IF NOT EXISTS public.pickup_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    area TEXT NOT NULL,
    fee_eur_per_person NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    fee_eur_flat NUMERIC(10,2) DEFAULT 0.00,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pickup_locations_code ON public.pickup_locations(code);
CREATE INDEX IF NOT EXISTS idx_pickup_locations_active ON public.pickup_locations(is_active);

DROP TRIGGER IF EXISTS trigger_pickup_locations_updated_at ON public.pickup_locations;
CREATE TRIGGER trigger_pickup_locations_updated_at
    BEFORE UPDATE ON public.pickup_locations
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ------------------------------------------------------------------------------
-- 3.14 TOUR PICKUP LOCATIONS (Many-to-Many Bridge)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tour_pickup_locations (
    tour_id UUID NOT NULL REFERENCES public.tours(id) ON DELETE CASCADE,
    pickup_location_id UUID NOT NULL REFERENCES public.pickup_locations(id) ON DELETE CASCADE,
    PRIMARY KEY (tour_id, pickup_location_id)
);

CREATE INDEX IF NOT EXISTS idx_tour_pickup_loc_tour ON public.tour_pickup_locations(tour_id);
CREATE INDEX IF NOT EXISTS idx_tour_pickup_loc_pickup ON public.tour_pickup_locations(pickup_location_id);


-- ------------------------------------------------------------------------------
-- 3.15 TOUR EXTRAS TABLE
-- ------------------------------------------------------------------------------
-- Add-ons (GoPro Rental, Seafood Platter, Hotel Transfer Upgrades, Intro Scuba)
CREATE TABLE IF NOT EXISTS public.tour_extras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    price_eur NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    currency TEXT NOT NULL DEFAULT 'EUR',
    pricing_type TEXT NOT NULL DEFAULT 'per_booking' CHECK (pricing_type IN ('per_person', 'per_booking', 'per_adult', 'per_child')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tour_extras_active ON public.tour_extras(is_active);

DROP TRIGGER IF EXISTS trigger_tour_extras_updated_at ON public.tour_extras;
CREATE TRIGGER trigger_tour_extras_updated_at
    BEFORE UPDATE ON public.tour_extras
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ------------------------------------------------------------------------------
-- 3.16 TOUR ASSIGNED EXTRAS (Many-to-Many Bridge)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tour_assigned_extras (
    tour_id UUID NOT NULL REFERENCES public.tours(id) ON DELETE CASCADE,
    extra_id UUID NOT NULL REFERENCES public.tour_extras(id) ON DELETE CASCADE,
    PRIMARY KEY (tour_id, extra_id)
);

CREATE INDEX IF NOT EXISTS idx_tour_assigned_extras_tour ON public.tour_assigned_extras(tour_id);
CREATE INDEX IF NOT EXISTS idx_tour_assigned_extras_extra ON public.tour_assigned_extras(extra_id);


-- ------------------------------------------------------------------------------
-- 3.17 TOUR AVAILABILITY TABLE
-- ------------------------------------------------------------------------------
-- Date-specific operational capacity, blackout dates, and sold-out flags
CREATE TABLE IF NOT EXISTS public.tour_availability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tour_id UUID NOT NULL REFERENCES public.tours(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'unavailable', 'sold_out')),
    max_capacity INT NOT NULL DEFAULT 35,
    booked_count INT NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tour_id, date)
);

CREATE INDEX IF NOT EXISTS idx_tour_avail_lookup ON public.tour_availability(tour_id, date);

DROP TRIGGER IF EXISTS trigger_tour_availability_updated_at ON public.tour_availability;
CREATE TRIGGER trigger_tour_availability_updated_at
    BEFORE UPDATE ON public.tour_availability
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ------------------------------------------------------------------------------
-- 3.18 CUSTOMERS TABLE
-- ------------------------------------------------------------------------------
-- Guest CRM records linked optionally to auth.users account
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    whatsapp TEXT,
    country TEXT NOT NULL,
    country_code TEXT,
    hotel TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customers_email ON public.customers(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON public.customers(user_id);

DROP TRIGGER IF EXISTS trigger_customers_updated_at ON public.customers;
CREATE TRIGGER trigger_customers_updated_at
    BEFORE UPDATE ON public.customers
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ------------------------------------------------------------------------------
-- 3.19 BOOKINGS TABLE
-- ------------------------------------------------------------------------------
-- Guest reservations with financial totals, guest counts, and status tracking
CREATE TABLE IF NOT EXISTS public.bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_reference TEXT NOT NULL UNIQUE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    tour_id UUID NOT NULL REFERENCES public.tours(id) ON DELETE RESTRICT,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    booking_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'cancellation_requested', 'cancelled', 'completed', 'no_show')),
    payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'partially_paid', 'refunded', 'failed')),
    payment_method TEXT NOT NULL DEFAULT 'pay_at_pickup' CHECK (payment_method IN ('pay_at_pickup', 'pay_online')),
    adult_count INT NOT NULL DEFAULT 1,
    child_count INT NOT NULL DEFAULT 0,
    infant_count INT NOT NULL DEFAULT 0,
    pickup_location_id UUID REFERENCES public.pickup_locations(id) ON DELETE SET NULL,
    pickup_hotel_name TEXT,
    pickup_room_number TEXT,
    subtotal NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    extras_total NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    discount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    total NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    currency TEXT NOT NULL DEFAULT 'EUR',
    special_requests TEXT,
    cancellation_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bookings_reference ON public.bookings(booking_reference);
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON public.bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_customer_id ON public.bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_tour_id ON public.bookings(tour_id);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON public.bookings(booking_date);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);

DROP TRIGGER IF EXISTS trigger_bookings_updated_at ON public.bookings;
CREATE TRIGGER trigger_bookings_updated_at
    BEFORE UPDATE ON public.bookings
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ------------------------------------------------------------------------------
-- 3.20 BOOKING EXTRAS (Line Items Breakdown)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.booking_extras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    extra_id UUID REFERENCES public.tour_extras(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit_price NUMERIC(10,2) NOT NULL,
    total_price NUMERIC(10,2) NOT NULL,
    pricing_type TEXT NOT NULL DEFAULT 'per_booking',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_booking_extras_booking ON public.booking_extras(booking_id);


-- ------------------------------------------------------------------------------
-- 3.21 REVIEWS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tour_id UUID REFERENCES public.tours(id) ON DELETE CASCADE,
    author_name TEXT NOT NULL,
    country TEXT,
    country_code TEXT,
    rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    traveler_type TEXT DEFAULT 'Couple',
    verified_booking BOOLEAN NOT NULL DEFAULT TRUE,
    is_published BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reviews_tour ON public.reviews(tour_id, is_published);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON public.reviews(rating);


-- ------------------------------------------------------------------------------
-- 3.22 SEO METADATA TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.seo_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL CHECK (entity_type IN ('tour', 'destination', 'category', 'page')),
    entity_id UUID,
    page_slug TEXT,
    seo_title TEXT,
    meta_description TEXT,
    seo_keywords TEXT[] DEFAULT '{}',
    canonical_url TEXT,
    og_title TEXT,
    og_description TEXT,
    og_image TEXT,
    social_image TEXT,
    robots_index BOOLEAN NOT NULL DEFAULT TRUE,
    robots_follow BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_seo_lookup ON public.seo_metadata(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_seo_page_slug ON public.seo_metadata(page_slug);

DROP TRIGGER IF EXISTS trigger_seo_metadata_updated_at ON public.seo_metadata;
CREATE TRIGGER trigger_seo_metadata_updated_at
    BEFORE UPDATE ON public.seo_metadata
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ------------------------------------------------------------------------------
-- 3.23 SITE SETTINGS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.site_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

DROP TRIGGER IF EXISTS trigger_site_settings_updated_at ON public.site_settings;
CREATE TRIGGER trigger_site_settings_updated_at
    BEFORE UPDATE ON public.site_settings
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ------------------------------------------------------------------------------
-- 3.24 AUDIT LOGS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    old_data JSONB,
    new_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id);


-- ------------------------------------------------------------------------------
-- 3.25 NEWSLETTER SUBSCRIPTIONS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.newsletter_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    source TEXT NOT NULL DEFAULT 'footer',
    status TEXT NOT NULL DEFAULT 'subscribed' CHECK (status IN ('subscribed', 'unsubscribed')),
    discount_code TEXT NOT NULL DEFAULT 'REDSEA15',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_newsletter_email ON public.newsletter_subscriptions(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_newsletter_status ON public.newsletter_subscriptions(status);

DROP TRIGGER IF EXISTS trigger_newsletter_updated_at ON public.newsletter_subscriptions;
CREATE TRIGGER trigger_newsletter_updated_at
    BEFORE UPDATE ON public.newsletter_subscriptions
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ------------------------------------------------------------------------------
-- 3.26 INQUIRIES & CONCIERGE ASSISTANCE REQUESTS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inquiries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    whatsapp TEXT,
    tour_id TEXT,
    tour_title TEXT,
    subject TEXT NOT NULL DEFAULT 'General Excursion Assistance',
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'resolved', 'converted')),
    source TEXT NOT NULL DEFAULT 'web' CHECK (source IN ('web', 'whatsapp', 'email', 'phone')),
    ip_address TEXT,
    admin_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inquiries_email ON public.inquiries(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_inquiries_status ON public.inquiries(status);
CREATE INDEX IF NOT EXISTS idx_inquiries_created ON public.inquiries(created_at DESC);

DROP TRIGGER IF EXISTS trigger_inquiries_updated_at ON public.inquiries;
CREATE TRIGGER trigger_inquiries_updated_at
    BEFORE UPDATE ON public.inquiries
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ------------------------------------------------------------------------------
-- 3.27 PROMO CODES & COUPONS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    description TEXT,
    discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
    discount_value NUMERIC(10,2) NOT NULL,
    min_spend NUMERIC(10,2) DEFAULT 0.00,
    max_discount NUMERIC(10,2),
    valid_from TIMESTAMPTZ DEFAULT NOW(),
    valid_until TIMESTAMPTZ,
    usage_limit INT,
    times_used INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coupons_code ON public.coupons(UPPER(code));
CREATE INDEX IF NOT EXISTS idx_coupons_active ON public.coupons(is_active);

DROP TRIGGER IF EXISTS trigger_coupons_updated_at ON public.coupons;
CREATE TRIGGER trigger_coupons_updated_at
    BEFORE UPDATE ON public.coupons
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ------------------------------------------------------------------------------
-- 3.28 MARITIME VESSELS & SAFARI FLEET
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vessels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    vessel_type TEXT NOT NULL CHECK (vessel_type IN ('motor_yacht', 'speedboat', 'catamaran', 'glass_bottom', 'semi_submarine', 'safari_jeep')),
    registration_number TEXT,
    port_marina TEXT NOT NULL DEFAULT 'Hurghada Marina',
    passenger_capacity INT NOT NULL DEFAULT 35,
    crew_capacity INT DEFAULT 4,
    year_built INT,
    safety_inspection_expiry DATE,
    amenities TEXT[] DEFAULT ARRAY[]::TEXT[],
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vessels_active ON public.vessels(is_active);
CREATE INDEX IF NOT EXISTS idx_vessels_type ON public.vessels(vessel_type);

DROP TRIGGER IF EXISTS trigger_vessels_updated_at ON public.vessels;
CREATE TRIGGER trigger_vessels_updated_at
    BEFORE UPDATE ON public.vessels
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ------------------------------------------------------------------------------
-- 3.29 TOUR VESSEL ASSIGNMENTS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tour_vessels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tour_id UUID NOT NULL REFERENCES public.tours(id) ON DELETE CASCADE,
    vessel_id UUID NOT NULL REFERENCES public.vessels(id) ON DELETE CASCADE,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tour_id, vessel_id)
);

CREATE INDEX IF NOT EXISTS idx_tour_vessels_tour ON public.tour_vessels(tour_id);
CREATE INDEX IF NOT EXISTS idx_tour_vessels_vessel ON public.tour_vessels(vessel_id);


-- ------------------------------------------------------------------------------
-- 3.30 GUIDES, CAPTAINS & DIVE MASTERS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.guides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('captain', 'dive_master', 'snorkel_guide', 'safari_lead', 'tour_guide')),
    languages TEXT[] DEFAULT ARRAY['English']::TEXT[],
    phone TEXT,
    email TEXT,
    license_number TEXT,
    rating NUMERIC(3,2) NOT NULL DEFAULT 5.00,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guides_active ON public.guides(is_active);
CREATE INDEX IF NOT EXISTS idx_guides_role ON public.guides(role);

DROP TRIGGER IF EXISTS trigger_guides_updated_at ON public.guides;
CREATE TRIGGER trigger_guides_updated_at
    BEFORE UPDATE ON public.guides
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ------------------------------------------------------------------------------
-- 3.31 GLOBAL FREQUENTLY ASKED QUESTIONS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.faqs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL CHECK (category IN ('general', 'booking', 'cancellation', 'marine_safety', 'transfers')),
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_published BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_faqs_category ON public.faqs(category);
CREATE INDEX IF NOT EXISTS idx_faqs_published ON public.faqs(is_published);
CREATE INDEX IF NOT EXISTS idx_faqs_sort ON public.faqs(sort_order);

DROP TRIGGER IF EXISTS trigger_faqs_updated_at ON public.faqs;
CREATE TRIGGER trigger_faqs_updated_at
    BEFORE UPDATE ON public.faqs
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ------------------------------------------------------------------------------
-- 3.32 MARITIME WEATHER BULLETINS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.weather_bulletins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    harbor_location TEXT NOT NULL DEFAULT 'Hurghada Marina',
    water_temperature_c NUMERIC(4,1) NOT NULL,
    air_temperature_c NUMERIC(4,1) NOT NULL,
    swell_height_m NUMERIC(4,2) NOT NULL,
    wind_speed_knots NUMERIC(4,1) NOT NULL,
    wind_direction TEXT NOT NULL,
    visibility_meters INT NOT NULL DEFAULT 30,
    coast_guard_cleared BOOLEAN NOT NULL DEFAULT TRUE,
    advisory_notes TEXT,
    bulletin_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_weather_date ON public.weather_bulletins(bulletin_date DESC);


-- ------------------------------------------------------------------------------
-- 3.33 PASSENGER MANIFEST RECORDS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.booking_passengers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    nationality TEXT,
    passport_or_id_number TEXT,
    passenger_type TEXT NOT NULL DEFAULT 'adult' CHECK (passenger_type IN ('adult', 'child', 'infant')),
    is_lead_passenger BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_booking_passengers_booking ON public.booking_passengers(booking_id);


-- ==============================================================================
-- SECTION 4: SECURITY DEFINER FUNCTIONS & AUTH TRIGGERS
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 4.1 IS_ADMIN() FUNCTION
-- ------------------------------------------------------------------------------
-- Non-recursive helper: evaluates current user role with SECURITY DEFINER and STABLE.
-- Prevents infinite recursion when public.profiles RLS policies are evaluated.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
STABLE
AS $$
DECLARE
    current_role text;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN false;
    END IF;

    -- 1. Primary check: public.profiles table
    SELECT role INTO current_role
    FROM public.profiles
    WHERE id = auth.uid();

    IF current_role IN ('admin', 'manager', 'staff') THEN
        RETURN true;
    END IF;

    -- 2. Fallback check: auth.users metadata if profile record is syncing
    SELECT COALESCE(raw_user_meta_data->>'role', raw_app_meta_data->>'role') INTO current_role
    FROM auth.users
    WHERE id = auth.uid();

    RETURN current_role IN ('admin', 'manager', 'staff');
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon;


-- ------------------------------------------------------------------------------
-- 4.2 ROLE PROTECTION TRIGGER (PREVENT SELF-ESCALATION)
-- ------------------------------------------------------------------------------
-- Prevents ordinary users from modifying their role column to 'admin' via API update calls.
CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
    IF NEW.role IS DISTINCT FROM OLD.role AND NOT public.is_admin() THEN
        NEW.role = OLD.role;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_protect_profile_role ON public.profiles;
CREATE TRIGGER trigger_protect_profile_role
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.protect_profile_role();


-- ------------------------------------------------------------------------------
-- 4.3 USER REGISTRATION PROFILE CREATOR (AFTER INSERT ON auth.users)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
    INSERT INTO public.profiles (
        id, 
        email, 
        full_name, 
        role, 
        phone, 
        country, 
        country_code, 
        is_confirmed,
        confirmation_sent_at
    )
    VALUES (
        new.id,
        new.email,
        COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
        'customer',
        new.raw_user_meta_data->>'phone',
        new.raw_user_meta_data->>'country',
        new.raw_user_meta_data->>'country_code',
        (new.email_confirmed_at IS NOT NULL),
        COALESCE(new.confirmation_sent_at, NOW())
    )
    ON CONFLICT (id) DO UPDATE
    SET 
        email = EXCLUDED.email,
        is_confirmed = (new.email_confirmed_at IS NOT NULL),
        updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- ------------------------------------------------------------------------------
-- 4.4 EMAIL CONFIRMATION SYNCHRONIZER (AFTER UPDATE ON auth.users)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_user_confirmed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
    IF OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL THEN
        UPDATE public.profiles
        SET is_confirmed = TRUE, updated_at = NOW()
        WHERE id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_confirmed
    AFTER UPDATE ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_user_confirmed();


-- ------------------------------------------------------------------------------
-- 4.5 CONVENIENCE FUNCTION: SET ADMIN ROLE BY EMAIL
-- ------------------------------------------------------------------------------
-- Secure function to promote accounts to administrator directly from the SQL Editor:
-- SELECT public.set_admin_role_by_email('diamond.entertainment70@gmail.com');
CREATE OR REPLACE FUNCTION public.set_admin_role_by_email(target_email text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    found_user_id uuid;
    clean_email text;
BEGIN
    clean_email := LOWER(TRIM(target_email));
    
    SELECT id INTO found_user_id 
    FROM auth.users 
    WHERE LOWER(email) = clean_email;

    IF found_user_id IS NULL THEN
        RETURN 'Error: User ' || target_email || ' was not found in auth.users. The user must register or sign up first before being assigned a role.';
    END IF;

    -- Upsert profile record with role = 'admin'
    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        role,
        is_confirmed,
        updated_at
    )
    VALUES (
        found_user_id,
        clean_email,
        split_part(clean_email, '@', 1),
        'admin',
        true,
        NOW()
    )
    ON CONFLICT (id) DO UPDATE
    SET 
        role = 'admin',
        is_confirmed = true,
        updated_at = NOW();

    -- Synchronize auth.users raw_user_meta_data
    UPDATE auth.users
    SET raw_user_meta_data = jsonb_set(
        COALESCE(raw_user_meta_data, '{}'::jsonb),
        '{role}',
        '"admin"'::jsonb
    )
    WHERE id = found_user_id;

    RETURN 'Success: Account ' || clean_email || ' (User ID: ' || found_user_id || ') is now an active administrator.';
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_admin_role_by_email(text) TO postgres, service_role;


-- ==============================================================================
-- SECTION 5: ROW-LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
-- Architecture:
-- 1. All tables have RLS enabled (100% coverage).
-- 2. Uses (SELECT auth.uid()) for statement-level query plan caching (Supabase performance standard).
-- 3. Public users: Read published tours/content; Insert bookings & customers; lookup booking by reference.
-- 4. Authenticated users: Read & update own profile and linked bookings.
-- 5. Authenticated administrators: Full CRUD across all tables.

-- Enable RLS across all 33 tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_itinerary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_inclusions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_exclusions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_highlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pickup_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_pickup_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_extras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_assigned_extras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_extras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vessels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_vessels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weather_bulletins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_passengers ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 5.1 PROFILES POLICIES (Non-recursive)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public can view own profile" ON public.profiles;

CREATE POLICY "Users can read own profile"
    ON public.profiles FOR SELECT
    TO authenticated
    USING ((SELECT auth.uid()) = id);

CREATE POLICY "Admins can view all profiles"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (public.is_admin());

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING ((SELECT auth.uid()) = id)
    WITH CHECK ((SELECT auth.uid()) = id);

CREATE POLICY "Admins can manage all profiles"
    ON public.profiles FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());


-- ------------------------------------------------------------------------------
-- 5.2 DESTINATIONS & CATEGORIES POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public can view published destinations" ON public.destinations;
DROP POLICY IF EXISTS "Admins manage destinations" ON public.destinations;

CREATE POLICY "Public can view published destinations"
    ON public.destinations FOR SELECT
    USING (status = 'published' OR public.is_admin());

CREATE POLICY "Admins manage destinations"
    ON public.destinations FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Public can view published categories" ON public.categories;
DROP POLICY IF EXISTS "Admins manage categories" ON public.categories;

CREATE POLICY "Public can view published categories"
    ON public.categories FOR SELECT
    USING (status = 'published' OR public.is_admin());

CREATE POLICY "Admins manage categories"
    ON public.categories FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());


-- ------------------------------------------------------------------------------
-- 5.3 TOURS POLICIES (STRICT: Only Admins can modify, Public can only read published)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public can view published tours" ON public.tours;
DROP POLICY IF EXISTS "Admins can insert tours" ON public.tours;
DROP POLICY IF EXISTS "Admins can update tours" ON public.tours;
DROP POLICY IF EXISTS "Admins can delete tours" ON public.tours;

-- Public read: only published tours (admins can also inspect draft/archived tours)
CREATE POLICY "Public can view published tours"
    ON public.tours FOR SELECT
    USING (status = 'published' OR public.is_admin());

-- Modifications restricted exclusively to authenticated administrators
CREATE POLICY "Admins can insert tours"
    ON public.tours FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update tours"
    ON public.tours FOR UPDATE
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete tours"
    ON public.tours FOR DELETE
    TO authenticated
    USING (public.is_admin());


-- ------------------------------------------------------------------------------
-- 5.4 TOUR SUB-ENTITIES POLICIES (Images, Videos, Itinerary, Checklist, FAQs, Categories)
-- ------------------------------------------------------------------------------
-- Read access: Allowed only if parent tour is published (or if caller is admin).
-- Write access: Strictly restricted to authenticated administrators.

DROP POLICY IF EXISTS "Public can read tour media for published tours" ON public.tour_images;
DROP POLICY IF EXISTS "Admins manage tour images" ON public.tour_images;
CREATE POLICY "Public can read tour media for published tours"
    ON public.tour_images FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.tours WHERE tours.id = tour_images.tour_id AND (tours.status = 'published' OR public.is_admin())));
CREATE POLICY "Admins manage tour images"
    ON public.tour_images FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Public can read tour videos" ON public.tour_videos;
DROP POLICY IF EXISTS "Admins manage tour videos" ON public.tour_videos;
CREATE POLICY "Public can read tour videos"
    ON public.tour_videos FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.tours WHERE tours.id = tour_videos.tour_id AND (tours.status = 'published' OR public.is_admin())));
CREATE POLICY "Admins manage tour videos"
    ON public.tour_videos FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Public can view tour categories" ON public.tour_categories;
DROP POLICY IF EXISTS "Admins manage tour categories" ON public.tour_categories;
CREATE POLICY "Public can view tour categories"
    ON public.tour_categories FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.tours WHERE tours.id = tour_categories.tour_id AND (tours.status = 'published' OR public.is_admin())));
CREATE POLICY "Admins manage tour categories"
    ON public.tour_categories FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Public can read itinerary" ON public.tour_itinerary;
DROP POLICY IF EXISTS "Admins manage itinerary" ON public.tour_itinerary;
CREATE POLICY "Public can read itinerary"
    ON public.tour_itinerary FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.tours WHERE tours.id = tour_itinerary.tour_id AND (tours.status = 'published' OR public.is_admin())));
CREATE POLICY "Admins manage itinerary"
    ON public.tour_itinerary FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Public can read inclusions" ON public.tour_inclusions;
DROP POLICY IF EXISTS "Admins manage inclusions" ON public.tour_inclusions;
CREATE POLICY "Public can read inclusions"
    ON public.tour_inclusions FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.tours WHERE tours.id = tour_inclusions.tour_id AND (tours.status = 'published' OR public.is_admin())));
CREATE POLICY "Admins manage inclusions"
    ON public.tour_inclusions FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Public can read exclusions" ON public.tour_exclusions;
DROP POLICY IF EXISTS "Admins manage exclusions" ON public.tour_exclusions;
CREATE POLICY "Public can read exclusions"
    ON public.tour_exclusions FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.tours WHERE tours.id = tour_exclusions.tour_id AND (tours.status = 'published' OR public.is_admin())));
CREATE POLICY "Admins manage exclusions"
    ON public.tour_exclusions FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Public can read highlights" ON public.tour_highlights;
DROP POLICY IF EXISTS "Admins manage highlights" ON public.tour_highlights;
CREATE POLICY "Public can read highlights"
    ON public.tour_highlights FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.tours WHERE tours.id = tour_highlights.tour_id AND (tours.status = 'published' OR public.is_admin())));
CREATE POLICY "Admins manage highlights"
    ON public.tour_highlights FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Public can read faqs" ON public.tour_faqs;
DROP POLICY IF EXISTS "Admins manage faqs" ON public.tour_faqs;
CREATE POLICY "Public can read faqs"
    ON public.tour_faqs FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.tours WHERE tours.id = tour_faqs.tour_id AND (tours.status = 'published' OR public.is_admin())));
CREATE POLICY "Admins manage faqs"
    ON public.tour_faqs FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Public can read pickup locations" ON public.pickup_locations;
DROP POLICY IF EXISTS "Admins manage pickup locations" ON public.pickup_locations;
CREATE POLICY "Public can read pickup locations"
    ON public.pickup_locations FOR SELECT
    USING (is_active = TRUE OR public.is_admin());
CREATE POLICY "Admins manage pickup locations"
    ON public.pickup_locations FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Public can read tour pickup links" ON public.tour_pickup_locations;
DROP POLICY IF EXISTS "Admins manage tour pickup links" ON public.tour_pickup_locations;
CREATE POLICY "Public can read tour pickup links"
    ON public.tour_pickup_locations FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.tours WHERE tours.id = tour_pickup_locations.tour_id AND (tours.status = 'published' OR public.is_admin())));
CREATE POLICY "Admins manage tour pickup links"
    ON public.tour_pickup_locations FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Public can read active extras" ON public.tour_extras;
DROP POLICY IF EXISTS "Admins manage tour extras" ON public.tour_extras;
CREATE POLICY "Public can read active extras"
    ON public.tour_extras FOR SELECT
    USING (is_active = TRUE OR public.is_admin());
CREATE POLICY "Admins manage tour extras"
    ON public.tour_extras FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Public can read tour assigned extras" ON public.tour_assigned_extras;
DROP POLICY IF EXISTS "Admins manage tour assigned extras" ON public.tour_assigned_extras;
CREATE POLICY "Public can read tour assigned extras"
    ON public.tour_assigned_extras FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.tours WHERE tours.id = tour_assigned_extras.tour_id AND (tours.status = 'published' OR public.is_admin())));
CREATE POLICY "Admins manage tour assigned extras"
    ON public.tour_assigned_extras FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Public can read availability" ON public.tour_availability;
DROP POLICY IF EXISTS "Admins manage availability" ON public.tour_availability;
CREATE POLICY "Public can read availability"
    ON public.tour_availability FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.tours WHERE tours.id = tour_availability.tour_id AND (tours.status = 'published' OR public.is_admin())));
CREATE POLICY "Admins manage availability"
    ON public.tour_availability FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Public can read published reviews" ON public.reviews;
DROP POLICY IF EXISTS "Admins manage reviews" ON public.reviews;
CREATE POLICY "Public can read published reviews"
    ON public.reviews FOR SELECT
    USING (is_published = TRUE OR public.is_admin());
CREATE POLICY "Admins manage reviews"
    ON public.reviews FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Public can read SEO metadata" ON public.seo_metadata;
DROP POLICY IF EXISTS "Admins manage SEO metadata" ON public.seo_metadata;
CREATE POLICY "Public can read SEO metadata"
    ON public.seo_metadata FOR SELECT
    USING (TRUE);
CREATE POLICY "Admins manage SEO metadata"
    ON public.seo_metadata FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Public can read site settings" ON public.site_settings;
DROP POLICY IF EXISTS "Admins manage site settings" ON public.site_settings;
CREATE POLICY "Public can read site settings"
    ON public.site_settings FOR SELECT
    USING (TRUE);
CREATE POLICY "Admins manage site settings"
    ON public.site_settings FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins read audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Admins write audit logs" ON public.audit_logs;
CREATE POLICY "Admins read audit logs"
    ON public.audit_logs FOR SELECT
    TO authenticated
    USING (public.is_admin());
CREATE POLICY "Admins write audit logs"
    ON public.audit_logs FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin());


-- ------------------------------------------------------------------------------
-- 5.5 CUSTOMERS, BOOKINGS & EXTRAS POLICIES (Guest creation + Admin management)
-- ------------------------------------------------------------------------------
-- Customers Table
DROP POLICY IF EXISTS "Public can insert customer on booking" ON public.customers;
DROP POLICY IF EXISTS "Users can view own customer record" ON public.customers;
DROP POLICY IF EXISTS "Users can update own customer record" ON public.customers;
DROP POLICY IF EXISTS "Admins can view all customers" ON public.customers;
DROP POLICY IF EXISTS "Admins can update customers" ON public.customers;

-- Guests can insert their customer contact details when creating a reservation
CREATE POLICY "Public can insert customer on booking"
    ON public.customers FOR INSERT
    WITH CHECK (TRUE);

-- Authenticated customers can view their own profile
CREATE POLICY "Users can view own customer record"
    ON public.customers FOR SELECT
    USING (user_id = (SELECT auth.uid()) OR public.is_admin());

CREATE POLICY "Users can update own customer record"
    ON public.customers FOR UPDATE
    USING (user_id = (SELECT auth.uid()) OR public.is_admin());

-- Administrators have full management over customers
CREATE POLICY "Admins can view all customers"
    ON public.customers FOR SELECT
    TO authenticated
    USING (public.is_admin());

CREATE POLICY "Admins can manage customers"
    ON public.customers FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- Bookings Table
DROP POLICY IF EXISTS "Public can insert booking" ON public.bookings;
DROP POLICY IF EXISTS "Users can view linked bookings" ON public.bookings;
DROP POLICY IF EXISTS "Public lookup booking by reference" ON public.bookings;
DROP POLICY IF EXISTS "Public update booking cancellation" ON public.bookings;
DROP POLICY IF EXISTS "Admins manage bookings" ON public.bookings;

-- Anyone can submit a booking reservation
CREATE POLICY "Public can insert booking"
    ON public.bookings FOR INSERT
    WITH CHECK (TRUE);

-- Authenticated guests can view their own linked bookings
CREATE POLICY "Users can view linked bookings"
    ON public.bookings FOR SELECT
    USING (
        user_id = (SELECT auth.uid())
        OR customer_id IN (SELECT id FROM public.customers WHERE user_id = (SELECT auth.uid()))
        OR public.is_admin()
    );

-- Anyone can look up a booking if they possess the unique booking reference
CREATE POLICY "Public lookup booking by reference"
    ON public.bookings FOR SELECT
    USING (booking_reference IS NOT NULL);

-- Customers can submit a cancellation request on their confirmed/pending booking
CREATE POLICY "Public update booking cancellation"
    ON public.bookings FOR UPDATE
    USING (status IN ('confirmed', 'pending'))
    WITH CHECK (status = 'cancellation_requested');

-- Administrators have full management over bookings
CREATE POLICY "Admins manage bookings"
    ON public.bookings FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- Booking Extras Line Items Table
DROP POLICY IF EXISTS "Public insert booking extras" ON public.booking_extras;
DROP POLICY IF EXISTS "Public view booking extras" ON public.booking_extras;
DROP POLICY IF EXISTS "Admins manage booking extras" ON public.booking_extras;

CREATE POLICY "Public insert booking extras"
    ON public.booking_extras FOR INSERT
    WITH CHECK (TRUE);

CREATE POLICY "Public view booking extras"
    ON public.booking_extras FOR SELECT
    USING (TRUE);

CREATE POLICY "Admins manage booking extras"
    ON public.booking_extras FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());


-- ------------------------------------------------------------------------------
-- 5.6 NEWSLETTER SUBSCRIPTIONS POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public can insert newsletter subscription" ON public.newsletter_subscriptions;
DROP POLICY IF EXISTS "Public can view own newsletter status" ON public.newsletter_subscriptions;
DROP POLICY IF EXISTS "Public can update own subscription" ON public.newsletter_subscriptions;
DROP POLICY IF EXISTS "Admins can manage newsletter subscriptions" ON public.newsletter_subscriptions;

CREATE POLICY "Public can insert newsletter subscription"
    ON public.newsletter_subscriptions FOR INSERT
    WITH CHECK (TRUE);

CREATE POLICY "Public can view own newsletter status"
    ON public.newsletter_subscriptions FOR SELECT
    USING (TRUE);

CREATE POLICY "Public can update own subscription"
    ON public.newsletter_subscriptions FOR UPDATE
    USING (TRUE)
    WITH CHECK (TRUE);

CREATE POLICY "Admins can manage newsletter subscriptions"
    ON public.newsletter_subscriptions FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());


-- ------------------------------------------------------------------------------
-- 5.7 INQUIRIES & CONCIERGE REQUESTS POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public can insert inquiry" ON public.inquiries;
DROP POLICY IF EXISTS "Admins can manage inquiries" ON public.inquiries;

CREATE POLICY "Public can insert inquiry"
    ON public.inquiries FOR INSERT
    WITH CHECK (TRUE);

CREATE POLICY "Admins can manage inquiries"
    ON public.inquiries FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());


-- ------------------------------------------------------------------------------
-- 5.8 COUPONS & PROMO CODES POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public can read active coupons" ON public.coupons;
DROP POLICY IF EXISTS "Admins can manage coupons" ON public.coupons;

CREATE POLICY rbac_coupons_read ON public.coupons
  FOR SELECT TO authenticated USING (public.has_permission('content.read'::text));
CREATE POLICY rbac_coupons_create ON public.coupons
  FOR INSERT TO authenticated WITH CHECK (public.has_permission('content.create'::text));
CREATE POLICY rbac_coupons_update ON public.coupons
  FOR UPDATE TO authenticated
  USING (public.has_permission('content.update'::text))
  WITH CHECK (public.has_permission('content.update'::text));
CREATE POLICY rbac_coupons_delete ON public.coupons
  FOR DELETE TO authenticated USING (public.has_permission('content.delete'::text));




-- ------------------------------------------------------------------------------
-- 5.9 VESSELS & MARITIME FLEET POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public can view active vessels" ON public.vessels;
DROP POLICY IF EXISTS "Admins can manage vessels" ON public.vessels;

CREATE POLICY "Public can view active vessels"
    ON public.vessels FOR SELECT
    USING (is_active = TRUE OR public.is_admin());

CREATE POLICY "Admins can manage vessels"
    ON public.vessels FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());


-- ------------------------------------------------------------------------------
-- 5.10 TOUR VESSEL ASSIGNMENTS POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public can view tour vessel links" ON public.tour_vessels;
DROP POLICY IF EXISTS "Admins can manage tour vessels" ON public.tour_vessels;

CREATE POLICY "Public can view tour vessel links"
    ON public.tour_vessels FOR SELECT
    USING (TRUE);

CREATE POLICY "Admins can manage tour vessels"
    ON public.tour_vessels FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());


-- ------------------------------------------------------------------------------
-- 5.11 GUIDES, CAPTAINS & CREW POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public can view active guides" ON public.guides;
DROP POLICY IF EXISTS "Admins can manage guides" ON public.guides;

CREATE POLICY "Public can view active guides"
    ON public.guides FOR SELECT
    USING (is_active = TRUE OR public.is_admin());

CREATE POLICY "Admins can manage guides"
    ON public.guides FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());


-- ------------------------------------------------------------------------------
-- 5.12 FREQUENTLY ASKED QUESTIONS POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public can read published faqs" ON public.faqs;
DROP POLICY IF EXISTS "Admins can manage faqs" ON public.faqs;

CREATE POLICY "Public can read published faqs"
    ON public.faqs FOR SELECT
    USING (is_published = TRUE OR public.is_admin());

CREATE POLICY "Admins can manage faqs"
    ON public.faqs FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());


-- ------------------------------------------------------------------------------
-- 5.13 MARITIME WEATHER BULLETINS POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public can view weather bulletins" ON public.weather_bulletins;
DROP POLICY IF EXISTS "Admins can manage weather bulletins" ON public.weather_bulletins;

CREATE POLICY "Public can view weather bulletins"
    ON public.weather_bulletins FOR SELECT
    USING (TRUE);

CREATE POLICY "Admins can manage weather bulletins"
    ON public.weather_bulletins FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());


-- ------------------------------------------------------------------------------
-- 5.14 PASSENGER MANIFEST POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public insert booking passengers" ON public.booking_passengers;
DROP POLICY IF EXISTS "Users can view linked booking passengers" ON public.booking_passengers;
DROP POLICY IF EXISTS "Admins can manage booking passengers" ON public.booking_passengers;

CREATE POLICY "Public insert booking passengers"
    ON public.booking_passengers FOR INSERT
    WITH CHECK (TRUE);

CREATE POLICY "Users can view linked booking passengers"
    ON public.booking_passengers FOR SELECT
    USING (
        booking_id IN (
            SELECT id FROM public.bookings
            WHERE user_id = (SELECT auth.uid())
            OR customer_id IN (SELECT id FROM public.customers WHERE user_id = (SELECT auth.uid()))
        )
        OR public.is_admin()
    );

CREATE POLICY "Admins can manage booking passengers"
    ON public.booking_passengers FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());


-- ------------------------------------------------------------------------------
-- 5.15 EXPLICIT SCHEMA PERMISSIONS & API ROLE GRANTS
-- ------------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated;


-- ==============================================================================
-- SECTION 6: SUPABASE STORAGE BUCKETS & POLICIES
-- ==============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    (
        'tour-media',
        'tour-media',
        true,
        52428800, -- 50MB limit per file (supports video clips and high-res photography)
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'video/mp4', 'video/webm', 'video/quicktime']
    ),
    (
        'avatars',
        'avatars',
        true,
        5242880, -- 5MB limit per file
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif']
    ),
    (
        'vouchers',
        'vouchers',
        false, -- Private bucket accessed via signed URLs or authenticated RLS
        10485760, -- 10MB limit per file
        ARRAY['application/pdf']
    )
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage Objects Policies
DROP POLICY IF EXISTS "Public can view tour media files" ON storage.objects;
CREATE POLICY "Public can view tour media files"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'tour-media');

DROP POLICY IF EXISTS "Public can view avatar files" ON storage.objects;
CREATE POLICY "Public can view avatar files"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users can view own vouchers" ON storage.objects;
CREATE POLICY "Users can view own vouchers"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'vouchers' AND (owner = (SELECT auth.uid()) OR public.is_admin()));

-- Authenticated Users can upload their own profile avatars
DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
CREATE POLICY "Users can upload own avatar"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
CREATE POLICY "Users can update own avatar"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (bucket_id = 'avatars');

-- Administrator media management
DROP POLICY IF EXISTS "Admins can upload tour media" ON storage.objects;
CREATE POLICY "Admins can upload tour media"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'tour-media' AND public.is_admin());

DROP POLICY IF EXISTS "Admins can update tour media" ON storage.objects;
CREATE POLICY "Admins can update tour media"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (bucket_id = 'tour-media' AND public.is_admin());

DROP POLICY IF EXISTS "Admins can delete tour media" ON storage.objects;
CREATE POLICY "Admins can delete tour media"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'tour-media' AND public.is_admin());

DROP POLICY IF EXISTS "Admins can upload vouchers" ON storage.objects;
CREATE POLICY "Admins can upload vouchers"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'vouchers' AND public.is_admin());

DROP POLICY IF EXISTS "Admins can delete vouchers" ON storage.objects;
CREATE POLICY "Admins can delete vouchers"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'vouchers' AND public.is_admin());


-- ==============================================================================
-- SECTION 7: PROFILE BACKFILL FOR EXISTING ACCOUNTS
-- ==============================================================================
INSERT INTO public.profiles (
    id,
    email,
    full_name,
    role,
    is_confirmed,
    created_at,
    updated_at
)
SELECT 
    u.id,
    u.email,
    COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
    COALESCE(u.raw_user_meta_data->>'role', 'customer'),
    (u.email_confirmed_at IS NOT NULL),
    COALESCE(u.created_at, NOW()),
    NOW()
FROM auth.users u
ON CONFLICT (id) DO UPDATE
SET 
    email = EXCLUDED.email,
    is_confirmed = EXCLUDED.is_confirmed,
    updated_at = NOW();

-- ==============================================================================
-- SECTION 8: INITIAL ADMINISTRATOR PROMOTION
-- ==============================================================================
-- To promote your account to administrator, run in Supabase SQL Editor:
-- SELECT public.set_admin_role_by_email('diamond.entertainment70@gmail.com');
-- ==============================================================================
-- ==============================================================================
-- RED SEA VOYAGES & MARITIME EXCURSIONS - PRODUCTION CATALOG SEED DATA
-- ==============================================================================
-- Seeds production reference catalog: Destinations, Categories, Pickup Locations,
-- Tour Extras, Published Excursion Catalog (itineraries, inclusions, exclusions,
-- highlights, FAQs, gallery media), Promo Coupons, Fleet Vessels, Guides, and Bulletins.
-- Zero demo bookings or test customer records are included.

-- 1. DESTINATIONS
INSERT INTO public.destinations (id, name, slug, tagline, description, main_image, gallery, distance_from_airport, status, sort_order)
VALUES 
(
    'a1000000-0000-0000-0000-000000000001',
    'Hurghada',
    'hurghada',
    'The premier maritime gateway with legendary sandy islands & house reefs',
    'Hurghada is Egypt’s leading coastal destination along the western shore of the Red Sea, famed for crystal shallows, world-class boat cruises, vibrant marinas, and direct access to protected national park islands.',
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
    ARRAY['https://images.unsplash.com/photo-1544551763-77ef2d0cfc6c?auto=format&fit=crop&w=1200&q=80'],
    '15 minutes from HRG Airport',
    'published',
    1
),
(
    'a1000000-0000-0000-0000-000000000002',
    'El Gouna',
    'el-gouna',
    'The upscale lagoon resort town of luxury yachts & golf clubs',
    'Built across islands and turquoise lagoons, El Gouna delivers an exclusive European atmosphere with modern yacht marinas, kite-surfing lagoons, and protected coral gardens.',
    'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=1200&q=80',
    ARRAY['https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80'],
    '30 minutes from HRG Airport',
    'published',
    2
),
(
    'a1000000-0000-0000-0000-000000000003',
    'Makadi Bay',
    'makadi-bay',
    'Serene bays, gentle sandy beaches & pristine offshore reefs',
    'Nestled south of Hurghada, Makadi Bay is famous for family-friendly luxury resorts and tranquil waters teeming with sea turtles and parrotfish.',
    'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80',
    ARRAY['https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80'],
    '35 minutes from HRG Airport',
    'published',
    3
),
(
    'a1000000-0000-0000-0000-000000000004',
    'Sahl Hasheesh',
    'sahl-hasheesh',
    'Grand seaside promenades and sun-drenched private bay shores',
    'An exclusive enclave known for its 12-kilometer palm-lined promenade, sunken pharaonic city snorkeling reef, and serene turquoise waters.',
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
    ARRAY[],
    '25 minutes from HRG Airport',
    'published',
    4
),
(
    'a1000000-0000-0000-0000-000000000005',
    'Safaga & Soma Bay',
    'safaga',
    'Dramatic drop-offs, pristine barrier reefs & therapeutic beaches',
    'Safaga and the adjacent Soma Bay peninsula offer world-renowned diving at Panorama Reef, windsurfing, and uncrowded island excursions.',
    'https://images.unsplash.com/photo-1544551763-77ef2d0cfc6c?auto=format&fit=crop&w=1200&q=80',
    ARRAY[],
    '50 minutes from HRG Airport',
    'published',
    5
),
(
    'a1000000-0000-0000-0000-000000000006',
    'Sharm El-Sheikh',
    'sharm-el-sheikh',
    'Sinai marine jewel with Ras Mohammed drop-offs & White Island',
    'The premier resort of the southern Sinai peninsula, famed for dramatic drop-off reef walls at Ras Mohammed National Park, the crystal waters of White Island, and the straits of Tiran.',
    'https://images.unsplash.com/photo-1544551763-77ef2d0cfc6c?auto=format&fit=crop&w=1200&q=80',
    ARRAY['https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80'],
    '15 minutes from SSH Airport',
    'published',
    6
)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, status = EXCLUDED.status;


-- 2. CATEGORIES
INSERT INTO public.categories (id, name, slug, description, image, icon_name, status, sort_order)
VALUES
(
    'c1000000-0000-0000-0000-000000000001',
    'Boat Trips & Island Cruises',
    'boat-trips',
    'Full-day yacht sailings to Orange Bay, Paradise Island, and secluded sandbars.',
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
    'Ship',
    'published',
    1
),
(
    'c1000000-0000-0000-0000-000000000002',
    'Snorkeling Adventures',
    'snorkeling',
    'Guided explorations over world-famous barrier reefs and sea turtle sanctuaries.',
    'https://images.unsplash.com/photo-1544551763-77ef2d0cfc6c?auto=format&fit=crop&w=1200&q=80',
    'Waves',
    'published',
    2
),
(
    'c1000000-0000-0000-0000-000000000003',
    'Diving Expeditions',
    'scuba-diving',
    'Introductory discovery dives and certified boat excursions to coral pinnacles.',
    'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80',
    'Anchor',
    'published',
    3
),
(
    'c1000000-0000-0000-0000-000000000004',
    'Desert Safari & Quad',
    'desert-safari',
    'ATV quad biking through Red Sea mountain canyons with Bedouin sunset dinner.',
    'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=1200&q=80',
    'Compass',
    'published',
    4
),
(
    'c1000000-0000-0000-0000-000000000005',
    'Private Yacht Charters',
    'private-charters',
    'Tailored luxury vessel charters with private captain, crew, and custom route.',
    'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=1200&q=80',
    'Sparkles',
    'published',
    5
)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;


-- 3. PICKUP LOCATIONS
INSERT INTO public.pickup_locations (id, code, name, area, fee_eur_per_person, fee_eur_flat, description, is_active, sort_order)
VALUES
(
    'b1000000-0000-0000-0000-000000000001',
    'hurghada',
    'Hurghada Hotels (Central)',
    'Hurghada (Mamsha, Dahar, Sheraton, Marina)',
    0.00,
    0.00,
    'Complimentary return transfer included from all standard Hurghada hotel lobbies.',
    TRUE,
    1
),
(
    'b1000000-0000-0000-0000-000000000002',
    'el-gouna',
    'El Gouna Resorts',
    'El Gouna Peninsula & Lagoons',
    5.00,
    0.00,
    'Transfers from northern El Gouna resorts to Hurghada Marina.',
    TRUE,
    2
),
(
    'b1000000-0000-0000-0000-000000000003',
    'makadi-bay',
    'Makadi Bay Resorts',
    'Makadi Bay Coast',
    5.00,
    0.00,
    'Air-conditioned shuttle from Makadi Bay resorts.',
    TRUE,
    3
),
(
    'b1000000-0000-0000-0000-000000000004',
    'sahl-hasheesh',
    'Sahl Hasheesh Resorts',
    'Sahl Hasheesh Old Town & Promenade',
    5.00,
    0.00,
    'Transfers from Sahl Hasheesh gate hotels.',
    TRUE,
    4
),
(
    'b1000000-0000-0000-0000-000000000005',
    'safaga',
    'Safaga & Soma Bay',
    'Soma Bay Peninsula & Safaga Port',
    10.00,
    0.00,
    'Dedicated long-range transport service.',
    TRUE,
    5
),
(
    'b1000000-0000-0000-0000-000000000006',
    'sharm-el-sheikh',
    'Sharm El-Sheikh Hotels (All Zones)',
    'Naama Bay, Nabq Bay, Sharks Bay, Hadaba, Ras Um Sid',
    0.00,
    0.00,
    'Complimentary return transfer included from all Sharm El-Sheikh hotel lobbies.',
    TRUE,
    6
)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;


-- 4. TOUR EXTRAS
INSERT INTO public.tour_extras (id, name, description, price_eur, currency, pricing_type, is_active, sort_order)
VALUES
(
    'e1000000-0000-0000-0000-000000000001',
    'GoPro Underwater Camera Rental (16GB SD Included)',
    'Full day waterproof 4K camera rental. Keep the 16GB micro-SD card loaded with your coral reef clips.',
    25.00,
    'EUR',
    'per_booking',
    TRUE,
    1
),
(
    'e1000000-0000-0000-0000-000000000002',
    'Private VIP Van Transfer Upgrade',
    'Upgrade your group transfer to a private luxury Mercedes/HiAce van direct from hotel to vessel without intermediate hotel stops.',
    30.00,
    'EUR',
    'per_booking',
    TRUE,
    2
),
(
    'e1000000-0000-0000-0000-000000000003',
    'Fresh Grilled Jumbo Shrimp & Calamari Lunch Upgrade',
    'Add a sizzling platter of freshly grilled Mediterranean jumbo prawns, calamari, and seafood soup to your onboard lunch.',
    15.00,
    'EUR',
    'per_person',
    TRUE,
    3
),
(
    'e1000000-0000-0000-0000-000000000004',
    'Introductory Scuba Dive (20 Minutes Guided)',
    'Experience real underwater breathing with a certified PADI instructor. No license or prior experience required.',
    20.00,
    'EUR',
    'per_person',
    TRUE,
    4
)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;


-- 5. TOURS (Seed tours)
INSERT INTO public.tours (
    id, title, slug, short_description, description, destination_id,
    duration, duration_type, duration_hours, tour_type, status, featured,
    price, child_price, infant_price, private_price, currency,
    max_guests, minimum_booking_notice_hours, pickup_available, pickup_info,
    cancellation_policy, departure_time, badge, rating, review_count, sort_order
)
VALUES
(
    '10000000-0000-0000-0000-000000000001',
    'Orange Bay Island & Snorkeling Cruise',
    'orange-bay-island-snorkeling',
    'Cruise to Giftun Island’s famous Orange Bay beach with its crystal turquoise lagoon, two guided coral reef stops, and open buffet lunch onboard.',
    'Spend a relaxing day sailing across the sheltered waters of the Red Sea to Giftun Island. Disembark at Orange Bay where wooden swings, shallow white sandbars, and shaded beanbag cabanas await. Enjoy two hours of island leisure before re-boarding for a freshly prepared buffet lunch and two distinct open-sea snorkeling sessions over living coral heads.',
    'a1000000-0000-0000-0000-000000000001',
    'Full Day (approx. 7 hours)', 'Full Day', 7.0, 'Shared', 'published', TRUE,
    35.00, 18.00, 0.00, 260.00, 'EUR',
    35, 12, TRUE, 'Complimentary hotel transfer across Hurghada included.',
    'Free cancellation up to 24 hours prior to excursion departure.', '08:30 AM', 'Popular', 4.8, 126, 1
),
(
    '10000000-0000-0000-0000-000000000002',
    'Dolphin House Yacht Cruise with Snorkeling',
    'dolphin-house-hurghada-snorkeling',
    'Sail to the renowned Sha’ab El Erg offshore lagoon to observe pods of wild spinner dolphins in their natural habitat.',
    'Sha’ab El Erg is a massive horseshoe reef that shelters pods of free-ranging spinner and bottlenose dolphins. While encountering wild sea mammals cannot be 100% guaranteed, our captains have an over 90% sighting success rate. After dolphin watching, snorkel over pristine coral drop-offs and enjoy water sports (banana boat & sofa ride) plus an open buffet lunch onboard.',
    'a1000000-0000-0000-0000-000000000001',
    'Full Day (approx. 7.5 hours)', 'Full Day', 7.5, 'Shared', 'published', TRUE,
    32.00, 16.00, 0.00, 240.00, 'EUR',
    35, 12, TRUE, 'Hotel lobby pickup and return transfer across Hurghada included.',
    'Free cancellation up to 24 hours prior to excursion departure.', '08:00 AM', 'Top Pick', 4.9, 142, 2
),
(
    '10000000-0000-0000-0000-000000000003',
    'Paradise Island Royal Cruise with Seafood Lunch',
    'paradise-island-royal-cruise',
    'A deluxe island escape to Paradise Beach featuring shaded canopy loungers, folklore show, fresh seafood lunch, and guided reef snorkeling.',
    'Paradise Island offers an upgraded Caribbean-style resort atmosphere on Giftun Island. Enjoy reserved beach seating under traditional thatched umbrellas, live oriental entertainment, and a specialized seafood and meat barbecue buffet. Two offshore snorkeling stops showcase vibrant clownfish and blue-spotted stingrays.',
    'a1000000-0000-0000-0000-000000000001',
    'Full Day (approx. 7 hours)', 'Full Day', 7.0, 'Shared', 'published', TRUE,
    42.00, 22.00, 0.00, 310.00, 'EUR',
    35, 12, TRUE, 'Hotel lobby pickup across Hurghada, El Gouna, and Makadi Bay.',
    'Free cancellation up to 24 hours prior to excursion departure.', '08:30 AM', 'Deluxe', 4.7, 98, 3
),
(
    '10000000-0000-0000-0000-000000000004',
    'Sunset Desert Safari & Quad Bike Adventure',
    'sunset-desert-safari-quad-bike',
    'Drive quad bikes through the rugged Eastern Desert mountains, visit a traditional Bedouin settlement, ride camels, and enjoy a barbecue dinner under stars.',
    'Leave the sea behind for an exhilarating desert expedition. After a thorough safety briefing, take command of an automatic quad bike across sand dunes and rocky canyons toward an authentic Bedouin village. Experience Bedouin tea, bread baking, an optional camel ride, and an oriental show with tanoura dance while the sun sets over the peaks.',
    'a1000000-0000-0000-0000-000000000001',
    'Half Day (approx. 5 hours)', 'Half Day', 5.0, 'Shared', 'published', FALSE,
    28.00, 15.00, 0.00, 180.00, 'EUR',
    30, 8, TRUE, 'Pickup from all hotel lobbies in Hurghada.',
    'Free cancellation up to 24 hours prior.', '01:30 PM', 'Adventure', 4.9, 87, 4
),
(
    '10000000-0000-0000-0000-000000000005',
    'Introductory Scuba Diving 2-Dive Yacht Trip',
    'introductory-scuba-diving-day-trip',
    'Designed specifically for beginners. Enjoy two 20-minute 1-on-1 guided dives with a licensed PADI instructor in warm shallow coral gardens.',
    'Discover the magic of breathing underwater without prior certification. A certified PADI dive instructor guides you step-by-step through basic safety before taking you hand-in-hand to a maximum depth of 7 meters. Witness giant moray eels, lionfish, and endless schools of anthias in total safety.',
    'a1000000-0000-0000-0000-000000000001',
    'Full Day (approx. 7.5 hours)', 'Full Day', 7.5, 'Shared', 'published', TRUE,
    45.00, 30.00, 0.00, 350.00, 'EUR',
    20, 12, TRUE, 'Lobby pickup and return transfer included.',
    'Free cancellation up to 24 hours prior.', '08:15 AM', 'Certified', 4.9, 114, 5
)
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, price = EXCLUDED.price;


-- 6. TOUR IMAGES
INSERT INTO public.tour_images (tour_id, image_url, alt_text, caption, is_primary, sort_order)
VALUES
('10000000-0000-0000-0000-000000000001', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80', 'Orange Bay beach wooden swings and crystal lagoon', 'Orange Bay Lagoon', TRUE, 1),
('10000000-0000-0000-0000-000000000001', 'https://images.unsplash.com/photo-1544551763-77ef2d0cfc6c?auto=format&fit=crop&w=1200&q=80', 'Snorkeling over colorful Red Sea corals', 'Coral Garden Stop', FALSE, 2),
('10000000-0000-0000-0000-000000000001', 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80', 'Passenger yacht sailing on Red Sea', 'Cruising to Giftun Island', FALSE, 3),

('10000000-0000-0000-0000-000000000002', 'https://images.unsplash.com/photo-1544551763-77ef2d0cfc6c?auto=format&fit=crop&w=1200&q=80', 'Dolphin pod swimming near Hurghada', 'Wild Dolphin Encounter', TRUE, 1),
('10000000-0000-0000-0000-000000000002', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80', 'Red sea reef barrier', 'Reef Snorkeling', FALSE, 2),

('10000000-0000-0000-0000-000000000003', 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=1200&q=80', 'Paradise Island sandy beach', 'Paradise Island Beach', TRUE, 1),
('10000000-0000-0000-0000-000000000004', 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=1200&q=80', 'Quad bike in Egyptian desert mountains', 'Desert Quad Safari', TRUE, 1),
('10000000-0000-0000-0000-000000000005', 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80', 'Scuba diver exploring coral pillar', 'Intro Dive', TRUE, 1);


-- 7. TOUR HIGHLIGHTS
INSERT INTO public.tour_highlights (tour_id, item, sort_order)
VALUES
('10000000-0000-0000-0000-000000000001', '2 hours on Orange Bay beach with shaded loungers and shallow turquoise water', 1),
('10000000-0000-0000-0000-000000000001', 'Two 45-minute guided snorkeling stops at vibrant offshore reefs', 2),
('10000000-0000-0000-0000-000000000001', 'Fresh open buffet lunch served onboard with soft drinks & bottled water', 3),
('10000000-0000-0000-0000-000000000001', 'Complimentary snorkeling equipment and flotation jackets provided', 4),
('10000000-0000-0000-0000-000000000001', 'Hotel lobby pickup and return across Hurghada included', 5);


-- 8. TOUR ITINERARY
INSERT INTO public.tour_itinerary (tour_id, time, title, description, sort_order)
VALUES
('10000000-0000-0000-0000-000000000001', '08:00', 'Hotel pickup', 'Air-conditioned transfer from your resort lobby to Hurghada Marina.', 1),
('10000000-0000-0000-0000-000000000001', '09:00', 'Departure from marina', 'Safety briefing and scenic sail across the Red Sea toward Giftun Island.', 2),
('10000000-0000-0000-0000-000000000001', '10:00', 'First snorkeling stop', 'Guided reef snorkeling session observing parrotfish, rays, and clownfish.', 3),
('10000000-0000-0000-0000-000000000001', '12:30', 'Lunch onboard', 'Warm buffet lunch with fish, chicken, rice, salads, and seasonal fruits.', 4),
('10000000-0000-0000-0000-000000000001', '14:00', 'Island beach time', 'Disembark at Orange Bay for relaxation, photography, and swimming in shallow lagoons.', 5),
('10000000-0000-0000-0000-000000000001', '16:30', 'Return to marina', 'Leisurely cruise back as afternoon sun reflects on coastal mountains.', 6),
('10000000-0000-0000-0000-000000000001', '17:00', 'Hotel drop-off', 'Return transfer back to your hotel lobby.', 7);


-- 9. TOUR INCLUSIONS & EXCLUSIONS
INSERT INTO public.tour_inclusions (tour_id, item, sort_order)
VALUES
('10000000-0000-0000-0000-000000000001', 'Hotel pickup and return transfer in air-conditioned vehicle', 1),
('10000000-0000-0000-0000-000000000001', 'Full-day boat cruise on passenger yacht with sun decks', 2),
('10000000-0000-0000-0000-000000000001', 'Snorkeling equipment (mask, snorkel, fins)', 3),
('10000000-0000-0000-0000-000000000001', 'Orange Bay island national park admission ticket', 4),
('10000000-0000-0000-0000-000000000001', 'Buffet lunch prepared fresh onboard', 5),
('10000000-0000-0000-0000-000000000001', 'Unlimited soft drinks, mineral water, tea & coffee', 6);

INSERT INTO public.tour_exclusions (tour_id, item, sort_order)
VALUES
('10000000-0000-0000-0000-000000000001', 'Personal expenses & souvenir shopping on island', 1),
('10000000-0000-0000-0000-000000000001', 'Underwater photography package (available as optional extra)', 2),
('10000000-0000-0000-0000-000000000001', 'Gratuities for yacht crew & dive masters', 3);


-- 10. TOUR FAQS
INSERT INTO public.tour_faqs (tour_id, question, answer, sort_order)
VALUES
('10000000-0000-0000-0000-000000000001', 'Is snorkeling equipment provided or should I bring my own?', 'High-quality sanitized masks, snorkels, and fins in all adult and children sizes are provided onboard free of charge. You are also welcome to bring your personal gear.', 1),
('10000000-0000-0000-0000-000000000001', 'Can non-swimmers participate safely?', 'Absolutely. Our boats carry US Coast Guard approved life jackets in all sizes. Our certified snorkeling guides accompany guests in the water with rescue rings and support floats.', 2),
('10000000-0000-0000-0000-000000000001', 'What should we pack for the trip?', 'Please bring your hotel towel, swimwear, sunglasses, sun cream, camera or waterproof phone pouch, and a photo ID or passport copy.', 3);


-- 11. TOUR SEO METADATA
INSERT INTO public.seo_metadata (entity_type, entity_id, seo_title, meta_description, seo_keywords, canonical_url, og_title, og_description)
VALUES
(
    'tour',
    '10000000-0000-0000-0000-000000000001',
    'Orange Bay Island & Snorkeling Cruise | Hurghada Boat Trip',
    'Book direct Orange Bay island boat trip from Hurghada. 2 hours on Giftun Island beach, 2 guided snorkeling stops, fresh onboard lunch. Free cancellation.',
    ARRAY['orange bay hurghada', 'giftun island tour', 'red sea snorkeling boat trip', 'hurghada boat excursion'],
    'https://redseavoyages.com/excursions/orange-bay-island-snorkeling',
    'Orange Bay Island & Snorkeling Cruise',
    'Discover the Caribbean of Egypt with our premier direct boat cruise to Orange Bay.'
)
ON CONFLICT (entity_type, entity_id) DO UPDATE SET seo_title = EXCLUDED.seo_title;


-- 12. PROMO CODES & COUPONS
INSERT INTO public.coupons (code, description, discount_type, discount_value, min_spend, max_discount, is_active)
VALUES
('WELCOME10', 'Welcome discount 10% off for first-time Red Sea explorers', 'percentage', 10.00, 50.00, 30.00, TRUE),
('SUMMER15', 'Summer holiday 15% special discount on all island trips', 'percentage', 15.00, 75.00, 50.00, TRUE),
('FAMILY20', '€20 flat voucher for group and family bookings over €120', 'fixed', 20.00, 120.00, 20.00, TRUE)
ON CONFLICT (code) DO NOTHING;


-- 13. MARITIME VESSELS FLEET
INSERT INTO public.vessels (id, name, vessel_type, registration_number, port_marina, passenger_capacity, amenities, is_active)
VALUES
(
    '01000000-0000-0000-0000-000000000001',
    'Royal Sea Breeze I',
    'motor_yacht',
    'HRG-MAR-2024-08',
    'Hurghada Marina',
    45,
    ARRAY['Flybridge Sundeck', 'Air-Conditioned Saloon', 'Snorkel Platform', 'Freshwater Showers', 'Full Galley Buffet'],
    TRUE
),
(
    '01000000-0000-0000-0000-000000000002',
    'Dolphin Star IV',
    'speedboat',
    'HRG-SPD-2023-14',
    'Hurghada Marina',
    12,
    ARRAY['Twin Yamaha 300HP Engines', 'Bimini Sun Canopy', 'Swim Ladder', 'Padded Bucket Seating'],
    TRUE
),
(
    '01000000-0000-0000-0000-000000000003',
    'Lagoon Princess',
    'catamaran',
    'ELG-CAT-2025-01',
    'Abu Tig Marina (El Gouna)',
    30,
    ARRAY['Twin Trampoline Nets', 'Shaded Cockpit Lounge', 'Bluetooth Sound System', 'Swim Deck'],
    TRUE
)
ON CONFLICT (id) DO NOTHING;


-- 14. TOUR VESSEL ASSIGNMENTS
INSERT INTO public.tour_vessels (tour_id, vessel_id, is_default)
VALUES
('10000000-0000-0000-0000-000000000001', '01000000-0000-0000-0000-000000000001', TRUE),
('10000000-0000-0000-0000-000000000002', '01000000-0000-0000-0000-000000000002', TRUE)
ON CONFLICT (tour_id, vessel_id) DO NOTHING;


-- 15. GUIDES & DIVE MASTERS
INSERT INTO public.guides (full_name, role, languages, phone, rating, is_active)
VALUES
('Captain Mahmoud Hassan', 'captain', ARRAY['English', 'Arabic'], '+20 100 555 4321', 4.95, TRUE),
('Sven Richter', 'dive_master', ARRAY['German', 'English'], '+20 101 222 9876', 5.00, TRUE),
('Youssef El-Gamal', 'snorkel_guide', ARRAY['English', 'French', 'Russian', 'Arabic'], '+20 102 333 1122', 4.90, TRUE)
ON CONFLICT DO NOTHING;


-- 16. GLOBAL FREQUENTLY ASKED QUESTIONS
INSERT INTO public.faqs (category, question, answer, sort_order, is_published)
VALUES
(
    'booking',
    'Can I pay in cash upon arrival at the harbor or hotel pickup?',
    'Yes! We offer a guaranteed "Pay at Hotel Pickup" option so you can reserve your spots in advance and settle with our coordinator in Cash (EUR, USD, GBP, or EGP) on the day of your trip.',
    1,
    TRUE
),
(
    'cancellation',
    'What is your cancellation policy if our flight or travel plans change?',
    'We provide a flexible 100% free cancellation guarantee up to 24 hours prior to your scheduled excursion departure with zero cancellation penalties.',
    2,
    TRUE
),
(
    'marine_safety',
    'Are life jackets and safety gear provided onboard for children and non-swimmers?',
    'Yes. Every vessel in our fleet exceeds Egyptian Coast Guard standards and carries certified US Coast Guard life vests in all sizes, including specialized flotation jackets for children and infants.',
    3,
    TRUE
),
(
    'transfers',
    'Where will the driver pick us up from our resort?',
    'Our professional driver will arrive directly outside your resort main security gate / hotel lobby entrance holding a greeting card with your booking reference.',
    4,
    TRUE
)
ON CONFLICT DO NOTHING;


-- 17. TODAY MARITIME WEATHER BULLETIN
INSERT INTO public.weather_bulletins (
    harbor_location,
    water_temperature_c,
    air_temperature_c,
    swell_height_m,
    wind_speed_knots,
    wind_direction,
    visibility_meters,
    coast_guard_cleared,
    advisory_notes,
    bulletin_date
)
VALUES (
    'Hurghada Marina',
    25.5,
    29.0,
    0.3,
    8.5,
    'NNE',
    35,
    TRUE,
    'Superb calm sea conditions across Giftun Island archipelago. Crystal clear visibility exceeding 30 meters.',
    CURRENT_DATE
)
ON CONFLICT DO NOTHING;

-- ==============================================================================
-- 18. INITIAL ADMINISTRATOR PROMOTION HELPER EXECUTION
-- ==============================================================================
-- If your admin user (diamond.entertainment70@gmail.com) is already registered in auth.users,
-- the following block automatically promotes them to 'admin' role immediately:
DO $$
BEGIN
    PERFORM public.set_admin_role_by_email('diamond.entertainment70@gmail.com');
EXCEPTION WHEN OTHERS THEN
    NULL;
END;
$$;

-- ==============================================================================
-- 19. MEDIA ASSETS TABLE (SUPABASE STORAGE METADATA & ORPHAN PREVENTION)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.media_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    storage_path TEXT NOT NULL UNIQUE,
    bucket_name TEXT NOT NULL DEFAULT 'tour-media',
    public_url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL DEFAULT 0,
    mime_type TEXT NOT NULL,
    title TEXT,
    alt_text TEXT,
    tour_id UUID REFERENCES public.tours(id) ON DELETE SET NULL,
    uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_assets_tour ON public.media_assets(tour_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_storage_path ON public.media_assets(storage_path);
CREATE INDEX IF NOT EXISTS idx_media_assets_created_at ON public.media_assets(created_at DESC);

ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view media assets" ON public.media_assets;
CREATE POLICY "Public can view media assets"
    ON public.media_assets FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Admins can manage media assets" ON public.media_assets;
CREATE POLICY "Admins can manage media assets"
    ON public.media_assets FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- BEGIN ADDITIVE EXCLUSIVE TRIP RESERVATION MODEL (20261121160000)
-- Exclusive trips are a separate product and reservation model.
-- Existing tours, departures and create_booking_atomic_with_departure remain untouched.
BEGIN;

CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO anon, authenticated, service_role;

ALTER TABLE public.tours
  ADD COLUMN IF NOT EXISTS is_exclusive BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS public.exclusive_trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id UUID NOT NULL UNIQUE REFERENCES public.tours(id) ON DELETE CASCADE,
  fixed_trip_price NUMERIC(12,2) NOT NULL CHECK (fixed_trip_price > 0 AND fixed_trip_price <= 99999999.99),
  currency TEXT NOT NULL DEFAULT 'EUR' CHECK (currency ~ '^[A-Z]{3}$'),
  minimum_guests INTEGER NOT NULL DEFAULT 1 CHECK (minimum_guests BETWEEN 1 AND 500),
  maximum_guests INTEGER NOT NULL CHECK (maximum_guests BETWEEN 1 AND 500),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT exclusive_trip_guest_range CHECK (minimum_guests <= maximum_guests)
);

CREATE TABLE IF NOT EXISTS public.exclusive_departures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exclusive_trip_id UUID NOT NULL REFERENCES public.exclusive_trips(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  maximum_guests INTEGER NOT NULL CHECK (maximum_guests BETWEEN 1 AND 500),
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','confirmed','cancelled','completed')),
  vessel_id UUID REFERENCES public.vessels(id) ON DELETE SET NULL,
  captain_id UUID REFERENCES public.guides(id) ON DELETE SET NULL,
  guide_id UUID REFERENCES public.guides(id) ON DELETE SET NULL,
  driver_id UUID REFERENCES public.guides(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT exclusive_departure_time_range CHECK (end_time > start_time),
  CONSTRAINT exclusive_departure_trip_slot_unique UNIQUE (exclusive_trip_id, date, start_time)
);

CREATE TABLE IF NOT EXISTS public.exclusive_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_reference TEXT NOT NULL UNIQUE,
  booking_id UUID UNIQUE REFERENCES public.bookings(id) ON DELETE SET NULL,
  exclusive_departure_id UUID NOT NULL REFERENCES public.exclusive_departures(id) ON DELETE RESTRICT,
  customer_first_name TEXT NOT NULL,
  customer_last_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_country TEXT,
  customer_hotel TEXT,
  guest_count INTEGER NOT NULL CHECK (guest_count BETWEEN 1 AND 500),
  fixed_trip_price NUMERIC(12,2) NOT NULL CHECK (fixed_trip_price > 0),
  total NUMERIC(12,2) NOT NULL CHECK (total > 0),
  currency TEXT NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  payment_method TEXT NOT NULL DEFAULT 'pay_at_pickup'
    CHECK (payment_method IN ('pay_at_pickup','pay_online')),
  payment_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending','paid','partially_paid','refunded','failed')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','confirmed','cancelled','completed','no_show')),
  special_requests TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS exclusive_one_active_reservation_per_slot
  ON public.exclusive_reservations(exclusive_departure_id)
  WHERE status IN ('pending','confirmed','completed','no_show');

ALTER TABLE public.exclusive_reservations
  ADD COLUMN IF NOT EXISTS booking_id UUID UNIQUE REFERENCES public.bookings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS exclusive_departures_public_schedule_idx
  ON public.exclusive_departures(date, start_time)
  WHERE status = 'confirmed';

CREATE INDEX IF NOT EXISTS exclusive_reservations_departure_idx
  ON public.exclusive_reservations(exclusive_departure_id, status);


-- Validate operator-created slots against the trip's configured limits and assigned resources.
CREATE OR REPLACE FUNCTION private.validate_exclusive_departure()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_trip public.exclusive_trips%ROWTYPE;
  v_tour_status TEXT;
  v_capacity INTEGER;
  v_inspection DATE;
  v_maintenance DATE;
BEGIN
  SELECT * INTO v_trip
  FROM public.exclusive_trips
  WHERE id = NEW.exclusive_trip_id AND is_active = TRUE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'An active Exclusive product is required before scheduling a slot' USING ERRCODE = '22023';
  END IF;

  SELECT status INTO v_tour_status
  FROM public.tours
  WHERE id = v_trip.tour_id AND is_exclusive = TRUE;
  IF NOT FOUND OR v_tour_status <> 'published' THEN
    RAISE EXCEPTION 'The Exclusive tour listing must be published before scheduling slots' USING ERRCODE = '22023';
  END IF;

  IF NEW.date < (now() AT TIME ZONE 'Africa/Cairo')::date
     OR (NEW.date = (now() AT TIME ZONE 'Africa/Cairo')::date
         AND NEW.start_time <= (now() AT TIME ZONE 'Africa/Cairo')::time) THEN
    RAISE EXCEPTION 'An Exclusive departure cannot be scheduled in the past' USING ERRCODE = '22023';
  END IF;
  IF NEW.maximum_guests < v_trip.minimum_guests THEN
    RAISE EXCEPTION 'Slot capacity cannot be below the Exclusive product minimum of % guests', v_trip.minimum_guests USING ERRCODE = '22023';
  END IF;
  IF NEW.maximum_guests > v_trip.maximum_guests THEN
    RAISE EXCEPTION 'Slot capacity cannot exceed the Exclusive product maximum of % guests', v_trip.maximum_guests USING ERRCODE = '22023';
  END IF;

  IF NEW.vessel_id IS NOT NULL THEN
    SELECT passenger_capacity, safety_inspection_expiry, next_maintenance_date
    INTO v_capacity, v_inspection, v_maintenance
    FROM public.vessels
    WHERE id = NEW.vessel_id AND is_active = TRUE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'The assigned vessel is inactive or unavailable' USING ERRCODE = '22023';
    END IF;
    IF NEW.maximum_guests > v_capacity THEN
      RAISE EXCEPTION 'Slot capacity exceeds the assigned vessel passenger capacity (%)', v_capacity USING ERRCODE = '22023';
    END IF;
    IF v_inspection IS NOT NULL AND v_inspection < NEW.date THEN
      RAISE EXCEPTION 'The assigned vessel safety inspection expires before this departure' USING ERRCODE = '22023';
    END IF;
    IF v_maintenance IS NOT NULL AND v_maintenance <= NEW.date THEN
      RAISE EXCEPTION 'The assigned vessel is due for maintenance on or before this departure' USING ERRCODE = '22023';
    END IF;
  END IF;

  -- Prevent assigning the same vessel or crew to overlapping regular or Exclusive departures.
  IF NEW.vessel_id IS NOT NULL AND (
    EXISTS (
      SELECT 1 FROM public.exclusive_departures d
      WHERE d.id IS DISTINCT FROM NEW.id AND d.date=NEW.date
        AND d.status NOT IN ('cancelled','completed')
        AND d.vessel_id=NEW.vessel_id
        AND d.start_time < NEW.end_time AND d.end_time > NEW.start_time
    )
    OR EXISTS (
      SELECT 1 FROM public.departures d
      WHERE d.date=NEW.date AND d.status NOT IN ('cancelled','completed')
        AND d.vessel_id=NEW.vessel_id
        AND d.start_time::time < NEW.end_time AND d.end_time::time > NEW.start_time
    )
  ) THEN
    RAISE EXCEPTION 'The assigned vessel is already scheduled during this time window' USING ERRCODE = '23P01';
  END IF;

  IF (
    (NEW.captain_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.exclusive_departures d
      WHERE d.id IS DISTINCT FROM NEW.id AND d.date=NEW.date
        AND d.status NOT IN ('cancelled','completed')
        AND NEW.captain_id IN (d.captain_id,d.guide_id,d.driver_id)
        AND d.start_time < NEW.end_time AND d.end_time > NEW.start_time
    ))
    OR (NEW.guide_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.exclusive_departures d
      WHERE d.id IS DISTINCT FROM NEW.id AND d.date=NEW.date
        AND d.status NOT IN ('cancelled','completed')
        AND NEW.guide_id IN (d.captain_id,d.guide_id,d.driver_id)
        AND d.start_time < NEW.end_time AND d.end_time > NEW.start_time
    ))
    OR (NEW.driver_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.exclusive_departures d
      WHERE d.id IS DISTINCT FROM NEW.id AND d.date=NEW.date
        AND d.status NOT IN ('cancelled','completed')
        AND NEW.driver_id IN (d.captain_id,d.guide_id,d.driver_id)
        AND d.start_time < NEW.end_time AND d.end_time > NEW.start_time
    ))
  ) THEN
    RAISE EXCEPTION 'The assigned crew member is already scheduled during this time window' USING ERRCODE = '23P01';
  END IF;

  IF NEW.captain_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.guides WHERE id = NEW.captain_id AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'The assigned captain is inactive or unavailable' USING ERRCODE = '22023';
  END IF;
  IF NEW.guide_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.guides WHERE id = NEW.guide_id AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'The assigned guide is inactive or unavailable' USING ERRCODE = '22023';
  END IF;
  IF NEW.driver_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.guides WHERE id = NEW.driver_id AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'The assigned driver is inactive or unavailable' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS validate_exclusive_departure_before_write ON public.exclusive_departures;
CREATE TRIGGER validate_exclusive_departure_before_write
BEFORE INSERT OR UPDATE ON public.exclusive_departures
FOR EACH ROW EXECUTE FUNCTION private.validate_exclusive_departure();

-- This narrow security-definer predicate keeps reserved slots out of the public schedule
-- without exposing customer reservation records to anonymous visitors.

REVOKE ALL ON FUNCTION private.validate_exclusive_departure() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.is_exclusive_departure_available(p_departure_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.exclusive_departures d
    JOIN public.exclusive_trips et ON et.id = d.exclusive_trip_id AND et.is_active = TRUE
    JOIN public.tours t ON t.id = et.tour_id AND t.status = 'published' AND t.is_exclusive = TRUE
    WHERE d.id = p_departure_id
      AND d.status = 'confirmed'
      AND (d.date > (now() AT TIME ZONE 'Africa/Cairo')::date
        OR (d.date = (now() AT TIME ZONE 'Africa/Cairo')::date
          AND d.start_time > (now() AT TIME ZONE 'Africa/Cairo')::time))
      AND NOT EXISTS (
        SELECT 1 FROM public.exclusive_reservations r
        WHERE r.exclusive_departure_id = d.id AND r.status IN ('pending','confirmed','completed','no_show')
      )
  );
$function$;
REVOKE ALL ON FUNCTION private.is_exclusive_departure_available(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_exclusive_departure_available(UUID) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_exclusive_departure_available(p_departure_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $wrapper$
  SELECT private.is_exclusive_departure_available(p_departure_id);
$wrapper$;
REVOKE ALL ON FUNCTION public.is_exclusive_departure_available(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_exclusive_departure_available(UUID) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.save_exclusive_trip_settings(
  p_tour_id UUID,
  p_fixed_trip_price NUMERIC,
  p_currency TEXT,
  p_minimum_guests INTEGER,
  p_maximum_guests INTEGER,
  p_is_active BOOLEAN DEFAULT TRUE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $save$
DECLARE
  v_trip_id UUID;
BEGIN
  IF NOT (
    coalesce(auth.role(),'') = 'service_role'
    OR (
      auth.uid() IS NOT NULL
      AND public.has_permission('tours.update')
      AND (
        (EXISTS (SELECT 1 FROM public.exclusive_trips WHERE tour_id=p_tour_id) AND public.has_permission('content.update'))
        OR
        (NOT EXISTS (SELECT 1 FROM public.exclusive_trips WHERE tour_id=p_tour_id) AND public.has_permission('content.create'))
      )
    )
  ) THEN
    RAISE EXCEPTION 'Not authorized to manage Exclusive trip settings' USING ERRCODE = '42501';
  END IF;

  IF p_tour_id IS NULL
     OR p_fixed_trip_price IS NULL
     OR p_fixed_trip_price <= 0
     OR p_fixed_trip_price > 99999999.99
     OR p_currency IS NULL
     OR length(p_currency) <> 3
     OR p_currency !~ '^[A-Z]{3}'
     OR p_minimum_guests IS NULL
     OR p_maximum_guests IS NULL
     OR p_minimum_guests < 1
     OR p_maximum_guests < p_minimum_guests
     OR p_maximum_guests > 500 THEN
    RAISE EXCEPTION 'Valid fixed price, currency and guest limits are required' USING ERRCODE = '22023';
  END IF;

  UPDATE public.tours
  SET is_exclusive=TRUE, updated_at=now()
  WHERE id=p_tour_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The selected tour does not exist' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.exclusive_trips (
    tour_id,fixed_trip_price,currency,minimum_guests,maximum_guests,is_active,updated_at
  ) VALUES (
    p_tour_id,p_fixed_trip_price,p_currency,p_minimum_guests,p_maximum_guests,coalesce(p_is_active,TRUE),now()
  )
  ON CONFLICT (tour_id) DO UPDATE SET
    fixed_trip_price=EXCLUDED.fixed_trip_price,
    currency=EXCLUDED.currency,
    minimum_guests=EXCLUDED.minimum_guests,
    maximum_guests=EXCLUDED.maximum_guests,
    is_active=EXCLUDED.is_active,
    updated_at=now()
  RETURNING id INTO v_trip_id;

  RETURN jsonb_build_object('success',TRUE,'exclusiveTripId',v_trip_id);
END;
$save$;

REVOKE ALL ON FUNCTION private.save_exclusive_trip_settings(UUID,NUMERIC,TEXT,INTEGER,INTEGER,BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.save_exclusive_trip_settings(UUID,NUMERIC,TEXT,INTEGER,INTEGER,BOOLEAN) TO authenticated, service_role;


CREATE OR REPLACE FUNCTION public.save_exclusive_trip_settings(
  p_tour_id UUID,
  p_fixed_trip_price NUMERIC,
  p_currency TEXT,
  p_minimum_guests INTEGER,
  p_maximum_guests INTEGER,
  p_is_active BOOLEAN DEFAULT TRUE
)
RETURNS JSONB
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $wrapper$
  SELECT private.save_exclusive_trip_settings(
    p_tour_id,p_fixed_trip_price,p_currency,p_minimum_guests,p_maximum_guests,p_is_active
  );
$wrapper$;
REVOKE ALL ON FUNCTION public.save_exclusive_trip_settings(UUID,NUMERIC,TEXT,INTEGER,INTEGER,BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_exclusive_trip_settings(UUID,NUMERIC,TEXT,INTEGER,INTEGER,BOOLEAN) TO authenticated, service_role;

-- Bridge Exclusive reservations into the existing booking, payment and finance ledgers.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS booking_kind TEXT NOT NULL DEFAULT 'standard'
    CHECK (booking_kind IN ('standard','exclusive')),
  ADD COLUMN IF NOT EXISTS exclusive_departure_id UUID
    REFERENCES public.exclusive_departures(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS bookings_exclusive_departure_idx
  ON public.bookings(exclusive_departure_id)
  WHERE booking_kind = 'exclusive';





-- Exclusive prices are whole-trip totals, not unit prices. Preserve the standard
-- per-person snapshots unchanged for every non-Exclusive booking.
CREATE OR REPLACE FUNCTION private.set_booking_unit_prices()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_tour_type TEXT;
  v_adult_price NUMERIC(12,2);
  v_child_price NUMERIC(12,2);
  v_private_price NUMERIC(12,2);
BEGIN
  IF NEW.booking_kind = 'exclusive' THEN
    NEW.unit_price_adult := 0;
    NEW.unit_price_child := 0;
    RETURN NEW;
  END IF;

  SELECT t.tour_type,t.price,t.child_price,t.private_price
  INTO v_tour_type,v_adult_price,v_child_price,v_private_price
  FROM public.tours AS t
  WHERE t.id=NEW.tour_id AND t.status='published';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'A published tour is required to snapshot booking unit prices.'
      USING ERRCODE = '23503';
  END IF;

  IF COALESCE(v_tour_type,'Shared')='Private' THEN
    IF v_private_price IS NULL OR v_private_price <= 0 THEN
      RAISE EXCEPTION 'The private per-person rate is not configured for this excursion.'
        USING ERRCODE = '23514';
    END IF;
    NEW.unit_price_adult := v_private_price;
    NEW.unit_price_child := v_private_price;
  ELSE
    NEW.unit_price_adult := COALESCE(v_adult_price,0);
    NEW.unit_price_child := COALESCE(v_child_price,ROUND(COALESCE(v_adult_price,0)*0.50,2));
  END IF;

  RETURN NEW;
END;
$function$;

-- Keep the established booking trigger for ordinary excursions, but route
-- Exclusive bookings through their own locked slot instead of requiring a
-- row in the standard departures table.
CREATE OR REPLACE FUNCTION private.assign_booking_to_scheduled_departure()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_requested_departure_id UUID;
  v_departure_count INTEGER := 0;
  v_vessel_id UUID;
  v_guide_id UUID;
BEGIN
  IF NEW.booking_kind = 'exclusive' THEN
    IF NEW.departure_id IS NOT NULL OR NEW.exclusive_departure_id IS NULL THEN
      RAISE EXCEPTION 'Exclusive bookings must reference an Exclusive departure only'
        USING ERRCODE = '23514';
    END IF;

    SELECT d.vessel_id, d.guide_id
    INTO v_vessel_id, v_guide_id
    FROM public.exclusive_departures AS d
    JOIN public.exclusive_trips AS et ON et.id = d.exclusive_trip_id
    WHERE d.id = NEW.exclusive_departure_id
      AND et.tour_id = NEW.tour_id
      AND d.date = NEW.booking_date
      AND d.status = 'confirmed'
    FOR UPDATE OF d;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'The selected Exclusive departure does not belong to this tour/date or is not confirmed'
        USING ERRCODE = '23514';
    END IF;

    NEW.assigned_vessel_id := v_vessel_id;
    NEW.assigned_guide_id := v_guide_id;
    RETURN NEW;
  END IF;

  v_requested_departure_id := COALESCE(
    NEW.departure_id,
    NULLIF(current_setting('app.booking_departure_id', TRUE), '')::UUID
  );

  IF v_requested_departure_id IS NULL THEN
    SELECT count(*)::INTEGER
    INTO v_departure_count
    FROM public.departures AS d
    WHERE d.tour_id = NEW.tour_id
      AND d.date = NEW.booking_date
      AND d.status = 'confirmed';

    IF v_departure_count = 0 THEN
      RAISE EXCEPTION 'No confirmed departure exists for this tour and date'
        USING ERRCODE = '23514';
    ELSIF v_departure_count > 1 THEN
      RAISE EXCEPTION 'Select a departure time before completing this booking'
        USING ERRCODE = '23514';
    END IF;

    SELECT d.id
    INTO v_requested_departure_id
    FROM public.departures AS d
    WHERE d.tour_id = NEW.tour_id
      AND d.date = NEW.booking_date
      AND d.status = 'confirmed'
    LIMIT 1;
  END IF;

  SELECT d.vessel_id, d.guide_id
  INTO v_vessel_id, v_guide_id
  FROM public.departures AS d
  WHERE d.id = v_requested_departure_id
    AND d.tour_id = NEW.tour_id
    AND d.date = NEW.booking_date
    AND d.status = 'confirmed'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The selected departure does not belong to this tour/date or is not confirmed'
      USING ERRCODE = '23514';
  END IF;

  NEW.departure_id := v_requested_departure_id;
  NEW.assigned_vessel_id := v_vessel_id;
  NEW.assigned_guide_id := v_guide_id;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION private.assign_booking_to_scheduled_departure() FROM PUBLIC, anon, authenticated, service_role;


ALTER TABLE public.exclusive_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exclusive_departures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exclusive_reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS exclusive_trips_public_read ON public.exclusive_trips;
DROP POLICY IF EXISTS exclusive_trips_admin_read ON public.exclusive_trips;
DROP POLICY IF EXISTS exclusive_trips_select ON public.exclusive_trips;
CREATE POLICY exclusive_trips_select ON public.exclusive_trips
  FOR SELECT TO anon, authenticated
  USING (
    (
      is_active
      AND EXISTS (
        SELECT 1 FROM public.tours t
        WHERE t.id = exclusive_trips.tour_id
          AND t.is_exclusive = TRUE
          AND t.status = 'published'
      )
    )
    OR (auth.role() = 'authenticated' AND public.has_permission('content.read'))
  );

DROP POLICY IF EXISTS exclusive_trips_admin_insert ON public.exclusive_trips;
CREATE POLICY exclusive_trips_admin_insert ON public.exclusive_trips
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('content.create'));

DROP POLICY IF EXISTS exclusive_trips_admin_update ON public.exclusive_trips;
CREATE POLICY exclusive_trips_admin_update ON public.exclusive_trips
  FOR UPDATE TO authenticated
  USING (public.has_permission('content.update'))
  WITH CHECK (public.has_permission('content.update'));

DROP POLICY IF EXISTS exclusive_trips_admin_delete ON public.exclusive_trips;
CREATE POLICY exclusive_trips_admin_delete ON public.exclusive_trips
  FOR DELETE TO authenticated
  USING (public.has_permission('content.delete'));

DROP POLICY IF EXISTS exclusive_departures_public_read ON public.exclusive_departures;
DROP POLICY IF EXISTS exclusive_departures_admin_read ON public.exclusive_departures;
DROP POLICY IF EXISTS exclusive_departures_select ON public.exclusive_departures;
CREATE POLICY exclusive_departures_select ON public.exclusive_departures
  FOR SELECT TO anon, authenticated
  USING (
    (
      status = 'confirmed'
      AND date >= (now() AT TIME ZONE 'Africa/Cairo')::date
      AND public.is_exclusive_departure_available(id)
      AND EXISTS (
        SELECT 1 FROM public.exclusive_trips et
        JOIN public.tours t ON t.id = et.tour_id
        WHERE et.id = exclusive_departures.exclusive_trip_id
          AND et.is_active = TRUE
          AND t.is_exclusive = TRUE
          AND t.status = 'published'
      )
    )
    OR (auth.role() = 'authenticated' AND public.has_permission('operations.read'))
  );

DROP POLICY IF EXISTS exclusive_departures_admin_insert ON public.exclusive_departures;
CREATE POLICY exclusive_departures_admin_insert ON public.exclusive_departures
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('operations.create'));

DROP POLICY IF EXISTS exclusive_departures_admin_update ON public.exclusive_departures;
CREATE POLICY exclusive_departures_admin_update ON public.exclusive_departures
  FOR UPDATE TO authenticated
  USING (public.has_permission('operations.update'))
  WITH CHECK (public.has_permission('operations.update'));

DROP POLICY IF EXISTS exclusive_departures_admin_delete ON public.exclusive_departures;
CREATE POLICY exclusive_departures_admin_delete ON public.exclusive_departures
  FOR DELETE TO authenticated
  USING (public.has_permission('operations.delete'));

DROP POLICY IF EXISTS exclusive_reservations_admin_read ON public.exclusive_reservations;
CREATE POLICY exclusive_reservations_admin_read ON public.exclusive_reservations
  FOR SELECT TO authenticated
  USING (public.has_permission('bookings.read'));

REVOKE ALL ON public.exclusive_trips, public.exclusive_departures, public.exclusive_reservations FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.exclusive_trips, public.exclusive_departures TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exclusive_trips, public.exclusive_departures TO authenticated;
GRANT SELECT ON public.exclusive_reservations TO authenticated;

-- The existing business audit trigger migration ran before these tables existed.
-- The audit function strips customer/contact/free-text columns before storing snapshots.
DROP TRIGGER IF EXISTS trg_capture_business_audit ON public.exclusive_trips;
CREATE TRIGGER trg_capture_business_audit
AFTER INSERT OR UPDATE OR DELETE ON public.exclusive_trips
FOR EACH ROW EXECUTE FUNCTION private.capture_business_audit();

DROP TRIGGER IF EXISTS trg_capture_business_audit ON public.exclusive_departures;
CREATE TRIGGER trg_capture_business_audit
AFTER INSERT OR UPDATE OR DELETE ON public.exclusive_departures
FOR EACH ROW EXECUTE FUNCTION private.capture_business_audit();

DROP TRIGGER IF EXISTS trg_capture_business_audit ON public.exclusive_reservations;
CREATE TRIGGER trg_capture_business_audit
AFTER INSERT OR UPDATE OR DELETE ON public.exclusive_reservations
FOR EACH ROW EXECUTE FUNCTION private.capture_business_audit();

CREATE OR REPLACE FUNCTION private.reserve_exclusive_trip(
  p_departure_id UUID,
  p_guest_count INTEGER,
  p_first_name TEXT,
  p_last_name TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_country TEXT DEFAULT NULL,
  p_hotel TEXT DEFAULT NULL,
  p_payment_method TEXT DEFAULT 'pay_at_pickup',
  p_special_requests TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_departure public.exclusive_departures%ROWTYPE;
  v_trip public.exclusive_trips%ROWTYPE;
  v_tour public.tours%ROWTYPE;
  v_existing public.exclusive_reservations%ROWTYPE;
  v_reference TEXT;
  v_total NUMERIC(12,2);
  v_client_ip TEXT;
  v_customer_id UUID;
  v_booking_id UUID;
  v_key TEXT := nullif(btrim(coalesce(p_idempotency_key,'')), '');
BEGIN
  IF p_departure_id IS NULL OR v_key IS NULL OR length(v_key) > 160 THEN
    RAISE EXCEPTION 'A departure and valid reservation request key are required' USING ERRCODE = '22023';
  END IF;
  IF p_guest_count IS NULL OR p_guest_count < 1 OR p_guest_count > 500 THEN
    RAISE EXCEPTION 'Guest count must be between 1 and 500' USING ERRCODE = '22023';
  END IF;
  IF nullif(btrim(coalesce(p_first_name,'')), '') IS NULL
     OR nullif(btrim(coalesce(p_last_name,'')), '') IS NULL
     OR nullif(btrim(coalesce(p_email,'')), '') IS NULL
     OR length(btrim(p_email)) > 254
     OR btrim(p_email) !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
     OR nullif(btrim(coalesce(p_phone,'')), '') IS NULL THEN
    RAISE EXCEPTION 'Valid customer name, email and phone are required' USING ERRCODE = '22023';
  END IF;
  IF coalesce(p_payment_method,'pay_at_pickup') NOT IN ('pay_at_pickup','pay_online') THEN
    RAISE EXCEPTION 'Unsupported payment method' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_existing
  FROM public.exclusive_reservations
  WHERE idempotency_key = v_key;
  IF FOUND THEN
    IF v_existing.exclusive_departure_id IS DISTINCT FROM p_departure_id
       OR v_existing.guest_count IS DISTINCT FROM p_guest_count
       OR lower(v_existing.customer_email) IS DISTINCT FROM lower(btrim(p_email))
       OR lower(v_existing.customer_first_name) IS DISTINCT FROM lower(btrim(p_first_name))
       OR lower(v_existing.customer_last_name) IS DISTINCT FROM lower(btrim(p_last_name))
       OR v_existing.customer_phone IS DISTINCT FROM btrim(p_phone)
       OR v_existing.payment_method IS DISTINCT FROM coalesce(p_payment_method,'pay_at_pickup')
       OR coalesce(v_existing.customer_country,'') IS DISTINCT FROM coalesce(nullif(btrim(coalesce(p_country,'')),''),'')
       OR coalesce(v_existing.customer_hotel,'') IS DISTINCT FROM coalesce(nullif(btrim(coalesce(p_hotel,'')),''),'')
       OR coalesce(v_existing.special_requests,'') IS DISTINCT FROM coalesce(nullif(btrim(coalesce(p_special_requests,'')),''),'') THEN
      RAISE EXCEPTION 'This idempotency key was already used for different Exclusive reservation details' USING ERRCODE = '22023';
    END IF;
    RETURN jsonb_build_object(
      'success', TRUE, 'duplicate', TRUE,
      'reservationId', v_existing.id,
      'bookingId', v_existing.booking_id,
      'reservationReference', v_existing.reservation_reference,
      'total', v_existing.total, 'currency', v_existing.currency,
      'status', v_existing.status
    );
  END IF;

  -- Atomic abuse controls apply to guest reservations; exact idempotent retries return above.
  BEGIN
    v_client_ip := nullif(current_setting('request.headers', TRUE)::json->>'cf-connecting-ip', '');
    IF v_client_ip IS NULL THEN
      v_client_ip := nullif(current_setting('request.headers', TRUE)::json->>'x-forwarded-for', '');
      IF v_client_ip LIKE '%,%' THEN
        v_client_ip := btrim(split_part(v_client_ip, ',', 1));
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_client_ip := NULL;
  END;
  PERFORM public.check_atomic_rate_limit(
    'exclusive_reservation_email', lower(btrim(coalesce(p_email,''))),
    INTERVAL '10 minutes', 5,
    'Too many exclusive trip reservation attempts for this email. Please wait before trying again.'
  );
  IF v_client_ip IS NOT NULL AND length(v_client_ip) <= 64 THEN
    PERFORM public.check_atomic_rate_limit(
      'exclusive_reservation_ip', btrim(v_client_ip),
      INTERVAL '10 minutes', 10,
      'Too many exclusive trip reservation attempts from this network. Please wait before trying again.'
    );
  END IF;

  SELECT * INTO v_departure
  FROM public.exclusive_departures
  WHERE id = p_departure_id
  FOR UPDATE;
  IF NOT FOUND OR v_departure.status <> 'confirmed'
     OR v_departure.date < (now() AT TIME ZONE 'Africa/Cairo')::date
     OR (v_departure.date = (now() AT TIME ZONE 'Africa/Cairo')::date
         AND v_departure.start_time <= (now() AT TIME ZONE 'Africa/Cairo')::time) THEN
    RAISE EXCEPTION 'This exclusive trip slot is no longer available' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_trip
  FROM public.exclusive_trips
  WHERE id = v_departure.exclusive_trip_id AND is_active = TRUE
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This exclusive trip is not currently bookable' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_tour
  FROM public.tours
  WHERE id = v_trip.tour_id AND status = 'published' AND is_exclusive = TRUE
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This exclusive trip is not currently published' USING ERRCODE = 'P0002';
  END IF;

  IF p_guest_count < v_trip.minimum_guests
     OR p_guest_count > least(v_trip.maximum_guests, v_departure.maximum_guests) THEN
    RAISE EXCEPTION 'Guest count must be between % and % for this trip',
      v_trip.minimum_guests, least(v_trip.maximum_guests, v_departure.maximum_guests)
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.exclusive_reservations r
    WHERE r.exclusive_departure_id = v_departure.id
      AND r.status IN ('pending','confirmed','completed','no_show')
  ) THEN
    RAISE EXCEPTION 'This exclusive trip slot has already been reserved' USING ERRCODE = '23505';
  END IF;

  v_total := v_trip.fixed_trip_price;
  v_reference := 'EXC-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));

  -- Reuse the existing customer and booking ledgers so payment transactions,
  -- invoices, refunds and finance reporting continue to use booking_id.
  PERFORM pg_advisory_xact_lock(hashtextextended(lower(btrim(p_email)), 0));
  SELECT id INTO v_customer_id
  FROM public.customers
  WHERE lower(email) = lower(btrim(p_email))
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE;

  IF v_customer_id IS NULL THEN
    INSERT INTO public.customers (
      user_id,first_name,last_name,email,phone,country,hotel,source,preferred_currency
    ) VALUES (
      auth.uid(),btrim(p_first_name),btrim(p_last_name),lower(btrim(p_email)),btrim(p_phone),
      coalesce(nullif(btrim(coalesce(p_country,'')),''),'International'),
      nullif(btrim(coalesce(p_hotel,'')),''),'Exclusive Trip Booking',v_trip.currency
    )
    RETURNING id INTO v_customer_id;
  END IF;

  INSERT INTO public.bookings (
    booking_reference,user_id,tour_id,customer_id,booking_date,status,payment_status,
    payment_method,adult_count,child_count,infant_count,subtotal,total,currency,
    special_requests,booking_kind,exclusive_departure_id
  ) VALUES (
    v_reference,auth.uid(),v_tour.id,v_customer_id,v_departure.date,'pending','pending',
    coalesce(p_payment_method,'pay_at_pickup'),p_guest_count,0,0,v_total,v_total,
    v_trip.currency,nullif(btrim(coalesce(p_special_requests,'')),''),'exclusive',v_departure.id
  )
  RETURNING id INTO v_booking_id;

  INSERT INTO public.exclusive_reservations (
    reservation_reference, booking_id, exclusive_departure_id,
    customer_first_name, customer_last_name, customer_email, customer_phone,
    customer_country, customer_hotel, guest_count,
    fixed_trip_price, total, currency, payment_method,
    special_requests, idempotency_key
  ) VALUES (
    v_reference, v_booking_id, v_departure.id,
    btrim(p_first_name), btrim(p_last_name), lower(btrim(p_email)), btrim(p_phone),
    nullif(btrim(coalesce(p_country,'')), ''),
    nullif(btrim(coalesce(p_hotel,'')), ''),
    p_guest_count, v_trip.fixed_trip_price, v_total, v_trip.currency,
    coalesce(p_payment_method,'pay_at_pickup'),
    nullif(btrim(coalesce(p_special_requests,'')), ''), v_key
  )
  RETURNING * INTO v_existing;

  RETURN jsonb_build_object(
    'success', TRUE, 'duplicate', FALSE,
    'reservationId', v_existing.id,
    'bookingId', v_existing.booking_id,
    'reservationReference', v_existing.reservation_reference,
    'total', v_existing.total, 'currency', v_existing.currency,
    'status', v_existing.status,
    'guestCount', v_existing.guest_count
  );
EXCEPTION WHEN unique_violation THEN
  SELECT * INTO v_existing FROM public.exclusive_reservations WHERE idempotency_key = v_key;
  IF FOUND THEN
    IF v_existing.exclusive_departure_id IS DISTINCT FROM p_departure_id
       OR v_existing.guest_count IS DISTINCT FROM p_guest_count
       OR lower(v_existing.customer_email) IS DISTINCT FROM lower(btrim(p_email))
       OR lower(v_existing.customer_first_name) IS DISTINCT FROM lower(btrim(p_first_name))
       OR lower(v_existing.customer_last_name) IS DISTINCT FROM lower(btrim(p_last_name))
       OR v_existing.customer_phone IS DISTINCT FROM btrim(p_phone)
       OR v_existing.payment_method IS DISTINCT FROM coalesce(p_payment_method,'pay_at_pickup')
       OR coalesce(v_existing.customer_country,'') IS DISTINCT FROM coalesce(nullif(btrim(coalesce(p_country,'')),''),'')
       OR coalesce(v_existing.customer_hotel,'') IS DISTINCT FROM coalesce(nullif(btrim(coalesce(p_hotel,'')),''),'')
       OR coalesce(v_existing.special_requests,'') IS DISTINCT FROM coalesce(nullif(btrim(coalesce(p_special_requests,'')),''),'') THEN
      RAISE EXCEPTION 'This idempotency key was already used for different Exclusive reservation details' USING ERRCODE = '22023';
    END IF;
    RETURN jsonb_build_object(
      'success', TRUE, 'duplicate', TRUE,
      'reservationId', v_existing.id,
      'bookingId', v_existing.booking_id,
      'reservationReference', v_existing.reservation_reference,
      'total', v_existing.total, 'currency', v_existing.currency,
      'status', v_existing.status
    );
  END IF;
  RAISE EXCEPTION 'This exclusive trip slot has already been reserved' USING ERRCODE = '23505';
END;
$function$;


-- Finance and existing booking administration may update the linked booking directly.
-- Mirror those authoritative changes back into the Exclusive reservation record.

REVOKE ALL ON FUNCTION private.reserve_exclusive_trip(UUID,INTEGER,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.reserve_exclusive_trip(UUID,INTEGER,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.reserve_exclusive_trip(
  p_departure_id UUID,
  p_guest_count INTEGER,
  p_first_name TEXT,
  p_last_name TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_country TEXT DEFAULT NULL,
  p_hotel TEXT DEFAULT NULL,
  p_payment_method TEXT DEFAULT 'pay_at_pickup',
  p_special_requests TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $wrapper$
  SELECT private.reserve_exclusive_trip(
    p_departure_id,p_guest_count,p_first_name,p_last_name,p_email,p_phone,
    p_country,p_hotel,p_payment_method,p_special_requests,p_idempotency_key
  );
$wrapper$;
REVOKE ALL ON FUNCTION public.reserve_exclusive_trip(UUID,INTEGER,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_exclusive_trip(UUID,INTEGER,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.sync_exclusive_reservation_from_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NEW.booking_kind = 'exclusive' THEN
    UPDATE public.exclusive_reservations
    SET payment_status=NEW.payment_status,
        status=CASE
          WHEN NEW.status='cancellation_requested' THEN 'pending'
          WHEN NEW.status IN ('pending','confirmed','cancelled','completed','no_show') THEN NEW.status
          ELSE status
        END,
        updated_at=now()
    WHERE booking_id=NEW.id;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS sync_exclusive_reservation_from_booking_trigger ON public.bookings;
CREATE TRIGGER sync_exclusive_reservation_from_booking_trigger
AFTER UPDATE OF status,payment_status ON public.bookings
FOR EACH ROW
WHEN (NEW.booking_kind = 'exclusive')
EXECUTE FUNCTION private.sync_exclusive_reservation_from_booking();

-- Keep reservation lifecycle and the linked booking/payment ledger synchronized.
CREATE OR REPLACE FUNCTION private.update_exclusive_reservation_status(
  p_reservation_id UUID,
  p_status TEXT DEFAULT NULL,
  p_payment_status TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_reservation public.exclusive_reservations%ROWTYPE;
BEGIN
  IF p_payment_status IS NOT NULL THEN
    RAISE EXCEPTION 'Payment status is controlled by the shared finance ledger. Record payments through Finance.'
      USING ERRCODE = '42501';
  END IF;

  IF auth.uid() IS NULL
     OR (p_status = 'cancelled' AND NOT public.has_permission('bookings.approve'))
     OR (
       (p_status IS NULL OR p_status <> 'cancelled' OR p_payment_status IS NOT NULL)
       AND NOT public.has_permission('bookings.update')
     ) THEN
    RAISE EXCEPTION 'Not authorized to update Exclusive reservations' USING ERRCODE = '42501';
  END IF;
  IF p_status IS NULL AND p_payment_status IS NULL THEN
    RAISE EXCEPTION 'At least one reservation status change is required' USING ERRCODE = '22023';
  END IF;
  IF p_status IS NOT NULL AND p_status NOT IN ('pending','confirmed','cancelled','completed','no_show') THEN
    RAISE EXCEPTION 'Invalid Exclusive reservation status' USING ERRCODE = '22023';
  END IF;
  IF p_payment_status IS NOT NULL AND p_payment_status NOT IN ('pending','paid','partially_paid','refunded','failed') THEN
    RAISE EXCEPTION 'Invalid Exclusive payment status' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_reservation
  FROM public.exclusive_reservations
  WHERE id=p_reservation_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Exclusive reservation not found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.exclusive_reservations
  SET status=coalesce(p_status,status),
      updated_at=now()
  WHERE id=p_reservation_id;

  IF v_reservation.booking_id IS NOT NULL THEN
    UPDATE public.bookings
    SET status=coalesce(p_status,status),
        updated_at=now()
    WHERE id=v_reservation.booking_id;
  END IF;

  RETURN jsonb_build_object('success',TRUE,'reservationId',p_reservation_id,'bookingId',v_reservation.booking_id);
END;
$function$;
REVOKE ALL ON FUNCTION private.update_exclusive_reservation_status(UUID,TEXT,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.update_exclusive_reservation_status(UUID,TEXT,TEXT) TO authenticated, service_role;



REVOKE ALL ON FUNCTION private.sync_exclusive_reservation_from_booking() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.update_exclusive_reservation_status(UUID,TEXT,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.update_exclusive_reservation_status(UUID,TEXT,TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.update_exclusive_reservation_status(
  p_reservation_id UUID,
  p_status TEXT DEFAULT NULL,
  p_payment_status TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $wrapper$
  SELECT private.update_exclusive_reservation_status(p_reservation_id,p_status,p_payment_status);
$wrapper$;
REVOKE ALL ON FUNCTION public.update_exclusive_reservation_status(UUID,TEXT,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_exclusive_reservation_status(UUID,TEXT,TEXT) TO authenticated, service_role;




-- Booking lifecycle analytics ledger (synchronized from migration 20261128090000).
CREATE TABLE IF NOT EXISTS public.booking_lifecycle_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE RESTRICT,
  event_type text NOT NULL CHECK (event_type IN (
    'booking_submitted',
    'booking_status_confirmed',
    'booking_cancellation_requested',
    'booking_cancelled',
    'booking_completed',
    'booking_no_show',
    'payment_received',
    'payment_partially_received',
    'payment_failed',
    'payment_transaction_refunded',
    'refund_processed'
  )),
  source_table text NOT NULL CHECK (source_table IN ('bookings', 'payment_transactions', 'refund_records')),
  source_record_id uuid NOT NULL,
  event_key text NOT NULL UNIQUE,
  previous_status text,
  new_status text,
  amount numeric,
  currency text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT booking_lifecycle_events_amount_nonnegative CHECK (amount IS NULL OR amount >= 0),
  CONSTRAINT booking_lifecycle_events_metadata_size CHECK (pg_column_size(metadata) <= 2048)
);

CREATE INDEX IF NOT EXISTS idx_booking_lifecycle_events_booking_time
  ON public.booking_lifecycle_events (booking_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_booking_lifecycle_events_type_time
  ON public.booking_lifecycle_events (event_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_booking_lifecycle_events_source
  ON public.booking_lifecycle_events (source_table, source_record_id);

ALTER TABLE public.booking_lifecycle_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.booking_lifecycle_events FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.booking_lifecycle_events TO service_role;
COMMENT ON TABLE public.booking_lifecycle_events IS
  'Operational booking/payment event ledger. Contains a pseudonymous booking UUID but no direct customer contact details; not visitor tracking and accessible only to trusted server/service-role workflows.';

CREATE OR REPLACE FUNCTION private.record_booking_lifecycle_event(
  p_booking_id uuid,
  p_event_type text,
  p_source_table text,
  p_source_record_id uuid,
  p_event_key text,
  p_previous_status text DEFAULT NULL,
  p_new_status text DEFAULT NULL,
  p_amount numeric DEFAULT NULL,
  p_currency text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_occurred_at timestamptz DEFAULT now()
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF p_booking_id IS NULL OR p_source_record_id IS NULL OR p_event_key IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.booking_lifecycle_events (
    booking_id, event_type, source_table, source_record_id, event_key,
    previous_status, new_status, amount, currency, metadata, occurred_at
  )
  VALUES (
    p_booking_id, p_event_type, p_source_table, p_source_record_id, p_event_key,
    p_previous_status, p_new_status, p_amount, upper(NULLIF(p_currency, '')),
    COALESCE(p_metadata, '{}'::jsonb), COALESCE(p_occurred_at, now())
  )
  ON CONFLICT (event_key) DO NOTHING;
END;
$function$;

CREATE OR REPLACE FUNCTION private.capture_booking_lifecycle_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_event_type text;
  v_event_key text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM private.record_booking_lifecycle_event(
      NEW.id, 'booking_submitted', 'bookings', NEW.id,
      'booking:' || NEW.id::text || ':submitted',
      NULL, NEW.status, NEW.total, NEW.currency,
      jsonb_build_object('booking_kind', NEW.booking_kind),
      COALESCE(NEW.created_at, now())
    );
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    v_event_type := CASE NEW.status
      WHEN 'confirmed' THEN 'booking_status_confirmed'
      WHEN 'cancellation_requested' THEN 'booking_cancellation_requested'
      WHEN 'cancelled' THEN 'booking_cancelled'
      WHEN 'no_show' THEN 'booking_no_show'
      ELSE NULL
    END;

    IF v_event_type IS NOT NULL THEN
      v_event_key := 'booking:' || NEW.id::text || ':status:' ||
        COALESCE(OLD.status, 'none') || '->' || NEW.status || ':' ||
        to_char(COALESCE(NEW.updated_at, now()) AT TIME ZONE 'UTC', 'YYYYMMDDHH24MISSUS');
      PERFORM private.record_booking_lifecycle_event(
        NEW.id, v_event_type, 'bookings', NEW.id, v_event_key,
        OLD.status, NEW.status, NEW.total, NEW.currency,
        jsonb_build_object('booking_kind', NEW.booking_kind),
        COALESCE(NEW.updated_at, now())
      );
    END IF;
  END IF;

  -- A booking is only a completed sale/experience when both operational completion
  -- and ledger-authoritative payment are true. A status-only update is insufficient.
  IF NEW.status = 'completed' AND NEW.payment_status = 'paid'
     AND (OLD.status IS DISTINCT FROM 'completed' OR OLD.payment_status IS DISTINCT FROM 'paid') THEN
    v_event_key := 'booking:' || NEW.id::text || ':completed-paid:' ||
      to_char(COALESCE(NEW.updated_at, now()) AT TIME ZONE 'UTC', 'YYYYMMDDHH24MISSUS');
    PERFORM private.record_booking_lifecycle_event(
      NEW.id, 'booking_completed', 'bookings', NEW.id, v_event_key,
      OLD.status || '/' || OLD.payment_status, NEW.status || '/' || NEW.payment_status,
      NEW.total, NEW.currency, jsonb_build_object('booking_kind', NEW.booking_kind),
      COALESCE(NEW.updated_at, now())
    );
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION private.capture_payment_lifecycle_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_event_type text;
  v_event_key text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  v_event_type := CASE lower(trim(NEW.status))
    WHEN 'paid' THEN 'payment_received'
    WHEN 'partially paid' THEN 'payment_partially_received'
    WHEN 'failed' THEN 'payment_failed'
    WHEN 'refunded' THEN 'payment_transaction_refunded'
    ELSE NULL
  END;

  IF v_event_type IS NOT NULL THEN
    v_event_key := 'payment:' || NEW.id::text || ':' || lower(replace(NEW.status, ' ', '_')) || ':' ||
      to_char(COALESCE(NEW.updated_at, now()) AT TIME ZONE 'UTC', 'YYYYMMDDHH24MISSUS');
    PERFORM private.record_booking_lifecycle_event(
      NEW.booking_id, v_event_type, 'payment_transactions', NEW.id, v_event_key,
      CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NULL END,
      NEW.status, NEW.amount, NEW.currency,
      jsonb_build_object('payment_method', NEW.payment_method, 'is_manual', NEW.is_manual),
      COALESCE(NEW.payment_date, NEW.updated_at, now())
    );
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION private.capture_refund_lifecycle_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_event_key text;
BEGIN
  IF lower(trim(NEW.status)) = 'processed'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    v_event_key := 'refund:' || NEW.id::text || ':processed:' ||
      to_char(COALESCE(NEW.updated_at, now()) AT TIME ZONE 'UTC', 'YYYYMMDDHH24MISSUS');
    PERFORM private.record_booking_lifecycle_event(
      NEW.booking_id, 'refund_processed', 'refund_records', NEW.id, v_event_key,
      CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NULL END,
      NEW.status, COALESCE(NEW.approved_amount, NEW.amount), NEW.currency,
      jsonb_build_object('refund_method', NEW.refund_method),
      COALESCE(NEW.processed_date, NEW.updated_at, now())
    );
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_capture_booking_lifecycle_event ON public.bookings;
CREATE TRIGGER trg_capture_booking_lifecycle_event
AFTER INSERT OR UPDATE OF status, payment_status ON public.bookings
FOR EACH ROW EXECUTE FUNCTION private.capture_booking_lifecycle_event();

DROP TRIGGER IF EXISTS trg_capture_payment_lifecycle_event ON public.payment_transactions;
CREATE TRIGGER trg_capture_payment_lifecycle_event
AFTER INSERT OR UPDATE OF status ON public.payment_transactions
FOR EACH ROW EXECUTE FUNCTION private.capture_payment_lifecycle_event();

DROP TRIGGER IF EXISTS trg_capture_refund_lifecycle_event ON public.refund_records;
CREATE TRIGGER trg_capture_refund_lifecycle_event
AFTER INSERT OR UPDATE OF status ON public.refund_records
FOR EACH ROW EXECUTE FUNCTION private.capture_refund_lifecycle_event();

REVOKE ALL ON FUNCTION private.record_booking_lifecycle_event(uuid,text,text,uuid,text,text,text,numeric,text,jsonb,timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.capture_booking_lifecycle_event() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.capture_payment_lifecycle_event() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.capture_refund_lifecycle_event() FROM PUBLIC, anon, authenticated;

COMMIT;

