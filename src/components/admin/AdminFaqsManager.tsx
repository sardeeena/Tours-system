import React, { useState, useEffect } from 'react';
import {
  HelpCircle,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  MoveUp,
  MoveDown,
  AlertTriangle,
  RefreshCw,
  FolderOpen,
} from 'lucide-react';
import {
  getFaqs,
  createFaq,
  updateFaq,
  deleteFaq,
} from '../../services/faqService';
import { DbFaq } from '../../types/database';
import { useToast } from '../../contexts/ToastContext';

type FaqCategory = 'all' | 'general' | 'booking' | 'cancellation' | 'marine_safety' | 'transfers';

const CATEGORY_LABELS: Record<string, string> = {
  general: 'General & Marina',
  booking: 'Reservations & Payments',
  cancellation: 'Cancellations & Weather',
  marine_safety: 'Marine Safety & Diving',
  transfers: 'Hotel Transfers & Logistics',
};

export const AdminFaqsManager: React.FC = () => {
  const { showToast } = useToast();
  const [faqs, setFaqs] = useState<DbFaq[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<FaqCategory>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFaq, setEditingFaq] = useState<Partial<DbFaq> | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete Confirmation
  const [faqToDelete, setFaqToDelete] = useState<DbFaq | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getFaqs();
      setFaqs(data);
    } catch (err) {
      console.error('Error fetching FAQs:', err);
      showToast('Failed to load FAQs', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenCreate = () => {
    setFormError(null);
    setEditingFaq({
      category: selectedCategory === 'all' ? 'booking' : selectedCategory,
      question: '',
      answer: '',
      sort_order: faqs.length + 1,
      is_published: true,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (faq: DbFaq) => {
    setFormError(null);
    setEditingFaq({ ...faq });
    setIsModalOpen(true);
  };

  const handleTogglePublish = async (faq: DbFaq) => {
    try {
      const nextStatus = !faq.is_published;
      await updateFaq(faq.id, { is_published: nextStatus });
      setFaqs((prev) =>
        prev.map((f) => (f.id === faq.id ? { ...f, is_published: nextStatus } : f))
      );
      showToast(`FAQ ${nextStatus ? 'published' : 'unpublished'}.`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to update FAQ status', 'error');
    }
  };

  const handleMoveSort = async (faq: DbFaq, direction: 'up' | 'down') => {
    const currentOrder = faq.sort_order;
    const nextOrder = direction === 'up' ? Math.max(1, currentOrder - 1) : currentOrder + 1;
    try {
      await updateFaq(faq.id, { sort_order: nextOrder });
      setFaqs((prev) =>
        prev
          .map((f) => (f.id === faq.id ? { ...f, sort_order: nextOrder } : f))
          .sort((a, b) => a.sort_order - b.sort_order)
      );
      showToast('FAQ order adjusted', 'info');
    } catch (err: any) {
      showToast(err.message || 'Failed to reorder', 'error');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFaq?.question?.trim() || !editingFaq?.answer?.trim()) {
      setFormError('Question and answer are required.');
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      const payload = {
        category: (editingFaq.category as any) || 'general',
        question: editingFaq.question.trim(),
        answer: editingFaq.answer.trim(),
        sort_order: Number(editingFaq.sort_order) || 1,
        is_published: editingFaq.is_published ?? true,
      };

      if (editingFaq.id) {
        await updateFaq(editingFaq.id, payload);
        showToast('FAQ updated successfully.', 'success');
      } else {
        await createFaq(payload);
        showToast('FAQ created successfully.', 'success');
      }

      setIsModalOpen(false);
      setEditingFaq(null);
      await loadData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save FAQ.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!faqToDelete) return;
    setIsDeleting(true);
    try {
      await deleteFaq(faqToDelete.id);
      showToast('FAQ removed permanently.', 'success');
      setFaqs((prev) => prev.filter((f) => f.id !== faqToDelete.id));
      setFaqToDelete(null);
    } catch (err: any) {
      showToast(err.message || 'Failed to delete FAQ', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredFaqs = faqs.filter((f) => {
    if (selectedCategory !== 'all' && f.category !== selectedCategory) {
      return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        f.question.toLowerCase().includes(q) ||
        f.answer.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display text-white tracking-tight flex items-center space-x-2">
            <HelpCircle className="w-6 h-6 text-[#2dd4bf]" />
            <span>Frequently Asked Questions (FAQs)</span>
          </h1>
          <p className="text-xs text-stone-400 mt-1">
            Manage global traveler FAQs displayed across booking steps, pier guidelines, and excursion detail panels.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="p-2 bg-stone-900 border border-stone-800 text-stone-300 hover:text-white rounded text-xs transition-colors cursor-pointer"
            title="Refresh FAQs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center space-x-1.5 px-4 py-2 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded text-xs font-semibold shadow transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add New FAQ</span>
          </button>
        </div>
      </div>

      {/* Categories and Search */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-stone-950 border border-stone-800 rounded-lg p-3 text-xs">
        <div className="relative w-full md:w-80">
          <Search className="w-3.5 h-3.5 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search questions or answers..."
            className="w-full pl-9 pr-3 py-1.5 bg-stone-900 border border-stone-800 rounded text-stone-200 placeholder-stone-500 focus:outline-none focus:border-[#0A6C74]"
          />
        </div>

        <div className="flex items-center space-x-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {(['all', 'booking', 'cancellation', 'marine_safety', 'transfers', 'general'] as const).map(
            (cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded text-xs whitespace-nowrap font-medium transition-colors ${
                  selectedCategory === cat
                    ? 'bg-[#0A6C74] text-white'
                    : 'text-stone-400 hover:text-white bg-stone-900 border border-stone-800'
                }`}
              >
                {cat === 'all' ? 'All Categories' : CATEGORY_LABELS[cat] || cat}
              </button>
            )
          )}
        </div>
      </div>

      {/* FAQs List */}
      {loading ? (
        <div className="p-12 text-center text-stone-400">
          <div className="w-8 h-8 border-2 border-[#0A6C74] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs">Loading FAQ repository...</p>
        </div>
      ) : filteredFaqs.length === 0 ? (
        <div className="bg-stone-950 border border-stone-800 rounded-xl p-12 text-center text-stone-400 space-y-2">
          <FolderOpen className="w-8 h-8 text-stone-600 mx-auto" />
          <p className="text-sm font-semibold text-stone-300">No questions found</p>
          <p className="text-xs text-stone-500">
            {search ? 'No FAQs match your search.' : 'Add your first traveler question above.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredFaqs.map((faq, idx) => (
            <div
              key={faq.id}
              className="bg-stone-950 border border-stone-800 hover:border-stone-700 rounded-xl p-4 transition-colors space-y-2"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start space-x-3">
                  <span className="font-mono text-xs font-bold text-stone-500 bg-stone-900 border border-stone-800 px-2 py-1 rounded shrink-0">
                    #{faq.sort_order || idx + 1}
                  </span>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-[#0A6C74]/20 text-[#2dd4bf] border border-[#0A6C74]/30">
                        {CATEGORY_LABELS[faq.category] || faq.category}
                      </span>
                      {!faq.is_published && (
                        <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                          Draft (Unpublished)
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-bold text-white mt-1 leading-snug">
                      {faq.question}
                    </h3>
                  </div>
                </div>

                <div className="flex items-center space-x-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleMoveSort(faq, 'up')}
                    className="p-1 text-stone-500 hover:text-white rounded hover:bg-stone-800 transition-colors cursor-pointer"
                    title="Move Up"
                  >
                    <MoveUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveSort(faq, 'down')}
                    className="p-1 text-stone-500 hover:text-white rounded hover:bg-stone-800 transition-colors cursor-pointer"
                    title="Move Down"
                  >
                    <MoveDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTogglePublish(faq)}
                    className="p-1.5 text-stone-400 hover:text-emerald-400 rounded hover:bg-stone-800 transition-colors cursor-pointer"
                    title={faq.is_published ? 'Unpublish' : 'Publish'}
                  >
                    {faq.is_published ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <XCircle className="w-4 h-4 text-stone-500" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(faq)}
                    className="p-1.5 text-stone-400 hover:text-white rounded hover:bg-stone-800 transition-colors cursor-pointer"
                    title="Edit FAQ"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setFaqToDelete(faq)}
                    className="p-1.5 text-stone-400 hover:text-red-400 rounded hover:bg-stone-800 transition-colors cursor-pointer"
                    title="Delete FAQ"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <p className="text-xs text-stone-300 leading-relaxed pl-10">
                {faq.answer}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {isModalOpen && editingFaq && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl text-xs max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <HelpCircle className="w-4 h-4 text-[#2dd4bf]" />
                <span>{editingFaq.id ? 'Edit FAQ' : 'Add New FAQ'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-stone-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-300 rounded text-xs flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-stone-300 font-semibold mb-1">Category *</label>
                <select
                  value={editingFaq.category || 'booking'}
                  onChange={(e) =>
                    setEditingFaq({ ...editingFaq, category: e.target.value as any })
                  }
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded text-white focus:outline-none focus:border-[#0A6C74]"
                >
                  <option value="booking">Reservations & Payments</option>
                  <option value="cancellation">Cancellations & Weather</option>
                  <option value="transfers">Hotel Transfers & Logistics</option>
                  <option value="marine_safety">Marine Safety & Diving</option>
                  <option value="general">General & Marina</option>
                </select>
              </div>

              <div>
                <label className="block text-stone-300 font-semibold mb-1">
                  Traveler Question *
                </label>
                <input
                  type="text"
                  required
                  value={editingFaq.question || ''}
                  onChange={(e) => setEditingFaq({ ...editingFaq, question: e.target.value })}
                  placeholder="e.g. Is lunch and drinking water included on full-day boat trips?"
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded text-white focus:outline-none focus:border-[#0A6C74]"
                />
              </div>

              <div>
                <label className="block text-stone-300 font-semibold mb-1">
                  Authoritative Answer *
                </label>
                <textarea
                  rows={4}
                  required
                  value={editingFaq.answer || ''}
                  onChange={(e) => setEditingFaq({ ...editingFaq, answer: e.target.value })}
                  placeholder="Provide clear, transparent details including timings, inclusions, and guidelines..."
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded text-white focus:outline-none focus:border-[#0A6C74]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-300 font-semibold mb-1">Sort Order</label>
                  <input
                    type="number"
                    min="1"
                    value={editingFaq.sort_order ?? 1}
                    onChange={(e) =>
                      setEditingFaq({ ...editingFaq, sort_order: parseInt(e.target.value, 10) || 1 })
                    }
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded text-white focus:outline-none focus:border-[#0A6C74]"
                  />
                </div>

                <div className="flex items-center pt-6">
                  <label className="inline-flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingFaq.is_published ?? true}
                      onChange={(e) =>
                        setEditingFaq({ ...editingFaq, is_published: e.target.checked })
                      }
                      className="rounded bg-stone-950 border-stone-800 text-[#0A6C74] focus:ring-0"
                    />
                    <span className="text-stone-300 font-medium">Published on Website</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={saving}
                  className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-1.5 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded font-semibold disabled:opacity-50 cursor-pointer shadow"
                >
                  {saving ? 'Saving...' : editingFaq.id ? 'Save Changes' : 'Create FAQ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {faqToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-xl max-w-sm w-full p-6 space-y-4 shadow-2xl text-xs">
            <div className="flex items-center space-x-2.5 text-amber-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-bold text-white">Delete FAQ</h3>
            </div>
            <p className="text-stone-300 leading-relaxed">
              Are you sure you want to permanently delete this FAQ:
              <br />
              <strong className="text-white mt-1 block italic">"{faqToDelete.question}"</strong>
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-stone-800">
              <button
                type="button"
                onClick={() => setFaqToDelete(null)}
                disabled={isDeleting}
                className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={isDeleting}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded font-semibold disabled:opacity-50 cursor-pointer"
              >
                {isDeleting ? 'Deleting...' : 'Delete FAQ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
