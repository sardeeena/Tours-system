BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(3);

SELECT ok(
  EXISTS (
    SELECT 1 FROM public.communication_templates
    WHERE template_key = 'booking_received'
      AND body_text LIKE '%Departure time: {{departure_time}}%'
      AND variables @> '["departure_time"]'::JSONB
  ),
  'booking received email includes the exact selected departure time'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM public.communication_templates WHERE template_key = 'booking_confirmation'
  ) OR EXISTS (
    SELECT 1 FROM public.communication_templates
    WHERE template_key = 'booking_confirmation'
      AND body_text LIKE '%Departure time: {{departure_time}}%'
      AND variables @> '["departure_time"]'::JSONB
  ),
  'booking confirmation template includes the selected departure when configured'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM public.communication_templates WHERE template_key = 'booking_update'
  ) OR EXISTS (
    SELECT 1 FROM public.communication_templates
    WHERE template_key = 'booking_update'
      AND body_text LIKE '%Departure time: {{departure_time}}%'
      AND variables @> '["departure_time"]'::JSONB
  ),
  'booking update template includes the selected departure when configured'
);

SELECT * FROM finish();
ROLLBACK;
