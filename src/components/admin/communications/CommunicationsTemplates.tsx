import React, { useState, useEffect } from 'react';
import {
  FileText,
  Edit3,
  RotateCcw,
  Save,
  CheckCircle2,
  Copy,
  Search,
  Filter,
  Eye,
  Mail,
  MessageSquare,
  Sparkles,
  Check,
  Plus,
} from 'lucide-react';
import {
  listTemplates,
  saveTemplate,
  DEFAULT_TEMPLATES,
  renderTemplateVariables,
} from '../../../services/communicationService';
import {
  CommunicationTemplate,
  TemplateKey,
} from '../../../types/communication';
import { useToast } from '../../../contexts/ToastContext';

interface CommunicationsTemplatesProps {
  onNavigateTab?: (tabId: string, param?: string) => void;
}

const TEMPLATE_DESCRIPTIONS: Record<string, string> = {
  booking_confirmation: 'Official reservation voucher confirming tour departure and pickup time.',
  booking_update: 'Notification sent when tour departure time, vessel, or logistics are modified.',
  payment_confirmation: 'Financial payment receipt sent when card, bank wire, or online deposit is booked.',
  payment_reminder: 'Payment reminder for remaining pier balance due before tour departure.',
  cancellation: 'Formal excursion cancellation confirmation with refund eligibility details.',
  refund: 'Notice detailing approved and processed refund amount credited to traveler.',
  pickup_reminder: 'Sent 18-24 hours prior to departure reminding guests of exact hotel lobby pickup.',
  tour_reminder: 'Pre-tour briefing sent 24-48 hours before excursion detailing what to bring.',
  inquiry_response: 'Standard concierge reply answering traveler inquiries and charter questions.',
  follow_up: 'Post-inquiry check-in offering island charters, quad safaris, or diving packages.',
  welcome: 'Onboarding greeting welcoming new guests to the Red Sea Voyages network.',
  review_request: 'Post-tour review invitation with direct Google/TripAdvisor link.',
  // Legacy aliases
  booking_received: 'Triggered upon customer web reservation checkout. Confirms intake.',
  booking_confirmed: 'Legacy alias for booking confirmation voucher.',
  payment_received: 'Legacy alias for payment receipt.',
  booking_cancelled: 'Legacy alias for cancellation notice.',
  booking_completed: 'Debrief message sent post-excursion thanking travelers.',
  customer_followup: 'Legacy alias for concierge check-in.',
};

const SAMPLE_VARS = {
  customer_name: 'Sarah Jenkins',
  booking_reference: 'RSV-2026-8941',
  tour_name: 'Giftun Island VIP Yacht & Snorkeling Cruise',
  tour_date: '2026-10-15',
  pickup_time: '07:30 AM',
  amount: '360.00',
  balance_due: '120.00',
  hotel: 'Steigenberger ALDAU Beach Hotel, Hurghada',
  total: '360.00',
  balance: '120.00',
  payment_status: 'Partially Paid',
};

const STANDARD_VARIABLE_CHIPS = [
  'customer_name',
  'booking_reference',
  'tour_name',
  'tour_date',
  'pickup_time',
  'amount',
  'balance_due',
  'hotel',
];

export const CommunicationsTemplates: React.FC<CommunicationsTemplatesProps> = ({ onNavigateTab: _onNavigateTab }) => {
  const { showToast } = useToast();

  const [templates, setTemplates] = useState<CommunicationTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>('booking_confirmation');
  const [searchQuery, setSearchQuery] = useState('');
  const [channelFilter, setChannelFilter] = useState<string>('all');

  // Edit State
  const [editingName, setEditingName] = useState('');
  const [editingChannel, setEditingChannel] = useState<'Email' | 'WhatsApp' | 'Both'>('Both');
  const [editingSubject, setEditingSubject] = useState('');
  const [editingBody, setEditingBody] = useState('');
  const [editingIsActive, setEditingIsActive] = useState(true);
  const [previewTab, setPreviewTab] = useState<'editor' | 'preview'>('editor');
  const [saving, setSaving] = useState(false);
  const [copiedVar, setCopiedVar] = useState<string | null>(null);

  // New Template Modal
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newTmplKey, setNewTmplKey] = useState('');
  const [newTmplName, setNewTmplName] = useState('');
  const [newTmplChannel, setNewTmplChannel] = useState<'Email' | 'WhatsApp' | 'Both'>('Both');
  const [newTmplSubject, setNewTmplSubject] = useState('');
  const [newTmplBody, setNewTmplBody] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const all = await listTemplates();
      setTemplates(all);
      const active = all.find((t) => t.templateKey === selectedTemplateKey) || all[0];
      if (active) {
        setSelectedTemplateKey(active.templateKey);
        setEditingName(active.name);
        setEditingChannel(active.channel);
        setEditingSubject(active.subject || '');
        setEditingBody(active.bodyText);
        setEditingIsActive(active.isActive);
      }
    } catch (err) {
      console.error('Error loading templates:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSelectTemplate = (t: CommunicationTemplate) => {
    setSelectedTemplateKey(t.templateKey);
    setEditingName(t.name);
    setEditingChannel(t.channel);
    setEditingSubject(t.subject || '');
    setEditingBody(t.bodyText);
    setEditingIsActive(t.isActive);
  };

  const handleInsertVariable = (v: string) => {
    setEditingBody((prev) => `${prev} {{${v}}}`);
    setCopiedVar(v);
    setTimeout(() => setCopiedVar(null), 1500);
  };

  const handleSave = async () => {
    const current = templates.find((t) => t.templateKey === selectedTemplateKey);
    if (!current) return;

    if (!editingName.trim()) {
      showToast('Template name cannot be empty', 'error');
      return;
    }
    if (!editingBody.trim()) {
      showToast('Template body text cannot be empty', 'error');
      return;
    }

    setSaving(true);
    try {
      const updated: CommunicationTemplate = {
        ...current,
        name: editingName.trim(),
        channel: editingChannel,
        subject: editingSubject.trim() || null,
        bodyText: editingBody.trim(),
        isActive: editingIsActive,
      };

      await saveTemplate(updated);
      showToast(`Template "${updated.name}" saved successfully`, 'success');
      await loadData();
    } catch (err: any) {
      showToast(err?.message || 'Failed to save template', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateNewTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTmplKey.trim() || !newTmplName.trim() || !newTmplBody.trim()) {
      showToast('Please fill all required template fields', 'error');
      return;
    }

    const cleanKey = newTmplKey.toLowerCase().replace(/[^a-z0-9_]/g, '_') as TemplateKey;
    const newTemplate: CommunicationTemplate = {
      id: `tmpl-custom-${Date.now().toString(36)}`,
      templateKey: cleanKey,
      name: newTmplName.trim(),
      channel: newTmplChannel,
      subject: newTmplSubject.trim() || null,
      bodyText: newTmplBody.trim(),
      variables: STANDARD_VARIABLE_CHIPS,
      isActive: true,
    };

    setSaving(true);
    try {
      await saveTemplate(newTemplate);
      showToast(`Custom template "${newTemplate.name}" created`, 'success');
      setIsCreatingNew(false);
      setNewTmplKey('');
      setNewTmplName('');
      setNewTmplSubject('');
      setNewTmplBody('');
      await loadData();
      setSelectedTemplateKey(newTemplate.templateKey);
    } catch (err: any) {
      showToast(err?.message || 'Failed to create template', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefault = async () => {
    const defaultTmpl = DEFAULT_TEMPLATES.find((t) => t.templateKey === selectedTemplateKey);
    if (!defaultTmpl) {
      showToast('No factory default template for this custom template', 'info');
      return;
    }

    setSaving(true);
    try {
      await saveTemplate(defaultTmpl);
      showToast(`Template reset to system default`, 'info');
      await loadData();
    } catch (err: any) {
      showToast(err?.message || 'Failed to reset template', 'error');
    } finally {
      setSaving(false);
    }
  };

  const filteredTemplates = templates.filter((t) => {
    if (channelFilter !== 'all' && t.channel !== channelFilter && t.channel !== 'Both') return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        t.name.toLowerCase().includes(q) ||
        t.templateKey.toLowerCase().includes(q) ||
        (t.subject && t.subject.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const selectedTemplate = templates.find((t) => t.templateKey === selectedTemplateKey);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-stone-900 border border-stone-800 p-5 rounded-xl shadow-lg">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              Communication Templates
              <span className="text-xs font-normal px-2.5 py-0.5 rounded-full bg-stone-800 text-stone-300 border border-stone-700">
                {templates.length} Active Templates
              </span>
            </h1>
            <p className="text-xs text-stone-400">
              Manage dynamic variables and reusable formats for automated booking, payment, and departure alerts
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsCreatingNew(true)}
            className="inline-flex items-center space-x-1.5 px-3 py-2 bg-[#0A6C74] hover:bg-[#08545a] text-white rounded-lg text-xs font-semibold shadow transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Template</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Sidebar List + Editor Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Template Selector Sidebar */}
        <div className="lg:col-span-4 bg-stone-900 border border-stone-800 rounded-xl p-4 space-y-4">
          <div className="space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-stone-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-stone-950 border border-stone-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-stone-200 focus:outline-none focus:border-teal-500"
              />
            </div>
            <div className="flex items-center space-x-1">
              <Filter className="w-3 h-3 text-stone-500 ml-1" />
              {(['all', 'Email', 'WhatsApp', 'Both'] as const).map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => setChannelFilter(ch)}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                    channelFilter === ch
                      ? 'bg-stone-800 text-teal-400 border border-stone-700'
                      : 'text-stone-400 hover:text-stone-200'
                  }`}
                >
                  {ch === 'all' ? 'All Channels' : ch}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="py-8 text-center text-xs text-stone-500">Loading templates...</div>
          ) : (
            <div className="space-y-1.5 max-h-[560px] overflow-y-auto pr-1">
              {filteredTemplates.map((t) => {
                const isSelected = t.templateKey === selectedTemplateKey;
                return (
                  <button
                    key={t.id || t.templateKey}
                    type="button"
                    onClick={() => handleSelectTemplate(t)}
                    className={`w-full text-left p-3 rounded-lg border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-teal-500/10 border-teal-500/40 shadow-xs'
                        : 'bg-stone-950 border-stone-800 hover:border-stone-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-semibold ${isSelected ? 'text-teal-300' : 'text-stone-200'}`}>
                        {t.name}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-stone-900 border border-stone-800 text-stone-400">
                        {t.channel}
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-400 line-clamp-2">
                      {TEMPLATE_DESCRIPTIONS[t.templateKey] || t.bodyText.substring(0, 80) + '...'}
                    </p>
                    <div className="mt-2 flex items-center justify-between text-[10px] text-stone-500 font-mono">
                      <span>{t.templateKey}</span>
                      <span className={t.isActive ? 'text-emerald-400' : 'text-stone-500'}>
                        {t.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Editor & Live Preview Panel */}
        <div className="lg:col-span-8 bg-stone-900 border border-stone-800 rounded-xl p-5 space-y-5">
          {selectedTemplate ? (
            <>
              {/* Header with Title and Mode Switch */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-800 pb-4">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Edit3 className="w-4 h-4 text-teal-400" />
                    <span>{editingName}</span>
                    <span className="text-[11px] font-mono font-normal text-stone-400 px-2 py-0.5 rounded bg-stone-800 border border-stone-700">
                      {selectedTemplateKey}
                    </span>
                  </h2>
                  <p className="text-xs text-stone-400 mt-0.5">
                    {TEMPLATE_DESCRIPTIONS[selectedTemplateKey] || 'Custom operational communication format.'}
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <div className="flex rounded-lg bg-stone-950 p-0.5 border border-stone-800">
                    <button
                      type="button"
                      onClick={() => setPreviewTab('editor')}
                      className={`px-3 py-1 rounded text-xs font-semibold cursor-pointer transition-colors ${
                        previewTab === 'editor'
                          ? 'bg-stone-800 text-white shadow-xs'
                          : 'text-stone-400 hover:text-stone-200'
                      }`}
                    >
                      Editor
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewTab('preview')}
                      className={`px-3 py-1 rounded text-xs font-semibold flex items-center space-x-1 cursor-pointer transition-colors ${
                        previewTab === 'preview'
                          ? 'bg-teal-500/20 text-teal-300 shadow-xs'
                          : 'text-stone-400 hover:text-stone-200'
                      }`}
                    >
                      <Eye className="w-3 h-3" />
                      <span>Live Preview</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleResetToDefault}
                    title="Reset template to factory defaults"
                    className="p-1.5 rounded-lg border border-stone-800 bg-stone-950 hover:bg-stone-800 text-stone-400 hover:text-stone-200 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#0A6C74] hover:bg-[#08545a] text-white text-xs font-semibold shadow transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{saving ? 'Saving...' : 'Save Template'}</span>
                  </button>
                </div>
              </div>

              {previewTab === 'editor' ? (
                /* Editor Form */
                <div className="space-y-4">
                  {/* Row 1: Name, Channel, Active */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-stone-400 mb-1">
                        Template Name
                      </label>
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-stone-400 mb-1">
                        Channel Delivery
                      </label>
                      <select
                        value={editingChannel}
                        onChange={(e) => setEditingChannel(e.target.value as any)}
                        className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                      >
                        <option value="Both">Both (Email & WhatsApp)</option>
                        <option value="Email">Email Only</option>
                        <option value="WhatsApp">WhatsApp Only</option>
                      </select>
                    </div>

                    <div className="flex items-center pt-5">
                      <label className="inline-flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editingIsActive}
                          onChange={(e) => setEditingIsActive(e.target.checked)}
                          className="rounded border-stone-700 bg-stone-900 text-teal-500 focus:ring-0"
                        />
                        <span className="text-xs text-stone-300">Active in System Dispatch</span>
                      </label>
                    </div>
                  </div>

                  {/* Subject Line (For Email) */}
                  {(editingChannel === 'Email' || editingChannel === 'Both') && (
                    <div>
                      <label className="block text-[11px] font-semibold text-stone-400 mb-1">
                        Email Subject Line (Supports Dynamic Variables)
                      </label>
                      <input
                        type="text"
                        value={editingSubject}
                        onChange={(e) => setEditingSubject(e.target.value)}
                        placeholder="e.g. Booking Confirmation: {{tour_name}} (Ref: {{booking_reference}})"
                        className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-teal-500"
                      />
                    </div>
                  )}

                  {/* Variable Helper Chips */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-semibold text-stone-400 flex items-center gap-1.5">
                        <Sparkles className="w-3 h-3 text-teal-400" />
                        <span>Insert Available Variables (Click to append)</span>
                      </span>
                      <span className="text-[10px] text-stone-500">Auto-substituted on send</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {STANDARD_VARIABLE_CHIPS.map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => handleInsertVariable(v)}
                          className="px-2 py-1 rounded bg-stone-950 hover:bg-stone-800 border border-stone-800 text-[11px] font-mono text-teal-400 flex items-center space-x-1 cursor-pointer transition-colors"
                        >
                          <span>{`{{${v}}}`}</span>
                          {copiedVar === v ? (
                            <Check className="w-2.5 h-2.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-2.5 h-2.5 text-stone-600 opacity-60" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Body Content Textarea */}
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-400 mb-1">
                      Template Body Message
                    </label>
                    <textarea
                      rows={12}
                      value={editingBody}
                      onChange={(e) => setEditingBody(e.target.value)}
                      className="w-full bg-stone-950 border border-stone-800 rounded-lg p-3 text-xs text-stone-200 font-mono leading-relaxed focus:outline-none focus:border-teal-500"
                    />
                  </div>
                </div>
              ) : (
                /* Live Preview Mode */
                <div className="space-y-4">
                  <div className="bg-stone-950 border border-stone-800 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between text-xs text-stone-400 border-b border-stone-800 pb-2">
                      <span className="font-semibold text-stone-300">Simulated Context (Real Variables):</span>
                      <span className="text-[10px] text-teal-400 font-mono">Ref: {SAMPLE_VARS.booking_reference}</span>
                    </div>

                    {editingSubject && (
                      <div>
                        <span className="text-[10px] text-stone-500 uppercase tracking-wider block font-bold">
                          Rendered Subject:
                        </span>
                        <div className="text-xs font-semibold text-white mt-0.5">
                          {renderTemplateVariables(editingSubject, SAMPLE_VARS)}
                        </div>
                      </div>
                    )}

                    <div>
                      <span className="text-[10px] text-stone-500 uppercase tracking-wider block font-bold">
                        Rendered Body:
                      </span>
                      <div className="mt-1 p-4 rounded bg-stone-900 border border-stone-800 text-xs text-stone-200 whitespace-pre-wrap leading-relaxed font-sans">
                        {renderTemplateVariables(editingBody, SAMPLE_VARS)}
                      </div>
                    </div>
                  </div>

                  {/* Multi-Channel Preview Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-lg bg-stone-950 border border-stone-800 flex items-start space-x-2.5">
                      <Mail className="w-4 h-4 text-sky-400 mt-0.5" />
                      <div>
                        <div className="font-bold text-white text-xs">Email Channel</div>
                        <div className="text-[11px] text-stone-400 mt-0.5">
                          Sends formal HTML/plaintext invoice voucher to traveler address.
                        </div>
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-stone-950 border border-stone-800 flex items-start space-x-2.5">
                      <MessageSquare className="w-4 h-4 text-emerald-400 mt-0.5" />
                      <div>
                        <div className="font-bold text-white text-xs">WhatsApp Channel</div>
                        <div className="text-[11px] text-stone-400 mt-0.5">
                          Sends instant mobile notification via Meta Cloud API / Twilio to traveler phone.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="py-16 text-center text-stone-500 text-xs">
              Select a communication template to inspect and edit.
            </div>
          )}
        </div>
      </div>

      {/* Modal: Create Custom Template */}
      {isCreatingNew && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-xl max-w-lg w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-teal-400" />
                <span>Create Custom Communication Template</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsCreatingNew(false)}
                className="text-stone-400 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateNewTemplate} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-stone-400 mb-1">
                  Unique Template Key (e.g. vip_charter_briefing)
                </label>
                <input
                  type="text"
                  required
                  value={newTmplKey}
                  onChange={(e) => setNewTmplKey(e.target.value)}
                  placeholder="e.g. desert_quad_reminder"
                  className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-stone-400 mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  required
                  value={newTmplName}
                  onChange={(e) => setNewTmplName(e.target.value)}
                  placeholder="e.g. Desert Safari Pickup Advisory"
                  className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-1.5 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-stone-400 mb-1">
                  Channel
                </label>
                <select
                  value={newTmplChannel}
                  onChange={(e) => setNewTmplChannel(e.target.value as any)}
                  className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-1.5 text-xs text-white"
                >
                  <option value="Both">Both (Email & WhatsApp)</option>
                  <option value="Email">Email Only</option>
                  <option value="WhatsApp">WhatsApp Only</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-stone-400 mb-1">
                  Subject Line (Optional)
                </label>
                <input
                  type="text"
                  value={newTmplSubject}
                  onChange={(e) => setNewTmplSubject(e.target.value)}
                  placeholder="e.g. Tour Notice: {{tour_name}}"
                  className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-1.5 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-stone-400 mb-1">
                  Body Text
                </label>
                <textarea
                  required
                  rows={5}
                  value={newTmplBody}
                  onChange={(e) => setNewTmplBody(e.target.value)}
                  placeholder="Dear {{customer_name}}, ..."
                  className="w-full bg-stone-950 border border-stone-800 rounded-lg p-2.5 text-xs text-white font-mono"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingNew(false)}
                  className="px-3 py-1.5 bg-stone-800 text-stone-300 rounded text-xs hover:bg-stone-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-1.5 bg-[#0A6C74] hover:bg-[#08545a] text-white rounded text-xs font-semibold"
                >
                  Create Template
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
