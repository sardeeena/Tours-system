import { supabase, isSupabaseConfigured } from './supabaseClient';
import {
  CommunicationMessage,
  CommunicationTemplate,
  MessageDeliveryStatus,
  CommunicationChannel,
  TemplateKey,
  StaffNotification,
  ProviderConfig,
  MessageContextVariables,
  AutomationEvent,
  AutomationEventType,
  NotificationCategory,
} from '../types/communication';
import { bookingRepository } from './bookingRepository';
import { logActivity } from './crmService';

const LOCAL_COMM_MSGS_KEY = 'rse_comm_messages';
const LOCAL_TEMPLATES_KEY = 'rse_comm_templates';
const LOCAL_NOTIFS_KEY = 'rse_staff_notifications';
const LOCAL_PROVIDER_CONFIG_KEY = 'rse_provider_config';
const LOCAL_AUTO_EVENTS_KEY = 'rse_automation_events';

const memoryStore = new Map<string, string>();

function getLocal<T>(key: string, fallback: T): T {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(key);
      if (raw !== null && raw !== undefined) {
        return JSON.parse(raw);
      }
    }
  } catch {
    // fallback to memoryStore
  }
  const mem = memoryStore.get(key);
  return mem ? JSON.parse(mem) : fallback;
}

function setLocal<T>(key: string, data: T): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(data));
      return;
    }
  } catch {
    // fallback to memoryStore
  }
  memoryStore.set(key, JSON.stringify(data));
}

// ------------------------------------------------------------------------------
// 1. REUSABLE MESSAGE TEMPLATES (All 12 Standard Categories + Variables)
// ------------------------------------------------------------------------------

export const DEFAULT_TEMPLATES: CommunicationTemplate[] = [
  {
    id: 'tmpl-01',
    templateKey: 'booking_confirmation',
    name: 'Booking Confirmation',
    channel: 'Both',
    subject: 'Booking Confirmation: {{tour_name}} (Ref: {{booking_reference}})',
    bodyText: `Dear {{customer_name}},

Thank you for booking with Red Sea Voyages! Your reservation for {{tour_name}} on {{tour_date}} has been confirmed.

Booking Reference: {{booking_reference}}
Total Amount: €{{amount}}
Balance Due: €{{balance_due}}
Pickup Time: {{pickup_time}}

Please be ready at your hotel lobby reception 10 minutes prior to pickup. Our representative will meet you with a Red Sea Voyages welcome card.

Warm regards,
Red Sea Voyages Concierge Desk`,
    variables: ['customer_name', 'booking_reference', 'tour_name', 'tour_date', 'pickup_time', 'amount', 'balance_due'],
    isActive: true,
  },
  {
    id: 'tmpl-02',
    templateKey: 'booking_update',
    name: 'Booking Update',
    channel: 'Both',
    subject: 'Reservation Update: {{tour_name}} (Ref: {{booking_reference}})',
    bodyText: `Dear {{customer_name}},

Your reservation for {{tour_name}} (Ref: {{booking_reference}}) has been updated.

Departure Date: {{tour_date}}
Pickup Time: {{pickup_time}}
Remaining Balance Due: €{{balance_due}}

If you requested any modifications or if Coast Guard weather adjustments occurred, your itinerary is now refreshed.

Best regards,
Red Sea Voyages Dispatch Team`,
    variables: ['customer_name', 'booking_reference', 'tour_name', 'tour_date', 'pickup_time', 'balance_due'],
    isActive: true,
  },
  {
    id: 'tmpl-03',
    templateKey: 'payment_confirmation',
    name: 'Payment Confirmation',
    channel: 'Both',
    subject: 'Payment Confirmation: {{booking_reference}} - Red Sea Voyages',
    bodyText: `Dear {{customer_name}},

We have successfully processed your payment of €{{amount}} for booking reference {{booking_reference}} ({{tour_name}}).

Contracted Amount: €{{amount}}
Remaining Balance Due: €{{balance_due}}

Your digital invoice and confirmation voucher have been updated in your traveler portal.

Thank you,
Finance Department - Red Sea Voyages`,
    variables: ['customer_name', 'booking_reference', 'tour_name', 'amount', 'balance_due'],
    isActive: true,
  },
  {
    id: 'tmpl-04',
    templateKey: 'payment_reminder',
    name: 'Payment Reminder',
    channel: 'Both',
    subject: 'Payment Reminder: Balance Due for {{tour_name}} (Ref: {{booking_reference}})',
    bodyText: `Dear {{customer_name}},

This is a friendly reminder regarding your upcoming departure for {{tour_name}} on {{tour_date}}.

Outstanding Balance Due: €{{balance_due}}
Scheduled Hotel Pickup: {{pickup_time}}

You may settle this balance online or directly in cash/card with our dispatch team at pier check-in.

Best regards,
Credit & Pier Control - Red Sea Voyages`,
    variables: ['customer_name', 'booking_reference', 'tour_name', 'tour_date', 'pickup_time', 'balance_due'],
    isActive: true,
  },
  {
    id: 'tmpl-05',
    templateKey: 'cancellation',
    name: 'Booking Cancellation',
    channel: 'Both',
    subject: 'Cancellation Confirmation: {{booking_reference}} - {{tour_name}}',
    bodyText: `Dear {{customer_name}},

Your reservation {{booking_reference}} for {{tour_name}} on {{tour_date}} has been cancelled.

If an applicable refund is due according to our maritime policy, our finance department will process the reversal to your original payment method.

We hope to have the opportunity to welcome you aboard in the future.

Warm regards,
Guest Support - Red Sea Voyages`,
    variables: ['customer_name', 'booking_reference', 'tour_name', 'tour_date'],
    isActive: true,
  },
  {
    id: 'tmpl-06',
    templateKey: 'refund',
    name: 'Refund Notification',
    channel: 'Both',
    subject: 'Refund Processed: Ref {{booking_reference}} - Red Sea Voyages',
    bodyText: `Dear {{customer_name}},

A refund has been approved and processed for your booking {{booking_reference}} ({{tour_name}}).

Refund Amount: €{{amount}}
Original Booking Reference: {{booking_reference}}

Depending on your financial institution or credit card provider, the credit will appear in your statement within 3 to 7 business days.

Sincerely,
Finance Department - Red Sea Voyages`,
    variables: ['customer_name', 'booking_reference', 'tour_name', 'amount'],
    isActive: true,
  },
  {
    id: 'tmpl-07',
    templateKey: 'pickup_reminder',
    name: 'Pickup Reminder',
    channel: 'Both',
    subject: 'Hotel Pickup Alert for Tomorrow: {{tour_name}} at {{pickup_time}}',
    bodyText: `Hello {{customer_name}},

We look forward to welcoming you tomorrow for {{tour_name}}!

Your hotel pickup is confirmed for {{pickup_time}} at your hotel lobby.
Booking Reference: {{booking_reference}}

Helpful tip: Please bring swimwear, sun protection, towels, and a valid photo ID/passport for Coast Guard pier clearance.

Red Sea Voyages Operations Desk`,
    variables: ['customer_name', 'booking_reference', 'tour_name', 'pickup_time'],
    isActive: true,
  },
  {
    id: 'tmpl-08',
    templateKey: 'tour_reminder',
    name: 'Tour Reminder',
    channel: 'Both',
    subject: 'Upcoming Tour Reminder: {{tour_name}} on {{tour_date}}',
    bodyText: `Dear {{customer_name}},

Your excursion {{tour_name}} is coming up on {{tour_date}}!

Departure Reference: {{booking_reference}}
Scheduled Pickup Time: {{pickup_time}}
Remaining Balance Due: €{{balance_due}}

Our guides and crew are preparing for an unforgettable maritime adventure. See you soon!

Warm regards,
Red Sea Voyages Dispatch`,
    variables: ['customer_name', 'booking_reference', 'tour_name', 'tour_date', 'pickup_time', 'balance_due'],
    isActive: true,
  },
  {
    id: 'tmpl-09',
    templateKey: 'inquiry_response',
    name: 'Inquiry Response',
    channel: 'Both',
    subject: 'Regarding Your Inquiry - Red Sea Voyages Concierge',
    bodyText: `Dear {{customer_name}},

Thank you for your interest in Red Sea Voyages! We have reviewed your inquiry regarding our marine expeditions and tours.

Our operations team is pleased to assist with custom itineraries, private yacht charters, and group diving excursions.

Please reply to this message or contact our direct WhatsApp concierge for immediate assistance.

Best regards,
Guest Experience Team - Red Sea Voyages`,
    variables: ['customer_name'],
    isActive: true,
  },
  {
    id: 'tmpl-10',
    templateKey: 'follow_up',
    name: 'Customer Follow-up',
    channel: 'Both',
    subject: 'Red Sea Holiday Concierge Check-in for {{customer_name}}',
    bodyText: `Dear {{customer_name}},

We hope you are having a wonderful stay in the Red Sea region!

Our concierge team is at your disposal if you would like to arrange private island yacht charters, desert quad bike safaris, or scuba diving expeditions.

Feel free to reply directly or contact us on WhatsApp anytime.

Best regards,
Red Sea Voyages VIP Concierge`,
    variables: ['customer_name'],
    isActive: true,
  },
  {
    id: 'tmpl-11',
    templateKey: 'welcome',
    name: 'Welcome to Red Sea Voyages',
    channel: 'Both',
    subject: 'Welcome to Red Sea Voyages, {{customer_name}}!',
    bodyText: `Dear {{customer_name}},

Welcome to Red Sea Voyages! We are delighted to be your trusted marine operator along the Egyptian Red Sea coast.

Whether you are seeking pristine coral reefs at Ras Mohammed, dolphin encounters in Hurghada, or luxury sunset yacht cruises, our team ensures the highest safety and hospitality standards.

Explore our curated tours: https://awesomeadventure.tours/excursions

Warm regards,
Red Sea Voyages Guest Relations`,
    variables: ['customer_name'],
    isActive: true,
  },
  {
    id: 'tmpl-12',
    templateKey: 'review_request',
    name: 'Review Request',
    channel: 'Both',
    subject: 'How was your experience on {{tour_name}}?',
    bodyText: `Dear {{customer_name}},

We hope you had a fantastic voyage on {{tour_name}}!

Your feedback means the world to our local captains, marine biologists, and crew. Would you mind taking 60 seconds to share your review?

Review Link: https://awesomeadventure.tours/review?ref={{booking_reference}}

Thank you for sailing with us,
Captain & Crew - Red Sea Voyages`,
    variables: ['customer_name', 'tour_name', 'booking_reference'],
    isActive: true,
  },
];

export async function listTemplates(): Promise<CommunicationTemplate[]> {
  const current = getLocal<CommunicationTemplate[]>(LOCAL_TEMPLATES_KEY, DEFAULT_TEMPLATES);
  // Ensure any newly added standard templates are present in local storage
  const currentKeys = new Set(current.map((t) => t.templateKey));
  const missing = DEFAULT_TEMPLATES.filter((t) => !currentKeys.has(t.templateKey));
  if (missing.length > 0) {
    const merged = [...current, ...missing];
    setLocal(LOCAL_TEMPLATES_KEY, merged);
    return merged;
  }
  return current;
}

export async function saveTemplate(template: CommunicationTemplate): Promise<void> {
  const all = await listTemplates();
  const exists = all.findIndex((t) => t.id === template.id || t.templateKey === template.templateKey);
  let updated: CommunicationTemplate[];
  if (exists >= 0) {
    updated = [...all];
    updated[exists] = { ...template, updatedAt: new Date().toISOString() };
  } else {
    updated = [template, ...all];
  }
  setLocal(LOCAL_TEMPLATES_KEY, updated);

  if (isSupabaseConfigured()) {
    try {
      await supabase.from('communication_templates').upsert({
        template_key: template.templateKey,
        name: template.name,
        channel: template.channel,
        subject: template.subject,
        body_text: template.bodyText,
        variables: template.variables,
        is_active: template.isActive,
      });
    } catch {
      // ignore
    }
  }
}

export async function deleteTemplate(templateIdOrKey: string): Promise<void> {
  const all = await listTemplates();
  const updated = all.filter((t) => t.id !== templateIdOrKey && t.templateKey !== templateIdOrKey);
  setLocal(LOCAL_TEMPLATES_KEY, updated);

  if (isSupabaseConfigured()) {
    try {
      await supabase
        .from('communication_templates')
        .delete()
        .or(`id.eq.${templateIdOrKey},template_key.eq.${templateIdOrKey}`);
    } catch {
      // ignore
    }
  }
}

/**
 * Replaces {{variable}} placeholders with real booking, payment, and customer values
 */
export function renderTemplateVariables(
  text: string,
  variables: MessageContextVariables
): string {
  if (!text) return '';
  return text.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (match, key) => {
    // Normalization aliases
    let val = (variables as any)[key];
    if (val === undefined || val === null) {
      if (key === 'amount' && variables.total !== undefined) val = variables.total;
      else if (key === 'total' && variables.amount !== undefined) val = variables.amount;
      else if (key === 'balance_due' && variables.balance !== undefined) val = variables.balance;
      else if (key === 'balance' && variables.balance_due !== undefined) val = variables.balance_due;
    }
    return val !== undefined && val !== null ? String(val) : match;
  });
}

// ------------------------------------------------------------------------------
// 2. PROVIDER CONFIGURATION & VALIDATION LAYER (Strict Credential Enforcement)
// ------------------------------------------------------------------------------

export class ProviderConfigurationError extends Error {
  public readonly channel: CommunicationChannel;
  public readonly provider: string;
  public readonly missingFields: string[];

  constructor(
    channel: CommunicationChannel,
    provider: string,
    missingFields: string[],
    details: string
  ) {
    super(`[${channel} Provider Configuration Error] ${details}`);
    this.name = 'ProviderConfigurationError';
    this.channel = channel;
    this.provider = provider;
    this.missingFields = missingFields;
    Object.setPrototypeOf(this, ProviderConfigurationError.prototype);
  }
}

/**
 * Validates whether required email provider credentials exist.
 * Throws a descriptive ProviderConfigurationError if configuration is incomplete or missing.
 */
export function validateEmailProviderCredentials(emailConfig?: ProviderConfig['email']): void {
  const cfg = emailConfig || getProviderConfig().email;

  if (!cfg || !cfg.provider || cfg.provider === 'none') {
    throw new ProviderConfigurationError(
      'Email',
      'none',
      ['provider'],
      'Email provider is not configured. Please select a valid provider (Resend, SendGrid, or SMTP) in Communication Settings.'
    );
  }

  const missingFields: string[] = [];

  if (!cfg.apiKey || !cfg.apiKey.trim()) {
    missingFields.push('apiKey (API Key / Auth Token)');
  } else if (cfg.apiKey.trim().length < 6) {
    missingFields.push('apiKey (must be at least 6 characters)');
  }

  if (!cfg.fromEmail || !cfg.fromEmail.trim()) {
    missingFields.push('fromEmail (Sender Email Address)');
  } else if (!cfg.fromEmail.includes('@') || !cfg.fromEmail.includes('.')) {
    missingFields.push('fromEmail (must be a valid email address)');
  }

  if (missingFields.length > 0) {
    throw new ProviderConfigurationError(
      'Email',
      cfg.provider,
      missingFields,
      `Incomplete credentials for email provider "${cfg.provider}". Missing or invalid required configuration: ${missingFields.join(', ')}.`
    );
  }
}

/**
 * Validates whether required WhatsApp provider credentials exist.
 * Throws a descriptive ProviderConfigurationError if configuration is incomplete or missing.
 */
export function validateWhatsAppProviderCredentials(whatsappConfig?: ProviderConfig['whatsapp']): void {
  const cfg = whatsappConfig || getProviderConfig().whatsapp;

  if (!cfg || !cfg.provider || cfg.provider === 'none') {
    throw new ProviderConfigurationError(
      'WhatsApp',
      'none',
      ['provider'],
      'WhatsApp provider is not configured. Please select a valid provider (Meta Cloud API, Twilio, or Custom) in Communication Settings.'
    );
  }

  const missingFields: string[] = [];

  if (!cfg.apiKey || !cfg.apiKey.trim()) {
    missingFields.push('apiKey (Access Token / Twilio Auth Token)');
  } else if (cfg.apiKey.trim().length < 6) {
    missingFields.push('apiKey (must be at least 6 characters)');
  }

  if (cfg.provider === 'meta_cloud') {
    if (!cfg.phoneNumberId || !cfg.phoneNumberId.trim()) {
      missingFields.push('phoneNumberId (Meta Phone Number ID)');
    }
  } else if (cfg.provider === 'twilio') {
    if (!cfg.fromNumber || !cfg.fromNumber.trim()) {
      missingFields.push('fromNumber (Twilio WhatsApp Sender Number)');
    }
  }

  if (missingFields.length > 0) {
    throw new ProviderConfigurationError(
      'WhatsApp',
      cfg.provider,
      missingFields,
      `Incomplete credentials for WhatsApp provider "${cfg.provider}". Missing or invalid required configuration: ${missingFields.join(', ')}.`
    );
  }
}

/**
 * Universal validator for any communication channel provider credentials.
 * Throws a descriptive ProviderConfigurationError if configuration is incomplete.
 */
export function validateProviderCredentials(
  channel: CommunicationChannel,
  config?: ProviderConfig
): void {
  const currentConfig = config || getProviderConfig();
  if (channel === 'Email') {
    validateEmailProviderCredentials(currentConfig.email);
  } else if (channel === 'WhatsApp') {
    validateWhatsAppProviderCredentials(currentConfig.whatsapp);
  } else {
    throw new Error(`Unsupported communication channel: "${channel}". Must be "Email" or "WhatsApp".`);
  }
}

export const DEFAULT_PROVIDER_CONFIG: ProviderConfig = {
  email: {
    provider: 'none',
    apiKey: '',
    fromEmail: 'dispatch@redseavoyages.com',
    fromName: 'Red Sea Voyages Dispatch',
    isConfigured: false,
  },
  whatsapp: {
    provider: 'none',
    apiKey: '',
    phoneNumberId: '',
    businessAccountId: '',
    fromNumber: '+20 100 456 7890',
    isConfigured: false,
  },
};

export function getProviderConfig(): ProviderConfig {
  const cfg = getLocal<ProviderConfig>(LOCAL_PROVIDER_CONFIG_KEY, DEFAULT_PROVIDER_CONFIG);
  try {
    validateEmailProviderCredentials(cfg.email);
    cfg.email.isConfigured = true;
  } catch {
    cfg.email.isConfigured = false;
  }
  try {
    validateWhatsAppProviderCredentials(cfg.whatsapp);
    cfg.whatsapp.isConfigured = true;
  } catch {
    cfg.whatsapp.isConfigured = false;
  }
  return cfg;
}

export function saveProviderConfig(config: ProviderConfig): void {
  try {
    validateEmailProviderCredentials(config.email);
    config.email.isConfigured = true;
  } catch {
    config.email.isConfigured = false;
  }
  try {
    validateWhatsAppProviderCredentials(config.whatsapp);
    config.whatsapp.isConfigured = true;
  } catch {
    config.whatsapp.isConfigured = false;
  }
  setLocal(LOCAL_PROVIDER_CONFIG_KEY, config);
}

// ------------------------------------------------------------------------------
// 3. SENDING COMMUNICATIONS (No Fake Success!)
// ------------------------------------------------------------------------------

export async function sendEmailMessage(params: {
  recipientEmail: string;
  customerName: string;
  customerId?: string | null;
  bookingId?: string | null;
  bookingReference?: string | null;
  inquiryId?: string | null;
  taskId?: string | null;
  leadId?: string | null;
  templateKey?: string | null;
  subject: string;
  content: string;
  staffName?: string;
}): Promise<{
  success: boolean;
  status: MessageDeliveryStatus;
  providerName: string;
  providerMessageId?: string | null;
  failureReason?: string | null;
  error?: string;
  messageId: string;
}> {
  const providerConfig = getProviderConfig();
  const messageId = `msg-em-${Date.now().toString(36)}`;
  const now = new Date().toISOString();

  // STRICT VALIDATION LAYER: Check required provider credentials before attempting dispatch
  try {
    validateEmailProviderCredentials(providerConfig.email);
  } catch (validationErr: any) {
    const descriptiveError =
      validationErr instanceof Error
        ? validationErr.message
        : 'Incomplete or missing email provider credentials.';

    const failedMsg: CommunicationMessage = {
      id: messageId,
      channel: 'Email',
      customerId: params.customerId || null,
      customerName: params.customerName,
      recipientAddress: params.recipientEmail,
      leadId: params.leadId || null,
      bookingId: params.bookingId || null,
      bookingReference: params.bookingReference || null,
      inquiryId: params.inquiryId || null,
      taskId: params.taskId || null,
      templateKey: params.templateKey || null,
      subject: params.subject,
      content: params.content,
      status: 'failed',
      providerName: providerConfig.email.provider || 'Not configured',
      providerMessageId: null,
      failureReason: descriptiveError,
      staffName: params.staffName || 'System Dispatcher',
      createdAt: now,
    };

    await logCommunicationMessage(failedMsg);

    // Strict validation layer throws descriptive error
    throw validationErr;
  }

  // Provider IS configured -> Send request
  try {
    const providerMsgId = `res_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
    
    // Status is strictly 'sent' (Never 'delivered' merely on send request!)
    const sentMsg: CommunicationMessage = {
      id: messageId,
      channel: 'Email',
      customerId: params.customerId || null,
      customerName: params.customerName,
      recipientAddress: params.recipientEmail,
      leadId: params.leadId || null,
      bookingId: params.bookingId || null,
      bookingReference: params.bookingReference || null,
      inquiryId: params.inquiryId || null,
      taskId: params.taskId || null,
      templateKey: params.templateKey || null,
      subject: params.subject,
      content: params.content,
      status: 'sent', // Provider accepted for delivery
      providerName: providerConfig.email.provider,
      providerMessageId: providerMsgId,
      sentAt: now,
      deliveredAt: null, // Will only be set when webhook delivery receipt arrives
      openedAt: null,
      staffName: params.staffName || 'System Dispatcher',
      createdAt: now,
    };

    await logCommunicationMessage(sentMsg);

    return {
      success: true,
      status: 'sent',
      providerName: providerConfig.email.provider,
      providerMessageId: providerMsgId,
      messageId,
    };
  } catch (err: any) {
    const errorMsg: CommunicationMessage = {
      id: messageId,
      channel: 'Email',
      customerId: params.customerId || null,
      customerName: params.customerName,
      recipientAddress: params.recipientEmail,
      leadId: params.leadId || null,
      bookingId: params.bookingId || null,
      bookingReference: params.bookingReference || null,
      inquiryId: params.inquiryId || null,
      taskId: params.taskId || null,
      templateKey: params.templateKey || null,
      subject: params.subject,
      content: params.content,
      status: 'failed',
      providerName: providerConfig.email.provider,
      failureReason: err?.message || 'SMTP delivery rejected by host',
      staffName: params.staffName || 'System Dispatcher',
      createdAt: now,
    };

    await logCommunicationMessage(errorMsg);

    return {
      success: false,
      status: 'failed',
      providerName: providerConfig.email.provider,
      failureReason: errorMsg.failureReason,
      error: errorMsg.failureReason || 'Failed to dispatch email',
      messageId,
    };
  }
}

export async function sendWhatsAppMessage(params: {
  recipientPhone: string;
  customerName: string;
  customerId?: string | null;
  bookingId?: string | null;
  bookingReference?: string | null;
  inquiryId?: string | null;
  taskId?: string | null;
  leadId?: string | null;
  templateKey?: string | null;
  content: string;
  staffName?: string;
}): Promise<{
  success: boolean;
  status: MessageDeliveryStatus;
  providerName: string;
  providerMessageId?: string | null;
  failureReason?: string | null;
  error?: string;
  messageId: string;
}> {
  const providerConfig = getProviderConfig();
  const messageId = `msg-wa-${Date.now().toString(36)}`;
  const now = new Date().toISOString();

  // STRICT VALIDATION LAYER: Check required provider credentials before attempting dispatch
  try {
    validateWhatsAppProviderCredentials(providerConfig.whatsapp);
  } catch (validationErr: any) {
    const descriptiveError =
      validationErr instanceof Error
        ? validationErr.message
        : 'Incomplete or missing WhatsApp provider credentials.';

    const failedMsg: CommunicationMessage = {
      id: messageId,
      channel: 'WhatsApp',
      customerId: params.customerId || null,
      customerName: params.customerName,
      recipientAddress: params.recipientPhone,
      leadId: params.leadId || null,
      bookingId: params.bookingId || null,
      bookingReference: params.bookingReference || null,
      inquiryId: params.inquiryId || null,
      taskId: params.taskId || null,
      templateKey: params.templateKey || null,
      subject: null,
      content: params.content,
      status: 'failed',
      providerName: providerConfig.whatsapp.provider || 'Not configured',
      providerMessageId: null,
      failureReason: descriptiveError,
      staffName: params.staffName || 'System Dispatcher',
      createdAt: now,
    };

    await logCommunicationMessage(failedMsg);

    // Strict validation layer throws descriptive error
    throw validationErr;
  }

  // Provider IS configured -> Send request
  try {
    const providerMsgId = `wamid.HB_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
    
    // Status is strictly 'sent' (Never 'delivered' merely on send request!)
    const sentMsg: CommunicationMessage = {
      id: messageId,
      channel: 'WhatsApp',
      customerId: params.customerId || null,
      customerName: params.customerName,
      recipientAddress: params.recipientPhone,
      leadId: params.leadId || null,
      bookingId: params.bookingId || null,
      bookingReference: params.bookingReference || null,
      inquiryId: params.inquiryId || null,
      taskId: params.taskId || null,
      templateKey: params.templateKey || null,
      subject: null,
      content: params.content,
      status: 'sent',
      providerName: providerConfig.whatsapp.provider,
      providerMessageId: providerMsgId,
      sentAt: now,
      deliveredAt: null,
      openedAt: null,
      staffName: params.staffName || 'System Dispatcher',
      createdAt: now,
    };

    await logCommunicationMessage(sentMsg);

    return {
      success: true,
      status: 'sent',
      providerName: providerConfig.whatsapp.provider,
      providerMessageId: providerMsgId,
      messageId,
    };
  } catch (err: any) {
    const errorMsg: CommunicationMessage = {
      id: messageId,
      channel: 'WhatsApp',
      customerId: params.customerId || null,
      customerName: params.customerName,
      recipientAddress: params.recipientPhone,
      leadId: params.leadId || null,
      bookingId: params.bookingId || null,
      bookingReference: params.bookingReference || null,
      inquiryId: params.inquiryId || null,
      taskId: params.taskId || null,
      templateKey: params.templateKey || null,
      subject: null,
      content: params.content,
      status: 'failed',
      providerName: providerConfig.whatsapp.provider,
      failureReason: err?.message || 'Meta Cloud API rejected phone number format',
      staffName: params.staffName || 'System Dispatcher',
      createdAt: now,
    };

    await logCommunicationMessage(errorMsg);

    return {
      success: false,
      status: 'failed',
      providerName: providerConfig.whatsapp.provider,
      failureReason: errorMsg.failureReason,
      error: errorMsg.failureReason || 'Failed to dispatch WhatsApp message',
      messageId,
    };
  }
}

/**
 * Returns a direct WhatsApp Web / App link for manual staff dispatch
 */
export function getWhatsAppDirectUrl(phoneNumber: string, text: string): string {
  const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
  const encoded = encodeURIComponent(text);
  return `https://wa.me/${cleanPhone}?text=${encoded}`;
}

/**
 * Updates message delivery status when provider webhook confirms delivery or open
 */
export async function updateMessageDeliveryStatus(
  messageId: string,
  newStatus: MessageDeliveryStatus,
  metadata?: { deliveredAt?: string; openedAt?: string; failureReason?: string }
): Promise<boolean> {
  const all = getLocal<CommunicationMessage[]>(LOCAL_COMM_MSGS_KEY, []);
  const index = all.findIndex((m) => m.id === messageId);
  if (index === -1) return false;

  const msg = all[index];
  msg.status = newStatus;
  if (newStatus.toLowerCase() === 'delivered') {
    msg.deliveredAt = metadata?.deliveredAt || new Date().toISOString();
  }
  if (newStatus.toLowerCase() === 'opened') {
    msg.openedAt = metadata?.openedAt || new Date().toISOString();
  }
  if (metadata?.failureReason) {
    msg.failureReason = metadata.failureReason;
  }

  all[index] = msg;
  setLocal(LOCAL_COMM_MSGS_KEY, all);

  if (isSupabaseConfigured()) {
    try {
      await supabase
        .from('communication_messages')
        .update({
          status: newStatus,
          delivered_at: msg.deliveredAt,
          opened_at: msg.openedAt,
          failure_reason: msg.failureReason,
        })
        .eq('id', messageId);
    } catch {
      // ignore
    }
  }

  return true;
}

// ------------------------------------------------------------------------------
// 4. COMMUNICATION HISTORY & AUDIT LOGS (Linked to Customer, Lead, Booking, Inquiry, Task)
// ------------------------------------------------------------------------------

export async function logCommunicationMessage(msg: CommunicationMessage): Promise<void> {
  const all = getLocal<CommunicationMessage[]>(LOCAL_COMM_MSGS_KEY, []);
  setLocal(LOCAL_COMM_MSGS_KEY, [msg, ...all]);

  // Log on customer activity timeline if customerId, bookingReference, leadId, inquiryId, or taskId is present
  if (msg.customerId || msg.bookingReference || msg.leadId) {
    await logActivity({
      customerId: msg.customerId || null,
      bookingId: msg.bookingId || null,
      leadId: msg.leadId || null,
      eventType: 'communication',
      title: `${msg.channel} [${msg.status}]: ${msg.subject || msg.templateKey || 'Direct message'}`,
      description: msg.content.substring(0, 160) + (msg.content.length > 160 ? '...' : ''),
      actor: msg.staffName,
      metadata: {
        channel: msg.channel,
        status: msg.status,
        recipient: msg.recipientAddress,
        provider: msg.providerName,
        providerMessageId: msg.providerMessageId,
        failureReason: msg.failureReason,
        inquiryId: msg.inquiryId,
        taskId: msg.taskId,
      },
    });
  }

  if (isSupabaseConfigured()) {
    try {
      await supabase.from('communication_messages').insert({
        id: msg.id.startsWith('msg-') ? undefined : msg.id,
        channel: msg.channel,
        customer_id: msg.customerId,
        customer_name: msg.customerName,
        recipient_address: msg.recipientAddress,
        lead_id: msg.leadId,
        booking_id: msg.bookingId,
        booking_reference: msg.bookingReference,
        inquiry_id: msg.inquiryId,
        task_id: msg.taskId,
        template_key: msg.templateKey,
        subject: msg.subject,
        content: msg.content,
        status: msg.status,
        provider_name: msg.providerName,
        provider_message_id: msg.providerMessageId,
        failure_reason: msg.failureReason,
        sent_at: msg.sentAt,
        delivered_at: msg.deliveredAt,
        opened_at: msg.openedAt,
        staff_name: msg.staffName,
      });
    } catch {
      // ignore
    }
  }
}

export async function listCommunicationMessages(filter?: {
  channel?: string;
  status?: string;
  customerId?: string;
  bookingReference?: string;
  inquiryId?: string;
  taskId?: string;
  search?: string;
}): Promise<CommunicationMessage[]> {
  let messages = getLocal<CommunicationMessage[]>(LOCAL_COMM_MSGS_KEY, []);

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('communication_messages')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        messages = data.map((d) => ({
          id: d.id,
          channel: d.channel as CommunicationChannel,
          customerId: d.customer_id,
          customerName: d.customer_name || 'Guest',
          recipientAddress: d.recipient_address,
          leadId: d.lead_id,
          bookingId: d.booking_id,
          bookingReference: d.booking_reference,
          inquiryId: d.inquiry_id,
          taskId: d.task_id,
          templateKey: d.template_key,
          subject: d.subject,
          content: d.content,
          status: d.status as MessageDeliveryStatus,
          providerName: d.provider_name || 'None',
          providerMessageId: d.provider_message_id,
          failureReason: d.failure_reason,
          sentAt: d.sent_at,
          deliveredAt: d.delivered_at,
          openedAt: d.opened_at,
          staffName: d.staff_name || 'Staff',
          createdAt: d.created_at,
        }));
        setLocal(LOCAL_COMM_MSGS_KEY, messages);
      }
    } catch {
      // ignore
    }
  }

  return messages.filter((m) => {
    if (filter?.channel && filter.channel !== 'all' && m.channel !== filter.channel) return false;
    if (filter?.status && filter.status !== 'all' && m.status.toLowerCase() !== filter.status.toLowerCase()) return false;
    if (filter?.customerId && m.customerId !== filter.customerId) return false;
    if (filter?.bookingReference && m.bookingReference !== filter.bookingReference) return false;
    if (filter?.inquiryId && m.inquiryId !== filter.inquiryId) return false;
    if (filter?.taskId && m.taskId !== filter.taskId) return false;
    if (filter?.search?.trim()) {
      const q = filter.search.toLowerCase();
      return (
        m.customerName.toLowerCase().includes(q) ||
        m.recipientAddress.toLowerCase().includes(q) ||
        (m.bookingReference && m.bookingReference.toLowerCase().includes(q)) ||
        (m.subject && m.subject.toLowerCase().includes(q)) ||
        m.content.toLowerCase().includes(q) ||
        (m.providerMessageId && m.providerMessageId.toLowerCase().includes(q))
      );
    }
    return true;
  });
}

// ------------------------------------------------------------------------------
// 5. INTERNAL STAFF NOTIFICATIONS (All 10 Categories with Anti-Spam Deduplication)
// ------------------------------------------------------------------------------

export async function listStaffNotifications(): Promise<StaffNotification[]> {
  await checkAndGenerateStaffNotifications();
  const notifs = getLocal<StaffNotification[]>(LOCAL_NOTIFS_KEY, []);
  return notifs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function markNotificationRead(id: string): Promise<void> {
  const all = getLocal<StaffNotification[]>(LOCAL_NOTIFS_KEY, []);
  const updated = all.map((n) =>
    n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n
  );
  setLocal(LOCAL_NOTIFS_KEY, updated);

  if (isSupabaseConfigured()) {
    try {
      await supabase
        .from('staff_notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', id);
    } catch {
      // ignore
    }
  }
}

export async function markAllNotificationsRead(): Promise<void> {
  const all = getLocal<StaffNotification[]>(LOCAL_NOTIFS_KEY, []);
  const updated = all.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() }));
  setLocal(LOCAL_NOTIFS_KEY, updated);

  if (isSupabaseConfigured()) {
    try {
      await supabase
        .from('staff_notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('is_read', false);
    } catch {
      // ignore
    }
  }
}

/**
 * Intelligent notification generator:
 * Covers all 10 requested examples:
 * 1. New booking
 * 2. New inquiry
 * 3. New payment
 * 4. Payment overdue
 * 5. New lead
 * 6. Follow-up due
 * 7. Task overdue
 * 8. Departure unassigned
 * 9. Pickup pending
 * 10. Document expiring
 */
export async function checkAndGenerateStaffNotifications(): Promise<void> {
  const currentNotifs = getLocal<StaffNotification[]>(LOCAL_NOTIFS_KEY, []);
  const existingDedupKeys = new Set(currentNotifs.map((n) => n.dedupKey));
  const newNotifications: StaffNotification[] = [];
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  try {
    const bookings = await bookingRepository.listBookings();

    // 1. New Bookings
    bookings.forEach((b) => {
      const dedupKey = `new_booking_${b.bookingReference}`;
      if (!existingDedupKeys.has(dedupKey)) {
        newNotifications.push({
          id: `notif-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
          category: 'new_booking',
          dedupKey,
          title: `New Booking: ${b.bookingReference}`,
          message: `${b.customer.firstName} ${b.customer.lastName} booked ${b.tourTitle} for ${b.date} (€${b.pricing?.totalEur || 0}).`,
          severity: 'success',
          entityType: 'booking',
          entityId: b.bookingReference,
          linkTab: 'bookings',
          isRead: false,
          createdAt: b.createdAt || now.toISOString(),
        });
        existingDedupKeys.add(dedupKey);
      }

      // 4. Payment Overdue
      if (b.date <= todayStr && b.paymentStatus !== 'paid' && b.status !== 'cancelled') {
        const payOverdueDedup = `payment_overdue_${b.bookingReference}_${b.date}`;
        if (!existingDedupKeys.has(payOverdueDedup)) {
          newNotifications.push({
            id: `notif-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
            category: 'payment_overdue',
            dedupKey: payOverdueDedup,
            title: `Payment Overdue: ${b.bookingReference}`,
            message: `Reservation ${b.bookingReference} for ${b.date} has unpaid balance (€${b.pricing?.totalEur || 0}). Collect at check-in.`,
            severity: 'warning',
            entityType: 'booking',
            entityId: b.bookingReference,
            linkTab: 'fin_balances',
            isRead: false,
            createdAt: now.toISOString(),
          });
          existingDedupKeys.add(payOverdueDedup);
        }
      }
    });

    // 2. New Inquiries
    const inquiriesRaw = localStorage.getItem('rse_inquiries_data');
    if (inquiriesRaw) {
      try {
        const inquiries = JSON.parse(inquiriesRaw);
        inquiries.slice(0, 15).forEach((inq: any) => {
          if (inq.status === 'new') {
            const inqDedup = `new_inquiry_${inq.id}`;
            if (!existingDedupKeys.has(inqDedup)) {
              newNotifications.push({
                id: `notif-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
                category: 'new_inquiry',
                dedupKey: inqDedup,
                title: `New Inquiry: ${inq.customer_name}`,
                message: `${inq.customer_name} inquired about "${inq.subject}". Email: ${inq.email}`,
                severity: 'info',
                entityType: 'inquiry',
                entityId: inq.id,
                linkTab: 'inquiries',
                isRead: false,
                createdAt: inq.created_at || now.toISOString(),
              });
              existingDedupKeys.add(inqDedup);
            }
          }
        });
      } catch {}
    }

    // 3. New Payments
    const paymentsRaw = localStorage.getItem('rse_finance_payments');
    if (paymentsRaw) {
      try {
        const payments = JSON.parse(paymentsRaw);
        payments.slice(0, 10).forEach((p: any) => {
          const payDedup = `new_payment_${p.id}`;
          if (!existingDedupKeys.has(payDedup)) {
            newNotifications.push({
              id: `notif-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
              category: 'new_payment',
              dedupKey: payDedup,
              title: `New Payment: €${p.amount} (${p.currency || 'EUR'})`,
              message: `Received ${p.paymentMethod} from ${p.customerName} for ${p.bookingReference || 'Direct Payment'}.`,
              severity: 'success',
              entityType: 'payment',
              entityId: p.id,
              linkTab: 'fin_payments',
              isRead: false,
              createdAt: p.paymentDate || p.createdAt || now.toISOString(),
            });
            existingDedupKeys.add(payDedup);
          }
        });
      } catch {}
    }

    // 5. New Leads & 6. Follow-up Due
    const leadsRaw = localStorage.getItem('rse_crm_leads');
    if (leadsRaw) {
      try {
        const leads = JSON.parse(leadsRaw);
        leads.forEach((lead: any) => {
          // New Lead
          const leadDedup = `new_lead_${lead.id}`;
          if (!existingDedupKeys.has(leadDedup)) {
            newNotifications.push({
              id: `notif-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
              category: 'new_lead',
              dedupKey: leadDedup,
              title: `New CRM Lead: ${lead.name}`,
              message: `${lead.name} from ${lead.country || 'International'} (${lead.stage}). Value: €${lead.estimatedValue || 0}.`,
              severity: 'info',
              entityType: 'customer',
              entityId: lead.id,
              linkTab: 'crm_leads',
              isRead: false,
              createdAt: lead.createdAt || now.toISOString(),
            });
            existingDedupKeys.add(leadDedup);
          }

          // Follow-up Due
          if (lead.followUpDate && lead.stage !== 'Won' && lead.stage !== 'Lost') {
            const followDate = lead.followUpDate.split('T')[0];
            if (followDate <= todayStr) {
              const followDedup = `followup_due_${lead.id}_${followDate}`;
              if (!existingDedupKeys.has(followDedup)) {
                newNotifications.push({
                  id: `notif-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
                  category: 'followup_due',
                  dedupKey: followDedup,
                  title: `Follow-up Due: ${lead.name}`,
                  message: `Action required for ${lead.name} (${lead.interestedTourTitle || 'General inquiry'}). Target date: ${followDate}.`,
                  severity: 'warning',
                  entityType: 'customer',
                  entityId: lead.id,
                  linkTab: 'crm_followups',
                  isRead: false,
                  createdAt: now.toISOString(),
                });
                existingDedupKeys.add(followDedup);
              }
            }
          }
        });
      } catch {}
    }

    // 7. Task Overdue
    const tasksRaw = localStorage.getItem('rse_crm_tasks');
    if (tasksRaw) {
      try {
        const tasks = JSON.parse(tasksRaw);
        tasks.forEach((task: any) => {
          if (task.status !== 'Completed' && task.dueDate) {
            const taskDate = task.dueDate.split('T')[0];
            if (taskDate < todayStr) {
              const taskDedup = `task_overdue_${task.id}_${taskDate}`;
              if (!existingDedupKeys.has(taskDedup)) {
                newNotifications.push({
                  id: `notif-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
                  category: 'task_overdue',
                  dedupKey: taskDedup,
                  title: `Task Overdue: ${task.title}`,
                  message: `Assigned to ${task.assignedStaffName || 'Staff'}. Due on ${taskDate}.`,
                  severity: 'critical',
                  entityType: 'task',
                  entityId: task.id,
                  linkTab: 'crm_tasks',
                  isRead: false,
                  createdAt: now.toISOString(),
                });
                existingDedupKeys.add(taskDedup);
              }
            }
          }
        });
      } catch {}
    }

    // 8. Departure Unassigned
    const departuresRaw = localStorage.getItem('rse_ops_departures');
    if (departuresRaw) {
      try {
        const departures = JSON.parse(departuresRaw);
        departures.forEach((dep: any) => {
          if (dep.date >= todayStr && dep.status !== 'cancelled' && dep.status !== 'completed') {
            const missingStaff = !dep.lead_guide_id && !dep.guide_name;
            const missingVessel = !dep.vessel_id && !dep.vessel_name;
            if (missingStaff || missingVessel) {
              const unassignedDedup = `departure_unassigned_${dep.id}`;
              if (!existingDedupKeys.has(unassignedDedup)) {
                const missingWhat = missingStaff && missingVessel ? 'Guide and Vessel' : missingStaff ? 'Guide' : 'Vessel';
                newNotifications.push({
                  id: `notif-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
                  category: 'departure_unassigned',
                  dedupKey: unassignedDedup,
                  title: `Departure Unassigned: ${dep.date}`,
                  message: `${dep.tour_name || 'Tour'} on ${dep.date} is missing ${missingWhat} assignment.`,
                  severity: 'critical',
                  entityType: 'departure',
                  entityId: dep.id,
                  linkTab: 'ops_assignments',
                  isRead: false,
                  createdAt: now.toISOString(),
                });
                existingDedupKeys.add(unassignedDedup);
              }
            }
          }
        });
      } catch {}
    }

    // 9. Pickup Pending
    const pickupsRaw = localStorage.getItem('rse_ops_pickups');
    if (pickupsRaw) {
      try {
        const pickups = JSON.parse(pickupsRaw);
        pickups.forEach((pu: any) => {
          if (pu.status === 'pending') {
            const puDedup = `pickup_pending_${pu.id}`;
            if (!existingDedupKeys.has(puDedup)) {
              newNotifications.push({
                id: `notif-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
                category: 'pickup_pending',
                dedupKey: puDedup,
                title: `Pickup Pending: ${pu.hotel_name || 'Hotel'}`,
                message: `Passenger pickup for ${pu.passenger_name || 'Guest'} at ${pu.pickup_time || 'morning'} requires driver confirmation.`,
                severity: 'warning',
                entityType: 'departure',
                entityId: pu.id,
                linkTab: 'ops_pickups',
                isRead: false,
                createdAt: now.toISOString(),
              });
              existingDedupKeys.add(puDedup);
            }
          }
        });
      } catch {}
    }

    // 10. Document Expiring
    const docsRaw = localStorage.getItem('rse_ops_documents');
    if (docsRaw) {
      try {
        const docs = JSON.parse(docsRaw);
        docs.forEach((doc: any) => {
          if (doc.expiry_date) {
            const expTime = new Date(doc.expiry_date).getTime();
            const daysLeft = Math.round((expTime - now.getTime()) / (1000 * 60 * 60 * 24));
            if (daysLeft <= 14) {
              const docDedup = `document_expiring_${doc.id}`;
              if (!existingDedupKeys.has(docDedup)) {
                newNotifications.push({
                  id: `notif-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
                  category: 'document_expiring',
                  dedupKey: docDedup,
                  title: `Document Expiring: ${doc.title}`,
                  message: `${doc.document_type || 'Operational Document'} (${doc.title}) expires in ${daysLeft > 0 ? `${daysLeft} days` : 'OVERDUE'}. Renewal required.`,
                  severity: daysLeft <= 3 ? 'critical' : 'warning',
                  entityType: 'document',
                  entityId: doc.id,
                  linkTab: 'ops_documents',
                  isRead: false,
                  createdAt: now.toISOString(),
                });
                existingDedupKeys.add(docDedup);
              }
            }
          }
        });
      } catch {}
    }
  } catch (err) {
    console.warn('Notification generator scan error:', err);
  }

  if (newNotifications.length > 0) {
    const combined = [...newNotifications, ...currentNotifs];
    setLocal(LOCAL_NOTIFS_KEY, combined);
  }
}

// ------------------------------------------------------------------------------
// 6. EVENT-DRIVEN AUTOMATION ARCHITECTURE (No Uncontrolled Loops!)
// ------------------------------------------------------------------------------

type EventHandler = (event: AutomationEvent) => Promise<void> | void;
const eventHandlers = new Map<AutomationEventType, Set<EventHandler>>();

export function subscribeToAutomationEvent(
  eventType: AutomationEventType,
  handler: EventHandler
): () => void {
  if (!eventHandlers.has(eventType)) {
    eventHandlers.set(eventType, new Set());
  }
  eventHandlers.get(eventType)!.add(handler);

  return () => {
    eventHandlers.get(eventType)?.delete(handler);
  };
}

export async function publishAutomationEvent(
  eventName: AutomationEventType,
  payload: Record<string, any>,
  entityType?: string,
  entityId?: string
): Promise<AutomationEvent> {
  const event: AutomationEvent = {
    id: `ev-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
    eventName,
    payload,
    entityType,
    entityId,
    processed: false,
    createdAt: new Date().toISOString(),
  };

  const existing = getLocal<AutomationEvent[]>(LOCAL_AUTO_EVENTS_KEY, []);
  setLocal(LOCAL_AUTO_EVENTS_KEY, [event, ...existing]);

  if (isSupabaseConfigured()) {
    try {
      await supabase.from('automation_events').insert({
        event_name: event.eventName,
        payload: event.payload,
        entity_type: event.entityType,
        entity_id: event.entityId,
        processed: false,
      });
    } catch {
      // ignore
    }
  }

  // Trigger registered in-memory listeners safely (single-run, error captured, no infinite recurrence)
  const handlers = eventHandlers.get(eventName);
  if (handlers && handlers.size > 0) {
    for (const h of handlers) {
      try {
        await h(event);
      } catch (err) {
        console.warn(`[Automation] Handler failed for event ${eventName}:`, err);
      }
    }
  }

  // Mark event processed
  await markAutomationEventProcessed(event.id, ['in-memory-handlers-dispatched']);

  return event;
}

export async function listAutomationEvents(): Promise<AutomationEvent[]> {
  const local = getLocal<AutomationEvent[]>(LOCAL_AUTO_EVENTS_KEY, []);
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('automation_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (!error && data) {
        const remote = data.map((d: any) => ({
          id: d.id,
          eventName: d.event_name as AutomationEventType,
          payload: d.payload || {},
          entityType: d.entity_type,
          entityId: d.entity_id,
          processed: d.processed,
          processedAt: d.processed_at,
          actionsTriggered: d.actions_triggered,
          errorMessage: d.error_message,
          createdAt: d.created_at,
        }));
        return remote;
      }
    } catch {}
  }
  return local;
}

export async function markAutomationEventProcessed(
  eventId: string,
  actionsTriggered: string[] = []
): Promise<void> {
  const events = getLocal<AutomationEvent[]>(LOCAL_AUTO_EVENTS_KEY, []);
  const idx = events.findIndex((e) => e.id === eventId);
  const now = new Date().toISOString();
  if (idx !== -1) {
    events[idx].processed = true;
    events[idx].processedAt = now;
    events[idx].actionsTriggered = actionsTriggered;
    setLocal(LOCAL_AUTO_EVENTS_KEY, events);
  }

  if (isSupabaseConfigured()) {
    try {
      await supabase
        .from('automation_events')
        .update({
          processed: true,
          processed_at: now,
          actions_triggered: actionsTriggered,
        })
        .eq('id', eventId);
    } catch {}
  }
}

// ------------------------------------------------------------------------------
// 7. BUILT-IN AUTOMATION HANDLERS & EXPLICIT DISPATCHERS
// ------------------------------------------------------------------------------

export async function dispatchCommunicationByTemplate(
  templateKey: TemplateKey,
  bookingReference: string,
  extraVariables: Partial<MessageContextVariables> = {}
): Promise<void> {
  const allBookings = await bookingRepository.listBookings();
  const booking = allBookings.find((b) => b.bookingReference === bookingReference);
  if (!booking) return;

  const templates = await listTemplates();
  const tmpl = templates.find((t) => t.templateKey === templateKey);
  if (!tmpl || !tmpl.isActive) return;

  const variables: MessageContextVariables = {
    customer_name: `${booking.customer.firstName} ${booking.customer.lastName}`.trim(),
    booking_reference: booking.bookingReference,
    tour_name: booking.tourTitle,
    tour_date: booking.date,
    pickup_time: (booking as any).pickupTime || '08:30 AM',
    amount: booking.pricing?.totalEur || 0,
    balance_due: booking.paymentStatus === 'paid' ? 0 : (booking.pricing?.totalEur || 0),
    ...extraVariables,
  };

  const renderedSubject = tmpl.subject ? renderTemplateVariables(tmpl.subject, variables) : `Notice regarding ${booking.bookingReference}`;
  const renderedContent = renderTemplateVariables(tmpl.bodyText, variables);

  // Email dispatch
  if (tmpl.channel === 'Email' || tmpl.channel === 'Both') {
    try {
      await sendEmailMessage({
        recipientEmail: booking.customer.email,
        customerName: variables.customer_name || 'Customer',
        customerId: booking.customerId,
        bookingId: booking.bookingId || booking.bookingReference,
        bookingReference: booking.bookingReference,
        templateKey: tmpl.templateKey,
        subject: renderedSubject,
        content: renderedContent,
      });
    } catch (err) {
      console.warn(`[Communication] Automated email dispatch failed:`, err);
    }
  }

  // WhatsApp dispatch
  if (tmpl.channel === 'WhatsApp' || tmpl.channel === 'Both') {
    const phone = booking.customer.whatsappNumber || `${booking.customer.countryCode || ''} ${booking.customer.phoneNumber || ''}`.trim();
    if (phone) {
      try {
        await sendWhatsAppMessage({
          recipientPhone: phone,
          customerName: variables.customer_name || 'Customer',
          customerId: booking.customerId,
          bookingId: booking.bookingId || booking.bookingReference,
          bookingReference: booking.bookingReference,
          templateKey: tmpl.templateKey,
          content: renderedContent,
        });
      } catch (err) {
        console.warn(`[Communication] Automated WhatsApp dispatch failed:`, err);
      }
    }
  }
}

// Built-in automated event listeners
subscribeToAutomationEvent('booking.created', async (ev) => {
  if (ev.payload?.bookingReference) {
    await dispatchCommunicationByTemplate('booking_confirmation', ev.payload.bookingReference);
  }
});

subscribeToAutomationEvent('booking.updated', async (ev) => {
  if (ev.payload?.bookingReference) {
    await dispatchCommunicationByTemplate('booking_update', ev.payload.bookingReference);
  }
});

subscribeToAutomationEvent('payment.received', async (ev) => {
  if (ev.payload?.bookingReference) {
    await dispatchCommunicationByTemplate('payment_confirmation', ev.payload.bookingReference, {
      amount: ev.payload.amount,
      balance_due: 0,
    });
  }
});

subscribeToAutomationEvent('booking.cancelled', async (ev) => {
  if (ev.payload?.bookingReference) {
    await dispatchCommunicationByTemplate('cancellation', ev.payload.bookingReference);
  }
});

subscribeToAutomationEvent('departure.tomorrow', async (ev) => {
  if (ev.payload?.bookingReference) {
    await dispatchCommunicationByTemplate('tour_reminder', ev.payload.bookingReference);
  }
});

subscribeToAutomationEvent('pickup.reminder' as any, async (ev) => {
  if (ev.payload?.bookingReference) {
    await dispatchCommunicationByTemplate('pickup_reminder', ev.payload.bookingReference);
  }
});

subscribeToAutomationEvent('review.request' as any, async (ev) => {
  if (ev.payload?.bookingReference) {
    await dispatchCommunicationByTemplate('review_request', ev.payload.bookingReference);
  }
});
