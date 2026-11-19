import { supabase, isSupabaseConfigured, formatSupabaseError } from './supabaseClient';
import {
  CrmLead,
  LeadStage,
  LeadSource,
  CrmLeadStageConfig,
  CrmTask,
  TaskStatus,
  TaskPriority,
  FollowUpChannel,
  CrmCommunication,
  CommChannel,
  CrmConversationRecord,
  ConversationProvider,
  ConversationProviderStatus,
  CrmNote,
  CrmActivity,
  CrmCustomerDetail,
  CrmDashboardMetrics,
  CrmTag,
  CrmSegment,
} from '../types/crm';
import { bookingRepository } from './bookingRepository';
import { listInquiries } from './inquiryService';
import { Booking } from '../types/booking';

export type {
  CrmLead,
  LeadStage,
  LeadSource,
  CrmLeadStageConfig,
  CrmTask,
  TaskStatus,
  TaskPriority,
  FollowUpChannel,
  CrmCommunication,
  CommChannel,
  CrmConversationRecord,
  ConversationProvider,
  ConversationProviderStatus,
  CrmNote,
  CrmActivity,
  CrmCustomerDetail,
  CrmDashboardMetrics,
  CrmTag,
  CrmSegment,
};

const LOCAL_LEADS_KEY = 'rse_crm_leads';
const LOCAL_TASKS_KEY = 'rse_crm_tasks';
const LOCAL_COMMS_KEY = 'rse_crm_comms';
const LOCAL_NOTES_KEY = 'rse_crm_notes';
const LOCAL_ACTIVITIES_KEY = 'rse_crm_activities';
const LOCAL_CONVERSATIONS_KEY = 'rse_crm_conversations';
const LOCAL_TAGS_KEY = 'rse_crm_tags';
const LOCAL_CUSTOMERS_EXTRA_KEY = 'rse_crm_customers_extra';

export const DEFAULT_STAGES: CrmLeadStageConfig[] = [
  { id: 'stg-1', name: 'New', label: 'New Lead', color: '#38bdf8', sortOrder: 1, isActive: true, isWon: false, isLost: false },
  { id: 'stg-2', name: 'Contacted', label: 'Contacted', color: '#818cf8', sortOrder: 2, isActive: true, isWon: false, isLost: false },
  { id: 'stg-3', name: 'Qualified', label: 'Qualified Prospect', color: '#a78bfa', sortOrder: 3, isActive: true, isWon: false, isLost: false },
  { id: 'stg-4', name: 'Proposal', label: 'Proposal / Quotation', color: '#fbbf24', sortOrder: 4, isActive: true, isWon: false, isLost: false },
  { id: 'stg-5', name: 'Follow-up', label: 'Follow-up Due', color: '#f97316', sortOrder: 5, isActive: true, isWon: false, isLost: false },
  { id: 'stg-6', name: 'Won', label: 'Won / Booked', color: '#10b981', sortOrder: 6, isActive: true, isWon: true, isLost: false },
  { id: 'stg-7', name: 'Lost', label: 'Lost Deal', color: '#ef4444', sortOrder: 7, isActive: true, isWon: false, isLost: true },
];

export const DEFAULT_TAGS: CrmTag[] = [
  { id: 'tag-1', name: 'VIP', description: 'High-value executive guests requiring white-glove concierge', color: '#fbbf24', category: 'tier', usageCount: 4, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'tag-2', name: 'repeat_customer', description: 'Traveled more than once with Awesome Adventure Tours', color: '#34d399', category: 'loyalty', usageCount: 6, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'tag-3', name: 'family', description: 'Traveling with children or multi-generational parties', color: '#60a5fa', category: 'interest', usageCount: 12, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'tag-4', name: 'diving', description: 'Certified scuba divers or PADI course seekers', color: '#06b6d4', category: 'interest', usageCount: 8, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'tag-5', name: 'snorkeling', description: 'Reef exploration and dolphin encounters', color: '#2dd4bf', category: 'interest', usageCount: 15, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'tag-6', name: 'safari', description: 'Desert quad, dune buggy, and Bedouin evening dinner', color: '#f97316', category: 'interest', usageCount: 11, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'tag-7', name: 'honeymoon', description: 'Couples celebrating wedding, anniversary or honeymoon', color: '#f43f5e', category: 'interest', usageCount: 5, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'tag-8', name: 'high_value', description: 'High cumulative booking spenders (€500+)', color: '#a855f7', category: 'tier', usageCount: 7, createdAt: '2026-01-01T00:00:00Z' },
];

// Helper storage functions
function getLocal<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultValue;
    return JSON.parse(raw);
  } catch {
    return defaultValue;
  }
}

function setLocal<T>(key: string, data: T) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // ignore
  }
}

function useLocalCrmData(message: string): boolean {
  if (isSupabaseConfigured()) return false;
  if (import.meta.env.DEV) return true;
  throw new Error(message);
}

// ------------------------------------------------------------------------------
// LEADS SERVICE
// ------------------------------------------------------------------------------

export async function listLeads(filter?: {
  stage?: string;
  source?: string;
  search?: string;
  staff?: string;
  tourId?: string;
  status?: string;
}): Promise<CrmLead[]> {
  if (useLocalCrmData('Supabase is not configured; CRM leads cannot be loaded in production.')) {
    return applyLeadClientFilters(getLocal<CrmLead[]>(LOCAL_LEADS_KEY, []), filter);
  }

  let query = supabase
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false });

  if (filter?.stage && filter.stage !== 'all') query = query.eq('stage', filter.stage);
  if (filter?.source && filter.source !== 'all') query = query.eq('source', filter.source);
  if (filter?.status && filter.status !== 'all') query = query.eq('status', filter.status);

  const { data, error } = await query;
  if (error) throw new Error(formatSupabaseError(error));
  if (!data) throw new Error('CRM leads could not be loaded from the database.');

  const leads: CrmLead[] = data.map((d) => ({
    id: d.id,
    name: d.name,
    email: d.email || '',
    phone: d.phone,
    whatsapp: d.whatsapp,
    country: d.country,
    hotel: d.hotel,
    source: (d.source as LeadSource) || 'Website',
    interestedTourId: d.interested_tour_id,
    interestedTourTitle: d.interested_tour_title,
    destination: d.destination,
    travelDate: d.travel_date,
    numberOfGuests: d.number_of_guests || 1,
    estimatedValue: Number(d.estimated_value) || 0,
    currency: d.currency || 'EUR',
    stage: (d.stage as LeadStage) || 'New',
    status: d.status || 'active',
    score: d.score !== undefined ? d.score : 50,
    notes: d.notes,
    tags: d.tags || [],
    assignedStaffId: d.assigned_staff_id,
    assignedStaffName: d.assigned_staff_name,
    customerId: d.customer_id,
    followUpDate: d.follow_up_date,
    lastContactAt: d.last_contact_at,
    contactAttemptsCount: d.contact_attempts_count || 0,
    lostReason: d.lost_reason,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  }));
  setLocal(LOCAL_LEADS_KEY, leads);
  return applyLeadClientFilters(leads, filter);
}

function applyLeadClientFilters(
  leads: CrmLead[],
  filter?: {
    stage?: string;
    source?: string;
    search?: string;
    staff?: string;
    tourId?: string;
    status?: string;
  }
): CrmLead[] {
  return leads.filter((l) => {
    if (filter?.stage && filter.stage !== 'all' && l.stage !== filter.stage) return false;
    if (filter?.source && filter.source !== 'all' && l.source !== filter.source) return false;
    if (filter?.status && filter.status !== 'all' && l.status !== filter.status) return false;
    if (filter?.staff && filter.staff !== 'all' && l.assignedStaffName !== filter.staff) return false;
    if (filter?.tourId && filter.tourId !== 'all' && l.interestedTourId !== filter.tourId) return false;
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      return (
        l.name.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q) ||
        (l.phone && l.phone.includes(q)) ||
        (l.hotel && l.hotel.toLowerCase().includes(q)) ||
        (l.interestedTourTitle && l.interestedTourTitle.toLowerCase().includes(q)) ||
        (l.country && l.country.toLowerCase().includes(q))
      );
    }
    return true;
  });
}

export async function createLead(input: Partial<CrmLead>): Promise<CrmLead> {
  const localMode = useLocalCrmData('Supabase is not configured; CRM leads cannot be created in production.');
  const now = new Date().toISOString();
  const newLead: CrmLead = {
    id: `lead-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
    name: input.name || 'Anonymous Inquiry',
    email: input.email || '',
    phone: input.phone || null,
    whatsapp: input.whatsapp || input.phone || null,
    country: input.country || null,
    hotel: input.hotel || null,
    source: input.source || 'Website',
    interestedTourId: input.interestedTourId || null,
    interestedTourTitle: input.interestedTourTitle || null,
    destination: input.destination || null,
    travelDate: input.travelDate || null,
    numberOfGuests: input.numberOfGuests || 2,
    estimatedValue: input.estimatedValue !== undefined ? input.estimatedValue : 0,
    currency: input.currency || 'EUR',
    stage: input.stage || 'New',
    status: 'active',
    score: input.score !== undefined ? input.score : 50,
    notes: input.notes || null,
    tags: input.tags || [],
    assignedStaffId: input.assignedStaffId || null,
    assignedStaffName: input.assignedStaffName || null,
    customerId: input.customerId || null,
    followUpDate: input.followUpDate || null,
    lastContactAt: null,
    contactAttemptsCount: 0,
    lostReason: input.lostReason || null,
    createdAt: now,
    updatedAt: now,
  };

  if (!localMode) {
    const { data, error } = await supabase
      .from('leads')
      .insert({
        name: newLead.name,
        email: newLead.email,
        phone: newLead.phone,
        whatsapp: newLead.whatsapp,
        country: newLead.country,
        hotel: newLead.hotel,
        source: newLead.source,
        interested_tour_id: newLead.interestedTourId,
        interested_tour_title: newLead.interestedTourTitle,
        destination: newLead.destination,
        travel_date: newLead.travelDate,
        number_of_guests: newLead.numberOfGuests,
        estimated_value: newLead.estimatedValue,
        currency: newLead.currency,
        stage: newLead.stage,
        status: newLead.status,
        score: newLead.score,
        notes: newLead.notes,
        tags: newLead.tags,
        assigned_staff_name: newLead.assignedStaffName,
        assigned_staff_id: newLead.assignedStaffId,
        customer_id: newLead.customerId,
        follow_up_date: newLead.followUpDate,
      })
      .select('*')
      .single();

    if (error) throw new Error(formatSupabaseError(error));
    if (!data) throw new Error('The CRM lead was not saved; no database record was returned.');
    newLead.id = data.id;
    newLead.createdAt = data.created_at || now;
    newLead.updatedAt = data.updated_at || now;
  }

  const leads = getLocal<CrmLead[]>(LOCAL_LEADS_KEY, []);
  setLocal(LOCAL_LEADS_KEY, [newLead, ...leads]);

  await recordActivity({
    leadId: newLead.id,
    eventType: 'lead_created',
    title: 'Lead Created',
    description: `${newLead.name} added via ${newLead.source} for ${newLead.interestedTourTitle || 'excursion inquiry'}.`,
    actor: newLead.assignedStaffName || 'Signed-in staff',
  });

  return newLead;
}

export async function updateLead(leadId: string, updates: Partial<CrmLead>): Promise<boolean> {
  if (!leadId.trim()) throw new Error('A lead ID is required.');
  const localMode = useLocalCrmData('Supabase is not configured; CRM leads cannot be updated in production.');
  const now = new Date().toISOString();

  if (!localMode) {
    const { data, error } = await supabase
      .from('leads')
      .update({
        name: updates.name,
        email: updates.email,
        phone: updates.phone,
        whatsapp: updates.whatsapp,
        country: updates.country,
        hotel: updates.hotel,
        source: updates.source,
        interested_tour_id: updates.interestedTourId,
        interested_tour_title: updates.interestedTourTitle,
        destination: updates.destination,
        travel_date: updates.travelDate,
        number_of_guests: updates.numberOfGuests,
        estimated_value: updates.estimatedValue,
        currency: updates.currency,
        stage: updates.stage,
        status: updates.status,
        score: updates.score,
        notes: updates.notes,
        tags: updates.tags,
        assigned_staff_name: updates.assignedStaffName,
        assigned_staff_id: updates.assignedStaffId,
        customer_id: updates.customerId,
        follow_up_date: updates.followUpDate,
        lost_reason: updates.lostReason,
        updated_at: now,
      })
      .eq('id', leadId)
      .select('id')
      .maybeSingle();

    if (error) throw new Error(formatSupabaseError(error));
    if (!data) throw new Error('The CRM lead was not updated because it no longer exists or is not accessible.');
  }

  const leads = getLocal<CrmLead[]>(LOCAL_LEADS_KEY, []);
  const updated = leads.map((lead) =>
    lead.id === leadId ? { ...lead, ...updates, updatedAt: now } : lead
  );
  setLocal(LOCAL_LEADS_KEY, updated);
  return true;
}

export async function updateLeadStage(
  leadId: string,
  newStage: LeadStage,
  lostReason?: string
): Promise<boolean> {
  const leads = await listLeads();
  const target = leads.find((lead) => lead.id === leadId);
  if (!target) throw new Error('Lead not found or no longer accessible.');
  const oldStage = target.stage;
  const status = newStage === 'Won' ? 'converted' : newStage === 'Lost' ? 'lost' : 'active';
  const localMode = useLocalCrmData('Supabase is not configured; CRM lead stages cannot be updated in production.');
  const now = new Date().toISOString();

  if (!localMode) {
    const { data, error } = await supabase
      .from('leads')
      .update({ stage: newStage, status, lost_reason: newStage === 'Lost' ? lostReason : null, updated_at: now })
      .eq('id', leadId)
      .select('id')
      .maybeSingle();
    if (error) throw new Error(formatSupabaseError(error));
    if (!data) throw new Error('The lead stage was not updated because the lead no longer exists or is not accessible.');
  }

  setLocal(LOCAL_LEADS_KEY, leads.map((lead) => lead.id === leadId
    ? { ...lead, stage: newStage, status: status as any, lostReason: newStage === 'Lost' ? lostReason || lead.lostReason : null, updatedAt: now }
    : lead
  ));

  await recordActivity({
    leadId,
    eventType: 'stage_changed',
    title: `Stage Changed: ${newStage}`,
    description: `Lead moved from "${oldStage}" to "${newStage}"${lostReason ? ` (Reason: ${lostReason})` : ''}.`,
    actor: 'Signed-in staff',
  });
  return true;
}

export async function recordLeadContactAttempt(
  leadId: string,
  channel: FollowUpChannel,
  notes: string,
  staffName: string = 'Signed-in staff'
): Promise<boolean> {
  const leads = getLocal<CrmLead[]>(LOCAL_LEADS_KEY, []);
  const target = leads.find((l) => l.id === leadId);
  const newAttempts = (target?.contactAttemptsCount || 0) + 1;
  const now = new Date().toISOString();

  await updateLead(leadId, {
    contactAttemptsCount: newAttempts,
    lastContactAt: now,
  });

  await recordActivity({
    leadId,
    eventType: 'contact_attempt',
    title: `Contact Attempt via ${channel}`,
    description: notes || `Attempted contact with lead via ${channel}.`,
    actor: staffName,
  });

  return true;
}

export async function deleteLead(leadId: string): Promise<boolean> {
  if (!leadId.trim()) throw new Error('A lead ID is required.');
  const localMode = useLocalCrmData('Supabase is not configured; CRM leads cannot be deleted in production.');

  if (!localMode) {
    const { data, error } = await supabase
      .from('leads')
      .delete()
      .eq('id', leadId)
      .select('id')
      .maybeSingle();
    if (error) throw new Error(formatSupabaseError(error));
    if (!data) throw new Error('The lead was not deleted because it no longer exists or is not accessible.');
  }

  const leads = getLocal<CrmLead[]>(LOCAL_LEADS_KEY, []);
  setLocal(LOCAL_LEADS_KEY, leads.filter((lead) => lead.id !== leadId));
  return true;
}

// ------------------------------------------------------------------------------
// TASKS & FOLLOW-UPS SERVICE
// ------------------------------------------------------------------------------

export async function listTasks(filter?: {
  status?: string;
  staff?: string;
  priority?: string;
  isFollowUp?: boolean;
}): Promise<CrmTask[]> {
  if (!isSupabaseConfigured()) {
    if (!import.meta.env.DEV) {
      throw new Error('Supabase is not configured; CRM tasks cannot be loaded in production.');
    }
    return filterTasksClient(getLocal<CrmTask[]>(LOCAL_TASKS_KEY, []), filter);
  }

  let query = supabase
    .from('crm_tasks')
    .select('*')
    .order('created_at', { ascending: false });

  if (filter?.status && filter.status !== 'all') {
    query = query.eq('status', filter.status);
  }
  if (filter?.priority && filter.priority !== 'all') {
    query = query.eq('priority', filter.priority);
  }
  if (filter?.isFollowUp !== undefined) {
    query = query.eq('is_follow_up', filter.isFollowUp);
  }

  const { data, error } = await query;
  if (error) throw new Error(formatSupabaseError(error));
  if (!data) throw new Error('CRM tasks could not be loaded from the database.');

  const tasks: CrmTask[] = data.map((d) => ({
    id: d.id,
    title: d.title,
    description: d.description,
    customerId: d.customer_id,
    customerName: d.customer_name,
    leadId: d.lead_id,
    leadName: d.lead_name,
    bookingId: d.booking_id,
    bookingReference: d.booking_reference,
    assignedStaffId: d.assigned_staff_id,
    assignedStaffName: d.assigned_staff_name,
    dueDate: d.due_date,
    priority: (d.priority as TaskPriority) || 'Medium',
    status: (d.status as TaskStatus) || 'Pending',
    isFollowUp: Boolean(d.is_follow_up),
    followUpChannel: (d.follow_up_channel as FollowUpChannel) || 'Phone',
    outcomeNotes: d.outcome_notes,
    completedAt: d.completed_at,
    completedByName: d.completed_by_name,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  }));

  setLocal(LOCAL_TASKS_KEY, tasks);
  return filterTasksClient(tasks, filter);
}

function filterTasksClient(tasks: CrmTask[], filter?: { status?: string; staff?: string; priority?: string; isFollowUp?: boolean }) {
  return tasks.filter((t) => {
    if (filter?.status && filter.status !== 'all' && t.status !== filter.status) return false;
    if (filter?.priority && filter.priority !== 'all' && t.priority !== filter.priority) return false;
    if (filter?.staff && filter.staff !== 'all' && t.assignedStaffName !== filter.staff) return false;
    if (filter?.isFollowUp !== undefined && t.isFollowUp !== filter.isFollowUp) return false;
    return true;
  });
}

export async function createTask(input: Partial<CrmTask>): Promise<CrmTask> {
  const newTask: CrmTask = {
    id: `task-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
    title: input.title || 'Untitled Task',
    description: input.description || null,
    customerId: input.customerId || null,
    customerName: input.customerName || null,
    leadId: input.leadId || null,
    leadName: input.leadName || null,
    bookingId: input.bookingId || null,
    bookingReference: input.bookingReference || null,
    assignedStaffId: input.assignedStaffId || null,
    assignedStaffName: input.assignedStaffName || 'Admin Staff',
    dueDate: input.dueDate || new Date(Date.now() + 86400000).toISOString(),
    priority: input.priority || 'Medium',
    status: input.status || 'Pending',
    isFollowUp: input.isFollowUp !== undefined ? input.isFollowUp : false,
    followUpChannel: input.followUpChannel || 'Phone',
    outcomeNotes: null,
    completedAt: null,
    completedByName: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('crm_tasks')
      .insert({
        title: newTask.title,
        description: newTask.description,
        customer_id: newTask.customerId,
        customer_name: newTask.customerName,
        lead_id: newTask.leadId,
        lead_name: newTask.leadName,
        booking_id: newTask.bookingId,
        booking_reference: newTask.bookingReference,
        assigned_staff_id: newTask.assignedStaffId,
        assigned_staff_name: newTask.assignedStaffName,
        due_date: newTask.dueDate,
        priority: newTask.priority,
        status: newTask.status,
        is_follow_up: newTask.isFollowUp,
        follow_up_channel: newTask.followUpChannel,
      })
      .select('*')
      .maybeSingle();

    if (error) throw new Error(formatSupabaseError(error));
    if (!data) throw new Error('The CRM task was not saved; no database record was returned.');
    newTask.id = data.id;
    newTask.createdAt = data.created_at || newTask.createdAt;
    newTask.updatedAt = data.updated_at || newTask.updatedAt;
  } else if (!import.meta.env.DEV) {
    throw new Error('Supabase is not configured; CRM tasks cannot be created in production.');
  }

  const tasks = getLocal<CrmTask[]>(LOCAL_TASKS_KEY, []);
  setLocal(LOCAL_TASKS_KEY, [newTask, ...tasks]);

  await recordActivity({
    customerId: newTask.customerId,
    leadId: newTask.leadId,
    eventType: newTask.isFollowUp ? 'followup_scheduled' : 'task_created',
    title: newTask.isFollowUp ? `Follow-up Scheduled: ${newTask.title}` : `Task Created: ${newTask.title}`,
    description: `Assigned to ${newTask.assignedStaffName}. Due: ${newTask.dueDate?.split('T')[0]}.`,
    actor: newTask.assignedStaffName || 'Admin Staff',
  });

  return newTask;
}

export async function updateTask(taskId: string, updates: Partial<CrmTask>): Promise<boolean> {
  if (!taskId.trim()) throw new Error('A task ID is required.');

  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('crm_tasks')
      .update({
        title: updates.title,
        description: updates.description,
        customer_id: updates.customerId,
        customer_name: updates.customerName,
        lead_id: updates.leadId,
        lead_name: updates.leadName,
        booking_id: updates.bookingId,
        booking_reference: updates.bookingReference,
        assigned_staff_id: updates.assignedStaffId,
        assigned_staff_name: updates.assignedStaffName,
        due_date: updates.dueDate,
        priority: updates.priority,
        status: updates.status,
        outcome_notes: updates.outcomeNotes,
        follow_up_channel: updates.followUpChannel,
        completed_at: updates.completedAt,
        completed_by_name: updates.completedByName,
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId)
      .select('id')
      .maybeSingle();

    if (error) throw new Error(formatSupabaseError(error));
    if (!data) throw new Error('The CRM task was not updated because it no longer exists or is not accessible.');
  } else if (!import.meta.env.DEV) {
    throw new Error('Supabase is not configured; CRM tasks cannot be updated in production.');
  }

  const tasks = getLocal<CrmTask[]>(LOCAL_TASKS_KEY, []);
  const updated = tasks.map((t) =>
    t.id === taskId
      ? { ...t, ...updates, updatedAt: new Date().toISOString() }
      : t
  );
  setLocal(LOCAL_TASKS_KEY, updated);

  return true;
}

export async function updateTaskStatus(
  taskId: string,
  newStatus: TaskStatus,
  outcomeNotes?: string,
  completedByName: string = 'Admin Staff'
): Promise<boolean> {
  const isCompleted = newStatus === 'Completed';
  const completedAt = isCompleted ? new Date().toISOString() : null;

  await updateTask(taskId, {
    status: newStatus,
    completedAt,
    outcomeNotes: outcomeNotes || null,
    completedByName: isCompleted ? completedByName : null,
  });

  const tasks = getLocal<CrmTask[]>(LOCAL_TASKS_KEY, []);
  const target = tasks.find((t) => t.id === taskId);

  if (target) {
    await recordActivity({
      customerId: target.customerId,
      leadId: target.leadId,
      eventType: isCompleted ? 'task_completed' : 'task',
      title: isCompleted ? `Completed: ${target.title}` : `Task Status: ${newStatus}`,
      description: outcomeNotes || `Task marked as "${newStatus}" by ${completedByName}.`,
      actor: completedByName,
    });
  }

  return true;
}

export async function deleteTask(taskId: string): Promise<boolean> {
  if (!taskId.trim()) throw new Error('A task ID is required.');

  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('crm_tasks')
      .delete()
      .eq('id', taskId)
      .select('id')
      .maybeSingle();

    if (error) throw new Error(formatSupabaseError(error));
    if (!data) throw new Error('The CRM task was not deleted because it no longer exists or is not accessible.');
  } else if (!import.meta.env.DEV) {
    throw new Error('Supabase is not configured; CRM tasks cannot be deleted in production.');
  }

  const tasks = getLocal<CrmTask[]>(LOCAL_TASKS_KEY, []);
  setLocal(LOCAL_TASKS_KEY, tasks.filter((t) => t.id !== taskId));
  return true;
}

export async function getFollowUpsDue(): Promise<{
  overdue: CrmTask[];
  dueToday: CrmTask[];
  upcoming: CrmTask[];
}> {
  const allTasks = await listTasks({ isFollowUp: true });
  const pending = allTasks.filter((t) => t.status === 'Pending' || t.status === 'In Progress');

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  const overdue: CrmTask[] = [];
  const dueToday: CrmTask[] = [];
  const upcoming: CrmTask[] = [];

  pending.forEach((task) => {
    if (!task.dueDate) {
      upcoming.push(task);
      return;
    }
    const dueDay = task.dueDate.split('T')[0];
    if (dueDay < todayStr) {
      overdue.push(task);
    } else if (dueDay === todayStr) {
      dueToday.push(task);
    } else {
      upcoming.push(task);
    }
  });

  return { overdue, dueToday, upcoming };
}

// ------------------------------------------------------------------------------
// CONVERSATIONS SYSTEM (EMAIL & WHATSAPP INTEGRATION)
// ------------------------------------------------------------------------------

export async function listConversations(filter?: {
  customerId?: string;
  leadId?: string;
  bookingId?: string;
  channel?: string;
}): Promise<CrmConversationRecord[]> {
  if (useLocalCrmData('Supabase is not configured; CRM conversations cannot be loaded in production.')) {
    return getLocal<CrmConversationRecord[]>(LOCAL_CONVERSATIONS_KEY, []).filter((item) => {
      if (filter?.customerId && item.customerId !== filter.customerId) return false;
      if (filter?.leadId && item.leadId !== filter.leadId) return false;
      if (filter?.bookingId && item.bookingId !== filter.bookingId) return false;
      if (filter?.channel && filter.channel !== 'all' && item.channel !== filter.channel) return false;
      return true;
    });
  }

  let query = supabase.from('crm_conversations').select('*').order('created_at', { ascending: false });
  if (filter?.customerId) query = query.eq('customer_id', filter.customerId);
  if (filter?.leadId) query = query.eq('lead_id', filter.leadId);
  if (filter?.bookingId) query = query.eq('booking_id', filter.bookingId);
  if (filter?.channel && filter.channel !== 'all') query = query.eq('channel', filter.channel);

  const { data, error } = await query;
  if (error) throw new Error(formatSupabaseError(error));
  if (!data) throw new Error('CRM conversations could not be loaded from the database.');

  const conversations: CrmConversationRecord[] = data.map((d) => ({
    id: d.id,
    customerId: d.customer_id,
    leadId: d.lead_id,
    bookingId: d.booking_id,
    channel: d.channel,
    direction: d.direction,
    senderIdentifier: d.sender_identifier,
    recipientIdentifier: d.recipient_identifier,
    subject: d.subject,
    messageBody: d.message_body,
    provider: d.provider as ConversationProvider,
    providerMessageId: d.provider_message_id,
    providerStatus: d.provider_status as ConversationProviderStatus,
    errorDetails: d.error_details,
    staffId: d.staff_id,
    staffName: d.staff_name,
    metadata: d.metadata,
    createdAt: d.created_at,
  }));
  setLocal(LOCAL_CONVERSATIONS_KEY, conversations);
  return conversations;
}

export async function recordConversation(
  input: Omit<CrmConversationRecord, 'id' | 'createdAt'>
): Promise<CrmConversationRecord> {
  const localMode = useLocalCrmData('Supabase is not configured; CRM conversations cannot be saved in production.');
  const now = new Date().toISOString();
  const newRecord: CrmConversationRecord = {
    ...input,
    id: `conv-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
    createdAt: now,
  };

  if (!localMode) {
    const { data, error } = await supabase
      .from('crm_conversations')
      .insert({
        customer_id: newRecord.customerId,
        lead_id: newRecord.leadId,
        booking_id: newRecord.bookingId,
        channel: newRecord.channel,
        direction: newRecord.direction,
        sender_identifier: newRecord.senderIdentifier,
        recipient_identifier: newRecord.recipientIdentifier,
        subject: newRecord.subject,
        message_body: newRecord.messageBody,
        provider: newRecord.provider,
        provider_message_id: newRecord.providerMessageId,
        provider_status: newRecord.providerStatus,
        error_details: newRecord.errorDetails,
        staff_name: newRecord.staffName,
        staff_id: newRecord.staffId,
        metadata: newRecord.metadata || {},
      })
      .select('*')
      .single();

    if (error) throw new Error(formatSupabaseError(error));
    if (!data) throw new Error('The CRM conversation was not saved; no database record was returned.');
    newRecord.id = data.id;
    newRecord.createdAt = data.created_at || now;
  }

  const list = getLocal<CrmConversationRecord[]>(LOCAL_CONVERSATIONS_KEY, []);
  setLocal(LOCAL_CONVERSATIONS_KEY, [newRecord, ...list]);

  await recordActivity({
    customerId: newRecord.customerId,
    leadId: newRecord.leadId,
    bookingId: newRecord.bookingId,
    eventType: 'conversation',
    title: `${newRecord.channel.toUpperCase()} (${newRecord.direction}): ${newRecord.subject || newRecord.recipientIdentifier}`,
    description: newRecord.messageBody.substring(0, 150),
    actor: newRecord.staffName,
  });

  return newRecord;
}

// ------------------------------------------------------------------------------
// COMMUNICATIONS & NOTES (LEGACY & EXTENDED WRAPPERS)
// ------------------------------------------------------------------------------

export async function listCommunications(filter?: {
  customerId?: string;
  leadId?: string;
}): Promise<CrmCommunication[]> {
  if (useLocalCrmData('Supabase is not configured; CRM communication logs cannot be loaded in production.')) {
    return getLocal<CrmCommunication[]>(LOCAL_COMMS_KEY, []).filter((item) => {
      if (filter?.customerId && item.customerId !== filter.customerId) return false;
      if (filter?.leadId && item.leadId !== filter.leadId) return false;
      return true;
    });
  }

  let query = supabase.from('crm_communications').select('*').order('created_at', { ascending: false });
  if (filter?.customerId) query = query.eq('customer_id', filter.customerId);
  if (filter?.leadId) query = query.eq('lead_id', filter.leadId);

  const { data, error } = await query;
  if (error) throw new Error(formatSupabaseError(error));
  if (!data) throw new Error('CRM communication logs could not be loaded from the database.');

  const comms: CrmCommunication[] = data.map((d) => ({
    id: d.id,
    customerId: d.customer_id,
    customerName: d.customer_name,
    leadId: d.lead_id,
    bookingId: d.booking_id,
    channel: (d.channel as CommChannel) || 'WhatsApp',
    direction: (d.direction as 'inbound' | 'outbound') || 'outbound',
    summary: d.summary,
    content: d.content,
    staffName: d.staff_name,
    staffId: d.staff_id,
    createdAt: d.created_at,
  }));
  setLocal(LOCAL_COMMS_KEY, comms);
  return comms;
}

export async function recordCommunication(
  input: Partial<CrmCommunication>
): Promise<CrmCommunication> {
  const localMode = useLocalCrmData('Supabase is not configured; CRM communication logs cannot be saved in production.');
  const now = new Date().toISOString();
  const newComm: CrmCommunication = {
    id: `comm-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
    customerId: input.customerId || null,
    customerName: input.customerName || null,
    leadId: input.leadId || null,
    bookingId: input.bookingId || null,
    channel: input.channel || 'WhatsApp',
    direction: input.direction || 'outbound',
    summary: input.summary || 'Client Contact',
    content: input.content || null,
    staffName: input.staffName || 'Signed-in staff',
    staffId: input.staffId || null,
    createdAt: now,
  };

  if (!localMode) {
    const { data, error } = await supabase
      .from('crm_communications')
      .insert({
        customer_id: newComm.customerId,
        customer_name: newComm.customerName,
        lead_id: newComm.leadId,
        booking_id: newComm.bookingId,
        channel: newComm.channel,
        direction: newComm.direction,
        summary: newComm.summary,
        content: newComm.content,
        staff_name: newComm.staffName,
        staff_id: newComm.staffId,
      })
      .select('*')
      .single();

    if (error) throw new Error(formatSupabaseError(error));
    if (!data) throw new Error('The CRM communication was not saved; no database record was returned.');
    newComm.id = data.id;
    newComm.createdAt = data.created_at || now;
  }

  const comms = getLocal<CrmCommunication[]>(LOCAL_COMMS_KEY, []);
  setLocal(LOCAL_COMMS_KEY, [newComm, ...comms]);

  await recordActivity({
    customerId: newComm.customerId,
    leadId: newComm.leadId,
    eventType: 'communication',
    title: `${newComm.channel} (${newComm.direction}): ${newComm.summary}`,
    description: newComm.content || newComm.summary,
    actor: newComm.staffName,
  });

  return newComm;
}

export async function listNotes(filter?: {
  customerId?: string;
  leadId?: string;
}): Promise<CrmNote[]> {
  if (useLocalCrmData('Supabase is not configured; CRM notes cannot be loaded in production.')) {
    return getLocal<CrmNote[]>(LOCAL_NOTES_KEY, []).filter((item) => {
      if (filter?.customerId && item.customerId !== filter.customerId) return false;
      if (filter?.leadId && item.leadId !== filter.leadId) return false;
      return true;
    });
  }

  let query = supabase.from('crm_notes').select('*').order('created_at', { ascending: false });
  if (filter?.customerId) query = query.eq('customer_id', filter.customerId);
  if (filter?.leadId) query = query.eq('lead_id', filter.leadId);

  const { data, error } = await query;
  if (error) throw new Error(formatSupabaseError(error));
  if (!data) throw new Error('CRM notes could not be loaded from the database.');

  const notes: CrmNote[] = data.map((d) => ({
    id: d.id,
    customerId: d.customer_id,
    leadId: d.lead_id,
    bookingId: d.booking_id,
    content: d.content,
    staffName: d.staff_name,
    staffId: d.staff_id,
    isPinned: Boolean(d.is_pinned),
    createdAt: d.created_at,
  }));
  setLocal(LOCAL_NOTES_KEY, notes);
  return notes;
}

export async function addStaffNote(input: {
  customerId?: string;
  leadId?: string;
  bookingId?: string;
  content: string;
  staffName?: string;
  staffId?: string | null;
  isPinned?: boolean;
}): Promise<CrmNote> {
  const localMode = useLocalCrmData('Supabase is not configured; CRM notes cannot be saved in production.');
  const now = new Date().toISOString();
  const newNote: CrmNote = {
    id: `note-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
    customerId: input.customerId || null,
    leadId: input.leadId || null,
    bookingId: input.bookingId || null,
    content: input.content,
    staffName: input.staffName || 'Signed-in staff',
    staffId: input.staffId || null,
    isPinned: Boolean(input.isPinned),
    createdAt: now,
  };

  if (!localMode) {
    const { data, error } = await supabase
      .from('crm_notes')
      .insert({
        customer_id: newNote.customerId,
        lead_id: newNote.leadId,
        booking_id: newNote.bookingId,
        content: newNote.content,
        staff_name: newNote.staffName,
        staff_id: newNote.staffId,
        is_pinned: newNote.isPinned,
      })
      .select('*')
      .single();

    if (error) throw new Error(formatSupabaseError(error));
    if (!data) throw new Error('The CRM note was not saved; no database record was returned.');
    newNote.id = data.id;
    newNote.createdAt = data.created_at || now;
  }

  const notes = getLocal<CrmNote[]>(LOCAL_NOTES_KEY, []);
  setLocal(LOCAL_NOTES_KEY, [newNote, ...notes]);

  await recordActivity({
    customerId: newNote.customerId,
    leadId: newNote.leadId,
    eventType: 'staff_note',
    title: 'Staff Note Added',
    description: newNote.content,
    actor: newNote.staffName,
  });

  return newNote;
}

// ------------------------------------------------------------------------------
// UNIFIED TIMELINE & AUDIT ACTIVITIES
// ------------------------------------------------------------------------------

export async function recordActivity(input: Partial<CrmActivity>): Promise<CrmActivity> {
  const localMode = useLocalCrmData('Supabase is not configured; CRM activity cannot be recorded in production.');
  const now = new Date().toISOString();
  const newAct: CrmActivity = {
    id: `act-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
    customerId: input.customerId || null,
    leadId: input.leadId || null,
    bookingId: input.bookingId || null,
    eventType: input.eventType || 'staff_note',
    title: input.title || 'CRM Event',
    description: input.description || null,
    actor: input.actor || 'System',
    metadata: input.metadata || {},
    createdAt: now,
  };

  if (!localMode) {
    const { data, error } = await supabase
      .from('crm_activities')
      .insert({
        customer_id: newAct.customerId,
        lead_id: newAct.leadId,
        booking_id: newAct.bookingId,
        event_type: newAct.eventType,
        title: newAct.title,
        description: newAct.description,
        actor: newAct.actor,
        metadata: newAct.metadata,
      })
      .select('*')
      .single();

    if (error) throw new Error(formatSupabaseError(error));
    if (!data) throw new Error('The CRM activity was not saved; no database record was returned.');
    newAct.id = data.id;
    newAct.createdAt = data.created_at || now;
  }

  const activities = getLocal<CrmActivity[]>(LOCAL_ACTIVITIES_KEY, []);
  setLocal(LOCAL_ACTIVITIES_KEY, [newAct, ...activities]);
  return newAct;
}

export const logActivity = recordActivity;

export async function getGlobalActivityTimeline(limit: number = 60): Promise<CrmActivity[]> {
  if (useLocalCrmData('Supabase is not configured; CRM activity cannot be loaded in production.')) {
    return getLocal<CrmActivity[]>(LOCAL_ACTIVITIES_KEY, []).slice(0, limit);
  }

  const { data, error } = await supabase
    .from('crm_activities')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(formatSupabaseError(error));
  if (!data) throw new Error('CRM activity could not be loaded from the database.');

  const activities: CrmActivity[] = data.map((d) => ({
    id: d.id,
    customerId: d.customer_id,
    leadId: d.lead_id,
    bookingId: d.booking_id,
    eventType: d.event_type,
    title: d.title,
    description: d.description,
    actor: d.actor,
    metadata: d.metadata,
    createdAt: d.created_at,
  }));
  setLocal(LOCAL_ACTIVITIES_KEY, activities);
  return activities;
}

// ------------------------------------------------------------------------------
// CUSTOMER DIRECTORY & ENRICHED 360 PROFILE
// ------------------------------------------------------------------------------

export async function listCrmCustomers(
  searchQuery?: string,
  tagFilter?: string
): Promise<CrmCustomerDetail[]> {
  const [allBookings, allInquiries, extraMeta] = await Promise.all([
    bookingRepository.listBookings(),
    listInquiries(),
    Promise.resolve(getLocal<Record<string, any>>(LOCAL_CUSTOMERS_EXTRA_KEY, {})),
  ]);

  const customerMap = new Map<string, CrmCustomerDetail>();

  // Registered customer records are authoritative; database failures are never hidden by browser cache data.
  if (!useLocalCrmData('Supabase is not configured; CRM customer records cannot be loaded in production.')) {
    const { data: dbCustomers, error } = await supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new Error(formatSupabaseError(error));
    if (!dbCustomers) throw new Error('CRM customer records could not be loaded from the database.');

    dbCustomers.forEach((c) => {
      const email = (c.email || '').toLowerCase().trim();
      if (!email) return;

      customerMap.set(email, {
        id: c.id,
        fullName: `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Traveler',
        firstName: c.first_name,
        lastName: c.last_name,
        email,
        phone: c.phone || null,
        whatsapp: c.whatsapp || null,
        country: c.country || null,
        hotel: c.hotel || null,
        notes: c.notes || null,
        tags: c.tags || ['Customer'],
        status: (c.status as any) || 'active',
        firstBookingDate: c.first_booking_date || null,
        latestBookingDate: c.latest_booking_date || null,
        upcomingBookingDate: c.upcoming_booking_date || null,
        totalBookings: c.total_bookings_count || 0,
        completedBookings: c.completed_bookings_count || 0,
        cancelledBookings: c.cancelled_bookings_count || 0,
        totalRevenue: Number(c.total_revenue) || 0,
        outstandingAmount: Number(c.outstanding_amount) || 0,
        lastContactDate: c.last_contact_at || c.created_at,
        source: c.source || 'Website Booking',
        createdAt: c.created_at || new Date().toISOString(),
        role: 'customer',
        isRegistered: Boolean(c.user_id),
        bookings: [],
        inquiries: [],
        communications: [],
        staffNotes: [],
        tasks: [],
        activities: [],
        reviews: [],
      });
    });
  }

  // Correlate Bookings
  allBookings.forEach((b) => {
    const email = (b.customer?.email || '').toLowerCase().trim();
    if (!email) return;

    let cust = customerMap.get(email);
    const bookingDate = b.date || b.createdAt;
    const isCompleted = b.status === 'completed';
    const isCancelled = b.status === 'cancelled';
    const totalEur = b.pricing?.totalEur || 0;
    const isPaid = b.paymentStatus === 'paid';

    if (!cust) {
      const extra = extraMeta[email] || {};
      cust = {
        id: `cust-${email}`,
        fullName: `${b.customer.firstName || ''} ${b.customer.lastName || ''}`.trim() || 'Guest Traveler',
        firstName: b.customer.firstName,
        lastName: b.customer.lastName,
        email,
        phone: `${b.customer.countryCode || ''} ${b.customer.phoneNumber || ''}`.trim() || null,
        whatsapp: b.customer.whatsappNumber || null,
        country: b.customer.country || null,
        hotel: b.pickup?.hotelName || b.customer.hotelName || null,
        notes: extra.notes || null,
        tags: extra.tags || ['Customer'],
        status: 'active',
        firstBookingDate: bookingDate,
        latestBookingDate: bookingDate,
        upcomingBookingDate: null,
        totalBookings: 0,
        completedBookings: 0,
        cancelledBookings: 0,
        totalRevenue: 0,
        outstandingAmount: 0,
        lastContactDate: bookingDate,
        source: extra.source || 'Website Booking',
        createdAt: bookingDate || new Date().toISOString(),
        role: 'customer',
        isRegistered: Boolean((b as any).userId),
        bookings: [],
        inquiries: [],
        communications: [],
        staffNotes: [],
        tasks: [],
        activities: [],
        reviews: [],
      };
      customerMap.set(email, cust);
    }

    cust.bookings.push(b);
    cust.totalBookings += 1;
    if (isCompleted) cust.completedBookings += 1;
    if (isCancelled) cust.cancelledBookings += 1;
    cust.totalRevenue += totalEur;
    if (!isPaid && !isCancelled) {
      cust.outstandingAmount += totalEur;
    }

    if (!cust.firstBookingDate || bookingDate < cust.firstBookingDate) {
      cust.firstBookingDate = bookingDate;
    }
    if (!cust.latestBookingDate || bookingDate > cust.latestBookingDate) {
      cust.latestBookingDate = bookingDate;
      cust.lastContactDate = bookingDate;
    }
    const today = new Date().toISOString().split('T')[0];
    if (bookingDate >= today && b.status !== 'cancelled') {
      if (!cust.upcomingBookingDate || bookingDate < cust.upcomingBookingDate) {
        cust.upcomingBookingDate = bookingDate;
      }
    }
  });

  // Correlate Inquiries
  allInquiries.forEach((inq) => {
    const email = (inq.email || '').toLowerCase().trim();
    if (!email) return;

    let cust = customerMap.get(email);
    const extra = extraMeta[email] || {};

    if (!cust) {
      cust = {
        id: `cust-inq-${inq.id}`,
        fullName: inq.customer_name || 'Inquiry Contact',
        email,
        phone: inq.phone || null,
        whatsapp: inq.whatsapp || null,
        country: (inq as any).country || null,
        hotel: null,
        notes: extra.notes || inq.admin_notes || null,
        tags: extra.tags || ['Inquiry Lead'],
        status: 'active',
        firstBookingDate: null,
        latestBookingDate: null,
        upcomingBookingDate: null,
        totalBookings: 0,
        completedBookings: 0,
        cancelledBookings: 0,
        totalRevenue: 0,
        outstandingAmount: 0,
        lastContactDate: inq.created_at,
        source: inq.source || 'Website Help Form',
        createdAt: inq.created_at || new Date().toISOString(),
        role: 'customer',
        isRegistered: false,
        bookings: [],
        inquiries: [],
        communications: [],
        staffNotes: [],
        tasks: [],
        activities: [],
        reviews: [],
      };
      customerMap.set(email, cust);
    }

    cust.inquiries.push(inq);
  });

  // Dynamic tags attribution & segments
  let customerList = Array.from(customerMap.values()).map((c) => {
    const dynamicTags = new Set(c.tags);
    if (c.totalBookings >= 2) dynamicTags.add('repeat_customer');
    if (c.totalRevenue >= 500) {
      dynamicTags.add('high_value');
      dynamicTags.add('VIP');
    }
    if (c.outstandingAmount > 0) dynamicTags.add('outstanding_balance');
    if (c.upcomingBookingDate) dynamicTags.add('upcoming_trip');

    // Interests based on tour titles
    const bookedTitles = c.bookings.map((b) => b.tourTitle.toLowerCase()).join(' ');
    if (bookedTitles.includes('dive') || bookedTitles.includes('scuba')) dynamicTags.add('diving');
    if (bookedTitles.includes('snorkel') || bookedTitles.includes('giftun') || bookedTitles.includes('dolphin')) dynamicTags.add('snorkeling');
    if (bookedTitles.includes('safari') || bookedTitles.includes('quad') || bookedTitles.includes('buggy')) dynamicTags.add('safari');

    c.tags = Array.from(dynamicTags);
    if (c.totalRevenue >= 500 || c.totalBookings >= 3) {
      c.status = 'vip';
    }
    return c;
  });

  // Client filtering
  if (searchQuery) {
    const q = searchQuery.toLowerCase().trim();
    customerList = customerList.filter(
      (c) =>
        c.fullName.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q)) ||
        (c.whatsapp && c.whatsapp.includes(q)) ||
        (c.hotel && c.hotel.toLowerCase().includes(q)) ||
        (c.country && c.country.toLowerCase().includes(q)) ||
        c.bookings.some((b) => b.bookingReference.toLowerCase().includes(q))
    );
  }

  if (tagFilter && tagFilter !== 'all') {
    customerList = customerList.filter((c) => c.tags.includes(tagFilter));
  }

  return customerList.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function getCustomerProfile(idOrEmail: string): Promise<CrmCustomerDetail | null> {
  const allCustomers = await listCrmCustomers();
  const found = allCustomers.find(
    (c) => c.id === idOrEmail || c.email.toLowerCase() === idOrEmail.toLowerCase()
  );
  if (!found) return null;

  // Enrich with communications, notes, tasks, activities, and leads
  const [comms, notes, tasks, activities, leads, conversations] = await Promise.all([
    listCommunications({ customerId: found.id }),
    listNotes({ customerId: found.id }),
    listTasks(),
    getGlobalActivityTimeline(100),
    listLeads(),
    listConversations({ customerId: found.id }),
  ]);

  found.communications = comms;
  found.staffNotes = notes;
  found.conversations = conversations;
  found.tasks = tasks.filter(
    (t) => t.customerId === found.id || (t.customerName && t.customerName === found.fullName)
  );
  found.leads = leads.filter(
    (l) => l.customerId === found.id || l.email.toLowerCase() === found.email.toLowerCase()
  );

  const localMode = useLocalCrmData('Supabase is not configured; the customer financial and review history cannot be loaded in production.');
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const bookingIds = found.bookings
    .map((booking) => booking.bookingId)
    .filter((id): id is string => Boolean(id && uuidPattern.test(id)));
  let payments: any[] = [];
  let refunds: any[] = [];
  let reviews: any[] = [];

  if (!localMode) {
    let paymentQuery = supabase.from('payment_transactions').select('*').order('payment_date', { ascending: false });
    let refundQuery = supabase.from('refund_records').select('*').order('created_at', { ascending: false });
    const customerUuid = uuidPattern.test(found.id) ? found.id : null;
    const bookingFilter = bookingIds.length ? `booking_id.in.(${bookingIds.join(',')})` : '';

    if (customerUuid && bookingFilter) {
      paymentQuery = paymentQuery.or(`customer_id.eq.${customerUuid},${bookingFilter}`);
      refundQuery = refundQuery.or(`customer_id.eq.${customerUuid},${bookingFilter}`);
    } else if (customerUuid) {
      paymentQuery = paymentQuery.eq('customer_id', customerUuid);
      refundQuery = refundQuery.eq('customer_id', customerUuid);
    } else if (bookingIds.length) {
      paymentQuery = paymentQuery.in('booking_id', bookingIds);
      refundQuery = refundQuery.in('booking_id', bookingIds);
    } else {
      paymentQuery = paymentQuery.eq('customer_email', found.email);
      refundQuery = refundQuery.eq('customer_email', found.email);
    }

    const [paymentResult, refundResult, reviewResult] = await Promise.all([
      paymentQuery,
      refundQuery,
      supabase.from('reviews').select('*').ilike('author_name', found.fullName).order('created_at', { ascending: false }),
    ]);
    if (paymentResult.error) throw new Error(formatSupabaseError(paymentResult.error));
    if (refundResult.error) throw new Error(formatSupabaseError(refundResult.error));
    if (reviewResult.error) throw new Error(formatSupabaseError(reviewResult.error));
    payments = paymentResult.data || [];
    refunds = refundResult.data || [];
    reviews = reviewResult.data || [];
  } else {
    const parseLocal = (keys: string[]) => {
      for (const key of keys) {
        const raw = localStorage.getItem(key);
        if (raw) {
          try { return JSON.parse(raw); } catch { return []; }
        }
      }
      return [];
    };
    const matchesBooking = (item: any) =>
      item.customerId === found.id ||
      item.customerEmail?.toLowerCase() === found.email.toLowerCase() ||
      found.bookings.some((booking) => booking.bookingReference === item.bookingReference || booking.bookingId === item.bookingId);
    payments = parseLocal(['rse_fin_payments', 'rse_finance_payments']).filter(matchesBooking);
    refunds = parseLocal(['rse_fin_refunds', 'rse_finance_refunds']).filter(matchesBooking);
    reviews = parseLocal(['rse_tour_reviews']).filter((review: any) =>
      review.authorName?.toLowerCase() === found.fullName.toLowerCase() ||
      review.authorEmail?.toLowerCase() === found.email.toLowerCase()
    );
  }

  found.payments = payments.map((row) => ({
    id: row.id,
    bookingId: row.booking_id || row.bookingId,
    bookingReference: row.booking_reference || row.bookingReference,
    amount: Number(row.amount) || 0,
    currency: row.currency || 'EUR',
    paymentMethod: row.payment_method || row.paymentMethod,
    paymentStatus: row.status || row.paymentStatus || 'pending',
    transactionReference: row.transaction_reference || row.transactionReference,
    paymentDate: row.payment_date || row.paymentDate || row.created_at || row.createdAt,
    provider: row.provider,
    isManual: row.is_manual ?? row.isManual,
    recordedBy: row.recorded_by || row.recordedBy,
    notes: row.notes,
  }));
  found.reviews = reviews.map((row) => ({
    id: row.id,
    tourId: row.tour_id || row.tourId,
    tourTitle: found.bookings.find((booking) => booking.tourId === (row.tour_id || row.tourId))?.tourTitle || row.tourTitle || 'Tour Experience',
    authorName: row.author_name || row.authorName || found.fullName,
    country: row.country,
    rating: Number(row.rating) || 0,
    comment: row.comment || '',
    date: row.date || row.created_at || row.createdAt,
    verifiedBooking: row.verified_booking ?? row.verifiedBooking ?? false,
    isPublished: row.is_published ?? row.isPublished ?? false,
  }));

  // Synthesize complete unified chronological timeline covering all 11 categories:
  // Inquiry, Lead, Booking, Payment, Communication, Task, Follow-up, Departure, Cancellation, Refund, Review
  const customerActivities: CrmActivity[] = [...activities.filter((a) => a.customerId === found.id)];

  // 1. INQUIRIES
  found.inquiries.forEach((inq) => {
    customerActivities.push({
      id: `act-inq-${inq.id}`,
      customerId: found.id,
      eventType: 'inquiry_created',
      title: `Inquiry Received: ${inq.subject || 'Support Ticket'}`,
      description: inq.message,
      actor: found.fullName,
      createdAt: inq.created_at,
    });
  });

  // 2. LEADS
  if (found.leads) {
    found.leads.forEach((l) => {
      customerActivities.push({
        id: `act-lead-${l.id}`,
        customerId: found.id,
        leadId: l.id,
        eventType: 'lead_created',
        title: `Lead Record: ${l.stage} Stage`,
        description: `Source: ${l.source}. Interested in: ${l.interestedTourTitle || 'General Tour'}.`,
        actor: l.assignedStaffName || 'Sales Desk',
        createdAt: l.createdAt,
      });

      // 7. FOLLOW-UPS
      if (l.followUpDate || l.notes) {
        customerActivities.push({
          id: `act-fup-${l.id}`,
          customerId: found.id,
          leadId: l.id,
          eventType: 'followup',
          title: `Follow-up (${l.followUpChannel || 'Phone'}): ${l.stage}`,
          description: l.notes || `Scheduled follow-up contact for ${l.followUpDate || 'prospective booking'}.`,
          actor: l.assignedStaffName || 'Sales Desk',
          createdAt: l.followUpDate || l.updatedAt || l.createdAt,
        });
      }
    });
  }

  // 3. BOOKINGS, 4. PAYMENTS, 8. DEPARTURES, 9. CANCELLATIONS
  found.bookings.forEach((b) => {
    customerActivities.push({
      id: `act-bk-${b.bookingReference}`,
      customerId: found.id,
      bookingId: b.bookingId || b.bookingReference,
      eventType: 'booking_created',
      title: `Booking Confirmed: ${b.bookingReference}`,
      description: `${b.tourTitle} (${b.guests.adults} Adults, €${b.pricing?.totalEur || 0}).`,
      actor: 'Traveler Online',
      createdAt: b.date || b.createdAt,
    });

    // 8. DEPARTURE EVENT
    customerActivities.push({
      id: `act-dep-${b.bookingReference}`,
      customerId: found.id,
      bookingId: b.bookingId || b.bookingReference,
      eventType: 'departure',
      title: `Excursion Departure: ${b.tourTitle}`,
      description: `Scheduled date: ${b.date}. Pickup hotel: ${b.pickup?.hotelName || b.customer?.hotelName || 'Direct Arrival'}.`,
      actor: 'Maritime Operations',
      createdAt: b.date || b.createdAt,
    });

    // 9. CANCELLATION EVENT
    if (b.status === 'cancelled' || b.status === 'cancellation_requested') {
      customerActivities.push({
        id: `act-canc-${b.bookingReference}`,
        customerId: found.id,
        bookingId: b.bookingId || b.bookingReference,
        eventType: 'cancellation',
        title: `Cancellation: ${b.bookingReference}`,
        description: b.cancellationReason || 'Cancelled by traveler or operations.',
        actor: 'Customer Support',
        createdAt: (b as any).updatedAt || b.date || b.createdAt,
      });
    }
  });

  // 5. COMMUNICATIONS (Emails & WhatsApps)
  found.communications.forEach((comm) => {
    customerActivities.push({
      id: `act-comm-${comm.id}`,
      customerId: found.id,
      eventType: 'communication',
      title: `${comm.channel.toUpperCase()}: ${comm.templateKey ? comm.templateKey.replace(/_/g, ' ') : comm.subject}`,
      description: `Delivery Status: ${comm.status}. Provider: ${comm.provider}. Recipient: ${comm.recipient}`,
      actor: comm.provider || 'Comm Dispatcher',
      createdAt: comm.sentAt || comm.createdAt,
    });
  });

  // 6. TASKS
  found.tasks.forEach((tsk) => {
    customerActivities.push({
      id: `act-task-${tsk.id}`,
      customerId: found.id,
      eventType: 'task',
      title: `CRM Task: ${tsk.title}`,
      description: `Status: ${tsk.status}. Priority: ${tsk.priority}. Assigned: ${tsk.assignedStaffName || 'Staff'}.`,
      actor: tsk.assignedStaffName || 'Staff',
      createdAt: tsk.createdAt,
    });
  });

  // 4. PAYMENTS: use actual payment transactions, not booking payment-status snapshots.
  payments.forEach((payment) => {
    customerActivities.push({
      id: `act-pay-${payment.id}`,
      customerId: found.id,
      bookingId: payment.booking_id || payment.bookingId,
      eventType: 'payment_recorded',
      title: `Payment ${payment.status || payment.paymentStatus || 'recorded'}: ${payment.amount} ${payment.currency || 'EUR'}`,
      description: `Method: ${payment.payment_method || payment.paymentMethod || 'Not specified'}. Reference: ${payment.transaction_reference || payment.transactionReference || 'Not provided'}.`,
      actor: payment.recorded_by || payment.recordedBy || 'Finance',
      createdAt: payment.payment_date || payment.paymentDate || payment.created_at || payment.createdAt || new Date().toISOString(),
    });
  });

  // 10. REFUNDS: load the authoritative refund ledger from Supabase in production.
  refunds.forEach((refund) => {
    customerActivities.push({
      id: `act-ref-${refund.id}`,
      customerId: found.id,
      bookingId: refund.booking_id || refund.bookingId,
      eventType: 'refund',
      title: `Refund (${refund.status}): ${refund.approved_amount ?? refund.approvedAmount ?? refund.requested_amount ?? refund.amount} ${refund.currency || 'EUR'}`,
      description: `Reason: ${refund.reason}. Method: ${refund.refund_method || refund.paymentMethod || 'Original Method'}.`,
      actor: refund.processed_by || refund.processedBy || refund.requested_by || 'Finance',
      createdAt: refund.processed_date || refund.processedDate || refund.created_at || refund.createdAt || new Date().toISOString(),
    });
  });

  // 11. REVIEWS: expose the actual review rows on the customer profile and timeline.
  found.reviews.forEach((review: any) => {
    customerActivities.push({
      id: `act-rev-${review.id}`,
      customerId: found.id,
      eventType: 'review',
      title: `Customer Review (${review.rating}★): ${review.tourTitle || 'Tour Experience'}`,
      description: review.comment || 'Verified traveler feedback.',
      actor: review.authorName || found.fullName,
      createdAt: review.date || new Date().toISOString(),
    });
  });

  // Deduplicate activities by id and sort in descending chronological order
  const seenIds = new Set<string>();
  found.activities = customerActivities
    .filter((act) => {
      if (seenIds.has(act.id)) return false;
      seenIds.add(act.id);
      return true;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return found;
}

export async function createCustomer(input: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  whatsapp?: string;
  country: string;
  hotel?: string;
  notes?: string;
  tags?: string[];
}): Promise<CrmCustomerDetail> {
  const email = input.email.toLowerCase().trim();
  const localMode = useLocalCrmData('Supabase is not configured; CRM customers cannot be created in production.');

  if (!localMode) {
    const { data, error } = await supabase
      .from('customers')
      .insert({
        first_name: input.firstName,
        last_name: input.lastName,
        email,
        phone: input.phone,
        whatsapp: input.whatsapp,
        country: input.country,
        hotel: input.hotel,
        notes: input.notes,
        tags: input.tags || ['Customer'],
        source: 'Manual Admin Entry',
      })
      .select('id')
      .single();

    if (error) throw new Error(formatSupabaseError(error));
    if (!data?.id) throw new Error('The customer was not saved; no database record was returned.');
    return await getCustomerProfile(data.id) || Promise.reject(new Error('The customer was saved but could not be reloaded.'));
  }

  await updateCustomerMetadata(email, {
    notes: input.notes,
    tags: input.tags || ['Customer'],
    source: 'Manual Admin Entry',
  });
  const profile = await getCustomerProfile(email);
  if (!profile) throw new Error('The customer profile could not be created in the development data store.');
  return profile;
}

export async function updateCustomerMetadata(
  email: string,
  updates: { notes?: string; tags?: string[]; source?: string; hotel?: string; country?: string }
): Promise<void> {
  const cleanEmail = email.toLowerCase().trim();
  if (!cleanEmail) throw new Error('A customer email is required to update CRM metadata.');
  const localMode = useLocalCrmData('Supabase is not configured; CRM customer metadata cannot be saved in production.');

  if (!localMode) {
    const { data, error } = await supabase
      .from('customers')
      .update({
        notes: updates.notes,
        tags: updates.tags,
        hotel: updates.hotel,
        country: updates.country,
        updated_at: new Date().toISOString(),
      })
      .eq('email', cleanEmail)
      .select('id')
      .maybeSingle();

    if (error) throw new Error(formatSupabaseError(error));
    if (!data) throw new Error('The customer metadata was not saved because the customer record was not found or is not accessible.');
  }

  const extra = getLocal<Record<string, any>>(LOCAL_CUSTOMERS_EXTRA_KEY, {});
  extra[cleanEmail] = { ...(extra[cleanEmail] || {}), ...updates };
  setLocal(LOCAL_CUSTOMERS_EXTRA_KEY, extra);
}

// ------------------------------------------------------------------------------
// TAGS & SEGMENTS SERVICE
// ------------------------------------------------------------------------------

export async function listCrmTags(): Promise<CrmTag[]> {
  if (useLocalCrmData('Supabase is not configured; CRM tags cannot be loaded in production.')) {
    return getLocal<CrmTag[]>(LOCAL_TAGS_KEY, DEFAULT_TAGS);
  }

  const { data, error } = await supabase.from('crm_tags').select('*').order('name');
  if (error) throw new Error(formatSupabaseError(error));
  if (!data) throw new Error('CRM tags could not be loaded from the database.');
  const tags = data.map((d) => ({
    id: d.id,
    name: d.name,
    description: d.description,
    color: d.color,
    category: d.category,
    usageCount: d.usage_count || 0,
    createdAt: d.created_at,
  }));
  setLocal(LOCAL_TAGS_KEY, tags);
  return tags;
}

export async function createCrmTag(input: {
  name: string;
  description?: string;
  color?: string;
  category?: 'tier' | 'loyalty' | 'interest' | 'general';
}): Promise<CrmTag> {
  const localMode = useLocalCrmData('Supabase is not configured; CRM tags cannot be created in production.');
  const newTag: CrmTag = {
    id: `tag-${Date.now().toString(36)}`,
    name: input.name.toLowerCase().replace(/\s+/g, '_'),
    description: input.description || null,
    color: input.color || '#2dd4bf',
    category: input.category || 'general',
    usageCount: 0,
    createdAt: new Date().toISOString(),
  };

  if (!localMode) {
    const { data, error } = await supabase
      .from('crm_tags')
      .insert({
        name: newTag.name,
        description: newTag.description,
        color: newTag.color,
        category: newTag.category,
      })
      .select('*')
      .single();
    if (error) throw new Error(formatSupabaseError(error));
    if (!data) throw new Error('The CRM tag was not saved; no database record was returned.');
    newTag.id = data.id;
    newTag.createdAt = data.created_at || newTag.createdAt;
  }

  const tags = getLocal<CrmTag[]>(LOCAL_TAGS_KEY, []);
  setLocal(LOCAL_TAGS_KEY, [newTag, ...tags]);
  return newTag;
}

export async function listCrmSegments(): Promise<CrmSegment[]> {
  const customers = await listCrmCustomers();

  const baseSegments: CrmSegment[] = [
    {
      id: 'seg-1',
      name: 'VIP Repeat Travelers',
      slug: 'repeat_customers',
      description: 'Travelers who have completed 2 or more excursions across the Red Sea',
      badgeLabel: 'Repeat Guest',
      color: '#fbbf24',
      icon: 'Crown',
      ruleType: 'repeat',
      customerCount: customers.filter((c) => c.totalBookings >= 2).length,
      isActive: true,
    },
    {
      id: 'seg-2',
      name: 'High Lifetime Value (€500+)',
      slug: 'high_value',
      description: 'Guests with over €500 total spend on yachts, diving, or private safaris',
      badgeLabel: 'High Value',
      color: '#a855f7',
      icon: 'Diamond',
      ruleType: 'high_value',
      customerCount: customers.filter((c) => c.totalRevenue >= 500).length,
      isActive: true,
    },
    {
      id: 'seg-3',
      name: 'Dormant (No Booking in 12 Months)',
      slug: 'dormant_12m',
      description: 'Past customers who have not made a reservation in the last 12 months',
      badgeLabel: 'Win-Back',
      color: '#f97316',
      icon: 'Clock',
      ruleType: 'dormant_12m',
      customerCount: customers.filter((c) => {
        if (!c.latestBookingDate) return false;
        const twelveMonthsAgo = new Date(Date.now() - 365 * 86400000).toISOString().split('T')[0];
        return c.latestBookingDate < twelveMonthsAgo;
      }).length,
      isActive: true,
    },
    {
      id: 'seg-4',
      name: 'Upcoming Trips (Active Travelers)',
      slug: 'upcoming_trips',
      description: 'Confirmed travelers with excursions scheduled in the future',
      badgeLabel: 'Upcoming Trip',
      color: '#34d399',
      icon: 'Calendar',
      ruleType: 'upcoming_trip',
      customerCount: customers.filter((c) => Boolean(c.upcomingBookingDate)).length,
      isActive: true,
    },
    {
      id: 'seg-5',
      name: 'Diving & Watersports Enthusiasts',
      slug: 'diving_enthusiasts',
      description: 'Guests with diving and snorkeling interest tags',
      badgeLabel: 'Marine Sports',
      color: '#06b6d4',
      icon: 'Anchor',
      ruleType: 'interest_diving',
      customerCount: customers.filter((c) => c.tags.includes('diving') || c.tags.includes('snorkeling')).length,
      isActive: true,
    },
    {
      id: 'seg-6',
      name: 'Unconverted Inquiry Leads',
      slug: 'unconverted_leads',
      description: 'Prospects who submitted inquiries or custom requests without booking yet',
      badgeLabel: 'Inquiry Prospect',
      color: '#38bdf8',
      icon: 'Target',
      ruleType: 'unconverted_inquiry',
      customerCount: customers.filter((c) => c.totalBookings === 0 && c.inquiries.length > 0).length,
      isActive: true,
    },
  ];

  return baseSegments;
}

// ------------------------------------------------------------------------------
// CONVERSION WORKFLOWS
// ------------------------------------------------------------------------------

export async function convertInquiryToLead(inquiry: any): Promise<CrmLead> {
  if (!inquiry?.id) throw new Error('A valid inquiry is required for conversion.');

  if (isSupabaseConfigured()) {
    const { data, error } = await (supabase as any)
      .rpc('convert_inquiry_to_lead', { p_inquiry_id: inquiry.id });

    if (error) throw new Error(formatSupabaseError(error));
    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.id) throw new Error('The database did not return the converted lead.');

    const lead: CrmLead = {
      id: row.id,
      name: row.name,
      email: row.email || '',
      phone: row.phone,
      whatsapp: row.whatsapp,
      country: row.country,
      hotel: row.hotel,
      source: (row.source as LeadSource) || 'Website',
      interestedTourId: row.interested_tour_id,
      interestedTourTitle: row.interested_tour_title,
      destination: row.destination,
      travelDate: row.travel_date,
      numberOfGuests: row.number_of_guests || 1,
      estimatedValue: Number(row.estimated_value) || 0,
      currency: row.currency || 'EUR',
      stage: (row.stage as LeadStage) || 'Contacted',
      status: row.status || 'active',
      score: row.score ?? 60,
      notes: row.notes,
      tags: row.tags || [],
      assignedStaffId: row.assigned_staff_id,
      assignedStaffName: row.assigned_staff_name,
      customerId: row.customer_id,
      followUpDate: row.follow_up_date,
      lastContactAt: row.last_contact_at,
      contactAttemptsCount: row.contact_attempts_count || 0,
      lostReason: row.lost_reason,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    const cached = getLocal<CrmLead[]>(LOCAL_LEADS_KEY, []);
    setLocal(LOCAL_LEADS_KEY, [lead, ...cached.filter((item) => item.id !== lead.id)]);
    return lead;
  }

  if (!import.meta.env.DEV) {
    throw new Error('Supabase is not configured. Inquiry conversion is unavailable in production.');
  }

  // Local-only development fallback; production always uses the atomic RPC.
  const sourceMarker = `[source-inquiry:${inquiry.id}]`;
  const existing = getLocal<CrmLead[]>(LOCAL_LEADS_KEY, []).find((item) => item.notes?.includes(sourceMarker));
  if (existing) return existing;

  return createLead({
    name: inquiry.customer_name,
    email: inquiry.email,
    phone: inquiry.phone,
    whatsapp: inquiry.whatsapp || inquiry.phone,
    source: (inquiry.source as LeadSource) || 'Website',
    interestedTourTitle: inquiry.tour_title || null,
    notes: `${sourceMarker} Converted from Help Inquiry: ${inquiry.message}`,
    stage: 'Contacted',
    score: 60,
  });
}

export async function convertLeadToCustomer(leadId: string): Promise<string> {
  const leads = await listLeads();
  const lead = leads.find((item) => item.id === leadId);
  if (!lead) throw new Error('Lead not found.');

  const cleanEmail = lead.email.trim().toLowerCase();
  const cleanPhone = lead.phone?.trim() || null;
  let customerId: string | null = lead.customerId || null;
  const localMode = useLocalCrmData('Supabase is not configured; lead conversion cannot run in production.');

  if (!customerId && !localMode) {
    if (cleanEmail) {
      const { data, error } = await supabase.from('customers').select('id').eq('email', cleanEmail).maybeSingle();
      if (error) throw new Error(formatSupabaseError(error));
      if (data?.id) customerId = data.id;
    }
    if (!customerId && cleanPhone) {
      const { data, error } = await supabase.from('customers').select('id').eq('phone', cleanPhone).maybeSingle();
      if (error) throw new Error(formatSupabaseError(error));
      if (data?.id) customerId = data.id;
    }
  }

  if (!customerId && localMode) {
    const rawLocal = localStorage.getItem('rse_customers_cache');
    if (rawLocal) {
      const localList = JSON.parse(rawLocal);
      const match = localList.find((customer: any) =>
        customer.email?.toLowerCase() === cleanEmail ||
        (cleanPhone && customer.phone && customer.phone.replace(/\s+/g, '') === cleanPhone.replace(/\s+/g, ''))
      );
      if (match) customerId = match.id;
    }
  }

  if (!customerId) {
    if (!cleanEmail && !cleanPhone) throw new Error('A lead needs an email address or phone number before conversion.');
    const created = await createCustomer({
      firstName: lead.name.split(' ')[0] || lead.name,
      lastName: lead.name.split(' ').slice(1).join(' ') || '',
      email: cleanEmail,
      phone: cleanPhone || '',
      whatsapp: lead.whatsapp || undefined,
      country: lead.country || 'International',
      hotel: lead.hotel || undefined,
      notes: lead.notes || undefined,
      tags: ['Converted Lead', 'Active Customer'],
    });
    customerId = created.id;
  }

  await updateLeadStage(leadId, 'Won');
  await updateLead(leadId, { customerId });
  await recordActivity({
    customerId,
    leadId,
    eventType: 'lead_converted',
    title: 'Lead Converted to Customer',
    description: `${lead.name} (${lead.source}) successfully converted to verified customer. Preserved lead value: €${lead.estimatedValue || 0}.`,
    actor: 'Signed-in staff',
  });
  return customerId;
}

// ------------------------------------------------------------------------------
// DASHBOARD KPIS & METRICS (100% REAL SUPABASE / REPO DATA)
// ------------------------------------------------------------------------------

export async function getCrmDashboardMetrics(): Promise<CrmDashboardMetrics> {
  const [leads, tasks, allBookings, inquiries, customers] = await Promise.all([
    listLeads(),
    listTasks(),
    bookingRepository.listBookings(),
    listInquiries(),
    listCrmCustomers(),
  ]);

  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
  const { dueToday, overdue } = await getFollowUpsDue();
  const newInquiries = inquiries.filter((inquiry) => inquiry.status === 'new').length;
  const activeBookings = allBookings.filter((booking) => booking.status !== 'cancelled');

  // Lead estimates in different currencies must not be added together and labelled EUR.
  const totalWonLeadsEur = leads
    .filter((lead) => (lead.stage === 'Won' || (lead.stage as any) === 'Booked') && String(lead.currency || 'EUR').toUpperCase() === 'EUR')
    .reduce((sum, lead) => sum + (lead.estimatedValue || 0), 0);

  // This is gross booked value, not collected cash.
  const totalRevenueEur = activeBookings.reduce((sum, booking) => sum + (booking.pricing?.totalEur || 0), 0);
  let outstandingPaymentsEur = totalRevenueEur;

  if (isSupabaseConfigured()) {
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const bookingIds = activeBookings.map((booking) => booking.bookingId).filter((id) => uuidPattern.test(id));
    if (bookingIds.length > 0) {
      const [paymentsResult, refundsResult] = await Promise.all([
        supabase.from('payment_transactions').select('booking_id,amount,currency,status').in('booking_id', bookingIds),
        supabase.from('refund_records').select('booking_id,amount,currency,status').in('booking_id', bookingIds),
      ]);
      if (paymentsResult.error) throw new Error(formatSupabaseError(paymentsResult.error));
      if (refundsResult.error) throw new Error(formatSupabaseError(refundsResult.error));

      const settledPaymentsEur = (paymentsResult.data || [])
        .filter((payment) => ['paid', 'partially paid', 'partially_paid'].includes(String(payment.status).toLowerCase().replace(/_/g, ' ')) && String(payment.currency || 'EUR').toUpperCase() === 'EUR')
        .reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
      const processedRefundsEur = (refundsResult.data || [])
        .filter((refund) => refund.status === 'processed' && String(refund.currency || 'EUR').toUpperCase() === 'EUR')
        .reduce((sum, refund) => sum + (Number(refund.amount) || 0), 0);

      outstandingPaymentsEur = Math.max(0, totalRevenueEur - settledPaymentsEur + processedRefundsEur);
    }
  } else if (import.meta.env.DEV) {
    outstandingPaymentsEur = activeBookings.reduce((sum, booking) => {
      const total = booking.pricing?.totalEur || 0;
      const paid = String(booking.paymentStatus).toLowerCase() === 'paid' ? total : 0;
      return sum + Math.max(0, total - paid);
    }, 0);
  } else {
    throw new Error('Supabase is not configured; CRM financial metrics cannot be calculated in production.');
  }

  const wonLeadsCount = leads.filter((lead) => lead.stage === 'Won' || (lead.stage as any) === 'Booked').length;
  const lostLeadsCount = leads.filter((lead) => lead.stage === 'Lost').length;
  const closedLeads = wonLeadsCount + lostLeadsCount;
  const conversionRate = closedLeads > 0 ? Math.round((wonLeadsCount / closedLeads) * 100) : 0;
  const repeatCustomersCount = customers.filter((customer) => customer.totalBookings >= 2).length;
  const customerLifetimeValueAvgEur = customers.length > 0 ? Math.round(totalRevenueEur / customers.length) : 0;

  return {
    totalLeadsCount: leads.length,
    newLeadsCount: leads.filter((lead) => lead.stage === 'New').length,
    qualifiedLeadsCount: leads.filter((lead) => lead.stage === 'Qualified').length,
    wonLeadsCount,
    lostLeadsCount,
    conversionRate,
    followUpsDueCount: dueToday.length,
    overdueFollowUpsCount: overdue.length,
    openTasksCount: tasks.filter((task) => task.status === 'Pending' || task.status === 'In Progress').length,
    newInquiriesCount: newInquiries,
    newCustomersCount: customers.filter((customer) => customer.createdAt >= oneWeekAgo).length,
    repeatCustomersCount,
    customerLifetimeValueAvgEur,
    totalRevenueEur,
    outstandingPaymentsEur,
    totalActiveLeads: leads.filter((lead) => lead.stage !== 'Lost' && lead.stage !== 'Won').length,
    totalWonLeadsEur,
  };
}
