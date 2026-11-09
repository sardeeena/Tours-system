import { Booking } from '../types/booking';
import { APP_CONFIG } from '../config/appConfig';

/**
 * Service for generating Calendar invites (.ics), Print views, and WhatsApp deep links.
 * Modular architecture prepared for server-side PDF engines (e.g. Puppeteer / React-PDF).
 */

export function generateCalendarIcs(booking: Booking): string {
  const startDate = booking.date.replace(/-/g, '');
  // Default tour start at 08:30 AM local Egypt time (UTC+2 or +3)
  const dtStart = `${startDate}T083000`;
  const dtEnd = `${startDate}T163000`;
  const summary = `${booking.tourTitle} - Red Sea Excursions`;
  const description = `Booking Reference: ${booking.bookingReference}\\nGuests: ${booking.guests.adults} Adults, ${booking.guests.children} Children\\nPickup: ${booking.pickup.hotelName || booking.pickup.locationName}\\nTotal: ${booking.pricing.formattedTotal}`;
  const location = `${booking.tourDestination}, Red Sea, Egypt`;

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Red Sea Excursions//Booking System//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${booking.bookingReference}@redseaexcursions.com`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${location}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

export function downloadCalendarEvent(booking: Booking): void {
  const icsData = generateCalendarIcs(booking);
  const blob = new Blob([icsData], { type: 'text/calendar;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${booking.bookingReference}-excursion.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function getWhatsAppSupportUrl(booking?: Booking, customMessage?: string): string {
  const phoneDigits = APP_CONFIG.WHATSAPP_NUMBER.replace(/\D+/g, '');
  let message = customMessage || `Hello Red Sea Excursions, I would like to inquire about excursion availability and hotel pickup.`;

  if (booking && !customMessage) {
    message = `Hello Red Sea Excursions, I am contacting you regarding booking reference: ${booking.bookingReference} for ${booking.tourTitle} on ${booking.date}.`;
  }

  return `https://wa.me/${phoneDigits}?text=${encodeURIComponent(message)}`;
}

export function triggerPrintVoucher(): void {
  window.print();
}
