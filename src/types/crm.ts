import { UserRole } from './database';
import { Booking } from './booking';

export type LeadStage =
  | 'New'
  | 'Contacted'
  | 'Qualified'
  | 'Proposal'
  | 'Follow-up'
  | 'Won'
  | 'Lost'
  | 'Interested'
  | 'Quotation Sent'
  | 'Booking Pending'
  | 'Booked'
  | 'Completed';

export interface CrmLeadStageConfig {
  id: string;
  name: LeadStage;
  label: string;
  color: string;
  sortOrder: number;
  isActive: boolean;
  isWon: boolean;
  isLost: boolean;
}

export type LeadSource =
  | 'Website'
  | 'WhatsApp'
  | 'Facebook'
  | 'Instagram'
  | 'Google'
  | 'Phone'
  | 'Email'
  | 'Hotel'
  | 'Referral'
  | 'Walk-in'
  | 'Other';

export interface CrmLead {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  whatsapp?: string | null;
  country?: string | null;
  hotel?: string | null;
  source: LeadSource;
  interestedTourId?: string | null;
  interestedTourTitle?: string | null;
  destination?: string | null;
  travelDate?: string | null;
  numberOfGuests: number;
  estimatedValue: number;
  currency: string;
  stage: LeadStage;
  status: 'active' | 'converted' | 'lost' | 'archived';
  score: number;
  notes?: string | null;
  tags?: string[];
  assignedStaffId?: string | null;
  assignedStaffName?: string | null;
  customerId?: string | null;
  followUpDate?: string | null;
  followUpChannel?: FollowUpChannel | null;
  lastContactAt?: string | null;
  contactAttemptsCount?: number;
  lostReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type TaskPriority = 'Low' | 'Medium' | 'High' | 'Urgent';
export type TaskStatus = 'Pending' | 'In Progress' | 'Completed' | 'Cancelled';
export type FollowUpChannel = 'Phone' | 'Email' | 'WhatsApp' | 'Note' | 'Other';

export interface CrmTask {
  id: string;
  title: string;
  description?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  leadId?: string | null;
  leadName?: string | null;
  bookingId?: string | null;
  bookingReference?: string | null;
  assignedStaffId?: string | null;
  assignedStaffName?: string | null;
  dueDate?: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  isFollowUp: boolean;
  followUpChannel?: FollowUpChannel;
  outcomeNotes?: string | null;
  completedAt?: string | null;
  completedByName?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CommChannel = 'WhatsApp' | 'Email' | 'Phone' | 'In-Person' | 'Web Chat' | 'SMS';

export interface CrmCommunication {
  id: string;
  customerId?: string | null;
  customerName?: string | null;
  leadId?: string | null;
  bookingId?: string | null;
  channel: CommChannel;
  direction: 'inbound' | 'outbound';
  summary: string;
  content?: string | null;
  staffName: string;
  staffId?: string | null;
  templateKey?: string | null;
  subject?: string | null;
  status?: string | null;
  provider?: string | null;
  recipient?: string | null;
  sentAt?: string | null;
  createdAt: string;
}

export type ConversationProvider =
  | 'resend'
  | 'sendgrid'
  | 'meta_whatsapp'
  | 'twilio'
  | 'manual'
  | 'unconfigured';

export type ConversationProviderStatus =
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed'
  | 'logged'
  | 'provider_not_configured';

export interface CrmConversationRecord {
  id: string;
  customerId?: string | null;
  leadId?: string | null;
  bookingId?: string | null;
  channel: 'whatsapp' | 'email' | 'phone' | 'web_chat' | 'sms';
  direction: 'inbound' | 'outbound';
  senderIdentifier: string;
  recipientIdentifier: string;
  subject?: string | null;
  messageBody: string;
  provider: ConversationProvider;
  providerMessageId?: string | null;
  providerStatus: ConversationProviderStatus;
  errorDetails?: string | null;
  staffId?: string | null;
  staffName: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface CrmNote {
  id: string;
  customerId?: string | null;
  leadId?: string | null;
  bookingId?: string | null;
  content: string;
  staffName: string;
  staffId?: string | null;
  isPinned: boolean;
  createdAt: string;
}

export type CrmEventType =
  | 'account_created'
  | 'inquiry_created'
  | 'booking_created'
  | 'booking_updated'
  | 'payment_recorded'
  | 'booking_changed'
  | 'cancellation'
  | 'review_submitted'
  | 'staff_note'
  | 'communication'
  | 'conversation'
  | 'lead_created'
  | 'stage_changed'
  | 'lead_assigned'
  | 'lead_converted'
  | 'task_created'
  | 'task_completed'
  | 'followup_scheduled'
  | 'contact_attempt'
  | 'followup'
  | 'departure'
  | 'task'
  | 'refund'
  | 'review';

export interface CrmActivity {
  id: string;
  customerId?: string | null;
  leadId?: string | null;
  bookingId?: string | null;
  eventType: CrmEventType;
  title: string;
  description?: string | null;
  actor: string;
  staffName?: string | null;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface CrmTag {
  id: string;
  name: string;
  description?: string | null;
  color: string;
  category: 'tier' | 'loyalty' | 'interest' | 'general';
  usageCount: number;
  createdAt: string;
}

export interface CrmSegment {
  id: string;
  name: string;
  slug: string;
  description: string;
  badgeLabel: string;
  color: string;
  icon: string;
  ruleType: 'repeat' | 'high_value' | 'dormant_12m' | 'upcoming_trip' | 'interest_diving' | 'unconverted_inquiry' | 'custom';
  filterCriteria?: Record<string, any>;
  customerCount?: number;
  isActive: boolean;
}

export interface CrmCustomerDetail {
  id: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone?: string | null;
  whatsapp?: string | null;
  country?: string | null;
  hotel?: string | null;
  notes?: string | null;
  tags: string[];
  status: 'active' | 'vip' | 'inactive' | 'archived';
  firstBookingDate?: string | null;
  latestBookingDate?: string | null;
  upcomingBookingDate?: string | null;
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  totalRevenue: number;
  totalSpentEur?: number;
  outstandingAmount: number;
  lastContactDate?: string | null;
  source: string;
  createdAt: string;
  role: UserRole;
  isRegistered: boolean;
  avatarUrl?: string | null;
  preferredCurrency?: string;
  bookings: Booking[];
  inquiries: any[];
  leads?: CrmLead[];
  payments?: any[];
  conversations?: CrmConversationRecord[];
  communications: CrmCommunication[];
  staffNotes: CrmNote[];
  tasks: CrmTask[];
  activities: CrmActivity[];
  reviews: any[];
}

export interface CrmDashboardMetrics {
  totalLeadsCount: number;
  newLeadsCount: number;
  qualifiedLeadsCount: number;
  wonLeadsCount: number;
  lostLeadsCount: number;
  conversionRate: number; // percentage
  followUpsDueCount: number;
  overdueFollowUpsCount: number;
  openTasksCount: number;
  newInquiriesCount: number;
  newCustomersCount: number;
  repeatCustomersCount: number;
  customerLifetimeValueAvgEur: number;
  totalRevenueEur: number;
  outstandingPaymentsEur: number;
  totalActiveLeads: number;
  totalWonLeadsEur: number;
}
