import { supabase, isSupabaseConfigured } from './supabaseClient';
import { Booking, BookingStatus, PaymentStatus, BookingPricing, GuestCounts, PickupLocation, BookingExtra } from '../types/booking';
import { FinancePayment, FinanceRefund } from '../types/finance';
import { UnifiedCustomer } from './customerService';
import { CrmActivity } from '../types/crm';

/**
 * ==============================================================================
 * AUTHORITATIVE PLATFORM CONSISTENCY ENGINE
 * Single authoritative implementation for:
 * 1. Pricing Engine
 * 2. Availability & Capacity Engine
 * 3. Booking Status Lifecycle
 * 4. Payment Balance & Financial Calculations
 * 5. Customer Identity & Deduplication
 * ==============================================================================
 */

// ------------------------------------------------------------------------------
// 1. AUTHORITATIVE PRICING ENGINE
// ------------------------------------------------------------------------------

export interface AuthoritativePricingParams {
  adultBasePrice: number;
  childBasePrice?: number;
  guests: GuestCounts;
  pickupLocation?: PickupLocation | null;
  extras?: Array<{
    extra: BookingExtra;
    quantity?: number;
  }>;
  discountEur?: number;
}

export function calculateAuthoritativePrice({
  adultBasePrice,
  childBasePrice,
  guests,
  pickupLocation,
  extras = [],
  discountEur = 0,
}: AuthoritativePricingParams): BookingPricing {
  const adults = Math.max(1, guests.adults || 1);
  const children = Math.max(0, guests.children || 0);
  const infants = Math.max(0, guests.infants || 0);
  const payingPassengers = adults + children;

  const resolvedAdultBasePrice = Math.max(0, Number(adultBasePrice) || 0);
  const resolvedChildBasePrice = typeof childBasePrice === 'number'
    ? Math.max(0, Number(childBasePrice))
    : Math.round(resolvedAdultBasePrice * 0.5);

  const adultSubtotalEur = adults * resolvedAdultBasePrice;
  const childSubtotalEur = children * resolvedChildBasePrice;
  const infantSubtotalEur = 0;

  // Pickup fee
  let pickupSubtotalEur = 0;
  let pickupFeePerPersonEur = 0;
  if (pickupLocation) {
    pickupFeePerPersonEur = Number(pickupLocation.feeEurPerPerson) || 0;
    const flatFee = Number(pickupLocation.feeEurFlat) || 0;
    pickupSubtotalEur = (payingPassengers * pickupFeePerPersonEur) + flatFee;
  }

  // Extras fee
  let extrasSubtotalEur = 0;
  const extrasBreakdown: BookingPricing['extrasBreakdown'] = [];

  extras.forEach(({ extra, quantity = 1 }) => {
    const qty = Math.max(1, quantity);
    let amountEur = 0;
    const unitPrice = Number(extra.priceEur) || 0;

    if (extra.pricingType === 'per_person') {
      amountEur = unitPrice * payingPassengers * qty;
    } else {
      amountEur = unitPrice * qty;
    }

    extrasSubtotalEur += amountEur;
    extrasBreakdown.push({
      extraId: extra.id,
      name: extra.name,
      pricingType: extra.pricingType,
      unitPriceEur: unitPrice,
      quantity: qty,
      totalPriceEur: amountEur,
      amountEur: amountEur,
    });
  });

  const grossTotal = adultSubtotalEur + childSubtotalEur + pickupSubtotalEur + extrasSubtotalEur;
  const resolvedDiscount = Math.min(grossTotal, Math.max(0, Number(discountEur) || 0));
  const totalEur = Math.max(0, Math.round((grossTotal - resolvedDiscount) * 100) / 100);

  return {
    adultsCount: adults,
    basePricePerAdultEur: resolvedAdultBasePrice,
    adultSubtotalEur,
    childrenCount: children,
    basePricePerChildEur: resolvedChildBasePrice,
    childSubtotalEur,
    infantsCount: infants,
    infantSubtotalEur,
    pickupSubtotalEur,
    pickupFeePerPersonEur,
    extrasSubtotalEur,
    extrasBreakdown,
    discountEur: resolvedDiscount,
    totalEur,
    formattedTotal: `€${totalEur.toFixed(2)}`,
  };
}

// ------------------------------------------------------------------------------
// 2. AUTHORITATIVE AVAILABILITY & CAPACITY ENGINE
// ------------------------------------------------------------------------------

export interface CapacityCheckResult {
  allowed: boolean;
  maxCapacity: number;
  currentBooked: number;
  requestedPartySize: number;
  remainingSeats: number;
  status: 'available' | 'sold_out' | 'unavailable' | 'blackout' | 'over_capacity';
  errorMessage?: string;
}

export function checkCapacityAndAvailability(
  tourId: string,
  dateStr: string,
  partySize: number,
  allBookings: Booking[],
  maxTourCapacity: number = 35
): CapacityCheckResult {
  const cleanDate = dateStr.split('T')[0];
  const requested = Math.max(1, partySize);

  // Check ops blackout / availability overrides in localStorage
  try {
    const rawOps = localStorage.getItem('rse_ops_availability');
    if (rawOps) {
      const slots = JSON.parse(rawOps);
      const slot = slots.find((s: any) => s.tourId === tourId && s.date === cleanDate);
      if (slot) {
        if (slot.isBlackout || slot.status === 'unavailable') {
          return {
            allowed: false,
            maxCapacity: slot.maxCapacity || maxTourCapacity,
            currentBooked: slot.bookedCount || 0,
            requestedPartySize: requested,
            remainingSeats: 0,
            status: 'blackout',
            errorMessage: `Excursion departure on ${cleanDate} is closed or designated as an operational blackout date.`,
          };
        }
        if (slot.status === 'sold_out') {
          return {
            allowed: false,
            maxCapacity: slot.maxCapacity || maxTourCapacity,
            currentBooked: slot.maxCapacity || maxTourCapacity,
            requestedPartySize: requested,
            remainingSeats: 0,
            status: 'sold_out',
            errorMessage: `Excursion departure on ${cleanDate} is completely sold out.`,
          };
        }
      }
    }
  } catch {
    // ignore
  }

  // Count active non-cancelled passengers for this tour & date
  const currentBookedCount = allBookings
    .filter(
      (b) =>
        b.tourId === tourId &&
        b.date?.split('T')[0] === cleanDate &&
        b.status !== 'cancelled'
    )
    .reduce(
      (sum, b) =>
        sum + (b.guests?.adults || 1) + (b.guests?.children || 0) + (b.guests?.infants || 0),
      0
    );

  const capacity = maxTourCapacity || 35;
  const remainingSeats = Math.max(0, capacity - currentBookedCount);

  if (currentBookedCount + requested > capacity) {
    return {
      allowed: false,
      maxCapacity: capacity,
      currentBooked: currentBookedCount,
      requestedPartySize: requested,
      remainingSeats,
      status: 'over_capacity',
      errorMessage: `Only ${remainingSeats} seat(s) remaining for departure on ${cleanDate}. Requested: ${requested} guests.`,
    };
  }

  return {
    allowed: true,
    maxCapacity: capacity,
    currentBooked: currentBookedCount,
    requestedPartySize: requested,
    remainingSeats: remainingSeats - requested,
    status: 'available',
  };
}

// ------------------------------------------------------------------------------
// 3. AUTHORITATIVE PAYMENT BALANCE & FINANCIAL CALCULATIONS
// ------------------------------------------------------------------------------

export interface AuthoritativeBalanceResult {
  bookingTotalEur: number;
  totalPaidEur: number;
  totalRefundedEur: number;
  netPaidEur: number;
  balanceDueEur: number;
  paymentStatus: PaymentStatus;
  isFullyPaid: boolean;
  isOverdue: boolean;
}

export function calculateAuthoritativeBalance(
  bookingTotalEur: number,
  payments: FinancePayment[],
  refunds: FinanceRefund[] = [],
  bookingDate?: string
): AuthoritativeBalanceResult {
  const total = Math.max(0, Number(bookingTotalEur) || 0);

  // Sum approved/completed payments
  const totalPaid = payments
    .filter((p) => p.paymentStatus === 'Paid' || p.paymentStatus === 'paid')
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  // Sum processed/approved refunds
  const totalRefunded = refunds
    .filter((r) => r.status === 'processed' || r.status === 'approved')
    .reduce((sum, r) => sum + (Number(r.approvedAmount ?? r.amount) || 0), 0);

  const netPaid = Math.max(0, totalPaid - totalRefunded);
  const balanceDue = Math.max(0, Math.round((total - netPaid) * 100) / 100);

  let paymentStatus: PaymentStatus = 'pending';
  if (netPaid >= total && total > 0) {
    paymentStatus = 'paid';
  } else if (netPaid > 0) {
    paymentStatus = 'partially_paid';
  } else if (totalRefunded > 0 && netPaid === 0) {
    paymentStatus = 'refunded';
  }

  const isFullyPaid = paymentStatus === 'paid';

  // Check overdue: departure date has arrived or passed and balance is outstanding
  let isOverdue = false;
  if (bookingDate && balanceDue > 0) {
    const todayStr = new Date().toISOString().split('T')[0];
    const depStr = bookingDate.split('T')[0];
    if (depStr <= todayStr) {
      isOverdue = true;
    }
  }

  return {
    bookingTotalEur: total,
    totalPaidEur: totalPaid,
    totalRefundedEur: totalRefunded,
    netPaidEur: netPaid,
    balanceDueEur: balanceDue,
    paymentStatus,
    isFullyPaid,
    isOverdue,
  };
}

// ------------------------------------------------------------------------------
// 4. AUTHORITATIVE CUSTOMER IDENTITY & LIFETIME METRICS
// ------------------------------------------------------------------------------

export interface AuthoritativeCustomerIdentity {
  id: string;
  email: string;
  fullName: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  whatsapp?: string | null;
  country?: string | null;
  hotel?: string | null;
  userId?: string | null;
  totalBookings: number;
  totalSpentEur: number;
  lastBookingDate?: string | null;
  tags: string[];
  isNewCustomer: boolean;
}

export async function findOrCreateAuthoritativeCustomer(params: {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  whatsapp?: string | null;
  country?: string | null;
  hotel?: string | null;
  userId?: string | null;
  bookingAmountEur?: number;
  bookingDate?: string;
}): Promise<AuthoritativeCustomerIdentity> {
  const cleanEmail = params.email.trim().toLowerCase();
  const cleanFirst = params.firstName.trim();
  const cleanLast = params.lastName.trim();
  const fullName = `${cleanFirst} ${cleanLast}`.trim();
  const cleanPhone = params.phone?.trim() || null;
  const cleanWhatsapp = params.whatsapp?.trim() || cleanPhone;
  const cleanCountry = params.country?.trim() || 'International';
  const cleanHotel = params.hotel?.trim() || null;

  let customerId: string | null = null;
  let isNew = false;
  let existingUserRecord: any = null;

  // 1. Look up in Supabase if configured
  if (isSupabaseConfigured()) {
    try {
      const { data: byEmail } = await supabase
        .from('customers')
        .select('*')
        .eq('email', cleanEmail)
        .maybeSingle();

      if (byEmail?.id) {
        customerId = byEmail.id;
        existingUserRecord = byEmail;

        // Merge missing attributes
        const updates: any = {};
        if (!byEmail.user_id && params.userId) updates.user_id = params.userId;
        if (!byEmail.phone && cleanPhone) updates.phone = cleanPhone;
        if (!byEmail.hotel && cleanHotel) updates.hotel = cleanHotel;
        if (!byEmail.whatsapp && cleanWhatsapp) updates.whatsapp = cleanWhatsapp;
        if (Object.keys(updates).length > 0) {
          await supabase.from('customers').update(updates).eq('id', customerId);
        }
      } else if (cleanPhone) {
        // Look up by phone
        const { data: byPhone } = await supabase
          .from('customers')
          .select('*')
          .eq('phone', cleanPhone)
          .maybeSingle();

        if (byPhone?.id) {
          customerId = byPhone.id;
          existingUserRecord = byPhone;
        }
      }

      // If still not found, create new customer record in Supabase
      if (!customerId) {
        isNew = true;
        const { data: created, error } = await supabase
          .from('customers')
          .insert({
            user_id: params.userId || null,
            first_name: cleanFirst,
            last_name: cleanLast,
            email: cleanEmail,
            phone: cleanPhone || 'Not Provided',
            whatsapp: cleanWhatsapp,
            country: cleanCountry,
            hotel: cleanHotel,
          })
          .select('*')
          .single();

        if (!error && created) {
          customerId = created.id;
          existingUserRecord = created;
        }
      }
    } catch (err) {
      console.warn('Customer lookup error in Supabase:', err);
    }
  }

  // 2. Fallback local caching & offline sync
  const localCacheKey = 'rse_customers_cache';
  let localCustomers: any[] = [];
  try {
    const raw = localStorage.getItem(localCacheKey);
    if (raw) localCustomers = JSON.parse(raw);
  } catch {}

  let localMatch = localCustomers.find((c: any) => c.email?.toLowerCase() === cleanEmail);
  if (!customerId) {
    if (localMatch) {
      customerId = localMatch.id;
    } else {
      isNew = true;
      customerId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : 'c0000000-0000-4000-8000-' + Math.random().toString(16).substring(2, 14).padStart(12, '0');
    }
  }

  // Calculate updated metrics
  const currentTotalBookings = (localMatch?.totalBookings || 0) + (params.bookingAmountEur !== undefined ? 1 : 0);
  const currentTotalSpent = (localMatch?.totalSpentEur || 0) + (params.bookingAmountEur || 0);
  const lastBookingDate = params.bookingDate || localMatch?.lastBookingDate || new Date().toISOString();

  // Smart tag assignment
  const tags: string[] = localMatch?.tags ? [...localMatch.tags] : [];
  if (!tags.includes('Active Customer')) tags.push('Active Customer');
  if (currentTotalBookings > 1 && !tags.includes('repeat_customer')) tags.push('repeat_customer');
  if (currentTotalSpent >= 500 && !tags.includes('high_value')) tags.push('high_value');
  if (currentTotalSpent >= 1000 && !tags.includes('VIP')) tags.push('VIP');

  const identity: AuthoritativeCustomerIdentity = {
    id: customerId!,
    email: cleanEmail,
    fullName,
    firstName: cleanFirst,
    lastName: cleanLast,
    phone: cleanPhone || localMatch?.phone || existingUserRecord?.phone,
    whatsapp: cleanWhatsapp || localMatch?.whatsapp || existingUserRecord?.whatsapp,
    country: cleanCountry || localMatch?.country || existingUserRecord?.country,
    hotel: cleanHotel || localMatch?.hotel || existingUserRecord?.hotel,
    userId: params.userId || localMatch?.userId || existingUserRecord?.user_id || null,
    totalBookings: currentTotalBookings,
    totalSpentEur: currentTotalSpent,
    lastBookingDate,
    tags,
    isNewCustomer: isNew,
  };

  // Persist updated customer object to local storage
  const updatedLocal = [
    {
      ...identity,
      createdAt: localMatch?.createdAt || new Date().toISOString(),
    },
    ...localCustomers.filter((c: any) => c.email?.toLowerCase() !== cleanEmail),
  ];
  try {
    localStorage.setItem(localCacheKey, JSON.stringify(updatedLocal));
  } catch {}

  return identity;
}

// ------------------------------------------------------------------------------
// 5. AUTHORITATIVE BOOKING STATUS TRANSITIONS
// ------------------------------------------------------------------------------

const ALLOWED_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['cancellation_requested', 'cancelled', 'completed', 'no_show'],
  cancellation_requested: ['cancelled', 'confirmed'],
  cancelled: ['confirmed'], // Admin reinstatement
  completed: [],
  no_show: ['cancelled'],
};

export function canTransitionBookingStatus(
  currentStatus: BookingStatus,
  targetStatus: BookingStatus
): boolean {
  if (currentStatus === targetStatus) return true;
  const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
  return allowed.includes(targetStatus);
}
