import React, { useState, useEffect } from 'react';
import { Search, MapPin, Compass, Calendar, Users, X, ChevronDown } from 'lucide-react';
import { Destination, Category } from '../../types';
import { getPublishedDestinations, getPublishedCategories } from '../../services/tourService';

interface TourSearchProps {
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  destination: string;
  onDestinationChange: (dest: string) => void;
  activity: string;
  onActivityChange: (act: string) => void;
  date: string;
  onDateChange: (date: string) => void;
  guests: number;
  onGuestsChange: (guests: number) => void;
  activeCategoryTab: string;
  onSelectCategoryTab: (category: string) => void;
  destinations?: Destination[];
  categories?: Category[];
}

export const TourSearch: React.FC<TourSearchProps> = ({
  searchQuery,
  onSearchQueryChange,
  destination,
  onDestinationChange,
  activity,
  onActivityChange,
  date,
  onDateChange,
  guests,
  onGuestsChange,
  activeCategoryTab,
  onSelectCategoryTab,
  destinations: propDestinations,
  categories: propCategories,
}) => {
  const [internalDestinations, setInternalDestinations] = useState<Destination[]>([]);
  const [internalCategories, setInternalCategories] = useState<Category[]>([]);

  useEffect(() => {
    if (!propDestinations) {
      getPublishedDestinations().then(setInternalDestinations).catch(() => setInternalDestinations([]));
    }
  }, [propDestinations]);

  useEffect(() => {
    if (!propCategories) {
      getPublishedCategories().then(setInternalCategories).catch(() => setInternalCategories([]));
    }
  }, [propCategories]);

  const destinations = propDestinations || internalDestinations;
  const categories = propCategories || internalCategories;

  const categoryTabs = categories.length > 0 
    ? ['All', ...categories.map((c) => c.name)]
    : [
        'All',
        'Boat Trips',
        'Snorkeling',
        'Diving',
        'Safari',
        'Water Sports',
        'Private Tours',
        'City Tours',
        'Transfers'
      ];

  return (
    <div className="aa-tour-search w-full space-y-5">
      <section className="aa-search-panel rounded-3xl border border-stone-200 bg-white p-4 sm:p-6 lg:p-7 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3 mb-5">
          <div><span className="aa-step-kicker">Find your next experience</span><h2 className="mt-1 font-display text-xl sm:text-2xl font-bold text-[#0E1B2A]">Where will your adventure take you?</h2><p className="mt-1 text-sm text-stone-500">Search trips, choose your destination and make the day yours.</p></div>
          <span className="hidden lg:inline-flex items-center rounded-full bg-[#F0F7F6] px-4 py-2 text-xs font-semibold text-[#0A6C74]">Explore · Choose · Go</span>
        </div>
        <div className="aa-search-keyword relative mb-4">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#0A6C74]" />
          <input type="text" value={searchQuery} onChange={(e) => onSearchQueryChange(e.target.value)} placeholder="What would you love to do? Try Orange Bay, quad biking, diving…" className="w-full rounded-2xl border border-stone-200 bg-stone-50 py-4 pl-12 pr-12 text-sm text-[#0E1B2A] focus:border-[#0A6C74] focus:outline-none focus:ring-4 focus:ring-[#0A6C74]/10" />
          {searchQuery && <button type="button" onClick={() => onSearchQueryChange('')} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-2 text-stone-400 hover:bg-stone-200 hover:text-stone-700"><X className="h-4 w-4" /></button>}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <label className="aa-search-field"><span><MapPin className="h-4 w-4 text-[#0A6C74]" />Destination</span><select value={destination} onChange={(e) => onDestinationChange(e.target.value)}><option value="All">All destinations</option>{destinations.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}</select></label>
          <label className="aa-search-field"><span><Compass className="h-4 w-4 text-[#0A6C74]" />Activity</span><select value={activity} onChange={(e) => onActivityChange(e.target.value)}><option value="All">All activities</option>{categories.length > 0 ? categories.map((category) => <option key={category.id} value={category.name}>{category.name}</option>) : <><option value="Boat Trip">Boat Trips & Cruises</option><option value="Snorkeling">Snorkeling Excursions</option><option value="Diving">Scuba Diving</option><option value="Safari">Desert Quad & Buggy</option><option value="Private Tour">Private Charters</option><option value="Water Sports">Water Sports & Rides</option></>}</select></label>
          <label className="aa-search-field"><span><Calendar className="h-4 w-4 text-[#0A6C74]" />Travel date</span><input type="date" value={date} onChange={(e) => onDateChange(e.target.value)} min={(() => { const today = new Date(); return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`; })()} /></label>
          <label className="aa-search-field"><span><Users className="h-4 w-4 text-[#0A6C74]" />Travellers</span><input type="number" min={1} max={50} step={1} inputMode="numeric" value={guests} onChange={(e) => onGuestsChange(Math.min(50, Math.max(1, Number(e.target.value) || 1)))} /></label>
        </div>
      </section>
      <div className="space-y-2"><div className="flex items-center justify-between gap-2"><span className="text-xs font-bold uppercase tracking-wider text-stone-500">Browse by experience</span><span className="text-[11px] text-stone-400">{categoryTabs.length} categories</span></div><div className="flex w-full min-w-0 items-center gap-2 overflow-x-auto pb-2 no-scrollbar" role="group" aria-label="Filter tours by category">{categoryTabs.map((tab) => { const isActive = activeCategoryTab === tab; return <button key={tab} type="button" onClick={() => onSelectCategoryTab(tab)} aria-pressed={isActive} className={`aa-category-pill ${isActive ? 'is-active' : ''}`}>{tab}</button>; })}</div></div>
    </div>
  );
};