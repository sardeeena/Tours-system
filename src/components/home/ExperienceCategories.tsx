import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { 
  Ship, 
  Waves, 
  Compass, 
  Sun, 
  Anchor, 
  Landmark, 
  ArrowRight,
  AlertTriangle,
  RotateCcw
} from 'lucide-react';
import { Category } from '../../types';
import { getPublishedCategories, NEUTRAL_CATEGORY_PLACEHOLDER } from '../../services/tourService';

interface ExperienceCategoriesProps {
  onSelectCategory: (categoryName: string) => void;
  categories?: Category[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export const ExperienceCategories: React.FC<ExperienceCategoriesProps> = ({
  onSelectCategory,
  categories: propCategories,
  isLoading: propLoading,
  error: propError,
  onRetry,
}) => {
  const [internalCategories, setInternalCategories] = useState<Category[]>([]);
  const [internalLoading, setInternalLoading] = useState<boolean>(propCategories === undefined);
  const [internalError, setInternalError] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    setInternalLoading(true);
    setInternalError(null);
    try {
      const data = await getPublishedCategories();
      setInternalCategories(data || []);
    } catch (err: any) {
      console.warn('Failed to load published categories from database:', err);
      setInternalError(err.message || 'Unable to load categories from database.');
      setInternalCategories([]);
    } finally {
      setInternalLoading(false);
    }
  }, []);

  useEffect(() => {
    if (propCategories === undefined) {
      fetchCategories();
    }
  }, [propCategories, fetchCategories]);

  // Synchronize when admin updates categories in database
  useEffect(() => {
    const handleDataUpdated = () => {
      if (onRetry) {
        onRetry();
      } else {
        fetchCategories();
      }
    };
    window.addEventListener('rse_data_updated', handleDataUpdated);
    return () => window.removeEventListener('rse_data_updated', handleDataUpdated);
  }, [onRetry, fetchCategories]);

  const categories = propCategories !== undefined ? propCategories : internalCategories;
  const isLoading = propLoading !== undefined ? propLoading : internalLoading;
  const error = propError !== undefined ? propError : internalError;

  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    } else {
      fetchCategories();
    }
  };

  const getIcon = (iconName?: string) => {
    const key = (iconName || '').toLowerCase().trim();
    switch (key) {
      case 'ship':
      case 'boat':
        return <Ship className="w-5 h-5 text-white" />;
      case 'waves':
      case 'snorkeling':
      case 'diving':
        return <Waves className="w-5 h-5 text-white" />;
      case 'compass':
        return <Compass className="w-5 h-5 text-white" />;
      case 'sun':
      case 'safari':
        return <Sun className="w-5 h-5 text-white" />;
      case 'anchor':
        return <Anchor className="w-5 h-5 text-white" />;
      case 'landmark':
      case 'sightseeing':
        return <Landmark className="w-5 h-5 text-white" />;
      default:
        return <Compass className="w-5 h-5 text-white" />;
    }
  };

  return (
    <section id="categories-section" className="py-16 sm:py-24 bg-white dark:bg-[#0A1118] border-b border-[#E8E3DA] dark:border-slate-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-8">
        
        {/* Section Header */}
        <div className="max-w-2xl mb-12">
          <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-[#0A6C74] dark:text-[#60C3CC] mb-2">
            <span className="w-5 h-0.5 bg-[#0A6C74] dark:bg-[#60C3CC] rounded-full"></span>
            <span>Curated Marine & Desert Adventures</span>
          </div>
          <h2 className="font-display text-2xl sm:text-4xl text-[#0E1B2A] dark:text-white tracking-tight">
            Explore by Experience
          </h2>
          <p className="text-stone-600 dark:text-slate-300 text-sm sm:text-base mt-2 leading-relaxed">
            Whether you seek calm shallow turquoise lagoons, offshore dolphin reef encounters, or sunset quad biking across desert mountain canyons.
          </p>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="experience-loading">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div 
                key={i} 
                className={`rounded-2xl border border-stone-200 dark:border-slate-800 bg-stone-100 dark:bg-slate-900/60 h-80 p-6 flex flex-col justify-end space-y-3 relative overflow-hidden select-none skeleton-delay-${i % 5}`}
              >
                <div className={`w-11 h-11 rounded-xl bg-stone-200 dark:bg-slate-800 animate-shimmer skeleton-delay-${i % 5} mb-2`} />
                <div className={`h-6 w-3/4 bg-stone-200 dark:bg-slate-800 rounded animate-shimmer skeleton-delay-${i % 5}`} />
                <div className={`h-4 w-full bg-stone-200/80 dark:bg-slate-800/80 rounded animate-shimmer skeleton-delay-${i % 5}`} />
                <div className={`h-4 w-1/2 bg-stone-200/80 dark:bg-slate-800/80 rounded animate-shimmer skeleton-delay-${i % 5}`} />
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {!isLoading && error && (
          <div className="rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20 p-8 text-center space-y-4 max-w-lg mx-auto" data-testid="experience-error">
            <AlertTriangle className="w-10 h-10 text-red-500 mx-auto" />
            <div>
              <h3 className="text-base font-semibold text-stone-900 dark:text-white">Unable to Load Experiences</h3>
              <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">{error}</p>
            </div>
            <button
              type="button"
              onClick={handleRetry}
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded-lg text-xs font-semibold shadow transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry Loading Experiences</span>
            </button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && categories.length === 0 && (
          <div className="rounded-2xl border border-stone-200 dark:border-slate-800 bg-stone-50 dark:bg-slate-900/40 p-8 text-center space-y-2 max-w-md mx-auto" data-testid="experience-empty">
            <Compass className="w-8 h-8 text-stone-400 dark:text-slate-500 mx-auto" />
            <h3 className="text-sm font-semibold text-stone-800 dark:text-slate-200">No Excursion Categories Available</h3>
            <p className="text-xs text-stone-500 dark:text-slate-400">
              Excursion categories are currently being updated in our database. Please check back shortly.
            </p>
          </div>
        )}

        {/* Database-Driven Categories Grid */}
        {!isLoading && !error && categories.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="experience-grid">
            {categories.map((cat, index) => (
              <motion.div
                key={cat.id || cat.slug || index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.45, delay: index * 0.07 }}
                whileHover={{ y: -6 }}
                onClick={() => onSelectCategory(cat.name)}
                className="group relative rounded-2xl overflow-hidden border border-[#E8E3DA] dark:border-slate-700/80 bg-stone-100 dark:bg-stone-900 cursor-pointer h-80 flex flex-col justify-end p-6 hover:border-[#0A6C74]/70 hover:shadow-2xl transition-all duration-300"
              >
                {/* Background Photography with smooth slow zoom */}
                <div 
                  className="absolute inset-0 bg-cover bg-center transition-transform duration-700 ease-out group-hover:scale-110"
                  style={{ backgroundImage: `url(${cat.image || NEUTRAL_CATEGORY_PLACEHOLDER})` }}
                />
                
                {/* Refined gradient overlay for text readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-stone-950/90 via-stone-900/60 to-black/20 group-hover:via-stone-900/40 transition-colors" />

                {/* Category Card Details */}
                <div className="relative z-10 space-y-2">
                  <div className="flex items-center justify-between mb-1">
                    <div className="w-11 h-11 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 group-hover:scale-110 group-hover:bg-[#0A6C74] transition-all">
                      {getIcon(cat.iconName)}
                    </div>
                    <span className="text-[11px] font-semibold tracking-wider uppercase text-white/90 bg-black/40 px-3 py-1 rounded-full backdrop-blur-md border border-white/10 font-mono">
                      {cat.tourCount} {cat.tourCount === 1 ? 'Excursion' : 'Excursions'}
                    </span>
                  </div>

                  <h3 className="font-display text-xl font-bold text-white group-hover:text-[#60C3CC] transition-colors flex items-center justify-between">
                    <span>{cat.name}</span>
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all text-[#60C3CC]">
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </h3>

                  {cat.description && (
                    <p className="text-xs text-stone-300 line-clamp-2 leading-relaxed">
                      {cat.description}
                    </p>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}

      </div>
    </section>
  );
};
