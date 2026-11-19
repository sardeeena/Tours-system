-- Replace unsupported site-wide pickup and cancellation claims with
-- transparent wording until excursion-specific terms are verified by operations.
-- Scope is deliberately limited to the 25 currently published tours that still
-- carry the exact legacy universal cancellation promise.
BEGIN;

DO $migration$
DECLARE
  v_updated INTEGER := 0;
BEGIN
  UPDATE public.tours
  SET pickup_info = 'Pickup availability, approved locations and any applicable supplements are shown during booking.',
      cancellation_policy = 'Please contact our booking team to confirm the cancellation and refund terms for this excursion before booking.',
      updated_at = NOW()
  WHERE status = 'published'
    AND cancellation_policy = 'Free cancellation up to 24 hours before excursion start time.';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 25 THEN
    RAISE EXCEPTION 'Expected to neutralize the unverified universal policy on 25 published tours; updated %.', v_updated;
  END IF;
END;
$migration$;

NOTIFY pgrst, 'reload schema';
COMMIT;
