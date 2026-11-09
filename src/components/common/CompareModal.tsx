import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, XCircle, Star, ArrowRight, ShieldCheck, Clock, MapPin, Scale } from 'lucide-react';
import { Tour, CurrencyConfig } from '../../types';
import { formatPrice } from '../../data/toursData';
import { useComparison } from '../../contexts/ComparisonContext';

interface CompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  allTours: Tour[];
  currency: CurrencyConfig;
  onSelectTour: (tour: Tour) => void;
  onBookTour: (tour: Tour) => void;
}

export const CompareModal: React.FC<CompareModalProps> = ({
  isOpen,
  onClose,
  allTours,
  currency,
  onSelectTour,
  onBookTour,
}) => {
  const { comparedSlugs, removeFromCompare, clearComparison } = useComparison();

  const toursToCompare = allTours.filter((t) => comparedSlugs.includes(t.slug));

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-5xl bg-white rounded-lg border border-[#E8E3DA] shadow-2xl overflow-hidden my-6 flex flex-col max-h-[92vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 bg-[#FAF8F5]">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 rounded bg-[#0A6C74]/10 text-[#0A6C74]">
                <Scale className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-display text-lg font-bold text-[#0E1B2A]">
                  Excursions Side-by-Side Comparison
                </h2>
                <p className="text-xs text-stone-500">
                  Compare itinerary details, equipment, transfers, and pricing
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {toursToCompare.length > 0 && (
                <button
                  type="button"
                  onClick={clearComparison}
                  className="text-xs text-stone-500 hover:text-rose-600 transition-colors font-medium"
                >
                  Clear All
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-stone-500 hover:text-stone-900 rounded hover:bg-stone-200 transition-colors"
                aria-label="Close comparison modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Comparison Matrix Body */}
          <div className="overflow-y-auto overflow-x-auto p-6">
            {toursToCompare.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-sm font-semibold text-stone-700">No excursions selected for comparison.</p>
                <p className="text-xs text-stone-500 mt-1">Select "Compare" on any excursion cards to view them side-by-side.</p>
                <button
                  type="button"
                  onClick={onClose}
                  className="mt-4 px-4 py-2 bg-[#0A6C74] text-white text-xs font-semibold rounded hover:bg-[#08565C]"
                >
                  Browse Excursions
                </button>
              </div>
            ) : (
              <div className="min-w-[640px]">
                {/* Table Header: Tour Cards */}
                <div className={`grid gap-4 pb-6 border-b border-stone-200 ${
                  toursToCompare.length === 1
                    ? 'grid-cols-2'
                    : toursToCompare.length === 2
                    ? 'grid-cols-3'
                    : 'grid-cols-4'
                }`}>
                  <div className="text-xs font-bold uppercase tracking-wider text-stone-400 self-end pb-2">
                    Features & Pricing
                  </div>

                  {toursToCompare.map((tour) => (
                    <div key={tour.id} className="relative bg-[#FAF8F5] p-3 rounded border border-stone-200 flex flex-col justify-between group">
                      <button
                        type="button"
                        onClick={() => removeFromCompare(tour.slug)}
                        className="absolute top-2 right-2 p-1 rounded-full bg-white/80 hover:bg-rose-50 text-stone-400 hover:text-rose-600 transition-colors shadow-2xs z-10"
                        title="Remove from comparison"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>

                      <div className="aspect-[16/10] rounded overflow-hidden mb-2 bg-stone-100">
                        <img src={tour.primaryImage} alt={tour.title} className="w-full h-full object-cover" />
                      </div>

                      <div className="text-[10px] font-semibold text-[#0A6C74] uppercase tracking-wide">
                        {tour.destination}
                      </div>
                      <h3
                        onClick={() => {
                          onSelectTour(tour);
                          onClose();
                        }}
                        className="font-display text-xs sm:text-sm font-bold text-[#0E1B2A] line-clamp-2 hover:text-[#0A6C74] cursor-pointer mt-0.5 mb-2 transition-colors"
                      >
                        {tour.title}
                      </h3>

                      <div className="mt-auto pt-2 border-t border-stone-200 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-stone-500 block">From</span>
                          <span className="font-bold text-sm text-[#0A6C74]">
                            {formatPrice(tour.priceEur, currency)}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            onBookTour(tour);
                            onClose();
                          }}
                          className="px-2.5 py-1.5 bg-[#0A6C74] hover:bg-[#08565C] text-white text-[11px] font-semibold rounded flex items-center space-x-1 transition-colors"
                        >
                          <span>Book</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Comparison Rows */}
                <div className="divide-y divide-stone-100 text-xs">
                  {/* Category */}
                  <div className={`py-3 grid items-center gap-4 ${
                    toursToCompare.length === 1 ? 'grid-cols-2' : toursToCompare.length === 2 ? 'grid-cols-3' : 'grid-cols-4'
                  }`}>
                    <span className="font-semibold text-stone-600">Excursion Category</span>
                    {toursToCompare.map((tour) => (
                      <span key={tour.id} className="text-stone-800 font-medium">{tour.category}</span>
                    ))}
                  </div>

                  {/* Duration */}
                  <div className={`py-3 grid items-center gap-4 ${
                    toursToCompare.length === 1 ? 'grid-cols-2' : toursToCompare.length === 2 ? 'grid-cols-3' : 'grid-cols-4'
                  }`}>
                    <span className="font-semibold text-stone-600">Duration</span>
                    {toursToCompare.map((tour) => (
                      <span key={tour.id} className="text-stone-800 flex items-center">
                        <Clock className="w-3.5 h-3.5 mr-1 text-stone-400" />
                        {tour.durationLabel}
                      </span>
                    ))}
                  </div>

                  {/* Rating */}
                  <div className={`py-3 grid items-center gap-4 ${
                    toursToCompare.length === 1 ? 'grid-cols-2' : toursToCompare.length === 2 ? 'grid-cols-3' : 'grid-cols-4'
                  }`}>
                    <span className="font-semibold text-stone-600">Customer Rating</span>
                    {toursToCompare.map((tour) => (
                      <span key={tour.id} className="text-stone-800 flex items-center">
                        <Star className="w-3.5 h-3.5 fill-[#C28D32] text-[#C28D32] mr-1" />
                        <span className="font-bold">{tour.rating.toFixed(1)}</span>
                        <span className="text-stone-400 ml-1 text-[11px]">({tour.reviewCount})</span>
                      </span>
                    ))}
                  </div>

                  {/* Hotel Pickup */}
                  <div className={`py-3 grid items-center gap-4 ${
                    toursToCompare.length === 1 ? 'grid-cols-2' : toursToCompare.length === 2 ? 'grid-cols-3' : 'grid-cols-4'
                  }`}>
                    <span className="font-semibold text-stone-600">Hotel Lobby Pickup</span>
                    {toursToCompare.map((tour) => (
                      <span key={tour.id} className="flex items-center text-emerald-800">
                        <Check className="w-4 h-4 mr-1 text-emerald-600" />
                        <span>Included ({tour.destination})</span>
                      </span>
                    ))}
                  </div>

                  {/* Child Pricing */}
                  <div className={`py-3 grid items-center gap-4 ${
                    toursToCompare.length === 1 ? 'grid-cols-2' : toursToCompare.length === 2 ? 'grid-cols-3' : 'grid-cols-4'
                  }`}>
                    <span className="font-semibold text-stone-600">Child Rate (2-11)</span>
                    {toursToCompare.map((tour) => (
                      <span key={tour.id} className="text-stone-700">
                        {tour.childPriceEur ? formatPrice(tour.childPriceEur, currency) : '50% of adult'}
                      </span>
                    ))}
                  </div>

                  {/* Free Cancellation */}
                  <div className={`py-3 grid items-center gap-4 ${
                    toursToCompare.length === 1 ? 'grid-cols-2' : toursToCompare.length === 2 ? 'grid-cols-3' : 'grid-cols-4'
                  }`}>
                    <span className="font-semibold text-stone-600">Cancellation Policy</span>
                    {toursToCompare.map((tour) => (
                      <span key={tour.id} className="flex items-center text-emerald-800 font-medium">
                        <ShieldCheck className="w-4 h-4 mr-1 text-emerald-600 shrink-0" />
                        <span>Free 24h prior</span>
                      </span>
                    ))}
                  </div>

                  {/* Included Items Sample */}
                  <div className={`py-3 grid items-start gap-4 ${
                    toursToCompare.length === 1 ? 'grid-cols-2' : toursToCompare.length === 2 ? 'grid-cols-3' : 'grid-cols-4'
                  }`}>
                    <span className="font-semibold text-stone-600 pt-1">Key Inclusions</span>
                    {toursToCompare.map((tour) => (
                      <ul key={tour.id} className="space-y-1 text-stone-700 text-[11px]">
                        {tour.included.slice(0, 4).map((inc, i) => (
                          <li key={i} className="flex items-start">
                            <span className="text-emerald-600 mr-1.5 font-bold">✓</span>
                            <span className="line-clamp-1">{inc}</span>
                          </li>
                        ))}
                      </ul>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-3.5 border-t border-stone-200 bg-[#FAF8F5] flex items-center justify-between text-xs">
            <span className="text-stone-500">
              Need personalized advice or a private vessel charter? WhatsApp our pier desk anytime.
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-stone-200 hover:bg-stone-300 text-stone-800 rounded font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
