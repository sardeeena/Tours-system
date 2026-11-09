/**
 * Tour Filter & Sorting Types
 */

import { CurrencyConfig } from './index';

export type SortOption = 
  | 'recommended' 
  | 'price_asc' 
  | 'price_desc' 
  | 'rating_desc' 
  | 'duration_asc';

export type DurationFilter = 'Half Day' | 'Full Day' | 'Multi Day';

export type TourTypeFilter = 'Shared' | 'Private';

export interface FilterState {
  destinations: string[];
  activities: string[];
  durations: DurationFilter[];
  tourTypes: TourTypeFilter[];
  maxPrice: number;
  minRating: number;
  pickupOnly: boolean;
  languages: string[];
}

export interface ActiveFilterChip {
  id: string;
  label: string;
  category: keyof FilterState | 'search' | 'tab';
  value: string | number | boolean;
}
