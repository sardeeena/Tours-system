import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Search,
  Edit2,
  Trash2,
  Star,
  RefreshCw,
  Phone,
  Mail,
  ShieldCheck,
  Anchor,
  Car,
  Camera,
  Compass,
  CheckCircle2,
  XCircle,
  Calendar,
} from 'lucide-react';
import { listGuides, saveGuide, deleteGuide, getTodayDepartures } from '../../../services/operationsService';
import { DbGuide } from '../../../types/database';
import { OperationalDeparture } from '../../../types/operations';
import { useToast } from '../../../contexts/ToastContext';

export const OperationsGuides: React.FC = () => {
  const { showToast } = useToast();
  const [guides, setGuides] = useState<DbGuide[]>([]);
  const [departures, setDepartures] = useState<OperationalDeparture[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [availFilter, setAvailFilter] = useState('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGuide, setEditingGuide] = useState<DbGuide | null>(null);
  const [formData, setFormData] = useState<Partial<DbGuide>>({
    full_name: '',
    role: 'guide',
    languages: ['English', 'Arabic'],
    phone: '',
    email: '',
    license_number: '',
    rating: 5.0,
    is_active: true,
    availability_status: 'available',
    notes: '',
  });
  const [langInput, setLangInput] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const [data, deps] = await Promise.all([
        listGuides(),
        getTodayDepartures(todayStr),
      ]);
      setGuides(data);
      setDepartures(deps);
    } catch (err) {
      console.warn('Failed to load operational staff:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredGuides = guides.filter((g) => {
    if (roleFilter !== 'all' && g.role !== roleFilter) return false;
    if (availFilter !== 'all' && (g.availability_status || (g.is_active ? 'available' : 'unavailable')) !== availFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        g.full_name.toLowerCase().includes(q) ||
        g.role.toLowerCase().includes(q) ||
        (g.phone && g.phone.includes(q)) ||
        (g.email && g.email.toLowerCase().includes(q)) ||
        (g.license_number && g.license_number.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleOpenCreate = () => {
    setEditingGuide(null);
    setFormData({
      full_name: '',
      role: 'guide',
      languages: ['English', 'Arabic'],
      phone: '',
      email: '',
      license_number: '',
      rating: 5.0,
      is_active: true,
      availability_status: 'available',
      notes: '',
    });
    setLangInput('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (guide: DbGuide) => {
    setEditingGuide(guide);
    setFormData({
      full_name: guide.full_name,
      role: guide.role,
      languages: guide.languages || [],
      phone: guide.phone || '',
      email: guide.email || '',
      license_number: guide.license_number || '',
      rating: guide.rating || 5.0,
      is_active: guide.is_active,
      availability_status: guide.availability_status || (guide.is_active ? 'available' : 'unavailable'),
      notes: guide.notes || '',
    });
    setLangInput('');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.full_name) return;

    const avail = formData.availability_status || 'available';
    const isActive = avail === 'available' || avail === 'on_duty';

    const payload: Partial<DbGuide> = {
      ...formData,
      id: editingGuide?.id,
      availability_status: avail,
      is_active: isActive,
    };

    try {
      await saveGuide(payload);
      showToast(
        editingGuide
          ? `Staff profile for "${formData.full_name}" updated.`
          : `Staff member "${formData.full_name}" registered.`,
        'success'
      );
      setIsModalOpen(false);
      await loadData();
    } catch {
      showToast('Failed to save staff profile.', 'error');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to deactivate/remove "${name}"?`)) {
      return;
    }
    await deleteGuide(id);
    showToast(`Staff member "${name}" removed.`, 'success');
    await loadData();
  };

  const handleAddLanguage = () => {
    if (!langInput.trim()) return;
    const current = formData.languages || [];
    if (!current.includes(langInput.trim())) {
      setFormData({ ...formData, languages: [...current, langInput.trim()] });
    }
    setLangInput('');
  };

  const handleRemoveLanguage = (lang: string) => {
    const current = formData.languages || [];
    setFormData({ ...formData, languages: current.filter((l) => l !== lang) });
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'captain':
        return <Anchor className="w-4 h-4 text-[#2dd4bf]" />;
      case 'driver':
        return <Car className="w-4 h-4 text-amber-400" />;
      case 'photographer':
        return <Camera className="w-4 h-4 text-purple-400" />;
      case 'dive_master':
      case 'snorkel_guide':
        return <Compass className="w-4 h-4 text-sky-400" />;
      default:
        return <Users className="w-4 h-4 text-emerald-400" />;
    }
  };

  const getAvailabilityBadge = (status?: string, isActive?: boolean) => {
    const s = status || (isActive ? 'available' : 'unavailable');
    switch (s) {
      case 'available':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'on_duty':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'day_off':
        return 'bg-stone-800 text-stone-400 border-stone-700';
      case 'leave':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'unavailable':
        return 'bg-red-500/20 text-red-300 border-red-500/30';
      default:
        return 'bg-stone-800 text-stone-300 border-stone-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] uppercase tracking-widest text-[#2dd4bf] font-bold block mb-0.5">
            Operational Crew & Guides Dispatch
          </span>
          <h1 className="text-2xl font-bold font-display text-white tracking-tight flex items-center space-x-2">
            <Users className="w-6 h-6 text-[#2dd4bf]" />
            <span>Operational Staff & Guide Profiles</span>
          </h1>
          <p className="text-xs text-stone-400 mt-1">
            Track certified captains, dive masters, Egyptology guides, transfer drivers, marine crew, and photographers.
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
            onClick={handleOpenCreate}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded text-xs font-semibold shadow transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Staff Profile</span>
          </button>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-stone-950 border border-stone-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center space-x-1.5">
            <span className="text-stone-400">Role:</span>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-stone-900 border border-stone-800 rounded text-stone-200"
            >
              <option value="all">All Roles ({guides.length})</option>
              <option value="guide">Tour Guides</option>
              <option value="captain">Captains</option>
              <option value="driver">Transfer Drivers</option>
              <option value="crew">Marine Crew</option>
              <option value="photographer">Photographers</option>
              <option value="dive_master">Dive Masters</option>
              <option value="other">Other Staff</option>
            </select>
          </div>

          <div className="flex items-center space-x-1.5">
            <span className="text-stone-400">Availability:</span>
            <select
              value={availFilter}
              onChange={(e) => setAvailFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-stone-900 border border-stone-800 rounded text-stone-200"
            >
              <option value="all">All Statuses</option>
              <option value="available">Available (On Call)</option>
              <option value="on_duty">On Duty (Dispatched)</option>
              <option value="day_off">Day Off</option>
              <option value="leave">Leave / Vacation</option>
              <option value="unavailable">Unavailable</option>
            </select>
          </div>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search name, role, phone, or license..."
            className="w-full pl-9 pr-3 py-1.5 bg-stone-900 border border-stone-800 rounded text-stone-200 placeholder-stone-500 focus:outline-none focus:border-[#0A6C74]"
          />
        </div>
      </div>

      {/* Staff Grid */}
      {loading ? (
        <div className="p-16 text-center text-stone-400">
          <div className="w-8 h-8 border-2 border-[#0A6C74] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs">Loading operational staff registry...</p>
        </div>
      ) : filteredGuides.length === 0 ? (
        <div className="bg-stone-950 border border-stone-800 rounded-xl p-12 text-center text-stone-400">
          <Users className="w-8 h-8 text-stone-600 mx-auto mb-2" />
          <p className="text-sm font-semibold text-stone-300">No staff members match the selected filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredGuides.map((g) => {
            const activeDeps = departures.filter(
              (d) => d.guideId === g.id || d.captainId === g.id || d.driverId === g.id
            );
            const availStr = g.availability_status || (g.is_active ? 'available' : 'unavailable');

            return (
              <div
                key={g.id}
                className="bg-stone-950 border border-stone-800 rounded-xl p-4 space-y-3 hover:border-stone-700 transition-colors shadow-xs"
              >
                <div className="flex items-start justify-between border-b border-stone-800 pb-2.5">
                  <div className="flex items-start space-x-2.5">
                    <div className="p-2 rounded-lg bg-stone-900 border border-stone-800 shrink-0">
                      {getRoleIcon(g.role)}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-white">{g.full_name}</h3>
                      <div className="flex items-center space-x-1.5 text-[11px] text-stone-400">
                        <span className="capitalize font-semibold text-stone-300">
                          {g.role.replace('_', ' ')}
                        </span>
                        {g.license_number && (
                          <>
                            <span>&bull;</span>
                            <span className="font-mono text-[10px] text-stone-500">
                              {g.license_number}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${getAvailabilityBadge(
                      g.availability_status,
                      g.is_active
                    )}`}
                  >
                    {availStr.replace('_', ' ')}
                  </span>
                </div>

                {/* Contact & Rating */}
                <div className="space-y-1 text-xs text-stone-300">
                  {g.phone && (
                    <div className="flex items-center space-x-2 text-[11px]">
                      <Phone className="w-3 h-3 text-stone-500 shrink-0" />
                      <span className="font-mono">{g.phone}</span>
                    </div>
                  )}
                  {g.email && (
                    <div className="flex items-center space-x-2 text-[11px] text-stone-400 truncate">
                      <Mail className="w-3 h-3 text-stone-500 shrink-0" />
                      <span className="truncate">{g.email}</span>
                    </div>
                  )}
                  <div className="flex items-center space-x-1 text-amber-400 font-bold text-[11px] pt-0.5">
                    <Star className="w-3 h-3 fill-amber-400" />
                    <span>{g.rating || 5.0} / 5.0 Guest Rating</span>
                  </div>
                </div>

                {/* Languages */}
                {g.languages && g.languages.length > 0 && (
                  <div className="flex flex-wrap gap-1 text-[10px]">
                    {g.languages.map((lang, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded bg-stone-900 text-stone-300 border border-stone-800"
                      >
                        {lang}
                      </span>
                    ))}
                  </div>
                )}

                {/* Operational Assignments tracking */}
                <div className="p-2 bg-stone-900/60 rounded border border-stone-800/80 text-[11px]">
                  <div className="flex items-center justify-between text-stone-400">
                    <span>Today's Dispatches:</span>
                    <strong className={activeDeps.length > 0 ? 'text-[#2dd4bf]' : 'text-stone-500'}>
                      {activeDeps.length} Tours
                    </strong>
                  </div>
                  {activeDeps.length > 0 && (
                    <div className="text-[10px] text-stone-300 truncate mt-0.5">
                      {activeDeps.map((d) => `${d.tourTitle} (${d.departureTime})`).join(', ')}
                    </div>
                  )}
                </div>

                {/* Notes */}
                {g.notes && (
                  <p className="text-[10px] text-stone-400 italic bg-stone-900/30 p-1.5 rounded">
                    {g.notes}
                  </p>
                )}

                {/* Actions */}
                <div className="flex items-center justify-end space-x-2 pt-2 border-t border-stone-800 text-xs">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(g)}
                    className="px-2 py-1 bg-stone-900 hover:bg-stone-800 border border-stone-800 text-stone-300 hover:text-white rounded text-xs transition-colors cursor-pointer"
                  >
                    Edit Profile
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(g.id, g.full_name)}
                    className="p-1 text-stone-500 hover:text-red-400 rounded cursor-pointer"
                    title="Remove Staff"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Add / Edit Staff Profile */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-xl p-6 w-full max-w-lg space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <h3 className="font-bold text-white text-base">
                {editingGuide ? `Edit Profile: ${editingGuide.full_name}` : 'Add Operational Staff Profile'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-stone-400 hover:text-white cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div>
                <label className="block text-stone-300 font-semibold mb-1">Full Legal Name</label>
                <input
                  type="text"
                  value={formData.full_name || ''}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="e.g. Captain Tarek Mansour"
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded text-stone-200"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-300 font-semibold mb-1">Operational Role</label>
                  <select
                    value={formData.role || 'guide'}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded text-stone-200"
                  >
                    <option value="guide">Tour Guide</option>
                    <option value="captain">Captain (Yacht / Speedboat)</option>
                    <option value="driver">Transfer Driver</option>
                    <option value="crew">Marine Crew / Deckhand</option>
                    <option value="photographer">Underwater Photographer</option>
                    <option value="dive_master">PADI Dive Master</option>
                    <option value="snorkel_guide">Snorkel Lead Guide</option>
                    <option value="safari_lead">Desert Safari Lead</option>
                    <option value="other">Other Specialist</option>
                  </select>
                </div>

                <div>
                  <label className="block text-stone-300 font-semibold mb-1">Availability Status</label>
                  <select
                    value={formData.availability_status || 'available'}
                    onChange={(e) =>
                      setFormData({ ...formData, availability_status: e.target.value as any })
                    }
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded text-stone-200"
                  >
                    <option value="available">Available (On Call)</option>
                    <option value="on_duty">On Duty (Active Tour)</option>
                    <option value="day_off">Day Off</option>
                    <option value="leave">Leave / Vacation</option>
                    <option value="unavailable">Unavailable</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-300 font-semibold mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={formData.phone || ''}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+20 100 456 7891"
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded text-stone-200 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-stone-300 font-semibold mb-1">Email Address</label>
                  <input
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="staff@redseavoyages.com"
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded text-stone-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-300 font-semibold mb-1">License / Certification</label>
                  <input
                    type="text"
                    value={formData.license_number || ''}
                    onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
                    placeholder="e.g. EGY-MAR-MASTER-8842 or PADI-DM"
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded text-stone-200 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-stone-300 font-semibold mb-1">Rating (1.0 - 5.0)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="5"
                    value={formData.rating || 5.0}
                    onChange={(e) => setFormData({ ...formData, rating: parseFloat(e.target.value) || 5.0 })}
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded text-stone-200 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-stone-300 font-semibold mb-1">Spoken Languages</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={langInput}
                    onChange={(e) => setLangInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddLanguage();
                      }
                    }}
                    placeholder="Add language (e.g. German, Russian, French)"
                    className="flex-1 px-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-stone-200"
                  />
                  <button
                    type="button"
                    onClick={handleAddLanguage}
                    className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded cursor-pointer"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {formData.languages?.map((l, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] bg-stone-800 text-stone-300 border border-stone-700"
                    >
                      <span>{l}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveLanguage(l)}
                        className="text-stone-500 hover:text-white cursor-pointer ml-1"
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-stone-300 font-semibold mb-1">Staff Notes & Qualifications</label>
                <textarea
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Special certifications, marine first aid training, offshore navigation experience..."
                  rows={2}
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded text-stone-200"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 bg-stone-800 text-stone-300 rounded hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded font-semibold cursor-pointer"
                >
                  {editingGuide ? 'Update Staff Member' : 'Save Staff Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
