-- Correct the copy-suffixed slug for the distinct Sharm Super Safari product.
-- The tour primary key and all associated departure records remain unchanged.
-- This is a no-op in clean CI databases that do not contain production catalogue rows.
DO $$
DECLARE
  v_updated INTEGER := 0;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.tours
    WHERE slug = 'sharm-super-safari-atv-camel-stargazing-bbq-dinner'
      AND title <> 'Sharm: Super Safari ATV, Camel Ride, Stargazing & BBQ Dinner'
  ) THEN
    RAISE EXCEPTION 'The replacement Sharm safari slug is already used by another tour';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.tours
    WHERE slug = 'ultimate-sinai-desert-safari-quad-camel-bbq-adventure-copy-757'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM public.tours
      WHERE slug = 'sharm-super-safari-atv-camel-stargazing-bbq-dinner'
    ) THEN
      RAISE EXCEPTION 'Both old and replacement Sharm safari slugs exist; refusing ambiguous rename';
    END IF;

    IF (
      SELECT count(*) FROM public.tours
      WHERE slug = 'ultimate-sinai-desert-safari-quad-camel-bbq-adventure-copy-757'
        AND title = 'Sharm: Super Safari ATV, Camel Ride, Stargazing & BBQ Dinner'
    ) <> 1 THEN
      RAISE EXCEPTION 'The legacy Sharm safari slug does not identify exactly one expected tour';
    END IF;

    UPDATE public.tours
    SET slug = 'sharm-super-safari-atv-camel-stargazing-bbq-dinner',
        updated_at = now()
    WHERE slug = 'ultimate-sinai-desert-safari-quad-camel-bbq-adventure-copy-757'
      AND title = 'Sharm: Super Safari ATV, Camel Ride, Stargazing & BBQ Dinner';
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    IF v_updated <> 1 THEN
      RAISE EXCEPTION 'Expected to rename exactly one Sharm Super Safari tour, updated %', v_updated;
    END IF;
  END IF;

  UPDATE public.seo_metadata AS seo
  SET page_slug = 'sharm-super-safari-atv-camel-stargazing-bbq-dinner',
      canonical_url = CASE
        WHEN seo.canonical_url IS NULL
          OR seo.canonical_url LIKE '%ultimate-sinai-desert-safari-quad-camel-bbq-adventure-copy-757%'
        THEN 'https://awesomeadventure.tours/excursions/sharm-super-safari-atv-camel-stargazing-bbq-dinner'
        ELSE seo.canonical_url
      END,
      updated_at = now()
  WHERE seo.entity_type = 'tour'
    AND seo.entity_id = (
      SELECT id FROM public.tours
      WHERE slug = 'sharm-super-safari-atv-camel-stargazing-bbq-dinner'
      LIMIT 1
    );
END;
$$;

-- This non-unique partial index duplicates the unique index with the same
-- key and predicate, adding write cost without providing another access path.
DROP INDEX IF EXISTS public.idx_tour_images_primary;
