-- Include the exact selected slot in transactional booking messages.
-- Legacy bookings without departure_id are explicitly shown as "To be confirmed"
-- by the notification worker; no tour-level first-time guess is used.

BEGIN;

UPDATE public.communication_templates
SET
  body_text = CASE
    WHEN template_key = 'booking_received' THEN replace(
      body_text,
      'Your digital booking ticket is included below.',
      'Your digital booking ticket is included below.' || E'\nDeparture time: {{departure_time}}'
    )
    WHEN template_key IN ('booking_confirmation','booking_update') THEN
      COALESCE(body_text, '') || E'\nDeparture time: {{departure_time}}'
    ELSE body_text
  END,
  variables = CASE
    WHEN variables @> '["departure_time"]'::JSONB THEN variables
    ELSE variables || '["departure_time"]'::JSONB
  END,
  updated_at = now()
WHERE template_key IN ('booking_received','booking_confirmation','booking_update')
  AND position('{{departure_time}}' IN body_text) = 0;

NOTIFY pgrst, 'reload schema';
COMMIT;
