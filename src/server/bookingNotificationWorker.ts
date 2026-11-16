import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { renderBookingTicketEmailHtml, renderBrandedEmailHtml } from '../utils/emailTemplate';

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
  payment_method: string;
  adult_count: number;
  child_count: number;
  infant_count: number;
  pickup_hotel_name: string | null;
  pickup_room_number: string | null;
  tour_language: string | null;
  customer_locale: string | null;
  customer_id: string | null;
  customers: any;
  tours: any;
  pickup_locations: any;
  booking_extras: any[];
};

const QUEUE_POLL_INTERVAL_MS = 15_000;
const MAX_DELIVERY_ATTEMPTS = 5;

function normalizeSenderEmail(value: string): string {
  const trimmed = value.trim().replace(/^["']|["']$/g, '');
  const mailbox = trimmed.match(/<\s*([^<>]+)\s*>/);
  return (mailbox ? mailbox[1] : trimmed).trim();
}

function isValidEmail(value: string): boolean {
  const normalized = normalizeSenderEmail(value);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) && normalized.length <= 254;
}

function renderTemplate(source: string, values: Record<string, string>): string {
  return source.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? values[key] : match
  );
}

function normalizeRelation(value: any): any {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function normalizeCustomerLocale(value: unknown): string {
  const locale = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return ['en', 'de', 'it', 'ro', 'ru', 'fr', 'es', 'nl', 'pl', 'pt'].includes(locale) ? locale : 'en';
}

function stableTranslationJson(value: any): string {
  if (Array.isArray(value)) return '[' + value.map(stableTranslationJson).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + stableTranslationJson(value[key])).join(',') + '}';
  }
  return JSON.stringify(value);
}

async function getLocalizedCommunicationTemplate(
  client: SupabaseClient,
  templateKey: string,
  locale: string
): Promise<{ subject: string | null; body_text: string | null; is_active: boolean | null } | null> {
  if (locale !== 'en') {
    if (['fr', 'es', 'nl', 'pl', 'pt'].includes(locale)) {
      const { data: source, error: sourceError } = await client.from('communication_templates')
        .select('*').eq('template_key', templateKey).eq('locale', 'en').maybeSingle();
      if (sourceError) throw sourceError;
      if (source) {
        const sourceChecksum = createHash('sha256').update(stableTranslationJson(source)).digest('hex');
        const { data: approval, error: approvalError } = await client.from('content_translations')
          .select('source_checksum,translation_state,reviewed_at,published_at')
          .eq('entity_type', 'communication_template').eq('entity_key', String(source.id)).eq('locale', locale).maybeSingle();
        if (approvalError) throw approvalError;
        if (approval?.translation_state === 'published' && approval.reviewed_at && approval.published_at && approval.source_checksum === sourceChecksum) {
          const { data: localized, error: localizedError } = await client.from('communication_templates')
            .select('subject,body_text,is_active').eq('template_key', templateKey).eq('locale', locale).maybeSingle();
          if (localizedError) throw localizedError;
          if (localized) return localized;
        }
      }
    } else {
      const { data, error } = await client.from('communication_templates')
        .select('subject,body_text,is_active')
        .eq('template_key', templateKey).eq('locale', locale).maybeSingle();
      if (error) throw error;
      if (data) return data;
    }
  }
  const { data, error } = await client.from('communication_templates')
    .select('subject,body_text,is_active')
    .eq('template_key', templateKey).eq('locale', 'en').maybeSingle();
  if (error) throw error;
  return data || null;
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

  if (!['booking.created', 'booking.completed'].includes(event.event_name)) {
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
    .select('id,booking_reference,booking_date,total,currency,status,payment_status,payment_method,adult_count,child_count,infant_count,pickup_hotel_name,pickup_room_number,tour_language,customer_locale,customer_id,customers(first_name,last_name,email,phone,country,hotel,preferred_locale),tours(title,departure_time,slug),pickup_locations(name,area),booking_extras(name,quantity,unit_price,total_price,pricing_type)')
    .eq('id', bookingId)
    .maybeSingle();

  if (bookingError) throw bookingError;
  if (!booking) throw new Error('The booking referenced by the notification event was not found.');

  const row = booking as unknown as BookingRow;
  const customer = normalizeRelation(row.customers);
  const tour = normalizeRelation(row.tours);
  const pickup = normalizeRelation(row.pickup_locations);
  const bookingExtras = Array.isArray(row.booking_extras) ? row.booking_extras : [];
  const recipient = String(customer?.email || '').trim().toLowerCase();
  const customerLocale = normalizeCustomerLocale(row.customer_locale || customer?.preferred_locale);

  if (!isValidEmail(recipient)) {
    await updateEvent(client, eventId, {
      processed: true,
      processed_at: new Date().toISOString(),
      actions_triggered: [event.event_name === 'booking.completed' ? 'booking_review_request_skipped_missing_email' : 'booking_received_email_skipped_missing_email'],
      error_message: 'Customer has no valid email address; no email was sent.',
    });
    await acknowledge(client, message.msg_id);
    return;
  }

  if (event.event_name === 'booking.completed') {
    if (row.status !== 'completed' || row.payment_status !== 'paid') {
      await updateEvent(client, eventId, {
        processed: true,
        processed_at: new Date().toISOString(),
        actions_triggered: ['booking_review_request_skipped_booking_not_completed_and_paid'],
        error_message: null,
      });
      await acknowledge(client, message.msg_id);
      return;
    }

    const tourSlug = String(tour?.slug || '').trim();
    if (!tourSlug) throw new Error('The completed booking has no published tour slug for its review link.');

    const reviewTemplate = await getLocalizedCommunicationTemplate(client, 'booking_review_request', customerLocale);
    if (!reviewTemplate) throw new Error('The booking review request email template is missing.');
    if (reviewTemplate.is_active === false) {
      await updateEvent(client, eventId, {
        processed: true,
        processed_at: new Date().toISOString(),
        actions_triggered: ['booking_review_request_template_disabled'],
        error_message: null,
      });
      await acknowledge(client, message.msg_id);
      return;
    }

    const customerName = [customer?.first_name, customer?.last_name].filter(Boolean).join(' ').trim() || 'there';
    const tourName = String(tour?.title || 'your tour');
    const googleReviewUrl = 'https://share.google/zOClg9BBAjmz6TIR5';
    const tripadvisorReviewUrl = 'https://www.tripadvisor.co.uk/Attraction_Review-g297549-d34759384-Reviews-Awesome_Adventure_Tours-Hurghada_Red_Sea_and_Sinai.html';
    const tourReviewUrl = 'https://awesomeadventure.tours/excursions/' + encodeURIComponent(tourSlug);
    const reviewVariables: Record<string, string> = {
      customer_name: customerName,
      booking_reference: String(row.booking_reference || ''),
      tour_name: tourName,
      google_review_url: googleReviewUrl,
      tripadvisor_review_url: tripadvisorReviewUrl,
      tour_review_url: tourReviewUrl,
    };
    const reviewSubject = renderTemplate(
      String(reviewTemplate.subject || 'How was {{tour_name}}? We would love your feedback'),
      reviewVariables
    );
    const reviewContent = renderTemplate(
      String(reviewTemplate.body_text || 'Hello {{customer_name}}, thank you for joining us on {{tour_name}}. We would be grateful for an honest review. Google: {{google_review_url}} Tripadvisor: {{tripadvisor_review_url}} Tour page: {{tour_review_url}}'),
      reviewVariables
    );
    const reviewHtml = renderBrandedEmailHtml({
      heading: reviewSubject,
      preheader: 'Thank you for travelling with Awesome Adventure Tours.',
      bodyText: reviewContent,
    });

    const { data: existingReviewLog, error: existingReviewLogError } = await client
      .from('communication_messages')
      .select('id,status')
      .eq('automation_event_id', eventId)
      .eq('channel', 'Email')
      .maybeSingle();

    if (existingReviewLogError) throw existingReviewLogError;
    if (existingReviewLog?.status === 'sent') {
      await updateEvent(client, eventId, {
        processed: true,
        processed_at: new Date().toISOString(),
        actions_triggered: ['booking_review_request_email'],
        error_message: null,
      });
      await acknowledge(client, message.msg_id);
      return;
    }

    let reviewLogId = existingReviewLog?.id || '';
    if (reviewLogId) {
      const { error: updateLogError } = await client
        .from('communication_messages')
        .update({
          status: 'queued',
          recipient_address: recipient,
          customer_name: customerName,
          subject: reviewSubject,
          content: reviewContent,
          template_key: 'booking_review_request',
          provider_name: 'Resend',
          failure_reason: null,
        })
        .eq('id', reviewLogId);
      if (updateLogError) throw updateLogError;
    } else {
      const { data: insertedLog, error: insertLogError } = await client
        .from('communication_messages')
        .insert({
          automation_event_id: eventId,
          channel: 'Email',
          customer_id: row.customer_id,
          customer_name: customerName,
          recipient_address: recipient,
          booking_id: row.id,
          booking_reference: row.booking_reference,
          template_key: 'booking_review_request',
          subject: reviewSubject,
          content: reviewContent,
          status: 'queued',
          provider_name: 'Resend',
          staff_name: 'Booking Review Request Worker',
        })
        .select('id')
        .single();
      if (insertLogError) throw insertLogError;
      reviewLogId = insertedLog.id;
    }

    const reviewIdempotencyKey = `awesome-adventure-booking-${eventId}-review-email`;
    const reviewResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': reviewIdempotencyKey,
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: [recipient],
        reply_to: process.env.RESEND_REPLY_TO?.trim() || 'reservation@awesomeadventure.tours',
        bcc: [process.env.BOOKING_NOTIFICATION_EMAIL?.trim() || 'reservation@awesomeadventure.tours'],
        subject: reviewSubject,
        text: reviewContent,
        html: reviewHtml,
        tags: [{ name: 'communication_id', value: String(reviewLogId) }],
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const reviewProviderBody = await reviewResponse.json().catch(() => ({} as any));
    if (!reviewResponse.ok || typeof reviewProviderBody?.id !== 'string') {
      const detail = typeof reviewProviderBody?.message === 'string'
        ? reviewProviderBody.message
        : `Resend rejected the review request (HTTP ${reviewResponse.status}).`;
      throw new Error(detail);
    }

    const reviewSentAt = new Date().toISOString();
    const { error: reviewProviderUpdateError } = await client
      .from('communication_messages')
      .update({
        provider_name: 'Resend',
        provider_message_id: reviewProviderBody.id,
        sent_at: reviewSentAt,
        failure_reason: null,
      })
      .eq('id', reviewLogId);
    if (reviewProviderUpdateError) throw reviewProviderUpdateError;

    const { error: reviewStatusError } = await client
      .from('communication_messages')
      .update({ status: 'sent' })
      .eq('id', reviewLogId)
      .eq('status', 'queued');
    if (reviewStatusError) throw reviewStatusError;

    await updateEvent(client, eventId, {
      processed: true,
      processed_at: reviewSentAt,
      actions_triggered: ['booking_review_request_email'],
      error_message: null,
    });
    await acknowledge(client, message.msg_id);
    return;
  }

  const template = await getLocalizedCommunicationTemplate(client, 'booking_received', customerLocale);
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
  const formatDate = (value: string) => {
    const parsed = new Date(value + 'T00:00:00Z');
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
  };
  const ticketExtras = bookingExtras.map((extra) => ({
    name: String(extra.name || 'Booking extra'),
    quantity: Math.max(1, Number(extra.quantity) || 1),
    total: String(currency) + ' ' + Number(extra.total_price ?? extra.unit_price ?? 0).toFixed(2),
  }));
  const ticketText = [
    content,
    '',
    'OFFICIAL BOOKING TICKET',
    'Booking reference: ' + row.booking_reference,
    'Excursion: ' + String(tour?.title || 'your selected tour'),
    'Date: ' + formatDate(String(row.booking_date || '')),
    'Guests: ' + Number(row.adult_count || 0) + ' adults, ' + Number(row.child_count || 0) + ' children, ' + Number(row.infant_count || 0) + ' infants',
    'Pickup: ' + String(pickup?.name || 'To be confirmed') + (pickup?.area ? ' (' + String(pickup.area) + ')' : ''),
    'Hotel: ' + String(row.pickup_hotel_name || customer?.hotel || 'To be confirmed'),
    'Room: ' + String(row.pickup_room_number || 'To be confirmed'),
    'Tour language: ' + String(row.tour_language || 'To be confirmed'),
    'Booking status: ' + String(row.status || 'pending'),
    'Payment status: ' + String(row.payment_status || 'pending'),
    'Total: ' + currency + ' ' + amount,
    ...ticketExtras.map((extra) => 'Extra: ' + extra.name + ' × ' + extra.quantity + ' — ' + extra.total),
  ].join('\n');
  const ticketHtml = renderBookingTicketEmailHtml({
    heading: subject,
    preheader: 'Your Awesome Adventure Tours ticket · ' + row.booking_reference,
    introText: content,
    bookingReference: String(row.booking_reference || ''),
    customerName,
    customerEmail: recipient,
    tourName: String(tour?.title || 'your selected tour'),
    tourDate: formatDate(String(row.booking_date || '')),
    departureTime: tour?.departure_time ? String(tour.departure_time) : undefined,
    adultCount: Number(row.adult_count || 0),
    childCount: Number(row.child_count || 0),
    infantCount: Number(row.infant_count || 0),
    pickupLocation: pickup?.name ? String(pickup.name) : undefined,
    pickupArea: pickup?.area ? String(pickup.area) : undefined,
    hotelName: String(row.pickup_hotel_name || customer?.hotel || ''),
    roomNumber: row.pickup_room_number ? String(row.pickup_room_number) : undefined,
    tourLanguage: row.tour_language ? String(row.tour_language) : undefined,
    bookingStatus: String(row.status || 'pending').replace(/_/g, ' '),
    paymentStatus: String(row.payment_status || 'pending').replace(/_/g, ' '),
    paymentMethod: String(row.payment_method || 'pay_at_pickup').replace(/_/g, ' '),
    totalAmount: String(currency) + ' ' + amount,
    extras: ticketExtras,
  });

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
        content: ticketText,
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
        content: ticketText,
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
      text: ticketText,
      html: ticketHtml,
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
      provider_name: 'Resend',
      provider_message_id: providerBody.id,
      sent_at: sentAt,
      failure_reason: null,
    })
    .eq('id', logRow!.id);

  if (updateError) throw updateError;
  const { error: statusError } = await client
    .from('communication_messages')
    .update({ status: 'sent' })
    .eq('id', logRow!.id)
    .eq('status', 'queued');
  if (statusError) throw statusError;

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
    console.info('[Booking Notification Worker] Not started: BOOKING_NOTIFICATION_WORKER_ENABLED is not explicitly true.');
    return () => undefined;
  }

  const apiKey = process.env.RESEND_API_KEY?.trim() || '';
  const fromEmail = normalizeSenderEmail(process.env.RESEND_FROM_EMAIL || '');
  const fromName = process.env.RESEND_FROM_NAME?.trim() || 'Awesome Adventure Tours';

  if (!apiKey || !isValidEmail(fromEmail)) {
    console.warn('[Booking Notification Worker] Not started: email configuration is incomplete.', {
      missingApiKey: !apiKey,
      invalidFromEmail: !isValidEmail(fromEmail),
    });
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
