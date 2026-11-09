import React from 'react';
import { 
  X, 
  Star, 
  Clock, 
  MapPin, 
  Check, 
  XCircle, 
  ShieldCheck, 
  Users, 
  Calendar, 
  ArrowRight,
  Sparkles,
  Compass
} from 'lucide-react';
import { Tour, CurrencyConfig } from '../../types';
import { formatPrice } from '../../data/toursData';

interface TourPreviewModalProps {
  tour: Tour | null;
  currency: CurrencyConfig;
  onClose: () => void;
  onBookNow: (tour: Tour) => void;
}

export const TourPreviewModal: React.FC<TourPreviewModalProps> = ({
  tour,
  currency,
  onClose,
  onBookNow,
}) => {
  if (!tour) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-4xl bg-white rounded-sm border border-[#E8E3DA] shadow-2xl overflow-hidden my-6 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 bg-[#FAF8F5]">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#0A6C74] bg-[#E8F3F4] px-2 py-0.5 rounded">
              {tour.category}
            </span>
            <span className="text-stone-300">•</span>
            <span className="text-xs text-stone-500 font-medium flex items-center">
              <MapPin className="w-3.5 h-3.5 text-[#0A6C74] mr-1" />
              {tour.destination}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-stone-500 hover:text-stone-900 rounded-sm hover:bg-stone-200 transition-colors"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto p-6 space-y-6">
          
          {/* Main Visual & Title */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            <div className="md:col-span-7">
              <div className="aspect-[16/10] rounded-sm overflow-hidden bg-stone-100 border border-stone-200">
                <img
                  src={tour.primaryImage}
                  alt={tour.title}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Gallery Thumbnails if available */}
              {tour.galleryImages.length > 1 && (
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {tour.galleryImages.slice(0, 3).map((imgUrl, i) => (
                    <div key={i} className="aspect-[16/10] rounded-xs overflow-hidden border border-stone-200">
                      <img src={imgUrl} alt={`Gallery ${i}`} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="md:col-span-5 flex flex-col justify-between h-full">
              <div>
                <h2 className="font-display text-xl sm:text-2xl font-bold text-[#0E1B2A] leading-snug mb-3">
                  {tour.title}
                </h2>

                <div className="flex items-center space-x-3 mb-4 text-xs">
                  <div className="flex items-center text-[#C28D32]">
                    <Star className="w-4 h-4 fill-current" />
                    <span className="font-bold text-stone-900 ml-1 text-sm">{tour.rating.toFixed(1)}</span>
                  </div>
                  <span className="text-stone-400">•</span>
                  <span className="text-stone-600 font-medium">{tour.reviewCount.toLocaleString()} verified reviews</span>
                </div>

                <div className="space-y-2.5 text-xs text-stone-600 bg-stone-50 p-3.5 rounded border border-stone-200 mb-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-stone-500">Duration:</span>
                    <span className="font-semibold text-stone-800">{tour.durationLabel}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-stone-500">Pickup:</span>
                    <span className="font-semibold text-stone-800">Hotel Lobby Included</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-stone-500">Languages:</span>
                    <span className="font-semibold text-stone-800">{tour.languages.join(', ')}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-stone-500">Cancellation:</span>
                    <span className="font-semibold text-emerald-700">Free 24h Prior</span>
                  </div>
                </div>
              </div>

              {/* Price card & Book CTA */}
              <div className="p-4 bg-[#E8F3F4] dark:bg-[#0E1B2A] text-stone-900 dark:text-white rounded-xl border border-[#BDE0E2] dark:border-slate-800 mt-2 transition-colors">
                <div className="flex items-baseline justify-between mb-3">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-stone-600 dark:text-slate-400 block">Starting From</span>
                    <span className="text-2xl font-bold text-stone-900 dark:text-white">
                      {formatPrice(tour.priceEur, currency)}
                    </span>
                    <span className="text-xs text-stone-600 dark:text-slate-300 ml-1">/ person</span>
                  </div>
                  {tour.childPriceEur && (
                    <div className="text-right text-[11px] text-stone-600 dark:text-slate-400">
                      Child (2-11): <span className="text-stone-900 dark:text-white font-semibold">{formatPrice(tour.childPriceEur, currency)}</span>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onBookNow(tour);
                  }}
                  className="w-full py-2.5 bg-[#0A6C74] hover:bg-[#08565C] text-white text-xs sm:text-sm font-semibold rounded-sm flex items-center justify-center space-x-2 transition-colors shadow"
                >
                  <span>Select Date & Book Now</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

            </div>
          </div>

          {/* Detailed Overview */}
          <div>
            <h3 className="font-display text-base font-semibold text-[#0E1B2A] mb-2">
              Overview
            </h3>
            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
              {tour.fullDescription}
            </p>
          </div>

          {/* Highlights */}
          <div>
            <h3 className="font-display text-base font-semibold text-[#0E1B2A] mb-3">
              Experience Highlights
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-stone-700">
              {tour.highlights.map((hl, idx) => (
                <div key={idx} className="flex items-start">
                  <Check className="w-4 h-4 text-[#0A6C74] mr-2 mt-0.5 shrink-0" />
                  <span>{hl}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Included / Excluded Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-stone-200">
            <div className="p-4 bg-emerald-50/50 rounded border border-emerald-200/60">
              <h4 className="text-xs font-bold text-emerald-900 uppercase tracking-wider mb-2.5 flex items-center">
                <Check className="w-4 h-4 mr-1.5 text-emerald-600" />
                What's Included
              </h4>
              <ul className="space-y-1.5 text-xs text-emerald-950">
                {tour.included.map((inc, i) => (
                  <li key={i} className="flex items-start">
                    <span className="mr-1.5 text-emerald-600">•</span>
                    <span>{inc}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-4 bg-stone-50 rounded border border-stone-200">
              <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider mb-2.5 flex items-center">
                <XCircle className="w-4 h-4 mr-1.5 text-stone-400" />
                Not Included / Optional
              </h4>
              <ul className="space-y-1.5 text-xs text-stone-600">
                {tour.excluded.map((exc, i) => (
                  <li key={i} className="flex items-start">
                    <span className="mr-1.5 text-stone-400">•</span>
                    <span>{exc}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Pickup & Cancellation Notice */}
          <div className="p-4 bg-[#FAF8F5] rounded border border-[#E8E3DA] text-xs space-y-1.5">
            <div className="flex items-start">
              <MapPin className="w-4 h-4 text-[#0A6C74] mr-2 mt-0.5 shrink-0" />
              <div>
                <span className="font-semibold text-stone-900">Hotel Pickup: </span>
                <span className="text-stone-600">{tour.pickupInfo}</span>
              </div>
            </div>
            <div className="flex items-start">
              <ShieldCheck className="w-4 h-4 text-[#0A6C74] mr-2 mt-0.5 shrink-0" />
              <div>
                <span className="font-semibold text-stone-900">Cancellation Policy: </span>
                <span className="text-stone-600">{tour.cancellationPolicy}</span>
              </div>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-stone-200 bg-[#FAF8F5] flex items-center justify-between text-xs">
          <span className="text-stone-500">Need private custom arrangements? Contact us directly.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-stone-200 hover:bg-stone-300 text-stone-800 rounded font-medium transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
