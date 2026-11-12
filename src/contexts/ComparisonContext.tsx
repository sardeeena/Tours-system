import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { useToast } from './ToastContext';
import { recordVisitorEvent } from '../services/visitorAnalyticsService';

interface ComparisonContextType {
  comparedSlugs: string[];
  addToCompare: (slug: string, tourTitle?: string) => boolean;
  removeFromCompare: (slug: string) => void;
  toggleCompare: (slug: string, tourTitle?: string) => void;
  clearComparison: () => void;
  isCompared: (slug: string) => boolean;
  comparisonCount: number;
}

const ComparisonContext = createContext<ComparisonContextType | undefined>(undefined);

export const ComparisonProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { showToast } = useToast();
  const [comparedSlugs, setComparedSlugs] = useState<string[]>([]);

  const isCompared = useCallback(
    (slug: string) => comparedSlugs.includes(slug),
    [comparedSlugs]
  );

  const addToCompare = useCallback(
    (slug: string, tourTitle?: string): boolean => {
      if (comparedSlugs.length >= 3) {
        showToast('You can compare a maximum of 3 excursions at once.', 'info');
        return false;
      }
      if (!comparedSlugs.includes(slug)) {
        setComparedSlugs((prev) => [...prev, slug]);
        void recordVisitorEvent({ event_name: 'comparison_updated', page_path: window.location.pathname, event_data: { tour_slug: slug, interaction: 'added' } });
        showToast(
          tourTitle ? `Added "${tourTitle}" to comparison` : 'Added to excursion comparison',
          'success'
        );
        return true;
      }
      return true;
    },
    [comparedSlugs, showToast]
  );

  const removeFromCompare = useCallback((slug: string) => {
    if (!comparedSlugs.includes(slug)) return;
    setComparedSlugs((prev) => prev.filter((s) => s !== slug));
    void recordVisitorEvent({ event_name: 'comparison_updated', page_path: window.location.pathname, event_data: { tour_slug: slug, interaction: 'removed' } });
  }, [comparedSlugs]);

  const toggleCompare = useCallback(
    (slug: string, tourTitle?: string) => {
      if (comparedSlugs.includes(slug)) {
        removeFromCompare(slug);
        showToast('Removed from comparison', 'info');
      } else {
        addToCompare(slug, tourTitle);
      }
    },
    [comparedSlugs, addToCompare, removeFromCompare, showToast]
  );

  const clearComparison = useCallback(() => {
    if (!comparedSlugs.length) return;
    setComparedSlugs([]);
    void recordVisitorEvent({ event_name: 'comparison_updated', page_path: window.location.pathname, event_data: { interaction: 'cleared' } });
  }, [comparedSlugs]);

  return (
    <ComparisonContext.Provider
      value={{
        comparedSlugs,
        addToCompare,
        removeFromCompare,
        toggleCompare,
        clearComparison,
        isCompared,
        comparisonCount: comparedSlugs.length,
      }}
    >
      {children}
    </ComparisonContext.Provider>
  );
};

export const useComparison = () => {
  const context = useContext(ComparisonContext);
  if (!context) {
    throw new Error('useComparison must be used within a ComparisonProvider');
  }
  return context;
};
