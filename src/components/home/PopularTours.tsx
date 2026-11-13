import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowRight, 
  Filter,
  Sparkles,
  Compass
} from 'lucide-react';
import { Tour, CurrencyConfig } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { TourCard } from '../tours/TourCard';
import { TourCardSkeleton } from '../tours/TourCardSkeleton';
import { TourPreviewModal } from './TourPreviewModal';
import { QuickBookModal } from './QuickBookModal';

interface PopularToursProps {
  tours: Tour[];
  currency: CurrencyConfig;
  isLoading?: boolean;
  onSelectTour: (tour: Tour) => void;
  onQuickBook: (tour: Tour) => void;
  onViewAllExcursions?: () => void;
  activeFilterSummary?: string;
  onClearFilters?: () => void;
}

export const PopularTours: React.FC<PopularToursProps> = ({
  tours,
  currency,
  isLoading = false,
  onSelectTour,
  onQuickBook,
  onViewAllExcursions,
  activeFilterSummary,
  onClearFilters,
}) => {
  const { t } = useLanguage();
  const [selectedCategoryTab, setSelectedCategoryTab] = useState<string>('All');

  // Modal states for Quick View & Quick Book
  const [previewTour, setPreviewTour] = useState<Tour | null>(null);
  const [quickBookTargetTour, setQuickBookTargetTour] = useState<Tour | null>(null);

  // Dynamically derive category tabs from genuine loaded tours
  const dynamicCategories = useMemo(() => {
    const set = new Set<string>();
    for (const t of tours) {
      if (t.category) set.add(t.category);
      if (Array.isArray(t.categories)) {
        for (const c of t.categories) {
          if (c) set.add(c);
        }
      }
    }
    return ['All', ...Array.from(set)];
  }, [tours]);

  const filteredTours = selectedCategoryTab === 'All' 
    ? tours 
    : tours.filter(
        (t) =>
          t.category === selectedCategoryTab ||
          (Array.isArray(t.categories) && t.categories.includes(selectedCategoryTab))
      );

  return (
    <section id="tours-section" className="py-16 sm:py-24 bg-[#FAF8F5] dark:bg-[#0A1118] border-b border-[#E8E3DA] dark:border-slate-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-8">
        
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div>
            <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-[#0A6C74] dark:text-[#60C3CC] mb-2">
              <span className="w-5 h-0.5 bg-[#0A6C74] dark:bg-[#60C3CC] rounded-full"></span>
              <span>Handpicked Egypt Tours & Experiences</span>
            </div>
            <h2 className="font-display text-2xl sm:text-4xl text-[#0E1B2A] dark:text-white tracking-tight">
              {t('popular.title')}
            </h2>
            <p className="text-stone-600 dark:text-slate-300 text-sm sm:text-base mt-2 max-w-xl">
              {t('popular.subtitle')}
            </p>
          </div>

          {activeFilterSummary && (
            <div className="flex items-center bg-stone-100 dark:bg-[#132235] border border-stone-300 dark:border-slate-700 rounded-xl px-3.5 py-1.5 text-xs text-stone-700 dark:text-slate-200 self-start md:self-auto shadow-2xs">
              <Filter className="w-3.5 h-3.5 mr-1.5 text-[#0A6C74] dark:text-[#60C3CC]" />
              <span className="font-medium mr-2">{activeFilterSummary}</span>
              {onClearFilters && (
                <button
                  type="button"
                  onClick={onClearFilters}
                  className="text-[#0A6C74] dark:text-[#60C3CC] font-semibold hover:underline cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
          )}
        </div>

        {/* Animated Category Tabs */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-3 mb-8 no-scrollbar text-xs sm:text-sm font-medium">
          {dynamicCategories.map((cat) => {
            const isSelected = selectedCategoryTab === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategoryTab(cat)}
                className={`relative px-4 py-2 rounded-xl whitespace-nowrap transition-all border cursor-pointer ${
                  isSelected
                    ? 'bg-[#0A6C74] text-white border-[#0A6C74] shadow-md font-semibold'
                    : 'bg-white dark:bg-[#132235] text-stone-700 dark:text-slate-200 border-stone-200 dark:border-slate-700 hover:border-stone-400 hover:bg-stone-50 dark:hover:bg-[#182C44]'
                }`}
              >
                {cat === 'All' ? 'All Experiences' : cat}
              </button>
            );
          })}
        </div>

        {/* Tours Grid with Motion Animations or Skeleton Loader */}
        {isLoading ? (
          <div 
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 min-w-0 w-full"
            aria-busy="true"
            aria-label="Loading handpicked excursions from Supabase"
          >
            {[...Array(8)].map((_, index) => (
              <TourCardSkeleton key={index} staggerIndex={index} />
            ))}
          </div>
        ) : filteredTours.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E8E3DA] p-12 text-center my-6 shadow-sm">
            <p className="text-stone-700 font-semibold text-base mb-1">No excursions match your current filter.</p>
            <p className="text-stone-500 text-xs mb-4">Try clearing your filters or selecting a different category.</p>
            <button
              type="button"
              onClick={() => {
                setSelectedCategoryTab('All');
                if (onClearFilters) onClearFilters();
              }}
              className="px-4 py-2 bg-[#0A6C74] text-white text-xs font-semibold rounded-xl hover:bg-[#08565C] transition-colors cursor-pointer"
            >
              Show All Excursions
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 min-w-0 w-full">
            <AnimatePresence mode="popLayout">
              {filteredTours.map((tour, index) => (
                <motion.div
                  key={tour.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.35, delay: Math.min(index * 0.05, 0.25) }}
                >
                  <TourCard
                    tour={tour}
                    currency={currency}
                    onViewTour={onSelectTour}
                    onBookNow={onQuickBook}
                    onQuickView={(t) => setPreviewTour(t)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* View all excursions CTA */}
        {onViewAllExcursions && (
          <div className="mt-12 text-center">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              type="button"
              onClick={onViewAllExcursions}
              className="inline-flex items-center px-7 py-3.5 bg-[#0A6C74] hover:bg-[#08565C] text-white text-xs sm:text-sm font-semibold rounded-xl transition-all shadow-md space-x-2.5 cursor-pointer group"
            >
              <span>{t('popular.viewAll')}</span>
              <ArrowRight className="w-4 h-4 text-white group-hover:translate-x-1 transition-transform" />
            </motion.button>
          </div>
        )}

      </div>

      {/* Connected Tour Preview Modal */}
      <TourPreviewModal
        tour={previewTour}
        currency={currency}
        onClose={() => setPreviewTour(null)}
        onBookNow={(t) => {
          setPreviewTour(null);
          onQuickBook(t);
        }}
      />

      {/* Connected Direct Quick Book Modal */}
      <QuickBookModal
        tour={quickBookTargetTour}
        currency={currency}
        onClose={() => setQuickBookTargetTour(null)}
        onSuccess={() => {
          if (quickBookTargetTour) {
            onQuickBook(quickBookTargetTour);
          }
        }}
      />
    </section>
  );
};
