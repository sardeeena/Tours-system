-- Align provider-event visibility with the communications RBAC module.
-- Preserve existing content managers' read access while granting communications readers access.
DROP POLICY IF EXISTS "Staff can read email provider events" ON public.email_provider_events;

CREATE POLICY "Staff can read email provider events"
ON public.email_provider_events
FOR SELECT
TO authenticated
USING (
  private.has_permission('communications.read')
  OR private.has_permission('content.read')
);

INSERT INTO public.communication_templates
  (template_key, name, channel, subject, body_text, variables, is_active)
VALUES
('booking_confirmation', 'Booking Confirmation', 'Email', 'Booking Confirmation: {{tour_name}} (Ref: {{booking_reference}})', 'Dear {{customer_name}},

Thank you for booking with Awesome Adventure Tours. Your reservation for {{tour_name}} on {{tour_date}} has been confirmed.

Booking Reference: {{booking_reference}}
Total Amount: {{amount}}
Balance Due: {{balance_due}}
Pickup Time: {{pickup_time}}

Warm regards,
Awesome Adventure Tours Concierge Desk', '["customer_name","booking_reference","tour_name","tour_date","pickup_time","amount","balance_due"]'::jsonb, true),
('booking_update', 'Booking Update', 'Email', 'Reservation Update: {{tour_name}} (Ref: {{booking_reference}})', 'Dear {{customer_name}},

Your reservation for {{tour_name}} (Ref: {{booking_reference}}) has been updated.

Departure Date: {{tour_date}}
Pickup Time: {{pickup_time}}
Remaining Balance Due: {{balance_due}}

Best regards,
Awesome Adventure Tours Dispatch Team', '["customer_name","booking_reference","tour_name","tour_date","pickup_time","balance_due"]'::jsonb, true),
('payment_confirmation', 'Payment Confirmation', 'Email', 'Payment Confirmation: {{booking_reference}} - Awesome Adventure Tours', 'Dear {{customer_name}},

We have successfully processed your payment of {{amount}} for booking {{booking_reference}} ({{tour_name}}).

Remaining Balance Due: {{balance_due}}

Thank you,
Awesome Adventure Tours Finance', '["customer_name","booking_reference","tour_name","amount","balance_due"]'::jsonb, true),
('payment_reminder', 'Payment Reminder', 'Email', 'Payment Reminder: Balance Due for {{tour_name}}', 'Dear {{customer_name}},

This is a friendly reminder regarding your upcoming departure for {{tour_name}} on {{tour_date}}.

Outstanding Balance Due: {{balance_due}}
Scheduled Hotel Pickup: {{pickup_time}}

Best regards,
Awesome Adventure Tours', '["customer_name","booking_reference","tour_name","tour_date","pickup_time","balance_due"]'::jsonb, true),
('cancellation', 'Booking Cancellation', 'Email', 'Cancellation Confirmation: {{booking_reference}} - {{tour_name}}', 'Dear {{customer_name}},

Your reservation {{booking_reference}} for {{tour_name}} on {{tour_date}} has been cancelled.

Our team will contact you if a refund is applicable.

Warm regards,
Awesome Adventure Tours Guest Support', '["customer_name","booking_reference","tour_name","tour_date"]'::jsonb, true),
('refund', 'Refund Notification', 'Email', 'Refund Processed: {{booking_reference}} - Awesome Adventure Tours', 'Dear {{customer_name}},

A refund has been approved and processed for booking {{booking_reference}} ({{tour_name}}).

Refund Amount: {{amount}}

Sincerely,
Awesome Adventure Tours Finance', '["customer_name","booking_reference","tour_name","amount"]'::jsonb, true),
('pickup_reminder', 'Pickup Reminder', 'Email', 'Hotel Pickup Alert for Tomorrow: {{tour_name}}', 'Hello {{customer_name}},

We look forward to welcoming you tomorrow for {{tour_name}}.

Your hotel pickup is confirmed for {{pickup_time}}.
Booking Reference: {{booking_reference}}

Please bring swimwear, sun protection, towels, and a valid photo ID/passport.', '["customer_name","booking_reference","tour_name","pickup_time"]'::jsonb, true),
('tour_reminder', 'Tour Reminder', 'Email', 'Upcoming Tour Reminder: {{tour_name}} on {{tour_date}}', 'Dear {{customer_name}},

Your excursion {{tour_name}} is coming up on {{tour_date}}.

Booking Reference: {{booking_reference}}
Scheduled Pickup Time: {{pickup_time}}
Remaining Balance Due: {{balance_due}}

We look forward to welcoming you.', '["customer_name","booking_reference","tour_name","tour_date","pickup_time","balance_due"]'::jsonb, true),
('inquiry_response', 'Inquiry Response', 'Email', 'Regarding Your Inquiry - Awesome Adventure Tours', 'Dear {{customer_name}},

Thank you for your interest in Awesome Adventure Tours. Our team is reviewing your inquiry and will be pleased to assist.

Best regards,
Awesome Adventure Tours Guest Experience', '["customer_name"]'::jsonb, true),
('follow_up', 'Customer Follow-up', 'Email', 'Your Red Sea Holiday Concierge Check-in', 'Dear {{customer_name}},

We hope you are enjoying your stay in the Red Sea region. Our team is available to help arrange your next adventure.

Best regards,
Awesome Adventure Tours VIP Concierge', '["customer_name"]'::jsonb, true),
('welcome', 'Welcome to Awesome Adventure Tours', 'Email', 'Welcome to Awesome Adventure Tours, {{customer_name}}!', 'Dear {{customer_name}},

Welcome to Awesome Adventure Tours. We are delighted to help you discover the Egyptian Red Sea.

Explore our curated tours: https://awesomeadventure.tours/excursions

Warm regards,
Awesome Adventure Tours Guest Relations', '["customer_name"]'::jsonb, true),
('review_request', 'Review Request', 'Email', 'How was your experience on {{tour_name}}?', 'Dear {{customer_name}},

We hope you had a fantastic voyage on {{tour_name}}. Your feedback means a lot to our local team.

Review Link: https://awesomeadventure.tours/review?ref={{booking_reference}}

Thank you for sailing with us,
Awesome Adventure Tours', '["customer_name","tour_name","booking_reference"]'::jsonb, true),
('newsletter_welcome', 'Newsletter Welcome', 'Email', 'Welcome to Awesome Adventure Tours — your 15% voucher', 'Thank you for subscribing to Awesome Adventure Tours. Your 15% voucher code is {{discount_code}}. Use it when enquiring about your next excursion.

You can unsubscribe at any time: {{unsubscribe_url}}', '["discount_code","unsubscribe_url"]'::jsonb, true),
('ticket_created', 'Support Ticket Received', 'Email', 'We received your support request {{ticket_reference}}', 'Hello {{customer_name}},

We received your support request ({{ticket_reference}}). Our team will review it and respond as soon as possible.', '["customer_name","ticket_reference"]'::jsonb, false),
('ticket_reply', 'New Reply to Your Support Ticket {{ticket_reference}}', 'Email', 'There is an update to your support request', 'Hello {{customer_name}},

Our team has replied to your support request ({{ticket_reference}}). Sign in to your account to review the response.', '["customer_name","ticket_reference"]'::jsonb, false),
('post_trip_thank_you', 'Thank You for Traveling With Us', 'Email', 'Thank you for joining {{tour_name}}', 'Hello {{customer_name}},

Thank you for joining us for {{tour_name}}. We hope you enjoyed your Red Sea experience and look forward to welcoming you again.', '["customer_name","tour_name"]'::jsonb, false)
ON CONFLICT (template_key) DO NOTHING;

-- Keep the original shared email/WhatsApp templates available to both channels.
UPDATE public.communication_templates
SET channel = 'Both'
WHERE template_key IN (
  'booking_confirmation', 'booking_update', 'payment_confirmation',
  'payment_reminder', 'cancellation', 'refund', 'pickup_reminder',
  'tour_reminder', 'inquiry_response', 'follow_up', 'welcome', 'review_request'
);
