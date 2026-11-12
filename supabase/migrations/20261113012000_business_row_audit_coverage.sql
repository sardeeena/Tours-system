-- Capture sanitized before/after snapshots for business data mutations.
-- Full values remain in their source tables; the audit trail excludes direct identifiers,
-- contact details, free-text content, credentials, tokens, and arbitrary JSON payloads.
BEGIN;

CREATE SCHEMA IF NOT EXISTS private;
-- Preserve existing private-schema USAGE grants for existing application routines;
-- only the new trigger function's direct EXECUTE privilege is revoked below.

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
  v_sensitive_pattern text := '(email|phone|whatsapp|address|full.?name|first.?name|last.?name|customer.?name|guest.?name|user.?name|message|description|body|content|subject|notes?|password|token|secret|api.?key|authorization|headers|payload|raw.?payload|metadata|ip.?address|user.?agent|cookies?|room.?number|hotel|special.?requests?|contact|recipient|sender|customer|guest|user.?id|payment.?details?|card.?number|cvv|ssn|passport|document|birth.?date|dob|attachments?|avatar|settings|config|form.?data|custom.?data|preferences|private.?data|(^ip$|_ip$|^ip_)|(^text$|_text$|^text_)|comment|question|answer|reason|actor.?id|profile.?id|visitor.?id|session.?id)';
BEGIN
  IF TG_OP = 'UPDATE' AND to_jsonb(OLD) = to_jsonb(NEW) THEN
    RETURN NEW;
  END IF;

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
ALTER TABLE public.visitor_sessions
  ADD COLUMN IF NOT EXISTS utm_term text,
  ADD COLUMN IF NOT EXISTS utm_content text;

ALTER TABLE public.visitor_analytics_settings
  ADD COLUMN IF NOT EXISTS technical_event_retention_days integer NOT NULL DEFAULT 90
    CHECK (technical_event_retention_days BETWEEN 7 AND 730);
ALTER TABLE public.visitor_analytics_settings
  ADD COLUMN IF NOT EXISTS audit_log_retention_days integer NOT NULL DEFAULT 2555
    CHECK (audit_log_retention_days BETWEEN 365 AND 3650);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.audit_logs FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, DELETE ON TABLE public.audit_logs TO service_role;

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

CREATE OR REPLACE FUNCTION public.erase_visitor_analytics(
  p_identifier_type text,
  p_identifier uuid,
  p_actor uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_events integer := 0;
  v_sessions integer := 0;
  v_consents integer := 0;
BEGIN
  IF p_identifier_type NOT IN ('visitor_id','user_id') OR p_identifier IS NULL OR p_actor IS NULL THEN
    RAISE EXCEPTION 'A valid visitor/user identifier and actor are required.';
  END IF;

  UPDATE public.visitor_consent_records c
  SET visitor_session_id = NULL, visitor_id = NULL, user_id = NULL
  WHERE
    (p_identifier_type = 'visitor_id' AND (
      c.visitor_id = p_identifier OR
      c.visitor_session_id IN (SELECT s.id FROM public.visitor_sessions s WHERE s.visitor_id = p_identifier)
    ))
    OR
    (p_identifier_type = 'user_id' AND (
      c.user_id = p_identifier OR
      c.visitor_id IN (SELECT s.visitor_id FROM public.visitor_sessions s WHERE s.user_id = p_identifier) OR
      c.visitor_session_id IN (SELECT s.id FROM public.visitor_sessions s WHERE s.user_id = p_identifier)
    ));
  GET DIAGNOSTICS v_consents = ROW_COUNT;

  DELETE FROM public.visitor_events e
  WHERE e.session_id IN (
    SELECT s.id FROM public.visitor_sessions s
    WHERE (p_identifier_type = 'visitor_id' AND s.visitor_id = p_identifier)
       OR (p_identifier_type = 'user_id' AND s.user_id = p_identifier)
  );
  GET DIAGNOSTICS v_events = ROW_COUNT;

  DELETE FROM public.visitor_sessions s
  WHERE (p_identifier_type = 'visitor_id' AND s.visitor_id = p_identifier)
     OR (p_identifier_type = 'user_id' AND s.user_id = p_identifier);
  GET DIAGNOSTICS v_sessions = ROW_COUNT;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, new_data)
  VALUES (
    p_actor,
    'VISITOR_ANALYTICS_ERASURE',
    'visitor_analytics',
    NULL,
    jsonb_build_object(
      'erased_sessions', v_sessions,
      'erased_events', v_events,
      'anonymized_consent_records', v_consents,
      'identifier_type', p_identifier_type
    )
  );

  RETURN jsonb_build_object(
    'erasedSessions', v_sessions,
    'erasedEvents', v_events,
    'anonymizedConsents', v_consents
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.erase_visitor_analytics(text, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.erase_visitor_analytics(text, uuid, uuid) TO service_role;

COMMENT ON FUNCTION private.capture_business_audit() IS
  'Writes redacted business-row change metadata to audit_logs. Excludes contact details, free text, credentials, tokens and arbitrary JSON payloads.';

COMMIT;
