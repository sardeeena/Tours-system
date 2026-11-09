import { GuestCounts, CustomerInfo } from '../types/booking';
import { APP_CONFIG } from '../config/appConfig';

export interface BookingDraftState {
  tourSlug: string;
  currentStep: number;
  date: string;
  guests: GuestCounts;
  pickupLocationId: string;
  hotelName: string;
  roomNumber: string;
  selectedExtraIds: string[];
  customer: CustomerInfo;
  paymentMethod: 'pay_at_pickup' | 'pay_online';
  termsAccepted: boolean;
}

export const INITIAL_DRAFT_STATE: BookingDraftState = {
  tourSlug: '',
  currentStep: 1,
  date: '',
  guests: {
    adults: 2,
    children: 0,
    infants: 0,
  },
  pickupLocationId: 'hurghada',
  hotelName: '',
  roomNumber: '',
  selectedExtraIds: [],
  customer: {
    firstName: '',
    lastName: '',
    email: '',
    countryCode: '+20',
    phoneNumber: '',
    country: 'Egypt',
    whatsappNumber: '',
    hotelName: '',
    roomNumber: '',
    specialRequests: '',
  },
  paymentMethod: 'pay_at_pickup',
  termsAccepted: false,
};

export function loadBookingDraft(tourSlug?: string): BookingDraftState {
  try {
    const raw = sessionStorage.getItem(APP_CONFIG.STORAGE_KEYS.ACTIVE_DRAFT);
    if (raw) {
      const parsed = JSON.parse(raw) as BookingDraftState;
      if (!tourSlug || parsed.tourSlug === tourSlug) {
        return {
          ...INITIAL_DRAFT_STATE,
          ...parsed,
          // Ensure guests always valid
          guests: {
            adults: Math.max(1, parsed.guests?.adults || 2),
            children: Math.max(0, parsed.guests?.children || 0),
            infants: Math.max(0, parsed.guests?.infants || 0),
          },
        };
      }
    }
  } catch {
    // Ignore storage parse issues
  }

  return {
    ...INITIAL_DRAFT_STATE,
    tourSlug: tourSlug || '',
  };
}

export function saveBookingDraft(state: BookingDraftState): void {
  try {
    sessionStorage.setItem(APP_CONFIG.STORAGE_KEYS.ACTIVE_DRAFT, JSON.stringify(state));
  } catch {
    // Ignore
  }
}

export function clearBookingDraft(): void {
  try {
    sessionStorage.removeItem(APP_CONFIG.STORAGE_KEYS.ACTIVE_DRAFT);
  } catch {
    // Ignore
  }
}
