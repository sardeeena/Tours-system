import React, { useState, useEffect, useMemo } from 'react';
import {
  Star,
  CheckCircle2,
  XCircle,
  Trash2,
  Plus,
  Search,
  Filter,
  ShieldCheck,
  MessageSquare,
  Calendar,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  X,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { supabase, isSupabaseConfigured, formatSupabaseError } from '../../services/supabaseClient';
import { adminListTours, notifyCatalogueDataChanged } from '../../services/tourService';
import { DbTour, DbReview } from '../../types/database';
import { useToast } from '../../contexts/ToastContext';

const LOCAL_REVIEWS_KEY = 'rse_admin_reviews_cache';

export const AdminReviewsList: React.FC = () => {
  const { showToast } = useToast();
  const [reviews, setReviews] = useState<DbReview[]>([]);
  const [tours, setTours] = useState<DbTour[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'pending'>('all');
  const [tourFilter, setTourFilter] = useState<string>('all');
  const [ratingFilter, setRatingFilter] = useState<number | 'all'>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [reviewToDelete, setReviewToDelete] = useState<DbReview | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // New review form state
  const [newTourId, setNewTourId] = useState('');
  const [newAuthorName, setNewAuthorName] = useState('');
  const [newCountry, setNewCountry] = useState('Germany');
  const [newRating, setNewRating] = useState(5);
  const [newTravelerType, setNewTravelerType] = useState<string>('Couple');
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load reviews from Supabase or initial catalog
  useEffect(() => {
    let isCancelled = false;

    async function loadInitialData() {
      setLoading(true);
      try {
        const loadedTours = await adminListTours();
        if (!isCancelled) {
          setTours(loadedTours);
          if (loadedTours.length > 0) {
            setNewTourId(loadedTours[0].id);
          }
        }

        if (isSupabaseConfigured()) {
          const { data, error } = await supabase
            .from('reviews')
            .select('*')
            .order('created_at', { ascending: false });

          if (!error && data) {
            if (!isCancelled) {
              setReviews(data as DbReview[]);
              setLoading(false);
              return;
            }
          }
        }

        // Fallback / cached reviews
        const cached = localStorage.getItem(LOCAL_REVIEWS_KEY);
        if (cached) {
          if (!isCancelled) {
            setReviews(JSON.parse(cached));
            setLoading(false);
            return;
          }
        }

        if (!isCancelled) {
          setReviews([]);
        }
      } catch (err) {
        console.error('Failed to load reviews:', err);
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    loadInitialData();

    return () => {
      isCancelled = true;
    };
  }, []);

  // Update status (Approve / Unpublish)
  const handleTogglePublished = async (reviewId: string, shouldPublish: boolean) => {
    const previous = [...reviews];
    const updated = reviews.map((r) => (r.id === reviewId ? { ...r, is_published: shouldPublish } : r));
    setReviews(updated);
    localStorage.setItem(LOCAL_REVIEWS_KEY, JSON.stringify(updated));

    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase.from('reviews').update({ is_published: shouldPublish }).eq('id', reviewId);
        if (error) throw error;
      } catch (err: any) {
        setReviews(previous);
        localStorage.setItem(LOCAL_REVIEWS_KEY, JSON.stringify(previous));
        showToast(`Failed to update review status: ${formatSupabaseError(err)}`, 'error');
        return;
      }
    }

    setActionMessage(shouldPublish ? 'Review published to website.' : 'Review hidden from website.');
    showToast(shouldPublish ? 'Review approved and published.' : 'Review unlisted from website.', 'success');
    notifyCatalogueDataChanged('reviews');
    setTimeout(() => setActionMessage(null), 3000);
  };

  // Delete review
  const handleDelete = (review: DbReview) => {
    setReviewToDelete(review);
  };

  const confirmDeleteReview = async () => {
    if (!reviewToDelete) return;
    setIsDeleting(true);

    const previous = [...reviews];
    const updated = reviews.filter((r) => r.id !== reviewToDelete.id);
    setReviews(updated);
    localStorage.setItem(LOCAL_REVIEWS_KEY, JSON.stringify(updated));

    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase.from('reviews').delete().eq('id', reviewToDelete.id);
        if (error) throw error;
      } catch (err: any) {
        setReviews(previous);
        localStorage.setItem(LOCAL_REVIEWS_KEY, JSON.stringify(previous));
        showToast(`Failed to delete review: ${formatSupabaseError(err)}`, 'error');
        setIsDeleting(false);
        setReviewToDelete(null);
        return;
      }
    }

    notifyCatalogueDataChanged('reviews');
    showToast(`Guest review by "${reviewToDelete.author_name}" permanently deleted.`, 'info');
    setReviewToDelete(null);
    setIsDeleting(false);
  };

  // Create new review
  const handleCreateReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTourId || !newAuthorName.trim() || !newComment.trim()) {
      showToast('Please fill out all required fields (tour, author name, and feedback comment).', 'error');
      return;
    }

    setIsSubmitting(true);
    const dateFormatted = new Date().toISOString().split('T')[0];

    // Find if newTourId is a valid UUID or needs resolving from tours
    let targetTourId: string | null = newTourId;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(newTourId);
    if (!isUuid) {
      const match = tours.find((t) => t.id === newTourId || t.slug === newTourId);
      if (match && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(match.id)) {
        targetTourId = match.id;
      } else {
        targetTourId = null;
      }
    }

    const newRev: DbReview = {
      id: `rev-${Date.now()}`,
      tour_id: targetTourId || newTourId,
      author_name: newAuthorName.trim(),
      country: newCountry,
      country_code: newCountry === 'Germany' ? 'DE' : newCountry === 'United Kingdom' ? 'GB' : 'EG',
      rating: newRating,
      comment: newComment.trim(),
      date: dateFormatted,
      traveler_type: newTravelerType,
      verified_booking: true,
      is_published: true,
      created_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured()) {
      try {
        const payload: any = {
          author_name: newRev.author_name,
          country: newRev.country,
          country_code: newRev.country_code,
          rating: newRev.rating,
          comment: newRev.comment,
          date: newRev.date,
          traveler_type: newRev.traveler_type,
          verified_booking: true,
          is_published: true,
        };
        if (targetTourId) {
          payload.tour_id = targetTourId;
        }

        const { data: inserted, error } = await supabase
          .from('reviews')
          .insert(payload)
          .select()
          .single();

        if (error) throw error;
        if (inserted?.id) {
          newRev.id = inserted.id;
        }
      } catch (err: any) {
        showToast(`Failed to create review in Supabase: ${formatSupabaseError(err)}`, 'error');
        setIsSubmitting(false);
        return;
      }
    }

    const updated = [newRev, ...reviews];
    setReviews(updated);
    localStorage.setItem(LOCAL_REVIEWS_KEY, JSON.stringify(updated));

    setIsSubmitting(false);
    setIsAddModalOpen(false);
    setNewAuthorName('');
    setNewComment('');
    notifyCatalogueDataChanged('reviews');
    showToast('New verified guest review published successfully.', 'success');
  };

  // Metrics calculation
  const totalReviews = reviews.length;
  const publishedCount = reviews.filter((r) => r.is_published).length;
  const pendingCount = reviews.filter((r) => !r.is_published).length;
  const avgRating = totalReviews > 0
    ? (reviews.reduce((acc, r) => acc + (r.rating || 5), 0) / totalReviews).toFixed(1)
    : '5.0';

  // Filtered reviews list
  const filteredReviews = useMemo(() => {
    return reviews.filter((r) => {
      // Status
      if (statusFilter === 'published' && !r.is_published) return false;
      if (statusFilter === 'pending' && r.is_published) return false;

      // Tour
      if (tourFilter !== 'all' && r.tour_id !== tourFilter) return false;

      // Rating
      if (ratingFilter !== 'all' && r.rating !== ratingFilter) return false;

      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesAuthor = r.author_name.toLowerCase().includes(q);
        const matchesComment = r.comment.toLowerCase().includes(q);
        const matchesCountry = (r.country || '').toLowerCase().includes(q);
        if (!matchesAuthor && !matchesComment && !matchesCountry) return false;
      }

      return true;
    });
  }, [reviews, statusFilter, tourFilter, ratingFilter, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display text-white tracking-tight">
            Guest Reviews & Feedback Moderation
          </h1>
          <p className="text-xs text-stone-400 mt-1">
            Review guest testimonials, approve or unpublish submissions, and monitor traveler satisfaction.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          className="inline-flex items-center space-x-1.5 px-4 py-2 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded text-xs font-semibold shadow transition-colors cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add Verified Review</span>
        </button>
      </div>

      {/* Action Notification */}
      {actionMessage && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded text-xs flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-stone-950 border border-stone-800 rounded-lg p-4">
          <div className="flex items-center justify-between text-stone-400 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Average Rating</span>
            <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-white">{avgRating}</span>
            <span className="text-xs text-stone-500">/ 5.0</span>
          </div>
          <p className="text-[10px] text-stone-400 mt-1">Across all excursions</p>
        </div>

        <div className="bg-stone-950 border border-stone-800 rounded-lg p-4">
          <div className="flex items-center justify-between text-stone-400 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Total Reviews</span>
            <MessageSquare className="w-4 h-4 text-[#2dd4bf]" />
          </div>
          <div className="text-2xl font-bold text-white">{totalReviews}</div>
          <p className="text-[10px] text-stone-400 mt-1">Verified traveler entries</p>
        </div>

        <div className="bg-stone-950 border border-stone-800 rounded-lg p-4">
          <div className="flex items-center justify-between text-stone-400 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Published</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400">{publishedCount}</div>
          <p className="text-[10px] text-stone-400 mt-1">Visible on public site</p>
        </div>

        <div className="bg-stone-950 border border-stone-800 rounded-lg p-4">
          <div className="flex items-center justify-between text-stone-400 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Hidden / Pending</span>
            <AlertCircle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400">{pendingCount}</div>
          <p className="text-[10px] text-stone-400 mt-1">Awaiting moderation</p>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="bg-stone-950 border border-stone-800 rounded-lg p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search author, comment..."
              className="w-full pl-9 pr-3 py-2 bg-stone-900 border border-stone-800 rounded text-stone-200 placeholder-stone-500 focus:outline-none focus:border-[#0A6C74]"
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded text-stone-200 focus:outline-none focus:border-[#0A6C74]"
            >
              <option value="all">All Moderation States</option>
              <option value="published">Published Only</option>
              <option value="pending">Hidden / Pending</option>
            </select>
          </div>

          {/* Tour Filter */}
          <div>
            <select
              value={tourFilter}
              onChange={(e) => setTourFilter(e.target.value)}
              className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded text-stone-200 focus:outline-none focus:border-[#0A6C74] truncate"
            >
              <option value="all">All Excursions</option>
              {tours.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </div>

          {/* Rating Filter */}
          <div>
            <select
              value={ratingFilter}
              onChange={(e) => setRatingFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded text-stone-200 focus:outline-none focus:border-[#0A6C74]"
            >
              <option value="all">All Star Ratings</option>
              <option value="5">⭐⭐⭐⭐⭐ (5 Stars)</option>
              <option value="4">⭐⭐⭐⭐ (4 Stars)</option>
              <option value="3">⭐⭐⭐ (3 Stars)</option>
              <option value="2">⭐⭐ (2 Stars)</option>
              <option value="1">⭐ (1 Star)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Reviews Table / Card Grid */}
      <div className="bg-stone-950 border border-stone-800 rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-stone-400">
            <div className="w-8 h-8 border-2 border-[#0A6C74] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs">Loading customer reviews...</p>
          </div>
        ) : filteredReviews.length === 0 ? (
          <div className="p-12 text-center text-stone-400 space-y-2">
            <MessageSquare className="w-8 h-8 text-stone-600 mx-auto" />
            <p className="text-sm font-semibold text-stone-300">No reviews found matching your filter criteria</p>
            <p className="text-xs text-stone-500">Try adjusting your search terms or moderation filter.</p>
          </div>
        ) : (
          <div className="divide-y divide-stone-800">
            {filteredReviews.map((rev) => {
              const matchedTour = tours.find((t) => t.id === rev.tour_id);

              return (
                <div key={rev.id} className="p-4 sm:p-5 hover:bg-stone-900/40 transition-colors space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center space-x-3">
                      {/* Rating Stars */}
                      <div className="flex items-center text-amber-400">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`w-3.5 h-3.5 ${
                              star <= rev.rating ? 'fill-amber-400 text-amber-400' : 'text-stone-700'
                            }`}
                          />
                        ))}
                      </div>

                      <span className="font-semibold text-sm text-white">
                        {rev.author_name}
                      </span>

                      {rev.country && (
                        <span className="text-xs text-stone-400">
                          ({rev.country})
                        </span>
                      )}

                      {rev.traveler_type && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-stone-800 text-stone-300">
                          {rev.traveler_type}
                        </span>
                      )}

                      <span className="inline-flex items-center text-[10px] text-emerald-400 space-x-1">
                        <ShieldCheck className="w-3 h-3" />
                        <span>Verified Guest</span>
                      </span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className="text-[11px] text-stone-500">
                        {rev.date || new Date(rev.created_at).toLocaleDateString()}
                      </span>

                      {/* Status Badge */}
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                          rev.is_published
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {rev.is_published ? 'Published' : 'Hidden'}
                      </span>
                    </div>
                  </div>

                  {/* Tour Association */}
                  <div className="text-xs text-[#2dd4bf] font-medium flex items-center space-x-1.5">
                    <Calendar className="w-3.5 h-3.5 text-stone-500" />
                    <span>{matchedTour ? matchedTour.title : 'Red Sea Excursion'}</span>
                  </div>

                  {/* Comment */}
                  <p className="text-xs text-stone-300 leading-relaxed bg-stone-900/60 p-3 rounded border border-stone-850">
                    "{rev.comment}"
                  </p>

                  {/* Moderation Controls */}
                  <div className="flex items-center justify-between pt-1 text-xs">
                    <div className="flex items-center space-x-2">
                      {!rev.is_published ? (
                        <button
                          type="button"
                          onClick={() => handleTogglePublished(rev.id, true)}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-700/60 text-emerald-300 rounded text-[11px] transition-colors cursor-pointer"
                        >
                          <Check className="w-3 h-3" />
                          <span>Approve & Publish</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleTogglePublished(rev.id, false)}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 bg-stone-850 hover:bg-stone-800 border border-stone-700 text-stone-300 rounded text-[11px] transition-colors cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                          <span>Hide from Site</span>
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDelete(rev)}
                      className="text-stone-500 hover:text-red-400 transition-colors p-1 cursor-pointer"
                      title="Delete review"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Review Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-stone-800">
              <h2 className="text-base font-bold text-white">Add Verified Guest Review</h2>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-stone-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateReview} className="space-y-4 text-xs">
              <div>
                <label className="text-stone-300 font-semibold block mb-1">Target Excursion</label>
                <select
                  value={newTourId}
                  onChange={(e) => setNewTourId(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded text-white focus:outline-none focus:border-[#0A6C74]"
                  required
                >
                  {tours.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-stone-300 font-semibold block mb-1">Guest Full Name</label>
                  <input
                    type="text"
                    value={newAuthorName}
                    onChange={(e) => setNewAuthorName(e.target.value)}
                    placeholder="e.g. Markus W."
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded text-white focus:outline-none focus:border-[#0A6C74]"
                    required
                  />
                </div>

                <div>
                  <label className="text-stone-300 font-semibold block mb-1">Guest Country</label>
                  <input
                    type="text"
                    value={newCountry}
                    onChange={(e) => setNewCountry(e.target.value)}
                    placeholder="e.g. Germany"
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded text-white focus:outline-none focus:border-[#0A6C74]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-stone-300 font-semibold block mb-1">Rating (1 to 5 Stars)</label>
                  <select
                    value={newRating}
                    onChange={(e) => setNewRating(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded text-white focus:outline-none focus:border-[#0A6C74]"
                  >
                    <option value={5}>5 Stars - Outstanding</option>
                    <option value={4}>4 Stars - Very Good</option>
                    <option value={3}>3 Stars - Average</option>
                    <option value={2}>2 Stars - Below Expectations</option>
                    <option value={1}>1 Star - Poor</option>
                  </select>
                </div>

                <div>
                  <label className="text-stone-300 font-semibold block mb-1">Traveler Type</label>
                  <select
                    value={newTravelerType}
                    onChange={(e) => setNewTravelerType(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded text-white focus:outline-none focus:border-[#0A6C74]"
                  >
                    <option value="Couple">Couple</option>
                    <option value="Family">Family</option>
                    <option value="Friends">Friends</option>
                    <option value="Solo">Solo Traveler</option>
                    <option value="Business">Business</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-stone-300 font-semibold block mb-1">Review Text / Comment</label>
                <textarea
                  rows={4}
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Detailed traveler feedback..."
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded text-white focus:outline-none focus:border-[#0A6C74]"
                  required
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded font-medium transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Saving...' : 'Publish Review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Review Confirmation Modal */}
      {reviewToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-xl max-w-sm w-full p-6 space-y-4 shadow-2xl text-xs">
            <div className="flex items-center space-x-2.5 text-amber-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-bold text-white">Delete Guest Review</h3>
            </div>
            <p className="text-stone-300 leading-relaxed">
              Are you sure you want to permanently delete the {reviewToDelete.rating}★ review by <strong className="text-white">{reviewToDelete.author_name}</strong>?
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-stone-800">
              <button
                type="button"
                onClick={() => setReviewToDelete(null)}
                disabled={isDeleting}
                className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteReview}
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
