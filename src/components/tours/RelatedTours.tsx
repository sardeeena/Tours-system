import React from 'react';
import { Tour, CurrencyConfig } from '../../types';
import { TourCard } from './TourCard';
import { TourCardSkeleton } from './TourCardSkeleton';

interface RelatedToursProps {
  currentTour: Tour;
  allTours: Tour[];
  currency: CurrencyConfig;
  isLoading?: boolean;
  onViewTour: (tour: Tour) => void;
  onBookNow?: (tour: Tour) => void;
}

export const RelatedTours: React.FC<RelatedToursProps> = ({
  currentTour,
  allTours,
  currency,
  isLoading = false,
  onViewTour,
  onBookNow,
}) => {
  if (isLoading) {
    return (
      <section className="pt-10 border-t border-stone-200">
        <div className="mb-6 space-y-1">
          <div className="w-32 h-3 bg-stone-200 rounded animate-shimmer" />
          <div className="w-48 h-6 bg-stone-200 rounded animate-shimmer" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[...Array(4)].map((_, i) => (
            <TourCardSkeleton key={i} staggerIndex={i} />
          ))}
        </div>
      </section>
    );
  }

  // Find related tours matching category, destination, or categories
  const related = allTours
    .filter((t) => t.id !== currentTour.id)
    .map((t) => {
      let score = 0;
      if (t.category === currentTour.category) score += 3;
      if (t.destination === currentTour.destination) score += 2;
      const sharedCats = t.categories?.filter((c) => currentTour.categories?.includes(c)) || [];
      score += sharedCats.length * 2;
      return { tour: t, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((item) => item.tour);

  if (related.length === 0) return null;

  return (
    <section className="pt-10 border-t border-stone-200">
      <div className="mb-6">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#0A6C74] block mb-1">
          Hand-Picked Alternatives
        </span>
        <h3 className="font-display text-2xl font-bold text-[#0E1B2A]">
          You May Also Like
        </h3>
        <p className="text-xs text-stone-500">
          Similar marine, island, and desert adventures in {currentTour.destination}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {related.map((tour) => (
          <TourCard
            key={tour.id}
            tour={tour}
            currency={currency}
            onViewTour={onViewTour}
            onBookNow={onBookNow}
          />
        ))}
      </div>
    </section>
  );
};
