import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Phone,
  Mail,
  Users,
  Search,
  Filter,
  Plus,
  RefreshCw,
  MessageCircle,
  ExternalLink,
  ArrowUpRight,
  ArrowDownLeft,
} from 'lucide-react';
import {
  listCommunications,
  recordCommunication,
  listCrmCustomers,
  CrmCommunication,
  CrmCustomerDetail,
} from '../../../services/crmService';
import { CommChannel } from '../../../types/crm';
import { useToast } from '../../../contexts/ToastContext';

export const CrmConversationsManager: React.FC = () => {
  const { showToast } = useToast();
  const [comms, setComms] = useState<CrmCommunication[]>([]);
  const [customers, setCustomers] = useState<CrmCustomerDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [channelFilter, setChannelFilter] = useState<string>('all');

  // New communication modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [channel, setChannel] = useState<CommChannel>('WhatsApp');
  const [direction, setDirection] = useState<'inbound' | 'outbound'>('outbound');
  const [customerName, setCustomerName] = useState('');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [staffName, setStaffName] = useState('Captain Tarek');

  const loadData = async () => {
    setLoading(true);
    try {
      const [allComms, allCusts] = await Promise.all([
        listCommunications(),
        listCrmCustomers(),
      ]);
      setComms(allComms);
      setCustomers(allCusts);
    } catch (err) {
      console.warn('Failed to load conversations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredComms = comms.filter((c) => {
    if (channelFilter !== 'all' && c.channel !== channelFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        c.summary.toLowerCase().includes(q) ||
        (c.customerName && c.customerName.toLowerCase().includes(q)) ||
        (c.content && c.content.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleSaveComm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!summary.trim()) return;

    await recordCommunication({
      channel,
      direction,
      customerName: customerName.trim() || 'Traveler',
      summary: summary.trim(),
      content: content.trim() || null,
      staffName,
    });

    showToast('Communication logged successfully.', 'success');
    setIsModalOpen(false);
    setSummary('');
    setContent('');
    setCustomerName('');
    await loadData();
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] uppercase tracking-widest text-[#2dd4bf] font-bold block mb-0.5">
            Client Touchpoints
          </span>
          <h1 className="text-2xl font-bold font-display text-white tracking-tight flex items-center space-x-2">
            <MessageSquare className="w-6 h-6 text-[#2dd4bf]" />
            <span>Traveler Conversations & Communication Logs</span>
          </h1>
          <p className="text-xs text-stone-400 mt-1">
            Omni-channel log across WhatsApp messages, telephone briefings, emails, and pier desk visits.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="p-2 bg-stone-900 border border-stone-800 text-stone-300 hover:text-white rounded text-xs transition-colors cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center space-x-1.5 px-4 py-2 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded text-xs font-semibold shadow transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Log Communication</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-stone-950 border border-stone-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversation summaries or names..."
            className="w-full pl-9 pr-3 py-1.5 bg-stone-900 border border-stone-800 rounded text-stone-200 placeholder-stone-500 focus:outline-none focus:border-[#0A6C74]"
          />
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-stone-400 text-xs hidden sm:inline">Channel:</span>
          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-stone-900 border border-stone-800 rounded text-stone-300 focus:outline-none"
          >
            <option value="all">All Channels</option>
            <option value="WhatsApp">WhatsApp</option>
            <option value="Phone">Phone</option>
            <option value="Email">Email</option>
            <option value="In-Person">In-Person</option>
          </select>
        </div>
      </div>

      {/* Log Feed */}
      {loading ? (
        <div className="p-16 text-center text-stone-400">
          <div className="w-8 h-8 border-2 border-[#0A6C74] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs">Loading conversations...</p>
        </div>
      ) : filteredComms.length === 0 ? (
        <div className="bg-stone-950 border border-stone-800 rounded-xl p-12 text-center text-stone-400">
          <MessageSquare className="w-8 h-8 text-stone-600 mx-auto mb-2" />
          <p className="text-sm font-semibold text-stone-300">No communication logs recorded</p>
          <p className="text-xs text-stone-500">Log customer phone calls, WhatsApp messages, or emails above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredComms.map((comm) => (
            <div
              key={comm.id}
              className="p-4 bg-stone-950 border border-stone-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
            >
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase flex items-center space-x-1 ${
                      comm.channel === 'WhatsApp'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : comm.channel === 'Phone'
                        ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                        : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                    }`}
                  >
                    {comm.direction === 'inbound' ? (
                      <ArrowDownLeft className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <ArrowUpRight className="w-3 h-3 text-sky-400" />
                    )}
                    <span>{comm.channel}</span>
                  </span>

                  <strong className="text-white text-xs">{comm.customerName || 'Traveler'}</strong>
                </div>

                <p className="text-stone-300 font-medium">{comm.summary}</p>
                {comm.content && (
                  <p className="text-stone-400 text-[11px] bg-stone-900/60 p-2 rounded border border-stone-800/80">
                    {comm.content}
                  </p>
                )}
              </div>

              <div className="text-right shrink-0 text-stone-500 text-[10px] font-mono">
                <div>Logged by {comm.staffName}</div>
                <div>{new Date(comm.createdAt).toLocaleString()}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-xl max-w-md w-full p-6 space-y-4 text-xs">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <MessageSquare className="w-4 h-4 text-[#2dd4bf]" />
              <span>Log Traveler Conversation</span>
            </h3>

            <form onSubmit={handleSaveComm} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-300 font-semibold mb-1">Channel</label>
                  <select
                    value={channel}
                    onChange={(e) => setChannel(e.target.value as any)}
                    className="w-full px-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-white"
                  >
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Phone">Phone</option>
                    <option value="Email">Email</option>
                    <option value="In-Person">In-Person (Pier Desk)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-stone-300 font-semibold mb-1">Direction</label>
                  <select
                    value={direction}
                    onChange={(e) => setDirection(e.target.value as any)}
                    className="w-full px-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-white"
                  >
                    <option value="outbound">Outbound (We contacted guest)</option>
                    <option value="inbound">Inbound (Guest contacted us)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-stone-300 font-semibold mb-1">Traveler Name</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Sarah Jenkins"
                  className="w-full px-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-white"
                />
              </div>

              <div>
                <label className="block text-stone-300 font-semibold mb-1">Topic / Summary *</label>
                <input
                  type="text"
                  required
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="e.g. Sent quotation for Giftun Island VIP Yacht"
                  className="w-full px-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-white"
                />
              </div>

              <div>
                <label className="block text-stone-300 font-semibold mb-1">Detailed Transcript / Notes</label>
                <textarea
                  rows={3}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Guest confirmed they want pickup at 08:00 AM sharp from resort gate..."
                  className="w-full px-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-white"
                />
              </div>

              <div>
                <label className="block text-stone-300 font-semibold mb-1">Staff Member</label>
                <select
                  value={staffName}
                  onChange={(e) => setStaffName(e.target.value)}
                  className="w-full px-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-white"
                >
                  <option value="Captain Tarek">Captain Tarek</option>
                  <option value="Mona Zaki (Concierge)">Mona Zaki (Concierge)</option>
                  <option value="Ahmed Fathy">Ahmed Fathy</option>
                  <option value="Captain Farouk">Captain Farouk</option>
                </select>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 bg-stone-800 text-stone-300 rounded font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded font-semibold cursor-pointer"
                >
                  Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
