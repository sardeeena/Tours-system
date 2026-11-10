-- Add covering indexes for all remaining foreign keys and remove exact duplicate indexes.
-- All affected tables are currently small; each removed index is a verified exact duplicate
-- and none backs a primary key, unique constraint, or foreign-key constraint.

BEGIN;

-- Remove exact duplicate indexes, keeping the more explicit canonical names.
DROP INDEX IF EXISTS public.idx_booking_extras_booking;
DROP INDEX IF EXISTS public.idx_booking_passengers_booking;
DROP INDEX IF EXISTS public.idx_bookings_reporting_tour;
DROP INDEX IF EXISTS public.idx_crm_act_created;
DROP INDEX IF EXISTS public.idx_customers_email;
DROP INDEX IF EXISTS public.idx_invoices_booking;
DROP INDEX IF EXISTS public.idx_payments_booking;
DROP INDEX IF EXISTS public.idx_refunds_booking;
DROP INDEX IF EXISTS public.idx_tour_avail_lookup;

-- Missing single-column foreign-key indexes.
CREATE INDEX IF NOT EXISTS idx_fk_booking_extras_extra_id
  ON public.booking_extras (extra_id);
CREATE INDEX IF NOT EXISTS idx_fk_bookings_assigned_guide_id
  ON public.bookings (assigned_guide_id);
CREATE INDEX IF NOT EXISTS idx_fk_bookings_assigned_vessel_id
  ON public.bookings (assigned_vessel_id);
CREATE INDEX IF NOT EXISTS idx_fk_bookings_pickup_location_id
  ON public.bookings (pickup_location_id);
CREATE INDEX IF NOT EXISTS idx_fk_communication_messages_lead_id
  ON public.communication_messages (lead_id);
CREATE INDEX IF NOT EXISTS idx_fk_communication_messages_staff_id
  ON public.communication_messages (staff_id);
CREATE INDEX IF NOT EXISTS idx_fk_crm_activities_user_id
  ON public.crm_activities (user_id);
CREATE INDEX IF NOT EXISTS idx_fk_crm_communications_booking_id
  ON public.crm_communications (booking_id);
CREATE INDEX IF NOT EXISTS idx_fk_crm_communications_lead_id
  ON public.crm_communications (lead_id);
CREATE INDEX IF NOT EXISTS idx_fk_crm_communications_staff_id
  ON public.crm_communications (staff_id);
CREATE INDEX IF NOT EXISTS idx_fk_crm_conversations_staff_id
  ON public.crm_conversations (staff_id);
CREATE INDEX IF NOT EXISTS idx_fk_crm_notes_booking_id
  ON public.crm_notes (booking_id);
CREATE INDEX IF NOT EXISTS idx_fk_crm_notes_lead_id
  ON public.crm_notes (lead_id);
CREATE INDEX IF NOT EXISTS idx_fk_crm_notes_staff_id
  ON public.crm_notes (staff_id);
CREATE INDEX IF NOT EXISTS idx_fk_crm_tasks_assigned_staff_id
  ON public.crm_tasks (assigned_staff_id);
CREATE INDEX IF NOT EXISTS idx_fk_crm_tasks_booking_id
  ON public.crm_tasks (booking_id);
CREATE INDEX IF NOT EXISTS idx_fk_crm_tasks_completed_by
  ON public.crm_tasks (completed_by);
CREATE INDEX IF NOT EXISTS idx_fk_departures_captain_id
  ON public.departures (captain_id);
CREATE INDEX IF NOT EXISTS idx_fk_departures_driver_id
  ON public.departures (driver_id);
CREATE INDEX IF NOT EXISTS idx_fk_leads_interested_tour_id
  ON public.leads (interested_tour_id);
CREATE INDEX IF NOT EXISTS idx_fk_media_assets_uploaded_by
  ON public.media_assets (uploaded_by);
CREATE INDEX IF NOT EXISTS idx_fk_pickup_schedules_booking_id
  ON public.pickup_schedules (booking_id);
CREATE INDEX IF NOT EXISTS idx_fk_pickup_schedules_departure_id
  ON public.pickup_schedules (departure_id);
CREATE INDEX IF NOT EXISTS idx_fk_refund_records_payment_id
  ON public.refund_records (payment_id);
CREATE INDEX IF NOT EXISTS idx_fk_site_settings_updated_by
  ON public.site_settings (updated_by);

COMMIT;
