import React, { useState, useMemo, useRef } from 'react';
import {
  FileText,
  Plus,
  Save,
  Trash2,
  Copy,
  Check,
  Search,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Tag,
  Smartphone,
  Eye,
  ArrowRight,
  Sparkles,
  RefreshCw,
  Sliders,
  X,
  Send,
  MessageSquare,
} from 'lucide-react';
import {
  CommunicationTemplate,
  TemplateKey,
} from '../../../types/communication';
import { Booking } from '../../../types/booking';
import {
  saveTemplate,
  deleteTemplate,
  renderTemplateVariables,
  getWhatsAppDirectUrl,
} from '../../../services/communicationService';
import { useToast } from '../../../contexts/ToastContext';

interface WhatsAppTemplateManagerProps {
  templates: CommunicationTemplate[];
  bookings: Booking[];
  onTemplatesUpdated: () => Promise<void>;
  onSelectForDispatch?: (templateKey: string) => void;
}

const COMMON_VARIABLE_TAGS = [
  { tag: 'customer_name', label: 'Guest Name', desc: 'Full name of traveler (e.g. Sarah Jenkins)' },
  { tag: 'booking_reference', label: 'Booking Ref', desc: 'Voucher code (e.g. RSV-2026-8941)' },
  { tag: 'tour_name', label: 'Excursion Title', desc: 'Full tour name (e.g. Giftun Island VIP Snorkel)' },
  { tag: 'tour_date', label: 'Excursion Date', desc: 'Scheduled departure date (YYYY-MM-DD)' },
  { tag: 'pickup_time', label: 'Lobby Pickup', desc: 'Exact transfer pickup time (e.g. 07:45 AM)' },
  { tag: 'hotel', label: 'Hotel / Resort', desc: 'Resort lobby name (e.g. Steigenberger ALDAU)' },
  { tag: 'total', label: 'Total Price', desc: 'Grand total in EUR (e.g. €120.00)' },
  { tag: 'balance_due', label: 'Balance Due', desc: 'Outstanding pier payment in EUR (e.g. €40.00)' },
  { tag: 'payment_status', label: 'Payment Status', desc: 'Paid, Pending, or Pay at Pickup' },
  { tag: 'meeting_point', label: 'Meeting Point', desc: 'Marina pier or boat dock location' },
  { tag: 'boat_name', label: 'Assigned Vessel', desc: 'Yacht or speedboat name (e.g. Sea Voyager III)' },
  { tag: 'driver_name', label: 'Transfer Driver', desc: 'Assigned chauffeur name and shuttle fleet ID' },
  { tag: 'guide_phone', label: 'Guide WhatsApp', desc: 'Direct emergency phone for boat captain/guide' },
];

const PRESET_SAMPLE_DATA = {
  customer_name: 'Dr. Michael Hansen',
  booking_reference: 'RSV-2026-9421',
  tour_name: 'Giftun Island VIP Catamaran & Snorkeling Safari',
  tour_date: '2026-10-22',
  pickup_time: '07:30 AM',
  hotel: 'Steigenberger ALDAU Beach Hotel, Hurghada',
  total: '180.00',
  balance_due: '60.00',
  payment_status: 'Deposit Paid (Balance Due at Pier)',
  meeting_point: 'Hurghada Marina, Jetty #4 (Front of Marine Sports Club)',
  boat_name: 'Royal Dolphin Yacht IV',
  driver_name: 'Captain Tarek (+20 100 892 1102)',
  guide_phone: '+20 101 445 9931',
};

export const WhatsAppTemplateManager: React.FC<WhatsAppTemplateManagerProps> = ({
  templates,
  bookings,
  onTemplatesUpdated,
  onSelectForDispatch,
}) => {
  const { showToast } = useToast();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [channelFilter, setChannelFilter] = useState<'All' | 'WhatsApp' | 'Both'>('All');

  // Active Selected Template in Editor
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    templates[0]?.id || templates[0]?.templateKey || ''
  );
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // Form State for Active Edit
  const [formName, setFormName] = useState('');
  const [formKey, setFormKey] = useState('');
  const [formChannel, setFormChannel] = useState<'WhatsApp' | 'Both'>('WhatsApp');
  const [formBodyText, setFormBodyText] = useState('');
  const [formVariables, setFormVariables] = useState<string[]>([]);
  const [formIsActive, setFormIsActive] = useState(true);
  const [formSubject, setFormSubject] = useState('');
  const [customTagInput, setCustomTagInput] = useState('');

  // UI States
  const [saving, setSaving] = useState(false);
  const [copiedPreview, setCopiedPreview] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<CommunicationTemplate | null>(null);

  // Dynamic Preview Context
  const [previewBookingRef, setPreviewBookingRef] = useState<string>('');
  const [previewCustomVars, setPreviewCustomVars] = useState<Record<string, string>>(PRESET_SAMPLE_DATA);
  const [isLivePreviewDrawerOpen, setIsLivePreviewDrawerOpen] = useState(false);

  // Filtered Templates List
  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      if (channelFilter !== 'All' && t.channel !== channelFilter && t.channel !== 'Both') {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = t.name.toLowerCase().includes(q);
        const matchesKey = t.templateKey.toLowerCase().includes(q);
        const matchesBody = t.bodyText.toLowerCase().includes(q);
        const matchesVars = t.variables?.some((v) => v.toLowerCase().includes(q));
        return matchesName || matchesKey || matchesBody || matchesVars;
      }
      return true;
    });
  }, [templates, channelFilter, searchQuery]);

  // Load template into editor
  const selectTemplate = (tmpl: CommunicationTemplate) => {
    setIsCreatingNew(false);
    setSelectedTemplateId(tmpl.id || tmpl.templateKey);
    setFormName(tmpl.name);
    setFormKey(tmpl.templateKey);
    setFormChannel(tmpl.channel === 'Email' ? 'Both' : (tmpl.channel as 'WhatsApp' | 'Both'));
    setFormBodyText(tmpl.bodyText);
    setFormVariables(tmpl.variables || []);
    setFormIsActive(tmpl.isActive ?? true);
    setFormSubject(tmpl.subject || '');
  };

  // Initialize first template selection if not set
  React.useEffect(() => {
    if (!isCreatingNew && templates.length > 0) {
      const match = templates.find((t) => (t.id || t.templateKey) === selectedTemplateId) || templates[0];
      if (match) {
        selectTemplate(match);
      }
    }
  }, [templates]);

  // Start new template creation
  const handleStartCreate = () => {
    setIsCreatingNew(true);
    setSelectedTemplateId('');
    setFormName('New WhatsApp Template');
    setFormKey(`custom_wa_${Date.now().toString(36)}`);
    setFormChannel('WhatsApp');
    setFormBodyText(`Dear {{customer_name}},\n\nThis is a notification regarding your booking *{{booking_reference}}* for {{tour_name}}.\n\nYour pickup is scheduled at *{{pickup_time}}* from {{hotel}}.\n\nBest regards,\nRed Sea Voyages Team`);
    setFormVariables(['customer_name', 'booking_reference', 'tour_name', 'pickup_time', 'hotel']);
    setFormIsActive(true);
    setFormSubject('');
  };

  // Variable Tag Assignment Handlers
  const toggleVariableTag = (tag: string) => {
    setFormVariables((prev) => {
      if (prev.includes(tag)) {
        return prev.filter((t) => t !== tag);
      } else {
        return [...prev, tag];
      }
    });
  };

  const handleAddCustomTag = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = customTagInput.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (!clean) return;
    if (!formVariables.includes(clean)) {
      setFormVariables((prev) => [...prev, clean]);
      showToast(`Variable tag {{${clean}}} assigned to template`, 'info');
    }
    setCustomTagInput('');
  };

  const handleInsertTagAtCursor = (tag: string) => {
    const placeholder = `{{${tag}}}`;
    if (!textareaRef.current) {
      setFormBodyText((prev) => `${prev} ${placeholder}`);
      return;
    }
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentText = formBodyText;
    const newText = currentText.substring(0, start) + placeholder + currentText.substring(end);
    setFormBodyText(newText);

    // Ensure the tag is also listed in assigned variables
    if (!formVariables.includes(tag)) {
      setFormVariables((prev) => [...prev, tag]);
    }

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + placeholder.length, start + placeholder.length);
    }, 10);
  };

  // Save / Upsert Template
  const handleSave = async () => {
    if (!formName.trim()) {
      showToast('Template name cannot be empty', 'error');
      return;
    }
    const cleanKey = formKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (!cleanKey) {
      showToast('Template key is required and must contain alphanumeric characters or underscores', 'error');
      return;
    }
    if (!formBodyText.trim()) {
      showToast('Template body text cannot be empty', 'error');
      return;
    }

    // Auto-detect any {{variable}} inside the body that isn't yet in formVariables
    const detected = new Set(formVariables);
    const matches = formBodyText.matchAll(/\{\{([a-zA-Z0-9_]+)\}\}/g);
    for (const m of matches) {
      if (m[1]) detected.add(m[1].toLowerCase());
    }
    const finalVariables = Array.from(detected);

    setSaving(true);
    try {
      const targetId = isCreatingNew
        ? `tmpl-wa-${Date.now().toString(36)}`
        : (selectedTemplateId || `tmpl-${cleanKey}`);

      const templatePayload: CommunicationTemplate = {
        id: targetId,
        templateKey: cleanKey as TemplateKey,
        name: formName.trim(),
        channel: formChannel,
        subject: formSubject.trim() || null,
        bodyText: formBodyText.trim(),
        variables: finalVariables,
        isActive: formIsActive,
        updatedAt: new Date().toISOString(),
      };

      await saveTemplate(templatePayload);
      showToast(`Template "${formName}" saved successfully`, 'success');
      await onTemplatesUpdated();
      setIsCreatingNew(false);
      setSelectedTemplateId(targetId);
    } catch (err: any) {
      showToast(err?.message || 'Failed to save template', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Delete Template Confirmation
  const promptDelete = (tmpl: CommunicationTemplate) => {
    setTemplateToDelete(tmpl);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!templateToDelete) return;
    try {
      await deleteTemplate(templateToDelete.id || templateToDelete.templateKey);
      showToast(`Template "${templateToDelete.name}" deleted`, 'info');
      setDeleteModalOpen(false);
      setTemplateToDelete(null);
      await onTemplatesUpdated();
      setIsCreatingNew(false);
    } catch (err: any) {
      showToast(err?.message || 'Failed to delete template', 'error');
    }
  };

  // Build the active context variables for real-time preview
  const activePreviewContext = useMemo(() => {
    if (previewBookingRef) {
      const b = bookings.find((bk) => bk.bookingReference === previewBookingRef);
      if (b) {
        const total = b.pricing?.totalEur || 0;
        const paid = b.paymentStatus === 'paid' ? total : 0;
        const bal = Math.max(0, total - paid);
        const hotelName = b.pickup?.hotelName || b.customer?.hotelName || 'Hotel Reception Lobby';
        const guestName = `${b.customer?.firstName || ''} ${b.customer?.lastName || ''}`.trim() || 'Guest';
        return {
          ...PRESET_SAMPLE_DATA,
          ...previewCustomVars,
          customer_name: guestName,
          booking_reference: b.bookingReference,
          tour_name: b.tourTitle || 'Red Sea Excursion',
          tour_date: b.date || new Date().toISOString().split('T')[0],
          pickup_time: b.pickup?.pickupTime || '07:45 AM',
          hotel: hotelName,
          total: String(total.toFixed(2)),
          balance_due: String(bal.toFixed(2)),
          payment_status: b.paymentStatus || 'Pending',
          meeting_point: 'Hurghada Marina, Jetty #4',
          boat_name: 'Sea Voyager Yacht II',
          driver_name: 'Captain Mahmoud (+20 100 456 7890)',
          guide_phone: '+20 100 123 4567',
        };
      }
    }
    return {
      ...PRESET_SAMPLE_DATA,
      ...previewCustomVars,
    };
  }, [previewBookingRef, bookings, previewCustomVars]);

  // Real-time rendered preview text
  const renderedMessageText = useMemo(() => {
    return renderTemplateVariables(formBodyText, activePreviewContext as any);
  }, [formBodyText, activePreviewContext]);

  // Check for any unpopulated placeholders (e.g. {{unknown_tag}})
  const missingPlaceholders = useMemo(() => {
    const unpopulated: string[] = [];
    const matches = renderedMessageText.matchAll(/\{\{([a-zA-Z0-9_]+)\}\}/g);
    for (const m of matches) {
      if (m[1]) unpopulated.push(m[1]);
    }
    return Array.from(new Set(unpopulated));
  }, [renderedMessageText]);

  // Format message text with WhatsApp bold/italics
  const renderFormattedWhatsApp = (text: string) => {
    if (!text) return <span className="text-stone-500 italic">No message content drafted yet...</span>;

    // Split paragraphs
    return text.split('\n').map((line, lineIdx) => {
      // Basic formatting parser for *bold* and _italic_
      const parts = line.split(/(\*[^*]+\*|_[^_]+_|~[^~]+~)/g);
      return (
        <span key={lineIdx} className="block min-h-[1.25em]">
          {parts.map((part, partIdx) => {
            if (part.startsWith('*') && part.endsWith('*')) {
              return <strong key={partIdx} className="font-bold text-white">{part.slice(1, -1)}</strong>;
            }
            if (part.startsWith('_') && part.endsWith('_')) {
              return <em key={partIdx} className="italic text-stone-300">{part.slice(1, -1)}</em>;
            }
            if (part.startsWith('~') && part.endsWith('~')) {
              return <del key={partIdx} className="line-through text-stone-400">{part.slice(1, -1)}</del>;
            }
            // Check if placeholder wasn't substituted
            if (part.includes('{{') && part.includes('}}')) {
              return (
                <span key={partIdx} className="bg-amber-500/20 text-amber-300 px-1 rounded border border-amber-500/40 font-mono text-[11px]">
                  {part}
                </span>
              );
            }
            return part;
          })}
        </span>
      );
    });
  };

  const handleCopyPreview = () => {
    navigator.clipboard.writeText(renderedMessageText);
    setCopiedPreview(true);
    showToast('Substituted WhatsApp message copied to clipboard', 'info');
    setTimeout(() => setCopiedPreview(false), 2000);
  };

  const handleOpenTestWebChat = () => {
    const url = getWhatsAppDirectUrl('+201004567890', renderedMessageText);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-stone-900 border border-stone-800 p-5 rounded-xl shadow-lg">
        <div>
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <Sliders className="w-4 h-4 text-emerald-400" />
            WhatsApp Template Manager
          </h2>
          <p className="text-xs text-stone-400 mt-0.5">
            Create, edit, and assign dynamic variable tags to WhatsApp message definitions. Real-time preview guarantees exact guest rendering.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleStartCreate}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow transition-all active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Template</span>
          </button>
        </div>
      </div>

      {/* Main 3-Column Workstation: Template Index | Editor & Variables | Real-Time Dynamic Preview */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* ============================================================== */}
        {/* COLUMN 1: TEMPLATE BROWSER & LIST (3 Cols on XL)               */}
        {/* ============================================================== */}
        <div className="xl:col-span-3 bg-stone-900 border border-stone-800 rounded-xl p-4 shadow-lg flex flex-col space-y-3">
          <div className="flex items-center justify-between border-b border-stone-800 pb-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-semibold text-white">Templates Library</span>
            </div>
            <span className="text-[11px] text-stone-400 font-mono">
              {filteredTemplates.length} total
            </span>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-stone-500" />
            <input
              type="text"
              placeholder="Search by name, key, or tag..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-stone-950 border border-stone-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-stone-600 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Channel Filter Pill */}
          <div className="flex items-center gap-1 p-1 bg-stone-950 border border-stone-800 rounded-lg text-[11px]">
            {(['All', 'WhatsApp', 'Both'] as const).map((ch) => (
              <button
                key={ch}
                type="button"
                onClick={() => setChannelFilter(ch)}
                className={`flex-1 py-1 rounded font-medium transition-colors ${
                  channelFilter === ch ? 'bg-stone-800 text-emerald-400 shadow-sm' : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                {ch}
              </button>
            ))}
          </div>

          {/* Scrollable Templates List */}
          <div className="space-y-1.5 max-h-[580px] overflow-y-auto pr-1">
            {filteredTemplates.map((t) => {
              const isSelected = !isCreatingNew && (t.id === selectedTemplateId || t.templateKey === selectedTemplateId);
              return (
                <div
                  key={t.id || t.templateKey}
                  onClick={() => selectTemplate(t)}
                  className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-emerald-950/30 border-emerald-500/50 text-white shadow-sm ring-1 ring-emerald-500/20'
                      : 'bg-stone-950/60 border-stone-800/80 text-stone-300 hover:bg-stone-800/60 hover:border-stone-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <h3 className="text-xs font-semibold leading-snug line-clamp-1">{t.name}</h3>
                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                        t.isActive
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-stone-800 text-stone-500 border border-stone-700'
                      }`}
                    >
                      {t.isActive ? 'Active' : 'Disabled'}
                    </span>
                  </div>

                  <p className="text-[10px] text-stone-500 font-mono mt-0.5 line-clamp-1">
                    {t.templateKey}
                  </p>

                  <div className="flex items-center justify-between text-[10px] text-stone-400 mt-2 pt-2 border-t border-stone-800/60">
                    <span className="flex items-center gap-1">
                      <Tag className="w-2.5 h-2.5 text-stone-500" />
                      {t.variables?.length || 0} tags
                    </span>
                    <span className="text-[10px] text-stone-500">{t.channel}</span>
                  </div>
                </div>
              );
            })}

            {filteredTemplates.length === 0 && (
              <div className="text-center py-8 text-xs text-stone-500">
                No matching templates found.
              </div>
            )}
          </div>
        </div>

        {/* ============================================================== */}
        {/* COLUMN 2: TEMPLATE DEFINITION EDITOR (5 Cols on XL)            */}
        {/* ============================================================== */}
        <div className="xl:col-span-5 bg-stone-900 border border-stone-800 rounded-xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-stone-800 pb-3">
            <div>
              <h2 className="text-xs font-semibold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-400" />
                {isCreatingNew ? 'Create New Template Definition' : 'Edit Template Definition'}
              </h2>
              <span className="text-[10px] text-stone-500">
                {isCreatingNew ? 'Define a reusable WhatsApp message with variable tags' : `Editing template key: ${formKey}`}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {!isCreatingNew && (
                <button
                  type="button"
                  onClick={() => {
                    const current = templates.find((t) => (t.id || t.templateKey) === selectedTemplateId);
                    if (current) promptDelete(current);
                  }}
                  className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg border border-transparent hover:border-rose-500/20 transition-colors"
                  title="Delete Template Definition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}

              {onSelectForDispatch && !isCreatingNew && (
                <button
                  type="button"
                  onClick={() => onSelectForDispatch(formKey)}
                  className="flex items-center gap-1 px-2.5 py-1 bg-stone-800 hover:bg-stone-700 text-emerald-400 hover:text-emerald-300 rounded-lg text-xs font-medium border border-stone-700 transition-colors"
                  title="Switch to dispatcher with this template selected"
                >
                  <Send className="w-3 h-3" />
                  <span>Use to Send</span>
                </button>
              )}
            </div>
          </div>

          {/* Form Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-stone-400 mb-1">
                Template Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => {
                  setFormName(e.target.value);
                  if (isCreatingNew) {
                    setFormKey(e.target.value.toLowerCase().trim().replace(/[^a-z0-9_]/g, '_'));
                  }
                }}
                placeholder="e.g. Morning Pier Logistics & Pickup"
                className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-xs text-white placeholder-stone-600 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-stone-400 mb-1">
                Template Key / Identifier <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={formKey}
                onChange={(e) => setFormKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                placeholder="e.g. morning_pier_logistics"
                className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-xs text-white font-mono placeholder-stone-600 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-stone-400 mb-1">
                Channel Scope
              </label>
              <select
                value={formChannel}
                onChange={(e) => setFormChannel(e.target.value as 'WhatsApp' | 'Both')}
                className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="WhatsApp">WhatsApp Only</option>
                <option value="Both">Both (WhatsApp & Email)</option>
              </select>
            </div>

            <div className="flex items-center justify-between p-2.5 bg-stone-950 border border-stone-800 rounded-lg mt-auto">
              <div>
                <span className="block text-xs font-medium text-white">Active Status</span>
                <span className="text-[10px] text-stone-500">Available for manual dispatch</span>
              </div>
              <input
                type="checkbox"
                checked={formIsActive}
                onChange={(e) => setFormIsActive(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded bg-stone-900 border-stone-700 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Variable Tags Management */}
          <div className="p-3 bg-stone-950/70 border border-stone-800 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-stone-200 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-emerald-400" />
                Assigned Variable Tags ({formVariables.length})
              </span>
              <span className="text-[10px] text-stone-500">
                Click a tag to insert into message body
              </span>
            </div>

            {/* Currently Assigned Tags with Insert Action */}
            <div className="flex flex-wrap gap-1.5 min-h-[32px] p-2 bg-stone-900/80 rounded-lg border border-stone-800/80">
              {formVariables.map((v) => (
                <div
                  key={v}
                  className="group inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-950/40 text-emerald-300 border border-emerald-500/30 rounded text-[11px] font-mono hover:border-emerald-500 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => handleInsertTagAtCursor(v)}
                    className="hover:underline flex items-center gap-1"
                    title={`Click to insert {{${v}}} at cursor`}
                  >
                    <span>+{`{{${v}}}`}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleVariableTag(v)}
                    className="text-stone-500 hover:text-rose-400 ml-1"
                    title="Remove variable tag"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              ))}

              {formVariables.length === 0 && (
                <span className="text-[11px] text-stone-500 italic">
                  No variable tags assigned yet. Select from common tags below or add custom tags.
                </span>
              )}
            </div>

            {/* Quick Picker from Common Tags */}
            <div className="space-y-1">
              <span className="text-[10px] text-stone-400 font-medium block">
                Assign Standard Variables:
              </span>
              <div className="flex flex-wrap gap-1">
                {COMMON_VARIABLE_TAGS.map((item) => {
                  const isAssigned = formVariables.includes(item.tag);
                  return (
                    <button
                      key={item.tag}
                      type="button"
                      onClick={() => toggleVariableTag(item.tag)}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
                        isAssigned
                          ? 'bg-stone-800 text-emerald-400 border border-emerald-500/40'
                          : 'bg-stone-900/60 text-stone-400 border border-stone-800 hover:text-stone-200 hover:border-stone-700'
                      }`}
                      title={item.desc}
                    >
                      {isAssigned ? '✓ ' : '+ '}
                      {item.tag}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Variable Tag Input */}
            <form onSubmit={handleAddCustomTag} className="flex items-center gap-2 pt-1">
              <input
                type="text"
                placeholder="Add custom tag (e.g. cabin_deck, dive_site)..."
                value={customTagInput}
                onChange={(e) => setCustomTagInput(e.target.value)}
                className="flex-1 bg-stone-900 border border-stone-800 rounded px-2.5 py-1 text-xs text-white placeholder-stone-600 focus:outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                disabled={!customTagInput.trim()}
                className="px-2.5 py-1 bg-stone-800 hover:bg-stone-700 disabled:opacity-40 text-stone-200 text-xs font-medium rounded border border-stone-700 transition-colors"
              >
                Add Tag
              </button>
            </form>
          </div>

          {/* Message Body Textarea */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-medium text-stone-400">
                WhatsApp Message Content <span className="text-rose-400">*</span>
              </label>
              <div className="flex items-center gap-3 text-[10px] text-stone-500 font-mono">
                <span>{formBodyText.length} characters</span>
                <span className="hidden sm:inline">Use *bold*, _italic_, ~strike~</span>
              </div>
            </div>

            <textarea
              ref={textareaRef}
              rows={11}
              value={formBodyText}
              onChange={(e) => setFormBodyText(e.target.value)}
              placeholder="Draft your WhatsApp template message with dynamic {{variables}}..."
              className="w-full bg-stone-950 border border-stone-800 rounded-lg p-3 text-xs text-stone-200 placeholder-stone-600 font-sans leading-relaxed focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
            />
          </div>

          {/* Save / Reset Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-stone-800">
            <button
              type="button"
              onClick={() => {
                if (isCreatingNew && templates[0]) {
                  selectTemplate(templates[0]);
                } else {
                  const current = templates.find((t) => (t.id || t.templateKey) === selectedTemplateId);
                  if (current) selectTemplate(current);
                }
              }}
              className="px-3 py-1.5 text-xs text-stone-400 hover:text-stone-200 transition-colors"
            >
              Reset Changes
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className={`flex items-center gap-1.5 px-5 py-2 rounded-lg font-semibold text-xs shadow-md transition-all ${
                saving
                  ? 'bg-stone-700 text-stone-400 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white active:scale-95'
              }`}
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving Definition...' : isCreatingNew ? 'Create Template' : 'Save Changes'}</span>
            </button>
          </div>
        </div>

        {/* ============================================================== */}
        {/* COLUMN 3: REAL-TIME DYNAMIC WHATSAPP PREVIEW (4 Cols on XL)    */}
        {/* ============================================================== */}
        <div className="xl:col-span-4 bg-stone-900 border border-stone-800 rounded-xl p-5 shadow-lg flex flex-col space-y-4">
          <div className="flex items-center justify-between border-b border-stone-800 pb-3">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-emerald-400" />
              <h2 className="text-xs font-semibold text-white">Dynamic Real-Time Preview</h2>
            </div>
            <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live Substituted
            </span>
          </div>

          {/* Context Switching Toolbar */}
          <div className="space-y-2">
            <div>
              <label className="block text-[10px] font-medium text-stone-400 mb-1">
                Preview with Real Guest Context:
              </label>
              <select
                value={previewBookingRef}
                onChange={(e) => setPreviewBookingRef(e.target.value)}
                className="w-full bg-stone-950 border border-stone-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="">-- Preset VIP Sample Guest --</option>
                {bookings.slice(0, 15).map((b) => (
                  <option key={b.bookingReference} value={b.bookingReference}>
                    {b.bookingReference} - {b.customer?.firstName} {b.customer?.lastName} ({b.tourTitle?.substring(0, 20)}...)
                  </option>
                ))}
              </select>
            </div>

            {/* Unsubstituted Warning Banner */}
            {missingPlaceholders.length > 0 && (
              <div className="p-2.5 bg-amber-950/40 border border-amber-500/30 rounded-lg text-[11px] text-amber-300 flex items-start gap-2">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Unresolved Placeholders: </span>
                  <span>{missingPlaceholders.map((p) => `{{${p}}}`).join(', ')}</span>
                  <p className="text-[10px] text-amber-400/80 mt-0.5">
                    These tags have no matching property in the current preview context and will appear raw if unpopulated.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Smartphone WhatsApp Mockup Frame */}
          <div className="bg-[#0b141a] border-2 border-[#202c33] rounded-2xl overflow-hidden shadow-2xl flex-1 flex flex-col min-h-[380px]">
            {/* WhatsApp Header Bar */}
            <div className="bg-[#1f2c34] p-3 border-b border-[#2a3942] flex items-center justify-between text-white">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center font-bold text-xs">
                  {activePreviewContext.customer_name?.charAt(0) || 'G'}
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-stone-100 line-clamp-1">
                    {activePreviewContext.customer_name || 'Guest'}
                  </h4>
                  <span className="text-[10px] text-emerald-400 block -mt-0.5">online</span>
                </div>
              </div>
              <div className="text-[10px] font-mono text-[#8696a0]">
                {activePreviewContext.booking_reference || 'RSV-DRAFT'}
              </div>
            </div>

            {/* Chat Messages Area with WhatsApp Dark Background */}
            <div className="flex-1 p-3.5 flex flex-col justify-end space-y-2 bg-[radial-gradient(#1e2b33_1px,transparent_1px)] [background-size:16px_16px]">
              
              {/* Context Pill in chat */}
              <div className="self-center bg-[#182229] border border-[#222e35] text-[#8696a0] text-[9px] px-2 py-0.5 rounded shadow">
                TODAY · EXCURSION DISPATCH
              </div>

              {/* Dynamic Chat Bubble */}
              <div className="bg-[#005c4b] text-[#e9edef] rounded-xl rounded-tr-none p-3.5 max-w-[92%] self-end text-xs shadow-md space-y-1.5 border border-[#00705b]">
                <div className="text-xs leading-relaxed break-words font-sans">
                  {renderFormattedWhatsApp(renderedMessageText)}
                </div>

                <div className="flex items-center justify-end space-x-1 text-[10px] text-[#8696a0] pt-1 border-t border-[#006e59]/40">
                  <span>10:45 AM</span>
                  <span className="text-[#53bdeb] font-bold" title="Read receipt (double tick)">✓✓</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Utility Bar Under Preview */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={handleCopyPreview}
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-medium rounded-lg border border-stone-700 transition-colors"
            >
              {copiedPreview ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-stone-400" />}
              <span>{copiedPreview ? 'Copied!' : 'Copy Text'}</span>
            </button>

            <button
              type="button"
              onClick={handleOpenTestWebChat}
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-stone-800 hover:bg-stone-700 text-emerald-400 hover:text-emerald-300 text-xs font-medium rounded-lg border border-stone-700 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Test on Web</span>
            </button>
          </div>
        </div>

      </div>

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && templateToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Delete WhatsApp Template?</h3>
                <p className="text-xs text-stone-400">
                  Are you sure you want to delete &ldquo;{templateToDelete.name}&rdquo; ({templateToDelete.templateKey})?
                </p>
              </div>
            </div>

            <p className="text-xs text-stone-300 bg-stone-950 p-3 rounded-lg border border-stone-800">
              This definition will be removed from your dispatch console. Historical dispatched messages referencing this template will remain in logs.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-lg shadow transition-colors"
              >
                Delete Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
