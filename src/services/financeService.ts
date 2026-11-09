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
  name: 'Red Sea Voyages S.A.E.',
  tagline: 'Premier Marine Excursions & Desert Expeditions',
  address: 'Hurghada Marina Boulevard, Pier 3, Unit 14B',
  city: 'Hurghada, Red Sea Governorate',
  country: 'Arab Republic of Egypt',
  phone: '+20 100 456 7890',
  email: 'finance@awesomeadventure.tours',
  website: 'awesomeadventure.tours',
  taxRegistrationNumber: 'EG-TAX-489-102-881',
  commercialRegistryNumber: 'CR-92841-HUR',
  bankName: 'Commercial International Bank (CIB Egypt) - Hurghada Marina Branch',
  iban: 'EG4200100014000001099238472',
  swiftBic: 'CIBEEGCX',
};

export const DEFAULT_PROVIDERS: PaymentProvider[] = [
  {
    id: 'cash',
    name: 'Marina Office Cash Desk',
    providerType: 'manual',
    isConnected: true,
    isManual: true,
    supportedCurrencies: ['EUR', 'USD', 'GBP', 'EGP'],
    description: 'In-person physical cash collection at Hurghada Marina pier or hotel pickup.',
  },
  {
    id: 'pos_terminal',
    name: 'Pier Mobile POS Terminal',
    providerType: 'manual',
    isConnected: true,
    isManual: true,
    supportedCurrencies: ['EUR', 'USD', 'GBP', 'EGP'],
    description: 'Physical chip & PIN / contactless terminal managed by pier desk supervisor.',
  },
  {
    id: 'bank_transfer',
    name: 'CIB Bank Official Wire',
    providerType: 'bank_transfer',
    isConnected: true,
    isManual: true,
    supportedCurrencies: ['EUR', 'USD', 'GBP', 'EGP'],
    description: 'Direct wire transfer to Commercial International Bank (Egypt) account.',
  },
  {
    id: 'stripe',
    name: 'Stripe Payments',
    providerType: 'gateway',
    isConnected: false,
    isManual: false,
    supportedCurrencies: ['EUR', 'USD', 'GBP'],
    description: 'Online card processing. Currently disconnected (No server-side Stripe secret key configured).',
  },
  {
    id: 'paypal',
    name: 'PayPal Gateway',
    providerType: 'gateway',
    isConnected: false,
    isManual: false,
    supportedCurrencies: ['EUR', 'USD', 'GBP'],
    description: 'Digital wallet gateway. Currently disconnected (PayPal client ID not configured).',
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

// ------------------------------------------------------------------------------
// PAYMENT PROVIDERS (Honest Integration Registry)
// ------------------------------------------------------------------------------

export async function listPaymentProviders(): Promise<PaymentProvider[]> {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('payment_providers')
        .select('*')
        .order('is_connected', { ascending: false });

      if (!error && data && data.length > 0) {
        const mapped: PaymentProvider[] = data.map((d: any) => ({
          id: d.id,
          name: d.name,
          providerType: d.provider_type,
          isConnected: d.is_connected,
          isManual: d.is_manual,
          supportedCurrencies: d.supported_currencies || ['EUR', 'USD', 'GBP', 'EGP'],
          description: d.description || '',
        }));
        setLocal(LOCAL_PROVIDERS_KEY, mapped);
        return mapped;
      }
    } catch {
      // ignore
    }
  }

  return getLocal<PaymentProvider[]>(LOCAL_PROVIDERS_KEY, DEFAULT_PROVIDERS);
}

// ------------------------------------------------------------------------------
// 1. PAYMENTS LEDGER
// ------------------------------------------------------------------------------

async function ensureSeedPayments(): Promise<FinancePayment[]> {
  const current = getLocal<FinancePayment[]>(LOCAL_PAYMENTS_KEY, []);
  if (current.length > 0) return current;

  const bookings = await bookingRepository.listBookings();
  const generated: FinancePayment[] = [];

  bookings.forEach((b) => {
    const total = b.pricing?.totalEur || 0;
    if (b.paymentStatus === 'paid') {
      generated.push({
        id: `pay-${b.bookingReference}-01`,
        bookingId: b.bookingId || b.bookingReference,
        bookingReference: b.bookingReference,
        customerId: (b as any).customerId || null,
        customerName: `${b.customer.firstName} ${b.customer.lastName}`,
        customerEmail: b.customer.email,
        customerPhone: b.customer.phoneNumber
          ? `${b.customer.countryCode || ''} ${b.customer.phoneNumber}`
          : null,
        amount: total,
        currency: 'EUR',
        paymentMethod: b.paymentMethod === 'pay_online' ? 'Online Payment' : 'Cash',
        provider: b.paymentMethod === 'pay_online' ? 'pos_terminal' : 'cash',
        isManual: true,
        paymentStatus: 'Paid',
        paymentDate: b.createdAt || new Date().toISOString(),
        transactionReference: `TXN-${b.bookingReference.replace(/[^a-zA-Z0-9]/g, '')}`,
        notes: 'Full payment confirmed at reservation booking.',
        recordedBy: 'Booking Gateway',
        createdAt: b.createdAt || new Date().toISOString(),
      });
    } else if (b.paymentStatus === 'partially_paid') {
      const partialAmount = Math.round(total * 0.5);
      generated.push({
        id: `pay-${b.bookingReference}-01`,
        bookingId: b.bookingId || b.bookingReference,
        bookingReference: b.bookingReference,
        customerId: (b as any).customerId || null,
        customerName: `${b.customer.firstName} ${b.customer.lastName}`,
        customerEmail: b.customer.email,
        customerPhone: b.customer.phoneNumber
          ? `${b.customer.countryCode || ''} ${b.customer.phoneNumber}`
          : null,
        amount: partialAmount,
        currency: 'EUR',
        paymentMethod: 'Card',
        provider: 'pos_terminal',
        isManual: true,
        paymentStatus: 'Partially Paid',
        paymentDate: b.createdAt || new Date().toISOString(),
        transactionReference: `DEP-${b.bookingReference.replace(/[^a-zA-Z0-9]/g, '')}`,
        notes: 'Deposit received. Outstanding balance due at hotel pickup.',
        recordedBy: 'Pier Desk Staff',
        createdAt: b.createdAt || new Date().toISOString(),
      });
    }
  });

  setLocal(LOCAL_PAYMENTS_KEY, generated);
  return generated;
}

export async function listPayments(filter?: {
  bookingId?: string;
  customerId?: string;
  status?: string;
  method?: string;
  provider?: string;
  currency?: string;
  search?: string;
}): Promise<FinancePayment[]> {
  let payments = await ensureSeedPayments();

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('payment_transactions')
        .select('*')
        .order('payment_date', { ascending: false });

      if (!error && data) {
        const dbPayments: FinancePayment[] = data.map((d: any) => ({
          id: d.id,
          bookingId: d.booking_id,
          bookingReference: d.booking_reference || d.booking_id,
          customerId: d.customer_id,
          customerName: d.customer_name || 'Guest',
          customerEmail: d.customer_email || '',
          customerPhone: d.customer_phone || null,
          amount: Number(d.amount),
          currency: d.currency || 'EUR',
          paymentMethod: d.payment_method as FinancePaymentMethod,
          provider: d.provider || 'cash',
          isManual: d.is_manual ?? true,
          paymentStatus: d.status as FinancePaymentStatus,
          paymentDate: d.payment_date,
          transactionReference: d.transaction_reference || `TXN-${d.id.substring(0, 8)}`,
          notes: d.notes,
          recordedBy: d.recorded_by || 'Staff',
          createdAt: d.created_at,
          updatedAt: d.updated_at,
        }));
        const dbTxRefs = new Set(dbPayments.map((p) => p.transactionReference?.toLowerCase()));
        const dbIds = new Set(dbPayments.map((p) => p.id));
        const unsynced = payments.filter(
          (p) => !dbIds.has(p.id) && (!p.transactionReference || !dbTxRefs.has(p.transactionReference.toLowerCase()))
        );
        payments = [...dbPayments, ...unsynced];
        setLocal(LOCAL_PAYMENTS_KEY, payments);
      }
    } catch {
      // ignore
    }
  }

  return payments.filter((p) => {
    if (filter?.bookingId && p.bookingId !== filter.bookingId && p.bookingReference !== filter.bookingId) return false;
    if (filter?.customerId && p.customerId !== filter.customerId) return false;
    if (filter?.status && filter.status !== 'all') {
      const pNorm = p.paymentStatus.toLowerCase();
      const fNorm = filter.status.toLowerCase();
      if (pNorm !== fNorm) return false;
    }
    if (filter?.method && filter.method !== 'all' && p.paymentMethod !== filter.method) return false;
    if (filter?.provider && filter.provider !== 'all' && p.provider !== filter.provider) return false;
    if (filter?.currency && filter.currency !== 'all' && p.currency !== filter.currency) return false;
    if (filter?.search?.trim()) {
      const q = filter.search.toLowerCase();
      return (
        p.bookingReference.toLowerCase().includes(q) ||
        p.customerName.toLowerCase().includes(q) ||
        p.customerEmail.toLowerCase().includes(q) ||
        p.transactionReference.toLowerCase().includes(q) ||
        (p.notes && p.notes.toLowerCase().includes(q))
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
  transactionReference?: string;
  notes?: string | null;
  recordedBy?: string;
}): Promise<FinancePayment> {
  // Provider Validation: Do NOT pretend provider is connected
  const providers = await listPaymentProviders();
  const selectedProviderId = paymentData.provider || (paymentData.paymentMethod === 'Cash' ? 'cash' : 'pos_terminal');
  const providerDef = providers.find((p) => p.id === selectedProviderId);

  if (providerDef && !providerDef.isConnected && !providerDef.isManual) {
    throw new Error(
      `Payment provider "${providerDef.name}" is currently disconnected. Live API keys are not provisioned. Please record this payment using an active manual provider (Cash Office, Pier POS, or Bank Wire).`
    );
  }

  if (paymentData.amount <= 0) {
    throw new Error('Payment amount must be greater than zero.');
  }

  const allPayments = await listPayments();
  const paymentDate = paymentData.paymentDate || new Date().toISOString();

  if (paymentData.transactionReference?.trim()) {
    const existingTx = allPayments.find(
      (p) => p.transactionReference?.trim().toLowerCase() === paymentData.transactionReference?.trim().toLowerCase()
    );
    if (existingTx) {
      throw new Error(`Duplicate transaction reference: Transaction "${paymentData.transactionReference.trim()}" has already been recorded.`);
    }
  }

  const txRef =
    paymentData.transactionReference?.trim() ||
    `TXN-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const newPayment: FinancePayment = {
    id: `pay-${Date.now().toString(36)}`,
    bookingId: paymentData.bookingId,
    bookingReference: paymentData.bookingReference,
    customerId: paymentData.customerId || null,
    customerName: paymentData.customerName,
    customerEmail: paymentData.customerEmail,
    customerPhone: paymentData.customerPhone || null,
    amount: Number(paymentData.amount),
    currency: paymentData.currency || 'EUR',
    paymentMethod: paymentData.paymentMethod,
    provider: selectedProviderId,
    isManual: providerDef ? providerDef.isManual : true,
    paymentStatus: paymentData.paymentStatus,
    paymentDate,
    transactionReference: txRef,
    notes: paymentData.notes || null,
    recordedBy: paymentData.recordedBy || 'Finance Staff',
    createdAt: new Date().toISOString(),
  };

  // Sync with Supabase if configured (Authoritative Database First)
  if (isSupabaseConfigured()) {
    try {
      let resolvedBookingUuid = newPayment.bookingId;
      let resolvedCustomerUuid = newPayment.customerId;

      // If bookingId is not a UUID, resolve it from bookings table by booking_reference
      if (!resolvedBookingUuid?.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        const { data: bRow } = await supabase
          .from('bookings')
          .select('id, customer_id')
          .eq('booking_reference', newPayment.bookingReference)
          .maybeSingle();

        if (bRow) {
          resolvedBookingUuid = bRow.id;
          if (!resolvedCustomerUuid && bRow.customer_id) {
            resolvedCustomerUuid = bRow.customer_id;
          }
        }
      }

      if (resolvedBookingUuid?.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        const paymentPayload: Record<string, any> = {
          booking_id: resolvedBookingUuid,
          amount: newPayment.amount,
          currency: newPayment.currency || 'EUR',
          payment_method: newPayment.paymentMethod,
          status: newPayment.paymentStatus,
          transaction_reference: newPayment.transactionReference,
          notes: newPayment.notes,
          recorded_by: newPayment.recordedBy,
          payment_date: newPayment.paymentDate,
        };

        if (resolvedCustomerUuid?.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
          paymentPayload.customer_id = resolvedCustomerUuid;
        }

        const { data: inserted, error: payError } = await supabase
          .from('payment_transactions')
          .insert(paymentPayload)
          .select('id')
          .maybeSingle();

        if (payError) {
          throw new Error(formatSupabaseError(payError));
        }

        if (inserted?.id) {
          newPayment.id = inserted.id;
        }
      }
    } catch (err: any) {
      console.error('Error inserting payment transaction in Supabase:', err);
      throw err;
    }
  }

  // Only commit to local state after authoritative write succeeds
  const updatedPayments = [newPayment, ...allPayments];
  setLocal(LOCAL_PAYMENTS_KEY, updatedPayments);

  // Recalculate booking payment status server/service side
  try {
    const allBookings = await bookingRepository.listBookings();
    const targetBooking = allBookings.find(
      (b) => b.bookingReference === paymentData.bookingReference || b.bookingId === paymentData.bookingId
    );

    if (targetBooking) {
      const bookingPayments = updatedPayments.filter(
        (p) =>
          (p.bookingReference === targetBooking.bookingReference || p.bookingId === targetBooking.bookingId) &&
          (p.paymentStatus === 'Paid' || p.paymentStatus === 'paid')
      );
      const totalPaid = bookingPayments.reduce((sum, p) => sum + p.amount, 0);

      // Subtract processed refunds
      const allRefunds = await listRefunds();
      const processedRefunds = allRefunds.filter(
        (r) =>
          (r.bookingReference === targetBooking.bookingReference || r.bookingId === targetBooking.bookingId) &&
          r.status === 'processed'
      );
      const totalRefunded = processedRefunds.reduce((sum, r) => sum + (r.approvedAmount || r.amount), 0);
      const netPaid = Math.max(0, totalPaid - totalRefunded);
      const bookingTotal = targetBooking.pricing?.totalEur || 0;

      let nextStatus: any = 'pending';
      if (netPaid >= bookingTotal) {
        nextStatus = 'paid';
      } else if (netPaid > 0) {
        nextStatus = 'partially_paid';
      }

      await bookingRepository.updateBooking({
        ...targetBooking,
        paymentStatus: nextStatus,
        updatedAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.warn('Failed to update booking status after payment:', err);
  }

  // CRM Activity Timeline Event
  try {
    await recordActivity({
      customerId: newPayment.customerId || undefined,
      bookingId: newPayment.bookingId || newPayment.bookingReference,
      eventType: 'payment_recorded',
      title: `Payment Received: €${newPayment.amount.toFixed(2)}`,
      description: `Payment settled via ${newPayment.paymentMethod} (Provider: ${newPayment.provider}). Reference: ${newPayment.transactionReference}.`,
      actor: newPayment.recordedBy || 'Finance Desk',
      metadata: {
        paymentId: newPayment.id,
        amount: newPayment.amount,
        currency: newPayment.currency,
        bookingReference: newPayment.bookingReference,
        transactionReference: newPayment.transactionReference,
      },
    });
  } catch {}

  // Staff Notification
  try {
    const notifsRaw = localStorage.getItem('rse_staff_notifications') || '[]';
    const notifs = JSON.parse(notifsRaw);
    notifs.unshift({
      id: `notif-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      category: 'new_payment',
      dedupKey: `new_payment_${newPayment.id}`,
      title: `New Payment: €${newPayment.amount.toFixed(2)} (${newPayment.currency || 'EUR'})`,
      message: `Received ${newPayment.paymentMethod} from ${newPayment.customerName} for ${newPayment.bookingReference || 'Direct Payment'}.`,
      severity: 'success',
      entityType: 'payment',
      entityId: newPayment.id,
      linkTab: 'fin_payments',
      isRead: false,
      createdAt: newPayment.paymentDate || new Date().toISOString(),
    });
    localStorage.setItem('rse_staff_notifications', JSON.stringify(notifs.slice(0, 100)));
  } catch {}

  // Automation & Communications Event: payment.received
  try {
    await publishAutomationEvent(
      'payment.received',
      {
        paymentId: newPayment.id,
        bookingReference: newPayment.bookingReference,
        bookingId: newPayment.bookingId,
        customerId: newPayment.customerId,
        customerName: newPayment.customerName,
        customerEmail: newPayment.customerEmail,
        amount: newPayment.amount,
        currency: newPayment.currency,
        paymentMethod: newPayment.paymentMethod,
        transactionReference: newPayment.transactionReference,
        provider: newPayment.provider,
      },
      'payment',
      newPayment.id
    );
  } catch {}

  return newPayment;
}

// ------------------------------------------------------------------------------
// 2. INVOICE GENERATION & MANAGEMENT
// ------------------------------------------------------------------------------

export async function listInvoices(filter?: {
  bookingId?: string;
  status?: string;
  search?: string;
}): Promise<FinanceInvoice[]> {
  let invoices = getLocal<FinanceInvoice[]>(LOCAL_INVOICES_KEY, []);

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .order('issue_date', { ascending: false });

      if (!error && data && data.length > 0) {
        invoices = data.map((d: any) => ({
          id: d.id,
          invoiceNumber: d.invoice_number,
          bookingId: d.booking_id,
          bookingReference: d.booking_reference || d.booking_id,
          customerId: d.customer_id,
          issueDate: d.issue_date,
          dueDate: d.due_date,
          customer: {
            name: d.customer_name || 'Guest',
            email: d.customer_email || '',
            phone: d.customer_phone || null,
          },
          tourTitle: d.tour_title || 'Excursion',
          tourDate: d.tour_date || d.issue_date,
          guests: { adults: 1, children: 0, infants: 0 },
          lineItems: (d.line_items as InvoiceLineItem[]) || [],
          subtotal: Number(d.subtotal),
          discount: Number(d.discount),
          taxRatePercent: 0,
          taxAmount: Number(d.tax_amount),
          total: Number(d.total),
          paid: Number(d.paid),
          balance: Number(d.balance),
          currency: d.currency || 'EUR',
          status: d.status,
          companyDetails: (d.company_details as CompanyBillingDetails) || COMPANY_DETAILS,
          notes: d.notes,
          createdAt: d.created_at,
          updatedAt: d.updated_at,
        }));
        setLocal(LOCAL_INVOICES_KEY, invoices);
      }
    } catch {
      // ignore
    }
  }

  // If no invoices exist, generate invoices from bookings
  if (invoices.length === 0) {
    const bookings = await bookingRepository.listBookings();
    const payments = await listPayments();

    invoices = bookings.map((b, idx) => {
      const bookingPayments = payments.filter(
        (p) =>
          (p.bookingReference === b.bookingReference || p.bookingId === b.bookingId) &&
          (p.paymentStatus === 'Paid' || p.paymentStatus === 'paid')
      );
      const paidAmount = bookingPayments.reduce((sum, p) => sum + p.amount, 0);
      const total = b.pricing?.totalEur || 0;
      const subtotal = b.pricing?.subtotalEur || total;
      const discount = b.pricing?.discountEur || 0;
      const balance = Math.max(0, total - paidAmount);

      let invoiceStatus: FinanceInvoice['status'] = 'issued';
      if (balance <= 0) invoiceStatus = 'paid';
      else if (paidAmount > 0) invoiceStatus = 'partially_paid';

      const lineItems: InvoiceLineItem[] = [
        {
          id: `line-${b.bookingReference}-01`,
          description: `${b.tourTitle} - Excursion Package (${b.guests.adults} Adults${
            b.guests.children > 0 ? `, ${b.guests.children} Children` : ''
          })`,
          quantity: 1,
          unitPrice: subtotal,
          total: subtotal,
          type: 'tour',
        },
      ];

      if (b.pickup.feeEur > 0) {
        lineItems.push({
          id: `line-${b.bookingReference}-pickup`,
          description: `Hotel Pickup Transfer (${b.pickup.hotelName || b.pickup.locationName || 'Hurghada'})`,
          quantity: (b.guests.adults || 1) + (b.guests.children || 0),
          unitPrice: b.pickup.feeEur,
          total: b.pricing?.pickupSubtotalEur || b.pickup.feeEur,
          type: 'pickup',
        });
      }

      if (b.extras && b.extras.length > 0) {
        b.extras.forEach((e, eIdx) => {
          lineItems.push({
            id: `line-${b.bookingReference}-ext-${eIdx}`,
            description: `Extra: ${e.name}`,
            quantity: e.quantity || 1,
            unitPrice: e.priceEur,
            total: e.amountEur || e.priceEur,
            type: 'extra',
          });
        });
      }

      return {
        id: `inv-${b.bookingReference}`,
        invoiceNumber: `INV-${new Date().getFullYear()}-${String(idx + 1).padStart(4, '0')}`,
        bookingId: b.bookingId || b.bookingReference,
        bookingReference: b.bookingReference,
        customerId: (b as any).customerId || null,
        issueDate: b.createdAt ? b.createdAt.split('T')[0] : new Date().toISOString().split('T')[0],
        dueDate: b.date ? b.date.split('T')[0] : new Date().toISOString().split('T')[0],
        customer: {
          name: `${b.customer.firstName} ${b.customer.lastName}`,
          email: b.customer.email,
          phone: b.customer.phoneNumber,
          hotel: b.pickup.hotelName,
          roomNumber: b.pickup.roomNumber,
          country: (b.customer as any).nationality || b.customer.countryCode,
        },
        tourTitle: b.tourTitle,
        tourDate: b.date,
        guests: b.guests,
        lineItems,
        subtotal,
        discount,
        taxRatePercent: 0,
        taxAmount: 0,
        total,
        paid: paidAmount,
        balance,
        currency: 'EUR',
        status: invoiceStatus,
        companyDetails: COMPANY_DETAILS,
        notes: 'Commercial Invoice issued for maritime tour services.',
        createdAt: b.createdAt || new Date().toISOString(),
        updatedAt: b.createdAt || new Date().toISOString(),
      };
    });

    setLocal(LOCAL_INVOICES_KEY, invoices);
  }

  return invoices.filter((inv) => {
    if (filter?.bookingId && inv.bookingId !== filter.bookingId && inv.bookingReference !== filter.bookingId) {
      return false;
    }
    if (filter?.status && filter.status !== 'all' && inv.status !== filter.status) {
      return false;
    }
    if (filter?.search?.trim()) {
      const q = filter.search.toLowerCase();
      return (
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.bookingReference.toLowerCase().includes(q) ||
        inv.customer.name.toLowerCase().includes(q) ||
        inv.customer.email.toLowerCase().includes(q) ||
        inv.tourTitle.toLowerCase().includes(q)
      );
    }
    return true;
  });
}

export async function generateInvoiceForBooking(bookingReference: string): Promise<FinanceInvoice | null> {
  const bookings = await bookingRepository.listBookings();
  const b = bookings.find((item) => item.bookingReference === bookingReference);
  if (!b) return null;

  const existingInvoices = await listInvoices();
  const alreadyExisting = existingInvoices.find(
    (inv) => inv.bookingReference === bookingReference || inv.bookingId === b.bookingId
  );
  if (alreadyExisting) return alreadyExisting;

  const payments = await listPayments({ bookingId: bookingReference });
  const paidAmount = payments
    .filter((p) => p.paymentStatus === 'Paid' || p.paymentStatus === 'paid')
    .reduce((sum, p) => sum + p.amount, 0);

  const total = b.pricing?.totalEur || 0;
  const subtotal = b.pricing?.subtotalEur || total;
  const discount = b.pricing?.discountEur || 0;
  const balance = Math.max(0, total - paidAmount);

  const seq = existingInvoices.length + 1;
  const invNumber = `INV-${new Date().getFullYear()}-${String(seq).padStart(4, '0')}`;

  const lineItems: InvoiceLineItem[] = [
    {
      id: `line-${b.bookingReference}-01`,
      description: `${b.tourTitle} - Excursion Package (${b.guests.adults} Adults${
        b.guests.children > 0 ? `, ${b.guests.children} Children` : ''
      })`,
      quantity: 1,
      unitPrice: subtotal,
      total: subtotal,
      type: 'tour',
    },
  ];

  if (b.pickup.feeEur > 0) {
    lineItems.push({
      id: `line-${b.bookingReference}-pickup`,
      description: `Hotel Pickup Transfer (${b.pickup.hotelName || b.pickup.locationName || 'Hurghada'})`,
      quantity: (b.guests.adults || 1) + (b.guests.children || 0),
      unitPrice: b.pickup.feeEur,
      total: b.pricing?.pickupSubtotalEur || b.pickup.feeEur,
      type: 'pickup',
    });
  }

  const newInvoice: FinanceInvoice = {
    id: `inv-${b.bookingReference}`,
    invoiceNumber: invNumber,
    bookingId: b.bookingId || b.bookingReference,
    bookingReference: b.bookingReference,
    customerId: (b as any).customerId || null,
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: b.date ? b.date.split('T')[0] : new Date().toISOString().split('T')[0],
    customer: {
      name: `${b.customer.firstName} ${b.customer.lastName}`,
      email: b.customer.email,
      phone: b.customer.phoneNumber,
      hotel: b.pickup.hotelName,
      roomNumber: b.pickup.roomNumber,
      country: (b.customer as any).nationality || b.customer.countryCode,
    },
    tourTitle: b.tourTitle,
    tourDate: b.date,
    guests: b.guests,
    lineItems,
    subtotal,
    discount,
    taxRatePercent: 0,
    taxAmount: 0,
    total,
    paid: paidAmount,
    balance,
    currency: 'EUR',
    status: balance <= 0 ? 'paid' : paidAmount > 0 ? 'partially_paid' : 'issued',
    companyDetails: COMPANY_DETAILS,
    notes: 'Official Commercial Invoice. All activities governed by Egyptian Red Sea Maritime Safety Regulations.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (isSupabaseConfigured()) {
    try {
      // Check if invoice already exists in database
      const { data: dbExisting } = await supabase
        .from('invoices')
        .select('*')
        .or(`booking_id.eq.${b.bookingId},invoice_number.eq.${newInvoice.invoiceNumber}`)
        .maybeSingle();

      if (dbExisting) {
        return {
          id: dbExisting.id,
          invoiceNumber: dbExisting.invoice_number,
          bookingId: dbExisting.booking_id,
          bookingReference: b.bookingReference,
          customerId: dbExisting.customer_id,
          issueDate: dbExisting.issue_date,
          dueDate: dbExisting.due_date,
          customer: newInvoice.customer,
          tourTitle: dbExisting.tour_title || newInvoice.tourTitle,
          tourDate: dbExisting.tour_date || newInvoice.tourDate,
          guests: newInvoice.guests,
          lineItems: (dbExisting.line_items as InvoiceLineItem[]) || newInvoice.lineItems,
          subtotal: Number(dbExisting.subtotal),
          discount: Number(dbExisting.discount),
          taxRatePercent: 0,
          taxAmount: Number(dbExisting.tax_amount),
          total: Number(dbExisting.total),
          paid: Number(dbExisting.paid),
          balance: Number(dbExisting.balance),
          currency: dbExisting.currency || 'EUR',
          status: dbExisting.status as any,
          companyDetails: (dbExisting.company_details as any) || COMPANY_DETAILS,
          notes: dbExisting.notes,
          createdAt: dbExisting.created_at,
          updatedAt: dbExisting.updated_at,
        };
      }

      const { data: inserted, error: invError } = await supabase
        .from('invoices')
        .insert({
          invoice_number: newInvoice.invoiceNumber,
          booking_id: newInvoice.bookingId,
          customer_id: newInvoice.customerId,
          customer_name: newInvoice.customer.name,
          customer_email: newInvoice.customer.email,
          customer_phone: newInvoice.customer.phone,
          tour_title: newInvoice.tourTitle,
          tour_date: newInvoice.tourDate ? newInvoice.tourDate.split('T')[0] : undefined,
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

      if (invError) {
        throw new Error(`Failed to persist invoice to database: ${formatSupabaseError(invError)}`);
      }

      if (inserted?.id) {
        newInvoice.id = inserted.id;
      }
    } catch (err: any) {
      console.error('Invoice persistence error:', err);
      throw err;
    }
  }

  // Only commit to local state cache after authoritative database insert succeeds
  const updated = [newInvoice, ...existingInvoices];
  setLocal(LOCAL_INVOICES_KEY, updated);

  return newInvoice;
}

// ------------------------------------------------------------------------------
// 3. CONTROLLED REFUND MANAGEMENT (Immutable Audit Trail)
// ------------------------------------------------------------------------------

export async function listRefunds(filter?: {
  bookingId?: string;
  status?: string;
  search?: string;
}): Promise<FinanceRefund[]> {
  let refunds = getLocal<FinanceRefund[]>(LOCAL_REFUNDS_KEY, []);

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('refund_records')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        const dbRefunds: FinanceRefund[] = data.map((d: any) => ({
          id: d.id,
          bookingId: d.booking_id,
          bookingReference: d.booking_reference || d.booking_id,
          paymentId: d.payment_id,
          customerId: d.customer_id,
          customerName: d.customer_name || 'Guest',
          customerEmail: d.customer_email || '',
          amount: Number(d.amount),
          requestedAmount: Number(d.requested_amount || d.amount),
          approvedAmount: d.approved_amount != null ? Number(d.approved_amount) : null,
          currency: d.currency || 'EUR',
          reason: d.reason,
          status: (d.status || 'processed') as RefundStatus,
          requestedBy: d.requested_by || 'Staff',
          approvedBy: d.approved_by || null,
          processedDate: d.processed_date || null,
          refundMethod: d.refund_method as any,
          transactionReference: d.transaction_reference || `REF-${d.id.substring(0, 8)}`,
          processedBy: d.processed_by || 'Staff',
          notes: d.notes,
          createdAt: d.created_at,
          updatedAt: d.updated_at,
        }));
        const dbIds = new Set(dbRefunds.map((r) => r.id));
        const dbTxRefs = new Set(dbRefunds.map((r) => r.transactionReference?.toLowerCase()));
        const unsynced = refunds.filter(
          (r) => !dbIds.has(r.id) && (!r.transactionReference || !dbTxRefs.has(r.transactionReference.toLowerCase()))
        );
        refunds = [...dbRefunds, ...unsynced];
        setLocal(LOCAL_REFUNDS_KEY, refunds);
      }
    } catch {
      // ignore
    }
  }

  return refunds.filter((r) => {
    if (filter?.bookingId && r.bookingId !== filter.bookingId && r.bookingReference !== filter.bookingId) return false;
    if (filter?.status && filter.status !== 'all' && r.status !== filter.status) return false;
    if (filter?.search?.trim()) {
      const q = filter.search.toLowerCase();
      return (
        r.bookingReference.toLowerCase().includes(q) ||
        r.customerName.toLowerCase().includes(q) ||
        r.reason.toLowerCase().includes(q) ||
        r.transactionReference.toLowerCase().includes(q)
      );
    }
    return true;
  });
}

/**
 * Step 1: Request a Refund (Creates a record pending approval)
 */
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
  // Audit Check: Verify requested amount does not exceed net paid amount for this booking
  const payments = await listPayments({ bookingId: refundData.bookingReference });
  const totalPaid = payments
    .filter((p) => p.paymentStatus === 'Paid' || p.paymentStatus === 'paid')
    .reduce((sum, p) => sum + p.amount, 0);

  const existingRefunds = await listRefunds({ bookingId: refundData.bookingReference });

  // Prevent duplicate concurrent requests with identical parameters
  const duplicatePending = existingRefunds.find(
    (r) =>
      r.status === 'pending_approval' &&
      r.bookingReference === refundData.bookingReference &&
      Math.abs(r.requestedAmount - refundData.requestedAmount) < 0.01 &&
      r.reason === refundData.reason.trim()
  );
  if (duplicatePending) {
    return {
      success: false,
      error: `A duplicate refund request for €${refundData.requestedAmount} is already pending approval (Ref: ${duplicatePending.transactionReference}).`,
    };
  }

  // Audit Check: Count all committed refunds (processed, approved, pending) so in-flight requests cannot exceed net balance
  const activeRefunds = existingRefunds.filter(
    (r) => r.status === 'processed' || r.status === 'approved' || r.status === 'pending_approval'
  );
  const totalCommittedRefunds = activeRefunds.reduce(
    (sum, r) => sum + (r.approvedAmount || r.requestedAmount || r.amount),
    0
  );
  const maxAvailableToRefund = Math.max(0, totalPaid - totalCommittedRefunds);

  if (refundData.requestedAmount <= 0) {
    return { success: false, error: 'Refund requested amount must be greater than zero.' };
  }

  if (refundData.requestedAmount > maxAvailableToRefund) {
    return {
      success: false,
      error: `Cannot request €${refundData.requestedAmount}. Maximum refundable balance is €${maxAvailableToRefund.toFixed(2)} (€${totalPaid.toFixed(2)} paid minus €${totalCommittedRefunds.toFixed(2)} committed/processed refunds).`,
    };
  }

  const txRef = `REQ-REF-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const newRefund: FinanceRefund = {
    id: `ref-${Date.now().toString(36)}`,
    bookingId: refundData.bookingId,
    bookingReference: refundData.bookingReference,
    paymentId: refundData.paymentId || null,
    customerId: refundData.customerId || null,
    customerName: refundData.customerName,
    customerEmail: refundData.customerEmail,
    amount: refundData.requestedAmount,
    requestedAmount: Number(refundData.requestedAmount),
    approvedAmount: null,
    currency: refundData.currency || 'EUR',
    reason: refundData.reason.trim(),
    status: 'pending_approval',
    requestedBy: refundData.requestedBy || 'Staff',
    approvedBy: null,
    processedDate: null,
    refundMethod: refundData.refundMethod,
    transactionReference: txRef,
    processedBy: 'Pending Audit',
    notes: refundData.notes || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Authoritative Database Sync First
  if (isSupabaseConfigured()) {
    try {
      let resolvedBookingUuid = newRefund.bookingId;
      let resolvedCustomerUuid = newRefund.customerId;

      if (!resolvedBookingUuid?.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        const { data: bRow } = await supabase
          .from('bookings')
          .select('id, customer_id')
          .eq('booking_reference', newRefund.bookingReference)
          .maybeSingle();

        if (bRow) {
          resolvedBookingUuid = bRow.id;
          if (!resolvedCustomerUuid && bRow.customer_id) {
            resolvedCustomerUuid = bRow.customer_id;
          }
        }
      }

      if (resolvedBookingUuid?.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        // Map UI method to DB CHECK constraint: ('Original Payment Method', 'Cash', 'Credit Card', 'Bank Wire', 'Credit Voucher')
        const dbMethod =
          newRefund.refundMethod === 'Card Reversal'
            ? 'Credit Card'
            : newRefund.refundMethod === 'Cash Return'
            ? 'Cash'
            : newRefund.refundMethod === 'Bank Wire'
            ? 'Bank Wire'
            : newRefund.refundMethod === 'Store Credit / Voucher'
            ? 'Credit Voucher'
            : 'Original Payment Method';

        const refundPayload: Record<string, any> = {
          booking_id: resolvedBookingUuid,
          booking_reference: newRefund.bookingReference,
          payment_id: newRefund.paymentId && newRefund.paymentId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i) ? newRefund.paymentId : null,
          customer_name: newRefund.customerName,
          customer_email: newRefund.customerEmail,
          amount: newRefund.amount,
          requested_amount: newRefund.requestedAmount,
          currency: newRefund.currency || 'EUR',
          reason: newRefund.reason,
          status: newRefund.status,
          requested_by: newRefund.requestedBy,
          refund_method: dbMethod,
          transaction_reference: newRefund.transactionReference,
          processed_by: newRefund.processedBy,
          notes: newRefund.notes,
        };

        if (resolvedCustomerUuid?.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
          refundPayload.customer_id = resolvedCustomerUuid;
        }

        const { data: insRefund, error: refError } = await supabase
          .from('refund_records')
          .insert(refundPayload)
          .select('id')
          .maybeSingle();

        if (refError) {
          console.error('Supabase refund insert error:', refError);
          return { success: false, error: formatSupabaseError(refError) };
        }

        if (insRefund?.id) {
          newRefund.id = insRefund.id;
        }
      }
    } catch (err: any) {
      console.error('Error inserting refund record in Supabase:', err);
      return { success: false, error: err.message || 'Database error recording refund.' };
    }
  }

  // Only commit to local state after authoritative database operation succeeds
  const allRefunds = await listRefunds();
  setLocal(LOCAL_REFUNDS_KEY, [newRefund, ...allRefunds]);

  return { success: true, refund: newRefund };
}

/**
 * Step 2: Approve a Refund (Authorized finance auditor/admin approves the amount)
 */
export async function approveRefund(
  refundId: string,
  approvedAmount: number,
  approvedBy: string = 'Finance Manager'
): Promise<{ success: boolean; error?: string; refund?: FinanceRefund }> {
  const allRefunds = await listRefunds();
  const target = allRefunds.find((r) => r.id === refundId);
  if (!target) return { success: false, error: 'Refund record not found.' };

  if (approvedAmount <= 0) {
    return { success: false, error: 'Approved amount must be greater than zero.' };
  }

  if (isSupabaseConfigured() && refundId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    try {
      const { error: updErr } = await supabase
        .from('refund_records')
        .update({
          approved_amount: approvedAmount,
          amount: approvedAmount,
          status: 'approved',
          approved_by: approvedBy,
          updated_at: new Date().toISOString(),
        })
        .eq('id', refundId);

      if (updErr) {
        return { success: false, error: formatSupabaseError(updErr) };
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'Database error approving refund.' };
    }
  }

  target.approvedAmount = approvedAmount;
  target.amount = approvedAmount;
  target.status = 'approved';
  target.approvedBy = approvedBy;
  target.updatedAt = new Date().toISOString();

  setLocal(LOCAL_REFUNDS_KEY, [...allRefunds]);
  return { success: true, refund: target };
}

/**
 * Step 3: Process / Disburse Refund (Never mark a refund completed unless operation actually occurred)
 */
export async function processRefund(
  refundId: string,
  processedBy: string = 'Finance Auditor',
  transactionReference?: string
): Promise<{ success: boolean; error?: string; refund?: FinanceRefund }> {
  const allRefunds = await listRefunds();
  const target = allRefunds.find((r) => r.id === refundId);
  if (!target) return { success: false, error: 'Refund record not found.' };

  const finalAmount = target.approvedAmount || target.requestedAmount;
  const processedDate = new Date().toISOString();
  const txRef = transactionReference?.trim() || target.transactionReference;

  if (isSupabaseConfigured() && refundId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    try {
      const { error: procErr } = await supabase
        .from('refund_records')
        .update({
          status: 'processed',
          processed_date: processedDate,
          processed_by: processedBy,
          transaction_reference: txRef,
          amount: finalAmount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', refundId);

      if (procErr) {
        return { success: false, error: formatSupabaseError(procErr) };
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'Database error processing refund.' };
    }
  }

  target.status = 'processed';
  target.processedDate = processedDate;
  target.processedBy = processedBy;
  target.amount = finalAmount;
  target.transactionReference = txRef;
  target.updatedAt = new Date().toISOString();

  setLocal(LOCAL_REFUNDS_KEY, [...allRefunds]);

  // Update booking payment status based on real net balance
  try {
    const allBookings = await bookingRepository.listBookings();
    const targetBooking = allBookings.find(
      (b) => b.bookingReference === target.bookingReference || b.bookingId === target.bookingId
    );

    if (targetBooking) {
      const payments = await listPayments({ bookingId: target.bookingReference });
      const totalPaid = payments
        .filter((p) => p.paymentStatus === 'Paid' || p.paymentStatus === 'paid')
        .reduce((sum, p) => sum + p.amount, 0);

      const processedRefunds = allRefunds.filter(
        (r) =>
          (r.bookingReference === target.bookingReference || r.bookingId === target.bookingId) &&
          r.status === 'processed'
      );
      const totalRefunded = processedRefunds.reduce((sum, r) => sum + (r.approvedAmount || r.amount), 0);

      const isFullRefund = totalRefunded >= totalPaid;

      await bookingRepository.updateBooking({
        ...targetBooking,
        paymentStatus: isFullRefund ? 'refunded' : 'partially_paid',
        status: isFullRefund ? 'cancelled' : targetBooking.status,
        cancellationReason: isFullRefund ? `Refunded in full: ${target.reason}` : targetBooking.cancellationReason,
        updatedAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.warn('Failed to update booking status after refund processing:', err);
  }

  return { success: true, refund: target };
}

/**
 * Step 4: Reject a Refund
 */
export async function rejectRefund(
  refundId: string,
  rejectedBy: string = 'Finance Manager',
  reason?: string
): Promise<{ success: boolean; error?: string; refund?: FinanceRefund }> {
  const allRefunds = await listRefunds();
  const target = allRefunds.find((r) => r.id === refundId);
  if (!target) return { success: false, error: 'Refund record not found.' };

  const updatedNotes = `${target.notes || ''} [Rejected by ${rejectedBy}: ${reason || 'Not eligible'}]`.trim();
  const nowIso = new Date().toISOString();

  if (isSupabaseConfigured() && refundId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    try {
      const { error: updErr } = await supabase
        .from('refund_records')
        .update({
          status: 'rejected',
          notes: updatedNotes,
          updated_at: nowIso,
        })
        .eq('id', refundId);

      if (updErr) {
        return { success: false, error: formatSupabaseError(updErr) };
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'Database error rejecting refund.' };
    }
  }

  target.status = 'rejected';
  target.notes = updatedNotes;
  target.updatedAt = nowIso;

  // Only commit to local state cache after authoritative database write succeeds
  setLocal(LOCAL_REFUNDS_KEY, [...allRefunds]);

  return { success: true, refund: target };
}

// ------------------------------------------------------------------------------
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

  bookings.forEach((b) => {
    const bookingTotal = b.pricing?.totalEur || 0;

    const bookingPayments = payments.filter(
      (p) =>
        (p.bookingReference === b.bookingReference || p.bookingId === b.bookingId) &&
        (p.paymentStatus === 'Paid' || p.paymentStatus === 'paid')
    );
    const paidAmount = bookingPayments.reduce((sum, p) => sum + p.amount, 0);

    const bookingRefunds = refunds.filter(
      (r) =>
        (r.bookingReference === b.bookingReference || r.bookingId === b.bookingId) &&
        r.status === 'processed'
    );
    const refundAmount = bookingRefunds.reduce((sum, r) => sum + (r.approvedAmount || r.amount), 0);

    const netPaid = Math.max(0, paidAmount - refundAmount);
    const balanceAmount = Math.max(0, bookingTotal - netPaid);

    // If booking was cancelled and has 0 net paid, no balance is due
    if (b.status === 'cancelled' && netPaid === 0) return;

    if (balanceAmount > 0) {
      const tourDate = b.date ? b.date.split('T')[0] : '';
      let status: OutstandingBalanceItem['status'] = 'upcoming';

      if (tourDate < todayStr) {
        status = 'overdue';
      } else if (tourDate === todayStr) {
        status = 'due_today';
      }

      items.push({
        bookingId: b.bookingId || b.bookingReference,
        bookingReference: b.bookingReference,
        customerId: (b as any).customerId || null,
        customerName: `${b.customer.firstName} ${b.customer.lastName}`,
        customerEmail: b.customer.email,
        customerPhone: b.customer.phoneNumber
          ? `${b.customer.countryCode || ''} ${b.customer.phoneNumber}`
          : null,
        hotel: b.pickup.hotelName || b.customer.hotelName || 'Direct Marina',
        tourTitle: b.tourTitle,
        tourDate: b.date,
        totalAmount: bookingTotal,
        bookingTotal,
        paidAmount,
        amountPaid: paidAmount,
        refundAmount,
        balanceAmount,
        amountDue: balanceAmount,
        currency: 'EUR',
        dueDate: b.date,
        status,
        paymentStatus: paidAmount > 0 ? 'Partially Paid' : 'Pending',
      });
    }
  });

  return items
    .filter((item) => {
      if (filter?.status && filter.status !== 'all' && item.status !== filter.status) return false;
      if (filter?.currency && filter.currency !== 'all' && item.currency !== filter.currency) return false;
      if (filter?.search?.trim()) {
        const q = filter.search.toLowerCase();
        return (
          item.bookingReference.toLowerCase().includes(q) ||
          item.customerName.toLowerCase().includes(q) ||
          item.customerEmail.toLowerCase().includes(q) ||
          item.tourTitle.toLowerCase().includes(q) ||
          (item.hotel && item.hotel.toLowerCase().includes(q))
        );
      }
      return true;
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

// ------------------------------------------------------------------------------
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
    const cur = 'EUR'; // Standard catalog base currency
    if (cur !== targetCurrency) return false;
    if (b.status === 'cancelled') return false;
    const bDate = b.date ? b.date.split('T')[0] : '';
    if (dateRange?.start && bDate < dateRange.start) return false;
    if (dateRange?.end && bDate > dateRange.end) return false;
    return true;
  });

  const currencyPayments = payments.filter((p) => {
    if (p.currency !== targetCurrency) return false;
    if (p.paymentStatus !== 'Paid' && p.paymentStatus !== 'paid') return false;
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
  const totalOutstanding = Math.max(0, totalRevenue - totalPaid);

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
    const cBookings = bookings.filter((b) => cur === 'EUR' && b.status !== 'cancelled');
    const cPayments = payments.filter((p) => p.currency === cur && (p.paymentStatus === 'Paid' || p.paymentStatus === 'paid'));
    const cRefunds = refunds.filter((r) => r.currency === cur && r.status === 'processed');

    const gross = cBookings.reduce((sum, b) => sum + (b.pricing?.totalEur || 0), 0);
    const collected = cPayments.reduce((sum, p) => sum + p.amount, 0);
    const ref = cRefunds.reduce((sum, r) => sum + (r.approvedAmount || r.amount), 0);
    const net = Math.max(0, collected - ref);
    const out = Math.max(0, gross - collected);

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
