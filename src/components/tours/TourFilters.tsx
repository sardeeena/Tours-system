import React, { useState, useMemo } from 'react';
import { 
  X, 
  RotateCcw, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  SlidersHorizontal,
  Clock,
  Sparkles,
  BookmarkCheck,
  Tag,
  CircleDollarSign,
  Compass,
  Star
} from 'lucide-react';
import { CurrencyConfig, Tour } from '../../types';

export interface FilterState {
  destinations: string[];
  activities: string[];
  durations: string[]; // DurationCategory values: 'Half Day', 'Full Day', 'Multi Day'
  durationPreset: string; // 'all' | 'under_4' | '4_8' | '8_plus'
  tourTypes: string[];
  minPrice: number; // in EUR
  maxPrice: number; // in EUR
  priceRangePreset: string; // 'all' | 'under_40' | '40_80' | '80_150' | '150_plus' | 'custom'
  minRating: number;
  pickupOnly: boolean;
  languages: string[];
}

export const INITIAL_FILTERS: FilterState = {
  destinations: [],
  activities: [],
  durations: [],
  durationPreset: 'all',
  tourTypes: [],
  minPrice: 0,
  maxPrice: 300,
  priceRangePreset: 'all',
  minRating: 0,
  pickupOnly: false,
  languages: [],
};

export const PRICE_PRESETS = [
  { id: 'all', label: 'All Prices', min: 0, max: 300 },
  { id: 'under_40', label: 'Under €40', min: 0, max: 40 },
  { id: '40_80', label: '€40 – €80', min: 40, max: 80 },
  { id: '80_150', label: '€80 – €150', min: 80, max: 150 },
  { id: '150_plus', label: '€150+', min: 150, max: 300 },
];

export const DURATION_PRESETS = [
  { id: 'all', label: 'Any Duration' },
  { id: 'under_4', label: '< 4 Hours', sublabel: 'Quick Trips' },
  { id: '4_8', label: '4 – 8 Hours', sublabel: 'Standard Day' },
  { id: '8_plus', label: '8+ Hours', sublabel: 'Full Day & Long' },
];

interface TourFiltersProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  onClear: () => void;
  currency: CurrencyConfig;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  totalFilteredCount: number;
  allTours?: Tour[];
}

export const TourFilters: React.FC<TourFiltersProps> = ({
  filters,
  onChange,
  onClear,
  currency,
  isOpenMobile,
  onCloseMobile,
  totalFilteredCount,
  allTours = [],
}) => {
  // Collapsible section toggles
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    price: true,
    duration: true,
    destinations: true,
    activities: false,
    tourType: false,
    rating: false,
  });

  const toggleSection = (section: string) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const destinationsList = useMemo(() => {
    const defaultList = [
      'Hurghada',
      'El Gouna',
      'Makadi Bay',
      'Sahl Hasheesh',
      'Safaga',
      'Marsa Alam',
      'Sharm El-Sheikh',
    ];
    const fromTours = allTours.map((t) => t.destination).filter(Boolean);
    return Array.from(new Set([...defaultList, ...fromTours]));
  }, [allTours]);

  const activitiesList = [
    'Snorkeling',
    'Diving',
    'Boat Trip',
    'Island',
    'Safari',
    'Quad',
    'Water Sports',
    'Private Tour'
  ];

  const durationsCategoryList = [
    { key: 'Half Day', label: 'Half Day', desc: '2 – 5 hours' },
    { key: 'Full Day', label: 'Full Day', desc: '6 – 9 hours' },
    { key: 'Multi Day', label: 'Multi Day / Extended', desc: '10+ hours' },
  ];

  const tourTypesList = ['Shared', 'Private'];
  const languagesList = ['English', 'German', 'Italian', 'Romanian', 'French', 'Russian'];

  // Currency conversion helpers
  const formatWithRate = (eur: number) => {
    const converted = Math.round(eur * currency.rateToEur);
    return `${currency.symbol}${converted}`;
  };

  // Compute live counts from all available catalog tours
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      'Half Day': 0,
      'Full Day': 0,
      'Multi Day': 0,
    };
    allTours.forEach((t) => {
      if (counts[t.durationCategory] !== undefined) {
        counts[t.durationCategory]++;
      }
    });
    return counts;
  }, [allTours]);

  const priceRangeCounts = useMemo(() => {
    return allTours.filter(
      (t) => t.priceEur >= filters.minPrice && t.priceEur <= filters.maxPrice
    ).length;
  }, [allTours, filters.minPrice, filters.maxPrice]);

  const handleToggle = (key: 'destinations' | 'activities' | 'durations' | 'tourTypes' | 'languages', value: string) => {
    const list = filters[key] as string[];
    const next = list.includes(value)
      ? list.filter((item) => item !== value)
      : [...list, value];
    onChange({ ...filters, [key]: next });
  };

  const handlePricePresetSelect = (presetId: string, min: number, max: number) => {
    onChange({
      ...filters,
      priceRangePreset: presetId,
      minPrice: min,
      maxPrice: max,
    });
  };

  const handleMinPriceChange = (value: number) => {
    const clamped = Math.max(0, Math.min(value, filters.maxPrice - 5));
    onChange({
      ...filters,
      priceRangePreset: 'custom',
      minPrice: clamped,
    });
  };

  const handleMaxPriceChange = (value: number) => {
    const clamped = Math.max(filters.minPrice + 5, Math.min(value, 300));
    onChange({
      ...filters,
      priceRangePreset: 'custom',
      maxPrice: clamped,
    });
  };

  const handleResetPrice = () => {
    onChange({
      ...filters,
      priceRangePreset: 'all',
      minPrice: 0,
      maxPrice: 300,
    });
  };

  const handleResetDuration = () => {
    onChange({
      ...filters,
      durationPreset: 'all',
      durations: [],
    });
  };

  const isPriceFiltered = filters.minPrice > 0 || filters.maxPrice < 300 || filters.priceRangePreset !== 'all';
  const isDurationFiltered = filters.durations.length > 0 || filters.durationPreset !== 'all';

  const hasActiveFilters = 
    isPriceFiltered ||
    isDurationFiltered ||
    filters.destinations.length > 0 ||
    filters.activities.length > 0 ||
    filters.tourTypes.length > 0 ||
    filters.minRating > 0 ||
    filters.pickupOnly ||
    filters.languages.length > 0;

  // Render filter content
  const content = (
    <div className="space-y-5 text-xs text-stone-700">
      
      {/* Sidebar Header & Persistence Status */}
      <div className="pb-3 border-b border-stone-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5">
            <SlidersHorizontal className="w-4 h-4 text-[#0A6C74]" />
            <h2 className="font-display font-bold text-sm text-[#0E1B2A] tracking-tight">
              Filters
            </h2>
            {hasActiveFilters && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-[#0A6C74] text-white text-[10px] font-bold">
                Active
              </span>
            )}
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={onClear}
              className="text-[11px] font-semibold text-[#0A6C74] hover:text-[#08565C] flex items-center transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3 mr-1" />
              Reset All
            </button>
          )}
        </div>

        {/* Persistence Indicator Note */}
        <div className="flex items-center space-x-1 text-[10px] text-stone-500 mt-1.5">
          <BookmarkCheck className="w-3 h-3 text-emerald-600 shrink-0" />
          <span>Filters stay saved as you explore & navigate</span>
        </div>
      </div>

      {/* Active Filter Chips (if any are active) */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-1.5 pb-2">
          {/* Price active chip */}
          {isPriceFiltered && (
            <span className="inline-flex items-center space-x-1 px-2 py-1 rounded bg-[#E8F3F4] text-[#0A6C74] font-semibold text-[11px] border border-[#0A6C74]/20">
              <CircleDollarSign className="w-3 h-3 text-[#0A6C74]" />
              <span>
                {filters.minPrice > 0 ? formatWithRate(filters.minPrice) : '€0'} – {formatWithRate(filters.maxPrice)}
              </span>
              <button
                type="button"
                onClick={handleResetPrice}
                className="hover:text-red-600 transition-colors ml-0.5 cursor-pointer"
                title="Remove price filter"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {/* Duration chips */}
          {filters.durationPreset !== 'all' && (
            <span className="inline-flex items-center space-x-1 px-2 py-1 rounded bg-[#E8F3F4] text-[#0A6C74] font-semibold text-[11px] border border-[#0A6C74]/20">
              <Clock className="w-3 h-3 text-[#0A6C74]" />
              <span>
                {DURATION_PRESETS.find((p) => p.id === filters.durationPreset)?.label || filters.durationPreset}
              </span>
              <button
                type="button"
                onClick={() => onChange({ ...filters, durationPreset: 'all' })}
                className="hover:text-red-600 transition-colors ml-0.5 cursor-pointer"
                title="Remove duration preset"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {filters.durations.map((dur) => (
            <span key={dur} className="inline-flex items-center space-x-1 px-2 py-1 rounded bg-stone-100 text-stone-800 font-semibold text-[11px] border border-stone-200">
              <span>{dur}</span>
              <button
                type="button"
                onClick={() => handleToggle('durations', dur)}
                className="hover:text-red-600 transition-colors ml-0.5 cursor-pointer"
                title={`Remove ${dur}`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}

          {/* Destinations chips */}
          {filters.destinations.map((dest) => (
            <span key={dest} className="inline-flex items-center space-x-1 px-2 py-1 rounded bg-stone-100 text-stone-800 font-semibold text-[11px] border border-stone-200">
              <span>{dest}</span>
              <button
                type="button"
                onClick={() => handleToggle('destinations', dest)}
                className="hover:text-red-600 transition-colors ml-0.5 cursor-pointer"
                title={`Remove ${dest}`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. PERSISTENT PRICE RANGE FILTER (PROMINENT) */}
      {/* ========================================================================= */}
      <div className="bg-stone-50/70 border border-stone-200/90 rounded-lg p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => toggleSection('price')}
            className="flex items-center space-x-1.5 text-left font-bold text-stone-900 text-xs hover:text-[#0A6C74] transition-colors cursor-pointer"
          >
            <CircleDollarSign className="w-3.5 h-3.5 text-[#0A6C74]" />
            <span>Price Range</span>
            {isPriceFiltered && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#0A6C74]" />
            )}
          </button>
          
          <div className="flex items-center space-x-2">
            {isPriceFiltered && (
              <button
                type="button"
                onClick={handleResetPrice}
                className="text-[10px] text-[#0A6C74] hover:underline font-semibold cursor-pointer"
              >
                Reset
              </button>
            )}
            <button
              type="button"
              onClick={() => toggleSection('price')}
              className="text-stone-400 hover:text-stone-600 p-0.5 cursor-pointer"
              aria-label="Toggle price range filter"
            >
              {openSections.price ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {openSections.price && (
          <div className="space-y-3 pt-1">
            
            {/* Quick Price Range Presets */}
            <div className="flex flex-wrap gap-1">
              {PRICE_PRESETS.map((p) => {
                const isActive = filters.priceRangePreset === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handlePricePresetSelect(p.id, p.min, p.max)}
                    className={`px-2 py-1 rounded text-[11px] font-medium transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[#0A6C74] text-white shadow-2xs font-semibold'
                        : 'bg-white hover:bg-stone-200/60 text-stone-700 border border-stone-200'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>

            {/* Slider Controls */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-stone-600 text-[11px]">Selected Range:</span>
                <span className="font-bold text-[#0A6C74] font-mono">
                  {formatWithRate(filters.minPrice)} – {formatWithRate(filters.maxPrice)}
                </span>
              </div>

              {/* Dual Range Sliders */}
              <div className="space-y-1.5">
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] text-stone-400 w-7">Min:</span>
                  <input
                    type="range"
                    min="0"
                    max="290"
                    step="5"
                    value={filters.minPrice}
                    onChange={(e) => handleMinPriceChange(Number(e.target.value))}
                    className="flex-1 h-1.5 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-[#0A6C74]"
                  />
                  <span className="text-[11px] font-mono font-medium text-stone-600 w-10 text-right">
                    {formatWithRate(filters.minPrice)}
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-[10px] text-stone-400 w-7">Max:</span>
                  <input
                    type="range"
                    min="20"
                    max="300"
                    step="5"
                    value={filters.maxPrice}
                    onChange={(e) => handleMaxPriceChange(Number(e.target.value))}
                    className="flex-1 h-1.5 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-[#0A6C74]"
                  />
                  <span className="text-[11px] font-mono font-medium text-stone-600 w-10 text-right">
                    {formatWithRate(filters.maxPrice)}
                  </span>
                </div>
              </div>

              {/* Number Inputs for Fine Tuning */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="text-[10px] text-stone-500 block mb-0.5">Min Price ({currency.symbol})</label>
                  <input
                    type="number"
                    min="0"
                    max={filters.maxPrice - 5}
                    value={filters.minPrice}
                    onChange={(e) => handleMinPriceChange(Number(e.target.value))}
                    className="w-full px-2 py-1 bg-white border border-stone-300 rounded text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[#0A6C74]"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-stone-500 block mb-0.5">Max Price ({currency.symbol})</label>
                  <input
                    type="number"
                    min={filters.minPrice + 5}
                    max="300"
                    value={filters.maxPrice}
                    onChange={(e) => handleMaxPriceChange(Number(e.target.value))}
                    className="w-full px-2 py-1 bg-white border border-stone-300 rounded text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[#0A6C74]"
                  />
                </div>
              </div>

              {/* Match Counter */}
              {allTours.length > 0 && (
                <p className="text-[10px] text-stone-500 pt-0.5 text-center">
                  <span className="font-semibold text-stone-700">{priceRangeCounts}</span> of {allTours.length} excursions match this price
                </p>
              )}
            </div>

          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 2. PERSISTENT DURATION FILTER (PROMINENT) */}
      {/* ========================================================================= */}
      <div className="bg-stone-50/70 border border-stone-200/90 rounded-lg p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => toggleSection('duration')}
            className="flex items-center space-x-1.5 text-left font-bold text-stone-900 text-xs hover:text-[#0A6C74] transition-colors cursor-pointer"
          >
            <Clock className="w-3.5 h-3.5 text-[#0A6C74]" />
            <span>Duration</span>
            {isDurationFiltered && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#0A6C74]" />
            )}
          </button>

          <div className="flex items-center space-x-2">
            {isDurationFiltered && (
              <button
                type="button"
                onClick={handleResetDuration}
                className="text-[10px] text-[#0A6C74] hover:underline font-semibold cursor-pointer"
              >
                Reset
              </button>
            )}
            <button
              type="button"
              onClick={() => toggleSection('duration')}
              className="text-stone-400 hover:text-stone-600 p-0.5 cursor-pointer"
              aria-label="Toggle duration filter"
            >
              {openSections.duration ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {openSections.duration && (
          <div className="space-y-3 pt-1">
            
            {/* Quick Duration Chips */}
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-stone-400 block mb-1">
                Length of Excursion
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {DURATION_PRESETS.map((dp) => {
                  const isActive = filters.durationPreset === dp.id;
                  return (
                    <button
                      key={dp.id}
                      type="button"
                      onClick={() => onChange({ ...filters, durationPreset: dp.id })}
                      className={`p-1.5 rounded text-left transition-all cursor-pointer border ${
                        isActive
                          ? 'bg-[#0A6C74] text-white border-[#0A6C74] shadow-2xs'
                          : 'bg-white hover:bg-stone-100 text-stone-700 border-stone-200'
                      }`}
                    >
                      <span className="block text-[11px] font-semibold">{dp.label}</span>
                      {dp.sublabel && (
                        <span className={`block text-[9px] ${isActive ? 'text-teal-100' : 'text-stone-400'}`}>
                          {dp.sublabel}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Standard Duration Categories with counts */}
            <div className="pt-2 border-t border-stone-200/80">
              <span className="text-[10px] uppercase font-bold tracking-wider text-stone-400 block mb-1.5">
                Duration Categories
              </span>
              <div className="space-y-1.5">
                {durationsCategoryList.map((dur) => {
                  const checked = filters.durations.includes(dur.key);
                  const count = categoryCounts[dur.key] || 0;
                  return (
                    <label 
                      key={dur.key} 
                      className="flex items-center justify-between space-x-2 text-xs cursor-pointer hover:text-stone-900 select-none py-1 px-1.5 rounded hover:bg-white transition-colors"
                    >
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => handleToggle('durations', dur.key)}
                          className="rounded border-stone-300 text-[#0A6C74] focus:ring-[#0A6C74] w-3.5 h-3.5 cursor-pointer"
                        />
                        <div>
                          <span className={`block text-xs ${checked ? 'font-bold text-[#0E1B2A]' : 'text-stone-700'}`}>
                            {dur.label}
                          </span>
                          <span className="block text-[10px] text-stone-400">
                            {dur.desc}
                          </span>
                        </div>
                      </div>
                      
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-stone-200/60 text-stone-600 font-semibold">
                        {count}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 3. DESTINATIONS FILTER */}
      {/* ========================================================================= */}
      <div className="pt-2 border-t border-stone-200">
        <div className="flex items-center justify-between mb-2">
          <button
            type="button"
            onClick={() => toggleSection('destinations')}
            className="flex items-center space-x-1.5 font-bold text-stone-900 text-xs hover:text-[#0A6C74] cursor-pointer"
          >
            <span>Departure Port / Coast</span>
            {filters.destinations.length > 0 && (
              <span className="text-[10px] text-[#0A6C74] font-semibold">({filters.destinations.length})</span>
            )}
          </button>
          <button
            type="button"
            onClick={() => toggleSection('destinations')}
            className="text-stone-400 p-0.5 cursor-pointer"
          >
            {openSections.destinations ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {openSections.destinations && (
          <div className="space-y-1">
            {destinationsList.map((dest) => {
              const checked = filters.destinations.includes(dest);
              return (
                <label 
                  key={dest} 
                  className="flex items-center space-x-2 text-xs cursor-pointer hover:text-stone-900 select-none py-0.5"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => handleToggle('destinations', dest)}
                    className="rounded border-stone-300 text-[#0A6C74] focus:ring-[#0A6C74] w-3.5 h-3.5 cursor-pointer"
                  />
                  <span className={checked ? 'font-semibold text-[#0E1B2A]' : 'text-stone-600'}>
                    {dest}
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 4. ACTIVITY / EXPERIENCE FILTER */}
      {/* ========================================================================= */}
      <div className="pt-2 border-t border-stone-200">
        <div className="flex items-center justify-between mb-2">
          <button
            type="button"
            onClick={() => toggleSection('activities')}
            className="flex items-center space-x-1.5 font-bold text-stone-900 text-xs hover:text-[#0A6C74] cursor-pointer"
          >
            <span>Activity Type</span>
            {filters.activities.length > 0 && (
              <span className="text-[10px] text-[#0A6C74] font-semibold">({filters.activities.length})</span>
            )}
          </button>
          <button
            type="button"
            onClick={() => toggleSection('activities')}
            className="text-stone-400 p-0.5 cursor-pointer"
          >
            {openSections.activities ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {openSections.activities && (
          <div className="space-y-1">
            {activitiesList.map((act) => {
              const checked = filters.activities.includes(act);
              return (
                <label 
                  key={act} 
                  className="flex items-center space-x-2 text-xs cursor-pointer hover:text-stone-900 select-none py-0.5"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => handleToggle('activities', act)}
                    className="rounded border-stone-300 text-[#0A6C74] focus:ring-[#0A6C74] w-3.5 h-3.5 cursor-pointer"
                  />
                  <span className={checked ? 'font-semibold text-[#0E1B2A]' : 'text-stone-600'}>
                    {act}
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 5. TOUR TYPE FILTER */}
      {/* ========================================================================= */}
      <div className="pt-2 border-t border-stone-200">
        <div className="flex items-center justify-between mb-2">
          <button
            type="button"
            onClick={() => toggleSection('tourType')}
            className="font-bold text-stone-900 text-xs hover:text-[#0A6C74] cursor-pointer"
          >
            Tour Group Style
          </button>
          <button
            type="button"
            onClick={() => toggleSection('tourType')}
            className="text-stone-400 p-0.5 cursor-pointer"
          >
            {openSections.tourType ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {openSections.tourType && (
          <div className="space-y-1">
            {tourTypesList.map((type) => {
              const checked = filters.tourTypes.includes(type);
              return (
                <label 
                  key={type} 
                  className="flex items-center space-x-2 text-xs cursor-pointer hover:text-stone-900 select-none py-0.5"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => handleToggle('tourTypes', type)}
                    className="rounded border-stone-300 text-[#0A6C74] focus:ring-[#0A6C74] w-3.5 h-3.5 cursor-pointer"
                  />
                  <span className={checked ? 'font-semibold text-[#0E1B2A]' : 'text-stone-600'}>
                    {type === 'Shared' ? 'Small Group (Shared)' : 'Private Charter (Exclusive)'}
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 6. HOTEL PICKUP & RATINGS */}
      {/* ========================================================================= */}
      <div className="pt-3 border-t border-stone-200 space-y-2">
        <label className="flex items-center space-x-2 text-xs cursor-pointer hover:text-stone-900 select-none">
          <input
            type="checkbox"
            checked={filters.pickupOnly}
            onChange={(e) => onChange({ ...filters, pickupOnly: e.target.checked })}
            className="rounded border-stone-300 text-[#0A6C74] focus:ring-[#0A6C74] w-3.5 h-3.5 cursor-pointer"
          />
          <span className="font-semibold text-stone-800">
            Hotel Lobby Transfer Included
          </span>
        </label>
      </div>

    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:block w-72 shrink-0 bg-white border border-[#E8E3DA] rounded-xl p-5 self-start sticky top-24 max-h-[calc(100vh-7.5rem)] overflow-y-auto shadow-sm">
        {content}
      </aside>

      {/* Mobile Drawer */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative ml-auto w-full max-w-xs sm:max-w-sm bg-white h-full shadow-2xl flex flex-col z-10">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-stone-200">
              <div className="flex items-center space-x-2">
                <SlidersHorizontal className="w-4 h-4 text-[#0A6C74]" />
                <span className="font-display font-bold text-base text-[#0E1B2A]">
                  Filters ({totalFilteredCount} Tours)
                </span>
              </div>
              <button
                type="button"
                onClick={onCloseMobile}
                className="p-1.5 text-stone-500 hover:text-stone-900 rounded cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable filters */}
            <div className="p-4 overflow-y-auto flex-1">
              {content}
            </div>

            {/* Mobile Footer Apply */}
            <div className="p-4 border-t border-stone-200 bg-stone-50 flex items-center space-x-3">
              <button
                type="button"
                onClick={onClear}
                className="w-1/3 py-2.5 px-3 border border-stone-300 rounded text-xs font-semibold text-stone-700 bg-white hover:bg-stone-50 cursor-pointer"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={onCloseMobile}
                className="w-2/3 py-2.5 px-4 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded text-xs font-semibold shadow-xs cursor-pointer"
              >
                View {totalFilteredCount} Results
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
