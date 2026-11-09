import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Heart, Trash2, ArrowRight, MapPin, Clock } from 'lucide-react';
import { Tour, CurrencyConfig } from '../../types';
import { formatPrice } from '../../data/toursData';
import { useWishlist } from '../../contexts/WishlistContext';

interface WishlistDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  allTours: Tour[];
  currency: CurrencyConfig;
  onSelectTour: (tour: Tour) => void;
  onBookTour: (tour: Tour) => void;
}

export const WishlistDrawer: React.FC<WishlistDrawerProps> = ({
  isOpen,
  onClose,
  allTours,
  currency,
  onSelectTour,
  onBookTour,
}) => {
  const { wishlistSlugs, removeFromWishlist, clearWishlist } = useWishlist();

  const savedTours = allTours.filter((t) => wishlistSlugs.includes(t.slug));

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/50 backdrop-blur-xs"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className="absolute inset-y-0 right-0 max-w-md w-full bg-[#FAF8F5] shadow-2xl border-l border-[#E8E3DA] flex flex-col z-10"
          >
            {/* Header */}
            <div className="p-5 bg-white dark:bg-[#0E1B2A] text-stone-900 dark:text-white flex items-center justify-between border-b border-stone-200 dark:border-slate-800 transition-colors">
              <div className="flex items-center space-x-2.5">
                <div className="p-1.5 rounded bg-rose-500/15 text-rose-500">
                  <Heart className="w-5 h-5 fill-current" />
                </div>
                <div>
                  <h2 className="font-display font-bold text-base sm:text-lg">
                    Saved Excursions
                  </h2>
                  <p className="text-xs text-stone-500 dark:text-slate-400">
                    {savedTours.length} {savedTours.length === 1 ? 'tour' : 'tours'} saved for your holiday
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded text-stone-400 hover:text-stone-700 dark:text-slate-400 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label="Close saved tours"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5">
              {savedTours.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
                  <div className="w-14 h-14 rounded-full bg-stone-200/80 flex items-center justify-center text-stone-400">
                    <Heart className="w-7 h-7" />
                  </div>
                  <h3 className="font-display text-base font-semibold text-[#0E1B2A]">
                    No Saved Excursions Yet
                  </h3>
                  <p className="text-xs text-stone-500 max-w-xs leading-relaxed">
                    Click the heart icon on any tour card to save activities you'd like to experience during your Red Sea stay.
                  </p>
                  <button
                    type="button"
                    onClick={onClose}
                    className="mt-2 px-4 py-2 bg-[#0A6C74] hover:bg-[#08565C] text-white text-xs font-semibold rounded transition-colors"
                  >
                    Browse Excursions
                  </button>
                </div>
              ) : (
                <AnimatePresence mode="popLayout">
                  {savedTours.map((tour) => (
                    <motion.div
                      key={tour.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="bg-white rounded border border-[#E8E3DA] p-3 shadow-xs hover:border-stone-400 transition-colors flex gap-3.5 group"
                    >
                      {/* Thumbnail */}
                      <div 
                        onClick={() => {
                          onSelectTour(tour);
                          onClose();
                        }}
                        className="w-24 h-24 rounded overflow-hidden bg-stone-100 shrink-0 cursor-pointer relative"
                      >
                        <img
                          src={tour.primaryImage}
                          alt={tour.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between text-[10px] text-stone-500 mb-0.5">
                            <span className="flex items-center text-[#0A6C74] font-semibold">
                              <MapPin className="w-3 h-3 mr-0.5" />
                              {tour.destination}
                            </span>
                            <span className="flex items-center text-stone-500">
                              <Clock className="w-3 h-3 mr-0.5" />
                              {tour.durationHours}h
                            </span>
                          </div>

                          <h4
                            onClick={() => {
                              onSelectTour(tour);
                              onClose();
                            }}
                            className="font-display text-xs font-bold text-[#0E1B2A] line-clamp-1 cursor-pointer hover:text-[#0A6C74] transition-colors"
                          >
                            {tour.title}
                          </h4>

                          <div className="text-xs font-bold text-[#0A6C74] mt-1">
                            {formatPrice(tour.priceEur, currency)}
                            <span className="text-[10px] text-stone-400 font-normal"> / person</span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-between pt-2 border-t border-stone-100 mt-2">
                          <button
                            type="button"
                            onClick={() => removeFromWishlist(tour.slug)}
                            className="text-stone-400 hover:text-rose-600 transition-colors p-1"
                            title="Remove from saved"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>

                          <div className="flex items-center space-x-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                onSelectTour(tour);
                                onClose();
                              }}
                              className="px-2 py-1 text-[11px] font-medium text-stone-600 hover:text-stone-900 bg-stone-100 rounded transition-colors"
                            >
                              Details
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                onBookTour(tour);
                                onClose();
                              }}
                              className="px-2.5 py-1 text-[11px] font-semibold text-white bg-[#0A6C74] hover:bg-[#08565C] rounded transition-colors flex items-center space-x-1"
                            >
                              <span>Book</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>

            {/* Footer */}
            {savedTours.length > 0 && (
              <div className="p-4 bg-white border-t border-[#E8E3DA] flex items-center justify-between">
                <button
                  type="button"
                  onClick={clearWishlist}
                  className="text-xs text-stone-500 hover:text-rose-600 transition-colors font-medium flex items-center space-x-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear All</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-[#0A6C74] hover:bg-[#08565C] text-white text-xs font-semibold rounded transition-colors cursor-pointer"
                >
                  Continue Browsing
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
