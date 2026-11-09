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
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-stone-200 px-4 py-3 shadow-lg flex items-center justify-between">
      <div>
        <span className="text-[10px] uppercase font-bold text-stone-600 block leading-tight">Starting from</span>
        <div className="flex items-baseline space-x-1">
          <span className="text-xl font-bold text-[#0E1B2A]">
            {formatPrice(tour.priceEur, currency)}
          </span>
          <span className="text-xs text-stone-600 font-medium">/ person</span>
        </div>
      </div>

      <button
        type="button"
        onClick={onBookNow}
        className="px-5 py-2.5 bg-[#0A6C74] hover:bg-[#08565C] text-white text-xs font-semibold rounded-sm shadow transition-colors"
      >
        Book Now
      </button>
    </div>
  );
};
