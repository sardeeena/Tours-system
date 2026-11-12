import { Tour, CurrencyConfig } from './index';

export interface GuestCounts {
  adults: number;
  children: number;
  infants: number;
}

export interface PickupLocation {
  id: string;
  name: string;
  area: string;
  feeEurPerPerson: number;
  feeEurFlat?: number;
  note?: string;
  isPopular?: boolean;
}

export type ExtraPricingType = 
  | 'per_person' 
  | 'per_booking' 
  | 'per_adult' 
  | 'per_child' 
  | 'per_vehicle' 
  | 'per_item';

export interface BookingExtra {
  id: string;
  name: string;
  description: string;
  priceEur: number;
  pricingType: ExtraPricingType;
  quantity?: number;
  category?: string;
  imageUrl?: string;
  minQuantity?: number;
  maxQuantity?: number;
  currency?: string;
  assignedTourIds?: string[];
}

export interface CustomerInfo {
  firstName: string;
  lastName: string;
  email: string;
  countryCode: string;
  phoneNumber: string;
  country: string;
  whatsappNumber?: string;
  hotelName?: string;
  roomNumber?: string;
  specialRequests?: string;
}

export interface BookingPricing {
  basePricePerAdultEur: number;
  basePricePerChildEur: number;
  adultSubtotalEur: number;
  childSubtotalEur: number;
  infantSubtotalEur: number;
  pickupSubtotalEur: number;
  pickupFeePerPersonEur: number;
  extrasSubtotalEur: number;
  extrasBreakdown: Array<{
    extraId: string;
    name: string;
    amountEur: number;
    unitPriceEur?: number;
    totalPriceEur?: number;
    pricingType: ExtraPricingType;
    quantity: number;
  }>;
  discountEur: number;
  subtotalEur?: number;
  totalEur: number;
  currency?: string;
  // Formatted representations in active currency
  formattedTotal: string;
  formattedSubtotal?: string;
  adultsCount?: number;
  childrenCount?: number;
  infantsCount?: number;
}

export type PaymentMethod = 'pay_at_pickup' | 'pay_online';

export type PaymentStatus = 'pending' | 'paid' | 'partially_paid' | 'refunded' | 'failed';

export type BookingStatus = 
  | 'pending' 
  | 'confirmed' 
  | 'cancellation_requested' 
  | 'cancelled' 
  | 'completed' 
  | 'no_show';

export interface Booking {
  bookingId: string;
  bookingReference: string; // e.g. RST-2026-AB4821
  idempotencyKey?: string; // Request idempotency token for duplicate & retry protection
  couponCode?: string; // Validated and redeemed atomically by the database
  tourId: string;
  tourSlug: string;
  tourTitle: string;
  tourImage: string;
  tourDestination: string;
  tourDuration: string;
  tourLanguage?: string;
  date: string;
  departureTime?: string;
  customerId?: string;
  guests: GuestCounts;
  pickup: {
    locationId?: string;
    locationName: string;
    area: string;
    feeEur: number;
    hotelName?: string;
    roomNumber?: string;
    pickupTime?: string;
  };
  extras: Array<{
    extraId: string;
    name: string;
    priceEur: number;
    pricingType: ExtraPricingType;
    quantity: number;
    amountEur: number;
  }>;
  customer: CustomerInfo;
  pricing: BookingPricing;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  status: BookingStatus;
  bookingStatus?: BookingStatus;
  timeline?: Array<{
    id: string;
    timestamp: string;
    title: string;
    description?: string;
    type?: string;
  }>;
  cancellationReason?: string;
  cancellationRequestedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CancellationRequest {
  bookingReference: string;
  reason: string;
  requestedAt: string;
  status: 'requested' | 'approved' | 'rejected';
}

export interface Availability {
  date: string;
  tourId: string;
  capacity: number;
  booked: number;
  remaining: number;
  isAvailable: boolean;
  isSoldOut: boolean;
  isPastDate: boolean;
  meetsMinimumNotice: boolean;
  minNoticeHours: number;
  status?: 'available' | 'unavailable' | 'sold_out';
}
