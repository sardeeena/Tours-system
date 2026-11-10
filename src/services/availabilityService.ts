import { Tour } from '../types';
import { Availability } from '../types/booking';
import { APP_CONFIG } from '../config/appConfig';
import { supabase, isSupabaseConfigured, formatSupabaseError } from './supabaseClient';

/**
 * Calculates earliest selectable booking date considering minimum notice hours
 */
export function getEarliestSelectableDate(minNoticeHours: number = APP_CONFIG.DEFAULT_MIN_BOOKING_NOTICE_HOURS): string {
  const now = new Date();
  const cutoffTime = new Date(now.getTime() + minNoticeHours * 60 * 60 * 1000);
  
  // Format as YYYY-MM-DD
  const year = cutoffTime.getFullYear();
  const month = String(cutoffTime.getMonth() + 1).padStart(2, '0');
  const day = String(cutoffTime.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * Checks if a given date string is in the past
 */
export function isDateInPast(dateStr: string): boolean {
  if (!dateStr) return true;
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return dateStr < todayStr;
}

/**
 * Checks if a selected date respects the minimum notice requirement
 */
export function meetsNoticeRequirement(dateStr: string, minNoticeHours: number): boolean {
  if (!dateStr) return false;
  const earliest = getEarliestSelectableDate(minNoticeHours);
  return dateStr >= earliest;
}

/**
 * Fleet Availability Engine
 * Calculates available vessel capacity and booking schedule based on tour ID, max guests, and date.
 */
export function getTourAvailability(
  tour: Tour,
  selectedDate: string
): Availability {
  const minNoticeHours = APP_CONFIG.DEFAULT_MIN_BOOKING_NOTICE_HOURS;
  const isPast = isDateInPast(selectedDate);
  const meetsNotice = meetsNoticeRequirement(selectedDate, minNoticeHours);

  // If invalid date or past date, return not available
  if (isPast || !meetsNotice || !selectedDate) {
    return {
      date: selectedDate || '',
      tourId: tour.id,
      capacity: tour.maxGuests || 24,
      booked: tour.maxGuests || 24,
      remaining: 0,
      isAvailable: false,
      isSoldOut: true,
      isPastDate: isPast,
      meetsMinimumNotice: meetsNotice,
      minNoticeHours,
    };
  }

  // 1. Check if an authoritative operational slot or blackout date exists
  try {
    const rawOps = localStorage.getItem('rse_ops_availability');
    if (rawOps) {
      const slots = JSON.parse(rawOps);
      const slot = slots.find((s: any) => s.tourId === tour.id && s.date === selectedDate);
      if (slot) {
        if (slot.isBlackout || slot.status === 'unavailable') {
          return {
            date: selectedDate,
            tourId: tour.id,
            capacity: slot.maxCapacity || tour.maxGuests || 24,
            booked: slot.maxCapacity || tour.maxGuests || 24,
            remaining: 0,
            isAvailable: false,
            isSoldOut: true,
            isPastDate: false,
            meetsMinimumNotice: true,
            minNoticeHours,
          };
        }

        // Count actual reservations from authoritative bookings cache
        let actualBooked = 0;
        try {
          const rawBookings = localStorage.getItem('rse_bookings_cache') || localStorage.getItem('redsea_local_bookings');
          if (rawBookings) {
            const bookings = JSON.parse(rawBookings);
            actualBooked = bookings
              .filter(
                (b: any) =>
                  b.tourId === tour.id &&
                  b.date?.split('T')[0] === selectedDate &&
                  b.status !== 'cancelled'
              )
              .reduce(
                (sum: number, b: any) =>
                  sum + (b.guests?.adults || 1) + (b.guests?.children || 0) + (b.guests?.infants || 0),
                0
              );
          }
        } catch {
          // ignore
        }

        const capacity = slot.maxCapacity || tour.maxGuests || 35;
        const totalBooked = Math.min(capacity, Math.max(actualBooked, slot.bookedCount || 0));
        const remaining = Math.max(0, capacity - totalBooked);
        const isSoldOut = remaining <= 0 || slot.status === 'sold_out';

        return {
          date: selectedDate,
          tourId: tour.id,
          capacity,
          booked: totalBooked,
          remaining,
          isAvailable: !isSoldOut,
          isSoldOut,
          isPastDate: false,
          meetsMinimumNotice: true,
          minNoticeHours,
        };
      }
    }
  } catch {
    // fallback to dynamic calculation
  }

  // 2. Count actual bookings from authoritative bookings store
  let actualBooked = 0;
  try {
    const rawBookings = localStorage.getItem('rse_bookings_cache') || localStorage.getItem('redsea_local_bookings');
    if (rawBookings) {
      const bookings = JSON.parse(rawBookings);
      actualBooked = bookings
        .filter(
          (b: any) =>
            b.tourId === tour.id &&
            b.date?.split('T')[0] === selectedDate &&
            b.status !== 'cancelled'
        )
        .reduce(
          (sum: number, b: any) =>
            sum + (b.guests?.adults || 1) + (b.guests?.children || 0) + (b.guests?.infants || 0),
          0
        );
    }
  } catch {
    // ignore
  }

  const capacity = tour.maxGuests || 35;
  const totalBooked = Math.min(capacity, actualBooked);
  const remaining = Math.max(0, capacity - totalBooked);

  return {
    date: selectedDate,
    tourId: tour.id,
    capacity,
    booked: totalBooked,
    remaining,
    isAvailable: remaining > 0,
    isSoldOut: remaining === 0,
    isPastDate: false,
    meetsMinimumNotice: true,
    minNoticeHours,
  };
}


/**
 * Fetches authoritative departure capacity from the database schedule RPC.
 * Browser/localStorage values are only a development fallback and are never
 * presented as live availability in production.
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

  if (error) {
    throw new Error(formatSupabaseError(error));
  }

  const slot = Array.isArray(data) ? data[0] : null;
  if (!slot) {
    throw new Error('The selected tour or departure date could not be found.');
  }

  const capacity = Math.max(0, Number(slot.max_capacity) || tour.maxGuests || 30);
  const booked = Math.max(0, Number(slot.booked_count) || 0);
  const remaining = Math.max(0, Number(slot.remaining_capacity) || 0);

  return {
    date: selectedDate,
    tourId: tour.id,
    capacity,
    booked,
    remaining,
    isAvailable: slot.is_available === true,
    isSoldOut: slot.status === 'sold_out' || remaining <= 0,
    isPastDate: false,
    meetsMinimumNotice: true,
    minNoticeHours: APP_CONFIG.DEFAULT_MIN_BOOKING_NOTICE_HOURS,
  };
}
