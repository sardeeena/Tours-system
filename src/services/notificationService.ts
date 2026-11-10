import { Booking } from '../types/booking';

export interface INotificationService {
  sendBookingConfirmation(booking: Booking): Promise<{ success: boolean; channel: string }>;
  sendCancellationNotification(booking: Booking): Promise<{ success: boolean; channel: string }>;
}

/**
 * Booking notifications are intentionally fail-closed.
 * The public booking flow does not hold a staff session and must not call a privileged
 * communications endpoint or claim delivery without a configured server-side dispatcher.
 * A future server-side booking event worker will deliver these messages asynchronously.
 */
class NotificationService implements INotificationService {
  async sendBookingConfirmation(_booking: Booking): Promise<{ success: boolean; channel: string }> {
    return { success: false, channel: 'not-configured' };
  }

  async sendCancellationNotification(_booking: Booking): Promise<{ success: boolean; channel: string }> {
    return { success: false, channel: 'not-configured' };
  }
}

export const notificationService: INotificationService = new NotificationService();
