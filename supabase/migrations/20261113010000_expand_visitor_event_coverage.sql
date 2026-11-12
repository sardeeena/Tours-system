-- Extend the consent-gated visitor event vocabulary without changing existing records.
BEGIN;
ALTER TABLE public.visitor_events
  DROP CONSTRAINT IF EXISTS visitor_events_event_name_check;
ALTER TABLE public.visitor_events
  ADD CONSTRAINT visitor_events_event_name_check CHECK (event_name IN (
    'page_view','page_exit','navigation','tour_view','search',
    'booking_started','booking_step_completed','booking_submitted',
    'booking_confirmed','booking_cancelled','custom',
    'auth_sign_in',
    'auth_sign_in_failed',
    'auth_sign_up',
    'auth_sign_out',
    'password_reset_requested',
    'password_changed',
    'profile_updated',
    'inquiry_submitted',
    'newsletter_subscribed',
    'booking_lookup',
    'booking_cancellation_requested',
    'support_ticket_created',
    'support_reply_sent',
    'support_ticket_updated',
    'tour_search',
    'tour_filter_applied',
    'wishlist_updated',
    'comparison_updated',
    'chatbot_interaction',
    'contact_request_submitted',
    'booking_step_viewed',
    'review_submitted',
    'tour_shared',
    'language_changed',
    'currency_changed'
  ));
COMMIT;
