import React from 'react';

/**
 * Luxury Skeleton Loader for the multi-step Booking Page.
 * Displays during initial tour lookup / database synchronization.
 */
export const BookingPageSkeleton: React.FC = () => {
  return (
    <div className="bg-[#FAF8F5] dark:bg-[#0A121D] min-h-screen select-none transition-colors" role="status" aria-label="Loading booking portal">
      {/* Top Stepper Navigation Skeleton */}
      <div className="bg-white dark:bg-[#132235] border-b border-[#E8E3DA] dark:border-slate-800 sticky top-16 z-30 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between overflow-x-auto no-scrollbar py-1 gap-2">
            {[1, 2, 3, 4, 5, 6].map((step) => (
              <div key={step} className="flex items-center space-x-2 shrink-0">
                <div className={`w-7 h-7 rounded-full bg-stone-200/80 dark:bg-slate-800/80 animate-shimmer flex items-center justify-center skeleton-delay-${step % 5}`} />
                <div className={`w-16 h-3 bg-stone-200/70 dark:bg-slate-800/70 rounded animate-shimmer hidden sm:block skeleton-delay-${step % 5}`} />
                {step < 6 && <div className="w-6 h-0.5 bg-stone-200 dark:bg-slate-800 shrink-0 mx-1" />}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content Layout */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Active Step Form Placeholder */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Guarantee / Info Header Card */}
            <div className="bg-white dark:bg-[#132235] border border-[#E8E3DA] dark:border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xs">
              <div className="space-y-2.5">
                <div className="w-24 h-4 bg-teal-100/70 dark:bg-teal-500/20 rounded-full animate-shimmer" />
                <div className="w-3/4 sm:w-1/2 h-7 bg-stone-200 dark:bg-slate-800 rounded-lg animate-shimmer" />
                <div className="w-full sm:w-2/3 h-4 bg-stone-100 dark:bg-slate-800/60 rounded animate-shimmer" />
              </div>

              {/* Form Input Skeletons */}
              <div className="space-y-5 pt-4 border-t border-stone-100 dark:border-slate-800">
                <div className="space-y-2">
                  <div className="w-32 h-3.5 bg-stone-200/80 dark:bg-slate-800/80 rounded animate-shimmer" />
                  <div className="w-full h-11 bg-stone-100 dark:bg-slate-800/50 rounded-xl animate-shimmer" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="w-28 h-3.5 bg-stone-200/80 dark:bg-slate-800/80 rounded animate-shimmer" />
                    <div className="w-full h-11 bg-stone-100 dark:bg-slate-800/50 rounded-xl animate-shimmer" />
                  </div>
                  <div className="space-y-2">
                    <div className="w-28 h-3.5 bg-stone-200/80 dark:bg-slate-800/80 rounded animate-shimmer" />
                    <div className="w-full h-11 bg-stone-100 dark:bg-slate-800/50 rounded-xl animate-shimmer" />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="w-40 h-3.5 bg-stone-200/80 dark:bg-slate-800/80 rounded animate-shimmer" />
                  <div className="w-full h-24 bg-stone-100 dark:bg-slate-800/50 rounded-xl animate-shimmer" />
                </div>
              </div>

              {/* Buttons Placeholder */}
              <div className="flex items-center justify-between pt-6 border-t border-stone-100 dark:border-slate-800">
                <div className="w-24 h-10 bg-stone-100 dark:bg-slate-800/60 rounded-xl animate-shimmer" />
                <div className="w-36 h-10 bg-teal-600/30 dark:bg-teal-600/40 rounded-xl animate-shimmer" />
              </div>
            </div>

            {/* Trust Pill / Security Notice Skeleton */}
            <div className="p-4 bg-white/70 dark:bg-[#132235]/70 border border-[#E8E3DA] dark:border-slate-800 rounded-xl flex items-center justify-between shadow-2xs">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-500/20 shrink-0" />
                <div className="space-y-1">
                  <div className="w-40 h-3 bg-stone-200/80 dark:bg-slate-800/80 rounded animate-shimmer" />
                  <div className="w-60 h-2.5 bg-stone-100 dark:bg-slate-800/50 rounded animate-shimmer" />
                </div>
              </div>
            </div>

          </div>

          {/* Right Column: Sticky Booking Order Summary Skeleton */}
          <aside className="lg:col-span-4 sticky top-36 space-y-4">
            <div className="bg-white dark:bg-[#132235] border border-[#E8E3DA] dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
              
              {/* Tour Thumbnail & Title */}
              <div className="flex items-center space-x-3 pb-4 border-b border-stone-100 dark:border-slate-800">
                <div className="w-16 h-16 rounded-xl bg-stone-200 dark:bg-slate-800 shrink-0 animate-shimmer" />
                <div className="space-y-1.5 flex-1">
                  <div className="w-16 h-3 bg-teal-100/80 dark:bg-teal-500/30 rounded animate-shimmer" />
                  <div className="w-full h-4 bg-stone-200 dark:bg-slate-800 rounded animate-shimmer" />
                  <div className="w-24 h-3 bg-stone-100 dark:bg-slate-800/60 rounded animate-shimmer" />
                </div>
              </div>

              {/* Date & Guests badge */}
              <div className="p-3 bg-stone-50 dark:bg-slate-850 dark:bg-slate-900/60 rounded-xl space-y-2 border border-transparent dark:border-slate-800/50">
                <div className="flex justify-between items-center">
                  <div className="w-16 h-3 bg-stone-200/80 dark:bg-slate-800/80 rounded animate-shimmer" />
                  <div className="w-20 h-3 bg-stone-200/80 dark:bg-slate-800/80 rounded animate-shimmer" />
                </div>
                <div className="flex justify-between items-center">
                  <div className="w-16 h-3 bg-stone-200/80 dark:bg-slate-800/80 rounded animate-shimmer" />
                  <div className="w-24 h-3 bg-stone-200/80 dark:bg-slate-800/80 rounded animate-shimmer" />
                </div>
              </div>

              {/* Pricing breakdown rows */}
              <div className="space-y-2.5 pt-2">
                <div className="flex justify-between">
                  <div className="w-28 h-3 bg-stone-200/80 dark:bg-slate-800/80 rounded animate-shimmer" />
                  <div className="w-16 h-3 bg-stone-200/80 dark:bg-slate-800/80 rounded animate-shimmer" />
                </div>
                <div className="flex justify-between">
                  <div className="w-20 h-3 bg-stone-200/80 dark:bg-slate-800/80 rounded animate-shimmer" />
                  <div className="w-12 h-3 bg-stone-200/80 dark:bg-slate-800/80 rounded animate-shimmer" />
                </div>
              </div>

              {/* Grand Total */}
              <div className="pt-4 border-t border-stone-200 dark:border-slate-800 flex justify-between items-baseline">
                <div>
                  <div className="w-12 h-3.5 bg-stone-300 dark:bg-slate-700 rounded animate-shimmer" />
                  <div className="w-28 h-2 bg-stone-100 dark:bg-slate-800/50 rounded mt-1 animate-shimmer" />
                </div>
                <div className="w-24 h-6 bg-teal-600/30 dark:bg-teal-500/30 rounded animate-shimmer" />
              </div>

            </div>
          </aside>

        </div>
      </main>
    </div>
  );
};
