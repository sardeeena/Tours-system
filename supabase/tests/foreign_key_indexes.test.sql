BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(2);

SELECT is(
  (
    SELECT count(*)::integer
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = ANY (ARRAY[
        'idx_fk_booking_extras_extra_id',
        'idx_fk_bookings_assigned_guide_id',
        'idx_fk_bookings_assigned_vessel_id',
        'idx_fk_bookings_pickup_location_id',
        'idx_fk_communication_messages_lead_id',
        'idx_fk_communication_messages_staff_id',
        'idx_fk_crm_activities_user_id',
        'idx_fk_crm_communications_booking_id',
        'idx_fk_crm_communications_lead_id',
        'idx_fk_crm_communications_staff_id',
        'idx_fk_crm_conversations_staff_id',
        'idx_fk_crm_notes_booking_id',
        'idx_fk_crm_notes_lead_id',
        'idx_fk_crm_notes_staff_id',
        'idx_fk_crm_tasks_assigned_staff_id',
        'idx_fk_crm_tasks_booking_id',
        'idx_fk_crm_tasks_completed_by',
        'idx_fk_departures_captain_id',
        'idx_fk_departures_driver_id',
        'idx_fk_leads_interested_tour_id',
        'idx_fk_media_assets_uploaded_by',
        'idx_fk_pickup_schedules_booking_id',
        'idx_fk_pickup_schedules_departure_id',
        'idx_fk_refund_records_payment_id',
        'idx_fk_site_settings_updated_by'
      ])
  ),
  25,
  'all 25 missing foreign-key indexes are present'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = ANY (ARRAY[
        'idx_booking_extras_booking',
        'idx_booking_passengers_booking',
        'idx_bookings_reporting_tour',
        'idx_crm_act_created',
        'idx_customers_email',
        'idx_invoices_booking',
        'idx_payments_booking',
        'idx_refunds_booking',
        'idx_tour_avail_lookup'
      ])
  ),
  0,
  'all nine exact duplicate indexes were removed'
);

SELECT * FROM finish();
ROLLBACK;
