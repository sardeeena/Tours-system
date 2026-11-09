import { supabase, isSupabaseConfigured, formatSupabaseError, isSchemaMissing, isSchemaMissingError, setSchemaMissing } from './supabaseClient';
import { DbInquiry } from '../types/database';
import { sanitizeString, isValidEmail, inquiryRateLimiter } from '../lib/security';
import { createLead, recordActivity } from './crmService';
import { publishAutomationEvent } from './communicationService';

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

const LOCAL_INQUIRIES_KEY = 'rse_inquiries_data';

const SEED_INQUIRIES: DbInquiry[] = [];

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
  // 0. Honeypot check: If the hidden honeypot input is populated by a spam bot, trap and silently drop
  if (input.website_url_hp && input.website_url_hp.trim() !== '') {
    console.warn('Bot submission blocked via honeypot field.');
    return {
      success: true,
      inquiry: {
        id: `inq-hp-${Date.now()}`,
        customer_name: input.customer_name,
        email: input.email,
        phone: input.phone || null,
        whatsapp: input.whatsapp || null,
        tour_id: input.tour_id || null,
        subject: input.subject,
        message: input.message,
        status: 'new',
        source: 'web',
        ip_address: null,
        admin_notes: 'Dropped honeypot bot trap',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
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

  const cleanName = sanitizeString(input.customer_name);
  const cleanEmail = sanitizeString(input.email).toLowerCase();
  const cleanSubject = sanitizeString(input.subject);
  const cleanMessage = sanitizeString(input.message);
  const cleanPhone = input.phone ? sanitizeString(input.phone) : null;
  const cleanWhatsapp = input.whatsapp ? sanitizeString(input.whatsapp) : cleanPhone;

  if (!cleanName || !cleanEmail || !cleanMessage) {
    return {
      success: false,
      error: 'Please fill in your name, email address, and inquiry message.',
    };
  }

  if (!isValidEmail(cleanEmail)) {
    return {
      success: false,
      error: 'Please provide a valid email address.',
    };
  }

  const generatedId = `inq-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  const newInquiry: DbInquiry = {
    id: generatedId,
    customer_name: cleanName,
    email: cleanEmail,
    phone: cleanPhone,
    whatsapp: cleanWhatsapp,
    tour_id: input.tour_id || null,
    subject: cleanSubject || 'General Excursion Assistance',
    message: cleanMessage,
    status: 'new',
    source: input.source || 'web',
    ip_address: null,
    admin_notes: input.tour_title ? `Referenced Tour: ${input.tour_title}` : null,
    created_at: now,
    updated_at: now,
  };

  // 1. Identify existing customer where possible
  let identifiedCustomerId: string | null = null;
  if (isSupabaseConfigured()) {
    try {
      const { data: cust } = await supabase
        .from('customers')
        .select('id')
        .eq('email', cleanEmail)
        .maybeSingle();
      if (cust) {
        identifiedCustomerId = cust.id;
      }
    } catch {}
  }
  if (!identifiedCustomerId) {
    try {
      const rawCusts = localStorage.getItem('rse_customers_cache');
      if (rawCusts) {
        const custs = JSON.parse(rawCusts);
        const match = custs.find((c: any) => c.email?.toLowerCase() === cleanEmail);
        if (match) identifiedCustomerId = match.id;
      }
    } catch {}
  }

  // 2. Automatically create CRM Lead for this inquiry
  let createdLeadId: string | null = null;
  try {
    const lead = await createLead({
      name: cleanName,
      email: cleanEmail,
      phone: cleanPhone || undefined,
      whatsapp: cleanWhatsapp || undefined,
      source: input.source === 'whatsapp' ? 'WhatsApp' : input.source === 'phone' ? 'Phone' : 'Website',
      interestedTourId: input.tour_id || undefined,
      interestedTourTitle: input.tour_title || undefined,
      notes: `Help Inquiry: ${cleanSubject} — ${cleanMessage}`,
      stage: 'New',
      customerId: identifiedCustomerId || undefined,
      estimatedValue: 120,
    });
    if (lead) {
      createdLeadId = lead.id;
    }
  } catch (leadErr) {
    console.warn('Lead creation for inquiry notice:', leadErr);
  }

  // 3. Create CRM Timeline Activity Event
  try {
    await recordActivity({
      customerId: identifiedCustomerId || undefined,
      leadId: createdLeadId || undefined,
      eventType: 'inquiry_created',
      title: `Inquiry Received: ${cleanSubject}`,
      description: cleanMessage,
      actor: cleanName,
      metadata: {
        inquiryId: generatedId,
        source: input.source || 'web',
        email: cleanEmail,
      },
    });
  } catch (actErr) {
    console.warn('CRM activity for inquiry notice:', actErr);
  }

  // 4. Create Internal Staff Notification
  try {
    const notifsRaw = localStorage.getItem('rse_staff_notifications') || '[]';
    const notifs = JSON.parse(notifsRaw);
    notifs.unshift({
      id: `notif-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      category: 'new_inquiry',
      dedupKey: `new_inquiry_${generatedId}`,
      title: `New Inquiry: ${cleanName}`,
      message: `${cleanName} inquired: "${cleanSubject}". Email: ${cleanEmail}`,
      severity: 'info',
      entityType: 'inquiry',
      entityId: generatedId,
      linkTab: 'inquiries',
      isRead: false,
      createdAt: now,
    });
    localStorage.setItem('rse_staff_notifications', JSON.stringify(notifs.slice(0, 100)));
  } catch {}

  // 5. Trigger Automation Event
  try {
    await publishAutomationEvent(
      'inquiry.received' as any,
      {
        inquiryId: generatedId,
        leadId: createdLeadId,
        customerId: identifiedCustomerId,
        name: cleanName,
        email: cleanEmail,
        subject: cleanSubject,
        message: cleanMessage,
        tourId: input.tour_id,
      },
      'inquiry',
      generatedId
    );
  } catch {}

  // 6. Save to local fallback cache immediately
  const localList = getStoredInquiries();
  saveStoredInquiries([newInquiry, ...localList]);

  // 7. Persist to Supabase if configured
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('inquiries')
        .insert({
          customer_name: cleanName,
          email: cleanEmail,
          phone: cleanPhone,
          whatsapp: cleanWhatsapp,
          tour_id: input.tour_id || null,
          subject: cleanSubject || 'General Excursion Assistance',
          message: cleanMessage,
          status: 'new',
          source: input.source || 'web',
          admin_notes: input.tour_title ? `Referenced Tour: ${input.tour_title}` : null,
          ...(input.website_url_hp ? { website_url_hp: input.website_url_hp } : {}),
        })
        .select('*')
        .single();

      if (error) {
        if (error.message?.includes('Rate limit exceeded') || error.code === 'P0001') {
          return {
            success: false,
            error: error.message || 'Rate limit exceeded: Please wait a few minutes before sending another inquiry.',
          };
        }
        console.warn('Notice: Inquiries table insert error (using local state):', error.message);
      } else if (data) {
        return { success: true, inquiry: data as DbInquiry };
      }
    } catch (err: any) {
      if (err?.message?.includes('Rate limit exceeded')) {
        return { success: false, error: err.message };
      }
      console.warn('Supabase inquiries table connection issue:', err);
    }
  }

  inquiryRateLimiter.recordFailedAttempt();
  return { success: true, inquiry: newInquiry };
}

/**
 * Lists all inquiries for the admin dashboard.
 */
export async function listInquiries(filter?: { status?: string }): Promise<DbInquiry[]> {
  if (isSupabaseConfigured() && !isSchemaMissing()) {
    try {
      let query = supabase
        .from('inquiries')
        .select('*')
        .order('created_at', { ascending: false });

      if (filter?.status && filter.status !== 'all') {
        query = query.eq('status', filter.status);
      }

      const { data, error } = await query;
      if (error) {
        if (isSchemaMissingError(error)) {
          setSchemaMissing(true);
        } else {
          console.error('Inquiries query error:', formatSupabaseError(error));
          throw new Error(formatSupabaseError(error));
        }
      } else if (data) {
        return data as DbInquiry[];
      }
    } catch (err) {
      if (isSchemaMissingError(err)) {
        setSchemaMissing(true);
      } else {
        console.error('Failed to list inquiries from Supabase:', err);
        throw err;
      }
    }
  }

  const localList = getStoredInquiries();
  if (filter?.status && filter.status !== 'all') {
    return localList.filter((item) => item.status === filter.status);
  }
  return localList;
}

/**
 * Updates inquiry status or admin notes
 */
export async function updateInquiryStatus(
  id: string,
  status: DbInquiry['status'],
  adminNotes?: string
): Promise<boolean> {
  const now = new Date().toISOString();

  // 1. Update in local storage
  const localList = getStoredInquiries();
  const updated = localList.map((item) => {
    if (item.id === id) {
      return {
        ...item,
        status,
        admin_notes: adminNotes !== undefined ? adminNotes : item.admin_notes,
        updated_at: now,
      };
    }
    return item;
  });
  saveStoredInquiries(updated);

  // 2. Update in Supabase
  if (isSupabaseConfigured()) {
    try {
      const updates: Record<string, unknown> = {
        status,
        updated_at: now,
      };
      if (adminNotes !== undefined) {
        updates.admin_notes = adminNotes;
      }

      const { error } = await supabase
        .from('inquiries')
        .update(updates)
        .eq('id', id);

      if (error) {
        throw new Error(formatSupabaseError(error));
      }
    } catch (err: any) {
      console.error('Failed to update inquiry in Supabase:', err);
      throw err;
    }
  }

  return true;
}

/**
 * Deletes an inquiry
 */
export async function deleteInquiry(id: string): Promise<boolean> {
  // Local deletion
  const localList = getStoredInquiries();
  saveStoredInquiries(localList.filter((item) => item.id !== id));

  // Supabase deletion
  if (isSupabaseConfigured()) {
    try {
      const { error } = await supabase.from('inquiries').delete().eq('id', id);
      if (error) {
        throw new Error(formatSupabaseError(error));
      }
    } catch (err: any) {
      console.error('Failed to delete inquiry from Supabase:', err);
      throw err;
    }
  }

  return true;
}
