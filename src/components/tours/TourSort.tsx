import React from 'react';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';

export type SortOption = 
  | 'recommended' 
  | 'price_asc' 
  | 'price_desc' 
  | 'rating_desc' 
  | 'duration_asc';

interface TourSortProps {
  totalCount: number;
  sortOption: SortOption;
  onSortChange: (sort: SortOption) => void;
  onOpenMobileFilters?: () => void;
  activeFiltersCount?: number;
}

export const TourSort: React.FC<TourSortProps> = ({
  totalCount,
  sortOption,
  onSortChange,
  onOpenMobileFilters,
  activeFiltersCount = 0,
}) => {
  return (
    <div className="flex items-center justify-between py-3 border-b border-stone-200 text-xs text-stone-600 mb-6">
      
      {/* Dynamic Count */}
      <div className="flex items-center space-x-2">
        <span className="font-display text-sm sm:text-base font-bold text-[#0E1B2A]">
          {totalCount} {totalCount === 1 ? 'experience' : 'experiences'}
        </span>
        <span className="text-stone-400 hidden sm:inline">found in the Red Sea</span>
      </div>

      {/* Sort controls & Mobile filter button */}
      <div className="flex items-center space-x-2.5">
        {/* Mobile Filter Button */}
        {onOpenMobileFilters && (
          <button
            type="button"
            onClick={onOpenMobileFilters}
            className="lg:hidden inline-flex items-center px-3 py-1.5 border border-stone-300 rounded-sm bg-white text-stone-800 font-semibold shadow-xs"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5 text-[#0A6C74]" />
            <span>Filters</span>
            {activeFiltersCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.2 rounded-full bg-[#0A6C74] text-white text-[10px] font-bold">
                {activeFiltersCount}
              </span>
            )}
          </button>
        )}

        {/* Sort Dropdown */}
        <div className="flex items-center space-x-1.5">
          <label htmlFor="sort-select" className="text-stone-500 hidden sm:inline">
            Sort by:
          </label>
          <div className="relative">
            <select
              id="sort-select"
              value={sortOption}
              onChange={(e) => onSortChange(e.target.value as SortOption)}
              className="pl-2.5 pr-7 py-1.5 rounded-sm border border-stone-200 bg-white text-[#0E1B2A] text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#0A6C74] appearance-none cursor-pointer"
            >
              <option value="recommended">Recommended</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="rating_desc">Highest Rated</option>
              <option value="duration_asc">Shortest Duration</option>
            </select>
            <ChevronDown className="w-3 h-3 absolute right-2 top-2.5 text-stone-400 pointer-events-none" />
          </div>
        </div>
      </div>

    </div>
  );
};
