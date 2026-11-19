-- Keep the Sharm private city tour's named hero image as its sole primary
-- image. Preserve every image record and prevent future duplicate primaries.

BEGIN;

DO $image_fix$
DECLARE
  v_tour_id UUID;
BEGIN
  SELECT id INTO v_tour_id
  FROM public.tours
  WHERE slug = 'sharm-el-sheikh-private-city-tour-old-market-mosque-cathedral'
  LIMIT 1;

  IF v_tour_id IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.tour_images
       WHERE tour_id = v_tour_id
         AND image_url LIKE '%Sharm_City_Tour.webp'
     ) THEN
    UPDATE public.tour_images
    SET is_primary = (image_url LIKE '%Sharm_City_Tour.webp')
    WHERE tour_id = v_tour_id;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.tour_images
    WHERE is_primary = TRUE
    GROUP BY tour_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Multiple primary images remain for at least one tour; resolve before enforcing the one-primary rule.';
  END IF;
END;
$image_fix$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_tour_images_one_primary_per_tour
ON public.tour_images(tour_id)
WHERE is_primary = TRUE;

COMMIT;
