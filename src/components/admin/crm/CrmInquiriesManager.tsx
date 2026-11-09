import React, { useState, useEffect, useMemo } from 'react';
import {
  MessageSquare,
  Search,
  Filter,
  UserCheck,
  Calendar,
  Phone,
  Mail,
  Clock,
  ArrowRight,
  Eye,
  CheckCircle2,
  Trash2,
  AlertCircle,
  Plus,
  RefreshCw,
  Sparkles,
  MessageCircle,
} from 'lucide-react';
import { listInquiries } from '../../../services/inquiryService';
import { supabase, isSupabaseConfigured } from '../../../services/supabaseClient';
import { convertInquiryToLead, updateCustomerMetadata, listLeads } from '../../../services/crmService';
import { DbInquiry } from '../../../types/database';
import { useToast } from '../../../contexts/ToastContext';

const STAFF_MEMBERS = [
  'Captain Tarek',
  'Mona Zaki (Concierge)',
  'Ahmed Fathy',
  'Captain Farouk',
  'Youssef Marina Desk',
];

export const CrmInquiriesManager: React.FC = () => {
  const { showToast } = useToast();
  const [inquiries, setInquiries] = useState<DbInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedInquiry, setSelectedInquiry] = useState<DbInquiry | null>(null);

  // Quick edit state inside modal
  const [tempStatus, setTempStatus] = useState<string>('new');
  const [tempNotes, setTempNotes] = useState<string>('');
  const [tempStaff, setTempStaff] = useState<string>(STAFF_MEMBERS[0]);
  const [savingAction, setSavingAction] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await listInquiries();
      setInquiries(data);
    } catch (err) {
      console.warn('Failed to load inquiries:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredInquiries = useMemo(() => {
    return inquiries.filter((inq) => {
      if (statusFilter !== 'all' && inq.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          inq.customer_name.toLowerCase().includes(q) ||
          inq.email.toLowerCase().includes(q) ||
          (inq.phone && inq.phone.includes(q)) ||
          inq.subject.toLowerCase().includes(q) ||
          inq.message.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [inquiries, statusFilter, searchQuery]);

  const openInquiryDetail = (inq: DbInquiry) => {
    setSelectedInquiry(inq);
    setTempStatus(inq.status);
    setTempNotes(inq.admin_notes || '');
  };

  const handleSaveInquiry = async () => {
    if (!selectedInquiry) return;
    setSavingAction(true);
    try {
      if (isSupabaseConfigured()) {
        await supabase
          .from('inquiries')
          .update({
            status: tempStatus,
            admin_notes: tempNotes,
            updated_at: new Date().toISOString(),
          })
          .eq('id', selectedInquiry.id);
      }

      setInquiries((prev) =>
        prev.map((i) =>
          i.id === selectedInquiry.id
            ? { ...i, status: tempStatus as any, admin_notes: tempNotes }
            : i
        )
      );

      setSelectedInquiry((prev: DbInquiry | null) =>
        prev ? { ...prev, status: tempStatus as any, admin_notes: tempNotes } : null
      );
      showToast('Inquiry record updated.', 'success');
    } catch {
      showToast('Failed to update inquiry', 'error');
    } finally {
      setSavingAction(false);
    }
  };

  const handleConvertToLead = async (inq: DbInquiry) => {
    try {
      await convertInquiryToLead(inq);
      setInquiries((prev: DbInquiry[]) =>
        prev.map((i) => (i.id === inq.id ? { ...i, status: 'converted' as any } : i))
      );
      if (selectedInquiry?.id === inq.id) {
        setSelectedInquiry((prev: DbInquiry | null) => (prev ? { ...prev, status: 'converted' as any } : null));
      }
      showToast(`Inquiry converted to Lead and added to sales pipeline!`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to convert to lead', 'error');
    }
  };

  const handleConvertToCustomer = async (inq: DbInquiry) => {
    try {
      await updateCustomerMetadata(inq.email, {
        notes: `Converted from Inquiry: ${inq.message}`,
        tags: ['Inquiry Contact', 'Active Customer'],
        source: inq.source || 'Website Help Form',
      });
      showToast(`Inquiry contact saved to Customer Directory!`, 'success');
    } catch (err: any) {
      showToast('Failed to convert to customer', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] uppercase tracking-widest text-[#2dd4bf] font-bold block mb-0.5">
            Customer Communications
          </span>
          <h1 className="text-2xl font-bold font-display text-white tracking-tight flex items-center space-x-2">
            <MessageSquare className="w-6 h-6 text-[#2dd4bf]" />
            <span>Traveler Inquiries & Concierge Desk</span>
          </h1>
          <p className="text-xs text-stone-400 mt-1">
            Incoming requests, custom charter inquiries, and rapid conversion to pipeline leads.
          </p>
        </div>

        <button
          type="button"
          onClick={loadData}
          disabled={loading}
          className="p-2 bg-stone-900 border border-stone-800 text-stone-300 hover:text-white rounded text-xs transition-colors cursor-pointer"
          title="Refresh Inquiries"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Filter and Search */}
      <div className="bg-stone-950 border border-stone-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search inquiries by customer name, email, or message..."
            className="w-full pl-9 pr-3 py-1.5 bg-stone-900 border border-stone-800 rounded text-stone-200 placeholder-stone-500 focus:outline-none focus:border-[#0A6C74]"
          />
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-stone-400 text-xs hidden sm:inline">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-stone-900 border border-stone-800 rounded text-stone-300 focus:outline-none focus:border-[#0A6C74]"
          >
            <option value="all">All Inquiries ({inquiries.length})</option>
            <option value="new">New</option>
            <option value="in_progress">In Progress</option>
            <option value="responded">Responded</option>
            <option value="converted">Converted</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="p-16 text-center text-stone-400">
          <div className="w-8 h-8 border-2 border-[#0A6C74] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs">Loading concierge inquiries...</p>
        </div>
      ) : filteredInquiries.length === 0 ? (
        <div className="bg-stone-950 border border-stone-800 rounded-xl p-12 text-center text-stone-400">
          <MessageSquare className="w-8 h-8 text-stone-600 mx-auto mb-2" />
          <p className="text-sm font-semibold text-stone-300">No inquiries found</p>
          <p className="text-xs text-stone-500">All traveler inquiries have been addressed.</p>
        </div>
      ) : (
        <div className="bg-stone-950 border border-stone-800 rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-900 border-b border-stone-800 text-stone-400 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Subject & Message</th>
                  <th className="py-3 px-4">Source</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Received</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800/80">
                {filteredInquiries.map((inq) => (
                  <tr
                    key={inq.id}
                    onClick={() => openInquiryDetail(inq)}
                    className="hover:bg-stone-900/60 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white">{inq.customer_name}</div>
                      <div className="text-[10px] text-stone-400 font-mono">{inq.email}</div>
                      {inq.phone && <div className="text-[10px] text-stone-500">{inq.phone}</div>}
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-medium text-stone-200">{inq.subject}</div>
                      <div className="text-[11px] text-stone-400 line-clamp-1 max-w-md">
                        {inq.message}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-stone-900 border border-stone-800 text-stone-300">
                        {inq.source || 'web'}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          inq.status === 'new'
                            ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                            : inq.status === 'contacted' || (inq.status as any) === 'in_progress'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : inq.status === 'converted'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-stone-800 text-stone-400'
                        }`}
                      >
                        {inq.status}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-stone-400 font-mono text-[10px]">
                      {new Date(inq.created_at).toLocaleDateString()}
                    </td>

                    <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                      {inq.whatsapp && (
                        <a
                          href={`https://wa.me/${inq.whatsapp.replace(/[^0-9]/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 text-emerald-400 hover:text-emerald-300 inline-block"
                          title="WhatsApp Reply"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                        </a>
                      )}

                      {inq.status !== 'converted' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleConvertToLead(inq);
                          }}
                          className="px-2.5 py-1 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded text-[10px] font-semibold cursor-pointer"
                        >
                          Convert to Lead
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openInquiryDetail(inq);
                        }}
                        className="p-1.5 text-stone-400 hover:text-white rounded hover:bg-stone-800 cursor-pointer"
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

      {/* DETAIL & CONVERSION MODAL */}
      {selectedInquiry && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-xl max-w-xl w-full p-6 space-y-4 shadow-2xl text-xs">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <MessageSquare className="w-4 h-4 text-[#2dd4bf]" />
                <span>Inquiry Details & Conversion</span>
              </h3>
              <button
                type="button"
                onClick={() => setSelectedInquiry(null)}
                className="text-stone-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3 bg-stone-950 rounded border border-stone-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-sm">{selectedInquiry.customer_name}</span>
                  <span className="text-[10px] text-stone-500 font-mono">
                    {new Date(selectedInquiry.created_at).toLocaleString()}
                  </span>
                </div>
                <div className="text-stone-400">
                  Email: <span className="text-white font-mono">{selectedInquiry.email}</span> &bull;{' '}
                  Phone: <span className="text-white font-mono">{selectedInquiry.phone || 'None'}</span>
                </div>
                {selectedInquiry.whatsapp && (
                  <div className="text-stone-400">
                    WhatsApp: <span className="text-emerald-400 font-mono">{selectedInquiry.whatsapp}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-stone-400 font-semibold mb-1">Message Content:</label>
                <div className="p-3 bg-stone-950 rounded border border-stone-800 text-stone-200 leading-relaxed">
                  "{selectedInquiry.message}"
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-300 font-semibold mb-1">Inquiry Status</label>
                  <select
                    value={tempStatus}
                    onChange={(e) => setTempStatus(e.target.value)}
                    className="w-full px-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-white"
                  >
                    <option value="new">New</option>
                    <option value="in_progress">In Progress</option>
                    <option value="responded">Responded</option>
                    <option value="converted">Converted</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>

                <div>
                  <label className="block text-stone-300 font-semibold mb-1">Assigned Staff</label>
                  <select
                    value={tempStaff}
                    onChange={(e) => setTempStaff(e.target.value)}
                    className="w-full px-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-white"
                  >
                    {STAFF_MEMBERS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-stone-300 font-semibold mb-1">Staff Notes</label>
                <textarea
                  rows={2}
                  value={tempNotes}
                  onChange={(e) => setTempNotes(e.target.value)}
                  placeholder="Internal notes regarding follow-up call or price quote..."
                  className="w-full px-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-white"
                />
              </div>

              {/* Conversion Actions Bar */}
              <div className="p-3 bg-stone-950 rounded-lg border border-stone-800 flex items-center justify-between">
                <span className="text-[11px] text-stone-400 font-semibold">Fast Conversion:</span>
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => handleConvertToCustomer(selectedInquiry)}
                    className="px-3 py-1 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded font-medium cursor-pointer"
                  >
                    Save as Customer
                  </button>
                  <button
                    type="button"
                    onClick={() => handleConvertToLead(selectedInquiry)}
                    className="px-3 py-1 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded font-semibold cursor-pointer"
                  >
                    Convert to Pipeline Lead
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => setSelectedInquiry(null)}
                  className="px-3 py-1.5 bg-stone-800 text-stone-300 rounded font-medium cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleSaveInquiry}
                  disabled={savingAction}
                  className="px-4 py-1.5 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded font-semibold cursor-pointer"
                >
                  {savingAction ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
