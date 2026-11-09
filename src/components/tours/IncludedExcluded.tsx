import React from 'react';
import { Check, X } from 'lucide-react';

interface IncludedExcludedProps {
  included: string[];
  excluded: string[];
}

export const IncludedExcluded: React.FC<IncludedExcludedProps> = ({
  included,
  excluded,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      
      {/* What's Included */}
      <div className="bg-emerald-50/50 border border-emerald-200/80 rounded p-5">
        <h4 className="font-bold uppercase tracking-wider text-xs text-emerald-950 mb-3.5 flex items-center">
          <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center mr-2 text-emerald-700">
            <Check className="w-3.5 h-3.5" />
          </div>
          What's Included
        </h4>
        <ul className="space-y-2 text-xs text-stone-700">
          {included.map((item, idx) => (
            <li key={idx} className="flex items-start">
              <Check className="w-3.5 h-3.5 text-emerald-600 mr-2 mt-0.5 shrink-0" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* What's Not Included */}
      <div className="bg-stone-50 border border-stone-200 rounded p-5">
        <h4 className="font-bold uppercase tracking-wider text-xs text-stone-800 mb-3.5 flex items-center">
          <div className="w-5 h-5 rounded-full bg-stone-200 flex items-center justify-center mr-2 text-stone-600">
            <X className="w-3.5 h-3.5" />
          </div>
          Not Included
        </h4>
        <ul className="space-y-2 text-xs text-stone-600">
          {excluded.map((item, idx) => (
            <li key={idx} className="flex items-start">
              <X className="w-3.5 h-3.5 text-stone-400 mr-2 mt-0.5 shrink-0" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

    </div>
  );
};
