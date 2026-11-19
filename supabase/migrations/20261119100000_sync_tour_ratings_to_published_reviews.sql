-- Derive tour rating summaries exclusively from published customer reviews.
-- Existing catalogue values were not backed by review rows and must not be presented as customer feedback.
ALTER TABLE public.tours
  ALTER COLUMN rating SET DEFAULT 0,
  ALTER COLUMN review_count SET DEFAULT 0;

ALTER TABLE public.reviews
  ALTER COLUMN verified_booking SET DEFAULT FALSE;

COMMENT ON COLUMN public.reviews.verified_booking IS
  'True only when a completed booking has been independently confirmed; manual entries and customer submissions default to false.';

WITH review_stats AS (
  SELECT
    r.tour_id,
    ROUND(AVG(r.rating)::numeric, 1) AS average_rating,
    COUNT(*)::integer AS review_count
  FROM public.reviews AS r
  WHERE r.is_published = TRUE
    AND r.tour_id IS NOT NULL
  GROUP BY r.tour_id
)
UPDATE public.tours AS t
SET
  rating = COALESCE(stats.average_rating, 0),
  review_count = COALESCE(stats.review_count, 0)
FROM (
  SELECT
    t2.id,
    rs.average_rating,
    rs.review_count
  FROM public.tours AS t2
  LEFT JOIN review_stats AS rs ON rs.tour_id = t2.id
) AS stats
WHERE t.id = stats.id;

CREATE OR REPLACE FUNCTION public.refresh_tour_review_summary()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  affected_tour_ids uuid[];
  affected_tour_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    affected_tour_ids := ARRAY[OLD.tour_id];
  ELSIF TG_OP = 'UPDATE' THEN
    affected_tour_ids := ARRAY[OLD.tour_id, NEW.tour_id];
  ELSE
    affected_tour_ids := ARRAY[NEW.tour_id];
  END IF;

  FOR affected_tour_id IN
    SELECT DISTINCT ids.tour_id
    FROM unnest(affected_tour_ids) AS ids(tour_id)
    WHERE ids.tour_id IS NOT NULL
  LOOP
    UPDATE public.tours AS t
    SET
      rating = COALESCE(stats.average_rating, 0),
      review_count = COALESCE(stats.review_count, 0)
    FROM (
      SELECT
        ROUND(AVG(r.rating)::numeric, 1) AS average_rating,
        COUNT(*)::integer AS review_count
      FROM public.reviews AS r
      WHERE r.tour_id = affected_tour_id
        AND r.is_published = TRUE
    ) AS stats
    WHERE t.id = affected_tour_id;
  END LOOP;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_tour_review_summary() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_refresh_tour_review_summary ON public.reviews;
CREATE TRIGGER trg_refresh_tour_review_summary
AFTER INSERT OR UPDATE OR DELETE ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.refresh_tour_review_summary();

COMMENT ON FUNCTION public.refresh_tour_review_summary() IS
  'Keeps public.tours rating and review_count synchronized with published public.reviews records only.';
