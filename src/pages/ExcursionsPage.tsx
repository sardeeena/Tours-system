import React, { useState, useMemo, useEffect } from 'react';
import { Tour, CurrencyConfig, Destination, Category } from '../types';
import { TourSearch } from '../components/tours/TourSearch';
import { TourFilters, FilterState, INITIAL_FILTERS } from '../components/tours/TourFilters';
import { TourSort, SortOption } from '../components/tours/TourSort';
import { TourGrid } from '../components/tours/TourGrid';
import { Breadcrumbs } from '../components/common/Breadcrumbs';
import { useSeo } from '../hooks/useSeo';
import { seoService } from '../services/seoService';

const PERSISTENT_FILTERS_KEY = 'rse_persisted_excursion_filters';

function getInitialPersistedFilters(): FilterState {
  try {
    // 1. URL search params takes highest priority
    const params = new URLSearchParams(window.location.search);
    const urlMinPrice = params.get('minPrice');
    const urlMaxPrice = params.get('maxPrice');
    const urlPricePreset = params.get('pricePreset');
    const urlDurations = params.get('durations');
    const urlDuration = params.get('duration');
    const urlDurationPreset = params.get('durationPreset');

    // 2. Saved localStorage state
    const saved = localStorage.getItem(PERSISTENT_FILTERS_KEY);
    const parsedSaved = saved ? JSON.parse(saved) : null;

    const initial: FilterState = parsedSaved 
      ? { ...INITIAL_FILTERS, ...parsedSaved } 
      : { ...INITIAL_FILTERS };

    // Overlay URL params if provided
    if (urlMinPrice !== null) initial.minPrice = Number(urlMinPrice);
    if (urlMaxPrice !== null) initial.maxPrice = Number(urlMaxPrice);
    if (urlPricePreset !== null) initial.priceRangePreset = urlPricePreset;
    if (urlDurationPreset !== null) initial.durationPreset = urlDurationPreset;
    if (urlDurations !== null) {
      initial.durations = urlDurations.split(',').filter(Boolean);
    } else if (urlDuration !== null) {
      initial.durations = [urlDuration];
    }

    return initial;
  } catch {
    return { ...INITIAL_FILTERS };
  }
}

interface ExcursionsPageProps {
  currency: CurrencyConfig;
  tours?: Tour[];
  isLoading?: boolean;
  initialDestination?: string;
  initialCategory?: string;
  destinations?: Destination[];
  categories?: Category[];
  onNavigateHome: () => void;
  onViewTour: (tour: Tour) => void;
  onBookTour: (tour: Tour) => void;
}

export const ExcursionsPage: React.FC<ExcursionsPageProps> = ({
  currency,
  tours = [],
  isLoading = false,
  initialDestination,
  initialCategory,
  destinations,
  categories,
  onNavigateHome,
  onViewTour,
  onBookTour,
}) => {
  // Search bar state
  const [searchQuery, setSearchQuery] = useState('');
  const [destinationSelect, setDestinationSelect] = useState(initialDestination || 'All');
  const [activitySelect, setActivitySelect] = useState(initialCategory || 'All');
  const [date, setDate] = useState('');
  const [guests, setGuests] = useState(2);
  const [activeCategoryTab, setActiveCategoryTab] = useState('All');

  // Persistent sidebar filters
  const [sidebarFilters, setSidebarFilters] = useState<FilterState>(getInitialPersistedFilters);
  const [sortOption, setSortOption] = useState<SortOption>('recommended');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Sync initial props
  useEffect(() => {
    if (initialDestination) {
      setDestinationSelect(initialDestination);
    }
    if (initialCategory) {
      setActivitySelect(initialCategory);
    }
  }, [initialDestination, initialCategory]);

  // Persist sidebar filters to localStorage & sync with URL parameters
  useEffect(() => {
    try {
      localStorage.setItem(PERSISTENT_FILTERS_KEY, JSON.stringify(sidebarFilters));

      // Keep URL clean and synchronised on /excursions route
      if (window.location.pathname.startsWith('/excursions')) {
        const url = new URL(window.location.href);

        if (sidebarFilters.minPrice > 0) {
          url.searchParams.set('minPrice', String(sidebarFilters.minPrice));
        } else {
          url.searchParams.delete('minPrice');
        }

        if (sidebarFilters.maxPrice < 300) {
          url.searchParams.set('maxPrice', String(sidebarFilters.maxPrice));
        } else {
          url.searchParams.delete('maxPrice');
        }

        if (sidebarFilters.priceRangePreset && sidebarFilters.priceRangePreset !== 'all') {
          url.searchParams.set('pricePreset', sidebarFilters.priceRangePreset);
        } else {
          url.searchParams.delete('pricePreset');
        }

        if (sidebarFilters.durations.length > 0) {
          url.searchParams.set('durations', sidebarFilters.durations.join(','));
        } else {
          url.searchParams.delete('durations');
        }

        if (sidebarFilters.durationPreset && sidebarFilters.durationPreset !== 'all') {
          url.searchParams.set('durationPreset', sidebarFilters.durationPreset);
        } else {
          url.searchParams.delete('durationPreset');
        }

        window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
      }
    } catch {
      // ignore
    }
  }, [sidebarFilters]);

  // Handle category tab change
  const handleCategoryTabSelect = (tab: string) => {
    setActiveCategoryTab(tab);
    if (tab === 'All') {
      setActivitySelect('All');
    } else {
      setActivitySelect(tab);
    }
  };

  // Filter & sort logic
  const filteredTours = useMemo(() => {
    return tours.filter((tour) => {
      // 1. Text Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesQuery = 
          tour.title.toLowerCase().includes(q) ||
          tour.destination.toLowerCase().includes(q) ||
          tour.category.toLowerCase().includes(q) ||
          tour.shortDescription.toLowerCase().includes(q) ||
          tour.highlights.some((h) => h.toLowerCase().includes(q));
        if (!matchesQuery) return false;
      }

      // 2. Destination select
      if (destinationSelect !== 'All') {
        const destQuery = destinationSelect.toLowerCase().replace(/[-_ ]/g, '').replace('shiekh', 'sheikh');
        const destName = tour.destination.toLowerCase().replace(/[-_ ]/g, '').replace('shiekh', 'sheikh');
        const destMatch = 
          destName === destQuery ||
          destName.includes(destQuery) ||
          destQuery.includes(destName);
        if (!destMatch) return false;
      }

      // 3. Activity / Category Select
      if (activitySelect !== 'All') {
        const actMatch = 
          tour.category.toLowerCase().includes(activitySelect.toLowerCase()) ||
          tour.categories?.some((c) => c.toLowerCase().includes(activitySelect.toLowerCase()));
        if (!actMatch) return false;
      }

      // 4. Sidebar: Destinations
      if (sidebarFilters.destinations.length > 0) {
        if (!sidebarFilters.destinations.includes(tour.destination)) {
          return false;
        }
      }

      // 5. Sidebar: Activities
      if (sidebarFilters.activities.length > 0) {
        const hasMatchingActivity = sidebarFilters.activities.some(
          (act) => tour.category.includes(act) || tour.categories?.includes(act)
        );
        if (!hasMatchingActivity) return false;
      }

      // 6. Sidebar: Duration Categories ('Half Day', 'Full Day', 'Multi Day')
      if (sidebarFilters.durations.length > 0) {
        if (!sidebarFilters.durations.includes(tour.durationCategory)) {
          return false;
        }
      }

      // 6b. Sidebar: Duration Preset hours
      if (sidebarFilters.durationPreset && sidebarFilters.durationPreset !== 'all') {
        if (sidebarFilters.durationPreset === 'under_4' && tour.durationHours >= 4) {
          return false;
        }
        if (sidebarFilters.durationPreset === '4_8' && (tour.durationHours < 4 || tour.durationHours > 8)) {
          return false;
        }
        if (sidebarFilters.durationPreset === '8_plus' && tour.durationHours <= 8) {
          return false;
        }
      }

      // 7. Sidebar: Tour Type
      if (sidebarFilters.tourTypes.length > 0) {
        if (!sidebarFilters.tourTypes.includes(tour.tourType)) {
          return false;
        }
      }

      // 8. Sidebar: Price Range (Min & Max)
      if (tour.priceEur < sidebarFilters.minPrice || tour.priceEur > sidebarFilters.maxPrice) {
        return false;
      }

      // 9. Sidebar: Rating
      if (sidebarFilters.minRating > 0 && tour.rating < sidebarFilters.minRating) {
        return false;
      }

      // 10. Sidebar: Pickup
      if (sidebarFilters.pickupOnly && !tour.pickupAvailable) {
        return false;
      }

      // 11. Sidebar: Languages
      if (sidebarFilters.languages.length > 0) {
        const hasLang = sidebarFilters.languages.some((l) => tour.languages.includes(l));
        if (!hasLang) return false;
      }

      return true;
    }).sort((a, b) => {
      switch (sortOption) {
        case 'price_asc':
          return a.priceEur - b.priceEur;
        case 'price_desc':
          return b.priceEur - a.priceEur;
        case 'rating_desc':
          return b.rating - a.rating || b.reviewCount - a.reviewCount;
        case 'duration_asc':
          return a.durationHours - b.durationHours;
        case 'recommended':
        default:
          return b.reviewCount - a.reviewCount;
      }
    });
  }, [
    searchQuery,
    destinationSelect,
    activitySelect,
    sidebarFilters,
    sortOption,
    tours,
  ]);

  const handleClearAll = () => {
    setSearchQuery('');
    setDestinationSelect('All');
    setActivitySelect('All');
    setActiveCategoryTab('All');
    setSidebarFilters(INITIAL_FILTERS);
    try {
      localStorage.removeItem(PERSISTENT_FILTERS_KEY);
      if (window.location.pathname.startsWith('/excursions')) {
        window.history.replaceState({}, '', '/excursions');
      }
    } catch {
      // ignore
    }
  };

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (sidebarFilters.minPrice > 0 || sidebarFilters.maxPrice < 300) count++;
    if (sidebarFilters.durations.length > 0 || sidebarFilters.durationPreset !== 'all') count++;
    if (sidebarFilters.destinations.length > 0) count += sidebarFilters.destinations.length;
    if (sidebarFilters.activities.length > 0) count += sidebarFilters.activities.length;
    if (sidebarFilters.tourTypes.length > 0) count += sidebarFilters.tourTypes.length;
    if (sidebarFilters.pickupOnly) count++;
    return count;
  }, [sidebarFilters]);

  // Dynamic SEO meta tags, OpenGraph, and Schema.org JSON-LD based on current filters
  const activeLabel = activitySelect !== 'All' ? activitySelect : destinationSelect !== 'All' ? destinationSelect : 'All';
  const seoData = useMemo(() => {
    return seoService.generateCategorySeo(activeLabel, filteredTours.length, filteredTours);
  }, [activeLabel, filteredTours]);
  useSeo(seoData);

  return (
    <div className="bg-[#FAF8F5] min-h-screen py-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      
      {/* Breadcrumbs */}
      <Breadcrumbs
        items={[
          { label: 'Home', onClick: onNavigateHome },
          { label: 'Excursions' },
        ]}
      />

      {/* Page Title & Supporting Text */}
      <div className="py-4 border-b border-stone-200 mb-6">
        <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold text-[#0E1B2A] tracking-tight">
          Explore Our Excursions
        </h1>
        <p className="text-xs sm:text-sm text-stone-600 mt-1 max-w-2xl">
          From coral reefs and island beaches to desert adventures, choose the experience that fits your holiday.
        </p>
      </div>

      {/* Top Search & Filter Area */}
      <div className="mb-6">
        <TourSearch
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          destination={destinationSelect}
          onDestinationChange={setDestinationSelect}
          activity={activitySelect}
          onActivityChange={setActivitySelect}
          date={date}
          onDateChange={setDate}
          guests={guests}
          onGuestsChange={setGuests}
          activeCategoryTab={activeCategoryTab}
          onSelectCategoryTab={handleCategoryTabSelect}
          destinations={destinations}
          categories={categories}
        />
      </div>

      {/* Desktop Layout: Persistent Left Sidebar + Right Results */}
      <div className="flex items-start gap-8">
        
        {/* Left Persistent Filter Sidebar */}
        <TourFilters
          filters={sidebarFilters}
          onChange={setSidebarFilters}
          onClear={handleClearAll}
          currency={currency}
          isOpenMobile={mobileFiltersOpen}
          onCloseMobile={() => setMobileFiltersOpen(false)}
          totalFilteredCount={filteredTours.length}
          allTours={tours}
        />

        {/* Right Results Column */}
        <div className="flex-1 min-w-0">
          
          {/* Sorting Header */}
          <TourSort
            totalCount={filteredTours.length}
            sortOption={sortOption}
            onSortChange={setSortOption}
            onOpenMobileFilters={() => setMobileFiltersOpen(true)}
            activeFiltersCount={activeFiltersCount}
          />

          {/* Tour Grid with Skeleton Loading */}
          <TourGrid
            tours={filteredTours}
            currency={currency}
            isLoading={isLoading}
            skeletonCount={6}
            onViewTour={onViewTour}
            onBookNow={onBookTour}
            onClearFilters={handleClearAll}
          />

        </div>

      </div>

    </div>
  );
};
