import React, { useState, useEffect, useMemo } from 'react';
import {
  Mail,
  Send,
  Settings,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Calendar,
  User,
  ShieldCheck,
  FileText,
  Copy,
  Check,
  HelpCircle,
  ExternalLink,
} from 'lucide-react';
import {
  sendEmailMessage,
  listCommunicationMessages,
  listTemplates,
  getProviderConfig,
  saveProviderConfig,
  renderTemplateVariables,
} from '../../../services/communicationService';
import {
  CommunicationMessage,
  CommunicationTemplate,
  ProviderConfig,
} from '../../../types/communication';
import { bookingRepository } from '../../../services/bookingRepository';
import { Booking } from '../../../types/booking';
import { useToast } from '../../../contexts/ToastContext';

interface CommunicationsEmailProps {
  onNavigateTab?: (tabId: string, param?: string) => void;
}

export const CommunicationsEmail: React.FC<CommunicationsEmailProps> = ({ onNavigateTab }) => {
  const { showToast } = useToast();

  const [messages, setMessages] = useState<CommunicationMessage[]>([]);
  const [templates, setTemplates] = useState<CommunicationTemplate[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [providerConfig, setProviderConfig] = useState<ProviderConfig>(getProviderConfig());
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Composer State
  const [recipientEmail, setRecipientEmail] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [selectedBookingRef, setSelectedBookingRef] = useState('');
  const [selectedTemplateKey, setSelectedTemplateKey] = useState('');
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [activeTab, setActiveTab] = useState<'composer' | 'preview'>('composer');
  const [sending, setSending] = useState(false);

  // Provider Settings Modal
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [tempEmailProvider, setTempEmailProvider] = useState<'resend' | 'sendgrid' | 'smtp' | 'none'>('resend');
  const [tempApiKey, setTempApiKey] = useState('');
  const [tempFromEmail, setTempFromEmail] = useState('dispatch@redseavoyages.com');
  const [tempFromName, setTempFromName] = useState('Red Sea Voyages Dispatch');

  // Message Detail Drawer
  const [selectedMessage, setSelectedMessage] = useState<CommunicationMessage | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [msgs, tmpls, bks] = await Promise.all([
        listCommunicationMessages({ channel: 'Email' }),
        listTemplates(),
        bookingRepository.listBookings(),
      ]);
      setMessages(msgs.filter((m) => m.channel === 'Email'));
      setTemplates(tmpls.filter((t) => t.channel === 'Email' || t.channel === 'Both'));
      setBookings(bks);
      setProviderConfig(getProviderConfig());
    } catch (err) {
      console.error('Failed to load email comms data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // When booking selection changes, pre-fill customer details
  const handleBookingChange = (bookingRef: string) => {
    setSelectedBookingRef(bookingRef);
    if (!bookingRef) return;

    const b = bookings.find((x) => x.bookingReference === bookingRef);
    if (b) {
      setRecipientEmail(b.customer?.email || '');
      setCustomerName(`${b.customer?.firstName || ''} ${b.customer?.lastName || ''}`.trim() || 'Guest');

      // If a template is already selected, re-render with this booking's variables
      if (selectedTemplateKey) {
        applyTemplate(selectedTemplateKey, b);
      }
    }
  };

  // When template changes, inject variables and fill subject/body
  const applyTemplate = (tmplKey: string, customBooking?: Booking) => {
    setSelectedTemplateKey(tmplKey);
    const tmpl = templates.find((t) => t.templateKey === tmplKey);
    if (!tmpl) return;

    const b = customBooking || bookings.find((x) => x.bookingReference === selectedBookingRef);
    const totalEur = b?.pricing?.totalEur || 0;
    const paidEur = b?.paymentStatus === 'paid' ? totalEur : 0;
    const balanceEur = Math.max(0, totalEur - paidEur);

    const hotelLoc = b?.pickup?.hotelName || b?.customer?.hotelName || 'Hotel Reception Lobby';
    const vars = {
      customer_name: b ? `${b.customer.firstName} ${b.customer.lastName}` : (customerName || 'Valued Guest'),
      booking_reference: b ? b.bookingReference : (selectedBookingRef || 'RSV-DRAFT'),
      tour_name: b ? b.tourTitle : 'Red Sea Excursion',
      tour_date: b ? b.date : 'Upcoming Date',
      pickup_time: hotelLoc ? '07:30 AM' : '08:00 AM',
      hotel: hotelLoc,
      amount: String(totalEur || '120.00'),
      balance_due: String(balanceEur || '0.00'),
      total: String(totalEur || '120.00'),
      balance: String(balanceEur || '0.00'),
      payment_status: b?.paymentStatus || 'Pending',
    };

    setSubject(renderTemplateVariables(tmpl.subject || '', vars));
    setContent(renderTemplateVariables(tmpl.bodyText, vars));
  };

  const insertVariable = (varTag: string) => {
    setContent((prev) => `${prev} {{${varTag}}}`);
  };

  const handleSend = async () => {
    if (!recipientEmail || !recipientEmail.includes('@')) {
      showToast('Please enter a valid recipient email address', 'error');
      return;
    }
    if (!subject.trim()) {
      showToast('Email subject cannot be empty', 'error');
      return;
    }
    if (!content.trim()) {
      showToast('Email content cannot be empty', 'error');
      return;
    }

    setSending(true);
    try {
      const selectedBooking = bookings.find((b) => b.bookingReference === selectedBookingRef);
      const res = await sendEmailMessage({
        recipientEmail,
        customerName: customerName || 'Valued Guest',
        customerId: (selectedBooking as any)?.customerId || null,
        bookingId: selectedBooking?.bookingId || null,
        bookingReference: selectedBookingRef || null,
        templateKey: selectedTemplateKey || null,
        subject,
        content,
        staffName: 'Operations Dispatch',
      });

      if (res.success) {
        showToast(`Email dispatched successfully! Status: ${res.status} (${res.providerName})`, 'success');
        // Clear composer
        setSubject('');
        setContent('');
        setSelectedBookingRef('');
        setSelectedTemplateKey('');
      } else {
        showToast(res.error || 'Email dispatch failed. Provider not configured.', 'error');
      }

      await loadData();
    } catch (err: any) {
      showToast(err?.message || 'Error occurred while sending email', 'error');
    } finally {
      setSending(false);
    }
  };

  const openSettingsModal = () => {
    setTempEmailProvider(providerConfig.email.provider);
    setTempApiKey(providerConfig.email.apiKey || '');
    setTempFromEmail(providerConfig.email.fromEmail || 'dispatch@redseavoyages.com');
    setTempFromName(providerConfig.email.fromName || 'Red Sea Voyages Dispatch');
    setIsSettingsOpen(true);
  };

  const saveSettings = () => {
    const newConfig: ProviderConfig = {
      ...providerConfig,
      email: {
        provider: tempEmailProvider,
        apiKey: tempApiKey.trim(),
        fromEmail: tempFromEmail.trim(),
        fromName: tempFromName.trim(),
        isConfigured: tempEmailProvider !== 'none' && tempApiKey.trim().length > 5,
      },
    };
    saveProviderConfig(newConfig);
    setProviderConfig(getProviderConfig());
    setIsSettingsOpen(false);
    showToast(
      newConfig.email.isConfigured
        ? `Email provider configured (${newConfig.email.provider})`
        : 'Email provider set to unconfigured',
      newConfig.email.isConfigured ? 'success' : 'info'
    );
  };

  // Filter messages
  const filteredMessages = useMemo(() => {
    return messages.filter((m) => {
      if (statusFilter !== 'all' && m.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          m.recipientAddress.toLowerCase().includes(q) ||
          m.customerName.toLowerCase().includes(q) ||
          (m.bookingReference && m.bookingReference.toLowerCase().includes(q)) ||
          (m.subject && m.subject.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [messages, statusFilter, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Top Header & Provider Status Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-stone-900 border border-stone-800 p-5 rounded-xl shadow-lg">
        <div>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                Email Dispatcher
                <span className="text-xs font-normal px-2.5 py-0.5 rounded-full bg-stone-800 text-stone-300 border border-stone-700">
                  Operations Comms
                </span>
              </h1>
              <p className="text-xs text-stone-400">
                Compose, preview, and dispatch booking vouchers, receipts, and departure reminders
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Provider status badge */}
          <div className="flex items-center space-x-2 bg-stone-950/70 px-3 py-1.5 rounded-lg border border-stone-800 text-xs">
            <span className="text-stone-400 font-medium">Provider:</span>
            {providerConfig.email.isConfigured ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20">
                <CheckCircle2 className="w-3 h-3" />
                {providerConfig.email.provider.toUpperCase()}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-semibold border border-amber-500/20">
                <AlertTriangle className="w-3 h-3" />
                Not configured
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={openSettingsModal}
            className="flex items-center space-x-2 px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-medium rounded-lg border border-stone-700 transition-colors"
          >
            <Settings className="w-3.5 h-3.5 text-stone-400" />
            <span>Provider Settings</span>
          </button>

          <button
            type="button"
            onClick={loadData}
            className="p-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-lg border border-stone-700 transition-colors"
            title="Refresh logs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-teal-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Provider Unconfigured Notice */}
      {!providerConfig.email.isConfigured && (
        <div className="bg-amber-950/40 border border-amber-500/30 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-200">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-100">Email Gateway Status: Not configured</p>
              <p className="text-amber-300/80 mt-0.5">
                No outbound API credentials configured (Resend, SendGrid, or SMTP). To maintain operational integrity,
                dispatches will be logged with status <strong>Failed (&ldquo;Not configured&rdquo;)</strong> rather than reporting fake delivery.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={openSettingsModal}
            className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/30 font-semibold rounded-lg shrink-0 transition-colors"
          >
            Connect Provider
          </button>
        </div>
      )}

      {/* Main Grid: Composer on Left / Activity & Logs on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Email Composer */}
        <div className="lg:col-span-7 bg-stone-900 border border-stone-800 rounded-xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-stone-800 pb-3">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Mail className="w-4 h-4 text-teal-400" />
              Compose Message
            </h2>
            <div className="flex items-center space-x-1 bg-stone-950 p-1 rounded-lg border border-stone-800 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('composer')}
                className={`px-3 py-1 rounded font-medium transition-colors ${
                  activeTab === 'composer' ? 'bg-teal-600 text-white shadow' : 'text-stone-400 hover:text-white'
                }`}
              >
                Editor
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`px-3 py-1 rounded font-medium transition-colors ${
                  activeTab === 'preview' ? 'bg-teal-600 text-white shadow' : 'text-stone-400 hover:text-white'
                }`}
              >
                Live Preview
              </button>
            </div>
          </div>

          {/* Quick Selectors: Booking Reference & Template */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-stone-400 mb-1">
                Attach Booking Context
              </label>
              <select
                value={selectedBookingRef}
                onChange={(e) => handleBookingChange(e.target.value)}
                className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
              >
                <option value="">-- Manual Recipient (No Booking) --</option>
                {bookings.map((b) => (
                  <option key={b.bookingId || b.bookingReference} value={b.bookingReference}>
                    {b.bookingReference} - {b.customer?.firstName} {b.customer?.lastName} ({b.tourTitle?.substring(0, 24)}...)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-stone-400 mb-1">
                Apply Reusable Template
              </label>
              <select
                value={selectedTemplateKey}
                onChange={(e) => applyTemplate(e.target.value)}
                className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
              >
                <option value="">-- Blank Email Draft --</option>
                {templates.map((t) => (
                  <option key={t.id || t.templateKey} value={t.templateKey}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Recipient Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-stone-400 mb-1">
                Recipient Email <span className="text-rose-400">*</span>
              </label>
              <input
                type="email"
                placeholder="guest@example.com"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-xs text-white placeholder-stone-600 focus:outline-none focus:border-teal-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-stone-400 mb-1">
                Customer Name
              </label>
              <input
                type="text"
                placeholder="e.g. Sarah Jenkins"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-xs text-white placeholder-stone-600 focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>

          {/* Subject Line */}
          <div>
            <label className="block text-[11px] font-medium text-stone-400 mb-1">
              Subject Line <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Excursion Voucher & Confirmed Departure: Giftun Island"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-xs text-white placeholder-stone-600 focus:outline-none focus:border-teal-500 font-medium"
            />
          </div>

          {/* Variable Injection Buttons */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-medium text-stone-400">Insert Variable Pill:</span>
              <span className="text-[10px] text-stone-500">Click to append in content</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[
                'customer_name',
                'booking_reference',
                'tour_name',
                'tour_date',
                'pickup_time',
                'amount',
                'balance_due',
                'hotel',
                'total',
                'balance',
              ].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => insertVariable(v)}
                  className="px-2 py-0.5 bg-stone-950 hover:bg-stone-800 text-[10px] font-mono text-teal-300 border border-stone-800 hover:border-teal-500/40 rounded transition-colors"
                >
                  +{`{{${v}}}`}
                </button>
              ))}
            </div>
          </div>

          {/* Editor vs Live Preview */}
          {activeTab === 'composer' ? (
            <div>
              <label className="block text-[11px] font-medium text-stone-400 mb-1">
                Email Message Body <span className="text-rose-400">*</span>
              </label>
              <textarea
                rows={9}
                placeholder="Compose your dispatch message here or choose a template above..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full bg-stone-950 border border-stone-800 rounded-lg p-3 text-xs text-stone-200 placeholder-stone-600 font-sans focus:outline-none focus:border-teal-500 leading-relaxed"
              />
            </div>
          ) : (
            <div className="space-y-3">
              <label className="block text-[11px] font-medium text-stone-400">
                Rendered HTML / Email Simulation
              </label>
              <div className="bg-stone-950 border border-stone-800 rounded-lg p-4 space-y-3">
                <div className="border-b border-stone-800 pb-2 text-xs">
                  <span className="text-stone-500">To:</span> <span className="text-stone-200 font-medium">{recipientEmail || '(no recipient)'}</span>
                  <br />
                  <span className="text-stone-500">From:</span> <span className="text-stone-300">{providerConfig.email.fromName} &lt;{providerConfig.email.fromEmail}&gt;</span>
                  <br />
                  <span className="text-stone-500">Subject:</span> <span className="text-white font-semibold">{subject || '(no subject)'}</span>
                </div>
                <div className="whitespace-pre-wrap text-xs text-stone-300 font-serif leading-relaxed bg-stone-900/60 p-4 rounded border border-stone-800">
                  {content ? content : <span className="italic text-stone-500">No message body provided.</span>}
                </div>
              </div>
            </div>
          )}

          {/* Action Row */}
          <div className="flex items-center justify-between pt-2 border-t border-stone-800">
            <div className="text-[11px] text-stone-400">
              {providerConfig.email.isConfigured ? (
                <span className="text-emerald-400 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> Gateway Ready via {providerConfig.email.provider}
                </span>
              ) : (
                <span className="text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Will record as &ldquo;Failed&rdquo; (Not configured)
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleSend}
              disabled={sending}
              className={`flex items-center space-x-2 px-5 py-2 rounded-lg font-semibold text-xs shadow-md transition-all ${
                sending
                  ? 'bg-stone-700 text-stone-400 cursor-not-allowed'
                  : 'bg-teal-600 hover:bg-teal-500 text-white active:scale-95'
              }`}
            >
              <Send className={`w-3.5 h-3.5 ${sending ? 'animate-pulse' : ''}`} />
              <span>{sending ? 'Dispatching...' : 'Dispatch Email'}</span>
            </button>
          </div>
        </div>

        {/* Right Column: Outbound Messages & Audit Trail */}
        <div className="lg:col-span-5 bg-stone-900 border border-stone-800 rounded-xl p-5 shadow-lg flex flex-col space-y-4">
          <div className="flex items-center justify-between border-b border-stone-800 pb-3">
            <div>
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-teal-400" />
                Email Outbox &amp; History
              </h2>
              <span className="text-[11px] text-stone-400">
                {filteredMessages.length} total logged dispatch events
              </span>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab?.('comm_history')}
              className="text-[11px] text-teal-400 hover:text-teal-300 font-medium underline"
            >
              View Full History
            </button>
          </div>

          {/* Search & Status Filters */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-stone-500" />
              <input
                type="text"
                placeholder="Search recipient, ref, or subject..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-stone-950 border border-stone-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-stone-600 focus:outline-none focus:border-teal-500"
              />
            </div>

            <div className="flex items-center space-x-1.5 text-[11px]">
              {(['all', 'Sent', 'Delivered', 'Queued', 'Failed'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                    statusFilter === st
                      ? 'bg-stone-700 text-white'
                      : 'bg-stone-950 text-stone-400 hover:text-white border border-stone-800'
                  }`}
                >
                  {st === 'all' ? 'All' : st}
                </button>
              ))}
            </div>
          </div>

          {/* Outbox List */}
          <div className="flex-1 overflow-y-auto space-y-2.5 max-h-[500px] pr-1">
            {filteredMessages.length === 0 ? (
              <div className="text-center py-12 text-stone-500 text-xs">
                No email dispatch logs matching current criteria.
              </div>
            ) : (
              filteredMessages.map((msg) => {
                const isFailed = msg.status === 'Failed';
                const isSent = msg.status === 'Sent';
                const isDelivered = msg.status === 'Delivered';

                return (
                  <div
                    key={msg.id}
                    onClick={() => setSelectedMessage(msg)}
                    className="p-3 bg-stone-950/70 hover:bg-stone-950 border border-stone-800 hover:border-stone-700 rounded-lg transition-colors cursor-pointer space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="font-semibold text-white truncate max-w-[180px]">
                        {msg.customerName}
                      </div>
                      <div className="flex items-center space-x-1.5">
                        {isDelivered && (
                          <span className="px-1.5 py-0.5 text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded">
                            Delivered
                          </span>
                        )}
                        {isSent && (
                          <span className="px-1.5 py-0.5 text-[10px] font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded">
                            Sent
                          </span>
                        )}
                        {isFailed && (
                          <span className="px-1.5 py-0.5 text-[10px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded">
                            Failed
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="text-[11px] text-stone-300 truncate">
                      {msg.subject || '(No subject)'}
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-stone-500 pt-1">
                      <span className="truncate max-w-[140px]">{msg.recipientAddress}</span>
                      <span>
                        {msg.providerName === 'Not configured' ? (
                          <span className="text-amber-400">Not configured</span>
                        ) : (
                          msg.providerName
                        )}
                      </span>
                    </div>

                    {msg.failureReason && (
                      <div className="text-[10px] text-rose-400/90 bg-rose-950/30 px-2 py-1 rounded border border-rose-900/40">
                        {msg.failureReason}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Provider Configuration Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-stone-900 border border-stone-800 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <div className="flex items-center space-x-2">
                <Settings className="w-5 h-5 text-teal-400" />
                <h3 className="text-base font-bold text-white">Email Provider Credentials</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="text-stone-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-stone-400">
              Configure production email provider API credentials. If unconfigured, the system strictly marks
              dispatches as <strong>&ldquo;Not configured&rdquo;</strong> to guarantee truthfulness.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-stone-300 font-medium mb-1">Select Gateway Provider</label>
                <select
                  value={tempEmailProvider}
                  onChange={(e) => setTempEmailProvider(e.target.value as any)}
                  className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-teal-500"
                >
                  <option value="none">None (Disabled / Testing Mode)</option>
                  <option value="resend">Resend (Recommended API)</option>
                  <option value="sendgrid">SendGrid Web API</option>
                  <option value="smtp">Direct SMTP Server</option>
                </select>
              </div>

              <div>
                <label className="block text-stone-300 font-medium mb-1">
                  API Key / Secret Token <span className="text-rose-400">*</span>
                </label>
                <input
                  type="password"
                  placeholder="re_123456789... or SG.xxxx"
                  value={tempApiKey}
                  onChange={(e) => setTempApiKey(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-white font-mono placeholder-stone-600 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-stone-300 font-medium mb-1">From Email Address</label>
                  <input
                    type="email"
                    value={tempFromEmail}
                    onChange={(e) => setTempFromEmail(e.target.value)}
                    className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-white placeholder-stone-600 focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-stone-300 font-medium mb-1">From Sender Name</label>
                  <input
                    type="text"
                    value={tempFromName}
                    onChange={(e) => setTempFromName(e.target.value)}
                    className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-white placeholder-stone-600 focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-stone-800 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="px-4 py-2 text-xs text-stone-300 hover:text-white hover:bg-stone-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveSettings}
                className="px-4 py-2 text-xs font-semibold bg-teal-600 hover:bg-teal-500 text-white rounded-lg transition-colors shadow-md"
              >
                Save Settings
              </button>
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
                <FileText className="w-5 h-5 text-teal-400" />
                <h3 className="text-base font-bold text-white">Email Dispatch Audit Details</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMessage(null)}
                className="text-stone-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-stone-800/60">
                <span className="text-stone-400">Recipient:</span>
                <span className="text-white font-medium">{selectedMessage.recipientAddress} ({selectedMessage.customerName})</span>
              </div>
              <div className="flex justify-between py-1 border-b border-stone-800/60">
                <span className="text-stone-400">Delivery Status:</span>
                <span className="font-semibold text-teal-400">{selectedMessage.status}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-stone-800/60">
                <span className="text-stone-400">Provider:</span>
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
                  <span className="text-teal-400 font-semibold">{selectedMessage.bookingReference}</span>
                </div>
              )}
              <div className="flex justify-between py-1 border-b border-stone-800/60">
                <span className="text-stone-400">Created At:</span>
                <span className="text-stone-300">{new Date(selectedMessage.createdAt).toLocaleString()}</span>
              </div>
              {selectedMessage.failureReason && (
                <div className="p-2.5 bg-rose-950/40 border border-rose-900/60 rounded text-rose-300">
                  <strong>Failure Reason:</strong> {selectedMessage.failureReason}
                </div>
              )}
            </div>

            <div>
              <span className="block text-xs font-medium text-stone-400 mb-1">Message Content:</span>
              <div className="bg-stone-950 p-3 rounded-lg border border-stone-800 text-xs text-stone-200 whitespace-pre-wrap max-h-48 overflow-y-auto">
                {selectedMessage.content}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedMessage(null)}
                className="px-4 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs rounded-lg transition-colors"
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
