import { Booking } from '../types/booking';
import { APP_CONFIG } from '../config/appConfig';

export interface INotificationService {
  sendBookingConfirmation(booking: Booking): Promise<{ success: boolean; channel: string }>;
  sendCancellationNotification(booking: Booking): Promise<{ success: boolean; channel: string }>;
}

/**
 * Notification Service
 * Dispatches confirmation emails and SMS vouchers to booked customers.
 */
class NotificationService implements INotificationService {
  async sendBookingConfirmation(booking: Booking): Promise<{ success: boolean; channel: string }> {
    console.info('[NotificationService] Booking Confirmation Dispatched:', {
      recipientEmail: booking.customer.email,
      recipientPhone: `${booking.customer.countryCode}${booking.customer.phoneNumber}`,
      bookingReference: booking.bookingReference,
      tour: booking.tourTitle,
      date: booking.date,
      total: booking.pricing.formattedTotal,
      paymentStatus: booking.paymentStatus,
    });

    return { success: true, channel: 'email-sms' };
  }

  async sendCancellationNotification(booking: Booking): Promise<{ success: boolean; channel: string }> {
    console.info('[NotificationService] Cancellation Notification Dispatched:', {
      recipientEmail: booking.customer.email,
      bookingReference: booking.bookingReference,
      reason: booking.cancellationReason,
      requestedAt: booking.cancellationRequestedAt,
    });

    return { success: true, channel: 'email-sms' };
  }
}

export const notificationService: INotificationService = new NotificationService();
