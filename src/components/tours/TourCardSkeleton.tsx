import React from 'react';

interface TourCardSkeletonProps {
  className?: string;
  staggerIndex?: number;
}

/**
 * High-fidelity Skeleton Loader mirroring TourCard geometry and aesthetic.
 * Incorporates subtle wave shimmer, warm stone light mode, and obsidian-teal dark mode.
 */
export const TourCardSkeleton: React.FC<TourCardSkeletonProps> = ({
  className = '',
  staggerIndex,
}) => {
  const staggerClass = staggerIndex !== undefined ? `skeleton-delay-${(staggerIndex % 5) + 1}` : '';

  return (
    <article
      className={`bg-white dark:bg-[#132235] rounded-2xl border border-[#E8E3DA] dark:border-slate-800/80 overflow-hidden flex flex-col h-full relative shadow-xs select-none transition-colors ${staggerClass} ${className}`}
      aria-hidden="true"
      role="status"
      aria-label="Loading excursion details"
    >
      {/* Photo Skeleton */}
      <div className={`relative aspect-[16/10] bg-stone-200/80 dark:bg-slate-800/90 animate-shimmer overflow-hidden ${staggerClass}`}>
        {/* Badge Placeholder */}
        <div className="absolute top-3 left-3 w-24 h-5 bg-stone-300/80 dark:bg-slate-700/80 rounded-full" />

        {/* Wishlist Button Placeholder */}
        <div className="absolute top-3 right-3 w-8 h-8 bg-stone-300/80 dark:bg-slate-700/80 rounded-full" />

        {/* Cancellation Badge Placeholder */}
        <div className="absolute bottom-3 left-3 w-36 h-4.5 bg-stone-300/70 dark:bg-slate-700/70 rounded-full" />
      </div>

      {/* Content Skeleton */}
      <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
        <div>
          {/* Metadata Row: Destination · Category · Duration */}
          <div className="flex items-center space-x-2 mb-2.5">
            <div className={`w-16 h-3 bg-stone-200/80 dark:bg-slate-800/80 rounded animate-shimmer ${staggerClass}`} />
            <span className="text-stone-300 dark:text-slate-700">·</span>
            <div className={`w-24 h-3 bg-stone-200/80 dark:bg-slate-800/80 rounded animate-shimmer ${staggerClass}`} />
            <span className="text-stone-300 dark:text-slate-700">·</span>
            <div className={`w-10 h-3 bg-stone-200/80 dark:bg-slate-800/80 rounded animate-shimmer ${staggerClass}`} />
          </div>

          {/* Title Placeholder (2 lines) */}
          <div className="space-y-2 mb-3">
            <div className={`w-11/12 h-4.5 bg-stone-200/90 dark:bg-slate-750 dark:bg-slate-800 rounded-md animate-shimmer ${staggerClass}`} />
            <div className={`w-3/4 h-4.5 bg-stone-200/80 dark:bg-slate-800/80 rounded-md animate-shimmer ${staggerClass}`} />
          </div>

          {/* Description Placeholder (2 lines) */}
          <div className="space-y-1.5 mb-3.5">
            <div className={`w-full h-3 bg-stone-100/90 dark:bg-slate-800/50 rounded animate-shimmer ${staggerClass}`} />
            <div className={`w-5/6 h-3 bg-stone-100/90 dark:bg-slate-800/50 rounded animate-shimmer ${staggerClass}`} />
          </div>

          {/* Rating Placeholder */}
          <div className="flex items-center space-x-1.5 mb-2.5">
            <div className="flex space-x-0.5">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="w-3.5 h-3.5 bg-amber-100/70 dark:bg-amber-500/20 rounded-xs" />
              ))}
            </div>
            <div className={`w-6 h-3.5 bg-stone-200/80 dark:bg-slate-800/80 rounded ml-1 animate-shimmer ${staggerClass}`} />
            <span className="text-stone-300 dark:text-slate-700">·</span>
            <div className={`w-16 h-3 bg-stone-200/60 dark:bg-slate-800/60 rounded animate-shimmer ${staggerClass}`} />
          </div>

          {/* Pickup Info Placeholder */}
          <div className="flex items-center space-x-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-300 dark:bg-emerald-500/60 shrink-0" />
            <div className={`w-44 h-3 bg-stone-100 dark:bg-slate-800/50 rounded animate-shimmer ${staggerClass}`} />
          </div>
        </div>

        {/* Pricing & Footer Actions Skeleton */}
        <div className="pt-3 border-t border-stone-100 dark:border-slate-800 space-y-2.5">
          {/* Quick comparison line */}
          <div className="flex items-center justify-between">
            <div className={`w-20 h-3 bg-stone-200/70 dark:bg-slate-800/60 rounded animate-shimmer ${staggerClass}`} />
            <div className={`w-16 h-3 bg-stone-100 dark:bg-slate-800/40 rounded animate-shimmer ${staggerClass}`} />
          </div>

          {/* Pricing Row */}
          <div className="flex items-center justify-between pt-1">
            <div>
              <div className={`w-8 h-2.5 bg-stone-200/80 dark:bg-slate-800/70 rounded mb-1 animate-shimmer ${staggerClass}`} />
              <div className="flex items-baseline space-x-1">
                <div className={`w-16 h-5 bg-stone-200 dark:bg-slate-750 dark:bg-slate-800 rounded-md animate-shimmer ${staggerClass}`} />
                <div className={`w-12 h-3 bg-stone-100 dark:bg-slate-800/50 rounded animate-shimmer ${staggerClass}`} />
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center space-x-1.5">
              <div className="w-14 h-8 bg-stone-100 dark:bg-slate-800/60 rounded-xl" />
              <div className={`w-18 h-8 bg-[#0A6C74]/20 dark:bg-[#0A6C74]/30 rounded-xl animate-shimmer ${staggerClass}`} />
            </div>
          </div>
        </div>
      </div>
    </article>
  );
};

interface TourGridSkeletonProps {
  count?: number;
  className?: string;
}

/**
 * Renders a responsive grid of TourCardSkeleton items with staggered light sweeps.
 */
export const TourGridSkeleton: React.FC<TourGridSkeletonProps> = ({
  count = 8,
  className = '',
}) => {
  return (
    <div
      className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 ${className}`}
      aria-busy="true"
      aria-live="polite"
    >
      {[...Array(count)].map((_, index) => (
        <TourCardSkeleton key={index} staggerIndex={index} />
      ))}
    </div>
  );
};

export default TourCardSkeleton;
