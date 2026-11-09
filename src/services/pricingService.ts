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

  // 1. Adult Base Pricing
  const basePricePerAdultEur = tour.priceEur;
  const adultSubtotalEur = adults * basePricePerAdultEur;

  // 2. Child Pricing (use tour's configured child price or rule of 50%)
  const basePricePerChildEur = 
    typeof tour.childPriceEur === 'number' 
      ? tour.childPriceEur 
      : Math.round(tour.priceEur * 0.5);
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
