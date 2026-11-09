import React, { useState, useEffect } from 'react';
import { MapPin, Plus, Edit2, Trash2, CheckCircle, ExternalLink, AlertTriangle } from 'lucide-react';
import { getDestinations, notifyCatalogueDataChanged } from '../../services/tourService';
import { DbDestination } from '../../types/database';
import { supabase, isSupabaseConfigured, formatSupabaseError } from '../../services/supabaseClient';
import { useToast } from '../../contexts/ToastContext';

export const AdminDestinationsList: React.FC = () => {
  const { showToast } = useToast();
  const [destinations, setDestinations] = useState<DbDestination[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingDest, setEditingDest] = useState<Partial<DbDestination> | null>(null);
  const [destinationToDelete, setDestinationToDelete] = useState<DbDestination | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getDestinations();
      setDestinations(data);
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Failed to load destinations from database', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSave = async () => {
    if (!editingDest || !editingDest.name || !editingDest.slug) {
      setErrorMsg('Name and URL slug are required.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    if (!isSupabaseConfigured()) {
      if (editingDest.id) {
        setDestinations(destinations.map((d) => (d.id === editingDest.id ? ({ ...d, ...editingDest } as DbDestination) : d)));
      } else {
        const newD: DbDestination = {
          id: `dest-${Date.now()}`,
          name: editingDest.name,
          slug: editingDest.slug,
          tagline: editingDest.tagline || '',
          description: editingDest.description || '',
          main_image: editingDest.main_image || 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=800&q=80',
          gallery: [],
          distance_from_airport: editingDest.distance_from_airport || '20 min',
          seo_title: editingDest.seo_title || null,
          seo_description: editingDest.seo_description || null,
          seo_keywords: [],
          status: 'published',
          sort_order: destinations.length + 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setDestinations([...destinations, newD]);
      }
      showToast('Destination saved in local storage.', 'info');
      setSaving(false);
      setEditingDest(null);
      return;
    }

    try {
      if (editingDest.id) {
        const { error } = await supabase
          .from('destinations')
          .update({
            name: editingDest.name,
            slug: editingDest.slug,
            tagline: editingDest.tagline,
            description: editingDest.description,
            main_image: editingDest.main_image,
            distance_from_airport: editingDest.distance_from_airport,
            seo_title: editingDest.seo_title,
            seo_description: editingDest.seo_description,
            status: editingDest.status || 'published',
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingDest.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('destinations').insert({
          name: editingDest.name,
          slug: editingDest.slug,
          tagline: editingDest.tagline,
          description: editingDest.description,
          main_image: editingDest.main_image,
          distance_from_airport: editingDest.distance_from_airport,
          seo_title: editingDest.seo_title,
          seo_description: editingDest.seo_description,
          status: 'published',
          sort_order: destinations.length + 1,
        });

        if (error) throw error;
      }

      await loadData();
      notifyCatalogueDataChanged('destinations');
      showToast('Destination saved successfully.', 'success');
      setEditingDest(null);
    } catch (err: any) {
      setErrorMsg(formatSupabaseError(err));
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteDestination = async () => {
    if (!destinationToDelete) return;
    setIsDeleting(true);

    if (!isSupabaseConfigured()) {
      setDestinations(destinations.filter((d) => d.id !== destinationToDelete.id));
      notifyCatalogueDataChanged('destinations');
      showToast(`Destination "${destinationToDelete.name}" removed from local state`, 'info');
      setDestinationToDelete(null);
      setIsDeleting(false);
      return;
    }

    try {
      const { error } = await supabase.from('destinations').delete().eq('id', destinationToDelete.id);
      if (error) throw error;
      notifyCatalogueDataChanged('destinations');
      showToast(`Destination "${destinationToDelete.name}" permanently deleted`, 'success');
      await loadData();
      setDestinationToDelete(null);
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
            Destinations & Coastal Hubs
          </h1>
          <p className="text-xs text-stone-400 mt-1">
            Manage regions featured across the Red Sea: Hurghada, El Gouna, Makadi Bay, Sahl Hasheesh, Safaga, and Marsa Alam.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            setEditingDest({
              name: '',
              slug: '',
              tagline: '',
              description: '',
              main_image: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=800&q=80',
              distance_from_airport: '15 min drive',
            })
          }
          className="flex items-center space-x-1.5 px-3 py-2 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded text-xs font-semibold shadow transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add Destination</span>
        </button>
      </div>

      {/* Destinations Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {destinations.map((d) => (
          <div key={d.id} className="bg-stone-950 border border-stone-800 rounded-lg overflow-hidden flex flex-col justify-between">
            <div className="h-36 relative bg-stone-900">
              <img
                src={d.main_image || 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=800&q=80'}
                alt={d.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-white">
                <span className="font-bold text-sm font-display">{d.name}</span>
                <span className="text-[10px] text-stone-300 font-mono">/{d.slug}</span>
              </div>
            </div>

            <div className="p-3 text-xs space-y-2 flex-1">
              <p className="text-[#2dd4bf] font-medium text-[11px]">{d.tagline || 'Red Sea Coastal Destination'}</p>
              <p className="text-stone-400 line-clamp-2">{d.description}</p>
              <p className="text-[10px] text-stone-500">Airport Transfer: {d.distance_from_airport || 'Short drive'}</p>
            </div>

            <div className="p-3 border-t border-stone-800/80 flex items-center justify-between text-xs">
              <span className="text-emerald-400 font-medium text-[11px] flex items-center space-x-1">
                <CheckCircle className="w-3 h-3" />
                <span>Active</span>
              </span>

              <div className="flex items-center space-x-1">
                <button
                  type="button"
                  onClick={() => setEditingDest(d)}
                  className="p-1 text-stone-400 hover:text-white"
                  title="Edit destination"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setDestinationToDelete(d)}
                  className="p-1 text-stone-400 hover:text-red-400"
                  title="Delete destination"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* DELETE CONFIRMATION MODAL */}
      {destinationToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-lg max-w-sm w-full p-6 space-y-4 shadow-xl text-xs">
            <div className="flex items-center space-x-2.5 text-amber-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-bold text-white">Delete Destination</h3>
            </div>
            <p className="text-stone-300">
              Are you sure you want to delete <span className="font-semibold text-white">"{destinationToDelete.name}"</span>? Any tours linked to this hub will be unassigned.
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setDestinationToDelete(null)}
                disabled={isDeleting}
                className="px-3 py-1.5 bg-stone-800 text-stone-300 rounded font-medium hover:bg-stone-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteDestination}
                disabled={isDeleting}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded font-semibold disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editingDest && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-lg max-w-lg w-full p-6 space-y-4 shadow-xl text-xs">
            <h3 className="text-base font-bold text-white">
              {editingDest.id ? 'Edit Destination' : 'Add New Destination'}
            </h3>

            {errorMsg && (
              <div className="p-2.5 bg-red-950/60 border border-red-800 rounded text-red-300">
                {errorMsg}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-stone-300 block mb-1 font-semibold">Destination Name</label>
                <input
                  type="text"
                  value={editingDest.name || ''}
                  onChange={(e) => {
                    const name = e.target.value;
                    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
                    setEditingDest({ ...editingDest, name, slug: editingDest.slug || slug });
                  }}
                  placeholder="e.g. Sahl Hasheesh"
                  className="w-full px-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-white"
                />
              </div>

              <div>
                <label className="text-stone-300 block mb-1 font-semibold">URL Slug</label>
                <input
                  type="text"
                  value={editingDest.slug || ''}
                  onChange={(e) => setEditingDest({ ...editingDest, slug: e.target.value })}
                  placeholder="sahl-hasheesh"
                  className="w-full px-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-white"
                />
              </div>

              <div>
                <label className="text-stone-300 block mb-1 font-semibold">Tagline</label>
                <input
                  type="text"
                  value={editingDest.tagline || ''}
                  onChange={(e) => setEditingDest({ ...editingDest, tagline: e.target.value })}
                  placeholder="e.g. Luxury bayside resorts & calm waters"
                  className="w-full px-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-white"
                />
              </div>

              <div>
                <label className="text-stone-300 block mb-1 font-semibold">Description</label>
                <textarea
                  rows={3}
                  value={editingDest.description || ''}
                  onChange={(e) => setEditingDest({ ...editingDest, description: e.target.value })}
                  className="w-full px-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-white"
                />
              </div>

              <div>
                <label className="text-stone-300 block mb-1 font-semibold">Cover Image URL</label>
                <input
                  type="text"
                  value={editingDest.main_image || ''}
                  onChange={(e) => setEditingDest({ ...editingDest, main_image: e.target.value })}
                  className="w-full px-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-white"
                />
              </div>

              <div>
                <label className="text-stone-300 block mb-1 font-semibold">Distance from Airport</label>
                <input
                  type="text"
                  value={editingDest.distance_from_airport || ''}
                  onChange={(e) => setEditingDest({ ...editingDest, distance_from_airport: e.target.value })}
                  placeholder="e.g. 20 min from HRG Airport"
                  className="w-full px-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingDest(null)}
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
                {saving ? 'Saving...' : 'Save Destination'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
