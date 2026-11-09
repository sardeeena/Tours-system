import React, { useState, useEffect } from 'react';
import { Star, MessageSquare, CheckCircle, X, AlertCircle } from 'lucide-react';
import { Tour, Review } from '../../types';
import { submitTourReview, getPublishedReviews } from '../../services/tourService';

interface TourReviewsProps {
  tour: Tour;
}

export const TourReviews: React.FC<TourReviewsProps> = ({ tour }) => {
  const [reviewsList, setReviewsList] = useState<Review[]>(tour.reviews || []);
  const [writeModalOpen, setWriteModalOpen] = useState(false);
  const [submittedMessage, setSubmittedMessage] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Form states
  const [rating, setRating] = useState(5);
  const [authorName, setAuthorName] = useState('');
  const [country, setCountry] = useState('Germany');
  const [travelerType, setTravelerType] = useState<'Couple' | 'Family' | 'Solo' | 'Friends'>('Couple');
  const [comment, setComment] = useState('');

  // Fetch or sync reviews for this tour
  useEffect(() => {
    let isCancelled = false;

    async function fetchReviews() {
      if (tour.reviews && tour.reviews.length > 0) {
        setReviewsList(tour.reviews);
        return;
      }
      try {
        const res = await getPublishedReviews(tour.slug);
        if (!isCancelled) {
          setReviewsList(res.reviews);
        }
      } catch (err) {
        console.warn('Could not load tour reviews:', err);
      }
    }

    fetchReviews();

    const handleDataUpdated = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (!customEvent.detail?.entity || customEvent.detail.entity === 'reviews') {
        fetchReviews();
      }
    };

    window.addEventListener('rse_data_updated', handleDataUpdated);
    return () => {
      isCancelled = true;
      window.removeEventListener('rse_data_updated', handleDataUpdated);
    };
  }, [tour.slug, tour.reviews]);

  // Genuine review metrics computed strictly from database records
  const totalReviews = reviewsList.length;
  const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  let sumRating = 0;

  for (const rev of reviewsList) {
    const star = Math.min(5, Math.max(1, Math.round(rev.rating))) as 1 | 2 | 3 | 4 | 5;
    breakdown[star] = (breakdown[star] || 0) + 1;
    sumRating += rev.rating;
  }

  const averageRating = totalReviews > 0 ? Number((sumRating / totalReviews).toFixed(1)) : 0;

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authorName.trim() || !comment.trim()) {
      setSubmitError('Please provide your name and review comments.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await submitTourReview({
        tourId: tour.id,
        tourSlug: tour.slug,
        authorName: authorName.trim(),
        country,
        rating,
        comment: comment.trim(),
        travelerType,
      });
      setSubmittedMessage(true);
    } catch (err: any) {
      console.error('Failed to submit review:', err);
      setSubmitError(err?.message || 'Could not submit review at this time.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div id="tour-reviews-container" className="space-y-6">
      
      {/* Section Header & Write CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-stone-200 dark:border-slate-800 gap-3">
        <div>
          <h3 className="font-display text-lg font-bold text-[#0E1B2A] dark:text-white">
            Guest Reviews & Feedback
          </h3>
          <p className="text-xs text-stone-500 dark:text-slate-400">
            {totalReviews > 0
              ? `Verified impressions for ${tour.title}`
              : `Share the first review for ${tour.title}`}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setSubmitError(null);
            setSubmittedMessage(false);
            setWriteModalOpen(true);
          }}
          className="px-3.5 py-1.5 border border-stone-300 dark:border-slate-700 rounded-sm bg-white dark:bg-[#132235] hover:bg-stone-50 dark:hover:bg-[#1a2d42] text-stone-800 dark:text-slate-200 text-xs font-semibold self-start sm:self-auto transition-colors flex items-center space-x-1.5 cursor-pointer"
        >
          <MessageSquare className="w-3.5 h-3.5 text-[#0A6C74] dark:text-[#60C3CC]" />
          <span>Write a Review</span>
        </button>
      </div>

      {/* Aggregate Rating & Distribution (Only displayed when real reviews exist) */}
      {totalReviews > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 p-5 bg-white dark:bg-[#132235] border border-[#E8E3DA] dark:border-slate-800 rounded-sm">
          {/* Left: Score */}
          <div className="md:col-span-4 flex flex-col items-center justify-center text-center p-3 sm:border-r border-stone-200 dark:border-slate-800">
            <span className="font-display text-4xl sm:text-5xl font-bold text-[#0E1B2A] dark:text-white font-mono">
              {averageRating.toFixed(1)}
            </span>
            <div className="flex text-[#C28D32] my-1.5">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={`w-4 h-4 ${
                    i < Math.round(averageRating)
                      ? 'fill-current'
                      : 'stroke-current text-stone-300 dark:text-slate-700'
                  }`}
                />
              ))}
            </div>
            <span className="text-xs font-medium text-stone-600 dark:text-slate-300">
              Based on {totalReviews} {totalReviews === 1 ? 'traveler rating' : 'traveler ratings'}
            </span>
            <span className="text-[10px] text-stone-400 dark:text-slate-500 mt-1">
              (Verified guest ratings)
            </span>
          </div>

          {/* Right: Distribution Bars */}
          <div className="md:col-span-8 flex flex-col justify-center space-y-2 text-xs">
            {[5, 4, 3, 2, 1].map((stars) => {
              const count = breakdown[stars as keyof typeof breakdown] || 0;
              const percentage = totalReviews > 0 ? Math.round((count / totalReviews) * 100) : 0;
              return (
                <div key={stars} className="flex items-center space-x-3">
                  <span className="w-12 text-stone-600 dark:text-slate-300 font-medium flex items-center text-xs">
                    {stars} <Star className="w-3 h-3 ml-1 fill-[#C28D32] text-[#C28D32]" />
                  </span>
                  <div className="flex-1 h-2 rounded-full bg-stone-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-[#0A6C74] dark:bg-[#60C3CC] rounded-full transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="w-12 text-right text-stone-400 dark:text-slate-500 text-[11px]">
                    {count} ({percentage}%)
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Honest Neutral Empty State when 0 reviews exist */
        <div
          id="tour-reviews-empty"
          data-testid="tour-reviews-empty"
          className="p-8 bg-white dark:bg-[#132235] border border-[#E8E3DA] dark:border-slate-800 rounded-sm text-center space-y-3"
        >
          <div className="w-10 h-10 rounded-full bg-[#E8F3F4] dark:bg-slate-800 text-[#0A6C74] dark:text-[#60C3CC] flex items-center justify-center mx-auto">
            <MessageSquare className="w-5 h-5" />
          </div>
          <h4 className="font-semibold text-sm text-stone-900 dark:text-white">
            No Reviews Submitted Yet
          </h4>
          <p className="text-xs text-stone-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
            There are currently no published reviews for this excursion. Be the first traveler to submit your feedback!
          </p>
          <button
            type="button"
            onClick={() => setWriteModalOpen(true)}
            className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-[#0A6C74] hover:bg-[#08565C] text-white text-xs font-semibold rounded transition-colors cursor-pointer"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Write the First Review</span>
          </button>
        </div>
      )}

      {/* Individual Review Cards */}
      {totalReviews > 0 && (
        <div className="space-y-4">
          {reviewsList.map((rev) => (
            <div 
              key={rev.id} 
              id={`tour-review-${rev.id}`}
              className="p-4 bg-white dark:bg-[#132235] border border-[#E8E3DA] dark:border-slate-800 rounded-sm text-xs space-y-2"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-stone-900 dark:text-white text-xs">
                      {rev.authorName}
                    </span>
                    <span className="text-stone-400 dark:text-slate-600">•</span>
                    <span className="text-stone-500 dark:text-slate-400 text-[11px]">
                      {rev.country}
                    </span>
                    {rev.travelerType && (
                      <>
                        <span className="text-stone-400 dark:text-slate-600">•</span>
                        <span className="text-stone-500 dark:text-slate-400 text-[11px] bg-stone-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                          {rev.travelerType}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center space-x-2 mt-1">
                    <div className="flex text-[#C28D32]">
                      {[...Array(rev.rating)].map((_, i) => (
                        <Star key={i} className="w-3 h-3 fill-current" />
                      ))}
                    </div>
                    <span className="text-[11px] text-stone-400 dark:text-slate-500">{rev.date}</span>
                  </div>
                </div>

                {rev.verifiedBooking && (
                  <div className="flex items-center text-[11px] text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                    <CheckCircle className="w-3 h-3 mr-1 text-emerald-600 dark:text-emerald-400" />
                    <span>Verified Booking</span>
                  </div>
                )}
              </div>

              <p className="text-stone-600 dark:text-slate-300 leading-relaxed pt-1">
                "{rev.comment}"
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Write a review modal with real Supabase persistence */}
      {writeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#132235] rounded-sm border border-[#E8E3DA] dark:border-slate-800 max-w-md w-full p-6 shadow-xl relative">
            <button
              type="button"
              onClick={() => {
                setWriteModalOpen(false);
                setSubmittedMessage(false);
              }}
              className="absolute top-4 right-4 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {!submittedMessage ? (
              <form onSubmit={handleSubmitReview} className="space-y-4 text-xs">
                <h3 className="font-display text-base font-bold text-[#0E1B2A] dark:text-white">
                  Review {tour.title}
                </h3>
                <p className="text-stone-500 dark:text-slate-400 text-[11px]">
                  Share your authentic excursion experience. Your review will be reviewed by our operations desk prior to publishing.
                </p>

                {submitError && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded text-red-700 dark:text-red-300 text-xs flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{submitError}</span>
                  </div>
                )}

                <div>
                  <label className="block font-semibold text-stone-700 dark:text-slate-300 mb-1">
                    Your Rating
                  </label>
                  <div className="flex space-x-1 text-[#C28D32]">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        onClick={() => setRating(s)}
                        className={`w-6 h-6 cursor-pointer hover:scale-110 transition-transform ${
                          s <= rating ? 'fill-current' : 'stroke-current text-stone-300 dark:text-slate-600'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-stone-700 dark:text-slate-300 mb-1">
                      Your Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={authorName}
                      onChange={(e) => setAuthorName(e.target.value)}
                      placeholder="e.g. Thomas K."
                      className="w-full px-3 py-2 border border-stone-300 dark:border-slate-700 rounded bg-white dark:bg-[#0E1B2A] text-stone-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#0A6C74]"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-stone-700 dark:text-slate-300 mb-1">
                      Country
                    </label>
                    <input
                      type="text"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      placeholder="e.g. Germany"
                      className="w-full px-3 py-2 border border-stone-300 dark:border-slate-700 rounded bg-white dark:bg-[#0E1B2A] text-stone-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#0A6C74]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 dark:text-slate-300 mb-1">
                    Traveler Type
                  </label>
                  <select
                    value={travelerType}
                    onChange={(e) => setTravelerType(e.target.value as any)}
                    className="w-full px-3 py-2 border border-stone-300 dark:border-slate-700 rounded bg-white dark:bg-[#0E1B2A] text-stone-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#0A6C74]"
                  >
                    <option value="Couple">Couple</option>
                    <option value="Family">Family</option>
                    <option value="Friends">Friends</option>
                    <option value="Solo">Solo Traveler</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 dark:text-slate-300 mb-1">
                    Review Details *
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Tell us about the boat, crew, snorkeling stops, lunch, or transfers..."
                    className="w-full px-3 py-2 border border-stone-300 dark:border-slate-700 rounded bg-white dark:bg-[#0E1B2A] text-stone-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#0A6C74]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 bg-[#0A6C74] hover:bg-[#08565C] text-white font-semibold rounded text-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Recording Review...' : 'Submit Review'}
                </button>
              </form>
            ) : (
              <div className="text-center py-6 space-y-3">
                <CheckCircle className="w-10 h-10 text-emerald-600 mx-auto" />
                <h4 className="font-display font-bold text-base text-stone-900 dark:text-white">
                  Thank You for Your Feedback!
                </h4>
                <p className="text-xs text-stone-600 dark:text-slate-400">
                  Your review has been recorded in the database and scheduled for editorial moderation.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setWriteModalOpen(false);
                    setSubmittedMessage(false);
                  }}
                  className="px-4 py-2 bg-stone-100 dark:bg-slate-800 hover:bg-stone-200 dark:hover:bg-slate-700 text-stone-800 dark:text-white rounded font-semibold text-xs cursor-pointer"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
