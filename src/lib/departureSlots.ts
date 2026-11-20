import type { DepartureSlot } from '../types/booking';

const BOOKABLE_DEPARTURE_STATUSES = new Set(['scheduled', 'confirmed', 'boarding']);

/**
 * Normalize an untrusted RPC row into a departure slot.
 * Availability fails closed unless the database flag, status and capacity
 * counters agree that at least one seat remains.
 */
export function mapDepartureSlotFromServer(slot: Record<string, unknown>): DepartureSlot {
  const capacity = Math.max(0, Number(slot.capacity) || 0);
  const bookedCount = Math.max(0, Number(slot.booked_count) || 0);
  const remainingCapacity = Math.max(0, Number(slot.remaining_capacity) || 0);
  const status = String(slot.status || 'cancelled') as DepartureSlot['status'];
  const countersAreConsistent =
    capacity > bookedCount &&
    remainingCapacity > 0 &&
    remainingCapacity <= capacity - bookedCount;

  return {
    departureId: String(slot.departure_id || ''),
    tourId: String(slot.tour_id || ''),
    date: String(slot.date || ''),
    startTime: String(slot.start_time || ''),
    endTime: String(slot.end_time || ''),
    status,
    capacity,
    bookedCount,
    remainingCapacity,
    isAvailable:
      slot.is_available === true &&
      BOOKABLE_DEPARTURE_STATUSES.has(status) &&
      countersAreConsistent,
    minimumNoticeHours: Math.max(0, Number(slot.minimum_notice_hours) || 0),
  };
}
