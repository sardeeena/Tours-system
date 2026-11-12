import React from 'react';
import { motion } from 'motion/react';
import { Star, Clock, MapPin, CheckCircle2, ArrowRight, Heart, Eye, Scale, Sparkles, Compass } from 'lucide-react';
import { Tour, CurrencyConfig } from '../../types';
import { formatPrice } from '../../data/toursData';
import { useWishlist } from '../../contexts/WishlistContext';
import { useComparison } from '../../contexts/ComparisonContext';

interface TourCardProps {
  tour: Tour;
  currency: CurrencyConfig;
  onViewTour: (tour: Tour) => void;
  onBookNow?: (tour: Tour) => void;
  onQuickView?: (tour: Tour) => void;
}

export const TourCard: React.FC<TourCardProps> = ({
  tour,
  currency,
  onViewTour,
  onBookNow,
  onQuickView,
}) => {
  const { isFavorite, toggleFavorite } = useWishlist();
  const { isCompared, toggleCompare } = useComparison();

  const favorite = isFavorite(tour.slug);
  const compared = isCompared(tour.slug);

  return (
    <motion.article 
      whileHover={{ y: -6 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="bg-white rounded-2xl border border-[#E8E3DA] overflow-hidden flex flex-col hover:border-[#0A6C74]/50 hover:shadow-xl transition-all duration-300 group h-full relative"
    >
      {/* Photo with smooth zoom and vignette */}
      <div 
        className="relative aspect-[16/10] overflow-hidden bg-stone-100 cursor-pointer"
        onClick={() => onViewTour(tour)}
      >
        {tour.primaryImage ? (
          <img
            src={tour.primaryImage}
            alt={tour.title}
            className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-700 ease-out"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-stone-200 text-stone-400">
            <Compass className="w-8 h-8 mb-1 opacity-50 text-[#0A6C74]" />
            <span className="text-[10px] font-medium tracking-wide uppercase">Photo Coming Soon</span>
          </div>
        )}

        {/* Cinematic gradient vignette */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 pointer-events-none" />

        {/* Badge */}
        {tour.badge && (
          <div className="absolute top-3 left-3 bg-white/95 dark:bg-[#0E1B2A]/90 backdrop-blur-md text-stone-900 dark:text-white text-[10px] font-bold px-2.5 py-1 rounded-full tracking-wider uppercase border border-stone-200/60 dark:border-white/10 shadow-sm flex items-center space-x-1">
            <Sparkles className="w-3 h-3 text-[#0A6C74] dark:text-[#60C3CC]" />
            <span>{tour.badge}</span>
          </div>
        )}

        {/* Quick View Button on Image Hover */}
        {onQuickView && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onQuickView(tour);
            }}
            className="absolute inset-0 m-auto w-32 h-10 rounded-full bg-white/95 text-stone-900 text-xs font-semibold shadow-xl flex items-center justify-center space-x-1.5 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-white z-10 cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5 text-[#0A6C74]" />
            <span>Quick View</span>
          </motion.button>
        )}

        {/* Wishlist Heart Button with Bouncy Tap Feedback */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.8 }}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(tour.slug, tour.title);
          }}
          className={`absolute top-3 right-3 p-2.5 rounded-full backdrop-blur-md transition-all duration-200 z-20 cursor-pointer ${
            favorite
              ? 'bg-rose-50 text-rose-600 shadow-md scale-105'
              : 'bg-black/40 text-white hover:bg-white hover:text-stone-900'
          }`}
          title={favorite ? 'Remove from saved' : 'Save to wishlist'}
          aria-label={favorite ? 'Remove from saved' : 'Save to wishlist'}
        >
          <Heart className={`w-4 h-4 ${favorite ? 'fill-current text-rose-600' : ''}`} />
        </motion.button>

        {/* Free Cancellation Tag */}
        <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-md text-emerald-900 text-[10px] font-semibold px-2.5 py-0.5 rounded-full shadow-sm flex items-center border border-emerald-200/50">
          <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600 shrink-0" />
          <span>Free Cancellation</span>
        </div>
      </div>

      {/* Content */}
      <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
        <div>
          {/* Unboxed Metadata Line */}
          <div className="flex items-center space-x-2 text-[11px] text-stone-500 font-medium mb-1.5">
            <span className="flex items-center text-[#0A6C74] font-semibold">
              <MapPin className="w-3 h-3 mr-1 shrink-0" />
              {tour.destination}
            </span>
            <span aria-hidden="true" className="text-stone-300">·</span>
            <span className="truncate max-w-[120px] text-stone-600">{tour.category}</span>
            <span aria-hidden="true" className="text-stone-300">·</span>
            <span className="flex items-center text-stone-600 shrink-0">
              <Clock className="w-3 h-3 mr-1 text-stone-400 shrink-0" />
              {tour.durationHours}h
            </span>
          </div>

          {/* Tour Title */}
          <h3 
            onClick={() => onViewTour(tour)}
            className="font-display text-base font-bold text-[#0E1B2A] dark:text-white leading-snug line-clamp-2 hover:text-[#0A6C74] dark:hover:text-[#2dd4bf] cursor-pointer mb-2 transition-colors min-h-[44px]"
            title={tour.title}
          >
            {tour.title}
          </h3>

          {/* Short description */}
          <p className="text-xs text-stone-600 dark:text-slate-300 line-clamp-2 leading-relaxed mb-3 min-h-[36px]">
            {tour.shortDescription}
          </p>

          {/* Rating */}
          <div className="flex items-center space-x-1.5 mb-2 text-xs">
            {tour.reviewCount > 0 ? (
              <>
                <div className="flex text-amber-400">
                  {[...Array(5)].map((_, i) => (
                    <Star 
                      key={i} 
                      className={`w-3.5 h-3.5 ${i < Math.floor(tour.rating) ? 'fill-current' : 'fill-current opacity-25'}`} 
                    />
                  ))}
                </div>
                <span className="font-bold text-stone-900 text-xs font-mono">{tour.rating.toFixed(1)}</span>
                <span className="text-stone-400">·</span>
                <span className="text-stone-500 text-[11px]">({tour.reviewCount} reviews)</span>
              </>
            ) : (
              <span className="text-stone-500 text-[11px] font-medium">New Excursion</span>
            )}
          </div>

          {/* Pickup info */}
          <div className="text-[11px] text-stone-500 flex items-center">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 shrink-0" />
            <span className="truncate">{tour.pickupInfo}</span>
          </div>
        </div>

        {/* Compare Checkbox & Pricing Row */}
        <div className="pt-3 border-t border-stone-100 space-y-2.5">
          {/* Quick comparison toggle button */}
          <div className="flex items-center justify-between text-[11px]">
            <button
              type="button"
              onClick={() => toggleCompare(tour.slug, tour.title)}
              className={`flex items-center space-x-1.5 font-medium transition-colors cursor-pointer ${
                compared
                  ? 'text-[#0A6C74] font-semibold'
                  : 'text-stone-400 hover:text-stone-700'
              }`}
            >
              <Scale className="w-3.5 h-3.5" />
              <span>{compared ? 'In Comparison' : 'Compare'}</span>
            </button>

            {onQuickView && (
              <button
                type="button"
                onClick={() => onQuickView(tour)}
                className="text-stone-400 hover:text-[#0A6C74] font-medium transition-colors cursor-pointer"
              >
                Quick details
              </button>
            )}
          </div>

          {/* Pricing & Primary Action */}
          <div className="flex items-center justify-between">
            <div>
              <span className="block text-[10px] uppercase font-bold text-stone-400 tracking-wider">From</span>
              <div className="flex items-baseline space-x-1">
                <span className="text-lg font-bold text-[#0E1B2A] font-mono">
                  {formatPrice(tour.priceEur, currency)}
                </span>
                <span className="text-[11px] text-stone-500 font-medium">/ person</span>
              </div>
            </div>

            <div className="flex items-center space-x-1.5">
              <button
                type="button"
                onClick={() => onViewTour(tour)}
                className="px-3 py-2 text-xs font-semibold text-stone-700 hover:text-stone-900 bg-stone-100 hover:bg-stone-200/80 rounded-xl transition-all cursor-pointer"
              >
                Details
              </button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                type="button"
                onClick={() => (onBookNow ? onBookNow(tour) : onViewTour(tour))}
                className="px-3.5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-[#0A6C74] to-[#0D838C] hover:from-[#08565C] hover:to-[#0A6C74] rounded-xl transition-all shadow-xs flex items-center space-x-1 group/btn cursor-pointer"
              >
                <span>Book</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-0.5 transition-transform" />
              </motion.button>
            </div>
          </div>
        </div>
      </div>
    </motion.article>
  );
};
