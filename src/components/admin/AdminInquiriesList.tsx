import React, { useState, useEffect, useMemo } from 'react';
import {
  HelpCircle,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  MessageCircle,
  Mail,
  Phone,
  Trash2,
  Eye,
  RefreshCw,
  AlertCircle,
  User,
  Compass,
  FileText,
  Send,
  Calendar,
  AlertTriangle,
} from 'lucide-react';
import {
  listInquiries,
  updateInquiryStatus,
  deleteInquiry,
} from '../../services/inquiryService';
import { DbInquiry } from '../../types/database';
import { useToast } from '../../contexts/ToastContext';

export const AdminInquiriesList: React.FC = () => {
  const { showToast } = useToast();
  const [inquiries, setInquiries] = useState<DbInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'new' | 'contacted' | 'resolved'>('all');
  const [selectedInquiry, setSelectedInquiry] = useState<DbInquiry | null>(null);
  const [adminNoteInput, setAdminNoteInput] = useState('');
  const [updating, setUpdating] = useState(false);
  const [inquiryToDelete, setInquiryToDelete] = useState<DbInquiry | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await listInquiries();
      setInquiries(data);
    } catch (err) {
      console.error('Failed to load inquiries:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredInquiries = useMemo(() => {
    return inquiries.filter((inq) => {
      const matchesStatus = statusFilter === 'all' || inq.status === statusFilter;
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        inq.customer_name.toLowerCase().includes(q) ||
        inq.email.toLowerCase().includes(q) ||
        (inq.phone && inq.phone.toLowerCase().includes(q)) ||
        inq.subject.toLowerCase().includes(q) ||
        inq.message.toLowerCase().includes(q);

      return matchesStatus && matchesSearch;
    });
  }, [inquiries, statusFilter, searchQuery]);

  const handleStatusChange = async (id: string, newStatus: DbInquiry['status']) => {
    setUpdating(true);
    try {
      const success = await updateInquiryStatus(id, newStatus);
      if (success) {
        setInquiries((prev) =>
          prev.map((item) => (item.id === id ? { ...item, status: newStatus } : item))
        );
        if (selectedInquiry?.id === id) {
          setSelectedInquiry((prev) => (prev ? { ...prev, status: newStatus } : null));
        }
        showToast(`Inquiry status updated to "${newStatus}".`, 'success');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to update inquiry status', 'error');
    } finally {
      setUpdating(false);
    }
  };

  const handleSaveNote = async () => {
    if (!selectedInquiry) return;
    setUpdating(true);
    try {
      const success = await updateInquiryStatus(
        selectedInquiry.id,
        selectedInquiry.status,
        adminNoteInput
      );
      if (success) {
        setInquiries((prev) =>
          prev.map((item) =>
            item.id === selectedInquiry.id ? { ...item, admin_notes: adminNoteInput } : item
          )
        );
        setSelectedInquiry((prev) => (prev ? { ...prev, admin_notes: adminNoteInput } : null));
        showToast('Admin note saved.', 'success');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to save admin note', 'error');
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = (inq: DbInquiry) => {
    setInquiryToDelete(inq);
  };

  const confirmDeleteInquiry = async () => {
    if (!inquiryToDelete) return;
    setIsDeleting(true);
    try {
      const success = await deleteInquiry(inquiryToDelete.id);
      if (success) {
        setInquiries((prev) => prev.filter((item) => item.id !== inquiryToDelete.id));
        if (selectedInquiry?.id === inquiryToDelete.id) {
          setSelectedInquiry(null);
        }
        showToast(`Inquiry from "${inquiryToDelete.customer_name}" removed.`, 'info');
      } else {
        showToast('Failed to remove inquiry.', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to delete inquiry', 'error');
    } finally {
      setInquiryToDelete(null);
      setIsDeleting(false);
    }
  };

  const openInquiryDetail = (inq: DbInquiry) => {
    setSelectedInquiry(inq);
    setAdminNoteInput(inq.admin_notes || '');
  };

  // Metrics
  const newCount = inquiries.filter((i) => i.status === 'new').length;
  const contactedCount = inquiries.filter((i) => i.status === 'contacted').length;
  const resolvedCount = inquiries.filter((i) => i.status === 'resolved').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <HelpCircle className="w-5 h-5 text-[#2dd4bf]" />
            <span>Help Requests & Inquiries</span>
          </h2>
          <p className="text-xs text-stone-400 mt-1">
            Manage inbound traveler questions, special tour assistance, and concierge messages stored in your database.
          </p>
        </div>

        <button
          type="button"
          onClick={loadData}
          disabled={loading}
          className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-lg text-xs font-semibold shadow transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-stone-950 border border-stone-800 p-4 rounded-xl">
          <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
            Total Inquiries
          </span>
          <p className="text-2xl font-bold text-white mt-1">{inquiries.length}</p>
        </div>
        <div className="bg-stone-950 border border-amber-900/40 p-4 rounded-xl">
          <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider flex items-center justify-between">
            <span>New (Awaiting Reply)</span>
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          </span>
          <p className="text-2xl font-bold text-amber-300 mt-1">{newCount}</p>
        </div>
        <div className="bg-stone-950 border border-blue-900/40 p-4 rounded-xl">
          <span className="text-[11px] font-semibold text-blue-400 uppercase tracking-wider">
            Contacted / In Progress
          </span>
          <p className="text-2xl font-bold text-blue-300 mt-1">{contactedCount}</p>
        </div>
        <div className="bg-stone-950 border border-emerald-900/40 p-4 rounded-xl">
          <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
            Resolved
          </span>
          <p className="text-2xl font-bold text-emerald-300 mt-1">{resolvedCount}</p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-stone-950 border border-stone-800 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-stone-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by customer, email, subject..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-stone-900 border border-stone-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-[#0A6C74]"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <Filter className="w-3.5 h-3.5 text-stone-400 shrink-0" />
          <div className="flex rounded-lg bg-stone-900 p-1 border border-stone-800 text-xs w-full sm:w-auto">
            {(['all', 'new', 'contacted', 'resolved'] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1 rounded text-xs font-medium capitalize transition-colors ${
                  statusFilter === status
                    ? 'bg-[#0A6C74] text-white'
                    : 'text-stone-400 hover:text-white'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Inquiries Table */}
      <div className="bg-stone-950 border border-stone-800 rounded-xl overflow-hidden shadow-lg">
        {loading ? (
          <div className="p-12 text-center text-stone-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#0A6C74] mb-2" />
            <p className="text-xs">Loading inquiries from database...</p>
          </div>
        ) : filteredInquiries.length === 0 ? (
          <div className="p-12 text-center text-stone-500 space-y-2">
            <HelpCircle className="w-10 h-10 mx-auto text-stone-600" />
            <p className="text-sm text-stone-300 font-medium">No help requests found</p>
            <p className="text-xs text-stone-500">
              {searchQuery || statusFilter !== 'all'
                ? 'Try adjusting your search filters.'
                : 'Customer inquiries submitted through the site will automatically populate here.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-stone-300">
              <thead className="bg-stone-900 border-b border-stone-800 text-stone-400 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Inquiry / Subject</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-850">
                {filteredInquiries.map((inq) => {
                  const dateStr = new Date(inq.created_at).toLocaleString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <tr
                      key={inq.id}
                      onClick={() => openInquiryDetail(inq)}
                      className="hover:bg-stone-900/60 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-4 whitespace-nowrap">
                        {inq.status === 'new' && (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            <Clock className="w-3 h-3" />
                            <span>New</span>
                          </span>
                        )}
                        {inq.status === 'contacted' && (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                            <MessageCircle className="w-3 h-3" />
                            <span>Contacted</span>
                          </span>
                        )}
                        {inq.status === 'resolved' && (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Resolved</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 font-medium text-white">
                        <div className="flex items-center space-x-2">
                          <div className="w-6 h-6 rounded-full bg-stone-800 text-stone-300 flex items-center justify-center text-[10px] font-bold">
                            {inq.customer_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div>{inq.customer_name}</div>
                            <div className="text-[11px] text-stone-500">{inq.email}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 max-w-xs">
                        <div className="font-medium text-stone-200 truncate">{inq.subject}</div>
                        <div className="text-[11px] text-stone-400 truncate">{inq.message}</div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="space-y-0.5">
                          {inq.phone ? (
                            <div className="text-[11px] text-stone-300 flex items-center space-x-1">
                              <Phone className="w-3 h-3 text-stone-500" />
                              <span>{inq.phone}</span>
                            </div>
                          ) : (
                            <span className="text-[11px] text-stone-500">Email only</span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap text-stone-400 text-[11px]">
                        {dateStr}
                      </td>

                      <td
                        className="py-3 px-4 whitespace-nowrap text-right space-x-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => openInquiryDetail(inq)}
                          className="p-1.5 hover:bg-stone-800 text-stone-300 hover:text-white rounded"
                          title="View Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {inq.whatsapp && (
                          <a
                            href={`https://wa.me/${inq.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(
                              `Hello ${inq.customer_name}, this is the Red Sea Voyagers pier concierge team replying to your inquiry regarding: ${inq.subject}.`
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block p-1.5 hover:bg-emerald-950/60 text-emerald-400 rounded"
                            title="Reply on WhatsApp"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDelete(inq)}
                          className="p-1.5 hover:bg-red-950/60 text-stone-500 hover:text-red-400 rounded cursor-pointer"
                          title="Delete Record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Inquiry Detail Drawer / Modal */}
      {selectedInquiry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="relative w-full max-w-xl bg-stone-900 border border-stone-700 rounded-xl shadow-2xl p-6 text-stone-100 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-start justify-between pb-3 border-b border-stone-800">
              <div>
                <span className="text-[10px] uppercase font-bold text-[#2dd4bf] tracking-wider">
                  Inquiry Details
                </span>
                <h3 className="text-base font-bold text-white mt-0.5">
                  {selectedInquiry.subject}
                </h3>
                <span className="text-[11px] text-stone-400">
                  Received on {new Date(selectedInquiry.created_at).toLocaleString()}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedInquiry(null)}
                className="p-1 text-stone-400 hover:text-white rounded hover:bg-stone-800"
              >
                ✕
              </button>
            </div>

            {/* Customer Info Card */}
            <div className="bg-stone-950 border border-stone-800 rounded-lg p-3 grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-stone-500 text-[10px]">Customer Name:</span>
                <p className="font-semibold text-white">{selectedInquiry.customer_name}</p>
              </div>
              <div>
                <span className="text-stone-500 text-[10px]">Email Address:</span>
                <p className="font-mono text-stone-200">{selectedInquiry.email}</p>
              </div>
              <div>
                <span className="text-stone-500 text-[10px]">Phone / WhatsApp:</span>
                <p className="text-stone-200">{selectedInquiry.phone || 'Not provided'}</p>
              </div>
              <div>
                <span className="text-stone-500 text-[10px]">Current Status:</span>
                <div className="mt-1">
                  <select
                    value={selectedInquiry.status}
                    onChange={(e) =>
                      handleStatusChange(
                        selectedInquiry.id,
                        e.target.value as DbInquiry['status']
                      )
                    }
                    className="bg-stone-900 border border-stone-700 rounded px-2 py-1 text-xs text-white focus:outline-none"
                  >
                    <option value="new">New (Awaiting Reply)</option>
                    <option value="contacted">Contacted / In Progress</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Message Body */}
            <div>
              <span className="text-xs font-semibold text-stone-300 block mb-1">
                Traveler Message:
              </span>
              <div className="bg-stone-950 border border-stone-800 rounded-lg p-3.5 text-xs text-stone-200 whitespace-pre-wrap leading-relaxed">
                {selectedInquiry.message}
              </div>
            </div>

            {/* Admin Notes */}
            <div>
              <label className="text-xs font-semibold text-stone-300 block mb-1">
                Internal Concierge Notes (Database):
              </label>
              <textarea
                rows={3}
                placeholder="Log internal follow-up notes, quotes provided, or assigned staff..."
                value={adminNoteInput}
                onChange={(e) => setAdminNoteInput(e.target.value)}
                className="w-full bg-stone-950 border border-stone-700 rounded-lg p-2.5 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-[#0A6C74] resize-none"
              />
              <button
                type="button"
                onClick={handleSaveNote}
                disabled={updating}
                className="mt-1.5 px-3 py-1.5 bg-[#0A6C74] hover:bg-[#08545a] text-white rounded text-xs font-semibold shadow transition-colors"
              >
                Save Notes
              </button>
            </div>

            {/* Direct Contact Actions */}
            <div className="pt-3 border-t border-stone-800 flex flex-wrap gap-2 justify-between">
              <div className="flex gap-2">
                {selectedInquiry.whatsapp && (
                  <a
                    href={`https://wa.me/${selectedInquiry.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(
                      `Hello ${selectedInquiry.customer_name}, this is Red Sea Voyagers Concierge following up on your inquiry: "${selectedInquiry.subject}".`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold shadow"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>WhatsApp Customer</span>
                  </a>
                )}
                <a
                  href={`mailto:${selectedInquiry.email}?subject=${encodeURIComponent(
                    `Red Sea Voyagers Concierge: ${selectedInquiry.subject}`
                  )}`}
                  className="inline-flex items-center space-x-1.5 px-3 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded text-xs font-semibold"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Send Email</span>
                </a>
              </div>

              <button
                type="button"
                onClick={() => setSelectedInquiry(null)}
                className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded text-xs font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Inquiry Confirmation Modal */}
      {inquiryToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-xl max-w-sm w-full p-6 space-y-4 shadow-2xl text-xs">
            <div className="flex items-center space-x-2.5 text-amber-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-bold text-white">Delete Inquiry Record</h3>
            </div>
            <p className="text-stone-300 leading-relaxed">
              Are you sure you want to remove the inquiry from <strong className="text-white">{inquiryToDelete.customer_name}</strong> regarding <span className="text-stone-400 font-medium">"{inquiryToDelete.subject}"</span>?
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-stone-800">
              <button
                type="button"
                onClick={() => setInquiryToDelete(null)}
                disabled={isDeleting}
                className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteInquiry}
                disabled={isDeleting}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded font-semibold disabled:opacity-50 cursor-pointer"
              >
                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
