-- Preserve tour-specific preparation guidance in the relational catalogue.
-- Existing FAQ rows retain the default "faq" section.
ALTER TABLE public.tour_faqs
  ADD COLUMN IF NOT EXISTS section TEXT NOT NULL DEFAULT 'faq';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.tour_faqs'::regclass
      AND conname = 'tour_faqs_section_check'
  ) THEN
    ALTER TABLE public.tour_faqs
      ADD CONSTRAINT tour_faqs_section_check
      CHECK (section IN ('faq', 'what_to_bring', 'important_information'));
  END IF;
END;
$$;

COMMENT ON COLUMN public.tour_faqs.section IS
  'Separates customer FAQs from what-to-bring and important-information items on tour pages.';
