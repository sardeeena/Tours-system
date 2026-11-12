import type { SupabaseClient } from '@supabase/supabase-js';

type QueueMessage = {
  msg_id: number;
  read_ct: number;
  message: {
    event_id?: string;
    event_name?: string;
  };
};

type BookingRow = {
  id: string;
  booking_reference: string;
  booking_date: string;
  total: number | string | null;
  currency: string | null;
  status: string;
  payment_status: string;
  customer_id: string | null;
  customers: any;
  tours: any;
};

const QUEUE_POLL_INTERVAL_MS = 15_000;
const MAX_DELIVERY_ATTEMPTS = 5;

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

function renderTemplate(source: string, values: Record<string, string>): string {
  return source.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? values[key] : match
  );
}

function normalizeRelation(value: any): any {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function retryDelaySeconds(readCount: number): number {
  return Math.min(1800, 30 * (2 ** Math.max(0, readCount - 1)));
}

async function updateEvent(
  client: SupabaseClient,
  eventId: string,
  values: Record<string, unknown>
): Promise<void> {
  const { error } = await client
    .from('automation_events')
    .update(values)
    .eq('id', eventId);
  if (error) throw error;
}

async function acknowledge(
  client: SupabaseClient,
  messageId: number
): Promise<void> {
  const { error } = await client.rpc('delete_booking_notification_message', {
    p_msg_id: messageId,
  });
  if (error) throw error;
}

async function handleFailure(
  client: SupabaseClient,
  message: QueueMessage,
  eventId: string,
  error: unknown
): Promise<void> {
  const reason = error instanceof Error ? error.message : 'Unknown notification delivery failure';

  const { data: logRow } = await client
    .from('communication_messages')
    .select('id')
    .eq('automation_event_id', eventId)
    .eq('channel', 'Email')
    .maybeSingle();

  if (logRow?.id) {
    const { error: logError } = await client
      .from('communication_messages')
      .update({ status: 'failed', failure_reason: reason })
      .eq('id', logRow.id);
    if (logError) throw logError;
  }

  await updateEvent(client, eventId, { error_message: reason });

  if (message.read_ct >= MAX_DELIVERY_ATTEMPTS) {
    const { error: archiveError } = await client.rpc('archive_booking_notification_message', {
      p_msg_id: message.msg_id,
    });
    if (archiveError) throw archiveError;
    return;
  }

  const { error: retryError } = await client.rpc('retry_booking_notification_message', {
    p_msg_id: message.msg_id,
    p_delay_seconds: retryDelaySeconds(message.read_ct),
  });
  if (retryError) throw retryError;
}

async function processMessage(
  client: SupabaseClient,
  message: QueueMessage,
  apiKey: string,
  fromEmail: string,
  fromName: string
): Promise<void> {
  const eventId = message.message?.event_id;
  if (!eventId) {
    await acknowledge(client, message.msg_id);
    return;
  }

  const { data: event, error: eventError } = await client
    .from('automation_events')
    .select('id,event_name,payload,processed')
    .eq('id', eventId)
    .maybeSingle();

  if (eventError) throw eventError;
  if (!event || event.processed) {
    await acknowledge(client, message.msg_id);
    return;
  }

  if (event.event_name !== 'booking.created') {
    await updateEvent(client, eventId, {
      processed: true,
      processed_at: new Date().toISOString(),
      actions_triggered: ['unsupported_event_skipped'],
      error_message: null,
    });
    await acknowledge(client, message.msg_id);
    return;
  }

  const bookingId = String(event.payload?.booking_id || '');
  if (!bookingId) {
    throw new Error('Booking notification event is missing booking_id.');
  }

  const { data: booking, error: bookingError } = await client
    .from('bookings')
    .select('id,booking_reference,booking_date,total,currency,status,payment_status,customer_id,customers(first_name,last_name,email),tours(title,departure_time)')
    .eq('id', bookingId)
    .maybeSingle();

  if (bookingError) throw bookingError;
  if (!booking) throw new Error('The booking referenced by the notification event was not found.');

  const row = booking as unknown as BookingRow;
  const customer = normalizeRelation(row.customers);
  const tour = normalizeRelation(row.tours);
  const recipient = String(customer?.email || '').trim().toLowerCase();

  if (!isValidEmail(recipient)) {
    await updateEvent(client, eventId, {
      processed: true,
      processed_at: new Date().toISOString(),
      actions_triggered: ['booking_received_email_skipped_missing_email'],
      error_message: 'Customer has no valid email address; no email was sent.',
    });
    await acknowledge(client, message.msg_id);
    return;
  }

  const { data: template, error: templateError } = await client
    .from('communication_templates')
    .select('subject,body_text,is_active')
    .eq('template_key', 'booking_received')
    .maybeSingle();

  if (templateError) throw templateError;
  if (template && template.is_active === false) {
    await updateEvent(client, eventId, {
      processed: true,
      processed_at: new Date().toISOString(),
      actions_triggered: ['booking_received_template_disabled'],
      error_message: null,
    });
    await acknowledge(client, message.msg_id);
    return;
  }

  const customerName = [customer?.first_name, customer?.last_name].filter(Boolean).join(' ').trim() || 'Customer';
  const amount = Number(row.total || 0).toFixed(2);
  const currency = String(row.currency || 'EUR').toUpperCase();
  const variables: Record<string, string> = {
    customer_name: customerName,
    booking_reference: String(row.booking_reference || ''),
    tour_name: String(tour?.title || 'your selected tour'),
    tour_date: String(row.booking_date || '').slice(0, 10),
    booking_status: String(row.status || 'pending').replace(/_/g, ' '),
    currency,
    amount,
  };

  const subject = renderTemplate(
    String(template?.subject || 'We received your booking request {{booking_reference}}'),
    variables
  );
  const content = renderTemplate(
    String(template?.body_text || 'Hello {{customer_name}}, we received your booking request {{booking_reference}} for {{tour_name}} on {{tour_date}}. Our team will review it and send further details.'),
    variables
  );

  let logRow: { id: string; status: string } | null = null;
  const { data: existingLog, error: existingLogError } = await client
    .from('communication_messages')
    .select('id,status')
    .eq('automation_event_id', eventId)
    .eq('channel', 'Email')
    .maybeSingle();

  if (existingLogError) throw existingLogError;

  if (existingLog?.status === 'sent') {
    await updateEvent(client, eventId, {
      processed: true,
      processed_at: new Date().toISOString(),
      actions_triggered: ['booking_received_email'],
      error_message: null,
    });
    await acknowledge(client, message.msg_id);
    return;
  }

  if (existingLog?.id) {
    const { error } = await client
      .from('communication_messages')
      .update({
        status: 'queued',
        recipient_address: recipient,
        customer_name: customerName,
        subject,
        content,
        provider_name: 'Resend',
        failure_reason: null,
      })
      .eq('id', existingLog.id);
    if (error) throw error;
    logRow = { id: existingLog.id, status: 'queued' };
  } else {
    const { data: inserted, error } = await client
      .from('communication_messages')
      .insert({
        automation_event_id: eventId,
        channel: 'Email',
        customer_id: row.customer_id,
        customer_name: customerName,
        recipient_address: recipient,
        booking_id: row.id,
        booking_reference: row.booking_reference,
        template_key: 'booking_received',
        subject,
        content,
        status: 'queued',
        provider_name: 'Resend',
        staff_name: 'Booking Notification Worker',
      })
      .select('id,status')
      .single();

    if (error) throw error;
    logRow = inserted;
  }

  const idempotencyKey = `awesome-adventure-booking-${eventId}-email`;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      from: `${fromName} <${fromEmail}>`,
      to: [recipient],
      reply_to: process.env.RESEND_REPLY_TO?.trim() || 'reservation@awesomeadventure.tours',
      bcc: [process.env.BOOKING_NOTIFICATION_EMAIL?.trim() || 'reservation@awesomeadventure.tours'],
      subject,
      text: content,
      tags: [{ name: 'communication_id', value: String(logRow!.id) }],
    }),
    signal: AbortSignal.timeout(15_000),
  });

  const providerBody = await response.json().catch(() => ({} as any));
  if (!response.ok || typeof providerBody?.id !== 'string') {
    const detail = typeof providerBody?.message === 'string'
      ? providerBody.message
      : `Resend rejected the request (HTTP ${response.status}).`;
    throw new Error(detail);
  }

  const sentAt = new Date().toISOString();
  const { error: updateError } = await client
    .from('communication_messages')
    .update({
      status: 'sent',
      provider_name: 'Resend',
      provider_message_id: providerBody.id,
      sent_at: sentAt,
      failure_reason: null,
    })
    .eq('id', logRow!.id);

  if (updateError) throw updateError;

  await updateEvent(client, eventId, {
    processed: true,
    processed_at: sentAt,
    actions_triggered: ['booking_received_email'],
    error_message: null,
  });
  await acknowledge(client, message.msg_id);
}

export function startBookingNotificationWorker(client: SupabaseClient): () => void {
  if (process.env.BOOKING_NOTIFICATION_WORKER_ENABLED?.trim().toLowerCase() !== 'true') {
    console.info('[Booking Notification Worker] Not started: BOOKING_NOTIFICATION_WORKER_ENABLED is not true.');
    return () => undefined;
  }

  const apiKey = process.env.RESEND_API_KEY?.trim() || '';
  const fromEmail = process.env.RESEND_FROM_EMAIL?.trim() || '';
  const fromName = process.env.RESEND_FROM_NAME?.trim() || 'Awesome Adventure Tours';

  if (!apiKey || !isValidEmail(fromEmail)) {
    console.warn('[Booking Notification Worker] Not started: RESEND_API_KEY and a valid RESEND_FROM_EMAIL are required.');
    return () => undefined;
  }

  let running = false;

  const poll = async () => {
    if (running) return;
    running = true;

    try {
      const { data, error } = await client.rpc('read_booking_notification_queue', { p_qty: 5 });
      if (error) throw error;

      for (const item of (data || []) as QueueMessage[]) {
        const eventId = item.message?.event_id;
        try {
          await processMessage(client, item, apiKey, fromEmail, fromName);
        } catch (error) {
          console.error('[Booking Notification Worker] Delivery attempt failed:', {
            eventId,
            attempt: item.read_ct,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          if (eventId) {
            await handleFailure(client, item, eventId, error);
          } else {
            await acknowledge(client, item.msg_id);
          }
        }
      }
    } catch (error) {
      console.error('[Booking Notification Worker] Queue poll failed:', error);
    } finally {
      running = false;
    }
  };

  const timer = setInterval(() => void poll(), QUEUE_POLL_INTERVAL_MS);
  timer.unref();
  void poll();

  console.log('[Booking Notification Worker] Started; polling durable Supabase queue.');
  return () => clearInterval(timer);
}
