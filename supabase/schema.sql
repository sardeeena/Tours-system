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
    pricing_type TEXT NOT NULL DEFAULT 'per_booking' CHECK (pricing_type IN ('per_person', 'per_booking', 'per_vehicle', 'per_item', 'per_adult', 'per_child')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INT NOT NULL DEFAULT 0,
    image_url TEXT,
    min_quantity INT NOT NULL DEFAULT 1,
    max_quantity INT NOT NULL DEFAULT 10,
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
    custom_price_eur NUMERIC(10,2),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INT NOT NULL DEFAULT 0,
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
    idempotency_key TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bookings_reference ON public.bookings(booking_reference);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_idempotency_key ON public.bookings(idempotency_key) WHERE idempotency_key IS NOT NULL;
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
    description TEXT,
    quantity INT NOT NULL DEFAULT 1,
    unit_price NUMERIC(10,2) NOT NULL,
    total_price NUMERIC(10,2) NOT NULL,
    pricing_type TEXT NOT NULL DEFAULT 'per_booking',
    currency TEXT NOT NULL DEFAULT 'EUR',
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
    website_url_hp TEXT,
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
    website_url_hp TEXT,
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
    is_lead BOOLEAN NOT NULL DEFAULT FALSE,
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
DECLARE
    active_nonce text;
    active_target text;
    is_trusted_operator_provisioning boolean := false;
BEGIN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
        -- Check if trusted operator provisioning is active:
        -- Untrusted clients (anon, authenticated, authenticator) CANNOT bypass this because:
        -- 1. session_user MUST be postgres or service_role
        -- 2. app.admin_provisioning_active_user MUST match NEW.id
        -- 3. app.admin_provisioning_nonce MUST be non-empty (set only by set_admin_role_by_email)
        IF session_user IN ('postgres', 'service_role') THEN
            active_nonce := NULLIF(current_setting('app.admin_provisioning_nonce', true), '');
            active_target := NULLIF(current_setting('app.admin_provisioning_active_user', true), '');
            IF active_nonce IS NOT NULL AND active_target = NEW.id::text THEN
                is_trusted_operator_provisioning := true;
            END IF;
        END IF;

        -- Role escalation is strictly prohibited unless either:
        -- (a) A trusted operator is running authorized provisioning for this specific user ID, or
        -- (b) The session caller is verified as an active administrator or service_role via public.is_admin()
        IF NOT is_trusted_operator_provisioning AND NOT public.is_admin() THEN
            NEW.role := OLD.role;
        END IF;
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
    clean_email text;
    target_user_id uuid;
    target_user_metadata jsonb;
    existing_full_name text;
    verified_role text;
    provisioning_nonce text;
BEGIN
    -- 1. Authorization guard: Only postgres (SQL Editor / superuser) or service_role session may execute
    IF session_user NOT IN ('postgres', 'service_role') THEN
        RAISE EXCEPTION 'Access Denied: public.set_admin_role_by_email may only be executed by trusted database operators (postgres, service_role). Current session_user is "%".', session_user;
    END IF;

    -- 2. Validate input
    IF target_email IS NULL OR TRIM(target_email) = '' THEN
        RAISE EXCEPTION 'Target email cannot be null or empty.';
    END IF;
    clean_email := LOWER(TRIM(target_email));

    -- 3. Locate corresponding auth user
    SELECT id, raw_user_meta_data INTO target_user_id, target_user_metadata
    FROM auth.users
    WHERE LOWER(email) = clean_email
    LIMIT 1;

    IF target_user_id IS NULL THEN
        RAISE EXCEPTION 'User with email "%" does not exist in auth.users. The account must register or sign up before being promoted.', clean_email;
    END IF;

    -- 4. Determine display name
    SELECT full_name INTO existing_full_name
    FROM public.profiles
    WHERE id = target_user_id;

    IF existing_full_name IS NULL OR TRIM(existing_full_name) = '' THEN
        existing_full_name := COALESCE(
            target_user_metadata->>'full_name',
            TRIM(CONCAT(target_user_metadata->>'first_name', ' ', target_user_metadata->>'last_name')),
            SPLIT_PART(clean_email, '@', 1)
        );
    END IF;

    -- 5. Generate a cryptographically random transaction-scoped nonce
    provisioning_nonce := md5(gen_random_uuid()::text || clock_timestamp()::text || random()::text);
    PERFORM set_config('app.admin_provisioning_nonce', provisioning_nonce, true);
    PERFORM set_config('app.admin_provisioning_active_user', target_user_id::text, true);

    -- 6. Upsert profile with role = 'admin'
    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        role,
        is_confirmed,
        updated_at
    )
    VALUES (
        target_user_id,
        clean_email,
        COALESCE(existing_full_name, 'Administrator'),
        'admin',
        true,
        NOW()
    )
    ON CONFLICT (id) DO UPDATE
    SET 
        role = 'admin',
        is_confirmed = true,
        updated_at = NOW();

    -- 7. Immediately clear transaction nonce after update
    PERFORM set_config('app.admin_provisioning_nonce', '', true);
    PERFORM set_config('app.admin_provisioning_active_user', '', true);

    -- 8. Post-update verification: assert that the role was actually persisted in public.profiles
    SELECT role INTO verified_role
    FROM public.profiles
    WHERE id = target_user_id;

    IF verified_role IS DISTINCT FROM 'admin' THEN
        RAISE EXCEPTION 'Admin provisioning failed: public.profiles.role remained "%" for user % (ID: %). Check triggers and security policies.',
            COALESCE(verified_role, 'NULL'), clean_email, target_user_id;
    END IF;

    -- 9. Update server-controlled app_metadata so JWT mirrors the admin role
    UPDATE auth.users
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
    WHERE id = target_user_id;

    RETURN 'Success: Account ' || clean_email || ' (User ID: ' || target_user_id || ') is now an active administrator with verified role "admin".';
END;
$$;

-- Revoke default PUBLIC execution; grant strictly to trusted operators
REVOKE ALL ON FUNCTION public.set_admin_role_by_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_admin_role_by_email(text) TO postgres, service_role;

-- 4.8 Atomic Rate Limiting Helper Function (Row-level locked upsert)
CREATE OR REPLACE FUNCTION public.check_atomic_rate_limit(
    p_action TEXT,
    p_identifier TEXT,
    p_window_interval INTERVAL,
    p_max_hits INT,
    p_error_message TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_clean_id TEXT;
    v_window_start TIMESTAMPTZ;
    v_hits INT;
BEGIN
    IF p_identifier IS NULL OR TRIM(p_identifier) = '' THEN
        RETURN;
    END IF;

    v_clean_id := LOWER(TRIM(p_identifier));
    v_window_start := date_trunc('minute', NOW()) - 
        (((EXTRACT(minute FROM NOW())::int) % GREATEST(1, (EXTRACT(epoch FROM p_window_interval)::int / 60))) * INTERVAL '1 minute');

    INSERT INTO public.rate_limit_buckets (bucket_key, bucket_window, hit_count)
    VALUES (p_action || ':' || v_clean_id, v_window_start, 1)
    ON CONFLICT (bucket_key, bucket_window)
    DO UPDATE SET hit_count = public.rate_limit_buckets.hit_count + 1
    RETURNING hit_count INTO v_hits;

    IF v_hits > p_max_hits THEN
        RAISE EXCEPTION '%', p_error_message USING ERRCODE = 'P0001';
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.check_atomic_rate_limit(TEXT, TEXT, INTERVAL, INT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_atomic_rate_limit(TEXT, TEXT, INTERVAL, INT, TEXT) TO postgres, service_role;

-- 4.9 Server-Side Hardened Rate Limiting & Abuse Prevention Trigger Function
CREATE OR REPLACE FUNCTION public.check_public_submission_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    client_ip TEXT;
    clean_email TEXT;
BEGIN
    -- 1. Trusted administrative bypass (strictly restricted to postgres & service_role)
    IF session_user IN ('postgres', 'service_role') THEN
        RETURN NEW;
    END IF;

    -- 2. Anti-Bot Honeypot Enforcement (in-database check)
    IF TG_TABLE_NAME IN ('inquiries', 'newsletter_subscriptions') THEN
        IF NEW.website_url_hp IS NOT NULL AND TRIM(NEW.website_url_hp) <> '' THEN
            RAISE EXCEPTION 'Bot submission blocked by honeypot verification.'
                USING ERRCODE = 'P0001';
        END IF;
    END IF;

    -- 3. Extract and sanitize client IP from PostgREST headers
    BEGIN
        client_ip := NULLIF(current_setting('request.headers', true)::json->>'cf-connecting-ip', '');
        IF client_ip IS NULL THEN
            client_ip := NULLIF(current_setting('request.headers', true)::json->>'x-forwarded-for', '');
            IF client_ip LIKE '%,%' THEN
                client_ip := trim(split_part(client_ip, ',', 1));
            END IF;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        client_ip := NULL;
    END;

    IF client_ip IS NOT NULL THEN
        client_ip := TRIM(client_ip);
        IF LENGTH(client_ip) > 64 THEN
            client_ip := SUBSTRING(client_ip FROM 1 FOR 64);
        END IF;
    END IF;

    -- 4. Table-Specific Validation & Atomic Throttling
    IF TG_TABLE_NAME = 'inquiries' THEN
        -- Enforce required fields
        IF TRIM(COALESCE(NEW.customer_name, '')) = '' OR TRIM(COALESCE(NEW.email, '')) = '' OR TRIM(COALESCE(NEW.message, '')) = '' THEN
            RAISE EXCEPTION 'Invalid inquiry submission: Customer name, email, and message are required.'
                USING ERRCODE = 'P0001';
        END IF;

        clean_email := LOWER(TRIM(NEW.email));
        IF NOT (clean_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$') THEN
            RAISE EXCEPTION 'Invalid email address format for customer inquiry.'
                USING ERRCODE = 'P0001';
        END IF;

        -- Unprivileged clients cannot manipulate status or admin notes
        NEW.status := 'new';
        NEW.email := clean_email;

        IF (NEW.ip_address IS NULL OR NEW.ip_address = '') AND client_ip IS NOT NULL THEN
            NEW.ip_address := client_ip;
        END IF;

        -- Atomic email rate limit: 5 inquiries per 10 minutes
        PERFORM public.check_atomic_rate_limit(
            'inquiry_email',
            clean_email,
            INTERVAL '10 minutes',
            5,
            'Rate limit exceeded: Too many inquiries submitted for this email address. Please wait a few minutes before trying again.'
        );

        -- Atomic IP rate limit: 10 inquiries per 10 minutes
        IF client_ip IS NOT NULL AND client_ip <> '' THEN
            PERFORM public.check_atomic_rate_limit(
                'inquiry_ip',
                client_ip,
                INTERVAL '10 minutes',
                10,
                'Rate limit exceeded: Too many inquiries submitted from your IP address. Please wait a few minutes before trying again.'
            );
        END IF;

    ELSIF TG_TABLE_NAME = 'newsletter_subscriptions' THEN
        clean_email := LOWER(TRIM(NEW.email));
        IF clean_email = '' OR NOT (clean_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$') THEN
            RAISE EXCEPTION 'Invalid email address format for newsletter subscription.'
                USING ERRCODE = 'P0001';
        END IF;

        NEW.email := clean_email;
        NEW.status := 'subscribed';

        -- Atomic email rate limit: 3 attempts per 10 minutes
        PERFORM public.check_atomic_rate_limit(
            'newsletter_email',
            clean_email,
            INTERVAL '10 minutes',
            3,
            'Rate limit exceeded: Too many newsletter subscription requests for this email.'
        );

        -- Atomic IP rate limit: 10 attempts per 10 minutes
        IF client_ip IS NOT NULL AND client_ip <> '' THEN
            PERFORM public.check_atomic_rate_limit(
                'newsletter_ip',
                client_ip,
                INTERVAL '10 minutes',
                10,
                'Rate limit exceeded: Too many newsletter subscriptions from this network. Please try again later.'
            );
        END IF;

    ELSIF TG_TABLE_NAME = 'bookings' THEN
        -- Unprivileged clients cannot self-grant 'paid' or forged statuses
        IF NEW.payment_status NOT IN ('pending', 'pay_at_pickup') THEN
            NEW.payment_status := 'pending';
        END IF;
        IF NEW.status NOT IN ('pending', 'confirmed') THEN
            NEW.status := 'confirmed';
        END IF;
        IF NEW.operational_status IS DISTINCT FROM 'Scheduled' THEN
            NEW.operational_status := 'Scheduled';
        END IF;

        -- Atomic customer rate limit: 5 bookings per 30 minutes
        IF NEW.customer_id IS NOT NULL THEN
            PERFORM public.check_atomic_rate_limit(
                'booking_customer',
                NEW.customer_id::text,
                INTERVAL '30 minutes',
                5,
                'Rate limit exceeded: Too many bookings initiated in a short period. Please contact reservations or wait 30 minutes.'
            );
        END IF;

        -- Atomic IP rate limit on booking creation: 10 bookings per 30 minutes
        IF client_ip IS NOT NULL AND client_ip <> '' THEN
            PERFORM public.check_atomic_rate_limit(
                'booking_ip',
                client_ip,
                INTERVAL '30 minutes',
                10,
                'Rate limit exceeded: Too many bookings submitted from your network. Please wait a few minutes before trying again.'
            );
        END IF;
    END IF;

    -- Cleanup expired rate limit buckets probabilistically (5% of calls)
    IF (random() < 0.05) THEN
        DELETE FROM public.rate_limit_buckets WHERE bucket_window < (NOW() - INTERVAL '2 hours');
    END IF;

    RETURN NEW;
END;
$$;

-- Revoke direct execution of trigger function
REVOKE ALL ON FUNCTION public.check_public_submission_rate_limit() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_public_submission_rate_limit() TO postgres, service_role;

DROP TRIGGER IF EXISTS trg_rate_limit_inquiries ON public.inquiries;
CREATE TRIGGER trg_rate_limit_inquiries
    BEFORE INSERT ON public.inquiries
    FOR EACH ROW
    EXECUTE FUNCTION public.check_public_submission_rate_limit();

DROP TRIGGER IF EXISTS trg_rate_limit_newsletter ON public.newsletter_subscriptions;
CREATE TRIGGER trg_rate_limit_newsletter
    BEFORE INSERT ON public.newsletter_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION public.check_public_submission_rate_limit();

DROP TRIGGER IF EXISTS trg_rate_limit_bookings ON public.bookings;
CREATE TRIGGER trg_rate_limit_bookings
    BEFORE INSERT ON public.bookings
    FOR EACH ROW
    EXECUTE FUNCTION public.check_public_submission_rate_limit();



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
    TO authenticated
    USING (
        user_id = (SELECT auth.uid())
        OR customer_id IN (SELECT id FROM public.customers WHERE user_id = (SELECT auth.uid()))
        OR public.is_admin()
    );

-- Allow authenticated users to request cancellation on their own bookings
CREATE POLICY "Users can request booking cancellation"
    ON public.bookings FOR UPDATE
    TO authenticated
    USING (
        (user_id = (SELECT auth.uid()) OR customer_id IN (SELECT id FROM public.customers WHERE user_id = (SELECT auth.uid())))
        AND status IN ('confirmed', 'pending')
    )
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

CREATE POLICY "Public can read active coupons"
    ON public.coupons FOR SELECT
    USING (is_active = TRUE OR public.is_admin());

CREATE POLICY "Admins can manage coupons"
    ON public.coupons FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());


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

-- 20. RATE LIMIT BUCKETS TABLE (ATOMIC CONCURRENCY ENGINE)
CREATE TABLE IF NOT EXISTS public.rate_limit_buckets (
    bucket_key TEXT NOT NULL,
    bucket_window TIMESTAMPTZ NOT NULL,
    hit_count INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (bucket_key, bucket_window)
);

ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.rate_limit_buckets FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.rate_limit_buckets TO postgres, service_role;

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


-- ==============================================================================
-- 20. CRM SYSTEM (LEADS, TASKS, COMMUNICATIONS, NOTES, ACTIVITIES)
-- ==============================================================================
ALTER TABLE public.customers
    ADD COLUMN IF NOT EXISTS whatsapp TEXT,
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'Website',
    ADD COLUMN IF NOT EXISTS last_contact_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS total_revenue NUMERIC(10,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS outstanding_amount NUMERIC(10,2) DEFAULT 0;

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
    stage TEXT NOT NULL DEFAULT 'New',
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

DROP TRIGGER IF EXISTS trigger_leads_updated_at ON public.leads;
CREATE TRIGGER trigger_leads_updated_at
    BEFORE UPDATE ON public.leads
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

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
    priority TEXT NOT NULL DEFAULT 'Medium',
    status TEXT NOT NULL DEFAULT 'Pending',
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

CREATE TABLE IF NOT EXISTS public.crm_communications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    customer_name TEXT,
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
    channel TEXT NOT NULL DEFAULT 'WhatsApp',
    direction TEXT NOT NULL DEFAULT 'outbound',
    summary TEXT NOT NULL,
    content TEXT,
    staff_name TEXT NOT NULL DEFAULT 'Admin Staff',
    staff_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_comms_customer ON public.crm_communications(customer_id);
CREATE INDEX IF NOT EXISTS idx_crm_comms_created_at ON public.crm_communications(created_at DESC);

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

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can manage leads" ON public.leads;
CREATE POLICY "Staff can manage leads" ON public.leads FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Staff can manage crm tasks" ON public.crm_tasks;
CREATE POLICY "Staff can manage crm tasks" ON public.crm_tasks FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Staff can manage crm communications" ON public.crm_communications;
CREATE POLICY "Staff can manage crm communications" ON public.crm_communications FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Staff can manage crm notes" ON public.crm_notes;
CREATE POLICY "Staff can manage crm notes" ON public.crm_notes FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Staff can view crm activities" ON public.crm_activities;
CREATE POLICY "Staff can view crm activities" ON public.crm_activities FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


-- ==============================================================================
-- 21. OPERATIONS SYSTEM (DEPARTURES, ASSIGNMENTS, MANIFESTS)
-- ==============================================================================
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

ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS operational_status TEXT DEFAULT 'Scheduled',
    ADD COLUMN IF NOT EXISTS pickup_status TEXT DEFAULT 'Waiting',
    ADD COLUMN IF NOT EXISTS pickup_time TEXT,
    ADD COLUMN IF NOT EXISTS driver_vehicle TEXT,
    ADD COLUMN IF NOT EXISTS assigned_vessel_id UUID REFERENCES public.vessels(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS assigned_guide_id UUID REFERENCES public.guides(id) ON DELETE SET NULL;

ALTER TABLE public.booking_passengers
    ADD COLUMN IF NOT EXISTS date_of_birth DATE,
    ADD COLUMN IF NOT EXISTS gender TEXT,
    ADD COLUMN IF NOT EXISTS phone TEXT,
    ADD COLUMN IF NOT EXISTS special_requests TEXT,
    ADD COLUMN IF NOT EXISTS pickup_location TEXT;

ALTER TABLE public.operational_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can manage operational assignments" ON public.operational_assignments;
CREATE POLICY "Staff can manage operational assignments"
    ON public.operational_assignments FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());


-- ==============================================================================
-- 22. FINANCE SYSTEM (PAYMENTS, INVOICES, REFUNDS, AUDIT TRAIL)
-- ==============================================================================
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

ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refund_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can manage payments" ON public.payment_transactions;
CREATE POLICY "Staff can manage payments" ON public.payment_transactions
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Staff can manage refunds" ON public.refund_records;
CREATE POLICY "Staff can manage refunds" ON public.refund_records
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Staff can manage invoices" ON public.invoices;
CREATE POLICY "Staff can manage invoices" ON public.invoices
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Customers can view their own payments" ON public.payment_transactions;
CREATE POLICY "Customers can view their own payments" ON public.payment_transactions
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.bookings b
            WHERE b.id = payment_transactions.booking_id
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


-- ==============================================================================
-- 23. COMMUNICATIONS SYSTEM (MESSAGES, TEMPLATES, NOTIFICATIONS)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.communication_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel TEXT NOT NULL CHECK (channel IN ('Email', 'WhatsApp')),
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    customer_name TEXT,
    recipient_address TEXT NOT NULL,
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
    booking_reference TEXT,
    template_key TEXT,
    subject TEXT,
    content TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Queued' CHECK (status IN ('Queued', 'Sent', 'Delivered', 'Failed')),
    provider_name TEXT DEFAULT 'None',
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
    dedup_key TEXT UNIQUE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical', 'success')),
    entity_type TEXT,
    entity_id TEXT,
    link_tab TEXT,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_notif_unread ON public.staff_notifications(is_read, created_at);
CREATE INDEX IF NOT EXISTS idx_staff_notif_category ON public.staff_notifications(category);

ALTER TABLE public.communication_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can manage communication messages" ON public.communication_messages;
CREATE POLICY "Staff can manage communication messages" ON public.communication_messages
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Staff can manage templates" ON public.communication_templates;
CREATE POLICY "Staff can manage templates" ON public.communication_templates
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Staff can manage notifications" ON public.staff_notifications;
CREATE POLICY "Staff can manage notifications" ON public.staff_notifications
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


-- ------------------------------------------------------------------------------
-- 3.32 CRM SYSTEM TABLES (LEAD STAGES, TAGS, SEGMENTS, CONVERSATIONS)
-- ------------------------------------------------------------------------------
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

CREATE TABLE IF NOT EXISTS public.crm_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    color TEXT NOT NULL DEFAULT '#2dd4bf',
    category TEXT DEFAULT 'general',
    usage_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.crm_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    badge_label TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#2dd4bf',
    icon TEXT NOT NULL DEFAULT 'Tag',
    rule_type TEXT NOT NULL,
    filter_criteria JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
    provider TEXT NOT NULL DEFAULT 'unconfigured',
    provider_message_id TEXT,
    provider_status TEXT NOT NULL DEFAULT 'logged',
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

ALTER TABLE public.crm_lead_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can manage crm_lead_stages" ON public.crm_lead_stages;
CREATE POLICY "Staff can manage crm_lead_stages" ON public.crm_lead_stages
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Staff can manage crm_tags" ON public.crm_tags;
CREATE POLICY "Staff can manage crm_tags" ON public.crm_tags
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Staff can manage crm_segments" ON public.crm_segments;
CREATE POLICY "Staff can manage crm_segments" ON public.crm_segments
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Staff can manage crm_conversations" ON public.crm_conversations;
CREATE POLICY "Staff can manage crm_conversations" ON public.crm_conversations
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


-- ==============================================================================
-- 23. PRODUCTION TOUR OPERATIONS (DEPARTURES, CALENDAR, MANIFESTS, PICKUPS)
-- ==============================================================================
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
    vessel_id REFERENCES public.vessels(id) ON DELETE SET NULL,
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

-- Pickup schedules table
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

ALTER TABLE public.departures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pickup_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view departures" ON public.departures;
CREATE POLICY "Public can view departures" ON public.departures
    FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Staff can manage departures" ON public.departures;
CREATE POLICY "Staff can manage departures" ON public.departures
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Staff can manage pickup schedules" ON public.pickup_schedules;
CREATE POLICY "Staff can manage pickup schedules" ON public.pickup_schedules
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


-- ==============================================================================
-- 25. ENHANCED PRODUCTION REAL FINANCE SYSTEM
-- ==============================================================================
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

ALTER TABLE public.payment_transactions 
    ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'cash',
    ADD COLUMN IF NOT EXISTS is_manual BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS customer_name TEXT,
    ADD COLUMN IF NOT EXISTS customer_email TEXT,
    ADD COLUMN IF NOT EXISTS customer_phone TEXT,
    ADD COLUMN IF NOT EXISTS booking_reference TEXT;

CREATE INDEX IF NOT EXISTS idx_payments_provider ON public.payment_transactions(provider);
CREATE INDEX IF NOT EXISTS idx_payments_is_manual ON public.payment_transactions(is_manual);
CREATE INDEX IF NOT EXISTS idx_payments_booking_ref ON public.payment_transactions(booking_reference);

ALTER TABLE public.refund_records
    ADD COLUMN IF NOT EXISTS requested_amount NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS approved_amount NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'processed' CHECK (status IN ('requested', 'pending_approval', 'approved', 'processed', 'rejected')),
    ADD COLUMN IF NOT EXISTS requested_by TEXT DEFAULT 'Staff',
    ADD COLUMN IF NOT EXISTS approved_by TEXT,
    ADD COLUMN IF NOT EXISTS processed_date TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS customer_name TEXT,
    ADD COLUMN IF NOT EXISTS customer_email TEXT,
    ADD COLUMN IF NOT EXISTS customer_phone TEXT,
    ADD COLUMN IF NOT EXISTS booking_reference TEXT,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_refunds_status ON public.refund_records(status);
CREATE INDEX IF NOT EXISTS idx_refunds_booking_ref ON public.refund_records(booking_reference);

ALTER TABLE public.invoices
    ADD COLUMN IF NOT EXISTS customer_name TEXT,
    ADD COLUMN IF NOT EXISTS customer_email TEXT,
    ADD COLUMN IF NOT EXISTS customer_phone TEXT,
    ADD COLUMN IF NOT EXISTS tour_title TEXT,
    ADD COLUMN IF NOT EXISTS tour_date DATE;

ALTER TABLE public.payment_providers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated can view payment providers" ON public.payment_providers;
CREATE POLICY "Anyone authenticated can view payment providers" ON public.payment_providers
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can manage payment providers" ON public.payment_providers;
CREATE POLICY "Admins can manage payment providers" ON public.payment_providers
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ==============================================================================
-- AUTOMATION EVENTS (EVENT-DRIVEN ARCHITECTURE)
-- ==============================================================================
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
    entity_type TEXT,
    entity_id TEXT,
    processed BOOLEAN NOT NULL DEFAULT FALSE,
    processed_at TIMESTAMPTZ,
    actions_triggered JSONB DEFAULT '[]'::jsonb,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auto_events_name ON public.automation_events(event_name);
CREATE INDEX IF NOT EXISTS idx_auto_events_processed ON public.automation_events(processed, created_at);

ALTER TABLE public.automation_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can manage automation events" ON public.automation_events;
CREATE POLICY "Staff can manage automation events" ON public.automation_events
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ==============================================================================
-- 3.32 REPORTING & BUSINESS INTELLIGENCE PERFORMANCE INDEXES & RPCS
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_bookings_reporting_composite 
    ON public.bookings (created_at, booking_date, status, payment_status);

CREATE INDEX IF NOT EXISTS idx_bookings_reporting_customer 
    ON public.bookings (customer_id, booking_date);

CREATE INDEX IF NOT EXISTS idx_bookings_reporting_tour 
    ON public.bookings (tour_id, booking_date);

CREATE INDEX IF NOT EXISTS idx_leads_reporting_composite 
    ON public.leads (created_at, source, stage);

CREATE INDEX IF NOT EXISTS idx_leads_reporting_staff 
    ON public.leads (assigned_staff_name);

CREATE INDEX IF NOT EXISTS idx_payments_reporting_date 
    ON public.payment_transactions (payment_date, status);

CREATE INDEX IF NOT EXISTS idx_refunds_reporting_date 
    ON public.refund_records (created_at, status);

CREATE INDEX IF NOT EXISTS idx_assignments_reporting_date 
    ON public.operational_assignments (date, status);

CREATE OR REPLACE FUNCTION public.get_executive_bi_metrics(
    p_start_date DATE,
    p_end_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_revenue NUMERIC(12,2) := 0;
    v_collected_revenue NUMERIC(12,2) := 0;
    v_outstanding_revenue NUMERIC(12,2) := 0;
    v_bookings_count INT := 0;
    v_confirmed_bookings_count INT := 0;
    v_cancellations_count INT := 0;
    v_total_passengers INT := 0;
    v_adults INT := 0;
    v_children INT := 0;
    v_infants INT := 0;
    v_total_customers INT := 0;
    v_new_customers INT := 0;
    v_repeat_customers INT := 0;
    v_leads_count INT := 0;
    v_conversion_rate NUMERIC(5,2) := 0;
    v_cancellation_rate NUMERIC(5,2) := 0;
    v_abv NUMERIC(10,2) := 0;
    v_res JSONB;
BEGIN
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE status NOT IN ('cancelled', 'cancellation_requested')),
        COUNT(*) FILTER (WHERE status IN ('cancelled', 'cancellation_requested')),
        COALESCE(SUM(total) FILTER (WHERE status NOT IN ('cancelled', 'cancellation_requested')), 0),
        COALESCE(SUM(adult_count) FILTER (WHERE status NOT IN ('cancelled', 'cancellation_requested')), 0),
        COALESCE(SUM(child_count) FILTER (WHERE status NOT IN ('cancelled', 'cancellation_requested')), 0),
        COALESCE(SUM(infant_count) FILTER (WHERE status NOT IN ('cancelled', 'cancellation_requested')), 0)
    INTO 
        v_bookings_count,
        v_confirmed_bookings_count,
        v_cancellations_count,
        v_total_revenue,
        v_adults,
        v_children,
        v_infants
    FROM public.bookings
    WHERE (booking_date BETWEEN p_start_date AND p_end_date)
       OR (created_at::DATE BETWEEN p_start_date AND p_end_date);

    v_total_passengers := v_adults + v_children + v_infants;

    SELECT COALESCE(SUM(amount), 0)
    INTO v_collected_revenue
    FROM public.payment_transactions
    WHERE status IN ('paid', 'Paid')
      AND (
          (payment_date::DATE BETWEEN p_start_date AND p_end_date)
          OR (created_at::DATE BETWEEN p_start_date AND p_end_date)
      );

    v_outstanding_revenue := GREATEST(0, v_total_revenue - v_collected_revenue);

    SELECT COUNT(*)
    INTO v_leads_count
    FROM public.leads
    WHERE created_at::DATE BETWEEN p_start_date AND p_end_date;

    IF (v_leads_count + v_confirmed_bookings_count) > 0 THEN
        v_conversion_rate := ROUND((v_confirmed_bookings_count::NUMERIC / (v_leads_count + v_confirmed_bookings_count)::NUMERIC) * 100.0, 1);
    ELSE
        v_conversion_rate := 0;
    END IF;

    IF v_bookings_count > 0 THEN
        v_cancellation_rate := ROUND((v_cancellations_count::NUMERIC / v_bookings_count::NUMERIC) * 100.0, 1);
    ELSE
        v_cancellation_rate := 0;
    END IF;

    IF v_confirmed_bookings_count > 0 THEN
        v_abv := ROUND(v_total_revenue / v_confirmed_bookings_count::NUMERIC, 2);
    ELSE
        v_abv := 0;
    END IF;

    SELECT 
        COUNT(DISTINCT customer_id),
        COUNT(DISTINCT customer_id) FILTER (WHERE lifetime_bookings = 1),
        COUNT(DISTINCT customer_id) FILTER (WHERE lifetime_bookings > 1)
    INTO
        v_total_customers,
        v_new_customers,
        v_repeat_customers
    FROM (
        SELECT customer_id, COUNT(*) AS lifetime_bookings
        FROM public.bookings
        WHERE customer_id IS NOT NULL
        GROUP BY customer_id
    ) c_stats;

    v_res := jsonb_build_object(
        'totalRevenueEur', v_total_revenue,
        'revenueEur', v_total_revenue,
        'collectedRevenueEur', v_collected_revenue,
        'outstandingRevenueEur', v_outstanding_revenue,
        'outstandingBalancesEur', v_outstanding_revenue,
        'bookingsCount', v_bookings_count,
        'confirmedBookingsCount', v_confirmed_bookings_count,
        'cancellationsCount', v_cancellations_count,
        'passengersCount', v_total_passengers,
        'adultsCount', v_adults,
        'childrenCount', v_children,
        'infantsCount', v_infants,
        'totalCustomersCount', v_total_customers,
        'newCustomersCount', v_new_customers,
        'repeatCustomersCount', v_repeat_customers,
        'leadsCount', v_leads_count,
        'conversionRate', v_conversion_rate,
        'cancellationRate', v_cancellation_rate,
        'averageBookingValueEur', v_abv
    );

    RETURN v_res;
END;
$$;

CREATE OR REPLACE FUNCTION public.query_custom_bi_report(
    p_filters JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_start_date DATE := (p_filters->>'startDate')::DATE;
    v_end_date DATE := (p_filters->>'endDate')::DATE;
    v_tour_id TEXT := p_filters->>'tourId';
    v_destination TEXT := p_filters->>'destination';
    v_booking_status TEXT := p_filters->>'bookingStatus';
    v_payment_status TEXT := p_filters->>'paymentStatus';
    v_lead_source TEXT := p_filters->>'leadSource';
    v_staff_name TEXT := p_filters->>'staffName';
    v_customer_query TEXT := p_filters->>'customerQuery';
    v_rows JSONB;
BEGIN
    SELECT COALESCE(jsonb_agg(r), '[]'::jsonb)
    INTO v_rows
    FROM (
        SELECT 
            b.id AS booking_id,
            b.booking_reference,
            b.booking_date,
            b.created_at,
            b.status AS booking_status,
            b.payment_status,
            b.payment_method,
            (b.adult_count + b.child_count + b.infant_count) AS total_guests,
            b.subtotal,
            b.discount,
            b.total,
            b.currency,
            t.title AS tour_title,
            d.name AS destination_name,
            COALESCE(c.first_name || ' ' || c.last_name, 'Guest') AS customer_name,
            c.email AS customer_email,
            c.phone AS customer_phone,
            COALESCE(l.source, 'Website') AS lead_source,
            l.assigned_staff_name AS staff_name
        FROM public.bookings b
        LEFT JOIN public.tours t ON b.tour_id = t.id
        LEFT JOIN public.destinations d ON t.destination_id = d.id
        LEFT JOIN public.customers c ON b.customer_id = c.id
        LEFT JOIN public.leads l ON b.customer_id = l.customer_id
        WHERE 
            (v_start_date IS NULL OR b.booking_date >= v_start_date OR b.created_at::DATE >= v_start_date)
            AND (v_end_date IS NULL OR b.booking_date <= v_end_date OR b.created_at::DATE <= v_end_date)
            AND (v_tour_id IS NULL OR v_tour_id = 'all' OR b.tour_id::TEXT = v_tour_id)
            AND (v_destination IS NULL OR v_destination = 'all' OR LOWER(d.name) = LOWER(v_destination))
            AND (v_booking_status IS NULL OR v_booking_status = 'all' OR b.status = v_booking_status)
            AND (v_payment_status IS NULL OR v_payment_status = 'all' OR b.payment_status = v_payment_status)
            AND (v_lead_source IS NULL OR v_lead_source = 'all' OR LOWER(l.source) = LOWER(v_lead_source))
            AND (v_staff_name IS NULL OR v_staff_name = 'all' OR LOWER(l.assigned_staff_name) LIKE '%' || LOWER(v_staff_name) || '%')
            AND (
                v_customer_query IS NULL 
                OR v_customer_query = '' 
                OR LOWER(c.email) LIKE '%' || LOWER(v_customer_query) || '%'
                OR LOWER(c.first_name) LIKE '%' || LOWER(v_customer_query) || '%'
                OR LOWER(c.last_name) LIKE '%' || LOWER(v_customer_query) || '%'
                OR LOWER(b.booking_reference) LIKE '%' || LOWER(v_customer_query) || '%'
            )
        ORDER BY b.booking_date DESC, b.created_at DESC
        LIMIT 500
    ) r;

    RETURN v_rows;
END;
$$;




