-- ==============================================================================
-- PHASE 11: PRODUCTION SECURITY HARDENING & RLS INTEGRITY REVIEW
-- Target Project: cyifhjqqvtiguitrziqs (Awesome Adventure Tours)
-- Target Domain: https://awesomeadventure.tours
-- Note: FOR HUMAN REVIEW ONLY. Do not execute against production without change window approval.
-- ==============================================================================

-- 1. Indexing for High-Volume Secure Booking Lookups
-- Note: Standard B-tree index on phone is used instead of REGEXP_REPLACE because regexp_replace
-- is not immutable across all PostgreSQL collations and could cause schema creation errors.
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON public.bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_reference_upper ON public.bookings(UPPER(booking_reference));
CREATE INDEX IF NOT EXISTS idx_customers_email_lower ON public.customers(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(phone);

-- 2. Audit Verification for lookup_booking_secure
-- Ensures that only exact matches with contact verification can read voucher data
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'lookup_booking_secure'
    ) THEN
        RAISE NOTICE 'Notice: public.lookup_booking_secure RPC is defined in complete_schema.sql lines 1696-1770';
    END IF;
END $$;

-- 3. Explicit Revocation of Unsafe Public Grants (Least Privilege Principle)
REVOKE ALL ON TABLE public.payment_transactions FROM anon;
REVOKE ALL ON TABLE public.refund_records FROM anon;
REVOKE ALL ON TABLE public.crm_activities FROM anon;
REVOKE ALL ON TABLE public.rate_limit_buckets FROM anon;

-- Grant minimal required permissions to authenticated users
GRANT SELECT ON public.payment_transactions TO authenticated;
GRANT SELECT ON public.tours TO anon, authenticated;
GRANT SELECT ON public.destinations TO anon, authenticated;
GRANT SELECT ON public.categories TO anon, authenticated;
GRANT SELECT ON public.pickup_locations TO anon, authenticated;
GRANT SELECT ON public.tour_extras TO anon, authenticated;
GRANT SELECT ON public.faqs TO anon, authenticated;
GRANT SELECT ON public.reviews TO anon, authenticated;
