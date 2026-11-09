/**
 * Standardized API Request and Response Types for Red Sea Excursions
 */

import { Booking, BookingStatus, PaymentStatus } from './booking';
import { Tour } from './index';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  timestamp: string;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  code?: string;
  details?: Record<string, any>;
  timestamp: string;
}

export interface ApiPaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

// ------------------------------------------------------------------------------
// Booking Lookup API
// ------------------------------------------------------------------------------
export interface BookingLookupRequest {
  reference: string;
  emailOrPhone?: string;
}

export interface BookingLookupResponse {
  found: boolean;
  booking?: {
    bookingId: string;
    bookingReference: string;
    tourTitle: string;
    tourSlug: string;
    tourImage: string;
    tourDestination: string;
    date: string;
    departureTime: string;
    status: BookingStatus;
    paymentStatus: PaymentStatus;
    paymentMethod: string;
    guests: {
      adults: number;
      children: number;
      infants: number;
      total: number;
    };
    pickup: {
      locationName: string;
      area: string;
      hotelName?: string;
      roomNumber?: string;
      feeEur: number;
    };
    customer: {
      name: string;
      emailMasked: string;
      phoneMasked: string;
      country: string;
    };
    totalEur: number;
    cancellationAllowed: boolean;
    cancellationDeadline?: string;
    voucherUrl?: string;
  };
}

// ------------------------------------------------------------------------------
// Availability API
// ------------------------------------------------------------------------------
export interface AvailabilityCheckRequest {
  tourSlug: string;
  date: string; // YYYY-MM-DD
  adults?: number;
  children?: number;
}

export interface TimeSlotAvailability {
  slotId: string;
  time: string;
  label: string;
  availableSeats: number;
  maxCapacity: number;
  status: 'available' | 'low_availability' | 'sold_out' | 'closed';
  privateAvailable: boolean;
}

export interface AvailabilityCheckResponse {
  tourSlug: string;
  date: string;
  isDateAvailable: boolean;
  dayOfWeek: string;
  isPastDate: boolean;
  isNoticeCutoffViolated: boolean;
  minimumNoticeHours: number;
  remainingSeatsTotal: number;
  maxGuestsPerGroup: number;
  slots: TimeSlotAvailability[];
  priceEur: number;
  notes?: string;
}

// ------------------------------------------------------------------------------
// Inquiries API
// ------------------------------------------------------------------------------
export interface InquirySubmitRequest {
  name: string;
  email: string;
  phone?: string;
  whatsappNumber?: string;
  country?: string;
  tourSlug?: string;
  tourTitle?: string;
  preferredDate?: string;
  numberOfGuests?: number;
  inquiryType: 'custom_tour' | 'private_yacht' | 'group_booking' | 'general_question' | 'support';
  message: string;
}

export interface InquirySubmitResponse {
  inquiryId: string;
  ticketNumber: string; // e.g. INQ-2026-X832
  status: 'received' | 'in_review';
  estimatedResponseTime: string;
  receivedAt: string;
}

// ------------------------------------------------------------------------------
// Newsletter API
// ------------------------------------------------------------------------------
export interface NewsletterSubscribeRequest {
  email: string;
  preferredLanguage?: string;
  source?: string;
}

export interface NewsletterSubscribeResponse {
  subscribed: boolean;
  email: string;
  message: string;
  alreadySubscribed?: boolean;
}

// ------------------------------------------------------------------------------
// Health & Config API
// ------------------------------------------------------------------------------
export interface HealthStatusResponse {
  status: 'ok' | 'degraded' | 'error';
  version: string;
  environment: string;
  uptimeSeconds: number;
  timestamp: string;
  services: {
    server: { status: 'healthy'; port: number };
    geminiAi: { status: 'available' | 'disabled'; model: string };
    supabase: { status: 'configured' | 'mock_fallback'; urlProvided: boolean };
    databaseSchema: { cached: boolean; ready: boolean };
  };
  memory: {
    rssMb: number;
    heapUsedMb: number;
    heapTotalMb: number;
  };
}

export interface SystemConfigResponse {
  brandName: string;
  hotline: string;
  whatsappUrl: string;
  operatingHours: string;
  currencyDefault: string;
  supportedCurrencies: string[];
  supportedLanguages: string[];
  depositRequired: boolean;
  cancellationFreeNoticeHours: number;
}
