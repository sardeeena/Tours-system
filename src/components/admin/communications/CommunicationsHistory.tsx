import React, { useState, useEffect, useMemo } from 'react';
import {
  History,
  Mail,
  MessageSquare,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  RefreshCw,
  FileText,
  User,
  Calendar,
  Download,
  Printer,
  Eye,
  ExternalLink,
  ShieldCheck,
  Check,
  Zap,
  Play,
} from 'lucide-react';
import {
  listCommunicationMessages,
  updateMessageDeliveryStatus,
  listAutomationEvents,
  publishAutomationEvent,
} from '../../../services/communicationService';
import {
  CommunicationMessage,
  MessageDeliveryStatus,
  AutomationEvent,
  AutomationEventType,
} from '../../../types/communication';
import { useToast } from '../../../contexts/ToastContext';

interface CommunicationsHistoryProps {
  onNavigateTab?: (tabId: string, param?: string) => void;
}

export const CommunicationsHistory: React.FC<CommunicationsHistoryProps> = ({ onNavigateTab }) => {
  const { showToast } = useToast();

  const [activeView, setActiveView] = useState<'messages' | 'automation'>('messages');
  const [messages, setMessages] = useState<CommunicationMessage[]>([]);
  const [automationEvents, setAutomationEvents] = useState<AutomationEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [providerFilter, setProviderFilter] = useState<string>('all');

  // Modal Inspection
  const [selectedMessage, setSelectedMessage] = useState<CommunicationMessage | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [triggeringEvent, setTriggeringEvent] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [allMsgs, allEvents] = await Promise.all([
        listCommunicationMessages(),
        listAutomationEvents(),
      ]);
      setMessages(allMsgs);
      setAutomationEvents(allEvents);
    } catch (err) {
      console.error('Failed to load communication history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredMessages = useMemo(() => {
    return messages.filter((m) => {
      if (channelFilter !== 'all' && m.channel !== channelFilter) return false;
      if (statusFilter !== 'all' && m.status.toLowerCase() !== statusFilter.toLowerCase()) return false;
      if (providerFilter !== 'all') {
        if (providerFilter === 'Not configured' && m.providerName !== 'Not configured') return false;
        if (providerFilter !== 'Not configured' && m.providerName.toLowerCase() !== providerFilter.toLowerCase()) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          m.customerName.toLowerCase().includes(q) ||
          m.recipientAddress.toLowerCase().includes(q) ||
          (m.bookingReference && m.bookingReference.toLowerCase().includes(q)) ||
          (m.subject && m.subject.toLowerCase().includes(q)) ||
          m.content.toLowerCase().includes(q) ||
          (m.providerMessageId && m.providerMessageId.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [messages, channelFilter, statusFilter, providerFilter, searchQuery]);

  const exportCsv = () => {
    if (filteredMessages.length === 0) {
      showToast('No communication records to export', 'info');
      return;
    }

    const headers = [
      'ID',
      'Channel',
      'Customer Name',
      'Recipient Address',
      'Booking Reference',
      'Subject',
      'Status',
      'Provider',
      'Provider Message ID',
      'Sent At',
      'Delivered At',
      'Opened At',
      'Staff Dispatcher',
      'Created At',
      'Failure Reason',
    ];

    const rows = filteredMessages.map((m) => [
      `"${m.id}"`,
      `"${m.channel}"`,
      `"${m.customerName}"`,
      `"${m.recipientAddress}"`,
      `"${m.bookingReference || ''}"`,
      `"${(m.subject || m.templateKey || '').replace(/"/g, '""')}"`,
      `"${m.status}"`,
      `"${m.providerName}"`,
      `"${m.providerMessageId || ''}"`,
      `"${m.sentAt || ''}"`,
      `"${m.deliveredAt || ''}"`,
      `"${m.openedAt || ''}"`,
      `"${m.staffName}"`,
      `"${m.createdAt}"`,
      `"${(m.failureReason || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `communication_audit_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Communications audit CSV downloaded', 'success');
  };

  const handleSimulateWebhookDelivery = async (newStatus: MessageDeliveryStatus) => {
    if (!selectedMessage) return;
    setUpdatingStatus(true);
    try {
      await updateMessageDeliveryStatus(selectedMessage.id, newStatus);
      showToast(`Provider webhook confirmed: status transitioned to ${newStatus}`, 'success');
      setSelectedMessage((prev) => prev ? { ...prev, status: newStatus } : null);
      await loadData();
    } catch (err: any) {
      showToast(err?.message || 'Failed to update status', 'error');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleEmitTestEvent = async (eventName: AutomationEventType) => {
    setTriggeringEvent(true);
    try {
      const samplePayload: Record<string, any> = {
        bookingReference: 'RSV-2026-TEST',
        customerName: 'Test Passenger',
        tourTitle: 'Ras Mohammed VIP Yacht Excursion',
        amount: '180.00',
        timestamp: new Date().toISOString(),
      };

      await publishAutomationEvent(
        eventName,
        samplePayload,
        eventName.split('.')[0],
        'RSV-2026-TEST'
      );

      showToast(`Automation event "${eventName}" published to event bus`, 'success');
      await loadData();
    } catch (err: any) {
      showToast(err?.message || 'Failed to trigger event', 'error');
    } finally {
      setTriggeringEvent(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-stone-900 border border-stone-800 p-5 rounded-xl shadow-lg">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
            {activeView === 'messages' ? <History className="w-5 h-5" /> : <Zap className="w-5 h-5" />}
          </div>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              Communication &amp; Automation Hub
              <span className="text-xs font-normal px-2.5 py-0.5 rounded-full bg-stone-800 text-stone-300 border border-stone-700">
                {activeView === 'messages' ? `${messages.length} Dispatched Records` : `${automationEvents.length} Automation Events`}
              </span>
            </h1>
            <p className="text-xs text-stone-400">
              Audit trail for customer communications and event-driven automation bus without background loops
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* View Toggle */}
          <div className="flex bg-stone-950 p-1 rounded-lg border border-stone-800 text-xs">
            <button
              type="button"
              onClick={() => setActiveView('messages')}
              className={`px-3 py-1 rounded font-semibold transition-colors cursor-pointer ${
                activeView === 'messages' ? 'bg-[#0A6C74] text-white shadow' : 'text-stone-400 hover:text-white'
              }`}
            >
              Dispatch Logs
            </button>
            <button
              type="button"
              onClick={() => setActiveView('automation')}
              className={`px-3 py-1 rounded font-semibold flex items-center space-x-1 transition-colors cursor-pointer ${
                activeView === 'automation' ? 'bg-[#0A6C74] text-white shadow' : 'text-stone-400 hover:text-white'
              }`}
            >
              <Zap className="w-3 h-3 text-amber-400" />
              <span>Event Bus</span>
            </button>
          </div>

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-medium rounded-lg border border-stone-700 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-teal-400' : ''}`} />
            <span>Refresh</span>
          </button>
          {activeView === 'messages' && (
            <button
              type="button"
              onClick={exportCsv}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold rounded-lg border border-stone-700 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          )}
        </div>
      </div>

      {activeView === 'messages' ? (
        <>
          {/* KPI Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-stone-900 border border-stone-800 rounded-xl p-4 shadow">
              <span className="text-[11px] font-medium text-stone-400">Total Logged Messages</span>
              <div className="text-2xl font-bold text-white mt-1">{messages.length}</div>
              <span className="text-[10px] text-teal-400 mt-0.5 block">Permanent audit stream</span>
            </div>

            <div className="bg-stone-900 border border-stone-800 rounded-xl p-4 shadow">
              <span className="text-[11px] font-medium text-stone-400">Verified Delivered</span>
              <div className="text-2xl font-bold text-emerald-400 mt-1">
                {messages.filter((m) => m.status.toLowerCase() === 'delivered' || m.status.toLowerCase() === 'opened').length}
              </div>
              <span className="text-[10px] text-stone-500 mt-0.5 block">Confirmed by provider</span>
            </div>

            <div className="bg-stone-900 border border-stone-800 rounded-xl p-4 shadow">
              <span className="text-[11px] font-medium text-stone-400">Sent (Pending Receipt)</span>
              <div className="text-2xl font-bold text-sky-400 mt-1">
                {messages.filter((m) => m.status.toLowerCase() === 'sent').length}
              </div>
              <span className="text-[10px] text-stone-500 mt-0.5 block">Dispatched to gateway</span>
            </div>

            <div className="bg-stone-900 border border-stone-800 rounded-xl p-4 shadow">
              <span className="text-[11px] font-medium text-stone-400">Failed / Unconfigured</span>
              <div className="text-2xl font-bold text-rose-400 mt-1">
                {messages.filter((m) => m.status.toLowerCase() === 'failed').length}
              </div>
              <span className="text-[10px] text-stone-500 mt-0.5 block">Rejected or missing keys</span>
            </div>
          </div>

          {/* Filters Toolbar */}
          <div className="bg-stone-900 border border-stone-800 rounded-xl p-4 shadow flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <div className="relative min-w-[200px] flex-1">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-stone-500" />
                <input
                  type="text"
                  placeholder="Search recipient, ref, subject, or external ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-stone-600 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="flex items-center space-x-2">
                <select
                  value={channelFilter}
                  onChange={(e) => setChannelFilter(e.target.value)}
                  className="bg-stone-950 border border-stone-800 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-teal-500"
                >
                  <option value="all">All Channels</option>
                  <option value="Email">Email Only</option>
                  <option value="WhatsApp">WhatsApp Only</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-stone-950 border border-stone-800 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-teal-500"
                >
                  <option value="all">All Delivery Statuses</option>
                  <option value="sent">Sent</option>
                  <option value="delivered">Delivered</option>
                  <option value="opened">Opened</option>
                  <option value="queued">Queued</option>
                  <option value="failed">Failed</option>
                </select>

                <select
                  value={providerFilter}
                  onChange={(e) => setProviderFilter(e.target.value)}
                  className="bg-stone-950 border border-stone-800 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-teal-500"
                >
                  <option value="all">All Gateways</option>
                  <option value="resend">Resend</option>
                  <option value="sendgrid">SendGrid</option>
                  <option value="meta_cloud">Meta Cloud API</option>
                  <option value="twilio">Twilio</option>
                  <option value="Not configured">Not configured</option>
                </select>
              </div>
            </div>

            <div className="text-[11px] text-stone-400">
              Showing {filteredMessages.length} of {messages.length} total logged events
            </div>
          </div>

          {/* History Table */}
          <div className="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-stone-950/80 border-b border-stone-800 text-stone-400 uppercase font-semibold text-[10px] tracking-wider">
                    <th className="py-3 px-4">Channel</th>
                    <th className="py-3 px-4">Recipient / Guest</th>
                    <th className="py-3 px-4">Booking Ref</th>
                    <th className="py-3 px-4">Subject / Template</th>
                    <th className="py-3 px-4">Delivery Status</th>
                    <th className="py-3 px-4">Gateway Provider</th>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-800/60 text-stone-300">
                  {filteredMessages.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-stone-500">
                        No communications found matching the current search &amp; filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredMessages.map((msg) => {
                      const isEmail = msg.channel === 'Email';
                      const st = msg.status.toLowerCase();
                      const isFailed = st === 'failed';
                      const isSent = st === 'sent';
                      const isDelivered = st === 'delivered';
                      const isOpened = st === 'opened';

                      return (
                        <tr
                          key={msg.id}
                          onClick={() => setSelectedMessage(msg)}
                          className="hover:bg-stone-800/40 cursor-pointer transition-colors"
                        >
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium border ${
                                isEmail
                                  ? 'bg-teal-500/10 text-teal-300 border-teal-500/20'
                                  : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                              }`}
                            >
                              {isEmail ? <Mail className="w-3 h-3" /> : <MessageSquare className="w-3 h-3" />}
                              {msg.channel}
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            <div className="font-semibold text-white">{msg.customerName}</div>
                            <div className="text-[11px] font-mono text-stone-400 truncate max-w-[180px]">
                              {msg.recipientAddress}
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            {msg.bookingReference ? (
                              <span
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onNavigateTab?.('bookings', msg.bookingReference || undefined);
                                }}
                                className="text-teal-400 hover:text-teal-300 font-mono font-medium underline"
                              >
                                {msg.bookingReference}
                              </span>
                            ) : (
                              <span className="text-stone-600 font-mono text-[10px]">—</span>
                            )}
                          </td>

                          <td className="py-3 px-4 max-w-xs">
                            <div className="text-white font-medium truncate">
                              {msg.subject || msg.templateKey || '(No subject)'}
                            </div>
                            <div className="text-[11px] text-stone-500 truncate">{msg.content.substring(0, 50)}...</div>
                          </td>

                          <td className="py-3 px-4">
                            {isDelivered && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Delivered</span>
                              </span>
                            )}
                            {isOpened && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                <Eye className="w-3 h-3" />
                                <span>Opened</span>
                              </span>
                            )}
                            {isSent && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                                <Clock className="w-3 h-3" />
                                <span>Sent</span>
                              </span>
                            )}
                            {isFailed && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                <XCircle className="w-3 h-3" />
                                <span>Failed</span>
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            {msg.providerName === 'Not configured' ? (
                              <span className="text-amber-400 font-mono text-[11px]">Not configured</span>
                            ) : (
                              <span className="text-stone-300 font-mono text-[11px]">{msg.providerName}</span>
                            )}
                          </td>

                          <td className="py-3 px-4 font-mono text-[11px] text-stone-400">
                            {new Date(msg.createdAt).toLocaleString()}
                          </td>

                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedMessage(msg);
                              }}
                              className="p-1 hover:bg-stone-800 text-stone-400 hover:text-white rounded cursor-pointer"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* Event-Driven Architecture / Automation Bus View */
        <div className="space-y-6">
          {/* Explanation Banner */}
          <div className="p-4 bg-stone-900 border border-stone-800 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <span>Event-Driven Architecture &amp; System Automation Bus</span>
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                Guaranteed Idempotent &bull; No Uncontrolled Loops
              </span>
            </div>
            <p className="text-xs text-stone-400">
              Operations events trigger decoupled reactive workflows: booking creation, payment capture, cancellation updates, departure reminders, and overdue follow-ups. Every event runs once and logs triggered actions.
            </p>

            {/* Quick Test Triggers */}
            <div className="pt-2">
              <span className="text-[11px] font-semibold text-stone-400 block mb-1.5">
                Emit Operational Event (Simulation / Testing):
              </span>
              <div className="flex flex-wrap gap-2">
                {([
                  'booking.created',
                  'booking.updated',
                  'payment.received',
                  'payment.failed',
                  'booking.cancelled',
                  'departure.tomorrow',
                  'followup.due',
                ] as AutomationEventType[]).map((ev) => (
                  <button
                    key={ev}
                    type="button"
                    disabled={triggeringEvent}
                    onClick={() => handleEmitTestEvent(ev)}
                    className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded bg-stone-950 hover:bg-stone-800 border border-stone-800 text-[11px] font-mono text-teal-300 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Play className="w-2.5 h-2.5 text-amber-400" />
                    <span>{ev}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Events Table */}
          <div className="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-stone-950/80 border-b border-stone-800 text-stone-400 uppercase font-semibold text-[10px] tracking-wider">
                    <th className="py-3 px-4">Event Name</th>
                    <th className="py-3 px-4">Entity Type / Ref</th>
                    <th className="py-3 px-4">Processed Status</th>
                    <th className="py-3 px-4">Payload Snapshot</th>
                    <th className="py-3 px-4">Triggered Actions</th>
                    <th className="py-3 px-4">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-800/60 text-stone-300">
                  {automationEvents.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-stone-500">
                        No automation events recorded yet. Click one of the event buttons above to test the bus.
                      </td>
                    </tr>
                  ) : (
                    automationEvents.map((ev) => (
                      <tr key={ev.id} className="hover:bg-stone-800/40 transition-colors">
                        <td className="py-3 px-4">
                          <span className="font-mono text-xs font-bold text-amber-400">
                            {ev.eventName}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-mono text-[11px] text-stone-300">
                            {ev.entityType || 'system'} / {ev.entityId || 'general'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {ev.processed ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Processed</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                              <Clock className="w-3 h-3" />
                              <span>Queued</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 max-w-xs truncate font-mono text-[10px] text-stone-400">
                          {JSON.stringify(ev.payload)}
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-[11px] text-stone-400">
                            {ev.actionsTriggered && ev.actionsTriggered.length > 0
                              ? ev.actionsTriggered.join(', ')
                              : 'Dispatched to listeners'}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-stone-400">
                          {new Date(ev.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Message Inspection Modal */}
      {selectedMessage && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-stone-900 border border-stone-800 rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <div className="flex items-center space-x-2">
                {selectedMessage.channel === 'Email' ? (
                  <Mail className="w-5 h-5 text-teal-400" />
                ) : (
                  <MessageSquare className="w-5 h-5 text-emerald-400" />
                )}
                <h3 className="text-base font-bold text-white">
                  {selectedMessage.channel} Dispatch Audit Record
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMessage(null)}
                className="text-stone-400 hover:text-white text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-stone-800/60">
                <span className="text-stone-400">Recipient:</span>
                <span className="text-white font-medium">{selectedMessage.recipientAddress}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-stone-800/60">
                <span className="text-stone-400">Customer Name:</span>
                <span className="text-white">{selectedMessage.customerName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-stone-800/60">
                <span className="text-stone-400">Delivery Status:</span>
                <span className="font-semibold text-teal-400 uppercase">{selectedMessage.status}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-stone-800/60">
                <span className="text-stone-400">Gateway Provider:</span>
                <span className="text-white">{selectedMessage.providerName}</span>
              </div>
              {selectedMessage.providerMessageId && (
                <div className="flex justify-between py-1 border-b border-stone-800/60 font-mono">
                  <span className="text-stone-400">Provider Message ID:</span>
                  <span className="text-stone-300">{selectedMessage.providerMessageId}</span>
                </div>
              )}
              {selectedMessage.bookingReference && (
                <div className="flex justify-between py-1 border-b border-stone-800/60">
                  <span className="text-stone-400">Booking Reference:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMessage(null);
                      onNavigateTab?.('bookings', selectedMessage.bookingReference || undefined);
                    }}
                    className="text-teal-400 hover:text-teal-300 font-semibold underline cursor-pointer"
                  >
                    {selectedMessage.bookingReference}
                  </button>
                </div>
              )}
              {selectedMessage.leadId && (
                <div className="flex justify-between py-1 border-b border-stone-800/60">
                  <span className="text-stone-400">CRM Lead:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMessage(null);
                      onNavigateTab?.('crm_leads');
                    }}
                    className="text-teal-400 hover:text-teal-300 underline cursor-pointer"
                  >
                    View Lead File
                  </button>
                </div>
              )}
              {selectedMessage.inquiryId && (
                <div className="flex justify-between py-1 border-b border-stone-800/60">
                  <span className="text-stone-400">Linked Inquiry:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMessage(null);
                      onNavigateTab?.('inquiries');
                    }}
                    className="text-teal-400 hover:text-teal-300 underline cursor-pointer"
                  >
                    View Inquiry
                  </button>
                </div>
              )}
              {selectedMessage.taskId && (
                <div className="flex justify-between py-1 border-b border-stone-800/60">
                  <span className="text-stone-400">Linked Staff Task:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMessage(null);
                      onNavigateTab?.('crm_tasks');
                    }}
                    className="text-teal-400 hover:text-teal-300 underline cursor-pointer"
                  >
                    View Task
                  </button>
                </div>
              )}
              <div className="flex justify-between py-1 border-b border-stone-800/60">
                <span className="text-stone-400">Staff Dispatcher:</span>
                <span className="text-stone-300">{selectedMessage.staffName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-stone-800/60">
                <span className="text-stone-400">Logged Timestamp:</span>
                <span className="text-stone-300">{new Date(selectedMessage.createdAt).toLocaleString()}</span>
              </div>
              {selectedMessage.sentAt && (
                <div className="flex justify-between py-1 border-b border-stone-800/60">
                  <span className="text-stone-400">Sent At:</span>
                  <span className="text-stone-300">{new Date(selectedMessage.sentAt).toLocaleString()}</span>
                </div>
              )}
              {selectedMessage.deliveredAt && (
                <div className="flex justify-between py-1 border-b border-stone-800/60">
                  <span className="text-stone-400">Delivered At:</span>
                  <span className="text-emerald-400 font-semibold">{new Date(selectedMessage.deliveredAt).toLocaleString()}</span>
                </div>
              )}

              {selectedMessage.failureReason && (
                <div className="p-2.5 bg-rose-950/40 border border-rose-900/60 rounded text-rose-300 mt-2">
                  <strong>Failure Reason:</strong> {selectedMessage.failureReason}
                </div>
              )}
            </div>

            <div>
              <span className="block text-xs font-medium text-stone-400 mb-1">Delivered Message Content:</span>
              <div className="bg-stone-950 p-3 rounded-lg border border-stone-800 text-xs text-stone-200 whitespace-pre-wrap max-h-44 overflow-y-auto leading-relaxed font-sans">
                {selectedMessage.content}
              </div>
            </div>

            {/* Test Webhook Delivery Transition for Sent Messages */}
            {selectedMessage.status.toLowerCase() === 'sent' && (
              <div className="p-3 bg-stone-950 rounded-lg border border-stone-800 space-y-1.5">
                <div className="text-[11px] font-semibold text-stone-300 flex items-center justify-between">
                  <span>Webhook Receipt Simulation:</span>
                  <span className="text-[10px] text-stone-500 font-normal">Test delivery lifecycle</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={updatingStatus}
                    onClick={() => handleSimulateWebhookDelivery('delivered')}
                    className="flex-1 py-1 px-2 rounded bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-[11px] font-semibold transition-colors cursor-pointer"
                  >
                    Simulate &ldquo;Delivered&rdquo; Webhook
                  </button>
                  <button
                    type="button"
                    disabled={updatingStatus}
                    onClick={() => handleSimulateWebhookDelivery('opened')}
                    className="flex-1 py-1 px-2 rounded bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-[11px] font-semibold transition-colors cursor-pointer"
                  >
                    Simulate &ldquo;Opened&rdquo; Webhook
                  </button>
                </div>
              </div>
            )}

            <div className="pt-2 flex justify-between items-center">
              {selectedMessage.customerId && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedMessage(null);
                    onNavigateTab?.('crm_timeline');
                  }}
                  className="text-xs text-teal-400 hover:text-teal-300 font-medium flex items-center gap-1 cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> View on Customer Timeline
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedMessage(null)}
                className="px-4 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs rounded-lg transition-colors ml-auto cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
