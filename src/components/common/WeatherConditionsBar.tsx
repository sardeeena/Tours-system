import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Waves, ShieldCheck, ChevronDown } from 'lucide-react';

/** Customer-facing guidance only; do not imply live harbour clearance or invent sea-state readings. */
export const WeatherConditionsBar: React.FC = () => {
  const [expanded, setExpanded] = useState(false);
  return (
    <section className="bg-[#FAF8F5] text-stone-700 dark:bg-[#08111A] dark:text-slate-300 border-b border-[#E8E3DA] dark:border-slate-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E8F3F4] text-[#0A6C74] dark:bg-[#12313A] dark:text-[#60C3CC]">
              <Waves className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-stone-900 dark:text-white">Planning a sea excursion?</p>
              <p className="text-[11px] leading-snug text-stone-600 dark:text-slate-400">Sea and weather conditions can change. Departure updates are confirmed by the local operator.</p>
            </div>
          </div>
          <button type="button" aria-expanded={expanded} aria-controls="sea-conditions-guidance" onClick={() => setExpanded((value) => !value)} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-[#0A6C74] transition-colors hover:bg-[#E8F3F4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A6C74] dark:text-[#60C3CC] dark:hover:bg-[#12313A]">
            <span>{expanded ? 'Hide guidance' : 'Trip guidance'}</span>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
        </div>
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div id="sea-conditions-guidance" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
              <div className="mt-3 flex items-start gap-3 rounded-xl border border-stone-200 bg-white p-3 text-xs leading-relaxed text-stone-600 dark:border-slate-800 dark:bg-[#0E1B2A] dark:text-slate-300">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#0A6C74] dark:text-[#60C3CC]" aria-hidden="true" />
                <p>For safety, the operator assesses conditions before departure. If weather affects your booked trip, the team will contact you with the options available under your booking terms.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
};
