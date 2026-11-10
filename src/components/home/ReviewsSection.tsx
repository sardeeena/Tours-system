import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { Star, CheckCircle2, MessageSquare, AlertCircle, RefreshCw } from 'lucide-react';
import { getPublishedReviews, PublishedReviewsResult } from '../../services/tourService';
import { Review } from '../../types';

export const ReviewsSection: React.FC = () => {
  const [data, setData] = useState<PublishedReviewsResult>({
    reviews: [],
    averageRating: 0,
    totalCount: 0,
    recommendationRate: 0,
    breakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadReviews = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await getPublishedReviews();
      setData(res);
    } catch (err: any) {
      console.error('Failed to load guest reviews:', err);
      setError(err?.message || 'Unable to load guest reviews at this moment.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReviews();

    const handleDataUpdated = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (!customEvent.detail?.entity || customEvent.detail.entity === 'reviews') {
        loadReviews();
      }
    };

    window.addEventListener('rse_data_updated', handleDataUpdated);
    return () => window.removeEventListener('rse_data_updated', handleDataUpdated);
  }, [loadReviews]);

  return (
    <section id="reviews-section" className="py-16 sm:py-24 bg-[#FAF8F5] dark:bg-[#0A1118] border-b border-[#E8E3DA] dark:border-slate-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
          <div>
            <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-[#0A6C74] dark:text-[#60C3CC] mb-2">
              <span className="w-5 h-0.5 bg-[#0A6C74] dark:bg-[#60C3CC] rounded-full"></span>
              <span>Authentic Guest Experiences</span>
            </div>
            <h2 className="font-display text-2xl sm:text-4xl text-[#0E1B2A] dark:text-white tracking-tight">
              What Travelers Say
            </h2>
            <p className="text-stone-600 dark:text-slate-300 text-sm sm:text-base mt-2 max-w-xl leading-relaxed">
              Guest feedback shared after completed excursions across our Red Sea destinations.
            </p>
          </div>

          {/* Genuine Aggregate Rating Badge (Shown when genuine reviews exist) */}
          {!isLoading && !error && data.totalCount > 0 && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="bg-white dark:bg-[#132235] border border-[#E8E3DA] dark:border-slate-800 p-4.5 rounded-2xl flex items-center space-x-4 self-start md:self-auto shadow-sm"
            >
              <div className="text-center">
                <span className="font-display text-3xl font-bold text-[#0E1B2A] dark:text-white block leading-none font-mono">
                  {data.averageRating.toFixed(1)}
                </span>
                <div className="flex text-amber-400 mt-1.5 justify-center">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`w-3.5 h-3.5 ${
                        i < Math.round(data.averageRating)
                          ? 'fill-current'
                          : 'stroke-current text-stone-300 dark:text-slate-600'
                      }`}
                    />
                  ))}
                </div>
              </div>
              <div className="h-10 w-px bg-stone-200 dark:bg-slate-700" />
              <div>
                <span className="text-xs font-bold text-stone-900 dark:text-white block">
                  {data.totalCount} Published {data.totalCount === 1 ? 'Review' : 'Reviews'}
                </span>
                {data.recommendationRate > 0 && (
                  <span className="text-[11px] text-stone-500 dark:text-slate-400">
                    {data.recommendationRate}% guest satisfaction
                  </span>
                )}
              </div>
            </motion.div>
          )}
        </div>

        {/* LOADING SKELETON */}
        {isLoading && (
          <div
            id="review-loading"
            data-testid="review-loading"
            aria-busy="true"
            aria-label="Loading verified traveler reviews"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {[...Array(3)].map((_, idx) => (
              <div
                key={idx}
                className={`bg-white dark:bg-[#132235] rounded-2xl border border-[#E8E3DA] dark:border-slate-800 p-6 space-y-4 shadow-xs select-none skeleton-delay-${idx + 1}`}
              >
                <div className="flex justify-between items-center">
                  <div className={`h-4 bg-stone-200 dark:bg-slate-700 rounded w-24 animate-shimmer skeleton-delay-${idx + 1}`} />
                  <div className={`h-3 bg-stone-100 dark:bg-slate-800 rounded w-16 animate-shimmer skeleton-delay-${idx + 1}`} />
                </div>
                <div className={`h-3.5 bg-stone-200 dark:bg-slate-700 rounded w-36 animate-shimmer skeleton-delay-${idx + 1}`} />
                <div className="space-y-2">
                  <div className={`h-3 bg-stone-100 dark:bg-slate-800 rounded w-full animate-shimmer skeleton-delay-${idx + 1}`} />
                  <div className={`h-3 bg-stone-100 dark:bg-slate-800 rounded w-4/5 animate-shimmer skeleton-delay-${idx + 1}`} />
                </div>
                <div className="pt-3 border-t border-stone-100 dark:border-slate-800 flex justify-between">
                  <div className={`h-3 bg-stone-200 dark:bg-slate-700 rounded w-28 animate-shimmer skeleton-delay-${idx + 1}`} />
                  <div className={`h-3 bg-stone-100 dark:bg-slate-800 rounded w-12 animate-shimmer skeleton-delay-${idx + 1}`} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ERROR STATE */}
        {!isLoading && error && (
          <div
            id="review-error"
            data-testid="review-error"
            className="p-8 rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20 text-center max-w-lg mx-auto"
          >
            <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
            <h3 className="font-semibold text-sm text-stone-900 dark:text-white mb-1">
              Could not load customer reviews
            </h3>
            <p className="text-xs text-stone-600 dark:text-slate-400 mb-4">{error}</p>
            <button
              type="button"
              onClick={loadReviews}
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-[#0A6C74] hover:bg-[#08565C] text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* EMPTY STATE */}
        {!isLoading && !error && data.reviews.length === 0 && (
          <div
            id="review-empty"
            data-testid="review-empty"
            className="bg-white dark:bg-[#132235] rounded-2xl border border-[#E8E3DA] dark:border-slate-800 p-12 text-center max-w-md mx-auto shadow-sm"
          >
            <div className="w-12 h-12 rounded-full bg-[#E8F3F4] dark:bg-slate-800 text-[#0A6C74] dark:text-[#60C3CC] flex items-center justify-center mx-auto mb-3">
              <MessageSquare className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-stone-900 dark:text-white text-base mb-1">
              No Guest Reviews Published Yet
            </h3>
            <p className="text-xs text-stone-500 dark:text-slate-400 leading-relaxed">
              Real reviews from verified travelers are reviewed and published here following completed excursions.
            </p>
          </div>
        )}

        {/* REVIEWS GRID (AUTHENTIC DATABASE RECORDS) */}
        {!isLoading && !error && data.reviews.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {data.reviews.map((rev, idx) => (
              <motion.div
                key={rev.id}
                id={`review-card-${rev.id}`}
                data-testid="review-card"
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.45, delay: idx * 0.08 }}
                whileHover={{ y: -5 }}
                className="bg-white dark:bg-[#132235] rounded-2xl border border-[#E8E3DA] dark:border-slate-800 p-6 flex flex-col justify-between hover:border-[#0A6C74]/50 hover:shadow-xl transition-all duration-300"
              >
                <div>
                  {/* Rating and Date */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex text-amber-400">
                      {[...Array(rev.rating)].map((_, i) => (
                        <Star key={i} className="w-3.5 h-3.5 fill-current" />
                      ))}
                    </div>
                    <span className="text-[11px] text-stone-400 dark:text-slate-500 font-mono">{rev.date}</span>
                  </div>

                  {/* Excursion tag */}
                  {rev.tourTitle && (
                    <span className="text-xs font-semibold text-[#0A6C74] dark:text-[#60C3CC] block mb-2 line-clamp-1">
                      {rev.tourTitle}
                    </span>
                  )}

                  {/* Review Text */}
                  <p className="text-xs sm:text-[13px] text-stone-700 dark:text-slate-200 leading-relaxed mb-5 italic">
                    "{rev.comment}"
                  </p>
                </div>

                {/* Guest Profile */}
                <div className="pt-3.5 border-t border-stone-100 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-stone-900 dark:text-white block">
                      {rev.authorName}
                    </span>
                    <div className="text-[11px] text-stone-500 dark:text-slate-400 flex items-center space-x-1.5 mt-0.5">
                      <span>{rev.country}</span>
                      {rev.travelerType && (
                        <>
                          <span aria-hidden="true" className="text-stone-300 dark:text-slate-600">·</span>
                          <span>{rev.travelerType}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {rev.verifiedBooking && (
                    <div className="flex items-center text-[10px] font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
                      <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600 dark:text-emerald-400" />
                      <span>Verified</span>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}

      </div>
    </section>
  );
};
