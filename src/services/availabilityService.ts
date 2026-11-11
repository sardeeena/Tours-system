import { Tour } from '../types';
import { Availability } from '../types/booking';
import { APP_CONFIG } from '../config/appConfig';
import { supabase, isSupabaseConfigured, formatSupabaseError } from './supabaseClient';

/**
 * Calculates the earliest selectable booking date from the configured notice
 * period. This is a date boundary only; it does not create availability.
 */
export function getEarliestSelectableDate(minNoticeHours: number = APP_CONFIG.DEFAULT_MIN_BOOKING_NOTICE_HOURS): string {
  const cutoffTime = new Date(Date.now() + minNoticeHours * 60 * 60 * 1000);
  const year = cutoffTime.getFullYear();
  const month = String(cutoffTime.getMonth() + 1).padStart(2, '0');
  const day = String(cutoffTime.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isDateInPast(dateStr: string): boolean {
  if (!dateStr) return true;
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return dateStr < todayStr;
}

export function meetsNoticeRequirement(dateStr: string, minNoticeHours: number): boolean {
  if (!dateStr) return false;
  return dateStr >= getEarliestSelectableDate(minNoticeHours);
}

function unavailableAvailability(tour: Tour, selectedDate: string, isPastDate: boolean, meetsMinimumNotice: boolean): Availability {
  return {
    date: selectedDate || '',
    tourId: tour.id,
    capacity: 0,
    booked: 0,
    remaining: 0,
    isAvailable: false,
    isSoldOut: false,
    isPastDate,
    meetsMinimumNotice,
    minNoticeHours: APP_CONFIG.DEFAULT_MIN_BOOKING_NOTICE_HOURS,
    status: 'unavailable',
  };
}

/**
 * Development-only local schedule fallback.
 *
 * A date is never considered available merely because a tour has maxGuests or
 * an available_days value. It must have an explicit local availability slot
 * with a positive capacity and status=available. Production always uses the
 * Supabase schedule RPC.
 */
export function getTourAvailability(tour: Tour, selectedDate: string): Availability {
  const minNoticeHours = APP_CONFIG.DEFAULT_MIN_BOOKING_NOTICE_HOURS;
  const isPast = isDateInPast(selectedDate);
  const meetsNotice = meetsNoticeRequirement(selectedDate, minNoticeHours);

  if (isPast || !meetsNotice || !selectedDate) {
    return unavailableAvailability(tour, selectedDate, isPast, meetsNotice);
  }

  if (!import.meta.env.DEV) {
    return unavailableAvailability(tour, selectedDate, false, true);
  }

  try {
    const rawOps = localStorage.getItem('rse_ops_availability');
    const slots = rawOps ? JSON.parse(rawOps) : [];
    const slot = Array.isArray(slots)
      ? slots.find((item: any) => item.tourId === tour.id && item.date === selectedDate)
      : null;

    if (!slot || slot.isBlackout || slot.status !== 'available') {
      return unavailableAvailability(tour, selectedDate, false, true);
    }

    const capacity = Math.max(0, Number(slot.maxCapacity) || 0);
    if (capacity <= 0) {
      return unavailableAvailability(tour, selectedDate, false, true);
    }

    const rawBookings = localStorage.getItem('rse_bookings_cache') || localStorage.getItem('redsea_local_bookings');
    const bookings = rawBookings ? JSON.parse(rawBookings) : [];
    const actualBooked = Array.isArray(bookings)
      ? bookings
          .filter((booking: any) =>
            booking.tourId === tour.id &&
            booking.date?.split('T')[0] === selectedDate &&
            booking.status !== 'cancelled'
          )
          .reduce((sum: number, booking: any) =>
            sum +
            (booking.guests?.adults || 0) +
            (booking.guests?.children || 0) +
            (booking.guests?.infants || 0), 0)
      : 0;

    const booked = Math.max(0, Number(slot.bookedCount) || 0, actualBooked);
    const remaining = Math.max(0, capacity - booked);
    const isSoldOut = remaining === 0;

    return {
      date: selectedDate,
      tourId: tour.id,
      capacity,
      booked,
      remaining,
      isAvailable: !isSoldOut,
      isSoldOut,
      isPastDate: false,
      meetsMinimumNotice: true,
      minNoticeHours,
      status: isSoldOut ? 'sold_out' : 'available',
    };
  } catch {
    return unavailableAvailability(tour, selectedDate, false, true);
  }
}

/**
 * Fetches authoritative capacity from Supabase. No tour-level capacity,
 * weekday list, browser cache, or hard-coded value can open a date.
 */
export async function getTourAvailabilityFromServer(
  tour: Tour,
  selectedDate: string
): Promise<Availability> {
  const fallback = getTourAvailability(tour, selectedDate);
  if (fallback.isPastDate || !fallback.meetsMinimumNotice) return fallback;

  if (!isSupabaseConfigured()) {
    if (import.meta.env.DEV) return fallback;
    throw new Error('Live departure availability is temporarily unavailable.');
  }

  const { data, error } = await supabase.rpc('get_tour_availability_schedule', {
    p_tour_identifier: tour.id,
    p_start_date: selectedDate,
    p_end_date: selectedDate,
  });

  if (error) throw new Error(formatSupabaseError(error));

  const slot = Array.isArray(data) ? data[0] : null;
  if (!slot) throw new Error('The selected tour or departure date could not be found.');

  const capacity = Math.max(0, Number(slot.max_capacity) || 0);
  const booked = Math.max(0, Number(slot.booked_count) || 0);
  const remaining = Math.max(0, Number(slot.remaining_capacity) || 0);
  const status = slot.status === 'available' && slot.is_available === true && capacity > booked
    ? 'available'
    : slot.status === 'sold_out'
      ? 'sold_out'
      : 'unavailable';

  return {
    date: selectedDate,
    tourId: tour.id,
    capacity,
    booked,
    remaining,
    isAvailable: status === 'available',
    isSoldOut: status === 'sold_out',
    isPastDate: false,
    meetsMinimumNotice: true,
    minNoticeHours: APP_CONFIG.DEFAULT_MIN_BOOKING_NOTICE_HOURS,
    status,
  };
}
