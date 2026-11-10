ALTER TABLE public.seo_metadata
  ADD COLUMN IF NOT EXISTS structured_data jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.seo_metadata'::regclass
      AND conname = 'seo_metadata_entity_type_page_slug_key'
  ) THEN
    ALTER TABLE public.seo_metadata
      ADD CONSTRAINT seo_metadata_entity_type_page_slug_key
      UNIQUE (entity_type, page_slug);
  END IF;
END
$$;
