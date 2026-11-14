-- Append-only, auditable consent evidence for outbound WhatsApp communications.
-- Existing analytics/cookie consent is deliberately not reused as messaging consent.
BEGIN;

CREATE TABLE IF NOT EXISTS public.customer_communication_consent_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  channel text NOT NULL CHECK (channel = 'WhatsApp'),
  purpose text NOT NULL CHECK (purpose IN ('transactional', 'marketing')),
  phone_e164 text NOT NULL CHECK (phone_e164 ~ '^[0-9]{8,15}$'),
  consent_action text NOT NULL CHECK (consent_action IN ('granted', 'revoked')),
  consent_text_version text NOT NULL CHECK (length(btrim(consent_text_version)) BETWEEN 1 AND 80),
  consent_source text NOT NULL CHECK (consent_source IN ('booking_form', 'account_settings', 'staff_verified_record')),
  recorded_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  evidence_reference text NULL CHECK (evidence_reference IS NULL OR length(evidence_reference) <= 200)
);

CREATE INDEX IF NOT EXISTS customer_communication_consent_lookup_idx
  ON public.customer_communication_consent_events
  (customer_id, channel, purpose, phone_e164, recorded_at DESC);

COMMENT ON TABLE public.customer_communication_consent_events IS
  'Append-only evidence of explicit channel- and purpose-specific WhatsApp consent. Never infer consent from cookie analytics or an existing phone number.';

ALTER TABLE public.customer_communication_consent_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.customer_communication_consent_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.customer_communication_consent_events TO service_role;

CREATE OR REPLACE FUNCTION private.prevent_customer_communication_consent_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  RAISE EXCEPTION 'Communication consent evidence is append-only; record a new event instead.'
    USING ERRCODE = '55000';
END;
$function$;

REVOKE ALL ON FUNCTION private.prevent_customer_communication_consent_event_mutation() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_customer_communication_consent_events_append_only
  ON public.customer_communication_consent_events;
CREATE TRIGGER trg_customer_communication_consent_events_append_only
BEFORE UPDATE OR DELETE ON public.customer_communication_consent_events
FOR EACH ROW EXECUTE FUNCTION private.prevent_customer_communication_consent_event_mutation();

COMMIT;
