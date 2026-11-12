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
  v_sensitive_pattern text := '(email|phone|whatsapp|address|full.?name|first.?name|last.?name|customer.?name|guest.?name|user.?name|message|description|body|content|subject|notes?|password|token|secret|api.?key|authorization|headers|payload|raw.?payload|metadata|ip.?address|user.?agent|cookies?|room.?number|hotel|special.?requests?|contact|recipient|sender|customer|guest|user.?id|payment.?details?|card.?number|cvv|ssn|passport|document|birth.?date|dob|attachments?|avatar|settings|config|form.?data|custom.?data|preferences|private.?data)';
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_row := to_jsonb(NEW);
    SELECT COALESCE(jsonb_object_agg(key, value), '{}'::jsonb) INTO v_new
    FROM jsonb_each(v_row)
    WHERE key !~* v_sensitive_pattern AND jsonb_typeof(value) NOT IN ('object','array');
    v_entity_id := COALESCE(v_row->>'id', v_row->>'booking_reference', v_row->>'ticket_number', v_row->>'key', v_row->>'slug');
  ELSIF TG_OP = 'UPDATE' THEN
    v_row := to_jsonb(OLD);
    SELECT COALESCE(jsonb_object_agg(key, value), '{}'::jsonb) INTO v_old
    FROM jsonb_each(v_row)
    WHERE key !~* v_sensitive_pattern AND jsonb_typeof(value) NOT IN ('object','array');
    v_row := to_jsonb(NEW);
    SELECT COALESCE(jsonb_object_agg(key, value), '{}'::jsonb) INTO v_new
    FROM jsonb_each(v_row)
    WHERE key !~* v_sensitive_pattern AND jsonb_typeof(value) NOT IN ('object','array');
    v_entity_id := COALESCE(v_row->>'id', v_row->>'booking_reference', v_row->>'ticket_number', v_row->>'key', v_row->>'slug');
  ELSIF TG_OP = 'DELETE' THEN
    v_row := to_jsonb(OLD);
    SELECT COALESCE(jsonb_object_agg(key, value), '{}'::jsonb) INTO v_old
    FROM jsonb_each(v_row)
    WHERE key !~* v_sensitive_pattern AND jsonb_typeof(value) NOT IN ('object','array');
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
ALTER TABLE public.visitor_analytics_settings
  ADD COLUMN IF NOT EXISTS technical_event_retention_days integer NOT NULL DEFAULT 90
    CHECK (technical_event_retention_days BETWEEN 7 AND 730);
ALTER TABLE public.visitor_analytics_settings
  ADD COLUMN IF NOT EXISTS audit_log_retention_days integer NOT NULL DEFAULT 2555
    CHECK (audit_log_retention_days BETWEEN 365 AND 3650);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.audit_logs FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.audit_logs TO service_role;

DO $block$
DECLARE
  v_table text;
BEGIN
  -- Apply to every current public business table. High-volume telemetry and
  -- rate-limit internals are deliberately excluded from the business audit log.
  FOR v_table IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT IN (
        'audit_logs','technical_events','visitor_sessions','visitor_events',
        'visitor_consent_records','visitor_analytics_settings',
        'rate_limit_events','rate_limit_buckets','request_idempotency',
        'idempotency_keys','booking_idempotency_keys','schema_migrations'
      )
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_capture_business_audit ON public.%I', v_table);
    IF v_table = 'bookings' THEN
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
  END LOOP;
END;
$block$;

COMMENT ON FUNCTION private.capture_business_audit() IS
  'Writes redacted business-row change metadata to audit_logs. Excludes contact details, free text, credentials, tokens and arbitrary JSON payloads.';

COMMIT;
