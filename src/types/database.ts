// ==============================================================================
// SUPABASE DATABASE TYPE DEFINITIONS
// Strongly typed interfaces matching the PostgreSQL schema
// ==============================================================================

export type { Database, Json, Tables, TablesInsert, TablesUpdate } from './database.types';

export type UserRole = 'admin' | 'super_admin' | 'manager' | 'staff' | 'customer';

export type TourStatus = 'draft' | 'published' | 'archived';
export type TourType = 'Shared' | 'Private';
export type DurationCategory = 'Half Day' | 'Full Day' | 'Multi Day';

export interface DbProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface DbDestination {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  description: string | null;
  main_image: string | null;
  gallery: string[];
  distance_from_airport: string | null;
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string[];
  status: 'draft' | 'published' | 'archived';
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface DbCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  icon_name: string | null;
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string[];
  status: 'draft' | 'published' | 'archived';
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface DbTour {
  id: string;
  title: string;
  slug: string;
  short_description: string | null;
  description: string | null;
  destination_id: string | null;
  duration: string;
  duration_type: DurationCategory;
  duration_hours: number;
  tour_type: TourType;
  status: TourStatus;
  featured: boolean;
  price: number;
  child_price: number;
  infant_price: number;
  private_price: number;
  currency: string;
  max_guests: number;
  minimum_booking_notice_hours: number;
  pickup_available: boolean;
  pickup_info: string | null;
  cancellation_policy: string | null;
  departure_time: string | null;
  available_days: string[];
  languages: string[];
  difficulty: 'Easy' | 'Moderate' | 'Adventurous' | null;
  age_restrictions: string | null;
  badge: string | null;
  rating: number;
  review_count: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface DbTourImage {
  id: string;
  tour_id: string;
  image_url: string;
  storage_path: string | null;
  alt_text: string | null;
  caption: string | null;
  is_primary: boolean;
  sort_order: number;
  created_at: string;
}

export interface DbTourVideo {
  id: string;
  tour_id: string;
  video_url: string;
  title: string | null;
  description: string | null;
  provider: 'youtube' | 'vimeo' | 'storage' | 'direct';
  storage_path: string | null;
  is_primary: boolean;
  sort_order: number;
  created_at: string;
}

export interface DbTourItinerary {
  id: string;
  tour_id: string;
  time: string;
  title: string;
  description: string | null;
  sort_order: number;
  created_at: string;
}

export interface DbTourInclusion {
  id: string;
  tour_id: string;
  item: string;
  sort_order: number;
  created_at: string;
}

export interface DbTourExclusion {
  id: string;
  tour_id: string;
  item: string;
  sort_order: number;
  created_at: string;
}

export interface DbTourHighlight {
  id: string;
  tour_id: string;
  item: string;
  sort_order: number;
  created_at: string;
}

export interface DbTourFaq {
  id: string;
  tour_id: string;
  question: string;
  answer: string;
  section: 'faq' | 'what_to_bring' | 'important_information';
  sort_order: number;
  created_at: string;
}

export interface DbPickupLocation {
  id: string;
  code: string;
  name: string;
  area: string;
  fee_eur_per_person: number;
  fee_eur_flat: number;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface DbTourExtra {
  id: string;
  tour_id?: string | null;
  name: string;
  description: string | null;
  price_eur: number;
  currency: string;
  pricing_type: 'per_person' | 'per_booking' | 'per_adult' | 'per_child' | 'per_vehicle' | 'per_item';
  is_active: boolean;
  sort_order: number;
  image_url?: string | null;
  min_quantity?: number;
  max_quantity?: number;
  created_at: string;
  updated_at: string;
}

export interface DbTourAvailability {
  id: string;
  tour_id: string;
  date: string; // YYYY-MM-DD
  status: 'available' | 'unavailable' | 'sold_out';
  max_capacity: number;
  booked_count: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbCustomer {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  whatsapp: string | null;
  country: string;
  country_code: string | null;
  hotel: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbBooking {
  id: string;
  booking_reference: string;
  tour_id: string;
  customer_id: string | null;
  tour_language: string | null;
  booking_date: string;
  status: 'pending' | 'confirmed' | 'cancellation_requested' | 'cancelled' | 'completed' | 'no_show';
  payment_status: 'pending' | 'paid' | 'partially_paid' | 'refunded' | 'failed';
  payment_method: 'pay_at_pickup' | 'pay_online';
  adult_count: number;
  child_count: number;
  infant_count: number;
  pickup_location_id: string | null;
  pickup_hotel_name: string | null;
  pickup_room_number: string | null;
  subtotal: number;
  extras_total: number;
  discount: number;
  total: number;
  currency: string;
  special_requests: string | null;
  cancellation_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbBookingExtra {
  id: string;
  booking_id: string;
  extra_id: string | null;
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  pricing_type: string;
  created_at: string;
}

export interface DbReview {
  id: string;
  tour_id: string | null;
  author_name: string;
  country: string | null;
  country_code: string | null;
  rating: number;
  comment: string;
  date: string;
  traveler_type: string | null;
  verified_booking: boolean;
  is_published: boolean;
  created_at: string;
}

export interface DbSeoMetadata {
  id: string;
  entity_type: 'tour' | 'destination' | 'category' | 'page';
  entity_id: string | null;
  page_slug: string | null;
  seo_title: string | null;
  meta_description: string | null;
  seo_keywords: string[];
  canonical_url: string | null;
  og_title: string | null;
  og_description: string | null;
  og_image: string | null;
  social_image: string | null;
  structured_data: Record<string, unknown> | null;
  robots_index: boolean;
  robots_follow: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbSiteSetting {
  key: string;
  value: Record<string, unknown>;
  description: string | null;
  updated_at: string;
  updated_by: string | null;
}

export interface DbAuditLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
}

export interface DbCoupon {
  id: string;
  code: string;
  description: string | null;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_spend: number;
  max_discount: number | null;
  valid_from: string;
  valid_until: string | null;
  max_redemptions?: number | null;
  usage_limit?: number | null;
  times_redeemed?: number;
  times_used?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbBookingPassenger {
  id: string;
  booking_id: string;
  full_name: string;
  nationality: string | null;
  passport_or_id_number: string | null;
  date_of_birth?: string | null;
  passenger_type: 'adult' | 'child' | 'infant';
  is_lead_passenger: boolean;
  special_dietary_needs?: string | null;
  created_at: string;
}

export interface DbVessel {
  id: string;
  name: string;
  vessel_type: 'motor_yacht' | 'speedboat' | 'catamaran' | 'glass_bottom' | 'semi_submarine' | 'safari_jeep' | string;
  registration_number: string | null;
  port_marina: string;
  passenger_capacity: number;
  crew_capacity: number;
  year_built: number | null;
  safety_inspection_expiry: string | null;
  amenities: string[];
  is_active: boolean;
  status?: 'active' | 'in_service' | 'maintenance' | 'dry_dock' | 'inactive' | string;
  maintenance_notes?: string | null;
  next_maintenance?: string | null;
  crew?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbGuide {
  id: string;
  full_name: string;
  role:
    | 'captain'
    | 'dive_master'
    | 'snorkel_guide'
    | 'safari_lead'
    | 'tour_guide'
    | 'guide'
    | 'driver'
    | 'crew'
    | 'photographer'
    | 'other'
    | string;
  languages: string[];
  phone: string | null;
  email: string | null;
  license_number: string | null;
  rating: number;
  is_active: boolean;
  availability_status?: 'available' | 'on_duty' | 'day_off' | 'leave' | 'unavailable' | string;
  notes?: string | null;
  created_at: string;
}

export interface DbInquiry {
  id: string;
  customer_name: string;
  email: string;
  phone: string | null;
  whatsapp: string | null;
  tour_id: string | null;
  subject: string;
  message: string;
  status: 'new' | 'contacted' | 'resolved' | 'converted';
  source: 'web' | 'whatsapp' | 'email' | 'phone';
  ip_address: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbNewsletterSubscriber {
  id: string;
  email: string;
  preferred_language: string;
  source: string | null;
  is_active: boolean;
  subscribed_at: string;
  unsubscribed_at: string | null;
}

export interface DbPaymentTransaction {
  id: string;
  booking_id: string;
  gateway: 'stripe' | 'paypal' | 'paymob' | 'cash_at_pickup';
  transaction_reference: string;
  amount: number;
  currency: string;
  status: 'initiated' | 'succeeded' | 'failed' | 'refunded';
  card_brand: string | null;
  card_last4: string | null;
  raw_response: Record<string, unknown> | null;
  created_at: string;
}

export interface DbFaq {
  id: string;
  category: 'general' | 'booking' | 'cancellation' | 'marine_safety' | 'transfers';
  question: string;
  answer: string;
  sort_order: number;
  is_published: boolean;
  created_at: string;
}

export interface DbWeatherBulletin {
  id: string;
  harbor_location: string;
  water_temperature_c: number;
  air_temperature_c: number;
  swell_height_m: number;
  wind_speed_knots: number;
  wind_direction: string;
  visibility_meters: number;
  coast_guard_cleared: boolean;
  advisory_notes: string | null;
  bulletin_date: string;
  created_at: string;
}

// Database Views
export interface DbViewToursCatalog {
  id: string;
  title: string;
  slug: string;
  short_description: string | null;
  duration: string;
  duration_type: DurationCategory;
  duration_hours: number;
  tour_type: TourType;
  price: number;
  child_price: number | null;
  currency: string;
  rating: number;
  review_count: number;
  badge: string | null;
  featured: boolean;
  departure_time: string | null;
  cancellation_policy: string | null;
  pickup_available: boolean;
  destination_id: string | null;
  destination_name: string | null;
  destination_slug: string | null;
  primary_image: string | null;
  categories: string[];
}

export interface DbViewBookingsDetailed {
  booking_id: string;
  booking_reference: string;
  booking_date: string;
  booking_status: string;
  payment_status: string;
  payment_method: string;
  adult_count: number;
  child_count: number;
  infant_count: number;
  total_passengers: number;
  subtotal: number;
  extras_total: number;
  discount: number;
  total: number;
  currency: string;
  pickup_hotel_name: string | null;
  pickup_room_number: string | null;
  pickup_time_confirmed: string | null;
  special_requests: string | null;
  booked_at: string;
  tour_id: string;
  tour_title: string;
  tour_slug: string;
  destination_name: string | null;
  customer_id: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_whatsapp: string | null;
  customer_country: string;
  pickup_area_name: string | null;
  coupon_applied: string | null;
}

export interface DbViewCoastGuardManifest {
  booking_date: string;
  excursion_name: string;
  assigned_vessel: string | null;
  vessel_registration: string | null;
  departure_harbor: string | null;
  booking_reference: string;
  passenger_name: string;
  nationality: string;
  passport_or_id_number: string | null;
  passenger_type: 'adult' | 'child' | 'infant';
  is_lead_passenger: boolean;
  pickup_hotel_name: string | null;
  pickup_room_number: string | null;
  contact_phone: string | null;
}

export interface DbViewDashboardKpis {
  total_all_time_bookings: number;
  confirmed_bookings: number;
  departures_today: number;
  total_revenue_eur: number;
  pending_cancellations: number;
  new_leads_count: number;
  active_tours_count: number;
  total_published_reviews: number;
}

// Complete aggregate tour structure for frontend rendering
export interface TourWithRelations extends DbTour {
  destination?: DbDestination | null;
  categories?: DbCategory[];
  images: DbTourImage[];
  videos: DbTourVideo[];
  itinerary: DbTourItinerary[];
  inclusions: DbTourInclusion[];
  exclusions: DbTourExclusion[];
  highlights: DbTourHighlight[];
  faqs: DbTourFaq[];
  pickup_locations?: DbPickupLocation[];
  extras?: DbTourExtra[];
  seo?: DbSeoMetadata | null;
}

// ------------------------------------------------------------------------------
// Audit Logs & Security Records
// ------------------------------------------------------------------------------
export interface DbDetailedAuditLog {
  id: string;
  user_id: string | null;
  user_email: string | null;
  user_role: UserRole | null;
  action: 'insert' | 'update' | 'delete' | 'login' | 'logout' | 'cancel_booking' | 'confirm_booking' | 'refund';
  entity_type: 'booking' | 'tour' | 'destination' | 'customer' | 'inquiry' | 'profile' | 'settings';
  entity_id: string | null;
  old_values: Record<string, any> | null;
  new_values: Record<string, any> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface DbInquiryRecord {
  id: string;
  ticket_number: string;
  customer_name: string;
  email: string;
  phone: string | null;
  whatsapp_number: string | null;
  country: string | null;
  tour_id: string | null;
  tour_slug: string | null;
  tour_title: string | null;
  preferred_date: string | null;
  number_of_guests: number | null;
  inquiry_type: 'custom_tour' | 'private_yacht' | 'group_booking' | 'general_question' | 'support';
  message: string;
  status: 'new' | 'in_progress' | 'responded' | 'converted' | 'archived';
  admin_notes: string | null;
  assigned_to_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export type PermissionAction =
  | 'tours:read'
  | 'tours:create'
  | 'tours:edit'
  | 'tours:delete'
  | 'bookings:read'
  | 'bookings:create'
  | 'bookings:edit'
  | 'bookings:cancel'
  | 'customers:read'
  | 'customers:export'
  | 'inquiries:manage'
  | 'analytics:view'
  | 'settings:manage';

// ------------------------------------------------------------------------------
// Media Assets Management (Supabase Storage Metadata)
// ------------------------------------------------------------------------------
export interface DbMediaAsset {
  id: string;
  storage_path: string;
  bucket_name: string;
  public_url: string;
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
  title: string | null;
  alt_text: string | null;
  tour_id: string | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
}

