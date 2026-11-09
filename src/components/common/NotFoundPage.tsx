import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Compass, Search, Home, ArrowRight, CalendarCheck } from 'lucide-react';
import { Tour, CurrencyConfig } from '../../types';
import { formatPrice } from '../../data/toursData';

interface NotFoundPageProps {
  popularTours: Tour[];
  currency: CurrencyConfig;
  onNavigateHome: () => void;
  onNavigateExcursions: () => void;
  onSelectTour: (tour: Tour) => void;
  onOpenMyBooking: () => void;
}

export const NotFoundPage: React.FC<NotFoundPageProps> = ({
  popularTours,
  currency,
  onNavigateHome,
  onNavigateExcursions,
  onSelectTour,
  onOpenMyBooking,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      onNavigateExcursions();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.25 }}
      className="min-h-[70vh] max-w-5xl mx-auto px-4 sm:px-6 py-16 flex flex-col items-center justify-center text-center"
    >
      {/* 404 Badge */}
      <div className="w-16 h-16 rounded-2xl bg-[#E8F3F4] text-[#0A6C74] flex items-center justify-center mb-6 shadow-sm">
        <Compass className="w-8 h-8 animate-spin-slow" />
      </div>

      <span className="text-xs font-bold uppercase tracking-widest text-[#0A6C74] mb-2">
        Error 404 • Destination Not Located
      </span>

      <h1 className="font-display text-3xl sm:text-5xl font-bold text-[#0E1B2A] tracking-tight mb-4">
        We Couldn't Find That Page
      </h1>

      <p className="text-stone-600 text-sm sm:text-base max-w-lg mb-8 leading-relaxed">
        The excursion, booking voucher, or page link you're searching for might have shifted or is unavailable. Let's get you back on course.
      </p>

      {/* Search Input */}
      <form onSubmit={handleSearchSubmit} className="w-full max-w-md mb-8 flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-stone-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search excursions (e.g. Orange Bay, Quad, Diving)..."
            className="w-full pl-10 pr-4 py-2.5 rounded-full border border-stone-300 text-xs sm:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0A6C74]"
          />
        </div>
        <button
          type="submit"
          className="px-5 py-2.5 bg-[#0A6C74] hover:bg-[#08565C] text-white text-xs sm:text-sm font-semibold rounded-full transition-colors shrink-0"
        >
          Search
        </button>
      </form>

      {/* Quick Nav Actions */}
      <div className="flex flex-wrap items-center justify-center gap-3 mb-14">
        <button
          type="button"
          onClick={onNavigateHome}
          className="px-5 py-2.5 bg-[#0A6C74] hover:bg-[#08565C] text-white text-xs sm:text-sm font-semibold rounded-full flex items-center space-x-2 transition-colors cursor-pointer"
        >
          <Home className="w-4 h-4" />
          <span>Return Home</span>
        </button>

        <button
          type="button"
          onClick={onNavigateExcursions}
          className="px-5 py-2.5 bg-white border border-stone-300 hover:border-stone-400 text-stone-800 text-xs sm:text-sm font-semibold rounded-full flex items-center space-x-2 transition-colors"
        >
          <span>Explore All Excursions</span>
          <ArrowRight className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onOpenMyBooking}
          className="px-5 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs sm:text-sm font-semibold rounded-full flex items-center space-x-2 transition-colors"
        >
          <CalendarCheck className="w-4 h-4 text-[#0A6C74]" />
          <span>Find My Booking</span>
        </button>
      </div>

      {/* Recommended Tours Strip */}
      {popularTours.length > 0 && (
        <div className="w-full text-left pt-10 border-t border-stone-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-lg font-bold text-[#0E1B2A]">
              Popular Red Sea Excursions
            </h3>
            <button
              type="button"
              onClick={onNavigateExcursions}
              className="text-xs font-semibold text-[#0A6C74] hover:underline flex items-center"
            >
              <span>View all</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {popularTours.slice(0, 3).map((tour) => (
              <div
                key={tour.id}
                onClick={() => onSelectTour(tour)}
                className="bg-white p-3 rounded-lg border border-stone-200 hover:border-stone-400 transition-colors cursor-pointer flex gap-3 group"
              >
                <div className="w-20 h-20 rounded-md overflow-hidden bg-stone-100 shrink-0">
                  <img
                    src={tour.primaryImage}
                    alt={tour.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <div className="flex-1 min-w-0 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-semibold text-[#0A6C74] block">
                      {tour.destination}
                    </span>
                    <h4 className="font-display text-xs font-bold text-[#0E1B2A] line-clamp-2 group-hover:text-[#0A6C74] transition-colors">
                      {tour.title}
                    </h4>
                  </div>
                  <span className="text-xs font-bold text-[#0E1B2A]">
                    {formatPrice(tour.priceEur, currency)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
};
