export type MessageDeliveryStatus =
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'opened'
  | 'Queued'
  | 'Sent'
  | 'Delivered'
  | 'Failed'
  | 'Opened';

export type CommunicationChannel = 'Email' | 'WhatsApp';

export type TemplateKey =
  | 'booking_confirmation'
  | 'booking_update'
  | 'payment_confirmation'
  | 'payment_reminder'
  | 'cancellation'
  | 'refund'
  | 'pickup_reminder'
  | 'tour_reminder'
  | 'inquiry_response'
  | 'follow_up'
  | 'welcome'
  | 'review_request'
  // Legacy aliases for backward compatibility:
  | 'booking_received'
  | 'booking_confirmed'
  | 'payment_received'
  | 'booking_cancelled'
  | 'booking_completed'
  | 'customer_followup';

export interface CommunicationTemplate {
  id: string;
  templateKey: TemplateKey | string;
  name: string;
  channel: 'Email' | 'WhatsApp' | 'Both';
  subject?: string | null;
  bodyText: string;
  variables: string[];
  isActive: boolean;
  updatedAt?: string;
}

export interface CommunicationMessage {
  id: string;
  channel: CommunicationChannel;
  customerId?: string | null;
  customerName: string;
  recipientAddress: string; // Email or WhatsApp international phone number (+E.164)
  leadId?: string | null;
  bookingId?: string | null;
  bookingReference?: string | null;
  inquiryId?: string | null;
  taskId?: string | null;
  templateKey?: string | null;
  subject?: string | null;
  content: string;
  status: MessageDeliveryStatus;
  providerName: string; // 'Resend', 'SendGrid', 'Twilio', 'Meta Cloud API', 'Not configured'
  providerMessageId?: string | null;
  failureReason?: string | null;
  sentAt?: string | null;
  deliveredAt?: string | null;
  openedAt?: string | null;
  staffName: string;
  staffId?: string | null;
  createdAt: string;
}

export type NotificationCategory =
  | 'new_booking'
  | 'new_inquiry'
  | 'new_payment'
  | 'payment_overdue'
  | 'new_lead'
  | 'followup_due'
  | 'task_overdue'
  | 'departure_unassigned'
  | 'pickup_pending'
  | 'document_expiring'
  | 'cancellation'
  | 'new_review'
  | 'operational_issue'
  | 'payment_pending';

export interface StaffNotification {
  id: string;
  category: NotificationCategory;
  dedupKey: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical' | 'success';
  entityType?: 'booking' | 'inquiry' | 'customer' | 'departure' | 'review' | 'task' | 'payment' | 'document';
  entityId?: string;
  linkTab?: string;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
}

export interface ProviderConfig {
  email: {
    provider: 'resend' | 'sendgrid' | 'smtp' | 'none';
    apiKey?: string;
    fromEmail?: string;
    fromName?: string;
    isConfigured: boolean;
  };
  whatsapp: {
    provider: 'meta_cloud' | 'twilio' | 'custom' | 'none';
    apiKey?: string;
    phoneNumberId?: string;
    businessAccountId?: string;
    fromNumber?: string;
    isConfigured: boolean;
  };
}

export interface MessageContextVariables {
  customer_name?: string;
  booking_reference?: string;
  tour_name?: string;
  tour_date?: string;
  pickup_time?: string;
  amount?: string | number;
  balance_due?: string | number;
  hotel?: string;
  total?: string | number;
  balance?: string | number;
  departure_time?: string;
  guests_count?: string | number;
  payment_status?: string;
  refund_amount?: string | number;
  inquiry_subject?: string;
}

export type AutomationEventType =
  | 'booking.created'
  | 'booking.updated'
  | 'payment.received'
  | 'payment.failed'
  | 'booking.cancelled'
  | 'departure.tomorrow'
  | 'followup.due';

export interface AutomationEvent {
  id: string;
  eventName: AutomationEventType;
  payload: Record<string, any>;
  entityType?: string;
  entityId?: string;
  processed: boolean;
  processedAt?: string | null;
  actionsTriggered?: string[];
  errorMessage?: string | null;
  createdAt: string;
}
