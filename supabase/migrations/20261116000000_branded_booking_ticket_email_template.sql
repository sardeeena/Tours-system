-- Keep the booking-received template branded and aligned with the digital ticket renderer.
-- This is an additive, idempotent update to Awesome Adventure Tours' own project data.
BEGIN;

INSERT INTO public.communication_templates (
  template_key, name, channel, subject, body_text, variables, is_active
)
VALUES (
  'booking_received',
  'Booking Ticket',
  'Email',
  'Your Awesome Adventure Tours booking ticket: {{booking_reference}}',
  E'Hello {{customer_name}},\n\nWe have received your reservation request for {{tour_name}} on {{tour_date}}. Your digital booking ticket is included below.\n\nBooking reference: {{booking_reference}}\nBooking status: {{booking_status}}\nTotal: {{currency}} {{amount}}\n\nPlease keep your booking reference available when contacting our team. Pickup time and operational details may be confirmed separately.\n\nThank you,\nAwesome Adventure Tours',
  '["customer_name","booking_reference","tour_name","tour_date","booking_status","currency","amount"]'::jsonb,
  TRUE
)
ON CONFLICT (template_key) DO UPDATE
SET
  name = EXCLUDED.name,
  channel = EXCLUDED.channel,
  subject = EXCLUDED.subject,
  body_text = EXCLUDED.body_text,
  variables = EXCLUDED.variables,
  updated_at = NOW();

COMMIT;
