-- Allow public guests to submit reviews without granting admin table privileges.
-- All public submissions are forced into the moderation queue and are never marked verified.

CREATE OR REPLACE FUNCTION public.submit_public_tour_review(
  p_tour_id UUID,
  p_author_name TEXT,
  p_country TEXT,
  p_country_code TEXT,
  p_rating INTEGER,
  p_comment TEXT,
  p_traveler_type TEXT DEFAULT 'Couple'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_review_id UUID;
  v_headers JSONB := '{}'::jsonb;
  v_client_ip TEXT;
BEGIN
  IF p_author_name IS NULL OR char_length(btrim(p_author_name)) < 2 OR char_length(btrim(p_author_name)) > 100 THEN
    RAISE EXCEPTION 'Please provide a name between 2 and 100 characters.' USING ERRCODE = '22023';
  END IF;

  IF p_comment IS NULL OR char_length(btrim(p_comment)) < 10 OR char_length(btrim(p_comment)) > 3000 THEN
    RAISE EXCEPTION 'Please provide review comments between 10 and 3000 characters.' USING ERRCODE = '22023';
  END IF;

  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'A customer review must include a rating from 1 to 5 stars.' USING ERRCODE = '22023';
  END IF;

  IF coalesce(p_traveler_type, 'Couple') NOT IN ('Couple', 'Family', 'Solo', 'Friends') THEN
    RAISE EXCEPTION 'Please select a valid traveler type.' USING ERRCODE = '22023';
  END IF;

  IF p_tour_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.tours AS t
    WHERE t.id = p_tour_id AND t.status::text = 'published'
  ) THEN
    RAISE EXCEPTION 'The selected excursion is unavailable for reviews.' USING ERRCODE = '22023';
  END IF;

  -- PostgREST supplies trusted request headers. Rate-limit by the connecting
  -- address when available; do not trust a client-supplied form field for this.
  BEGIN
    v_headers := coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
  EXCEPTION WHEN OTHERS THEN
    v_headers := '{}'::jsonb;
  END;

  v_client_ip := coalesce(
    nullif(btrim(v_headers ->> 'cf-connecting-ip'), ''),
    nullif(btrim(split_part(coalesce(v_headers ->> 'x-forwarded-for', ''), ',', 1)), ''),
    nullif(btrim(v_headers ->> 'x-real-ip'), '')
  );

  IF v_client_ip IS NOT NULL THEN
    PERFORM public.check_atomic_rate_limit(
      'public-review',
      md5(v_client_ip),
      INTERVAL '1 hour',
      5,
      'Too many reviews have been submitted from this network. Please try again later.'
    );
  END IF;

  INSERT INTO public.reviews (
    tour_id,
    author_name,
    country,
    country_code,
    rating,
    comment,
    traveler_type,
    verified_booking,
    is_published,
    date
  )
  VALUES (
    p_tour_id,
    btrim(p_author_name),
    coalesce(nullif(btrim(p_country), ''), 'International'),
    upper(coalesce(nullif(btrim(p_country_code), ''), 'DE')),
    p_rating,
    btrim(p_comment),
    coalesce(p_traveler_type, 'Couple'),
    FALSE,
    FALSE,
    CURRENT_DATE
  )
  RETURNING id INTO v_review_id;

  RETURN v_review_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_public_tour_review(UUID, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_public_tour_review(UUID, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT) TO anon, authenticated;

COMMENT ON FUNCTION public.submit_public_tour_review(UUID, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT) IS
  'Accepts validated guest reviews through a narrowly scoped SECURITY DEFINER RPC; every submission remains unpublished and unverified until admin moderation.';
