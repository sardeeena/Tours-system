import React, { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Filter,
  Eye,
  Edit2,
  Copy,
  Archive,
  Trash2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ArrowUpDown,
  MoreVertical,
  ExternalLink,
  Star
} from 'lucide-react';
import {
  adminListTours,
  adminSetTourStatus,
  adminDeleteTour,
  adminCheckTourBookingsCount,
  adminCreateTour,
  adminGetTourById,
  notifyCatalogueDataChanged
} from '../../services/tourService';
import { DbTour } from '../../types/database';
import { AdminTab } from './AdminLayout';
import { useToast } from '../../contexts/ToastContext';

interface AdminTourListProps {
  onNavigateTab: (tab: AdminTab, param?: string) => void;
  onPreviewTour: (slug: string) => void;
}

export const AdminTourList: React.FC<AdminTourListProps> = ({
  onNavigateTab,
  onPreviewTour,
}) => {
  const { showToast } = useToast();
  const [tours, setTours] = useState<DbTour[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft' | 'archived' | 'featured'>('all');
  const [sortField, setSortField] = useState<'title' | 'price' | 'status' | 'updated_at'>('updated_at');
  const [sortAsc, setSortAsc] = useState(false);

  // Delete Safety Modal state
  const [deleteModalTour, setDeleteModalTour] = useState<DbTour | null>(null);
  const [associatedBookingsCount, setAssociatedBookingsCount] = useState<number>(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadTours = async () => {
    setLoading(true);
    try {
      const data = await adminListTours();
      setTours(data);
    } catch (err: any) {
      console.error('Error loading tours:', err);
      showToast(err.message || 'Failed to load excursions from database', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTours();
  }, []);

  const handleToggleStatus = async (tour: DbTour) => {
    const nextStatus = tour.status === 'published' ? 'draft' : 'published';
    try {
      await adminSetTourStatus(tour.id, nextStatus);
      showToast(`Tour status updated to ${nextStatus}`, 'success');
      await loadTours();
      notifyCatalogueDataChanged('tours');
    } catch (err: any) {
      showToast(err.message || 'Failed to update status', 'error');
    }
  };

  const handleArchive = async (tour: DbTour) => {
    try {
      await adminSetTourStatus(tour.id, 'archived');
      showToast('Tour archived successfully', 'info');
      await loadTours();
      notifyCatalogueDataChanged('tours');
    } catch (err: any) {
      showToast(err.message || 'Failed to archive', 'error');
    }
  };

  const handleDuplicate = async (tour: DbTour) => {
    try {
      setLoading(true);
      const full = await adminGetTourById(tour.id);
      if (!full) return;

      const randomSuffix = Math.floor(100 + Math.random() * 900);
      const newSlug = `${tour.slug}-copy-${randomSuffix}`;
      const newTitle = `${tour.title} (Copy)`;

      await adminCreateTour({
        tour: {
          ...tour,
          title: newTitle,
          slug: newSlug,
          status: 'draft',
          featured: false,
        },
        highlights: full.highlights.map((h) => h.item),
        inclusions: full.inclusions.map((i) => i.item),
        exclusions: full.exclusions.map((e) => e.item),
        itinerary: full.itinerary.map((it) => ({ time: it.time, title: it.title, description: it.description })),
        faqs: full.faqs.map((f) => ({ question: f.question, answer: f.answer })),
        images: full.images.map((img) => ({ image_url: img.image_url, is_primary: img.is_primary, alt_text: img.alt_text })),
      });

      showToast(`Tour duplicated as "${newTitle}"`, 'success');
      await loadTours();
      notifyCatalogueDataChanged('tours');
    } catch (err: any) {
      showToast(err.message || 'Failed to duplicate tour', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openDeleteModal = async (tour: DbTour) => {
    setDeleteError(null);
    setDeleteModalTour(tour);
    const count = await adminCheckTourBookingsCount(tour.id);
    setAssociatedBookingsCount(count);
  };

  const confirmDelete = async () => {
    if (!deleteModalTour) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await adminDeleteTour(deleteModalTour.id);
      setDeleteModalTour(null);
      await loadTours();
      notifyCatalogueDataChanged('tours');
    } catch (err: any) {
      setDeleteError(err.message || 'Deletion failed');
    } finally {
      setIsDeleting(false);
    }
  };

  // Filter & sort logic
  const filteredTours = tours
    .filter((tour) => {
      const matchSearch =
        tour.title.toLowerCase().includes(search.toLowerCase()) ||
        tour.slug.toLowerCase().includes(search.toLowerCase());

      if (!matchSearch) return false;

      if (statusFilter === 'all') return true;
      if (statusFilter === 'featured') return tour.featured;
      return tour.status === statusFilter;
    })
    .sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];
      if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
      }
      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display text-white tracking-tight">
            Tour Catalog CMS
          </h1>
          <p className="text-xs text-stone-400 mt-1">
            Manage public visibility, pricing, itineraries, and media stored in Supabase.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigateTab('tour_new')}
          className="flex items-center space-x-2 px-3.5 py-2 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded text-xs font-semibold shadow transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Tour</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-stone-950 p-4 rounded-lg border border-stone-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tours by title or URL slug..."
            className="w-full pl-9 pr-4 py-2 bg-stone-900 border border-stone-800 rounded text-xs text-white placeholder-stone-500 focus:outline-none focus:border-[#0A6C74]"
          />
        </div>

        {/* Status Filter Buttons */}
        <div className="flex items-center space-x-1.5 overflow-x-auto text-xs">
          {(['all', 'published', 'draft', 'archived', 'featured'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded capitalize whitespace-nowrap transition-colors ${
                statusFilter === st
                  ? 'bg-[#0A6C74] text-white font-semibold'
                  : 'bg-stone-900 text-stone-400 hover:text-stone-200 border border-stone-800'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Main Tours Table */}
      <div className="bg-stone-950 border border-stone-800 rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-stone-400 space-y-2">
            <div className="w-6 h-6 border-2 border-[#0A6C74] border-t-transparent rounded-full animate-spin mx-auto" />
            <p>Loading tours from Supabase...</p>
          </div>
        ) : filteredTours.length === 0 ? (
          <div className="p-12 text-center text-xs text-stone-400 space-y-3">
            <p>No tours match your current search or filter criteria.</p>
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setStatusFilter('all');
              }}
              className="text-xs text-[#2dd4bf] hover:underline"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-900/80 text-stone-400 border-b border-stone-800">
                <tr>
                  <th className="py-3 px-4 font-semibold">Image</th>
                  <th
                    className="py-3 px-4 font-semibold cursor-pointer hover:text-white"
                    onClick={() => {
                      setSortField('title');
                      setSortAsc(!sortAsc);
                    }}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Tour Name & Slug</span>
                      <ArrowUpDown className="w-3 h-3 text-stone-500" />
                    </div>
                  </th>
                  <th className="py-3 px-4 font-semibold">Duration / Type</th>
                  <th
                    className="py-3 px-4 font-semibold cursor-pointer hover:text-white"
                    onClick={() => {
                      setSortField('price');
                      setSortAsc(!sortAsc);
                    }}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Price</span>
                      <ArrowUpDown className="w-3 h-3 text-stone-500" />
                    </div>
                  </th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold">Featured</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800/60 text-stone-300">
                {filteredTours.map((tour) => (
                  <tr key={tour.id} className="hover:bg-stone-900/40 transition-colors">
                    {/* Primary Image Thumbnail */}
                    <td className="py-3 px-4 w-16">
                      <div className="w-14 h-10 rounded overflow-hidden bg-stone-900 border border-stone-800 relative">
                        <img
                          src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=120&q=80"
                          alt={tour.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </td>

                    {/* Title & Slug */}
                    <td className="py-3 px-4 max-w-[280px]">
                      <span className="font-semibold text-white block text-xs truncate">
                        {tour.title}
                      </span>
                      <span className="font-mono text-[11px] text-stone-400 block truncate">
                        /{tour.slug}
                      </span>
                    </td>

                    {/* Duration / Type */}
                    <td className="py-3 px-4 whitespace-nowrap text-stone-400 text-[11px]">
                      <span className="text-stone-300 block font-medium">{tour.duration}</span>
                      <span>{tour.tour_type} Experience</span>
                    </td>

                    {/* Pricing */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-bold text-white block">
                        €{tour.price}
                      </span>
                      <span className="text-[10px] text-stone-400">
                        Child: €{tour.child_price || 0}
                      </span>
                    </td>

                    {/* Status Badge */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold capitalize ${
                          tour.status === 'published'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : tour.status === 'draft'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-stone-800 text-stone-400 border border-stone-700'
                        }`}
                      >
                        {tour.status}
                      </span>
                    </td>

                    {/* Featured Star */}
                    <td className="py-3 px-4">
                      {tour.featured ? (
                        <span className="inline-flex items-center text-amber-400 text-xs">
                          <Star className="w-3.5 h-3.5 fill-current mr-1" />
                          <span className="text-[11px]">Featured</span>
                        </span>
                      ) : (
                        <span className="text-stone-600 text-[11px]">—</span>
                      )}
                    </td>

                    {/* Action buttons */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end space-x-1">
                        {/* Preview Public Page */}
                        <button
                          type="button"
                          onClick={() => onPreviewTour(tour.slug)}
                          className="p-1.5 text-stone-400 hover:text-white rounded hover:bg-stone-800 transition-colors"
                          title="Preview public page (works for drafts too)"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {/* Edit CMS */}
                        <button
                          type="button"
                          onClick={() => onNavigateTab('tour_edit', tour.id)}
                          className="p-1.5 text-[#2dd4bf] hover:text-white rounded hover:bg-stone-800 transition-colors"
                          title="Edit complete tour content"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Duplicate */}
                        <button
                          type="button"
                          onClick={() => handleDuplicate(tour)}
                          className="p-1.5 text-stone-400 hover:text-white rounded hover:bg-stone-800 transition-colors"
                          title="Duplicate as new draft"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>

                        {/* Publish / Unpublish Toggle */}
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(tour)}
                          className={`p-1.5 rounded hover:bg-stone-800 transition-colors ${
                            tour.status === 'published'
                              ? 'text-amber-400 hover:text-amber-300'
                              : 'text-emerald-400 hover:text-emerald-300'
                          }`}
                          title={tour.status === 'published' ? 'Unpublish (set to draft)' : 'Publish to live website'}
                        >
                          {tour.status === 'published' ? (
                            <XCircle className="w-3.5 h-3.5" />
                          ) : (
                            <CheckCircle className="w-3.5 h-3.5" />
                          )}
                        </button>

                        {/* Archive */}
                        <button
                          type="button"
                          onClick={() => handleArchive(tour)}
                          className="p-1.5 text-stone-400 hover:text-stone-200 rounded hover:bg-stone-800 transition-colors"
                          title="Archive tour"
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete with safety */}
                        <button
                          type="button"
                          onClick={() => openDeleteModal(tour)}
                          className="p-1.5 text-red-400/80 hover:text-red-300 rounded hover:bg-red-950/40 transition-colors"
                          title="Delete tour (safe check)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DELETE SAFETY MODAL */}
      {deleteModalTour && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-lg max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center space-x-3 text-red-400">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Confirm Tour Deletion</h3>
                <p className="text-xs text-stone-400">Permanent database action</p>
              </div>
            </div>

            <p className="text-xs text-stone-300">
              Are you sure you want to permanently delete{' '}
              <strong className="text-white font-semibold">"{deleteModalTour.title}"</strong>?
            </p>

            {/* If tour has existing bookings */}
            {associatedBookingsCount > 0 ? (
              <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded text-xs text-amber-200 space-y-2">
                <p className="font-semibold flex items-center space-x-1.5 text-amber-300">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Deletion Blocked: Existing Guest Bookings</span>
                </p>
                <p>
                  This excursion has <strong className="text-white">{associatedBookingsCount}</strong> active or historical customer booking record(s). To protect guest vouchers and audit records, permanent deletion is prevented.
                </p>
                <p className="text-[11px] text-amber-300/80">
                  Please click <strong>"Archive Tour Instead"</strong> to immediately remove it from all public listings while preserving passenger records.
                </p>
              </div>
            ) : (
              <p className="text-xs text-stone-400">
                This tour has zero associated booking records and will be purged from Supabase along with its itinerary, inclusions, and image associations.
              </p>
            )}

            {deleteError && (
              <div className="p-3 bg-red-950/60 border border-red-800 rounded text-xs text-red-200">
                {deleteError}
              </div>
            )}

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModalTour(null)}
                className="px-3 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded text-xs font-semibold transition-colors"
              >
                Cancel
              </button>

              {associatedBookingsCount > 0 ? (
                <button
                  type="button"
                  onClick={async () => {
                    await handleArchive(deleteModalTour);
                    setDeleteModalTour(null);
                  }}
                  className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-semibold shadow transition-colors"
                >
                  Archive Tour Instead
                </button>
              ) : (
                <button
                  type="button"
                  onClick={confirmDelete}
                  disabled={isDeleting}
                  className="px-3.5 py-2 bg-red-600 hover:bg-red-500 text-white rounded text-xs font-semibold shadow transition-colors disabled:opacity-50"
                >
                  {isDeleting ? 'Deleting...' : 'Permanently Delete'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
