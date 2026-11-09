import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Waves, Wind, Sun, Eye, Anchor, ChevronDown, Sparkles } from 'lucide-react';

export const WeatherConditionsBar: React.FC = () => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-[#FAF8F5] text-stone-700 dark:bg-[#08111A] dark:text-slate-300 border-b border-[#E8E3DA] dark:border-slate-800 text-xs transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Left: Port & Sea Status badge */}
          <div className="flex items-center space-x-3">
            <span className="flex items-center space-x-1.5 bg-white dark:bg-[#0E1B2A] border border-emerald-500/40 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded text-[11px] font-bold shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>COAST GUARD CLEARED</span>
            </span>

            <span className="text-stone-500 dark:text-slate-400 text-[11px] hidden sm:inline">
              Hurghada & Sinai Maritime Bulletin:
            </span>
          </div>

          {/* Middle: Live telemetry items */}
          <div className="flex items-center space-x-4 sm:space-x-6 text-[11px]">
            <div className="flex items-center space-x-1.5" title="Water Temperature">
              <Waves className="w-3.5 h-3.5 text-[#0A6C74] dark:text-[#60C3CC]" />
              <span className="text-stone-500 dark:text-slate-400">Sea Temp:</span>
              <span className="font-semibold text-stone-900 dark:text-white">25°C (77°F)</span>
            </div>

            <div className="flex items-center space-x-1.5" title="Wave height">
              <Anchor className="w-3.5 h-3.5 text-[#0A6C74] dark:text-[#60C3CC]" />
              <span className="text-stone-500 dark:text-slate-400">Swell:</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">Calm (0.3m)</span>
            </div>

            <div className="hidden md:flex items-center space-x-1.5" title="Wind conditions">
              <Wind className="w-3.5 h-3.5 text-[#0A6C74] dark:text-[#60C3CC]" />
              <span className="text-stone-500 dark:text-slate-400">Wind:</span>
              <span className="font-semibold text-stone-900 dark:text-white">9 kts NNE</span>
            </div>

            <div className="hidden lg:flex items-center space-x-1.5" title="Reef Visibility">
              <Eye className="w-3.5 h-3.5 text-[#0A6C74] dark:text-[#60C3CC]" />
              <span className="text-stone-500 dark:text-slate-400">Visibility:</span>
              <span className="font-semibold text-stone-900 dark:text-white">30m+ Crystal</span>
            </div>
          </div>

          {/* Right: Expandable details toggle */}
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex items-center space-x-1 text-[#0A6C74] hover:text-[#08565C] dark:text-[#60C3CC] dark:hover:text-white transition-colors text-[11px] font-medium cursor-pointer"
          >
            <span>{expanded ? 'Hide Advisory' : 'Daily Sea Advisory'}</span>
            <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Collapsible Advisory Panel */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden pt-3 pb-1 border-t border-stone-200 dark:border-slate-800/80 mt-2 text-xs"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-white dark:bg-[#0E1B2A]/90 p-3 rounded-xl border border-stone-200 dark:border-slate-800 shadow-xs">
                <div className="space-y-1">
                  <span className="font-bold text-stone-900 dark:text-white text-[11px] flex items-center gap-1.5">
                    <Waves className="w-3.5 h-3.5 text-[#0A6C74] dark:text-[#60C3CC]" />
                    Snorkeling & Diving Conditions
                  </span>
                  <p className="text-[11px] text-stone-600 dark:text-slate-400 leading-relaxed">
                    Optimal conditions across Giftun Island & Abu Ramada reefs. High visibility makes morning boat trips ideal for dolphin sightings.
                  </p>
                </div>

                <div className="space-y-1">
                  <span className="font-bold text-stone-900 dark:text-white text-[11px] flex items-center gap-1.5">
                    <Sun className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                    Desert Safari Advisory
                  </span>
                  <p className="text-[11px] text-stone-600 dark:text-slate-400 leading-relaxed">
                    Clear afternoon skies for Quad & Buggy safaris. Temperatures soften after 16:30 for comfortable Bedouin dinner excursions.
                  </p>
                </div>

                <div className="space-y-1">
                  <span className="font-bold text-stone-900 dark:text-white text-[11px] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    Harbor Weather Guarantee
                  </span>
                  <p className="text-[11px] text-stone-600 dark:text-slate-400 leading-relaxed">
                    All fleet departures verified daily by harbor authorities. If weather precludes sailing, reschedule free or receive a 100% refund.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
