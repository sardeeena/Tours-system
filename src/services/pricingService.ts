import { Tour, CurrencyConfig } from '../types';
import { GuestCounts, PickupLocation, BookingExtra, BookingPricing } from '../types/booking';

/**
 * Currency Formatter
 * Consistently formats amounts based on currency configuration
 * e.g. €35.00, $40.00, EGP 1,850
 */
export function formatCurrencyAmount(
  amountEur: number,
  currency: CurrencyConfig
): string {
  const converted = amountEur * (currency.rateToEur || 1);

  if (currency.code === 'EGP') {
    // Round to whole numbers for EGP
    const rounded = Math.round(converted);
    return `EGP ${rounded.toLocaleString('en-US')}`;
  }

  if (currency.code === 'EUR') {
    return `€${converted.toFixed(2)}`;
  }

  if (currency.code === 'USD') {
    return `$${converted.toFixed(2)}`;
  }

  if (currency.code === 'GBP') {
    return `£${converted.toFixed(2)}`;
  }

  return `${currency.symbol}${converted.toFixed(2)}`;
}

export interface CalculateBookingPriceParams {
  tour: Tour;
  guests: GuestCounts;
  pickupLocation?: PickupLocation | null;
  selectedExtras?: Array<{
    extra: BookingExtra;
    quantity?: number;
  }>;
  currency?: CurrencyConfig;
  discountEur?: number;
}

export function getTourAdultRateEur(tour: Pick<Tour, 'tourType' | 'priceEur' | 'privatePriceEur'>): number {
  if (tour.tourType === 'Private') {
    const privateRate = Number(tour.privatePriceEur);
    return Number.isFinite(privateRate) ? Math.max(0, privateRate) : 0;
  }
  return Number.isFinite(tour.priceEur) ? Math.max(0, tour.priceEur) : 0;
}

export function getTourChildRateEur(tour: Pick<Tour, 'tourType' | 'priceEur' | 'childPriceEur' | 'privatePriceEur'>): number {
  if (tour.tourType === 'Private') return getTourAdultRateEur(tour);
  if (typeof tour.childPriceEur === 'number' && Number.isFinite(tour.childPriceEur)) {
    return Math.max(0, tour.childPriceEur);
  }
  return Math.round(getTourAdultRateEur(tour) * 0.5);
}

const DEFAULT_CURRENCY: CurrencyConfig = {
  code: 'EUR',
  symbol: '€',
  name: 'Euro',
  rateToEur: 1,
};

/**
 * Pure Pricing Calculation Engine
 * Calculates itemized subtotals, extra fees, and final grand totals.
 * Never allows negative prices or erratic rounding.
 */
export function calculateBookingPrice({
  tour,
  guests,
  pickupLocation,
  selectedExtras = [],
  currency = DEFAULT_CURRENCY,
  discountEur = 0,
}: CalculateBookingPriceParams): BookingPricing {
  const adults = Math.max(1, guests.adults || 1);
  const children = Math.max(0, guests.children || 0);
  const infants = Math.max(0, guests.infants || 0);
  const payingPassengers = adults + children;

  // Private tours use one configured per-person rate for all paying guests.
  // Shared tours retain their own adult and child rates; infants remain free.
  const isPrivateTour = tour.tourType === 'Private';
  const basePricePerAdultEur = getTourAdultRateEur(tour);
  const basePricePerChildEur = getTourChildRateEur(tour);
  if (isPrivateTour && basePricePerAdultEur <= 0) {
    throw new Error('The private per-person rate is not configured for this excursion.');
  }

  // 1. Adult and child unit prices
  const adultSubtotalEur = adults * basePricePerAdultEur;
  const childSubtotalEur = children * basePricePerChildEur;

  // 3. Infants (Free)
  const infantSubtotalEur = 0;

  // 4. Pickup Location Fees
  let pickupSubtotalEur = 0;
  let pickupFeePerPersonEur = 0;
  if (pickupLocation) {
    pickupFeePerPersonEur = pickupLocation.feeEurPerPerson || 0;
    const perPersonPortion = payingPassengers * pickupFeePerPersonEur;
    const flatPortion = pickupLocation.feeEurFlat || 0;
    pickupSubtotalEur = perPersonPortion + flatPortion;
  }

  // 5. Extras Calculation (Handles per_person, per_vehicle, per_item, and per_booking)
  let extrasSubtotalEur = 0;
  const extrasBreakdown: BookingPricing['extrasBreakdown'] = [];

  selectedExtras.forEach(({ extra, quantity = 1 }) => {
    const qty = Math.max(1, quantity);
    let amountEur = 0;

    if (extra.pricingType === 'per_person') {
      // Per person extra applies to paying passengers (adults + children)
      amountEur = extra.priceEur * payingPassengers * qty;
    } else if (extra.pricingType === 'per_adult') {
      amountEur = extra.priceEur * adults * qty;
    } else if (extra.pricingType === 'per_child') {
      amountEur = extra.priceEur * children * qty;
    } else if (extra.pricingType === 'per_vehicle' || extra.pricingType === 'per_item') {
      // Per vehicle or per item multiplies directly by vehicle/item quantity
      amountEur = extra.priceEur * qty;
    } else {
      // Flat per booking
      amountEur = extra.priceEur * qty;
    }

    extrasSubtotalEur += amountEur;
    extrasBreakdown.push({
      extraId: extra.id,
      name: extra.name,
      amountEur,
      unitPriceEur: extra.priceEur,
      totalPriceEur: amountEur,
      pricingType: extra.pricingType,
      quantity: qty,
    });
  });

  // 6. Subtotal & Grand Total
  const subtotalEur = 
    adultSubtotalEur + 
    childSubtotalEur + 
    infantSubtotalEur + 
    pickupSubtotalEur + 
    extrasSubtotalEur;

  const validDiscount = Math.min(Math.max(0, discountEur), subtotalEur);
  const totalEur = Math.max(0, subtotalEur - validDiscount);

  return {
    basePricePerAdultEur,
    basePricePerChildEur,
    adultSubtotalEur,
    childSubtotalEur,
    infantSubtotalEur,
    pickupSubtotalEur,
    pickupFeePerPersonEur,
    extrasSubtotalEur,
    extrasBreakdown,
    discountEur: validDiscount,
    subtotalEur,
    totalEur,
    currency: currency.code,
    formattedTotal: formatCurrencyAmount(totalEur, currency),
    formattedSubtotal: formatCurrencyAmount(subtotalEur, currency),
  };
}
