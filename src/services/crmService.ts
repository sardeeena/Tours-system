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
  { id: 'tag-2', name: 'repeat_customer', description: 'Traveled more than once with Red Sea Excursions', color: '#34d399', category: 'loyalty', usageCount: 6, createdAt: '2026-01-01T00:00:00Z' },
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
  let leads: CrmLead[] = [];

  if (isSupabaseConfigured()) {
    try {
      let query = supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });

      if (filter?.stage && filter.stage !== 'all') {
        query = query.eq('stage', filter.stage);
      }
      if (filter?.source && filter.source !== 'all') {
        query = query.eq('source', filter.source);
      }
      if (filter?.status && filter.status !== 'all') {
        query = query.eq('status', filter.status);
      }

      const { data, error } = await query;

      if (!error && data) {
        leads = data.map((d) => ({
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
    } catch {
      // fallback to cached leads below
    }
  }

  leads = getLocal<CrmLead[]>(LOCAL_LEADS_KEY, []);
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
    estimatedValue: input.estimatedValue !== undefined ? input.estimatedValue : 150,
    currency: input.currency || 'EUR',
    stage: input.stage || 'New',
    status: 'active',
    score: input.score !== undefined ? input.score : 50,
    notes: input.notes || null,
    tags: input.tags || [],
    assignedStaffId: input.assignedStaffId || null,
    assignedStaffName: input.assignedStaffName || 'Captain Tarek',
    customerId: input.customerId || null,
    followUpDate: input.followUpDate || null,
    lastContactAt: null,
    contactAttemptsCount: 0,
    lostReason: input.lostReason || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const leads = getLocal<CrmLead[]>(LOCAL_LEADS_KEY, []);
  setLocal(LOCAL_LEADS_KEY, [newLead, ...leads]);

  if (isSupabaseConfigured()) {
    try {
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
        .maybeSingle();

      if (error) {
        throw new Error(formatSupabaseError(error));
      }
      if (data) {
        newLead.id = data.id;
      }
    } catch (err: any) {
      console.error('Error creating lead in Supabase:', err);
      throw err;
    }
  }

  // Record timeline activity
  await recordActivity({
    leadId: newLead.id,
    eventType: 'lead_created',
    title: 'Lead Created',
    description: `${newLead.name} added via ${newLead.source} for ${newLead.interestedTourTitle || 'excursion inquiry'}.`,
    actor: newLead.assignedStaffName || 'Staff Member',
  });

  return newLead;
}

export async function updateLead(leadId: string, updates: Partial<CrmLead>): Promise<boolean> {
  const leads = getLocal<CrmLead[]>(LOCAL_LEADS_KEY, []);
  const updated = leads.map((l) =>
    l.id === leadId
      ? { ...l, ...updates, updatedAt: new Date().toISOString() }
      : l
  );
  setLocal(LOCAL_LEADS_KEY, updated);

  if (isSupabaseConfigured()) {
    try {
      const { error } = await supabase
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
          updated_at: new Date().toISOString(),
        })
        .eq('id', leadId);

      if (error) {
        throw new Error(formatSupabaseError(error));
      }
    } catch (err: any) {
      console.error('Error updating lead in Supabase:', err);
      throw err;
    }
  }

  return true;
}

export async function updateLeadStage(
  leadId: string,
  newStage: LeadStage,
  lostReason?: string
): Promise<boolean> {
  const leads = getLocal<CrmLead[]>(LOCAL_LEADS_KEY, []);
  const target = leads.find((l) => l.id === leadId);
  const oldStage = target?.stage || 'Unknown';
  const status = newStage === 'Won' ? 'converted' : newStage === 'Lost' ? 'lost' : 'active';

  const updated = leads.map((l) =>
    l.id === leadId
      ? {
          ...l,
          stage: newStage,
          status: status as any,
          lostReason: newStage === 'Lost' ? lostReason || l.lostReason : null,
          updatedAt: new Date().toISOString(),
        }
      : l
  );
  setLocal(LOCAL_LEADS_KEY, updated);

  if (isSupabaseConfigured()) {
    try {
      const { error } = await supabase
        .from('leads')
        .update({
          stage: newStage,
          status,
          lost_reason: newStage === 'Lost' ? lostReason : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', leadId);

      if (error) {
        throw new Error(formatSupabaseError(error));
      }
    } catch (err: any) {
      console.error('Error updating lead stage in Supabase:', err);
      throw err;
    }
  }

  await recordActivity({
    leadId,
    eventType: 'stage_changed',
    title: `Stage Changed: ${newStage}`,
    description: `Lead moved from "${oldStage}" to "${newStage}"${lostReason ? ` (Reason: ${lostReason})` : ''}.`,
    actor: 'Admin Staff',
  });

  return true;
}

export async function recordLeadContactAttempt(
  leadId: string,
  channel: FollowUpChannel,
  notes: string,
  staffName: string = 'Admin Staff'
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
  const leads = getLocal<CrmLead[]>(LOCAL_LEADS_KEY, []);
  setLocal(
    LOCAL_LEADS_KEY,
    leads.filter((l) => l.id !== leadId)
  );

  if (isSupabaseConfigured()) {
    try {
      const { error } = await supabase.from('leads').delete().eq('id', leadId);
      if (error) {
        throw new Error(formatSupabaseError(error));
      }
    } catch (err: any) {
      console.error('Error deleting lead from Supabase:', err);
      throw err;
    }
  }

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
  let tasks: CrmTask[] = [];

  if (isSupabaseConfigured()) {
    try {
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

      if (!error && data) {
        tasks = data.map((d) => ({
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
    } catch {
      // ignore
    }
  }

  tasks = getLocal<CrmTask[]>(LOCAL_TASKS_KEY, []);
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

  const tasks = getLocal<CrmTask[]>(LOCAL_TASKS_KEY, []);
  setLocal(LOCAL_TASKS_KEY, [newTask, ...tasks]);

  if (isSupabaseConfigured()) {
    try {
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
          assigned_staff_name: newTask.assignedStaffName,
          due_date: newTask.dueDate,
          priority: newTask.priority,
          status: newTask.status,
          is_follow_up: newTask.isFollowUp,
          follow_up_channel: newTask.followUpChannel,
        })
        .select('*')
        .maybeSingle();

      if (!error && data) {
        newTask.id = data.id;
      }
    } catch {
      // ignore
    }
  }

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
  const tasks = getLocal<CrmTask[]>(LOCAL_TASKS_KEY, []);
  const updated = tasks.map((t) =>
    t.id === taskId
      ? { ...t, ...updates, updatedAt: new Date().toISOString() }
      : t
  );
  setLocal(LOCAL_TASKS_KEY, updated);

  if (isSupabaseConfigured()) {
    try {
      await supabase
        .from('crm_tasks')
        .update({
          title: updates.title,
          description: updates.description,
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
        .eq('id', taskId);
    } catch {
      // ignore
    }
  }

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
      eventType: isCompleted ? 'task_completed' : 'task_created',
      title: isCompleted ? `Completed: ${target.title}` : `Task Status: ${newStatus}`,
      description: outcomeNotes || `Task marked as "${newStatus}" by ${completedByName}.`,
      actor: completedByName,
    });
  }

  return true;
}

export async function deleteTask(taskId: string): Promise<boolean> {
  const tasks = getLocal<CrmTask[]>(LOCAL_TASKS_KEY, []);
  setLocal(
    LOCAL_TASKS_KEY,
    tasks.filter((t) => t.id !== taskId)
  );

  if (isSupabaseConfigured()) {
    try {
      await supabase.from('crm_tasks').delete().eq('id', taskId);
    } catch {
      // ignore
    }
  }

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
  let conversations: CrmConversationRecord[] = [];

  if (isSupabaseConfigured()) {
    try {
      let query = supabase
        .from('crm_conversations')
        .select('*')
        .order('created_at', { ascending: false });

      if (filter?.customerId) query = query.eq('customer_id', filter.customerId);
      if (filter?.leadId) query = query.eq('lead_id', filter.leadId);
      if (filter?.bookingId) query = query.eq('booking_id', filter.bookingId);
      if (filter?.channel && filter.channel !== 'all') query = query.eq('channel', filter.channel);

      const { data, error } = await query;
      if (!error && data) {
        conversations = data.map((d) => ({
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
    } catch {
      // ignore
    }
  }

  conversations = getLocal<CrmConversationRecord[]>(LOCAL_CONVERSATIONS_KEY, []);
  return conversations.filter((c) => {
    if (filter?.customerId && c.customerId !== filter.customerId) return false;
    if (filter?.leadId && c.leadId !== filter.leadId) return false;
    if (filter?.bookingId && c.bookingId !== filter.bookingId) return false;
    if (filter?.channel && filter.channel !== 'all' && c.channel !== filter.channel) return false;
    return true;
  });
}

export async function recordConversation(
  input: Omit<CrmConversationRecord, 'id' | 'createdAt'>
): Promise<CrmConversationRecord> {
  const newRecord: CrmConversationRecord = {
    ...input,
    id: `conv-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
    createdAt: new Date().toISOString(),
  };

  const list = getLocal<CrmConversationRecord[]>(LOCAL_CONVERSATIONS_KEY, []);
  setLocal(LOCAL_CONVERSATIONS_KEY, [newRecord, ...list]);

  if (isSupabaseConfigured()) {
    try {
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
        .maybeSingle();

      if (!error && data) {
        newRecord.id = data.id;
      }
    } catch {
      // ignore
    }
  }

  // Also log to communications and activity
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
  let comms: CrmCommunication[] = [];

  if (isSupabaseConfigured()) {
    try {
      let query = supabase
        .from('crm_communications')
        .select('*')
        .order('created_at', { ascending: false });

      if (filter?.customerId) query = query.eq('customer_id', filter.customerId);
      if (filter?.leadId) query = query.eq('lead_id', filter.leadId);

      const { data, error } = await query;
      if (!error && data) {
        comms = data.map((d) => ({
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
    } catch {
      // ignore
    }
  }

  comms = getLocal<CrmCommunication[]>(LOCAL_COMMS_KEY, []);
  return comms.filter((c) => {
    if (filter?.customerId && c.customerId !== filter.customerId) return false;
    if (filter?.leadId && c.leadId !== filter.leadId) return false;
    return true;
  });
}

export async function recordCommunication(
  input: Partial<CrmCommunication>
): Promise<CrmCommunication> {
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
    staffName: input.staffName || 'Admin Staff',
    staffId: input.staffId || null,
    createdAt: new Date().toISOString(),
  };

  const comms = getLocal<CrmCommunication[]>(LOCAL_COMMS_KEY, []);
  setLocal(LOCAL_COMMS_KEY, [newComm, ...comms]);

  if (isSupabaseConfigured()) {
    try {
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
        })
        .select('*')
        .maybeSingle();

      if (!error && data) {
        newComm.id = data.id;
      }
    } catch {
      // ignore
    }
  }

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
  let notes: CrmNote[] = [];

  if (isSupabaseConfigured()) {
    try {
      let query = supabase
        .from('crm_notes')
        .select('*')
        .order('created_at', { ascending: false });

      if (filter?.customerId) query = query.eq('customer_id', filter.customerId);
      if (filter?.leadId) query = query.eq('lead_id', filter.leadId);

      const { data, error } = await query;
      if (!error && data) {
        notes = data.map((d) => ({
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
    } catch {
      // ignore
    }
  }

  notes = getLocal<CrmNote[]>(LOCAL_NOTES_KEY, []);
  return notes.filter((n) => {
    if (filter?.customerId && n.customerId !== filter.customerId) return false;
    if (filter?.leadId && n.leadId !== filter.leadId) return false;
    return true;
  });
}

export async function addStaffNote(input: {
  customerId?: string;
  leadId?: string;
  bookingId?: string;
  content: string;
  staffName?: string;
  isPinned?: boolean;
}): Promise<CrmNote> {
  const newNote: CrmNote = {
    id: `note-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
    customerId: input.customerId || null,
    leadId: input.leadId || null,
    bookingId: input.bookingId || null,
    content: input.content,
    staffName: input.staffName || 'Staff Member',
    isPinned: Boolean(input.isPinned),
    createdAt: new Date().toISOString(),
  };

  const notes = getLocal<CrmNote[]>(LOCAL_NOTES_KEY, []);
  setLocal(LOCAL_NOTES_KEY, [newNote, ...notes]);

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('crm_notes')
        .insert({
          customer_id: newNote.customerId,
          lead_id: newNote.leadId,
          booking_id: newNote.bookingId,
          content: newNote.content,
          staff_name: newNote.staffName,
          is_pinned: newNote.isPinned,
        })
        .select('*')
        .maybeSingle();

      if (!error && data) {
        newNote.id = data.id;
      }
    } catch {
      // ignore
    }
  }

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
    createdAt: new Date().toISOString(),
  };

  const activities = getLocal<CrmActivity[]>(LOCAL_ACTIVITIES_KEY, []);
  setLocal(LOCAL_ACTIVITIES_KEY, [newAct, ...activities]);

  if (isSupabaseConfigured()) {
    try {
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
        .maybeSingle();

      if (!error && data) {
        newAct.id = data.id;
      }
    } catch {
      // ignore
    }
  }

  return newAct;
}

export const logActivity = recordActivity;

export async function getGlobalActivityTimeline(limit: number = 60): Promise<CrmActivity[]> {
  let activities: CrmActivity[] = [];

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('crm_activities')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (!error && data) {
        activities = data.map((d) => ({
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
    } catch {
      // ignore
    }
  }

  activities = getLocal<CrmActivity[]>(LOCAL_ACTIVITIES_KEY, []);
  return activities.slice(0, limit);
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

  // Fetch registered customers from Supabase if configured
  if (isSupabaseConfigured()) {
    try {
      const { data: dbCustomers } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });

      if (dbCustomers) {
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
    } catch {
      // continue with bookings aggregation
    }
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

    // 4. PAYMENT EVENT
    if (b.paymentStatus === 'paid' || b.paymentStatus === 'partially_paid') {
      customerActivities.push({
        id: `act-pay-${b.bookingReference}`,
        customerId: found.id,
        bookingId: b.bookingId || b.bookingReference,
        eventType: 'payment_recorded',
        title: `Payment Settled: €${b.pricing?.totalEur || 0}`,
        description: `Settled via ${b.paymentMethod === 'pay_online' ? 'Online Card' : 'Pier Cash/Mobile POS'}.`,
        actor: 'Accounting Desk',
        createdAt: b.date || b.createdAt,
      });
    }

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

  // 10. REFUNDS
  try {
    const rawRefunds = localStorage.getItem('rse_fin_refunds') || localStorage.getItem('rse_finance_refunds');
    if (rawRefunds) {
      const refunds = JSON.parse(rawRefunds);
      refunds.forEach((r: any) => {
        if (
          r.customerId === found.id ||
          found.bookings.some((b) => b.bookingReference === r.bookingReference || b.bookingId === r.bookingId)
        ) {
          customerActivities.push({
            id: `act-ref-${r.id}`,
            customerId: found.id,
            bookingId: r.bookingId,
            eventType: 'refund',
            title: `Refund (${r.status}): €${r.approvedAmount || r.amount}`,
            description: `Reason: ${r.reason}. Method: ${r.paymentMethod || 'Original Method'}.`,
            actor: 'Finance Dept',
            createdAt: r.createdAt || new Date().toISOString(),
          });
        }
      });
    }
  } catch {}

  // 11. REVIEWS
  try {
    const rawReviews = localStorage.getItem('rse_tour_reviews');
    if (rawReviews) {
      const revs = JSON.parse(rawReviews);
      revs.forEach((rv: any) => {
        if (rv.authorName?.toLowerCase() === found.fullName.toLowerCase() || rv.authorEmail?.toLowerCase() === found.email.toLowerCase()) {
          customerActivities.push({
            id: `act-rev-${rv.id}`,
            customerId: found.id,
            eventType: 'review',
            title: `Customer Review (${rv.rating}★): ${rv.tourTitle || 'Tour Experience'}`,
            description: rv.comment || 'Verified traveler feedback.',
            actor: found.fullName,
            createdAt: rv.date || rv.createdAt || new Date().toISOString(),
          });
        }
      });
    }
  } catch {}

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

  if (isSupabaseConfigured()) {
    try {
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
        .select('*')
        .maybeSingle();

      if (!error && data) {
        return (await getCustomerProfile(data.id))!;
      }
    } catch {
      // ignore
    }
  }

  // Update local extra
  await updateCustomerMetadata(email, {
    notes: input.notes,
    tags: input.tags || ['Customer'],
    source: 'Manual Admin Entry',
  });

  return (await getCustomerProfile(email))!;
}

export async function updateCustomerMetadata(
  email: string,
  updates: { notes?: string; tags?: string[]; source?: string; hotel?: string; country?: string }
): Promise<void> {
  const extra = getLocal<Record<string, any>>(LOCAL_CUSTOMERS_EXTRA_KEY, {});
  extra[email.toLowerCase()] = {
    ...(extra[email.toLowerCase()] || {}),
    ...updates,
  };
  setLocal(LOCAL_CUSTOMERS_EXTRA_KEY, extra);

  if (isSupabaseConfigured()) {
    try {
      await supabase
        .from('customers')
        .update({
          notes: updates.notes,
          tags: updates.tags,
          hotel: updates.hotel,
          country: updates.country,
          updated_at: new Date().toISOString(),
        })
        .eq('email', email.toLowerCase());
    } catch {
      // ignore
    }
  }
}

// ------------------------------------------------------------------------------
// TAGS & SEGMENTS SERVICE
// ------------------------------------------------------------------------------

export async function listCrmTags(): Promise<CrmTag[]> {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase.from('crm_tags').select('*').order('name');
      if (!error && data && data.length > 0) {
        return data.map((d) => ({
          id: d.id,
          name: d.name,
          description: d.description,
          color: d.color,
          category: d.category,
          usageCount: d.usage_count || 0,
          createdAt: d.created_at,
        }));
      }
    } catch {
      // ignore
    }
  }

  return getLocal<CrmTag[]>(LOCAL_TAGS_KEY, DEFAULT_TAGS);
}

export async function createCrmTag(input: {
  name: string;
  description?: string;
  color?: string;
  category?: 'tier' | 'loyalty' | 'interest' | 'general';
}): Promise<CrmTag> {
  const newTag: CrmTag = {
    id: `tag-${Date.now().toString(36)}`,
    name: input.name.toLowerCase().replace(/\s+/g, '_'),
    description: input.description || null,
    color: input.color || '#2dd4bf',
    category: input.category || 'general',
    usageCount: 0,
    createdAt: new Date().toISOString(),
  };

  const tags = getLocal<CrmTag[]>(LOCAL_TAGS_KEY, DEFAULT_TAGS);
  setLocal(LOCAL_TAGS_KEY, [newTag, ...tags]);

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('crm_tags')
        .insert({
          name: newTag.name,
          description: newTag.description,
          color: newTag.color,
          category: newTag.category,
        })
        .select('*')
        .maybeSingle();

      if (!error && data) {
        newTag.id = data.id;
      }
    } catch {
      // ignore
    }
  }

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
  const lead = await createLead({
    name: inquiry.customer_name,
    email: inquiry.email,
    phone: inquiry.phone,
    whatsapp: inquiry.whatsapp || inquiry.phone,
    source: (inquiry.source as LeadSource) || 'Website',
    interestedTourId: inquiry.tour_id,
    interestedTourTitle: inquiry.admin_notes?.replace('Referenced Tour: ', '') || null,
    notes: `Converted from Help Inquiry: ${inquiry.message}`,
    stage: 'Contacted',
    score: 60,
  });

  if (isSupabaseConfigured()) {
    try {
      await supabase.from('inquiries').update({ status: 'converted' }).eq('id', inquiry.id);
    } catch {
      // ignore
    }
  }

  return lead;
}

export async function convertLeadToCustomer(leadId: string): Promise<string> {
  const leads = await listLeads();
  const lead = leads.find((l) => l.id === leadId);
  if (!lead) throw new Error('Lead not found');

  const cleanEmail = lead.email.trim().toLowerCase();
  const cleanPhone = lead.phone?.trim() || null;
  let customerId: string | null = lead.customerId || null;

  // 1. Deduplication: Check if customer already exists in database or cache
  if (!customerId && isSupabaseConfigured()) {
    try {
      const { data: existingCust } = await supabase
        .from('customers')
        .select('id, hotel, phone')
        .eq('email', cleanEmail)
        .maybeSingle();

      if (existingCust?.id) {
        customerId = existingCust.id;
      } else if (cleanPhone) {
        const { data: byPhone } = await supabase
          .from('customers')
          .select('id')
          .eq('phone', cleanPhone)
          .maybeSingle();
        if (byPhone?.id) customerId = byPhone.id;
      }
    } catch {}
  }

  // Check local cache if not found in Supabase
  if (!customerId) {
    const rawLocal = localStorage.getItem('rse_customers_cache');
    if (rawLocal) {
      try {
        const localList = JSON.parse(rawLocal);
        const match = localList.find(
          (c: any) =>
            c.email?.toLowerCase() === cleanEmail ||
            (cleanPhone && c.phone && c.phone.replace(/\s+/g, '') === cleanPhone.replace(/\s+/g, ''))
        );
        if (match) customerId = match.id;
      } catch {}
    }
  }

  // 2. Only create new customer if not already existing
  if (!customerId) {
    const createdCust = await createCustomer({
      firstName: lead.name.split(' ')[0] || lead.name,
      lastName: lead.name.split(' ').slice(1).join(' ') || '',
      email: lead.email,
      phone: lead.phone || '',
      whatsapp: lead.whatsapp || undefined,
      country: lead.country || 'International',
      hotel: lead.hotel || undefined,
      notes: lead.notes || undefined,
      tags: ['Converted Lead', 'Active Customer'],
    });
    customerId = createdCust.id;
  }

  // 3. Preserve Lead History & Link to Customer
  await updateLeadStage(leadId, 'Won');
  await updateLead(leadId, { customerId });

  // 4. Record Activity Timeline Event
  await recordActivity({
    customerId,
    leadId,
    eventType: 'lead_converted',
    title: 'Lead Converted to Customer',
    description: `${lead.name} (${lead.source}) successfully converted to verified customer. Preserved lead value: €${lead.estimatedValue || 0}.`,
    actor: 'Sales Team',
  });

  return lead.email;
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

  const newInquiries = inquiries.filter((i) => i.status === 'new').length;

  const totalWonLeadsEur = leads
    .filter((l) => l.stage === 'Won' || l.stage === 'Booked' as any)
    .reduce((sum, l) => sum + (l.estimatedValue || 0), 0);

  const totalRevenueEur = allBookings
    .filter((b) => b.status !== 'cancelled')
    .reduce((sum, b) => sum + (b.pricing?.totalEur || 0), 0);

  const outstandingPaymentsEur = allBookings
    .filter((b) => b.status !== 'cancelled' && b.paymentStatus !== 'paid')
    .reduce((sum, b) => sum + (b.pricing?.totalEur || 0), 0);

  const wonLeadsCount = leads.filter((l) => l.stage === 'Won' || (l.stage as any) === 'Booked').length;
  const lostLeadsCount = leads.filter((l) => l.stage === 'Lost').length;
  const closedLeads = wonLeadsCount + lostLeadsCount;
  const conversionRate = closedLeads > 0 ? Math.round((wonLeadsCount / closedLeads) * 100) : 0;

  const repeatCustomersCount = customers.filter((c) => c.totalBookings >= 2).length;
  const customerLifetimeValueAvgEur =
    customers.length > 0 ? Math.round(totalRevenueEur / customers.length) : 0;

  return {
    totalLeadsCount: leads.length,
    newLeadsCount: leads.filter((l) => l.stage === 'New').length,
    qualifiedLeadsCount: leads.filter((l) => l.stage === 'Qualified').length,
    wonLeadsCount,
    lostLeadsCount,
    conversionRate,
    followUpsDueCount: dueToday.length,
    overdueFollowUpsCount: overdue.length,
    openTasksCount: tasks.filter((t) => t.status === 'Pending' || t.status === 'In Progress').length,
    newInquiriesCount: newInquiries,
    newCustomersCount: customers.filter((c) => c.createdAt >= oneWeekAgo).length,
    repeatCustomersCount,
    customerLifetimeValueAvgEur,
    totalRevenueEur,
    outstandingPaymentsEur,
    totalActiveLeads: leads.filter((l) => l.stage !== 'Lost' && l.stage !== 'Won').length,
    totalWonLeadsEur,
  };
}
