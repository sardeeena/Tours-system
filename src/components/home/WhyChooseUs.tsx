import React, { useRef } from 'react';
import { Award, Bus, CheckCircle2, ChevronLeft, ChevronRight, Clock, Headphones, ShieldCheck } from 'lucide-react';
import { TRUST_PILLARS } from '../../data/toursData';

export const WhyChooseUs: React.FC = () => {
  const trackRef = useRef<HTMLDivElement>(null);

  const getIcon = (iconName: string) => {
    const className = 'w-5 h-5 text-[#0A6C74] dark:text-[#60C3CC]';
    switch (iconName) {
      case 'ShieldCheck': return <ShieldCheck className={className} />;
      case 'Award': return <Award className={className} />;
      case 'Bus': return <Bus className={className} />;
      case 'Clock': return <Clock className={className} />;
      case 'Headphones': return <Headphones className={className} />;
      default: return <CheckCircle2 className={className} />;
    }
  };

  const scrollCards = (direction: -1 | 1) => {
    if (!trackRef.current) return;
    const card = trackRef.current.querySelector<HTMLElement>('[data-trust-card]');
    const distance = card ? card.offsetWidth + 16 : 300;
    trackRef.current.scrollBy({ left: direction * distance, behavior: 'smooth' });
  };

  return (
    <section id="why-us-section" className="py-10 sm:py-14 bg-white dark:bg-[#0A1118] border-b border-[#E8E3DA] dark:border-slate-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-8">
        <div className="flex items-end justify-between gap-4 mb-5 sm:mb-6">
          <div className="min-w-0">
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-[.16em] text-[#0A6C74] dark:text-[#60C3CC] mb-1.5">
              Local team, here to help.
            </p>
            <h2 className="font-display text-xl sm:text-3xl font-bold text-[#0E1B2A] dark:text-white tracking-tight">
              Why book with us?
            </h2>
            <p className="text-xs sm:text-sm text-stone-600 dark:text-slate-300 mt-1.5 max-w-2xl">
              We’re based in Hurghada and can help before, during and after your trip.
            </p>
          </div>
          <div className="hidden sm:flex shrink-0 items-center gap-2">
            <button type="button" onClick={() => scrollCards(-1)} aria-label="Scroll benefits left" className="w-9 h-9 rounded-full border border-stone-200 dark:border-slate-700 flex items-center justify-center text-stone-600 dark:text-slate-300 hover:border-[#0A6C74] hover:text-[#0A6C74] transition-colors">
              <ChevronLeft size={17} />
            </button>
            <button type="button" onClick={() => scrollCards(1)} aria-label="Scroll benefits right" className="w-9 h-9 rounded-full border border-stone-200 dark:border-slate-700 flex items-center justify-center text-stone-600 dark:text-slate-300 hover:border-[#0A6C74] hover:text-[#0A6C74] transition-colors">
              <ChevronRight size={17} />
            </button>
          </div>
        </div>

        <div
          ref={trackRef}
          className="flex gap-3 sm:gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: 'none' }}
          aria-label="Reasons to book directly with Awesome Adventure Tours"
        >
          {TRUST_PILLARS.map((pillar) => (
            <article
              key={pillar.id}
              data-trust-card
              className="snap-start shrink-0 w-[82vw] max-w-[290px] sm:w-[280px] min-h-[154px] sm:min-h-[166px] rounded-xl border border-[#E8E3DA] dark:border-slate-800 bg-[#FAF8F5] dark:bg-[#132235] p-4 sm:p-5 flex flex-col transition-colors hover:border-[#0A6C74]/50 hover:bg-white dark:hover:bg-[#172A40]"
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="w-9 h-9 rounded-lg bg-white dark:bg-[#16283D] border border-[#E8E3DA] dark:border-slate-700 flex items-center justify-center shrink-0">
                  {getIcon(pillar.iconName)}
                </span>
                <h3 className="font-display text-sm sm:text-base font-bold text-[#0E1B2A] dark:text-white leading-snug">
                  {pillar.title}
                </h3>
              </div>
              <p className="text-xs text-stone-600 dark:text-slate-300 leading-relaxed">
                {pillar.description}
              </p>
            </article>
          ))}
        </div>
        <p className="sm:hidden text-[10px] text-stone-400 dark:text-slate-500 mt-1">Swipe to explore more</p>
      </div>
    </section>
  );
};
