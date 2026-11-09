/**
 * Application & Booking Platform Configuration
 * 
 * Production Configuration:
 * - Real availability calculation based on live boat manifest capacities and bookings
 * - Pay at hotel pickup enabled with multi-currency support (EUR, USD, GBP, EGP)
 * - Remote Supabase integration for persistent tours, bookings, customers, and CMS media
 */

export const APP_CONFIG = {
  DEMO_MODE: false,
  COMPANY_NAME: 'Awesome Adventure Tours',
  LEGAL_NAME: 'Awesome Adventure Tours S.A.E.',
  
  // WhatsApp support number (Pier Desk Hotline)
  WHATSAPP_NUMBER: '+20 151 5212741',
  WHATSAPP_DISPLAY: '+20 151 5212741',
  
  SUPPORT_PHONE: '+20 151 5212741',
  SUPPORT_EMAIL: 'reservations@awesomeadventure.tours',
  OFFICE_LOCATION: 'Berth B-14, Hurghada Marina, Red Sea Governorate, Egypt',

  // Booking notice & availability defaults
  DEFAULT_MIN_BOOKING_NOTICE_HOURS: 24,
  DEFAULT_MAX_GUESTS_PER_DEPARTURE: 24,
  
  // Storage keys for persisting active booking draft & bookings repository
  STORAGE_KEYS: {
    BOOKINGS: 'rse_bookings_v1',
    ACTIVE_DRAFT: 'rse_booking_draft_v1',
    PREFERRED_CURRENCY: 'rse_preferred_currency',
  },

  // Payment configuration
  PAYMENT_SETTINGS: {
    ALLOW_PAY_ONLINE: false, // Disabled until Stripe / Paymob merchant gateway is connected
    ONLINE_PAYMENT_NOTICE: 'Online credit card payment will be available soon with 3D Secure checkout. For now, please select "Pay at Hotel Pickup" to secure your booking without upfront charge.',
    ALLOW_PAY_AT_PICKUP: true,
    ACCEPTED_PAYMENT_CURRENCIES: ['EUR', 'USD', 'GBP', 'EGP'],
  },

  // Policies
  CANCELLATION_POLICY_SUMMARY: 'Free cancellation up to 24 hours prior to scheduled departure. Cancellations within 24 hours or no-shows are subject to individual operator terms. 100% weather refund guarantee if Egyptian Coast Guard restricts harbor departure.',
};
