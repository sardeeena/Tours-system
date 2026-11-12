-- Capture sanitized before/after snapshots for business data mutations.
-- Full values remain in their source tables; the audit trail excludes direct identifiers,
-- contact details, free-text content, credentials, tokens, and arbitrary JSON payloads.
BEGIN;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.capture_business_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_old jsonb := NULL;
  v_new jsonb := NULL;
  v_row jsonb;
  v_entity_id text;
  v_sensitive_keys text[] := ARRAY[
    'email','phone','whatsapp','first_name','last_name','full_name','customer_name',
    'name','address','hotel','hotel_name','room_number','special_requests',
    'message','description','body','content','subject','notes','admin_notes',
    'password','token','secret','api_key','authorization','headers','payload',
    'raw_payload','metadata','ip_address','user_agent','cookie','cookies',
    'payment_details','card_number','cvv','access_token','refresh_token',
    'data','settings','config','value','attachments','avatar_url'
  ];
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_row := to_jsonb(NEW);
    v_new := v_row - v_sensitive_keys;
    v_entity_id := COALESCE(v_row->>'id', v_row->>'booking_reference', v_row->>'ticket_number', v_row->>'key', v_row->>'slug');
  ELSIF TG_OP = 'UPDATE' THEN
    v_row := to_jsonb(OLD);
    v_old := v_row - v_sensitive_keys;
    v_row := to_jsonb(NEW);
    v_new := v_row - v_sensitive_keys;
    v_entity_id := COALESCE(v_row->>'id', v_row->>'booking_reference', v_row->>'ticket_number', v_row->>'key', v_row->>'slug');
  ELSIF TG_OP = 'DELETE' THEN
    v_row := to_jsonb(OLD);
    v_old := v_row - v_sensitive_keys;
    v_entity_id := COALESCE(v_row->>'id', v_row->>'booking_reference', v_row->>'ticket_number', v_row->>'key', v_row->>'slug');
  END IF;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, old_data, new_data)
  VALUES (
    auth.uid(),
    'ROW_' || TG_OP,
    TG_TABLE_NAME,
    v_entity_id,
    v_old,
    v_new
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.capture_business_audit() FROM PUBLIC, anon, authenticated;

-- Audit access is mediated by Superadmin AAL2 server endpoints only.
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.audit_logs FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.audit_logs TO service_role;

DO $block$
DECLARE
  v_table text;
  v_tables text[] := ARRAY[
    'profiles','customers','bookings','inquiries','newsletter_subscriptions',
    'tours','tour_availability','destinations','categories','coupons',
    'pickup_locations','tour_extras','reviews','faqs','site_settings',
    'static_pages','blog_posts','blog_categories','support_tickets',
    'support_ticket_messages','payment_transactions','invoices','refunds',
    'crm_leads','crm_tasks','communication_templates','communication_messages',
    'automation_events','operations_assignments','operations_guides',
    'operations_vessels','operations_departures','booking_extras',
    'booking_cancellations','customer_notes','customer_tags'
  ];
BEGIN
  FOREACH v_table IN ARRAY v_tables LOOP
    IF to_regclass(format('public.%I', v_table)) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_capture_business_audit ON public.%I', v_table);
      IF v_table = 'bookings' THEN
        -- Booking creation and cancellation already have atomic audit records.
        -- Capture subsequent edits and deletes without duplicating those inserts.
        EXECUTE format(
          'CREATE TRIGGER trg_capture_business_audit AFTER UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION private.capture_business_audit()',
          v_table
        );
      ELSE
        EXECUTE format(
          'CREATE TRIGGER trg_capture_business_audit AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION private.capture_business_audit()',
          v_table
        );
      END IF;
    END IF;
  END LOOP;
END;
$block$;

COMMENT ON FUNCTION private.capture_business_audit() IS
  'Writes redacted business-row change metadata to audit_logs. Excludes contact details, free text, credentials, tokens and arbitrary JSON payloads.';

COMMIT;
