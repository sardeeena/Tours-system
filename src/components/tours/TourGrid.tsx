import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Tour, CurrencyConfig } from '../../types';
import { TourCard } from './TourCard';
import { TourCardSkeleton } from './TourCardSkeleton';
import { SearchX, RotateCcw } from 'lucide-react';
import { TourPreviewModal } from '../home/TourPreviewModal';

interface TourGridProps {
  tours: Tour[];
  currency: CurrencyConfig;
  isLoading?: boolean;
  skeletonCount?: number;
  onViewTour: (tour: Tour) => void;
  onBookNow?: (tour: Tour) => void;
  onClearFilters?: () => void;
}

export const TourGrid: React.FC<TourGridProps> = ({
  tours,
  currency,
  isLoading = false,
  skeletonCount = 6,
  onViewTour,
  onBookNow,
  onClearFilters,
}) => {
  const [quickViewTour, setQuickViewTour] = useState<Tour | null>(null);

  if (isLoading) {
    return (
      <div 
        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6 min-w-0 w-full"
        aria-busy="true"
        aria-label="Loading excursions from Supabase"
      >
        {[...Array(skeletonCount)].map((_, i) => (
          <TourCardSkeleton key={i} staggerIndex={i} />
        ))}
      </div>
    );
  }

  if (tours.length === 0) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.25 }}
        className="bg-white rounded-2xl border border-[#E8E3DA] p-12 text-center my-4 shadow-sm"
      >
        <div className="w-14 h-14 rounded-2xl bg-stone-100 flex items-center justify-center mx-auto mb-3.5 text-stone-500 border border-stone-200">
          <SearchX className="w-7 h-7 text-[#0A6C74]" />
        </div>
        <h3 className="font-display text-xl font-bold text-[#0E1B2A] mb-1.5">
          No excursions match your selected filters
        </h3>
        <p className="text-xs sm:text-sm text-stone-600 max-w-md mx-auto mb-6 leading-relaxed">
          Try expanding your price range, clearing specific duration preferences, or choosing another departure coast.
        </p>
        {onClearFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="inline-flex items-center px-4 py-2.5 bg-[#0A6C74] hover:bg-[#08565C] text-white text-xs font-semibold rounded-xl transition-all shadow-sm cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
            <span>Reset All Filters</span>
          </button>
        )}
      </motion.div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 min-w-0 w-full md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
        <AnimatePresence mode="popLayout">
          {tours.map((tour, index) => (
            <motion.div
              key={tour.id}
              layout
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.3) }}
            >
              <TourCard
                tour={tour}
                currency={currency}
                onViewTour={onViewTour}
                onBookNow={onBookNow}
                onQuickView={(t) => setQuickViewTour(t)}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Connected Quick View Modal */}
      <TourPreviewModal
        tour={quickViewTour}
        currency={currency}
        onClose={() => setQuickViewTour(null)}
        onBookNow={(tour) => {
          setQuickViewTour(null);
          if (onBookNow) onBookNow(tour);
          else onViewTour(tour);
        }}
      />
    </>
  );
};
