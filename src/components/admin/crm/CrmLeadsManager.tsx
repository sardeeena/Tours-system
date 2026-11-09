import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Plus,
  Search,
  Filter,
  Kanban,
  List,
  Calendar,
  Clock,
  DollarSign,
  Phone,
  Mail,
  Hotel,
  ArrowRight,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Edit2,
  Trash2,
  UserCheck,
  ChevronRight,
  RefreshCw,
  Send,
  MessageCircle,
} from 'lucide-react';
import {
  listLeads,
  createLead,
  updateLeadStage,
  updateLead,
  deleteLead,
  convertLeadToCustomer,
  CrmLead,
} from '../../../services/crmService';
import { LeadStage, LeadSource } from '../../../types/crm';
import { useToast } from '../../../contexts/ToastContext';

const STAGES: LeadStage[] = [
  'New',
  'Contacted',
  'Interested',
  'Quotation Sent',
  'Booking Pending',
  'Booked',
  'Completed',
  'Lost',
];

const SOURCES: LeadSource[] = [
  'Website',
  'WhatsApp',
  'Facebook',
  'Instagram',
  'Google',
  'Phone',
  'Email',
  'Hotel',
  'Referral',
  'Walk-in',
  'Other',
];

const STAFF_MEMBERS = [
  'Captain Tarek',
  'Mona Zaki (Concierge)',
  'Ahmed Fathy',
  'Captain Farouk',
  'Youssef Marina Desk',
];

export const CrmLeadsManager: React.FC = () => {
  const { showToast } = useToast();
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<'all' | LeadStage>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | LeadSource>('all');
  const [staffFilter, setStaffFilter] = useState<string>('all');

  // Modal states
  const [isNewLeadOpen, setIsNewLeadOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<CrmLead | null>(null);
  const [leadToDelete, setLeadToDelete] = useState<CrmLead | null>(null);

  // New/Edit form state
  const [formData, setFormData] = useState<Partial<CrmLead>>({
    name: '',
    email: '',
    phone: '',
    whatsapp: '',
    country: '',
    hotel: '',
    source: 'Website',
    interestedTourTitle: '',
    travelDate: '',
    numberOfGuests: 2,
    estimatedValue: 150,
    currency: 'EUR',
    stage: 'New',
    notes: '',
    assignedStaffName: STAFF_MEMBERS[0],
    followUpDate: '',
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await listLeads();
      setLeads(data);
    } catch (err) {
      console.warn('Failed to load leads:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredLeads = useMemo(() => {
    return leads.filter((l) => {
      if (stageFilter !== 'all' && l.stage !== stageFilter) return false;
      if (sourceFilter !== 'all' && l.source !== sourceFilter) return false;
      if (staffFilter !== 'all' && l.assignedStaffName !== staffFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          l.name.toLowerCase().includes(q) ||
          l.email.toLowerCase().includes(q) ||
          (l.phone && l.phone.includes(q)) ||
          (l.hotel && l.hotel.toLowerCase().includes(q)) ||
          (l.interestedTourTitle && l.interestedTourTitle.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [leads, stageFilter, sourceFilter, staffFilter, searchQuery]);

  const handleStageChange = async (leadId: string, newStage: LeadStage) => {
    let lostReason: string | undefined = undefined;
    if (newStage === 'Lost') {
      lostReason = window.prompt('Please enter the reason for marking this lead as Lost (e.g. Price too high, Travel cancelled, Booked elsewhere):') || 'Unspecified';
    }

    await updateLeadStage(leadId, newStage, lostReason);
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, stage: newStage, lostReason } : l))
    );
    showToast(`Lead moved to stage "${newStage}".`, 'success');
  };

  const handleSaveLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) {
      showToast('Lead name is required.', 'error');
      return;
    }

    try {
      if (selectedLead) {
        await updateLead(selectedLead.id, formData);
        showToast('Lead details updated successfully.', 'success');
      } else {
        await createLead(formData);
        showToast('New lead created and added to pipeline.', 'success');
      }
      setIsNewLeadOpen(false);
      setSelectedLead(null);
      await loadData();
    } catch (err: any) {
      showToast(err.message || 'Error saving lead', 'error');
    }
  };

  const handleConvertToCustomer = async (lead: CrmLead) => {
    try {
      await convertLeadToCustomer(lead.id);
      showToast(`Lead "${lead.name}" converted into customer record!`, 'success');
      await loadData();
    } catch (err: any) {
      showToast(err.message || 'Conversion failed', 'error');
    }
  };

  const handleConfirmDelete = async () => {
    if (!leadToDelete) return;
    await deleteLead(leadToDelete.id);
    setLeads((prev) => prev.filter((l) => l.id !== leadToDelete.id));
    showToast(`Lead "${leadToDelete.name}" deleted.`, 'info');
    setLeadToDelete(null);
  };

  const openEditModal = (lead: CrmLead) => {
    setSelectedLead(lead);
    setFormData({
      name: lead.name,
      email: lead.email,
      phone: lead.phone || '',
      whatsapp: lead.whatsapp || '',
      country: lead.country || '',
      hotel: lead.hotel || '',
      source: lead.source,
      interestedTourTitle: lead.interestedTourTitle || '',
      travelDate: lead.travelDate || '',
      numberOfGuests: lead.numberOfGuests,
      estimatedValue: lead.estimatedValue,
      currency: lead.currency,
      stage: lead.stage,
      notes: lead.notes || '',
      assignedStaffName: lead.assignedStaffName || STAFF_MEMBERS[0],
      followUpDate: lead.followUpDate || '',
    });
    setIsNewLeadOpen(true);
  };

  const openCreateModal = () => {
    setSelectedLead(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      whatsapp: '',
      country: '',
      hotel: '',
      source: 'Website',
      interestedTourTitle: '',
      travelDate: '',
      numberOfGuests: 2,
      estimatedValue: 200,
      currency: 'EUR',
      stage: 'New',
      notes: '',
      assignedStaffName: STAFF_MEMBERS[0],
      followUpDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    });
    setIsNewLeadOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] uppercase tracking-widest text-[#2dd4bf] font-bold block mb-0.5">
            Sales & Conversions
          </span>
          <h1 className="text-2xl font-bold font-display text-white tracking-tight flex items-center space-x-2">
            <Users className="w-6 h-6 text-[#2dd4bf]" />
            <span>Leads & Inquiries Pipeline</span>
          </h1>
          <p className="text-xs text-stone-400 mt-1">
            Track prospective travelers from initial touchpoint through quotation, booking, and arrival.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View Toggle */}
          <div className="inline-flex rounded-lg border border-stone-800 bg-stone-900 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer ${
                viewMode === 'kanban'
                  ? 'bg-[#0A6C74] text-white shadow'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              <Kanban className="w-3.5 h-3.5" />
              <span>Kanban</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-[#0A6C74] text-white shadow'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
          </div>

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="p-2 bg-stone-900 border border-stone-800 text-stone-300 hover:text-white rounded text-xs transition-colors cursor-pointer"
            title="Refresh Leads"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center space-x-1.5 px-4 py-2 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded text-xs font-semibold shadow transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Lead</span>
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-stone-950 border border-stone-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search leads, hotel, tour, or email..."
            className="w-full pl-9 pr-3 py-1.5 bg-stone-900 border border-stone-800 rounded text-stone-200 placeholder-stone-500 focus:outline-none focus:border-[#0A6C74]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Stage Filter */}
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value as any)}
            className="px-2.5 py-1.5 bg-stone-900 border border-stone-800 rounded text-stone-300 focus:outline-none focus:border-[#0A6C74]"
          >
            <option value="all">All Stages</option>
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          {/* Source Filter */}
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as any)}
            className="px-2.5 py-1.5 bg-stone-900 border border-stone-800 rounded text-stone-300 focus:outline-none focus:border-[#0A6C74]"
          >
            <option value="all">All Sources</option>
            {SOURCES.map((src) => (
              <option key={src} value={src}>
                {src}
              </option>
            ))}
          </select>

          {/* Staff Filter */}
          <select
            value={staffFilter}
            onChange={(e) => setStaffFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-stone-900 border border-stone-800 rounded text-stone-300 focus:outline-none focus:border-[#0A6C74]"
          >
            <option value="all">All Staff</option>
            {STAFF_MEMBERS.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main View Area */}
      {loading ? (
        <div className="p-16 text-center text-stone-400">
          <div className="w-8 h-8 border-2 border-[#0A6C74] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs">Loading sales pipeline...</p>
        </div>
      ) : viewMode === 'kanban' ? (
        /* KANBAN BOARD */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-8 gap-3 overflow-x-auto pb-4">
          {STAGES.map((stage) => {
            const stageLeads = filteredLeads.filter((l) => l.stage === stage);
            const totalStageValue = stageLeads.reduce((s, l) => s + (l.estimatedValue || 0), 0);

            return (
              <div
                key={stage}
                className="bg-stone-950 border border-stone-800 rounded-xl p-3 flex flex-col justify-between min-h-[420px]"
              >
                <div>
                  {/* Column Header */}
                  <div className="flex items-center justify-between border-b border-stone-800/80 pb-2 mb-3">
                    <div>
                      <h3 className="font-bold text-xs text-white truncate">{stage}</h3>
                      <span className="text-[10px] text-stone-500 font-mono">
                        €{totalStageValue.toLocaleString()} &bull; {stageLeads.length} lead{stageLeads.length === 1 ? '' : 's'}
                      </span>
                    </div>
                  </div>

                  {/* Cards Container */}
                  <div className="space-y-2.5">
                    {stageLeads.length === 0 ? (
                      <div className="p-4 text-center text-stone-600 border border-dashed border-stone-800/60 rounded-lg text-[10px]">
                        No leads in {stage}
                      </div>
                    ) : (
                      stageLeads.map((lead) => (
                        <div
                          key={lead.id}
                          className="bg-stone-900 border border-stone-800 hover:border-stone-700 rounded-lg p-3 space-y-2 text-xs transition-all shadow-xs group"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-white truncate text-[11px]">
                              {lead.name}
                            </span>
                            <span className="text-[10px] font-mono text-emerald-400 font-semibold">
                              €{lead.estimatedValue}
                            </span>
                          </div>

                          {lead.interestedTourTitle && (
                            <p className="text-stone-300 text-[10px] font-medium truncate">
                              🎯 {lead.interestedTourTitle}
                            </p>
                          )}

                          <div className="space-y-1 text-[10px] text-stone-400 font-mono">
                            {lead.hotel && (
                              <div className="truncate flex items-center space-x-1">
                                <Hotel className="w-3 h-3 text-stone-500 shrink-0" />
                                <span className="truncate">{lead.hotel}</span>
                              </div>
                            )}
                            {lead.travelDate && (
                              <div className="flex items-center space-x-1">
                                <Calendar className="w-3 h-3 text-stone-500 shrink-0" />
                                <span>Travel: {lead.travelDate}</span>
                              </div>
                            )}
                            <div className="flex items-center justify-between text-stone-500 pt-1">
                              <span className="px-1.5 py-0.5 rounded bg-stone-800 text-[9px] text-stone-300">
                                {lead.source}
                              </span>
                              <span>{lead.assignedStaffName?.split(' ')[0] || 'Unassigned'}</span>
                            </div>
                          </div>

                          {/* Quick Actions Footer */}
                          <div className="pt-2 border-t border-stone-800/80 flex items-center justify-between text-[10px]">
                            {/* WhatsApp link if available */}
                            {lead.whatsapp && (
                              <a
                                href={`https://wa.me/${lead.whatsapp.replace(/[^0-9]/g, '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-emerald-400 hover:text-emerald-300 flex items-center space-x-1"
                                title="Chat on WhatsApp"
                              >
                                <MessageCircle className="w-3 h-3" />
                                <span>WhatsApp</span>
                              </a>
                            )}

                            <div className="flex items-center space-x-1 ml-auto">
                              <button
                                type="button"
                                onClick={() => openEditModal(lead)}
                                className="p-1 text-stone-400 hover:text-white rounded hover:bg-stone-800"
                                title="Edit Lead"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>

                              {lead.stage !== 'Booked' && (
                                <button
                                  type="button"
                                  onClick={() => handleConvertToCustomer(lead)}
                                  className="px-1.5 py-0.5 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded text-[9px] font-semibold"
                                  title="Convert to Customer & Booked"
                                >
                                  Convert
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Advance stage dropdown */}
                          <div className="pt-1">
                            <select
                              value={lead.stage}
                              onChange={(e) => handleStageChange(lead.id, e.target.value as LeadStage)}
                              className="w-full text-[10px] py-1 px-1.5 bg-stone-950 border border-stone-800 rounded text-stone-300 focus:outline-none"
                            >
                              {STAGES.map((s) => (
                                <option key={s} value={s}>
                                  Move &rarr; {s}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE LIST VIEW */
        <div className="bg-stone-950 border border-stone-800 rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-900 border-b border-stone-800 text-stone-400 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Lead Name</th>
                  <th className="py-3 px-4">Interested Tour & Travel</th>
                  <th className="py-3 px-4">Hotel / Location</th>
                  <th className="py-3 px-4">Source</th>
                  <th className="py-3 px-4">Est. Value</th>
                  <th className="py-3 px-4">Stage</th>
                  <th className="py-3 px-4">Assigned Staff</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800/80">
                {filteredLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-stone-900/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white">{lead.name}</div>
                      <div className="text-[10px] text-stone-400">{lead.email}</div>
                      {lead.phone && <div className="text-[10px] text-stone-500">{lead.phone}</div>}
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-medium text-stone-200">
                        {lead.interestedTourTitle || 'General Catalog Inquiry'}
                      </div>
                      <div className="text-[10px] text-stone-400">
                        {lead.travelDate ? `Date: ${lead.travelDate}` : 'Date TBD'} &bull; {lead.numberOfGuests} guests
                      </div>
                    </td>

                    <td className="py-3 px-4 text-stone-300">
                      <div>{lead.hotel || 'Not specified'}</div>
                      <div className="text-[10px] text-stone-500">{lead.country || 'International'}</div>
                    </td>

                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-stone-900 text-stone-300 border border-stone-800">
                        {lead.source}
                      </span>
                    </td>

                    <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                      €{lead.estimatedValue}
                    </td>

                    <td className="py-3 px-4">
                      <select
                        value={lead.stage}
                        onChange={(e) => handleStageChange(lead.id, e.target.value as LeadStage)}
                        className="text-[11px] py-1 px-2 bg-stone-900 border border-stone-800 rounded text-stone-200 focus:outline-none"
                      >
                        {STAGES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="py-3 px-4 text-stone-300">
                      {lead.assignedStaffName || 'Unassigned'}
                    </td>

                    <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => openEditModal(lead)}
                        className="p-1.5 text-stone-400 hover:text-white rounded hover:bg-stone-800 cursor-pointer"
                        title="Edit lead"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      {lead.stage !== 'Booked' && (
                        <button
                          type="button"
                          onClick={() => handleConvertToCustomer(lead)}
                          className="px-2 py-1 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded text-[10px] font-semibold cursor-pointer"
                        >
                          Convert
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setLeadToDelete(lead)}
                        className="p-1.5 text-red-400 hover:text-red-300 rounded hover:bg-red-950 cursor-pointer"
                        title="Delete lead"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE / EDIT LEAD MODAL */}
      {isNewLeadOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-xl max-w-2xl w-full p-6 space-y-4 shadow-2xl text-xs max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <Users className="w-4 h-4 text-[#2dd4bf]" />
                <span>{selectedLead ? 'Edit Lead Details' : 'Create New Lead Opportunity'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsNewLeadOpen(false)}
                className="text-stone-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveLead} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-300 font-semibold mb-1">Traveler Full Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Sarah Jenkins"
                    className="w-full px-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-white focus:outline-none focus:border-[#0A6C74]"
                  />
                </div>

                <div>
                  <label className="block text-stone-300 font-semibold mb-1">Email Address</label>
                  <input
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="sarah.jenkins@gmail.com"
                    className="w-full px-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-white focus:outline-none focus:border-[#0A6C74]"
                  />
                </div>

                <div>
                  <label className="block text-stone-300 font-semibold mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={formData.phone || ''}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+44 7911 123456"
                    className="w-full px-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-white focus:outline-none focus:border-[#0A6C74]"
                  />
                </div>

                <div>
                  <label className="block text-stone-300 font-semibold mb-1">WhatsApp Number</label>
                  <input
                    type="tel"
                    value={formData.whatsapp || ''}
                    onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                    placeholder="+44 7911 123456"
                    className="w-full px-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-white focus:outline-none focus:border-[#0A6C74]"
                  />
                </div>

                <div>
                  <label className="block text-stone-300 font-semibold mb-1">Country / Nationality</label>
                  <input
                    type="text"
                    value={formData.country || ''}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    placeholder="e.g. United Kingdom"
                    className="w-full px-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-white focus:outline-none focus:border-[#0A6C74]"
                  />
                </div>

                <div>
                  <label className="block text-stone-300 font-semibold mb-1">Hotel / Resort</label>
                  <input
                    type="text"
                    value={formData.hotel || ''}
                    onChange={(e) => setFormData({ ...formData, hotel: e.target.value })}
                    placeholder="e.g. Steigenberger ALDAU Beach Hotel"
                    className="w-full px-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-white focus:outline-none focus:border-[#0A6C74]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-stone-800">
                <div>
                  <label className="block text-stone-300 font-semibold mb-1">Lead Source</label>
                  <select
                    value={formData.source || 'Website'}
                    onChange={(e) => setFormData({ ...formData, source: e.target.value as any })}
                    className="w-full px-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-white focus:outline-none focus:border-[#0A6C74]"
                  >
                    {SOURCES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-stone-300 font-semibold mb-1">Pipeline Stage</label>
                  <select
                    value={formData.stage || 'New'}
                    onChange={(e) => setFormData({ ...formData, stage: e.target.value as any })}
                    className="w-full px-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-white focus:outline-none focus:border-[#0A6C74]"
                  >
                    {STAGES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-stone-300 font-semibold mb-1">Assigned Staff</label>
                  <select
                    value={formData.assignedStaffName || STAFF_MEMBERS[0]}
                    onChange={(e) => setFormData({ ...formData, assignedStaffName: e.target.value })}
                    className="w-full px-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-white focus:outline-none focus:border-[#0A6C74]"
                  >
                    {STAFF_MEMBERS.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-stone-300 font-semibold mb-1">Interested Tour / Excursion</label>
                  <input
                    type="text"
                    value={formData.interestedTourTitle || ''}
                    onChange={(e) => setFormData({ ...formData, interestedTourTitle: e.target.value })}
                    placeholder="e.g. Giftun Island VIP Yacht & Snorkeling"
                    className="w-full px-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-white focus:outline-none focus:border-[#0A6C74]"
                  />
                </div>

                <div>
                  <label className="block text-stone-300 font-semibold mb-1">Travel Date</label>
                  <input
                    type="date"
                    value={formData.travelDate || ''}
                    onChange={(e) => setFormData({ ...formData, travelDate: e.target.value })}
                    className="w-full px-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-white focus:outline-none focus:border-[#0A6C74]"
                  />
                </div>

                <div>
                  <label className="block text-stone-300 font-semibold mb-1">Guests</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.numberOfGuests || 1}
                    onChange={(e) => setFormData({ ...formData, numberOfGuests: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-white focus:outline-none focus:border-[#0A6C74]"
                  />
                </div>

                <div>
                  <label className="block text-stone-300 font-semibold mb-1">Estimated Value (€)</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.estimatedValue || 0}
                    onChange={(e) => setFormData({ ...formData, estimatedValue: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-white focus:outline-none focus:border-[#0A6C74]"
                  />
                </div>

                <div>
                  <label className="block text-stone-300 font-semibold mb-1">Follow-up Due Date</label>
                  <input
                    type="date"
                    value={formData.followUpDate ? formData.followUpDate.split('T')[0] : ''}
                    onChange={(e) => setFormData({ ...formData, followUpDate: e.target.value })}
                    className="w-full px-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-white focus:outline-none focus:border-[#0A6C74]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-stone-300 font-semibold mb-1">Staff Notes & Preferences</label>
                <textarea
                  rows={2}
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="e.g. Vegetarian lunch requested, prefers morning departure."
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded text-white focus:outline-none focus:border-[#0A6C74]"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsNewLeadOpen(false)}
                  className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded font-semibold cursor-pointer shadow"
                >
                  {selectedLead ? 'Update Lead' : 'Create Lead'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {leadToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-xl max-w-sm w-full p-6 space-y-4 shadow-2xl text-xs">
            <h3 className="text-sm font-bold text-white">Delete Lead</h3>
            <p className="text-stone-300">
              Are you sure you want to permanently delete lead{' '}
              <strong className="text-white">"{leadToDelete.name}"</strong>?
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-stone-800">
              <button
                type="button"
                onClick={() => setLeadToDelete(null)}
                className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded font-semibold cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
