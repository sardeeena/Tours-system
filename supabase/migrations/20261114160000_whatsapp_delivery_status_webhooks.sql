-- Secure Meta WhatsApp delivery status ingestion with event deduplication and monotonic updates.
BEGIN;

ALTER TABLE public.communication_messages
  ADD COLUMN IF NOT EXISTS read_at timestamptz,
  ADD COLUMN IF NOT EXISTS provider_status_at timestamptz;

ALTER TABLE public.communication_messages
  DROP CONSTRAINT IF EXISTS communication_messages_status_check;
ALTER TABLE public.communication_messages
  ADD CONSTRAINT communication_messages_status_check
  CHECK (status IN ('queued', 'sent', 'delivered', 'failed', 'read', 'opened',
                    'Queued', 'Sent', 'Delivered', 'Failed', 'Read', 'Opened'));

CREATE TABLE IF NOT EXISTS public.whatsapp_provider_status_events (
  event_key text PRIMARY KEY CHECK (event_key ~ '^[a-f0-9]{64}$'),
  provider_message_id text NOT NULL CHECK (length(provider_message_id) BETWEEN 1 AND 255),
  status text NOT NULL CHECK (status IN ('sent', 'delivered', 'read', 'failed')),
  provider_event_at timestamptz NOT NULL,
  error_code text NULL CHECK (error_code IS NULL OR length(error_code) <= 40),
  failure_reason text NULL CHECK (failure_reason IS NULL OR length(failure_reason) <= 500),
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS whatsapp_provider_status_events_message_time_idx
  ON public.whatsapp_provider_status_events (provider_message_id, provider_event_at DESC);

ALTER TABLE public.whatsapp_provider_status_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.whatsapp_provider_status_events FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.record_whatsapp_provider_status(
  p_event_key text,
  p_provider_message_id text,
  p_status text,
  p_event_at timestamptz,
  p_error_code text DEFAULT NULL,
  p_failure_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_inserted integer := 0;
  v_updated integer := 0;
BEGIN
  IF p_event_key IS NULL OR p_event_key !~ '^[a-f0-9]{64}$'
     OR p_provider_message_id IS NULL
     OR length(p_provider_message_id) NOT BETWEEN 1 AND 255
     OR p_status NOT IN ('sent', 'delivered', 'read', 'failed')
     OR p_event_at IS NULL
     OR (p_error_code IS NOT NULL AND length(p_error_code) > 40)
     OR (p_failure_reason IS NOT NULL AND length(p_failure_reason) > 500) THEN
    RAISE EXCEPTION 'Invalid WhatsApp provider status event.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.whatsapp_provider_status_events
    (event_key, provider_message_id, status, provider_event_at, error_code, failure_reason)
  VALUES
    (p_event_key, p_provider_message_id, p_status, p_event_at, p_error_code, p_failure_reason)
  ON CONFLICT (event_key) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  -- Duplicates can reconcile a message logged after the callback arrived.
  UPDATE public.communication_messages AS message
  SET status = p_status,
      provider_status_at = p_event_at,
      sent_at = CASE WHEN p_status = 'sent' THEN COALESCE(message.sent_at, p_event_at) ELSE message.sent_at END,
      delivered_at = CASE WHEN p_status IN ('delivered', 'read') THEN COALESCE(message.delivered_at, p_event_at) ELSE message.delivered_at END,
      read_at = CASE WHEN p_status = 'read' THEN COALESCE(message.read_at, p_event_at) ELSE message.read_at END,
      failure_reason = CASE WHEN p_status = 'failed' THEN p_failure_reason ELSE NULL END
  WHERE message.channel = 'WhatsApp'
    AND message.provider_message_id = p_provider_message_id
    AND (
      message.provider_status_at IS NULL
      OR p_event_at > message.provider_status_at
      OR (
        p_event_at = message.provider_status_at
        AND CASE p_status WHEN 'sent' THEN 1 WHEN 'delivered' THEN 2 WHEN 'read' THEN 3 WHEN 'failed' THEN 4 ELSE 0 END
          > CASE lower(message.status) WHEN 'sent' THEN 1 WHEN 'delivered' THEN 2 WHEN 'read' THEN 3 WHEN 'failed' THEN 4 ELSE 0 END
      )
    );
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN jsonb_build_object(
    'duplicate', v_inserted = 0,
    'matched', EXISTS (
      SELECT 1 FROM public.communication_messages
      WHERE channel = 'WhatsApp' AND provider_message_id = p_provider_message_id
    ),
    'applied', v_updated > 0
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.record_whatsapp_provider_status(text, text, text, timestamptz, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_whatsapp_provider_status(text, text, text, timestamptz, text, text)
  TO service_role;

-- A callback can arrive before the browser persists the send response. Reconcile
-- stored events when the provider message ID is subsequently attached to a row.
CREATE OR REPLACE FUNCTION private.reconcile_whatsapp_status_after_message_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_event record;
BEGIN
  IF NEW.channel <> 'WhatsApp' OR NEW.provider_message_id IS NULL OR btrim(NEW.provider_message_id) = '' THEN
    RETURN NEW;
  END IF;

  FOR v_event IN
    SELECT event_key, provider_message_id, status, provider_event_at, error_code, failure_reason
    FROM public.whatsapp_provider_status_events
    WHERE provider_message_id = NEW.provider_message_id
    ORDER BY provider_event_at ASC
  LOOP
    PERFORM public.record_whatsapp_provider_status(
      v_event.event_key, v_event.provider_message_id, v_event.status,
      v_event.provider_event_at, v_event.error_code, v_event.failure_reason
    );
  END LOOP;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.reconcile_whatsapp_status_after_message_write()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_reconcile_whatsapp_status_after_message_write ON public.communication_messages;
CREATE TRIGGER trg_reconcile_whatsapp_status_after_message_write
AFTER INSERT OR UPDATE OF provider_message_id ON public.communication_messages
FOR EACH ROW EXECUTE FUNCTION private.reconcile_whatsapp_status_after_message_write();

COMMENT ON TABLE public.whatsapp_provider_status_events IS
  'Deduplicated, minimized Meta WhatsApp delivery callbacks. Raw webhook payloads and customer message content are never stored.';

COMMIT;
