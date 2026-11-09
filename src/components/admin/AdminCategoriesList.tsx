import React, { useState, useEffect } from 'react';
import { Layers, Plus, Edit2, Trash2, CheckCircle, AlertTriangle } from 'lucide-react';
import { getCategories, notifyCatalogueDataChanged } from '../../services/tourService';
import { DbCategory } from '../../types/database';
import { supabase, isSupabaseConfigured, formatSupabaseError } from '../../services/supabaseClient';
import { useToast } from '../../contexts/ToastContext';

export const AdminCategoriesList: React.FC = () => {
  const { showToast } = useToast();
  const [categories, setCategories] = useState<DbCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCategory, setEditingCategory] = useState<Partial<DbCategory> | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<DbCategory | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getCategories();
      setCategories(data);
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Failed to load categories from database', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSave = async () => {
    if (!editingCategory || !editingCategory.name || !editingCategory.slug) {
      setErrorMsg('Name and URL slug are required.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    if (!isSupabaseConfigured()) {
      if (editingCategory.id) {
        setCategories(categories.map((c) => (c.id === editingCategory.id ? ({ ...c, ...editingCategory } as DbCategory) : c)));
      } else {
        const newC: DbCategory = {
          id: `cat-${Date.now()}`,
          name: editingCategory.name,
          slug: editingCategory.slug,
          description: editingCategory.description || '',
          image: editingCategory.image || 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=800&q=80',
          icon_name: editingCategory.icon_name || 'Compass',
          seo_title: editingCategory.seo_title || null,
          seo_description: editingCategory.seo_description || null,
          seo_keywords: [],
          status: 'published',
          sort_order: categories.length + 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setCategories([...categories, newC]);
      }
      showToast('Category saved in local storage.', 'info');
      setSaving(false);
      setEditingCategory(null);
      return;
    }

    try {
      if (editingCategory.id) {
        const { error } = await supabase
          .from('categories')
          .update({
            name: editingCategory.name,
            slug: editingCategory.slug,
            description: editingCategory.description,
            image: editingCategory.image,
            icon_name: editingCategory.icon_name,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingCategory.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('categories').insert({
          name: editingCategory.name,
          slug: editingCategory.slug,
          description: editingCategory.description,
          image: editingCategory.image,
          icon_name: editingCategory.icon_name,
          status: 'published',
          sort_order: categories.length + 1,
        });

        if (error) throw error;
      }

      await loadData();
      notifyCatalogueDataChanged('categories');
      showToast('Category saved successfully.', 'success');
      setEditingCategory(null);
    } catch (err: any) {
      setErrorMsg(formatSupabaseError(err));
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteCategory = async () => {
    if (!categoryToDelete) return;
    setIsDeleting(true);

    if (!isSupabaseConfigured()) {
      setCategories(categories.filter((c) => c.id !== categoryToDelete.id));
      notifyCatalogueDataChanged('categories');
      showToast(`Category "${categoryToDelete.name}" removed from local state`, 'info');
      setCategoryToDelete(null);
      setIsDeleting(false);
      return;
    }

    try {
      const { error } = await supabase.from('categories').delete().eq('id', categoryToDelete.id);
      if (error) throw error;
      notifyCatalogueDataChanged('categories');
      showToast(`Category "${categoryToDelete.name}" deleted successfully`, 'success');
      await loadData();
      setCategoryToDelete(null);
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
            Tour Categories & Activities
          </h1>
          <p className="text-xs text-stone-400 mt-1">
            Organize excursions into Boat Trips, Snorkeling, Diving, Desert Safari, Water Sports, and Private Charters.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            setEditingCategory({
              name: '',
              slug: '',
              description: '',
              image: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=800&q=80',
              icon_name: 'Compass',
            })
          }
          className="flex items-center space-x-1.5 px-3 py-2 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded text-xs font-semibold shadow transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add Category</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((c) => (
          <div key={c.id} className="bg-stone-950 border border-stone-800 rounded-lg overflow-hidden flex flex-col justify-between">
            <div className="h-32 relative bg-stone-900">
              <img
                src={c.image || 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=800&q=80'}
                alt={c.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-white">
                <span className="font-bold text-sm font-display">{c.name}</span>
                <span className="text-[10px] text-stone-300 font-mono">/{c.slug}</span>
              </div>
            </div>

            <div className="p-3 text-xs flex-1">
              <p className="text-stone-400 line-clamp-2">{c.description}</p>
            </div>

            <div className="p-3 border-t border-stone-800/80 flex items-center justify-between text-xs">
              <span className="text-emerald-400 font-medium text-[11px] flex items-center space-x-1">
                <CheckCircle className="w-3 h-3" />
                <span>Active</span>
              </span>

              <div className="flex items-center space-x-1">
                <button
                  type="button"
                  onClick={() => setEditingCategory(c)}
                  className="p-1 text-stone-400 hover:text-white"
                  title="Edit category"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryToDelete(c)}
                  className="p-1 text-stone-400 hover:text-red-400"
                  title="Delete category"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* DELETE CONFIRMATION MODAL */}
      {categoryToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-lg max-w-sm w-full p-6 space-y-4 shadow-xl text-xs">
            <div className="flex items-center space-x-2.5 text-amber-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-bold text-white">Delete Category</h3>
            </div>
            <p className="text-stone-300">
              Are you sure you want to delete <span className="font-semibold text-white">"{categoryToDelete.name}"</span>? Excursions will need to be reassigned to other categories.
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setCategoryToDelete(null)}
                disabled={isDeleting}
                className="px-3 py-1.5 bg-stone-800 text-stone-300 rounded font-medium hover:bg-stone-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteCategory}
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
      {editingCategory && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-lg max-w-md w-full p-6 space-y-4 shadow-xl text-xs">
            <h3 className="text-base font-bold text-white">
              {editingCategory.id ? 'Edit Category' : 'Create Category'}
            </h3>

            {errorMsg && (
              <div className="p-2.5 bg-red-950/60 border border-red-800 rounded text-red-300">
                {errorMsg}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-stone-300 block mb-1 font-semibold">Category Name</label>
                <input
                  type="text"
                  value={editingCategory.name || ''}
                  onChange={(e) => {
                    const name = e.target.value;
                    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
                    setEditingCategory({ ...editingCategory, name, slug: editingCategory.slug || slug });
                  }}
                  placeholder="e.g. Scuba Diving Expeditions"
                  className="w-full px-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-white"
                />
              </div>

              <div>
                <label className="text-stone-300 block mb-1 font-semibold">URL Slug</label>
                <input
                  type="text"
                  value={editingCategory.slug || ''}
                  onChange={(e) => setEditingCategory({ ...editingCategory, slug: e.target.value })}
                  placeholder="scuba-diving"
                  className="w-full px-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-white"
                />
              </div>

              <div>
                <label className="text-stone-300 block mb-1 font-semibold">Description</label>
                <textarea
                  rows={3}
                  value={editingCategory.description || ''}
                  onChange={(e) => setEditingCategory({ ...editingCategory, description: e.target.value })}
                  className="w-full px-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-white"
                />
              </div>

              <div>
                <label className="text-stone-300 block mb-1 font-semibold">Cover Image URL</label>
                <input
                  type="text"
                  value={editingCategory.image || ''}
                  onChange={(e) => setEditingCategory({ ...editingCategory, image: e.target.value })}
                  className="w-full px-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingCategory(null)}
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
                {saving ? 'Saving...' : 'Save Category'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
