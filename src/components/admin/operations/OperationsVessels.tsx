import React, { useState, useEffect } from 'react';
import {
  Ship,
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Anchor,
  ShieldCheck,
  Calendar,
  Users,
  Wrench,
  XCircle,
} from 'lucide-react';
import { listVessels, saveVessel, deleteVessel } from '../../../services/operationsService';
import { DbVessel } from '../../../types/database';
import { useToast } from '../../../contexts/ToastContext';

export const OperationsVessels: React.FC = () => {
  const { showToast } = useToast();
  const [vessels, setVessels] = useState<DbVessel[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVessel, setEditingVessel] = useState<DbVessel | null>(null);
  const [formData, setFormData] = useState<Partial<DbVessel>>({
    name: '',
    vessel_type: 'motor_yacht',
    registration_number: '',
    port_marina: 'Hurghada Marina',
    passenger_capacity: 35,
    crew_capacity: 4,
    year_built: 2022,
    safety_inspection_expiry: '2027-12-31',
    amenities: ['Life Vests', 'First Aid Kit', 'Sundeck'],
    is_active: true,
    status: 'active',
    maintenance_notes: '',
    next_maintenance: '',
    crew: '',
  });
  const [amenityInput, setAmenityInput] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await listVessels();
      setVessels(data);
    } catch (err) {
      console.warn('Failed to load vessels:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredVessels = vessels.filter((v) => {
    if (statusFilter !== 'all' && (v.status || (v.is_active ? 'active' : 'inactive')) !== statusFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        v.name.toLowerCase().includes(q) ||
        (v.registration_number && v.registration_number.toLowerCase().includes(q)) ||
        v.port_marina.toLowerCase().includes(q) ||
        v.vessel_type.toLowerCase().includes(q) ||
        (v.crew && v.crew.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleOpenCreate = () => {
    setEditingVessel(null);
    setFormData({
      name: '',
      vessel_type: 'motor_yacht',
      registration_number: '',
      port_marina: 'Hurghada Marina',
      passenger_capacity: 35,
      crew_capacity: 4,
      year_built: 2022,
      safety_inspection_expiry: '2027-12-31',
      amenities: ['Life Vests', 'First Aid Kit', 'Sundeck'],
      is_active: true,
      status: 'active',
      maintenance_notes: '',
      next_maintenance: '2026-12-01',
      crew: '',
    });
    setAmenityInput('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (vessel: DbVessel) => {
    setEditingVessel(vessel);
    setFormData({
      name: vessel.name,
      vessel_type: vessel.vessel_type,
      registration_number: vessel.registration_number || '',
      port_marina: vessel.port_marina,
      passenger_capacity: vessel.passenger_capacity,
      crew_capacity: vessel.crew_capacity || 4,
      year_built: vessel.year_built || 2022,
      safety_inspection_expiry: vessel.safety_inspection_expiry || '',
      amenities: vessel.amenities || [],
      is_active: vessel.is_active,
      status: vessel.status || (vessel.is_active ? 'active' : 'inactive'),
      maintenance_notes: vessel.maintenance_notes || '',
      next_maintenance: vessel.next_maintenance || '',
      crew: vessel.crew || '',
    });
    setAmenityInput('');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;

    const isActive = formData.status === 'active' || formData.status === 'in_service';

    const payload: Partial<DbVessel> = {
      ...formData,
      id: editingVessel?.id,
      is_active: isActive,
    };

    try {
      await saveVessel(payload);
      showToast(
        editingVessel
          ? `Vessel "${formData.name}" updated successfully.`
          : `New vessel "${formData.name}" added to fleet.`,
        'success'
      );
      setIsModalOpen(false);
      await loadData();
    } catch {
      showToast('Failed to save vessel details.', 'error');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to decommission/remove "${name}" from the active fleet?`)) {
      return;
    }
    await deleteVessel(id);
    showToast(`Vessel "${name}" removed.`, 'success');
    await loadData();
  };

  const handleAddAmenity = () => {
    if (!amenityInput.trim()) return;
    const current = formData.amenities || [];
    if (!current.includes(amenityInput.trim())) {
      setFormData({ ...formData, amenities: [...current, amenityInput.trim()] });
    }
    setAmenityInput('');
  };

  const handleRemoveAmenity = (amenity: string) => {
    const current = formData.amenities || [];
    setFormData({ ...formData, amenities: current.filter((a) => a !== amenity) });
  };

  const getStatusBadge = (status?: string, isActive?: boolean) => {
    const s = status || (isActive ? 'active' : 'inactive');
    switch (s) {
      case 'active':
      case 'in_service':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'maintenance':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'dry_dock':
        return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
      case 'inactive':
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
            Fleet Operations & Marine Safety
          </span>
          <h1 className="text-2xl font-bold font-display text-white tracking-tight flex items-center space-x-2">
            <Ship className="w-6 h-6 text-[#2dd4bf]" />
            <span>Maritime Fleet & Vessel Management</span>
          </h1>
          <p className="text-xs text-stone-400 mt-1">
            Maintain vessel registrations, passenger capacities, maintenance schedules, crew allocations, and harbor certifications.
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
            <span>Register Vessel</span>
          </button>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-stone-950 border border-stone-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-2">
          <span className="text-stone-400">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-stone-900 border border-stone-800 rounded text-stone-200"
          >
            <option value="all">All Vessels ({vessels.length})</option>
            <option value="active">Active & In Service</option>
            <option value="maintenance">Under Maintenance</option>
            <option value="dry_dock">Dry Dock</option>
            <option value="inactive">Inactive / Decommissioned</option>
          </select>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search vessel name, reg, port..."
            className="w-full pl-9 pr-3 py-1.5 bg-stone-900 border border-stone-800 rounded text-stone-200 placeholder-stone-500 focus:outline-none focus:border-[#0A6C74]"
          />
        </div>
      </div>

      {/* Vessels Grid */}
      {loading ? (
        <div className="p-16 text-center text-stone-400">
          <div className="w-8 h-8 border-2 border-[#0A6C74] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs">Loading maritime fleet registry...</p>
        </div>
      ) : filteredVessels.length === 0 ? (
        <div className="bg-stone-950 border border-stone-800 rounded-xl p-12 text-center text-stone-400">
          <Anchor className="w-8 h-8 text-stone-600 mx-auto mb-2" />
          <p className="text-sm font-semibold text-stone-300">No vessels found matching criteria</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
          {filteredVessels.map((v) => {
            const statusStr = v.status || (v.is_active ? 'active' : 'inactive');
            const isAssignable = statusStr === 'active' || statusStr === 'in_service';

            return (
              <div
                key={v.id}
                className="bg-stone-950 border border-stone-800 rounded-xl p-5 space-y-4 hover:border-stone-700 transition-colors shadow-xs"
              >
                <div className="flex items-start justify-between border-b border-stone-800 pb-3">
                  <div className="flex items-start space-x-3">
                    <div className="p-2.5 rounded-lg bg-stone-900 border border-stone-800 text-[#2dd4bf] shrink-0">
                      <Ship className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-white">{v.name}</h3>
                      <div className="flex items-center space-x-2 text-[11px] text-stone-400 mt-0.5">
                        <span className="font-mono text-stone-300">{v.registration_number || 'UNREGISTERED'}</span>
                        <span>&bull;</span>
                        <span className="capitalize">{v.vessel_type.replace('_', ' ')}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span
                      className={`px-2.5 py-1 rounded text-xs font-bold border uppercase tracking-wider ${getStatusBadge(
                        v.status,
                        v.is_active
                      )}`}
                    >
                      {statusStr.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                {/* Logistics Attributes */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-2.5 bg-stone-900/60 rounded-lg border border-stone-800/80">
                    <span className="text-[10px] text-stone-500 uppercase font-bold block">Capacity</span>
                    <strong className="text-white text-sm font-mono">{v.passenger_capacity}</strong>{' '}
                    <span className="text-stone-400 text-[11px]">Passengers</span>
                    <div className="text-[10px] text-stone-500 mt-0.5">Crew: {v.crew_capacity || 4} Staff</div>
                  </div>

                  <div className="p-2.5 bg-stone-900/60 rounded-lg border border-stone-800/80">
                    <span className="text-[10px] text-stone-500 uppercase font-bold block">Port / Marina</span>
                    <div className="font-semibold text-white text-xs truncate">{v.port_marina}</div>
                    <div className="text-[10px] text-stone-400 mt-0.5">Built: {v.year_built || 2022}</div>
                  </div>
                </div>

                {/* Maintenance & Crew Information */}
                <div className="space-y-1.5 text-xs">
                  {v.crew && (
                    <div className="text-[11px] text-stone-300 flex items-start space-x-1.5">
                      <Users className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                      <span><strong>Crew:</strong> {v.crew}</span>
                    </div>
                  )}

                  {v.next_maintenance && (
                    <div className="text-[11px] text-amber-300 flex items-center space-x-1.5">
                      <Wrench className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>Next Maintenance: <strong className="font-mono">{v.next_maintenance}</strong></span>
                    </div>
                  )}

                  {v.maintenance_notes && (
                    <div className="text-[10px] text-stone-400 bg-stone-900/40 p-2 rounded border border-stone-800/60 italic">
                      Notes: {v.maintenance_notes}
                    </div>
                  )}
                </div>

                {/* Amenities */}
                {v.amenities && v.amenities.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {v.amenities.map((amenity, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded text-[10px] bg-stone-900 text-stone-300 border border-stone-800"
                      >
                        {amenity}
                      </span>
                    ))}
                  </div>
                )}

                {/* Card Footer: Assignable status alert & actions */}
                <div className="flex items-center justify-between pt-2 border-t border-stone-800 text-xs">
                  <div>
                    {!isAssignable ? (
                      <span className="text-[11px] text-red-400 flex items-center space-x-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Cannot assign (Inactive)</span>
                      </span>
                    ) : (
                      <span className="text-[11px] text-emerald-400 flex items-center space-x-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Active for Dispatch</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(v)}
                      className="px-2.5 py-1 bg-stone-900 hover:bg-stone-800 border border-stone-800 text-stone-300 hover:text-white rounded text-xs transition-colors cursor-pointer"
                    >
                      Edit Vessel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(v.id, v.name)}
                      className="p-1 text-stone-500 hover:text-red-400 rounded cursor-pointer"
                      title="Decommission"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Register / Edit Vessel */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-xl p-6 w-full max-w-lg space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <h3 className="font-bold text-white text-base">
                {editingVessel ? `Edit Vessel: ${editingVessel.name}` : 'Register New Fleet Vessel'}
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
                <label className="block text-stone-300 font-semibold mb-1">Vessel Name</label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. M/Y Red Sea Star VIP"
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded text-stone-200"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-300 font-semibold mb-1">Type</label>
                  <select
                    value={formData.vessel_type || 'motor_yacht'}
                    onChange={(e) => setFormData({ ...formData, vessel_type: e.target.value as any })}
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded text-stone-200"
                  >
                    <option value="motor_yacht">Motor Yacht</option>
                    <option value="speedboat">Speedboat</option>
                    <option value="catamaran">Catamaran</option>
                    <option value="semi_submarine">Semi-Submarine</option>
                    <option value="glass_bottom">Glass Bottom Boat</option>
                    <option value="safari_jeep">Safari 4x4 Jeep</option>
                  </select>
                </div>

                <div>
                  <label className="block text-stone-300 font-semibold mb-1">Status</label>
                  <select
                    value={formData.status || 'active'}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded text-stone-200"
                  >
                    <option value="active">Active (Available)</option>
                    <option value="in_service">In Service (Underway)</option>
                    <option value="maintenance">Under Maintenance (Inactive)</option>
                    <option value="dry_dock">Dry Dock / Refit (Inactive)</option>
                    <option value="inactive">Inactive / Decommissioned</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-300 font-semibold mb-1">Registration Number</label>
                  <input
                    type="text"
                    value={formData.registration_number || ''}
                    onChange={(e) => setFormData({ ...formData, registration_number: e.target.value })}
                    placeholder="e.g. HUR-8841-VIP"
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded text-stone-200 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-stone-300 font-semibold mb-1">Home Port / Marina</label>
                  <input
                    type="text"
                    value={formData.port_marina || ''}
                    onChange={(e) => setFormData({ ...formData, port_marina: e.target.value })}
                    placeholder="e.g. Hurghada Marina"
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded text-stone-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-stone-300 font-semibold mb-1">Passenger Capacity</label>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={formData.passenger_capacity || 35}
                    onChange={(e) => setFormData({ ...formData, passenger_capacity: parseInt(e.target.value) || 35 })}
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded text-stone-200 font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-stone-300 font-semibold mb-1">Crew Capacity</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={formData.crew_capacity || 4}
                    onChange={(e) => setFormData({ ...formData, crew_capacity: parseInt(e.target.value) || 4 })}
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded text-stone-200 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-stone-300 font-semibold mb-1">Year Built</label>
                  <input
                    type="number"
                    value={formData.year_built || 2022}
                    onChange={(e) => setFormData({ ...formData, year_built: parseInt(e.target.value) || 2022 })}
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded text-stone-200 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-stone-300 font-semibold mb-1">Assigned Crew</label>
                <input
                  type="text"
                  value={formData.crew || ''}
                  onChange={(e) => setFormData({ ...formData, crew: e.target.value })}
                  placeholder="e.g. Captain Tarek + 3 Marine Crew"
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded text-stone-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-300 font-semibold mb-1">Next Maintenance Date</label>
                  <input
                    type="date"
                    value={formData.next_maintenance || ''}
                    onChange={(e) => setFormData({ ...formData, next_maintenance: e.target.value })}
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded text-stone-200 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-stone-300 font-semibold mb-1">Safety Inspection Expiry</label>
                  <input
                    type="date"
                    value={formData.safety_inspection_expiry || ''}
                    onChange={(e) => setFormData({ ...formData, safety_inspection_expiry: e.target.value })}
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded text-stone-200 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-stone-300 font-semibold mb-1">Maintenance Log & Technical Notes</label>
                <textarea
                  value={formData.maintenance_notes || ''}
                  onChange={(e) => setFormData({ ...formData, maintenance_notes: e.target.value })}
                  placeholder="Engine overhaul status, propeller checks, hull antifouling history..."
                  rows={2}
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded text-stone-200"
                />
              </div>

              <div>
                <label className="block text-stone-300 font-semibold mb-1">Vessel Amenities</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={amenityInput}
                    onChange={(e) => setAmenityInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddAmenity();
                      }
                    }}
                    placeholder="Add amenity (e.g. Air Conditioning, Sundeck)"
                    className="flex-1 px-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-stone-200"
                  />
                  <button
                    type="button"
                    onClick={handleAddAmenity}
                    className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded cursor-pointer"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {formData.amenities?.map((a, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] bg-stone-800 text-stone-300 border border-stone-700"
                    >
                      <span>{a}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveAmenity(a)}
                        className="text-stone-500 hover:text-white cursor-pointer ml-1"
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                </div>
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
                  {editingVessel ? 'Update Vessel' : 'Register Vessel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
