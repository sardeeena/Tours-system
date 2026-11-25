DO $$
DECLARE
  v_tour_id UUID;
  v_departures INTEGER;
  v_page_slug TEXT;
BEGIN
  SELECT id INTO v_tour_id
  FROM public.tours
  WHERE slug = 'sharm-super-safari-atv-camel-stargazing-bbq-dinner'
    AND title = 'Sharm: Super Safari ATV, Camel Ride, Stargazing & BBQ Dinner';

  -- Production has the catalogue row; a clean migration-test database may not.
  IF v_tour_id IS NOT NULL THEN
    SELECT count(*) INTO v_departures
    FROM public.departures
    WHERE tour_id = v_tour_id;

    IF v_departures = 0 THEN
      RAISE EXCEPTION 'The Sharm Super Safari departure records must remain attached';
    END IF;

    SELECT page_slug INTO v_page_slug
    FROM public.seo_metadata
    WHERE entity_type = 'tour' AND entity_id = v_tour_id
    LIMIT 1;

    IF v_page_slug IS DISTINCT FROM 'sharm-super-safari-atv-camel-stargazing-bbq-dinner' THEN
      RAISE EXCEPTION 'SEO metadata must follow the new canonical tour slug';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.tours
      WHERE slug = 'ultimate-sinai-desert-safari-quad-camel-bbq-adventure-copy-757'
    ) THEN
      RAISE EXCEPTION 'The old Sharm safari slug must no longer be assigned to the tour';
    END IF;
  END IF;

  IF to_regclass('public.idx_tour_images_primary') IS NOT NULL THEN
    RAISE EXCEPTION 'The redundant tour-images partial index should be removed';
  END IF;

  IF to_regclass('public.uq_tour_images_one_primary_per_tour') IS NULL THEN
    RAISE EXCEPTION 'The unique primary-image index must remain in place';
  END IF;
END;
$$;
