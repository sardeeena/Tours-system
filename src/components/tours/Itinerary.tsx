import React from 'react';
import { Clock } from 'lucide-react';
import { ItineraryItem } from '../../types';

interface ItineraryProps {
  items: ItineraryItem[];
}

export const Itinerary: React.FC<ItineraryProps> = ({ items }) => {
  if (!items || items.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <Clock className="w-4 h-4 text-[#0A6C74]" />
        <h3 className="font-display text-lg font-bold text-[#0E1B2A]">
          Tour Itinerary
        </h3>
      </div>

      <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-[11px] sm:before:left-[15px] before:top-2 before:bottom-2 before:w-[2px] before:bg-stone-200">
        {items.map((item, idx) => (
          <div key={idx} className="relative group">
            {/* Timeline bullet */}
            <div className="absolute -left-[23px] sm:-left-[27px] top-1 w-3 h-3 rounded-full bg-[#0A6C74] border-2 border-white ring-2 ring-stone-200" />

            <div className="bg-stone-50 border border-stone-200/80 rounded p-3 text-xs transition-colors hover:bg-[#FAF8F5]">
              <div className="flex items-baseline space-x-2">
                <span className="font-mono font-bold text-[#0A6C74] text-xs">
                  {item.time}
                </span>
                <span className="font-bold text-stone-900 text-xs">
                  {item.title}
                </span>
              </div>
              {item.description && (
                <p className="text-stone-600 mt-1 text-xs leading-relaxed">
                  {item.description}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
      
      <p className="text-[11px] text-stone-600 italic">
        * Times are approximate and may adjust slightly based on hotel location, harbor coast guard clearance, and maritime weather.
      </p>
    </div>
  );
};
