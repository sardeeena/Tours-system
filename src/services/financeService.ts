import { supabase, isSupabaseConfigured, formatSupabaseError } from './supabaseClient';
import {
  FinancePayment,
  FinancePaymentMethod,
  FinancePaymentStatus,
  PaymentProvider,
  FinanceInvoice,
  InvoiceLineItem,
  FinanceRefund,
  RefundStatus,
  OutstandingBalanceItem,
  FinancialReportData,
  CompanyBillingDetails,
  CurrencyBreakdownItem,
} from '../types/finance';
import { bookingRepository } from './bookingRepository';
import { Booking } from '../types/booking';
import { recordActivity } from './crmService';
import { publishAutomationEvent } from './communicationService';

const LOCAL_PAYMENTS_KEY = 'rse_fin_payments';
const LOCAL_INVOICES_KEY = 'rse_fin_invoices';
const LOCAL_REFUNDS_KEY = 'rse_fin_refunds';
const LOCAL_PROVIDERS_KEY = 'rse_fin_providers';

export const COMPANY_DETAILS: CompanyBillingDetails = {
  // Brand identity only. Legal entity, tax, address, phone and bank details must be
  // entered by an authorized administrator before issuing legally complete invoices.
  name: 'Kemet Spirit',
  tagline: 'Tours and experiences',
  address: '',
  city: '',
  country: '',
  phone: '',
  email: '',
  website: 'kemetspirit.com',
  taxRegistrationNumber: '',
  commercialRegistryNumber: '',
  bankName: '',
  iban: '',
  swiftBic: '',
};

export const DEFAULT_PROVIDERS: PaymentProvider[] = [
  {
    id: 'cash',
    name: 'Cash payment',
    providerType: 'manual',
    isConnected: true,
    isManual: true,
    supportedCurrencies: ['EUR', 'USD', 'GBP', 'EGP'],
    description: 'Manual cash collection, recorded by authorized staff.',
  },
  {
    id: 'pos_terminal',
    name: 'Physical POS terminal',
    providerType: 'manual',
    isConnected: true,
    isManual: true,
    supportedCurrencies: ['EUR', 'USD', 'GBP', 'EGP'],
    description: 'Manual card-terminal settlement, verified by authorized staff.',
  },
  {
    id: 'bank_transfer',
    name: 'Bank transfer',
    providerType: 'bank_transfer',
    isConnected: true,
    isManual: true,
    supportedCurrencies: ['EUR', 'USD', 'GBP', 'EGP'],
    description: 'Manual bank-transfer reconciliation by authorized staff.',
  },
  {
    id: 'stripe',
    name: 'Stripe Payments',
    providerType: 'gateway',
    isConnected: false,
    isManual: false,
    supportedCurrencies: ['EUR', 'USD', 'GBP'],
    description: 'Online card processing is not configured.',
  },
  {
    id: 'paypal',
    name: 'PayPal Gateway',
    providerType: 'gateway',
    isConnected: false,
    isManual: false,
    supportedCurrencies: ['EUR', 'USD', 'GBP'],
    description: 'Online wallet processing is not configured.',
  },
];

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

const isDevelopmentBuild = Boolean(import.meta.env.DEV);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requireFinanceBackend(): boolean {
  if (isSupabaseConfigured()) return true;
  if (isDevelopmentBuild) return false;
  throw new Error('Finance services are not configured. Financial records are unavailable until the production Supabase connection is configured.');
}

function mapDbPayment(row: any): FinancePayment {
  return {
    id: row.id,
    bookingId: row.booking_id,
    bookingReference: row.booking_reference || '',
    customerId: row.customer_id || null,
    customerName: row.customer_name || 'Guest',
    customerEmail: row.customer_email || '',
    customerPhone: row.customer_phone || null,
    amount: Number(row.amount),
    currency: row.currency || 'EUR',
    paymentMethod: row.payment_method as FinancePaymentMethod,
    provider: row.provider || 'unknown',
    isManual: row.is_manual ?? true,
    paymentStatus: row.status as FinancePaymentStatus,
    paymentDate: row.payment_date,
    transactionReference: row.transaction_reference || '',
    notes: row.notes || null,
    recordedBy: row.recorded_by || 'Staff',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function isSettledPayment(payment: FinancePayment): boolean {
  return ['paid', 'partially paid', 'partially_paid'].includes(String(payment.paymentStatus).toLowerCase());
}

function mapDbRefund(row: any): FinanceRefund {
  const methodMap: Record<string, FinanceRefund['refundMethod']> = {
    'Credit Card': 'Card Reversal',
    Cash: 'Cash Return',
    'Credit Voucher': 'Store Credit / Voucher',
    'Original Payment Method': 'Other',
    'Card Reversal': 'Card Reversal',
    'Cash Return': 'Cash Return',
    'Bank Wire': 'Bank Wire',
    'Store Credit / Voucher': 'Store Credit / Voucher',
    Other: 'Other',
  };
  return {
    id: row.id,
    bookingId: row.booking_id,
    bookingReference: row.booking_reference || '',
    paymentId: row.payment_id || null,
    customerId: row.customer_id || null,
    customerName: row.customer_name || 'Guest',
    customerEmail: row.customer_email || '',
    amount: Number(row.amount),
    requestedAmount: Number(row.requested_amount ?? row.amount),
    approvedAmount: row.approved_amount != null ? Number(row.approved_amount) : null,
    currency: row.currency || 'EUR',
    reason: row.reason || '',
    status: (row.status || 'requested') as RefundStatus,
    requestedBy: row.requested_by || 'Staff',
    approvedBy: row.approved_by || null,
    processedDate: row.processed_date || null,
    refundMethod: methodMap[row.refund_method] || 'Other',
    transactionReference: row.transaction_reference || '',
    processedBy: row.processed_by || '',
    notes: row.notes || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ------------------------------------------------------------------------------
// PAYMENT PROVIDERS (Honest Integration Registry)
// ------------------------------------------------------------------------------

export async function listPaymentProviders(): Promise<PaymentProvider[]> {
  if (!requireFinanceBackend()) {
    return getLocal<PaymentProvider[]>(LOCAL_PROVIDERS_KEY, DEFAULT_PROVIDERS);
  }

  const { data, error } = await supabase
    .from('payment_providers')
    .select('id,name,provider_type,is_connected,is_manual,supported_currencies,description')
    .order('is_connected', { ascending: false });

  if (error) throw new Error(formatSupabaseError(error));

  const providers: PaymentProvider[] = (data || []).map((row: any) => ({
    id: row.id,
    name: row.name,
    providerType: row.provider_type,
    isConnected: Boolean(row.is_connected),
    isManual: Boolean(row.is_manual),
    supportedCurrencies: row.supported_currencies || [],
    description: row.description || '',
  }));

  setLocal(LOCAL_PROVIDERS_KEY, providers);
  return providers;
}

// ------------------------------------------------------------------------------
// 1. PAYMENTS LEDGER
// ------------------------------------------------------------------------------

export async function listPayments(filter?: {
  bookingId?: string;
  customerId?: string;
  status?: string;
  method?: string;
  provider?: string;
  currency?: string;
  search?: string;
}): Promise<FinancePayment[]> {
  let payments: FinancePayment[];

  if (!requireFinanceBackend()) {
    payments = getLocal<FinancePayment[]>(LOCAL_PAYMENTS_KEY, []);
  } else {
    const { data, error } = await supabase
      .from('payment_transactions')
      .select('*')
      .order('payment_date', { ascending: false });

    if (error) throw new Error(formatSupabaseError(error));
    payments = (data || []).map(mapDbPayment);
    setLocal(LOCAL_PAYMENTS_KEY, payments);
  }

  return payments.filter((payment) => {
    if (filter?.bookingId && payment.bookingId !== filter.bookingId && payment.bookingReference !== filter.bookingId) return false;
    if (filter?.customerId && payment.customerId !== filter.customerId) return false;
    if (filter?.status && filter.status !== 'all' && payment.paymentStatus.toLowerCase() !== filter.status.toLowerCase()) return false;
    if (filter?.method && filter.method !== 'all' && payment.paymentMethod !== filter.method) return false;
    if (filter?.provider && filter.provider !== 'all' && payment.provider !== filter.provider) return false;
    if (filter?.currency && filter.currency !== 'all' && payment.currency !== filter.currency) return false;
    if (filter?.search?.trim()) {
      const query = filter.search.toLowerCase();
      return (
        payment.bookingReference.toLowerCase().includes(query) ||
        payment.customerName.toLowerCase().includes(query) ||
        payment.customerEmail.toLowerCase().includes(query) ||
        payment.transactionReference.toLowerCase().includes(query) ||
        (payment.notes || '').toLowerCase().includes(query)
      );
    }
    return true;
  });
}

export async function recordPayment(paymentData: {
  bookingId: string;
  bookingReference: string;
  customerId?: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  amount: number;
  currency: string;
  paymentMethod: FinancePaymentMethod;
  provider?: string;
  isManual?: boolean;
  paymentStatus: FinancePaymentStatus;
  paymentDate?: string;
  transactionReference: string;
  notes?: string | null;
  recordedBy?: string;
}): Promise<FinancePayment> {
  if (!Number.isFinite(paymentData.amount) || paymentData.amount <= 0) {
    throw new Error('Payment amount must be a valid number greater than zero.');
  }

  const transactionReference = paymentData.transactionReference?.trim();
  if (!transactionReference || transactionReference.length < 3 || transactionReference.length > 160) {
    throw new Error('A valid transaction reference is required.');
  }

  const selectedProviderId = paymentData.provider || (paymentData.paymentMethod === 'Cash' ? 'cash' : 'pos_terminal');
  const providers = await listPaymentProviders();
  const provider = providers.find((item) => item.id === selectedProviderId);
  if (!provider || !provider.isConnected) {
    throw new Error('The selected payment provider is unavailable or disconnected.');
  }
  if (!provider.isManual) {
    throw new Error('Online payment gateway processing is not configured. Do not record a gateway payment manually.');
  }

  if (!requireFinanceBackend()) {
    const localPayment: FinancePayment = {
      id: `dev-pay-${crypto.randomUUID()}`,
      bookingId: paymentData.bookingId,
      bookingReference: paymentData.bookingReference,
      customerId: paymentData.customerId || null,
      customerName: paymentData.customerName,
      customerEmail: paymentData.customerEmail,
      customerPhone: paymentData.customerPhone || null,
      amount: Number(paymentData.amount),
      currency: paymentData.currency.toUpperCase(),
      paymentMethod: paymentData.paymentMethod,
      provider: selectedProviderId,
      isManual: true,
      paymentStatus: paymentData.paymentStatus,
      paymentDate: paymentData.paymentDate || new Date().toISOString(),
      transactionReference,
      notes: paymentData.notes || null,
      recordedBy: paymentData.recordedBy || 'Staff',
      createdAt: new Date().toISOString(),
    };
    const current = getLocal<FinancePayment[]>(LOCAL_PAYMENTS_KEY, []);
    setLocal(LOCAL_PAYMENTS_KEY, [localPayment, ...current]);
    return localPayment;
  }

  const idempotencyKey = `payment:${selectedProviderId}:${transactionReference.toLowerCase()}`;
  const { data, error } = await supabase.rpc('record_payment_atomic', {
    p_booking_reference: paymentData.bookingReference,
    p_amount: Number(paymentData.amount),
    p_currency: paymentData.currency.toUpperCase(),
    p_payment_method: paymentData.paymentMethod,
    p_provider: selectedProviderId,
    p_status: String(paymentData.paymentStatus),
    p_transaction_reference: transactionReference,
    p_notes: paymentData.notes || null,
    p_recorded_by: paymentData.recordedBy || 'Staff',
    p_idempotency_key: idempotencyKey,
  });

  if (error) throw new Error(formatSupabaseError(error));
  const result = data as any;
  if (!result?.success || !result?.payment?.id) {
    throw new Error('The database did not confirm that the payment was recorded.');
  }

  const savedPayment = mapDbPayment(result.payment);
  try {
    await recordActivity({
      customerId: savedPayment.customerId || undefined,
      bookingId: savedPayment.bookingId,
      eventType: 'payment_recorded',
      title: `Payment Received: ${savedPayment.currency} ${savedPayment.amount.toFixed(2)}`,
      description: `Payment recorded via ${savedPayment.paymentMethod} (${savedPayment.provider}). Reference: ${savedPayment.transactionReference}.`,
      actor: savedPayment.recordedBy,
      metadata: {
        paymentId: savedPayment.id,
        amount: savedPayment.amount,
        currency: savedPayment.currency,
        bookingReference: savedPayment.bookingReference,
        transactionReference: savedPayment.transactionReference,
      },
    });
  } catch {
    // The immutable database audit log is written by record_payment_atomic.
  }

  return savedPayment;
}

// 2. INVOICE GENERATION & MANAGEMENT
// ------------------------------------------------------------------------------

export async function listInvoices(filter?: {
  bookingId?: string;
  status?: string;
  search?: string;
}): Promise<FinanceInvoice[]> {
  let invoices: FinanceInvoice[];

  if (!requireFinanceBackend()) {
    invoices = getLocal<FinanceInvoice[]>(LOCAL_INVOICES_KEY, []);
  } else {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .order('issue_date', { ascending: false });

    if (error) throw new Error(formatSupabaseError(error));

    const bookingIds = Array.from(new Set((data || []).map((row: any) => row.booking_id).filter(Boolean)));
    const bookingDetails = new Map<string, {
      adults: number;
      children: number;
      infants: number;
      bookingReference: string;
      bookingDate: string;
      tourId: string;
    }>();
    const tourTitles = new Map<string, string>();

    if (bookingIds.length > 0) {
      const { data: bookingRows, error: bookingError } = await supabase
        .from('bookings')
        .select('id,booking_reference,booking_date,adult_count,child_count,infant_count,tour_id')
        .in('id', bookingIds);

      if (bookingError) throw new Error(formatSupabaseError(bookingError));
      (bookingRows || []).forEach((booking: any) => {
        bookingDetails.set(booking.id, {
          adults: Number(booking.adult_count || 0),
          children: Number(booking.child_count || 0),
          infants: Number(booking.infant_count || 0),
          bookingReference: booking.booking_reference || booking.id,
          bookingDate: booking.booking_date || '',
          tourId: booking.tour_id || '',
        });
      });

      const tourIds = Array.from(new Set((bookingRows || []).map((booking: any) => booking.tour_id).filter(Boolean)));
      if (tourIds.length > 0) {
        const { data: tours, error: toursError } = await supabase
          .from('tours')
          .select('id,title')
          .in('id', tourIds);
        if (toursError) throw new Error(formatSupabaseError(toursError));
        (tours || []).forEach((tour: any) => tourTitles.set(tour.id, tour.title || ''));
      }
    }

    invoices = (data || []).map((row: any) => ({
      id: row.id,
      invoiceNumber: row.invoice_number,
      bookingId: row.booking_id,
      bookingReference: row.booking_reference || bookingDetails.get(row.booking_id)?.bookingReference || row.booking_id,
      customerId: row.customer_id || null,
      issueDate: row.issue_date,
      dueDate: row.due_date,
      customer: {
        name: row.customer_name || 'Guest',
        email: row.customer_email || '',
        phone: row.customer_phone || null,
      },
      tourTitle: row.tour_title || tourTitles.get(bookingDetails.get(row.booking_id)?.tourId || '') || '',
      tourDate: row.tour_date || bookingDetails.get(row.booking_id)?.bookingDate || '',
      guests: bookingDetails.get(row.booking_id) || { adults: 0, children: 0, infants: 0, bookingReference: row.booking_id, bookingDate: '', tourId: '' },
      lineItems: (row.line_items as InvoiceLineItem[]) || [],
      subtotal: Number(row.subtotal || 0),
      discount: Number(row.discount || 0),
      taxRatePercent: Number(row.subtotal) > 0 ? (Number(row.tax_amount || 0) / Number(row.subtotal)) * 100 : 0,
      taxAmount: Number(row.tax_amount || 0),
      total: Number(row.total || 0),
      paid: Number(row.paid || 0),
      balance: Number(row.balance || 0),
      currency: row.currency || 'EUR',
      status: row.status,
      companyDetails: (row.company_details as CompanyBillingDetails) || COMPANY_DETAILS,
      notes: row.notes || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
    setLocal(LOCAL_INVOICES_KEY, invoices);
  }

  return invoices.filter((invoice) => {
    if (filter?.bookingId && invoice.bookingId !== filter.bookingId && invoice.bookingReference !== filter.bookingId) return false;
    if (filter?.status && filter.status !== 'all' && invoice.status !== filter.status) return false;
    if (filter?.search?.trim()) {
      const query = filter.search.toLowerCase();
      return (
        invoice.invoiceNumber.toLowerCase().includes(query) ||
        invoice.bookingReference.toLowerCase().includes(query) ||
        invoice.customer.name.toLowerCase().includes(query) ||
        invoice.customer.email.toLowerCase().includes(query) ||
        invoice.tourTitle.toLowerCase().includes(query)
      );
    }
    return true;
  });
}

export async function generateInvoiceForBooking(bookingReference: string): Promise<FinanceInvoice | null> {
  const bookings = await bookingRepository.listBookings();
  const booking = bookings.find((item) => item.bookingReference === bookingReference);
  if (!booking) return null;

  if (!requireFinanceBackend()) {
    const existing = getLocal<FinanceInvoice[]>(LOCAL_INVOICES_KEY, []);
    const duplicate = existing.find((invoice) => invoice.bookingReference === bookingReference);
    if (duplicate) return duplicate;

    const devInvoice: FinanceInvoice = {
      id: `dev-inv-${crypto.randomUUID()}`,
      invoiceNumber: `INV-DEV-${Date.now().toString(36).toUpperCase()}`,
      bookingId: booking.bookingId || booking.bookingReference,
      bookingReference,
      customerId: (booking as any).customerId || null,
      issueDate: new Date().toISOString().slice(0, 10),
      dueDate: booking.date ? booking.date.split('T')[0] : new Date().toISOString().slice(0, 10),
      customer: {
        name: `${booking.customer.firstName} ${booking.customer.lastName}`,
        email: booking.customer.email,
        phone: booking.customer.phoneNumber || null,
      },
      tourTitle: booking.tourTitle,
      tourDate: booking.date,
      guests: booking.guests,
      lineItems: [],
      subtotal: booking.pricing?.subtotalEur || booking.pricing?.totalEur || 0,
      discount: booking.pricing?.discountEur || 0,
      taxRatePercent: 0,
      taxAmount: 0,
      total: booking.pricing?.totalEur || 0,
      paid: 0,
      balance: booking.pricing?.totalEur || 0,
      currency: 'EUR',
      status: 'draft',
      companyDetails: COMPANY_DETAILS,
      notes: 'Development preview only. Not a valid tax invoice.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setLocal(LOCAL_INVOICES_KEY, [devInvoice, ...existing]);
    return devInvoice;
  }

  if (!UUID_PATTERN.test(booking.bookingId || '')) {
    throw new Error('The selected booking does not have a valid database identifier. Invoice generation was stopped.');
  }

  const { data: bookingRow, error: bookingError } = await supabase
    .from('bookings')
    .select('id,booking_reference,customer_id,booking_date,adult_count,child_count,infant_count,subtotal,extras_total,discount,total,currency')
    .eq('id', booking.bookingId)
    .single();

  if (bookingError || !bookingRow) {
    throw new Error(bookingError ? formatSupabaseError(bookingError) : 'Booking record could not be verified.');
  }

  const { data: existingRow, error: existingError } = await supabase
    .from('invoices')
    .select('*')
    .eq('booking_id', bookingRow.id)
    .maybeSingle();

  if (existingError) throw new Error(formatSupabaseError(existingError));
  if (existingRow) {
    const all = await listInvoices();
    return all.find((invoice) => invoice.id === existingRow.id) || null;
  }

  const currency = String(bookingRow.currency || 'EUR').toUpperCase();
  const payments = await listPayments({ bookingId: bookingReference });
  const paidAmount = payments
    .filter((payment) => payment.currency === currency && isSettledPayment(payment))
    .reduce((sum, payment) => sum + payment.amount, 0);

  const subtotal = Number(bookingRow.subtotal || 0);
  const extrasTotal = Number(bookingRow.extras_total || 0);
  const discount = Number(bookingRow.discount || 0);
  const total = Number(bookingRow.total || 0);
  const balance = Math.max(0, total - paidAmount);
  const lineItems: InvoiceLineItem[] = [];

  if (subtotal > 0) {
    lineItems.push({
      id: `line-${bookingReference}-tour`,
      description: `${booking.tourTitle} - tour services`,
      quantity: 1,
      unitPrice: subtotal,
      total: subtotal,
      type: 'tour',
    });
  }
  if (extrasTotal > 0) {
    lineItems.push({
      id: `line-${bookingReference}-extras`,
      description: 'Selected extras and add-ons',
      quantity: 1,
      unitPrice: extrasTotal,
      total: extrasTotal,
      type: 'extra',
    });
  }
  if (discount > 0) {
    lineItems.push({
      id: `line-${bookingReference}-discount`,
      description: 'Booking discount',
      quantity: 1,
      unitPrice: -discount,
      total: -discount,
      type: 'discount',
    });
  }

  const { data: invoiceNumber, error: numberError } = await supabase.rpc('next_invoice_number');
  if (numberError || !invoiceNumber) {
    throw new Error(numberError ? formatSupabaseError(numberError) : 'The database did not allocate an invoice number.');
  }

  const billingDetailsComplete = Boolean(
    COMPANY_DETAILS.name.trim() &&
    COMPANY_DETAILS.address.trim() &&
    COMPANY_DETAILS.country.trim() &&
    COMPANY_DETAILS.taxRegistrationNumber.trim()
  );

  const newInvoice: FinanceInvoice = {
    id: '',
    invoiceNumber: String(invoiceNumber),
    bookingId: bookingRow.id,
    bookingReference,
    customerId: bookingRow.customer_id || null,
    issueDate: new Date().toISOString().slice(0, 10),
    dueDate: bookingRow.booking_date || new Date().toISOString().slice(0, 10),
    customer: {
      name: `${booking.customer.firstName} ${booking.customer.lastName}`,
      email: booking.customer.email,
      phone: booking.customer.phoneNumber || null,
    },
    tourTitle: booking.tourTitle,
    tourDate: bookingRow.booking_date || '',
    guests: {
      adults: Number(bookingRow.adult_count || 0),
      children: Number(bookingRow.child_count || 0),
      infants: Number(bookingRow.infant_count || 0),
    },
    lineItems,
    subtotal,
    discount,
    taxRatePercent: 0,
    taxAmount: 0,
    total,
    paid: paidAmount,
    balance,
    currency,
    status: billingDetailsComplete
      ? (balance <= 0 ? 'paid' : paidAmount > 0 ? 'partially_paid' : 'issued')
      : 'draft',
    companyDetails: COMPANY_DETAILS,
    notes: billingDetailsComplete
      ? null
      : 'Draft only. Configure the legal entity name, registered address, country and tax registration details before issuing this invoice.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const { data: inserted, error: insertError } = await supabase
    .from('invoices')
    .insert({
      invoice_number: newInvoice.invoiceNumber,
      booking_id: newInvoice.bookingId,
      customer_id: newInvoice.customerId,
      customer_name: newInvoice.customer.name,
      customer_email: newInvoice.customer.email,
      customer_phone: newInvoice.customer.phone,
      tour_title: newInvoice.tourTitle,
      tour_date: newInvoice.tourDate || null,
      issue_date: newInvoice.issueDate,
      due_date: newInvoice.dueDate,
      subtotal: newInvoice.subtotal,
      discount: newInvoice.discount,
      tax_amount: newInvoice.taxAmount,
      total: newInvoice.total,
      paid: newInvoice.paid,
      balance: newInvoice.balance,
      currency: newInvoice.currency,
      status: newInvoice.status,
      line_items: newInvoice.lineItems,
      company_details: newInvoice.companyDetails,
      notes: newInvoice.notes,
    })
    .select('*')
    .single();

  if (insertError) {
    // A concurrent request may have won the one-invoice-per-booking race.
    if (insertError.code === '23505') {
      const { data: winner, error: winnerError } = await supabase
        .from('invoices')
        .select('*')
        .eq('booking_id', bookingRow.id)
        .maybeSingle();
      if (winnerError) throw new Error(formatSupabaseError(winnerError));
      if (winner) {
        const all = await listInvoices();
        return all.find((invoice) => invoice.id === winner.id) || null;
      }
    }
    throw new Error(formatSupabaseError(insertError));
  }

  if (!inserted?.id) throw new Error('The database did not confirm invoice creation.');
  newInvoice.id = inserted.id;
  const current = await listInvoices();
  setLocal(LOCAL_INVOICES_KEY, [newInvoice, ...current]);
  return newInvoice;
}

// 3. CONTROLLED REFUND MANAGEMENT (Immutable Audit Trail)
// ------------------------------------------------------------------------------

export async function listRefunds(filter?: {
  bookingId?: string;
  status?: string;
  search?: string;
}): Promise<FinanceRefund[]> {
  let refunds: FinanceRefund[];

  if (!requireFinanceBackend()) {
    refunds = getLocal<FinanceRefund[]>(LOCAL_REFUNDS_KEY, []);
  } else {
    const { data, error } = await supabase
      .from('refund_records')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw new Error(formatSupabaseError(error));
    refunds = (data || []).map(mapDbRefund);
    setLocal(LOCAL_REFUNDS_KEY, refunds);
  }

  return refunds.filter((refund) => {
    if (filter?.bookingId && refund.bookingId !== filter.bookingId && refund.bookingReference !== filter.bookingId) return false;
    if (filter?.status && filter.status !== 'all' && refund.status !== filter.status) return false;
    if (filter?.search?.trim()) {
      const query = filter.search.toLowerCase();
      return (
        refund.bookingReference.toLowerCase().includes(query) ||
        refund.customerName.toLowerCase().includes(query) ||
        refund.reason.toLowerCase().includes(query) ||
        refund.transactionReference.toLowerCase().includes(query)
      );
    }
    return true;
  });
}

export async function requestRefund(refundData: {
  bookingId: string;
  bookingReference: string;
  paymentId?: string | null;
  customerId?: string | null;
  customerName: string;
  customerEmail: string;
  requestedAmount: number;
  currency: string;
  reason: string;
  refundMethod: FinanceRefund['refundMethod'];
  requestedBy: string;
  notes?: string | null;
}): Promise<{ success: boolean; error?: string; refund?: FinanceRefund }> {
  if (!Number.isFinite(refundData.requestedAmount) || refundData.requestedAmount <= 0) {
    return { success: false, error: 'Refund amount must be a valid number greater than zero.' };
  }
  if (!refundData.bookingReference?.trim() || !refundData.reason?.trim()) {
    return { success: false, error: 'A booking reference and refund reason are required.' };
  }

  if (!requireFinanceBackend()) {
    const payments = await listPayments({ bookingId: refundData.bookingReference });
    const totalPaid = payments.filter(isSettledPayment).reduce((sum, payment) => sum + payment.amount, 0);
    const existingRefunds = await listRefunds({ bookingId: refundData.bookingReference });
    const committed = existingRefunds
      .filter((refund) => ['pending_approval', 'approved', 'processed'].includes(refund.status))
      .reduce((sum, refund) => sum + (refund.approvedAmount || refund.requestedAmount || refund.amount), 0);
    if (refundData.requestedAmount > Math.max(0, totalPaid - committed)) {
      return { success: false, error: 'Refund exceeds the remaining refundable balance.' };
    }
    const now = new Date().toISOString();
    const localRefund: FinanceRefund = {
      id: `dev-ref-${crypto.randomUUID()}`,
      bookingId: refundData.bookingId,
      bookingReference: refundData.bookingReference,
      paymentId: refundData.paymentId || null,
      customerId: refundData.customerId || null,
      customerName: refundData.customerName,
      customerEmail: refundData.customerEmail,
      amount: refundData.requestedAmount,
      requestedAmount: refundData.requestedAmount,
      approvedAmount: null,
      currency: refundData.currency,
      reason: refundData.reason.trim(),
      status: 'pending_approval',
      requestedBy: refundData.requestedBy,
      approvedBy: null,
      processedDate: null,
      refundMethod: refundData.refundMethod,
      transactionReference: `DEV-REF-${crypto.randomUUID()}`,
      processedBy: '',
      notes: refundData.notes || null,
      createdAt: now,
      updatedAt: now,
    };
    const current = getLocal<FinanceRefund[]>(LOCAL_REFUNDS_KEY, []);
    setLocal(LOCAL_REFUNDS_KEY, [localRefund, ...current]);
    return { success: true, refund: localRefund };
  }

  const idempotencyKey = `refund:${refundData.bookingReference.trim().toUpperCase()}:${refundData.requestedAmount.toFixed(2)}:${refundData.reason.trim().toLowerCase().slice(0, 90)}`;
  const { data, error } = await supabase.rpc('request_refund_atomic', {
    p_booking_reference: refundData.bookingReference,
    p_payment_id: refundData.paymentId && UUID_PATTERN.test(refundData.paymentId) ? refundData.paymentId : null,
    p_requested_amount: Number(refundData.requestedAmount),
    p_currency: refundData.currency.toUpperCase(),
    p_reason: refundData.reason.trim(),
    p_refund_method: refundData.refundMethod,
    p_requested_by: refundData.requestedBy || 'Staff',
    p_notes: refundData.notes || null,
    p_idempotency_key: idempotencyKey,
  });

  if (error) return { success: false, error: formatSupabaseError(error) };
  const result = data as any;
  if (!result?.success || !result?.refund?.id) {
    return { success: false, error: 'The database did not confirm the refund request.' };
  }
  return { success: true, refund: mapDbRefund(result.refund) };
}

export async function approveRefund(
  refundId: string,
  approvedAmount: number,
  approvedBy: string = 'Finance Manager'
): Promise<{ success: boolean; error?: string; refund?: FinanceRefund }> {
  if (!Number.isFinite(approvedAmount) || approvedAmount <= 0) {
    return { success: false, error: 'Approved amount must be greater than zero.' };
  }

  const current = await listRefunds();
  const target = current.find((refund) => refund.id === refundId);
  if (!target) return { success: false, error: 'Refund record not found.' };
  if (target.status !== 'pending_approval') {
    return { success: false, error: 'Only pending refund requests can be approved.' };
  }
  if (approvedAmount > target.requestedAmount) {
    return { success: false, error: 'Approved amount cannot exceed the requested amount.' };
  }

  if (!requireFinanceBackend()) {
    const updated = {
      ...target,
      approvedAmount,
      amount: approvedAmount,
      status: 'approved' as RefundStatus,
      approvedBy,
      updatedAt: new Date().toISOString(),
    };
    setLocal(LOCAL_REFUNDS_KEY, current.map((refund) => refund.id === refundId ? updated : refund));
    return { success: true, refund: updated };
  }

  if (!UUID_PATTERN.test(refundId)) return { success: false, error: 'Invalid refund database identifier.' };
  const { data, error } = await supabase.rpc('transition_refund_atomic', {
    p_refund_id: refundId,
    p_action: 'approve',
    p_amount: approvedAmount,
    p_actor: approvedBy,
    p_reason: null,
    p_transaction_reference: null,
  });
  if (error) return { success: false, error: formatSupabaseError(error) };
  const result = data as any;
  if (!result?.success || !result?.refund?.id) {
    return { success: false, error: 'The database did not confirm refund approval.' };
  }
  return { success: true, refund: mapDbRefund(result.refund) };
}

export async function processRefund(
  refundId: string,
  processedBy: string = 'Finance Auditor',
  transactionReference?: string
): Promise<{ success: boolean; error?: string; refund?: FinanceRefund }> {
  const current = await listRefunds();
  const target = current.find((refund) => refund.id === refundId);
  if (!target) return { success: false, error: 'Refund record not found.' };
  if (target.status !== 'approved') {
    return { success: false, error: 'Only an approved refund can be disbursed.' };
  }

  const txRef = transactionReference?.trim();
  if (!txRef || txRef.length < 3 || txRef.length > 160) {
    return { success: false, error: 'A valid payout transaction reference is required.' };
  }

  if (!requireFinanceBackend()) {
    const updated = {
      ...target,
      status: 'processed' as RefundStatus,
      processedDate: new Date().toISOString(),
      processedBy,
      amount: target.approvedAmount || target.requestedAmount,
      transactionReference: txRef,
      updatedAt: new Date().toISOString(),
    };
    setLocal(LOCAL_REFUNDS_KEY, current.map((refund) => refund.id === refundId ? updated : refund));
    return { success: true, refund: updated };
  }

  if (!UUID_PATTERN.test(refundId)) return { success: false, error: 'Invalid refund database identifier.' };
  const { data, error } = await supabase.rpc('transition_refund_atomic', {
    p_refund_id: refundId,
    p_action: 'process',
    p_amount: null,
    p_actor: processedBy,
    p_reason: null,
    p_transaction_reference: txRef,
  });
  if (error) return { success: false, error: formatSupabaseError(error) };
  const result = data as any;
  if (!result?.success || !result?.refund?.id) {
    return { success: false, error: 'The database did not confirm refund disbursement.' };
  }
  return { success: true, refund: mapDbRefund(result.refund) };
}

export async function rejectRefund(
  refundId: string,
  rejectedBy: string = 'Finance Manager',
  reason?: string
): Promise<{ success: boolean; error?: string; refund?: FinanceRefund }> {
  const current = await listRefunds();
  const target = current.find((refund) => refund.id === refundId);
  if (!target) return { success: false, error: 'Refund record not found.' };
  if (target.status !== 'pending_approval') {
    return { success: false, error: 'Only pending refund requests can be rejected.' };
  }
  if (!reason?.trim()) return { success: false, error: 'A rejection reason is required.' };

  if (!requireFinanceBackend()) {
    const updated = {
      ...target,
      status: 'rejected' as RefundStatus,
      notes: [target.notes, `Rejected by ${rejectedBy}: ${reason.trim()}`].filter(Boolean).join('\n'),
      updatedAt: new Date().toISOString(),
    };
    setLocal(LOCAL_REFUNDS_KEY, current.map((refund) => refund.id === refundId ? updated : refund));
    return { success: true, refund: updated };
  }

  if (!UUID_PATTERN.test(refundId)) return { success: false, error: 'Invalid refund database identifier.' };
  const { data, error } = await supabase.rpc('transition_refund_atomic', {
    p_refund_id: refundId,
    p_action: 'reject',
    p_amount: null,
    p_actor: rejectedBy,
    p_reason: reason.trim(),
    p_transaction_reference: null,
  });
  if (error) return { success: false, error: formatSupabaseError(error) };
  const result = data as any;
  if (!result?.success || !result?.refund?.id) {
    return { success: false, error: 'The database did not confirm refund rejection.' };
  }
  return { success: true, refund: mapDbRefund(result.refund) };
}

// 4. OUTSTANDING BALANCES TRACKING (Real Calculations, Never Trust Frontend)
// ------------------------------------------------------------------------------

export async function getOutstandingBalances(filter?: {
  status?: string;
  currency?: string;
  search?: string;
}): Promise<OutstandingBalanceItem[]> {
  const bookings = await bookingRepository.listBookings();
  const payments = await listPayments();
  const refunds = await listRefunds();
  const todayStr = new Date().toISOString().split('T')[0];
  const items: OutstandingBalanceItem[] = [];

  bookings.forEach((booking) => {
    // Cancelled bookings are not trade receivables. Any refund due is tracked separately.
    if (booking.status === 'cancelled') return;

    const bookingTotal = Number(booking.pricing?.totalEur || 0);
    const currency = String(booking.pricing?.currency || 'EUR').toUpperCase();
    const bookingPayments = payments.filter(
      (payment) =>
        payment.currency === currency &&
        (payment.bookingReference === booking.bookingReference || payment.bookingId === booking.bookingId) &&
        isSettledPayment(payment)
    );
    const paidAmount = bookingPayments.reduce((sum, payment) => sum + payment.amount, 0);

    const bookingRefunds = refunds.filter(
      (refund) =>
        refund.currency === currency &&
        (refund.bookingReference === booking.bookingReference || refund.bookingId === booking.bookingId) &&
        refund.status === 'processed'
    );
    const refundAmount = bookingRefunds.reduce((sum, refund) => sum + (refund.approvedAmount || refund.amount), 0);
    const netPaid = Math.max(0, paidAmount - refundAmount);
    const balanceAmount = Math.max(0, bookingTotal - netPaid);

    if (balanceAmount <= 0) return;

    const tourDate = booking.date ? booking.date.split('T')[0] : '';
    let status: OutstandingBalanceItem['status'] = 'upcoming';
    if (tourDate && tourDate < todayStr) status = 'overdue';
    else if (tourDate === todayStr) status = 'due_today';

    items.push({
      bookingId: booking.bookingId || booking.bookingReference,
      bookingReference: booking.bookingReference,
      customerId: booking.customerId || null,
      customerName: `${booking.customer.firstName} ${booking.customer.lastName}`,
      customerEmail: booking.customer.email,
      customerPhone: booking.customer.phoneNumber
        ? `${booking.customer.countryCode || ''} ${booking.customer.phoneNumber}`
        : null,
      hotel: booking.pickup.hotelName || booking.customer.hotelName || 'Direct Arrival',
      tourTitle: booking.tourTitle,
      tourDate: booking.date,
      totalAmount: bookingTotal,
      bookingTotal,
      paidAmount,
      amountPaid: paidAmount,
      refundAmount,
      balanceAmount,
      amountDue: balanceAmount,
      currency,
      dueDate: booking.date,
      status,
      paymentStatus: netPaid >= bookingTotal ? 'Paid' : netPaid > 0 ? 'Partially Paid' : 'Pending',
    });
  });

  return items
    .filter((item) => {
      if (filter?.status && filter.status !== 'all' && item.status !== filter.status) return false;
      if (filter?.currency && filter.currency !== 'all' && item.currency !== filter.currency) return false;
      if (filter?.search?.trim()) {
        const query = filter.search.toLowerCase();
        return (
          item.bookingReference.toLowerCase().includes(query) ||
          item.customerName.toLowerCase().includes(query) ||
          item.customerEmail.toLowerCase().includes(query) ||
          item.tourTitle.toLowerCase().includes(query) ||
          (item.hotel && item.hotel.toLowerCase().includes(query))
        );
      }
      return true;
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

// 5. FINANCIAL REPORTS & REVENUE ANALYTICS (Real Database Aggregation)
// ------------------------------------------------------------------------------

export async function getFinancialReports(
  targetCurrency: string = 'EUR',
  dateRange?: { start?: string; end?: string }
): Promise<FinancialReportData> {
  const bookings = await bookingRepository.listBookings();
  const payments = await listPayments();
  const refunds = await listRefunds();

  // Filter bookings strictly matching targetCurrency
  const currencyBookings = bookings.filter((b) => {
    const cur = String(b.pricing?.currency || 'EUR').toUpperCase();
    if (cur !== targetCurrency.toUpperCase()) return false;
    if (b.status === 'cancelled') return false;
    const bDate = b.date ? b.date.split('T')[0] : '';
    if (dateRange?.start && bDate < dateRange.start) return false;
    if (dateRange?.end && bDate > dateRange.end) return false;
    return true;
  });

  const currencyPayments = payments.filter((p) => {
    if (p.currency !== targetCurrency.toUpperCase()) return false;
    if (!isSettledPayment(p)) return false;
    const pDate = p.paymentDate.split('T')[0];
    if (dateRange?.start && pDate < dateRange.start) return false;
    if (dateRange?.end && pDate > dateRange.end) return false;
    return true;
  });

  const currencyRefunds = refunds.filter((r) => {
    if (r.currency !== targetCurrency) return false;
    if (r.status !== 'processed') return false; // Only processed refunds count towards ledger totals
    const rDate = (r.processedDate || r.createdAt).split('T')[0];
    if (dateRange?.start && rDate < dateRange.start) return false;
    if (dateRange?.end && rDate > dateRange.end) return false;
    return true;
  });

  // Calculate Totals
  const totalRevenue = currencyBookings.reduce((sum, b) => sum + (b.pricing?.totalEur || 0), 0);
  const totalPaid = currencyPayments.reduce((sum, p) => sum + p.amount, 0);
  const totalRefunded = currencyRefunds.reduce((sum, r) => sum + (r.approvedAmount || r.amount), 0);
  const totalDiscounts = currencyBookings.reduce((sum, b) => sum + (b.pricing?.discountEur || 0), 0);
  const totalOutstanding = currencyBookings.reduce((sum, booking) => {
    const bookingPayments = currencyPayments.filter(
      (payment) => payment.bookingReference === booking.bookingReference || payment.bookingId === booking.bookingId
    );
    const bookingRefunds = currencyRefunds.filter(
      (refund) => refund.bookingReference === booking.bookingReference || refund.bookingId === booking.bookingId
    );
    const netPaid = Math.max(
      0,
      bookingPayments.reduce((paid, payment) => paid + payment.amount, 0) -
        bookingRefunds.reduce((refunded, refund) => refunded + (refund.approvedAmount || refund.amount), 0)
    );
    return sum + Math.max(0, (booking.pricing?.totalEur || 0) - netPaid);
  }, 0);

  // Revenue by Date
  const dateMap = new Map<string, { amount: number; bookingsCount: number }>();
  currencyBookings.forEach((b) => {
    const d = b.date ? b.date.split('T')[0] : 'Undated';
    const current = dateMap.get(d) || { amount: 0, bookingsCount: 0 };
    current.amount += b.pricing?.totalEur || 0;
    current.bookingsCount += 1;
    dateMap.set(d, current);
  });

  const revenueByDate = Array.from(dateMap.entries())
    .map(([date, data]) => ({ date, amount: data.amount, bookingsCount: data.bookingsCount }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Revenue by Month
  const monthMap = new Map<string, { amount: number; bookingsCount: number }>();
  currencyBookings.forEach((b) => {
    const m = b.date ? b.date.substring(0, 7) : 'Unknown';
    const current = monthMap.get(m) || { amount: 0, bookingsCount: 0 };
    current.amount += b.pricing?.totalEur || 0;
    current.bookingsCount += 1;
    monthMap.set(m, current);
  });

  const revenueByMonth = Array.from(monthMap.entries())
    .map(([month, data]) => ({ month, amount: data.amount, bookingsCount: data.bookingsCount }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // Revenue by Tour
  const tourMap = new Map<string, { tourTitle: string; amount: number; bookingsCount: number }>();
  currencyBookings.forEach((b) => {
    const current = tourMap.get(b.tourId) || { tourTitle: b.tourTitle, amount: 0, bookingsCount: 0 };
    current.amount += b.pricing?.totalEur || 0;
    current.bookingsCount += 1;
    tourMap.set(b.tourId, current);
  });

  const revenueByTour = Array.from(tourMap.entries())
    .map(([tourId, data]) => ({
      tourId,
      tourTitle: data.tourTitle,
      amount: data.amount,
      bookingsCount: data.bookingsCount,
    }))
    .sort((a, b) => b.amount - a.amount);

  // Revenue by Destination
  const destMap = new Map<string, { amount: number; bookingsCount: number }>();
  currencyBookings.forEach((b) => {
    const dest = b.tourDestination || 'Hurghada';
    const current = destMap.get(dest) || { amount: 0, bookingsCount: 0 };
    current.amount += b.pricing?.totalEur || 0;
    current.bookingsCount += 1;
    destMap.set(dest, current);
  });

  const revenueByDestination = Array.from(destMap.entries())
    .map(([destination, data]) => ({
      destination,
      amount: data.amount,
      bookingsCount: data.bookingsCount,
    }))
    .sort((a, b) => b.amount - a.amount);

  // Payments Received by Method
  const methodMap = new Map<string, { amount: number; transactionsCount: number }>();
  currencyPayments.forEach((p) => {
    const m = p.paymentMethod;
    const current = methodMap.get(m) || { amount: 0, transactionsCount: 0 };
    current.amount += p.amount;
    current.transactionsCount += 1;
    methodMap.set(m, current);
  });

  const paymentsReceivedByMethod = Array.from(methodMap.entries())
    .map(([method, data]) => ({
      method,
      amount: data.amount,
      transactionsCount: data.transactionsCount,
    }))
    .sort((a, b) => b.amount - a.amount);

  // Full Multi-Currency Breakdown
  const supportedCurrencies = ['EUR', 'USD', 'GBP', 'EGP'];
  const currencyBreakdown: CurrencyBreakdownItem[] = supportedCurrencies.map((cur) => {
    const cBookings = bookings.filter(
      (booking) => String(booking.pricing?.currency || 'EUR').toUpperCase() === cur && booking.status !== 'cancelled'
    );
    const cPayments = payments.filter((payment) => payment.currency === cur && isSettledPayment(payment));
    const cRefunds = refunds.filter((refund) => refund.currency === cur && refund.status === 'processed');

    const gross = cBookings.reduce((sum, booking) => sum + (booking.pricing?.totalEur || 0), 0);
    const collected = cPayments.reduce((sum, payment) => sum + payment.amount, 0);
    const ref = cRefunds.reduce((sum, refund) => sum + (refund.approvedAmount || refund.amount), 0);
    const net = Math.max(0, collected - ref);
    const out = cBookings.reduce((sum, booking) => {
      const bookingPaid = cPayments
        .filter((payment) => payment.bookingReference === booking.bookingReference || payment.bookingId === booking.bookingId)
        .reduce((paid, payment) => paid + payment.amount, 0);
      const bookingRefunded = cRefunds
        .filter((refund) => refund.bookingReference === booking.bookingReference || refund.bookingId === booking.bookingId)
        .reduce((refunded, refund) => refunded + (refund.approvedAmount || refund.amount), 0);
      return sum + Math.max(0, (booking.pricing?.totalEur || 0) - Math.max(0, bookingPaid - bookingRefunded));
    }, 0);

    return {
      currency: cur,
      grossBookings: gross,
      collectedPayments: collected,
      refunds: ref,
      netRevenue: net,
      outstandingBalances: out,
    };
  });

  return {
    currency: targetCurrency,
    totals: {
      totalRevenue,
      totalPaid,
      totalOutstanding,
      totalRefunded,
      totalDiscounts,
      transactionsCount: currencyPayments.length,
      bookingsCount: currencyBookings.length,
    },
    revenueByDate,
    revenueByMonth,
    revenueByTour,
    revenueByDestination,
    paymentsReceivedByMethod,
    currencyBreakdown,
    refundsList: refunds,
  };
}
