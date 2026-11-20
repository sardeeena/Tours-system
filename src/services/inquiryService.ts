import { supabase, isSupabaseConfigured, formatSupabaseError, isSchemaMissing, isSchemaMissingError, setSchemaMissing } from './supabaseClient';
import { DbInquiry } from '../types/database';
import { sanitizeString, isValidEmail, inquiryRateLimiter } from '../lib/security';
import { publishAutomationEvent } from './communicationService';
import { recordVisitorEvent } from './visitorAnalyticsService';

export interface CreateInquiryInput {
  customer_name: string;
  email: string;
  phone?: string | null;
  whatsapp?: string | null;
  tour_id?: string | null;
  tour_title?: string | null;
  subject: string;
  message: string;
  source?: 'web' | 'whatsapp' | 'email' | 'phone';
  website_url_hp?: string; // Honeypot field for bot suppression
}

export interface InquiryAssignee {
  id: string;
  full_name: string;
  email: string;
}

const LOCAL_INQUIRIES_KEY = 'rse_inquiries_data';

function getStoredInquiries(): DbInquiry[] {
  try {
    const raw = localStorage.getItem(LOCAL_INQUIRIES_KEY);
    if (!raw) {
      return [];
    }
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveStoredInquiries(inquiries: DbInquiry[]) {
  try {
    localStorage.setItem(LOCAL_INQUIRIES_KEY, JSON.stringify(inquiries));
  } catch {
    // ignore
  }
}

/**
 * Creates a new help request / inquiry from the customer.
 * Persists directly to Supabase and browser cache.
 */
export async function createCustomerInquiry(
  input: CreateInquiryInput
): Promise<{ success: boolean; inquiry?: DbInquiry; error?: string }> {
  // Honeypot submissions are silently acknowledged and never persisted.
  if (input.website_url_hp && input.website_url_hp.trim() !== '') {
    const now = new Date().toISOString();
    return {
      success: true,
      inquiry: {
        id: `inq-hp-${Date.now()}`,
        customer_name: input.customer_name,
        email: input.email,
        phone: input.phone || null,
        whatsapp: input.whatsapp || null,
        tour_id: input.tour_id || null,
        tour_title: input.tour_title || null,
        subject: input.subject,
        message: input.message,
        status: 'new',
        source: 'web',
        ip_address: null,
        admin_notes: 'Dropped honeypot bot trap',
        assigned_staff_id: null,
        created_at: now,
        updated_at: now,
      },
    };
  }

  const limit = inquiryRateLimiter.check();
  if (limit.isLocked) {
    return {
      success: false,
      error: `Too many submissions. Please wait ${limit.remainingSeconds} seconds before sending another message.`,
    };
  }

  const cleanName = sanitizeString(input.customer_name).slice(0, 100);
  const cleanEmail = sanitizeString(input.email).trim().toLowerCase().slice(0, 254);
  const cleanSubject = sanitizeString(input.subject).slice(0, 120);
  const cleanMessage = sanitizeString(input.message).slice(0, 2000);
  const cleanPhone = input.phone ? sanitizeString(input.phone).slice(0, 30) : null;
  const cleanWhatsapp = input.whatsapp ? sanitizeString(input.whatsapp).slice(0, 30) : cleanPhone;
  const cleanTourId = input.tour_id ? sanitizeString(input.tour_id).slice(0, 100) : null;
  const cleanTourTitle = input.tour_title ? sanitizeString(input.tour_title).slice(0, 160) : null;
  const sourceValue = String(input.source || 'web').toLowerCase();
  const source: DbInquiry['source'] = sourceValue === 'whatsapp' ? 'whatsapp' : sourceValue === 'email' ? 'email' : sourceValue === 'phone' ? 'phone' : 'web';

  if (!cleanName || !cleanEmail || !cleanMessage) {
    return { success: false, error: 'Please fill in your name, email address, and inquiry message.' };
  }
  if (!isValidEmail(cleanEmail)) {
    return { success: false, error: 'Please provide a valid email address.' };
  }

  const now = new Date().toISOString();
  const localMode = !isSupabaseConfigured();
  if (localMode && !import.meta.env.DEV) {
    return { success: false, error: 'The inquiry service is temporarily unavailable. Please try again later.' };
  }

  if (localMode) {
    const localInquiry: DbInquiry = {
      id: `inq-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      customer_name: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      whatsapp: cleanWhatsapp,
      tour_id: cleanTourId,
      tour_title: cleanTourTitle,
      subject: cleanSubject || 'General Excursion Assistance',
      message: cleanMessage,
      status: 'new',
      source,
      ip_address: null,
      admin_notes: null,
      assigned_staff_id: null,
      created_at: now,
      updated_at: now,
    };
    saveStoredInquiries([localInquiry, ...getStoredInquiries()]);
    void recordVisitorEvent({ event_name: 'inquiry_submitted', page_path: '/support', event_data: { source } }).catch((error) => console.warn('Inquiry analytics event was not recorded:', error));
    return { success: true, inquiry: localInquiry };
  }

  try {
    const response = await fetch('/api/inquiries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        whatsapp: cleanWhatsapp,
        tour_id: cleanTourId,
        tour_title: cleanTourTitle,
        subject: cleanSubject || 'General Excursion Assistance',
        message: cleanMessage,
        source,
        website_url_hp: input.website_url_hp || '',
      }),
    });

    let payload: any = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok || payload?.success !== true || !payload?.inquiry?.id) {
      inquiryRateLimiter.recordFailedAttempt();
      return {
        success: false,
        error: typeof payload?.error === 'string'
          ? payload.error
          : 'Your inquiry could not be saved. Please try again later.',
      };
    }

    const persistedInquiry = {
      ...payload.inquiry,
      ip_address: null,
      admin_notes: null,
      assigned_staff_id: null,
    } as DbInquiry;
    saveStoredInquiries([persistedInquiry, ...getStoredInquiries().filter((item) => item.id !== persistedInquiry.id)]);

    // These are non-critical follow-up signals. The inquiry itself is already persisted.
    void publishAutomationEvent(
      'inquiry.received' as any,
      {
        inquiryId: persistedInquiry.id,
        leadId: null,
        customerId: null,
        name: cleanName,
        email: cleanEmail,
        subject: persistedInquiry.subject,
        message: cleanMessage,
        tourId: cleanTourId,
      },
      'inquiry',
      persistedInquiry.id
    ).catch((eventError) => console.warn('Inquiry automation event was not published:', eventError));

    void recordVisitorEvent({ event_name: 'inquiry_submitted', page_path: '/support', event_data: { source } })
      .catch((eventError) => console.warn('Inquiry analytics event was not recorded:', eventError));
    return { success: true, inquiry: persistedInquiry };
  } catch (error) {
    inquiryRateLimiter.recordFailedAttempt();
    console.error('Inquiry API request failed:', error);
    return { success: false, error: 'Your inquiry could not be saved. Please try again later.' };
  }
}

export async function listInquiries(filter?: { status?: string }): Promise<DbInquiry[]> {
  if (!isSupabaseConfigured() || isSchemaMissing()) {
    if (!import.meta.env.DEV) {
      throw new Error('The live inquiry database is unavailable. Cached inquiries are not used in production.');
    }
    const localList = getStoredInquiries();
    return filter?.status && filter.status !== 'all'
      ? localList.filter((item) => item.status === filter.status)
      : localList;
  }

  const query = supabase.from('inquiries').select('*').order('created_at', { ascending: false });
  const { data, error } = await (filter?.status && filter.status !== 'all'
    ? query.eq('status', filter.status)
    : query);
  if (error) {
    if (isSchemaMissingError(error)) setSchemaMissing(true);
    throw new Error(formatSupabaseError(error));
  }
  return (data || []) as DbInquiry[];
}

/**
 * Updates inquiry status or admin notes
 */
export async function listInquiryAssignees(): Promise<InquiryAssignee[]> {
  if (!isSupabaseConfigured()) {
    if (!import.meta.env.DEV) {
      throw new Error('Supabase is not configured. Staff assignments are unavailable in production.');
    }
    return [];
  }

  const { data, error } = await (supabase as any).rpc('list_crm_assignable_staff');
  if (error) throw new Error(formatSupabaseError(error));
  return (Array.isArray(data) ? data : []) as InquiryAssignee[];
}

/**
 * Updates inquiry status, notes, and (when supplied) its assigned staff profile.
 */
export async function updateInquiryStatus(
  id: string,
  status: DbInquiry['status'],
  adminNotes?: string,
  assignedStaffId?: string | null
): Promise<boolean> {
  const now = new Date().toISOString();
  const updates: Record<string, unknown> = { status, updated_at: now };
  if (adminNotes !== undefined) updates.admin_notes = adminNotes;
  if (assignedStaffId !== undefined) updates.assigned_staff_id = assignedStaffId;

  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('inquiries')
      .update(updates)
      .eq('id', id)
      .select('id')
      .maybeSingle();

    if (error) throw new Error(formatSupabaseError(error));
    if (!data) throw new Error('Inquiry was not found or could not be updated.');
  } else if (!import.meta.env.DEV) {
    throw new Error('Supabase is not configured. Inquiry changes cannot be saved in production.');
  }

  // Update the local cache only after the authoritative write succeeds.
  const localList = getStoredInquiries();
  const updated = localList.map((item) =>
    item.id === id
      ? {
          ...item,
          status,
          admin_notes: adminNotes !== undefined ? adminNotes : item.admin_notes,
          ...(assignedStaffId !== undefined ? { assigned_staff_id: assignedStaffId } : {}),
          updated_at: now,
        }
      : item
  );
  saveStoredInquiries(updated);
  return true;
}

export async function convertInquiryToLead(inquiryId: string): Promise<{ id: string; name: string }> {
  if (!inquiryId.trim()) throw new Error('An inquiry ID is required for conversion.');
  if (!isSupabaseConfigured()) throw new Error('Supabase is not configured; inquiry conversion is unavailable.');

  const { data, error } = await supabase.rpc('convert_inquiry_to_lead', { p_inquiry_id: inquiryId });
  if (error) throw new Error(formatSupabaseError(error));
  const lead = Array.isArray(data) ? data[0] : data;
  if (!lead?.id) throw new Error('The conversion did not return a persisted CRM lead.');

  const cached = getStoredInquiries();
  saveStoredInquiries(cached.map((item) => item.id === inquiryId
    ? { ...item, status: 'converted', updated_at: new Date().toISOString() }
    : item
  ));

  return { id: lead.id, name: lead.name || 'New CRM lead' };
}

/**
 * Deletes an inquiry
 */
export async function deleteInquiry(id: string): Promise<boolean> {
  if (!id.trim()) throw new Error('An inquiry ID is required.');

  if (!isSupabaseConfigured()) {
    if (!import.meta.env.DEV) throw new Error('Supabase is not configured; inquiries cannot be deleted in production.');
    const local = getStoredInquiries();
    const target = local.find((item) => item.id === id);
    if (!target) throw new Error('Inquiry not found.');
    if (target.status === 'converted') throw new Error('Converted inquiries are retained to preserve their CRM lead audit trail.');
    saveStoredInquiries(local.filter((item) => item.id !== id));
    return true;
  }

  const { data: current, error: readError } = await supabase
    .from('inquiries')
    .select('id,status')
    .eq('id', id)
    .maybeSingle();
  if (readError) throw new Error(formatSupabaseError(readError));
  if (!current?.id) throw new Error('Inquiry not found or not accessible.');
  if (current.status === 'converted') {
    throw new Error('Converted inquiries are retained to preserve their CRM lead audit trail.');
  }

  const { data, error } = await supabase
    .from('inquiries')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle();
  if (error) throw new Error(formatSupabaseError(error));
  if (!data?.id) throw new Error('Inquiry was not deleted because it no longer exists or is not accessible.');

  saveStoredInquiries(getStoredInquiries().filter((item) => item.id !== id));
  return true;
}
