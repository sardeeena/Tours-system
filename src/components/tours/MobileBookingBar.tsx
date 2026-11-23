import React from 'react';
import { Tour, CurrencyConfig } from '../../types';
import { formatPrice } from '../../data/toursData';

interface MobileBookingBarProps {
  tour: Tour;
  currency: CurrencyConfig;
  onBookNow: () => void;
}

export const MobileBookingBar: React.FC<MobileBookingBarProps> = ({
  tour,
  currency,
  onBookNow,
}) => {
  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-stone-200 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(15,23,42,0.10)] flex items-center justify-between gap-3">
      <div>
        <span className="text-[10px] uppercase font-bold text-stone-600 block leading-tight">Starting from</span>
        <div className="flex items-baseline space-x-1">
          <span className="text-lg sm:text-xl font-bold text-[#0E1B2A] leading-tight">
            {formatPrice(tour.tourType === 'Private' ? (tour.privatePriceEur || 0) : tour.priceEur, currency)}
          </span>
          <span className="text-xs text-stone-600 font-medium">/ person</span>
        </div>
      </div>

      <button
        type="button"
        onClick={onBookNow}
        className="min-h-11 px-5 py-2.5 bg-[#0A6C74] hover:bg-[#08565C] text-white text-xs font-semibold rounded-sm shadow transition-colors"
      >
        Book Now
      </button>
    </div>
  );
};
