-- Expand the staff inbox categories to match the typed notification model.
-- Existing notification rows and deduplication keys are preserved.
BEGIN;
ALTER TABLE public.staff_notifications
  DROP CONSTRAINT IF EXISTS staff_notifications_category_check;
ALTER TABLE public.staff_notifications
  ADD CONSTRAINT staff_notifications_category_check
  CHECK (category IN (
    'new_booking','new_inquiry','new_payment','payment_overdue','new_lead',
    'followup_due','task_overdue','departure_unassigned','pickup_pending',
    'document_expiring','cancellation','new_review','operational_issue','payment_pending'
  ));
CREATE INDEX IF NOT EXISTS idx_staff_notifications_dedup_key
  ON public.staff_notifications(dedup_key) WHERE dedup_key IS NOT NULL;
COMMIT;
