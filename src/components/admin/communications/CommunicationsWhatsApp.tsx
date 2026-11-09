import React, { useState, useEffect, useMemo } from 'react';
import {
  MessageSquare,
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
  ExternalLink,
  Phone,
  Smartphone,
  Sliders,
} from 'lucide-react';
import { WhatsAppTemplateManager } from './WhatsAppTemplateManager';
import {
  sendWhatsAppMessage,
  listCommunicationMessages,
  listTemplates,
  getProviderConfig,
  saveProviderConfig,
  renderTemplateVariables,
  getWhatsAppDirectUrl,
  ProviderConfigurationError,
} from '../../../services/communicationService';
import {
  CommunicationMessage,
  CommunicationTemplate,
  ProviderConfig,
} from '../../../types/communication';
import { bookingRepository } from '../../../services/bookingRepository';
import { Booking } from '../../../types/booking';
import { useToast } from '../../../contexts/ToastContext';

interface CommunicationsWhatsAppProps {
  onNavigateTab?: (tabId: string, param?: string) => void;
}

export const CommunicationsWhatsApp: React.FC<CommunicationsWhatsAppProps> = ({ onNavigateTab }) => {
  const { showToast } = useToast();

  const [messages, setMessages] = useState<CommunicationMessage[]>([]);
  const [templates, setTemplates] = useState<CommunicationTemplate[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [providerConfig, setProviderConfig] = useState<ProviderConfig>(getProviderConfig());
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Console Mode (Dispatcher vs Template Manager)
  const [consoleMode, setConsoleMode] = useState<'dispatcher' | 'templates'>('dispatcher');

  // WhatsApp Composer
  const [recipientPhone, setRecipientPhone] = useState('+20 ');
  const [customerName, setCustomerName] = useState('');
  const [selectedBookingRef, setSelectedBookingRef] = useState('');
  const [selectedTemplateKey, setSelectedTemplateKey] = useState('');
  const [content, setContent] = useState('');
  const [activeTab, setActiveTab] = useState<'composer' | 'preview'>('composer');
  const [sending, setSending] = useState(false);

  // Provider Settings Modal
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [tempWaProvider, setTempWaProvider] = useState<'meta_cloud' | 'twilio' | 'none'>('meta_cloud');
  const [tempApiKey, setTempApiKey] = useState('');
  const [tempPhoneNumberId, setTempPhoneNumberId] = useState('');
  const [tempBusinessAccountId, setTempBusinessAccountId] = useState('');
  const [tempFromNumber, setTempFromNumber] = useState('+20 100 456 7890');

  // Message Detail Drawer
  const [selectedMessage, setSelectedMessage] = useState<CommunicationMessage | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [msgs, tmpls, bks] = await Promise.all([
        listCommunicationMessages({ channel: 'WhatsApp' }),
        listTemplates(),
        bookingRepository.listBookings(),
      ]);
      setMessages(msgs.filter((m) => m.channel === 'WhatsApp'));
      setTemplates(tmpls.filter((t) => t.channel === 'WhatsApp' || t.channel === 'Both'));
      setBookings(bks);
      setProviderConfig(getProviderConfig());
    } catch (err) {
      console.error('Failed to load whatsapp comms data:', err);
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
      const fullPhone = `${b.customer?.countryCode || '+20'}${b.customer?.phoneNumber || ''}`;
      setRecipientPhone(fullPhone);
      setCustomerName(`${b.customer?.firstName || ''} ${b.customer?.lastName || ''}`.trim() || 'Guest');

      if (selectedTemplateKey) {
        applyTemplate(selectedTemplateKey, b);
      }
    }
  };

  // When template changes, inject variables and fill body
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

    setContent(renderTemplateVariables(tmpl.bodyText, vars));
  };

  const insertVariable = (varTag: string) => {
    setContent((prev) => `${prev} {{${varTag}}}`);
  };

  const handleSend = async () => {
    const cleanPhone = recipientPhone.replace(/[^0-9+]/g, '');
    if (!cleanPhone || cleanPhone.length < 8) {
      showToast('Please enter a valid international WhatsApp phone number (e.g. +201004567890)', 'error');
      return;
    }
    if (!content.trim()) {
      showToast('WhatsApp message content cannot be empty', 'error');
      return;
    }

    setSending(true);
    try {
      const selectedBooking = bookings.find((b) => b.bookingReference === selectedBookingRef);
      const res = await sendWhatsAppMessage({
        recipientPhone: cleanPhone,
        customerName: customerName || 'Valued Guest',
        customerId: (selectedBooking as any)?.customerId || null,
        bookingId: selectedBooking?.bookingId || null,
        bookingReference: selectedBookingRef || null,
        templateKey: selectedTemplateKey || null,
        content,
        staffName: 'Concierge Dispatcher',
      });

      if (res.success) {
        showToast(`WhatsApp dispatched! Status: ${res.status} (Provider: ${res.providerName})`, 'success');
        setContent('');
        setSelectedBookingRef('');
        setSelectedTemplateKey('');
      } else {
        showToast(
          res.error || res.failureReason || 'WhatsApp dispatch recorded as Failed. Provider not configured.',
          'error',
          6000
        );
      }
    } catch (err: any) {
      const isConfigError =
        err instanceof ProviderConfigurationError ||
        err?.name === 'ProviderConfigurationError' ||
        Array.isArray(err?.missingFields);

      if (isConfigError) {
        const missingFields =
          Array.isArray(err.missingFields) && err.missingFields.length > 0
            ? err.missingFields.join(', ')
            : null;

        const errorToast = missingFields
          ? `${err.message} (Missing field: ${missingFields})`
          : err.message || 'WhatsApp provider configuration error. Missing required credentials.';

        showToast(errorToast, 'error', 7000);
      } else {
        showToast(err?.message || 'Error occurred while sending WhatsApp message', 'error', 5000);
      }
    } finally {
      await loadData();
      setSending(false);
    }
  };

  const handleOpenDirectChat = () => {
    const cleanPhone = recipientPhone.replace(/[^0-9]/g, '');
    if (!cleanPhone || cleanPhone.length < 7) {
      showToast('Please enter a valid phone number first', 'error');
      return;
    }
    const url = getWhatsAppDirectUrl(cleanPhone, content);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const openSettingsModal = () => {
    setTempWaProvider(providerConfig.whatsapp.provider as any);
    setTempApiKey(providerConfig.whatsapp.apiKey || '');
    setTempPhoneNumberId(providerConfig.whatsapp.phoneNumberId || '');
    setTempBusinessAccountId(providerConfig.whatsapp.businessAccountId || '');
    setTempFromNumber(providerConfig.whatsapp.fromNumber || '+20 100 456 7890');
    setIsSettingsOpen(true);
  };

  const saveSettings = () => {
    const newConfig: ProviderConfig = {
      ...providerConfig,
      whatsapp: {
        provider: tempWaProvider,
        apiKey: tempApiKey.trim(),
        phoneNumberId: tempPhoneNumberId.trim(),
        businessAccountId: tempBusinessAccountId.trim(),
        fromNumber: tempFromNumber.trim(),
        isConfigured: tempWaProvider !== 'none' && tempApiKey.trim().length > 5,
      },
    };
    saveProviderConfig(newConfig);
    const updatedConfig = getProviderConfig();
    setProviderConfig(updatedConfig);
    setIsSettingsOpen(false);
    showToast(
      updatedConfig.whatsapp.isConfigured
        ? `WhatsApp provider connected (${updatedConfig.whatsapp.provider})`
        : 'WhatsApp provider set to unconfigured / incomplete credentials',
      updatedConfig.whatsapp.isConfigured ? 'success' : 'info'
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
          (m.providerMessageId && m.providerMessageId.toLowerCase().includes(q))
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
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                WhatsApp Dispatch Console
                <span className="text-xs font-normal px-2.5 py-0.5 rounded-full bg-stone-800 text-stone-300 border border-stone-700">
                  Direct Guest Messaging
                </span>
              </h1>
              <p className="text-xs text-stone-400">
                Send excursion boarding passes, hotel pickup reminders, and pier updates via verified WhatsApp
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Provider status badge */}
          <div className="flex items-center space-x-2 bg-stone-950/70 px-3 py-1.5 rounded-lg border border-stone-800 text-xs">
            <span className="text-stone-400 font-medium">Gateway:</span>
            {providerConfig.whatsapp.isConfigured ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20">
                <CheckCircle2 className="w-3 h-3" />
                {providerConfig.whatsapp.provider === 'meta_cloud' ? 'Meta Cloud API' : 'Twilio'}
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
            <span>Connect Provider</span>
          </button>

          <button
            type="button"
            onClick={loadData}
            className="p-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-lg border border-stone-700 transition-colors"
            title="Refresh logs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Unconfigured Warning Notice */}
      {!providerConfig.whatsapp.isConfigured && (
        <div className="bg-amber-950/40 border border-amber-500/30 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-200">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-100">WhatsApp Gateway Status: Not configured</p>
              <p className="text-amber-300/80 mt-0.5">
                No Meta Cloud API or Twilio credentials connected. To prevent fake confirmation logs, automated dispatches
                will record as <strong>Failed (&ldquo;Not configured&rdquo;)</strong>. You can still use the <em>&ldquo;Open in WhatsApp Web&rdquo;</em> button
                to send directly via your desktop/phone WhatsApp.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={openSettingsModal}
            className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/30 font-semibold rounded-lg shrink-0 transition-colors"
          >
            Connect API Keys
          </button>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-stone-900/60 border border-stone-800 p-2.5 rounded-xl">
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setConsoleMode('dispatcher')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
              consoleMode === 'dispatcher'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-stone-950 text-stone-400 hover:text-stone-200 border border-stone-800 hover:border-stone-700'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Message Dispatcher</span>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                consoleMode === 'dispatcher' ? 'bg-emerald-700 text-emerald-100' : 'bg-stone-800 text-stone-400'
              }`}
            >
              {messages.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setConsoleMode('templates')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
              consoleMode === 'templates'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-stone-950 text-stone-400 hover:text-stone-200 border border-stone-800 hover:border-stone-700'
            }`}
          >
            <Sliders className="w-4 h-4 text-emerald-400" />
            <span>Manage Templates</span>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                consoleMode === 'templates' ? 'bg-emerald-700 text-emerald-100' : 'bg-stone-800 text-stone-400'
              }`}
            >
              {templates.length}
            </span>
          </button>
        </div>

        <div className="text-[11px] text-stone-400 px-2 flex items-center gap-2">
          {consoleMode === 'dispatcher' ? (
            <span>Direct guest dispatch with booking auto-fill and delivery logs</span>
          ) : (
            <span>Define WhatsApp templates, assign dynamic variable tags & real-time preview</span>
          )}
        </div>
      </div>

      {consoleMode === 'templates' ? (
        <WhatsAppTemplateManager
          templates={templates}
          bookings={bookings}
          onTemplatesUpdated={loadData}
          onSelectForDispatch={(templateKey) => {
            setConsoleMode('dispatcher');
            setSelectedTemplateKey(templateKey);
            const b = bookings.find((x) => x.bookingReference === selectedBookingRef);
            applyTemplate(templateKey, b);
            showToast(`Loaded template "${templateKey}" into dispatch composer`, 'info');
          }}
        />
      ) : (
        /* Main Grid: Composer on Left / Activity & Logs on Right */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: WhatsApp Composer */}
          <div className="lg:col-span-7 bg-stone-900 border border-stone-800 rounded-xl p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-emerald-400" />
                WhatsApp Message Dispatcher
              </h2>
              <div className="flex items-center space-x-1 bg-stone-950 p-1 rounded-lg border border-stone-800 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab('composer')}
                  className={`px-3 py-1 rounded font-medium transition-colors ${
                    activeTab === 'composer' ? 'bg-emerald-600 text-white shadow' : 'text-stone-400 hover:text-white'
                  }`}
                >
                  Draft
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('preview')}
                  className={`px-3 py-1 rounded font-medium transition-colors ${
                    activeTab === 'preview' ? 'bg-emerald-600 text-white shadow' : 'text-stone-400 hover:text-white'
                  }`}
                >
                  Chat Bubble Preview
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
                  className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="">-- Manual Guest (No Booking) --</option>
                  {bookings.map((b) => (
                    <option key={b.bookingId || b.bookingReference} value={b.bookingReference}>
                      {b.bookingReference} - {b.customer?.firstName} {b.customer?.lastName} ({b.tourTitle?.substring(0, 24)}...)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-medium text-stone-400">
                    Apply Reusable Template
                  </label>
                  <button
                    type="button"
                    onClick={() => setConsoleMode('templates')}
                    className="text-[10px] text-emerald-400 hover:text-emerald-300 hover:underline flex items-center gap-1 font-medium"
                    title="Open Template Manager"
                  >
                    <Sliders className="w-3 h-3" />
                    <span>Manage Templates</span>
                  </button>
                </div>
                <select
                  value={selectedTemplateKey}
                  onChange={(e) => applyTemplate(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="">-- Custom Message --</option>
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
                WhatsApp Phone Number (E.164) <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <Smartphone className="w-3.5 h-3.5 absolute left-3 top-2.5 text-stone-500" />
                <input
                  type="text"
                  placeholder="+20 100 123 4567 or +44 7911..."
                  value={recipientPhone}
                  onChange={(e) => setRecipientPhone(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 rounded-lg pl-8 pr-3 py-2 text-xs text-white font-mono placeholder-stone-600 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-stone-400 mb-1">
                Guest Name
              </label>
              <input
                type="text"
                placeholder="e.g. Markus Weber"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-xs text-white placeholder-stone-600 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Variable Insertion Buttons */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-medium text-stone-400">Insert Template Variable:</span>
              <span className="text-[10px] text-stone-500">Auto-filled with reservation data</span>
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
                  className="px-2 py-0.5 bg-stone-950 hover:bg-stone-800 text-[10px] font-mono text-emerald-300 border border-stone-800 hover:border-emerald-500/40 rounded transition-colors"
                >
                  +{`{{${v}}}`}
                </button>
              ))}
            </div>
          </div>

          {/* Editor vs Live Chat Preview */}
          {activeTab === 'composer' ? (
            <div>
              <label className="block text-[11px] font-medium text-stone-400 mb-1">
                WhatsApp Message Text <span className="text-rose-400">*</span>
              </label>
              <textarea
                rows={9}
                placeholder="Type your WhatsApp dispatch or pickup reminder message..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full bg-stone-950 border border-stone-800 rounded-lg p-3 text-xs text-stone-200 placeholder-stone-600 font-sans focus:outline-none focus:border-emerald-500 leading-relaxed"
              />
            </div>
          ) : (
            <div className="space-y-3">
              <label className="block text-[11px] font-medium text-stone-400">
                WhatsApp Client Simulation (Recipient Screen)
              </label>
              {/* WhatsApp Mock Chat Bubble */}
              <div className="bg-[#0b141a] border border-[#202c33] rounded-xl p-4 shadow-inner min-h-[220px] flex flex-col justify-end">
                <div className="bg-[#005c4b] text-[#e9edef] rounded-lg p-3 max-w-[85%] self-end text-xs shadow-md space-y-1">
                  <p className="whitespace-pre-wrap leading-relaxed">
                    {content || '(No message content)'}
                  </p>
                  <div className="flex items-center justify-end space-x-1 text-[10px] text-[#8696a0]">
                    <span>10:45 AM</span>
                    <CheckCircle2 className="w-3 h-3 text-[#53bdeb]" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-stone-800">
            <button
              type="button"
              onClick={handleOpenDirectChat}
              className="flex items-center space-x-1.5 px-3 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white rounded-lg text-xs font-medium border border-stone-700 transition-colors"
              title="Open directly in WhatsApp Web without API gateway"
            >
              <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
              <span>Open in WhatsApp Web</span>
            </button>

            <button
              type="button"
              onClick={handleSend}
              disabled={sending}
              className={`flex items-center justify-center space-x-2 px-5 py-2 rounded-lg font-semibold text-xs shadow-md transition-all ${
                sending
                  ? 'bg-stone-700 text-stone-400 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white active:scale-95'
              }`}
            >
              <Send className={`w-3.5 h-3.5 ${sending ? 'animate-pulse' : ''}`} />
              <span>{sending ? 'Dispatching...' : 'Dispatch via WhatsApp Gateway'}</span>
            </button>
          </div>
        </div>

        {/* Right Column: Outbound Messages & Audit Trail */}
        <div className="lg:col-span-5 bg-stone-900 border border-stone-800 rounded-xl p-5 shadow-lg flex flex-col space-y-4">
          <div className="flex items-center justify-between border-b border-stone-800 pb-3">
            <div>
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-400" />
                WhatsApp Outbound Log
              </h2>
              <span className="text-[11px] text-stone-400">
                {filteredMessages.length} total recorded messages
              </span>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab?.('comm_history')}
              className="text-[11px] text-emerald-400 hover:text-emerald-300 font-medium underline"
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
                placeholder="Search phone, recipient, or provider ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-stone-950 border border-stone-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-stone-600 focus:outline-none focus:border-emerald-500"
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
                No WhatsApp dispatches matching current criteria.
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

                    <div className="text-[11px] font-mono text-emerald-400 truncate">
                      {msg.recipientAddress}
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-stone-500 pt-1">
                      <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <span>
                        {msg.providerName === 'Not configured' ? (
                          <span className="text-amber-400">Not configured</span>
                        ) : (
                          msg.providerName
                        )}
                      </span>
                    </div>

                    {msg.providerMessageId && (
                      <div className="text-[9px] font-mono text-stone-400 truncate">
                        ID: {msg.providerMessageId}
                      </div>
                    )}

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
      )}

      {/* Provider Configuration Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-stone-900 border border-stone-800 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <div className="flex items-center space-x-2">
                <Settings className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">WhatsApp Business Provider</h3>
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
              Connect official WhatsApp Cloud API (Meta Developers) or Twilio WhatsApp. The system never hard-codes
              fake APIs and strictly checks credentials before confirming send status.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-stone-300 font-medium mb-1">Provider Platform</label>
                <select
                  value={tempWaProvider}
                  onChange={(e) => setTempWaProvider(e.target.value as any)}
                  className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="none">None (Disabled / Manual Web Only)</option>
                  <option value="meta_cloud">Meta WhatsApp Cloud API (Official)</option>
                  <option value="twilio">Twilio Programmable WhatsApp</option>
                </select>
              </div>

              <div>
                <label className="block text-stone-300 font-medium mb-1">
                  API Token / Secret Key <span className="text-rose-400">*</span>
                </label>
                <input
                  type="password"
                  placeholder="EAAxxx... (Permanent System User Token)"
                  value={tempApiKey}
                  onChange={(e) => setTempApiKey(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-white font-mono placeholder-stone-600 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {tempWaProvider === 'meta_cloud' && (
                <>
                  <div>
                    <label className="block text-stone-300 font-medium mb-1">Phone Number ID</label>
                    <input
                      type="text"
                      placeholder="e.g. 104829104810294"
                      value={tempPhoneNumberId}
                      onChange={(e) => setTempPhoneNumberId(e.target.value)}
                      className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-white font-mono placeholder-stone-600 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-stone-300 font-medium mb-1">Business Account ID (WABA)</label>
                    <input
                      type="text"
                      placeholder="e.g. 984719284719283"
                      value={tempBusinessAccountId}
                      onChange={(e) => setTempBusinessAccountId(e.target.value)}
                      className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-white font-mono placeholder-stone-600 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-stone-300 font-medium mb-1">Sender Phone Number</label>
                <input
                  type="text"
                  placeholder="+20 100 456 7890"
                  value={tempFromNumber}
                  onChange={(e) => setTempFromNumber(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-white placeholder-stone-600 focus:outline-none focus:border-emerald-500"
                />
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
                className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors shadow-md"
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
                <MessageSquare className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">WhatsApp Dispatch Audit Details</h3>
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
                <span className="text-stone-400">Recipient Phone:</span>
                <span className="font-mono text-emerald-400 font-bold">{selectedMessage.recipientAddress}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-stone-800/60">
                <span className="text-stone-400">Guest Name:</span>
                <span className="text-white font-medium">{selectedMessage.customerName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-stone-800/60">
                <span className="text-stone-400">Delivery Status:</span>
                <span className="font-semibold text-teal-400">{selectedMessage.status}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-stone-800/60">
                <span className="text-stone-400">Provider Gateway:</span>
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
                <span className="text-stone-400">Sent Timestamp:</span>
                <span className="text-stone-300">{selectedMessage.sentAt ? new Date(selectedMessage.sentAt).toLocaleString() : 'Not dispatched'}</span>
              </div>
              {selectedMessage.failureReason && (
                <div className="p-2.5 bg-rose-950/40 border border-rose-900/60 rounded text-rose-300">
                  <strong>Failure Reason:</strong> {selectedMessage.failureReason}
                </div>
              )}
            </div>

            <div>
              <span className="block text-xs font-medium text-stone-400 mb-1">Message Text:</span>
              <div className="bg-stone-950 p-3 rounded-lg border border-stone-800 text-xs text-stone-200 whitespace-pre-wrap max-h-48 overflow-y-auto">
                {selectedMessage.content}
              </div>
            </div>

            <div className="pt-2 flex justify-between items-center">
              <button
                type="button"
                onClick={() => {
                  const url = getWhatsAppDirectUrl(selectedMessage.recipientAddress, selectedMessage.content);
                  window.open(url, '_blank');
                }}
                className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Open in WhatsApp Web
              </button>
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
