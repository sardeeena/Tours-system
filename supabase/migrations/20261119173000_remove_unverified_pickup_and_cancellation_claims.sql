-- Replace unsupported site-wide pickup and cancellation claims with
-- transparent wording until excursion-specific terms are verified by operations.
-- This migration is safe on both populated production and empty CI databases.
BEGIN;

UPDATE public.tours
SET pickup_info = 'Pickup availability, approved locations and any applicable supplements are shown during booking.',
    cancellation_policy = 'Please contact our booking team to confirm the cancellation and refund terms for this excursion before booking.',
    updated_at = NOW()
WHERE status = 'published'
  AND cancellation_policy = 'Free cancellation up to 24 hours before excursion start time.';

NOTIFY pgrst, 'reload schema';
COMMIT;
