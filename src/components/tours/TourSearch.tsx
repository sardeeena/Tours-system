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
    <div className="w-full space-y-4">
      {/* Search Engine Bar */}
      <div className="bg-white border border-[#E8E3DA] rounded-sm p-3 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 items-center text-xs">
          
          {/* Keyword Search */}
          <div className="lg:col-span-4 relative">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-600 mb-1">
              Search Excursions
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-stone-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchQueryChange(e.target.value)}
                placeholder="e.g. Orange Bay, Quad, Diving, Yacht..."
                className="w-full pl-8 pr-7 py-2 rounded-sm border border-stone-200 bg-stone-50/50 text-[#0E1B2A] text-xs focus:outline-none focus:ring-1 focus:ring-[#0A6C74]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchQueryChange('')}
                  className="absolute right-2.5 top-2.5 text-stone-400 hover:text-stone-700"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Destination */}
          <div className="lg:col-span-3">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-600 mb-1">
              Destination
            </label>
            <div className="relative">
              <MapPin className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#0A6C74]" />
              <select
                value={destination}
                onChange={(e) => onDestinationChange(e.target.value)}
                className="w-full pl-8 pr-6 py-2 rounded-sm border border-stone-200 bg-stone-50/50 text-[#0E1B2A] text-xs focus:outline-none focus:ring-1 focus:ring-[#0A6C74] appearance-none"
              >
                <option value="All">All Destinations</option>
                {destinations.map((d) => (
                  <option key={d.id} value={d.name}>{d.name}</option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 absolute right-2.5 top-3 text-stone-400 pointer-events-none" />
            </div>
          </div>

          {/* Activity / Category */}
          <div className="lg:col-span-3">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-600 mb-1">
              Activity
            </label>
            <div className="relative">
              <Compass className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#0A6C74]" />
              <select
                value={activity}
                onChange={(e) => onActivityChange(e.target.value)}
                className="w-full pl-8 pr-6 py-2 rounded-sm border border-stone-200 bg-stone-50/50 text-[#0E1B2A] text-xs focus:outline-none focus:ring-1 focus:ring-[#0A6C74] appearance-none"
              >
                <option value="All">All Activities</option>
                <option value="Boat Trip">Boat Trips & Cruises</option>
                <option value="Snorkeling">Snorkeling Excursions</option>
                <option value="Diving">Scuba Diving</option>
                <option value="Safari">Desert Quad & Buggy</option>
                <option value="Private Tour">Private Charters</option>
                <option value="Water Sports">Water Sports & Rides</option>
              </select>
              <ChevronDown className="w-3 h-3 absolute right-2.5 top-3 text-stone-400 pointer-events-none" />
            </div>
          </div>

          {/* Date Picker */}
          <div className="lg:col-span-2">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-600 mb-1">
              Date
            </label>
            <div className="relative">
              <input
                type="date"
                value={date}
                onChange={(e) => onDateChange(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-2.5 py-1.5 rounded-sm border border-stone-200 bg-stone-50/50 text-[#0E1B2A] text-xs focus:outline-none focus:ring-1 focus:ring-[#0A6C74]"
              />
            </div>
          </div>

        </div>
      </div>

      {/* Category Navigation Pills */}
      <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
        {categoryTabs.map((tab) => {
          const isActive = activeCategoryTab === tab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => onSelectCategoryTab(tab)}
              className={`px-3.5 py-1.5 rounded-sm whitespace-nowrap transition-all border ${
                isActive
                  ? 'bg-[#0A6C74] text-white border-[#0A6C74] font-semibold shadow-xs'
                  : 'bg-white text-stone-700 border-stone-200 hover:border-stone-400 hover:bg-stone-50'
              }`}
            >
              {tab}
            </button>
          );
        })}
      </div>
    </div>
  );
};
