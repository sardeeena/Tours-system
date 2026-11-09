import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Search,
  Filter,
  Phone,
  Mail,
  MapPin,
  Calendar,
  DollarSign,
  Clock,
  Eye,
  Plus,
  Tag,
  Hotel,
  ShieldCheck,
  CreditCard,
  MessageSquare,
  FileText,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  MessageCircle,
  Sparkles,
  Download,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import {
  listCrmCustomers,
  getCustomerProfile,
  updateCustomerMetadata,
  addStaffNote,
  recordCommunication,
  createTask,
} from '../../../services/crmService';
import { CrmCustomerDetail, CrmCommunication, CrmNote, CrmTask, CrmActivity } from '../../../types/crm';
import { useToast } from '../../../contexts/ToastContext';

export const CrmCustomersManager: React.FC = () => {
  const { showToast } = useToast();
  const [customers, setCustomers] = useState<CrmCustomerDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [tagFilter, setTagFilter] = useState<string>('all');

  // Customer Profile Modal
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [profileCustomer, setProfileCustomer] = useState<CrmCustomerDetail | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileActiveTab, setProfileActiveTab] = useState<
    'info' | 'bookings' | 'payments' | 'inquiries' | 'comms' | 'notes' | 'tasks' | 'timeline'
  >('info');

  // Modal interaction forms
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newCommSummary, setNewCommSummary] = useState('');
  const [newCommChannel, setNewCommChannel] = useState<'WhatsApp' | 'Email' | 'Phone' | 'In-Person'>('WhatsApp');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await listCrmCustomers();
      setCustomers(data);
    } catch (err) {
      console.warn('Failed to load customers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCustomerProfile = async (customerIdOrEmail: string) => {
    setSelectedCustomerId(customerIdOrEmail);
    setProfileLoading(true);
    setProfileActiveTab('info');
    try {
      const profile = await getCustomerProfile(customerIdOrEmail);
      setProfileCustomer(profile);
    } catch (err) {
      console.warn('Failed to load profile:', err);
      showToast('Could not load complete customer profile.', 'error');
    } finally {
      setProfileLoading(false);
    }
  };

  const closeProfile = () => {
    setSelectedCustomerId(null);
    setProfileCustomer(null);
  };

  // Add staff note
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileCustomer || !newNoteContent.trim()) return;
    setSubmittingAction(true);
    try {
      const note = await addStaffNote({
        customerId: profileCustomer.id,
        content: newNoteContent.trim(),
        staffName: 'Admin Staff',
      });
      setProfileCustomer((prev: CrmCustomerDetail | null) =>
        prev
          ? {
              ...prev,
              staffNotes: [note, ...prev.staffNotes],
            }
          : null
      );
      setNewNoteContent('');
      showToast('Internal note saved to traveler record.', 'success');
    } catch (err: any) {
      showToast('Failed to add note', 'error');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Record communication
  const handleRecordComm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileCustomer || !newCommSummary.trim()) return;
    setSubmittingAction(true);
    try {
      const comm = await recordCommunication({
        customerId: profileCustomer.id,
        customerName: profileCustomer.fullName,
        channel: newCommChannel,
        summary: newCommSummary.trim(),
        direction: 'outbound',
        staffName: 'Concierge Desk',
      });
      setProfileCustomer((prev: CrmCustomerDetail | null) =>
        prev
          ? {
              ...prev,
              communications: [comm, ...prev.communications],
            }
          : null
      );
      setNewCommSummary('');
      showToast('Communication logged successfully.', 'success');
    } catch (err: any) {
      showToast('Failed to log communication', 'error');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Create Task for customer
  const handleCreateCustomerTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileCustomer || !newTaskTitle.trim()) return;
    setSubmittingAction(true);
    try {
      const task = await createTask({
        title: newTaskTitle.trim(),
        customerId: profileCustomer.id,
        customerName: profileCustomer.fullName,
        dueDate: newTaskDueDate || new Date(Date.now() + 86400000).toISOString(),
        assignedStaffName: 'Captain Tarek',
        priority: 'High',
        isFollowUp: true,
      });
      setProfileCustomer((prev: CrmCustomerDetail | null) =>
        prev
          ? {
              ...prev,
              tasks: [task, ...prev.tasks],
            }
          : null
      );
      setNewTaskTitle('');
      setNewTaskDueDate('');
      showToast('Task assigned to staff for this customer.', 'success');
    } catch (err: any) {
      showToast('Failed to create task', 'error');
    } finally {
      setSubmittingAction(false);
    }
  };

  const allTags = useMemo(() => {
    const set = new Set<string>();
    customers.forEach((c) => c.tags.forEach((t) => set.add(t)));
    return Array.from(set);
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      if (tagFilter !== 'all' && !c.tags.includes(tagFilter)) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          c.fullName.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          (c.phone && c.phone.includes(q)) ||
          (c.whatsapp && c.whatsapp.includes(q)) ||
          (c.hotel && c.hotel.toLowerCase().includes(q)) ||
          c.bookings.some((b) => b.bookingReference.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [customers, tagFilter, searchQuery]);

  const exportCSV = () => {
    const headers = [
      'Full Name',
      'Email',
      'Phone',
      'WhatsApp',
      'Country',
      'Hotel',
      'Total Bookings',
      'Completed',
      'Cancelled',
      'Total Revenue EUR',
      'Outstanding EUR',
      'First Booking',
      'Latest Booking',
      'Source',
    ];
    const rows = filteredCustomers.map((c) => [
      `"${c.fullName}"`,
      `"${c.email}"`,
      `"${c.phone || ''}"`,
      `"${c.whatsapp || ''}"`,
      `"${c.country || ''}"`,
      `"${c.hotel || ''}"`,
      c.totalBookings,
      c.completedBookings,
      c.cancelledBookings,
      c.totalRevenue,
      c.outstandingAmount,
      `"${c.firstBookingDate || ''}"`,
      `"${c.latestBookingDate || ''}"`,
      `"${c.source}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `customers_crm_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] uppercase tracking-widest text-[#2dd4bf] font-bold block mb-0.5">
            Customer Directory
          </span>
          <h1 className="text-2xl font-bold font-display text-white tracking-tight flex items-center space-x-2">
            <Users className="w-6 h-6 text-[#2dd4bf]" />
            <span>Travelers & Customer Profiles</span>
          </h1>
          <p className="text-xs text-stone-400 mt-1">
            Complete 360° traveler dossier with booking history, payments, notes, and activity timeline.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="p-2 bg-stone-900 border border-stone-800 text-stone-300 hover:text-white rounded text-xs transition-colors cursor-pointer"
            title="Refresh Directory"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={exportCSV}
            className="inline-flex items-center space-x-1.5 px-3 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded text-xs font-medium border border-stone-700 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-stone-950 border border-stone-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search name, email, phone, WhatsApp, hotel, ref..."
            className="w-full pl-9 pr-3 py-1.5 bg-stone-900 border border-stone-800 rounded text-stone-200 placeholder-stone-500 focus:outline-none focus:border-[#0A6C74]"
          />
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-stone-400 text-xs hidden sm:inline">Tag:</span>
          <select
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-stone-900 border border-stone-800 rounded text-stone-300 focus:outline-none focus:border-[#0A6C74]"
          >
            <option value="all">All Tags ({customers.length})</option>
            {allTags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Customer Directory Table */}
      {loading ? (
        <div className="p-16 text-center text-stone-400">
          <div className="w-8 h-8 border-2 border-[#0A6C74] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs">Aggregating traveler accounts & bookings...</p>
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="bg-stone-950 border border-stone-800 rounded-xl p-12 text-center text-stone-400">
          <Users className="w-8 h-8 text-stone-600 mx-auto mb-2" />
          <p className="text-sm font-semibold text-stone-300">No customers found</p>
          <p className="text-xs text-stone-500">Try modifying your search or tag filter.</p>
        </div>
      ) : (
        <div className="bg-stone-950 border border-stone-800 rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-900 border-b border-stone-800 text-stone-400 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Traveler Name</th>
                  <th className="py-3 px-4">Contact Info</th>
                  <th className="py-3 px-4">Hotel / Resort</th>
                  <th className="py-3 px-4 text-center">Bookings</th>
                  <th className="py-3 px-4">Total Revenue</th>
                  <th className="py-3 px-4">Outstanding</th>
                  <th className="py-3 px-4">Tags</th>
                  <th className="py-3 px-4 text-right">Profile</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800/80">
                {filteredCustomers.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => openCustomerProfile(c.id)}
                    className="hover:bg-stone-900/60 cursor-pointer transition-colors group"
                  >
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white group-hover:text-[#2dd4bf] transition-colors">
                        {c.fullName}
                      </div>
                      <div className="text-[10px] text-stone-500">
                        Joined: {new Date(c.createdAt).toLocaleDateString()}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="text-stone-300 font-mono text-[11px]">{c.email}</div>
                      {c.phone && <div className="text-[10px] text-stone-400 font-mono">{c.phone}</div>}
                    </td>

                    <td className="py-3 px-4 text-stone-300">
                      <div className="truncate max-w-[180px]">{c.hotel || 'None recorded'}</div>
                      <div className="text-[10px] text-stone-500">{c.country || 'International'}</div>
                    </td>

                    <td className="py-3 px-4 text-center font-mono">
                      <span className="font-bold text-white">{c.totalBookings}</span>
                      {c.cancelledBookings > 0 && (
                        <span className="text-[10px] text-red-400 ml-1">
                          ({c.cancelledBookings} canc.)
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                      €{c.totalRevenue.toLocaleString()}
                    </td>

                    <td className="py-3 px-4 font-mono">
                      {c.outstandingAmount > 0 ? (
                        <span className="text-amber-400 font-bold">
                          €{c.outstandingAmount.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-stone-500">€0</span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {c.tags.slice(0, 2).map((tag) => (
                          <span
                            key={tag}
                            className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-stone-900 border border-stone-800 text-stone-300"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openCustomerProfile(c.id);
                        }}
                        className="p-1.5 bg-stone-900 group-hover:bg-[#0A6C74] text-stone-300 group-hover:text-white rounded text-xs transition-colors"
                        title="Open Full Profile"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* FULL CUSTOMER PROFILE MODAL */}
      {selectedCustomerId && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl max-w-4xl w-full h-[90vh] flex flex-col shadow-2xl text-xs overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-stone-950 border-b border-stone-800 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-[#0A6C74] flex items-center justify-center text-white font-bold text-sm">
                  {profileCustomer?.fullName.charAt(0) || 'C'}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h2 className="text-base font-bold text-white">
                      {profileCustomer?.fullName || 'Traveler Dossier'}
                    </h2>
                    {profileCustomer?.isRegistered && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        Registered User
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-stone-400 font-mono">
                    {profileCustomer?.email} &bull; {profileCustomer?.phone || 'No phone'}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {profileCustomer?.whatsapp && (
                  <a
                    href={`https://wa.me/${profileCustomer.whatsapp.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold transition-colors"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={closeProfile}
                  className="p-1.5 text-stone-400 hover:text-white rounded-lg hover:bg-stone-800 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Profile Navigation Tabs */}
            <div className="bg-stone-950/80 border-b border-stone-800 px-4 flex items-center space-x-1 overflow-x-auto shrink-0">
              {[
                { id: 'info', label: 'Customer Info' },
                { id: 'bookings', label: `Bookings (${profileCustomer?.bookings.length || 0})` },
                { id: 'payments', label: 'Payments' },
                { id: 'inquiries', label: `Inquiries (${profileCustomer?.inquiries.length || 0})` },
                { id: 'comms', label: `Communications (${profileCustomer?.communications.length || 0})` },
                { id: 'notes', label: `Staff Notes (${profileCustomer?.staffNotes.length || 0})` },
                { id: 'tasks', label: `Tasks (${profileCustomer?.tasks.length || 0})` },
                { id: 'timeline', label: 'Activity Timeline' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setProfileActiveTab(tab.id as any)}
                  className={`py-3 px-3 border-b-2 font-medium text-xs whitespace-nowrap transition-colors cursor-pointer ${
                    profileActiveTab === tab.id
                      ? 'border-[#2dd4bf] text-[#2dd4bf]'
                      : 'border-transparent text-stone-400 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Profile Body Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {profileLoading || !profileCustomer ? (
                <div className="p-12 text-center text-stone-400">
                  <div className="w-6 h-6 border-2 border-[#0A6C74] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p>Loading complete profile...</p>
                </div>
              ) : (
                <>
                  {/* 1. CUSTOMER INFORMATION */}
                  {profileActiveTab === 'info' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="p-3 bg-stone-950 rounded-lg border border-stone-800">
                          <span className="text-[10px] text-stone-500 uppercase font-bold block">Total Bookings</span>
                          <span className="text-base font-bold text-white font-mono">{profileCustomer.totalBookings}</span>
                        </div>
                        <div className="p-3 bg-stone-950 rounded-lg border border-stone-800">
                          <span className="text-[10px] text-stone-500 uppercase font-bold block">Lifetime Revenue</span>
                          <span className="text-base font-bold text-emerald-400 font-mono">€{profileCustomer.totalRevenue}</span>
                        </div>
                        <div className="p-3 bg-stone-950 rounded-lg border border-stone-800">
                          <span className="text-[10px] text-stone-500 uppercase font-bold block">Outstanding Balance</span>
                          <span className={`text-base font-bold font-mono ${profileCustomer.outstandingAmount > 0 ? 'text-amber-400' : 'text-stone-400'}`}>
                            €{profileCustomer.outstandingAmount}
                          </span>
                        </div>
                        <div className="p-3 bg-stone-950 rounded-lg border border-stone-800">
                          <span className="text-[10px] text-stone-500 uppercase font-bold block">First Booking</span>
                          <span className="text-xs font-semibold text-stone-200">
                            {profileCustomer.firstBookingDate ? new Date(profileCustomer.firstBookingDate).toLocaleDateString() : 'None'}
                          </span>
                        </div>
                      </div>

                      <div className="bg-stone-950 rounded-xl p-4 border border-stone-800 space-y-3">
                        <h4 className="font-bold text-white uppercase text-[10px] tracking-wider">Contact & Resort Dossier</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <span className="text-stone-500 block text-[10px]">Email Address</span>
                            <span className="text-white font-mono">{profileCustomer.email}</span>
                          </div>
                          <div>
                            <span className="text-stone-500 block text-[10px]">Phone Number</span>
                            <span className="text-white font-mono">{profileCustomer.phone || 'Not provided'}</span>
                          </div>
                          <div>
                            <span className="text-stone-500 block text-[10px]">WhatsApp</span>
                            <span className="text-white font-mono">{profileCustomer.whatsapp || 'Not provided'}</span>
                          </div>
                          <div>
                            <span className="text-stone-500 block text-[10px]">Resort / Hotel</span>
                            <span className="text-white">{profileCustomer.hotel || 'Not specified'}</span>
                          </div>
                          <div>
                            <span className="text-stone-500 block text-[10px]">Country of Origin</span>
                            <span className="text-white">{profileCustomer.country || 'International'}</span>
                          </div>
                          <div>
                            <span className="text-stone-500 block text-[10px]">Customer Source</span>
                            <span className="text-white">{profileCustomer.source}</span>
                          </div>
                        </div>
                      </div>

                      {/* Tags */}
                      <div className="bg-stone-950 rounded-xl p-4 border border-stone-800 space-y-2">
                        <h4 className="font-bold text-white uppercase text-[10px] tracking-wider">Customer Tags</h4>
                        <div className="flex flex-wrap gap-1.5">
                          {profileCustomer.tags.map((tag) => (
                            <span
                              key={tag}
                              className="px-2.5 py-1 bg-stone-900 border border-stone-800 text-stone-300 rounded text-xs font-medium"
                            >
                              🏷️ {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 2. BOOKING HISTORY */}
                  {profileActiveTab === 'bookings' && (
                    <div className="space-y-3">
                      {profileCustomer.bookings.length === 0 ? (
                        <p className="p-8 text-center text-stone-500">No bookings on record for this customer.</p>
                      ) : (
                        profileCustomer.bookings.map((b) => (
                          <div
                            key={b.bookingId || b.bookingReference}
                            className="p-3.5 bg-stone-950 rounded-xl border border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center space-x-2">
                                <span className="font-bold text-white text-xs">{b.tourTitle}</span>
                                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-stone-900 border border-stone-800 text-[#2dd4bf]">
                                  {b.bookingReference}
                                </span>
                              </div>
                              <div className="text-[11px] text-stone-400">
                                Date: {b.date} &bull; Guests: {b.guests.adults} Adults
                                {b.guests.children ? `, ${b.guests.children} Children` : ''} &bull; Hotel: {b.pickup.hotelName || 'Direct'}
                              </div>
                            </div>

                            <div className="flex items-center space-x-3 sm:text-right">
                              <div>
                                <div className="font-mono font-bold text-emerald-400 text-sm">
                                  €{b.pricing.totalEur}
                                </div>
                                <span className="text-[10px] text-stone-500 uppercase">{b.status}</span>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* 3. PAYMENTS */}
                  {profileActiveTab === 'payments' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-stone-950 rounded-lg border border-stone-800">
                          <span className="text-[10px] text-stone-500 uppercase font-bold block">Total Paid</span>
                          <span className="text-base font-bold text-emerald-400 font-mono">
                            €{profileCustomer.totalRevenue - profileCustomer.outstandingAmount}
                          </span>
                        </div>
                        <div className="p-3 bg-stone-950 rounded-lg border border-stone-800">
                          <span className="text-[10px] text-stone-500 uppercase font-bold block">Outstanding Balance</span>
                          <span className="text-base font-bold text-amber-400 font-mono">
                            €{profileCustomer.outstandingAmount}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {profileCustomer.bookings.map((b) => (
                          <div
                            key={b.bookingReference}
                            className="p-3 bg-stone-950 rounded-lg border border-stone-800 flex items-center justify-between"
                          >
                            <div>
                              <span className="font-bold text-white">{b.bookingReference}</span>
                              <span className="text-stone-400 block text-[11px]">{b.tourTitle}</span>
                            </div>
                            <div className="text-right">
                              <span className="font-mono font-bold text-white">€{b.pricing.totalEur}</span>
                              <span
                                className={`block text-[10px] uppercase font-semibold ${
                                  b.paymentStatus === 'paid' ? 'text-emerald-400' : 'text-amber-400'
                                }`}
                              >
                                {b.paymentStatus || 'Pending'} ({b.paymentMethod === 'pay_online' ? 'Card' : 'Cash on Pier'})
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 4. INQUIRIES */}
                  {profileActiveTab === 'inquiries' && (
                    <div className="space-y-3">
                      {profileCustomer.inquiries.length === 0 ? (
                        <p className="p-8 text-center text-stone-500">No inquiry messages submitted.</p>
                      ) : (
                        profileCustomer.inquiries.map((inq) => (
                          <div key={inq.id} className="p-3.5 bg-stone-950 rounded-xl border border-stone-800 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-white">{inq.subject || 'Excursion Request'}</span>
                              <span className="text-[10px] text-stone-500">{new Date(inq.created_at).toLocaleDateString()}</span>
                            </div>
                            <p className="text-stone-300 text-[11px] bg-stone-900/60 p-2.5 rounded border border-stone-800">
                              "{inq.message}"
                            </p>
                            <span className="px-2 py-0.5 rounded text-[9px] uppercase font-bold bg-stone-900 border border-stone-800 text-[#2dd4bf]">
                              Status: {inq.status}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* 5. COMMUNICATIONS */}
                  {profileActiveTab === 'comms' && (
                    <div className="space-y-4">
                      {/* Log communication form */}
                      <form onSubmit={handleRecordComm} className="p-3.5 bg-stone-950 rounded-xl border border-stone-800 space-y-2.5">
                        <h4 className="font-bold text-white text-xs">Log Traveler Communication</h4>
                        <div className="flex gap-2">
                          <select
                            value={newCommChannel}
                            onChange={(e) => setNewCommChannel(e.target.value as any)}
                            className="px-2.5 py-1.5 bg-stone-900 border border-stone-800 rounded text-stone-200"
                          >
                            <option value="WhatsApp">WhatsApp</option>
                            <option value="Phone">Phone Call</option>
                            <option value="Email">Email</option>
                            <option value="In-Person">In-Person (Pier Desk)</option>
                          </select>
                          <input
                            type="text"
                            required
                            value={newCommSummary}
                            onChange={(e) => setNewCommSummary(e.target.value)}
                            placeholder="Summary of conversation..."
                            className="flex-1 px-3 py-1.5 bg-stone-900 border border-stone-800 rounded text-white"
                          />
                          <button
                            type="submit"
                            disabled={submittingAction}
                            className="px-3 py-1.5 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded font-semibold cursor-pointer"
                          >
                            Log
                          </button>
                        </div>
                      </form>

                      <div className="space-y-2">
                        {profileCustomer.communications.map((comm) => (
                          <div key={comm.id} className="p-3 bg-stone-950 rounded-lg border border-stone-800 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-white flex items-center space-x-1.5">
                                <MessageSquare className="w-3.5 h-3.5 text-[#2dd4bf]" />
                                <span>{comm.channel} Log</span>
                              </span>
                              <span className="text-[10px] text-stone-500 font-mono">
                                {new Date(comm.createdAt).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-stone-300 text-[11px]">{comm.summary}</p>
                            <span className="text-[10px] text-stone-500">Logged by {comm.staffName}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 6. STAFF NOTES */}
                  {profileActiveTab === 'notes' && (
                    <div className="space-y-4">
                      {/* Add note form */}
                      <form onSubmit={handleAddNote} className="p-3.5 bg-stone-950 rounded-xl border border-stone-800 space-y-2.5">
                        <h4 className="font-bold text-white text-xs">Add Internal Staff Note</h4>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            required
                            value={newNoteContent}
                            onChange={(e) => setNewNoteContent(e.target.value)}
                            placeholder="Confidential staff note (e.g. Needs baby car seat, VIP repeat client)..."
                            className="flex-1 px-3 py-1.5 bg-stone-900 border border-stone-800 rounded text-white"
                          />
                          <button
                            type="submit"
                            disabled={submittingAction}
                            className="px-3 py-1.5 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded font-semibold cursor-pointer"
                          >
                            Add Note
                          </button>
                        </div>
                      </form>

                      <div className="space-y-2">
                        {profileCustomer.staffNotes.map((note) => (
                          <div key={note.id} className="p-3 bg-stone-950 rounded-lg border border-stone-800 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-white">{note.staffName}</span>
                              <span className="text-[10px] text-stone-500 font-mono">
                                {new Date(note.createdAt).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-stone-300 text-[11px]">{note.content}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 7. TASKS */}
                  {profileActiveTab === 'tasks' && (
                    <div className="space-y-4">
                      {/* Assign task form */}
                      <form onSubmit={handleCreateCustomerTask} className="p-3.5 bg-stone-950 rounded-xl border border-stone-800 space-y-2.5">
                        <h4 className="font-bold text-white text-xs">Assign Task for this Traveler</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <input
                            type="text"
                            required
                            value={newTaskTitle}
                            onChange={(e) => setNewTaskTitle(e.target.value)}
                            placeholder="e.g. Call regarding private transfer..."
                            className="sm:col-span-2 px-3 py-1.5 bg-stone-900 border border-stone-800 rounded text-white"
                          />
                          <div className="flex gap-2">
                            <input
                              type="date"
                              value={newTaskDueDate}
                              onChange={(e) => setNewTaskDueDate(e.target.value)}
                              className="flex-1 px-2 py-1.5 bg-stone-900 border border-stone-800 rounded text-white"
                            />
                            <button
                              type="submit"
                              disabled={submittingAction}
                              className="px-3 py-1.5 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded font-semibold cursor-pointer"
                            >
                              Assign
                            </button>
                          </div>
                        </div>
                      </form>

                      <div className="space-y-2">
                        {profileCustomer.tasks.map((task) => (
                          <div key={task.id} className="p-3 bg-stone-950 rounded-lg border border-stone-800 flex items-center justify-between">
                            <div>
                              <span className="font-bold text-white">{task.title}</span>
                              <div className="text-[10px] text-stone-400">
                                Assigned: {task.assignedStaffName} &bull; Due: {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'None'}
                              </div>
                            </div>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-stone-900 border border-stone-800 text-[#2dd4bf]">
                              {task.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 8. ACTIVITY TIMELINE */}
                  {profileActiveTab === 'timeline' && (
                    <div className="space-y-3">
                      <div className="border-l-2 border-stone-800 ml-3 pl-4 space-y-4">
                        {profileCustomer.activities.map((act) => (
                          <div key={act.id} className="relative text-xs space-y-0.5">
                            <div className="absolute -left-[23px] top-1 w-2.5 h-2.5 rounded-full bg-[#0A6C74] border-2 border-stone-900" />
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-white">{act.title}</span>
                              <span className="text-[10px] text-stone-500 font-mono">
                                {new Date(act.createdAt).toLocaleString()}
                              </span>
                            </div>
                            {act.description && <p className="text-stone-300 text-[11px]">{act.description}</p>}
                            <span className="text-[10px] text-stone-500 italic block">Actor: {act.actor}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
