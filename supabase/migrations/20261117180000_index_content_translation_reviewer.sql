-- Cover the reviewer foreign key used by content translation moderation.
-- This is a targeted FK index; unused-index advisor notices are not dropped blindly.

BEGIN;

CREATE INDEX IF NOT EXISTS idx_content_translations_reviewed_by
  ON public.content_translations(reviewed_by)
  WHERE reviewed_by IS NOT NULL;

COMMIT;
