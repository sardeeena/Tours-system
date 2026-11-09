import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Scale, X, ArrowRight } from 'lucide-react';
import { Tour } from '../../types';
import { useComparison } from '../../contexts/ComparisonContext';

interface CompareFloatingBarProps {
  allTours: Tour[];
  onOpenCompareModal: () => void;
}

export const CompareFloatingBar: React.FC<CompareFloatingBarProps> = ({
  allTours,
  onOpenCompareModal,
}) => {
  const { comparedSlugs, removeFromCompare, clearComparison } = useComparison();

  const selectedTours = allTours.filter((t) => comparedSlugs.includes(t.slug));

  if (selectedTours.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-xl w-[92%] sm:w-auto bg-white/95 dark:bg-[#0E1B2A] text-stone-900 dark:text-white rounded-full shadow-2xl border border-stone-200/90 dark:border-slate-700/80 px-4 py-2.5 flex items-center justify-between gap-3 sm:gap-6 backdrop-blur-md transition-colors"
      >
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-full bg-[#0A6C74] flex items-center justify-center text-white shrink-0">
            <Scale className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold leading-tight flex items-center gap-1.5">
              <span>Compare Excursions</span>
              <span className="bg-stone-100 dark:bg-[#16283D] border border-stone-200 dark:border-slate-600 px-1.5 py-0.2 rounded-full text-[10px] text-[#0A6C74] dark:text-[#60C3CC]">
                {selectedTours.length}/3
              </span>
            </div>
            <p className="text-[10px] text-stone-500 dark:text-slate-400 hidden sm:block">
              Side-by-side itinerary & inclusions
            </p>
          </div>
        </div>

        {/* Small thumbnail pills */}
        <div className="flex items-center space-x-1.5">
          {selectedTours.map((t) => (
            <div
              key={t.id}
              className="relative group w-8 h-8 rounded-full overflow-hidden border border-slate-600 shrink-0"
              title={t.title}
            >
              <img src={t.primaryImage} alt={t.title} className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => removeFromCompare(t.slug)}
                className="absolute inset-0 bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white"
                title="Remove from comparison"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex items-center space-x-2 shrink-0">
          <button
            type="button"
            onClick={clearComparison}
            className="text-[11px] text-slate-400 hover:text-white px-2 py-1 transition-colors"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={onOpenCompareModal}
            className="px-3.5 py-1.5 bg-[#0A6C74] hover:bg-[#08565C] text-white text-xs font-semibold rounded-full flex items-center space-x-1.5 transition-colors shadow-sm"
          >
            <span>Compare</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
