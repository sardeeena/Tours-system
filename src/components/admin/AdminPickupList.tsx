import React, { useState, useEffect } from 'react';
import { Car, Plus, Edit2, Trash2, CheckCircle, AlertCircle, AlertTriangle } from 'lucide-react';
import { getPickupLocations, notifyCatalogueDataChanged } from '../../services/tourService';
import { DbPickupLocation } from '../../types/database';
import { supabase, isSupabaseConfigured, formatSupabaseError } from '../../services/supabaseClient';
import { useToast } from '../../contexts/ToastContext';

export const AdminPickupList: React.FC = () => {
  const { showToast } = useToast();
  const [locations, setLocations] = useState<DbPickupLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingLoc, setEditingLoc] = useState<Partial<DbPickupLocation> | null>(null);
  const [locationToDelete, setLocationToDelete] = useState<DbPickupLocation | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getPickupLocations();
      setLocations(data);
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Failed to load pickup locations from database', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSave = async () => {
    if (!editingLoc || !editingLoc.name || !editingLoc.code) {
      setErrorMsg('Code and Name are required.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    if (!isSupabaseConfigured()) {
      if (editingLoc.id) {
        setLocations(locations.map((l) => (l.id === editingLoc.id ? ({ ...l, ...editingLoc } as DbPickupLocation) : l)));
      } else {
        const newL: DbPickupLocation = {
          id: `pickup-${Date.now()}`,
          code: editingLoc.code,
          name: editingLoc.name,
          area: editingLoc.area || '',
          fee_eur_per_person: Number(editingLoc.fee_eur_per_person) || 0,
          fee_eur_flat: 0,
          description: editingLoc.description || '',
          is_active: true,
          sort_order: locations.length + 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setLocations([...locations, newL]);
      }
      setSaving(false);
      setEditingLoc(null);
      notifyCatalogueDataChanged('locations');
      return;
    }

    try {
      if (editingLoc.id && !editingLoc.id.startsWith('pickup-')) {
        const { error } = await supabase
          .from('pickup_locations')
          .update({
            code: editingLoc.code,
            name: editingLoc.name,
            area: editingLoc.area,
            fee_eur_per_person: editingLoc.fee_eur_per_person,
            description: editingLoc.description,
            is_active: editingLoc.is_active ?? true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingLoc.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('pickup_locations').insert({
          code: editingLoc.code,
          name: editingLoc.name,
          area: editingLoc.area,
          fee_eur_per_person: Number(editingLoc.fee_eur_per_person) || 0,
          description: editingLoc.description,
          is_active: true,
          sort_order: locations.length + 1,
        });

        if (error) throw error;
      }

      await loadData();
      showToast('Pickup location saved successfully.', 'success');
      setEditingLoc(null);
      notifyCatalogueDataChanged('locations');
    } catch (err: any) {
      setErrorMsg(formatSupabaseError(err));
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteLocation = async () => {
    if (!locationToDelete) return;
    setIsDeleting(true);

    if (!isSupabaseConfigured()) {
      setLocations(locations.filter((l) => l.id !== locationToDelete.id));
      showToast(`Pickup zone "${locationToDelete.name}" removed from local state.`, 'info');
      setLocationToDelete(null);
      setIsDeleting(false);
      notifyCatalogueDataChanged('locations');
      return;
    }

    try {
      const { error } = await supabase.from('pickup_locations').delete().eq('id', locationToDelete.id);
      if (error) throw error;
      showToast(`Pickup zone "${locationToDelete.name}" permanently deleted.`, 'success');
      await loadData();
      setLocationToDelete(null);
      notifyCatalogueDataChanged('locations');
    } catch (err: any) {
      showToast(formatSupabaseError(err), 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display text-white tracking-tight">
            Hotel Pickup Locations & Transfer Surcharges
          </h1>
          <p className="text-xs text-stone-400 mt-1">
            Configure regional pickup zones across Hurghada, El Gouna, Makadi Bay, Sahl Hasheesh, and Soma Bay.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            setEditingLoc({
              code: '',
              name: '',
              area: '',
              fee_eur_per_person: 0,
              description: '',
              is_active: true,
            })
          }
          className="flex items-center space-x-1.5 px-3 py-2 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded text-xs font-semibold shadow transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add Pickup Zone</span>
        </button>
      </div>

      <div className="bg-stone-950 border border-stone-800 rounded-lg overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-stone-900/80 text-stone-400 border-b border-stone-800">
            <tr>
              <th className="py-3 px-4 font-semibold">Zone / Code</th>
              <th className="py-3 px-4 font-semibold">Covered Resorts Area</th>
              <th className="py-3 px-4 font-semibold">Surcharge Per Guest</th>
              <th className="py-3 px-4 font-semibold">Status</th>
              <th className="py-3 px-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-800/60 text-stone-300">
            {locations.map((loc) => (
              <tr key={loc.id} className="hover:bg-stone-900/40 transition-colors">
                <td className="py-3 px-4">
                  <span className="font-semibold text-white block">{loc.name}</span>
                  <span className="text-[10px] text-stone-500 font-mono">{loc.code}</span>
                </td>
                <td className="py-3 px-4 text-stone-400">
                  {loc.area}
                </td>
                <td className="py-3 px-4 whitespace-nowrap">
                  {loc.fee_eur_per_person === 0 ? (
                    <span className="text-emerald-400 font-medium">Free / Included</span>
                  ) : (
                    <span className="font-bold text-white">+€{loc.fee_eur_per_person}.00</span>
                  )}
                </td>
                <td className="py-3 px-4 whitespace-nowrap">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Active
                  </span>
                </td>
                <td className="py-3 px-4 text-right whitespace-nowrap space-x-1">
                  <button
                    type="button"
                    onClick={() => setEditingLoc(loc)}
                    className="p-1.5 text-stone-400 hover:text-white transition-colors cursor-pointer"
                    title="Edit pickup zone"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setLocationToDelete(loc)}
                    className="p-1.5 text-stone-400 hover:text-red-400 transition-colors cursor-pointer"
                    title="Delete pickup zone"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingLoc && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-lg max-w-md w-full p-6 space-y-4 shadow-xl text-xs">
            <h3 className="text-base font-bold text-white">
              {editingLoc.id ? 'Edit Pickup Zone' : 'Create Pickup Zone'}
            </h3>

            {errorMsg && (
              <div className="p-2.5 bg-red-950/60 border border-red-800 rounded text-red-300">
                {errorMsg}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-stone-300 block mb-1 font-semibold">Zone Identifier (Code)</label>
                <input
                  type="text"
                  value={editingLoc.code || ''}
                  onChange={(e) => setEditingLoc({ ...editingLoc, code: e.target.value })}
                  placeholder="e.g. soma-bay"
                  className="w-full px-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-white"
                />
              </div>

              <div>
                <label className="text-stone-300 block mb-1 font-semibold">Display Title</label>
                <input
                  type="text"
                  value={editingLoc.name || ''}
                  onChange={(e) => setEditingLoc({ ...editingLoc, name: e.target.value })}
                  placeholder="e.g. Soma Bay & Safaga Hotels"
                  className="w-full px-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-white"
                />
              </div>

              <div>
                <label className="text-stone-300 block mb-1 font-semibold">Covered Resorts & Area</label>
                <input
                  type="text"
                  value={editingLoc.area || ''}
                  onChange={(e) => setEditingLoc({ ...editingLoc, area: e.target.value })}
                  placeholder="e.g. Soma Bay Peninsula, Sheraton Soma Bay, Kempinski"
                  className="w-full px-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-white"
                />
              </div>

              <div>
                <label className="text-stone-300 block mb-1 font-semibold">Per Person Surcharge (€ EUR)</label>
                <input
                  type="number"
                  value={editingLoc.fee_eur_per_person ?? 0}
                  onChange={(e) => setEditingLoc({ ...editingLoc, fee_eur_per_person: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingLoc(null)}
                className="px-3 py-1.5 bg-stone-800 text-stone-300 rounded"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-1.5 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded font-semibold disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Zone'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {locationToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-xl max-w-sm w-full p-6 space-y-4 shadow-2xl text-xs">
            <div className="flex items-center space-x-2.5 text-amber-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-bold text-white">Delete Pickup Zone</h3>
            </div>
            <p className="text-stone-300 leading-relaxed">
              Are you sure you want to delete pickup zone <strong className="text-white">"{locationToDelete.name}"</strong> (<span className="text-stone-400 font-mono">{locationToDelete.code}</span>)?
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-stone-800">
              <button
                type="button"
                onClick={() => setLocationToDelete(null)}
                disabled={isDeleting}
                className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteLocation}
                disabled={isDeleting}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded font-semibold disabled:opacity-50 cursor-pointer"
              >
                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
