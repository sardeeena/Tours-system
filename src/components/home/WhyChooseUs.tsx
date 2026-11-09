import React from 'react';
import { motion } from 'motion/react';
import { 
  ShieldCheck, 
  Award, 
  Bus, 
  Clock, 
  Headphones, 
  CheckCircle,
  FileCheck2,
  Sparkles
} from 'lucide-react';
import { TRUST_PILLARS } from '../../data/toursData';

export const WhyChooseUs: React.FC = () => {
  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'ShieldCheck': return <ShieldCheck className="w-5 h-5 text-[#0A6C74]" />;
      case 'Award': return <Award className="w-5 h-5 text-[#0A6C74]" />;
      case 'Bus': return <Bus className="w-5 h-5 text-[#0A6C74]" />;
      case 'Clock': return <Clock className="w-5 h-5 text-[#0A6C74]" />;
      case 'Headphones': return <Headphones className="w-5 h-5 text-[#0A6C74]" />;
      default: return <CheckCircle className="w-5 h-5 text-[#0A6C74]" />;
    }
  };

  return (
    <section id="why-us-section" className="py-16 sm:py-24 bg-white dark:bg-[#0A1118] border-b border-[#E8E3DA] dark:border-slate-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-8">
        
        {/* Header */}
        <div className="max-w-3xl mb-12">
          <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-[#0A6C74] dark:text-[#60C3CC] mb-2">
            <span className="w-5 h-0.5 bg-[#0A6C74] dark:bg-[#60C3CC] rounded-full"></span>
            <span>Direct Licensed Fleet Operator</span>
          </div>
          <h2 className="font-display text-2xl sm:text-4xl text-[#0E1B2A] dark:text-white tracking-tight">
            Why Book Directly With Us
          </h2>
          <p className="text-stone-600 dark:text-slate-300 text-sm sm:text-base mt-2 leading-relaxed">
            We operate our own passenger yachts, speedboat charters, and hotel transfer fleet in Hurghada and El Gouna. You enjoy direct local captain support, transparent pricing, and zero middleman markups.
          </p>
        </div>

        {/* Pillars Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {TRUST_PILLARS.map((pillar, idx) => (
            <motion.div
              key={pillar.id}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.45, delay: idx * 0.07 }}
              whileHover={{ y: -5 }}
              className="p-6 rounded-2xl border border-[#E8E3DA] dark:border-slate-800 bg-[#FAF8F5] dark:bg-[#132235] flex flex-col justify-between hover:border-[#0A6C74]/50 hover:bg-white dark:hover:bg-[#182C44] hover:shadow-xl transition-all duration-300 group"
            >
              <div>
                <div className="w-12 h-12 rounded-xl bg-white dark:bg-[#16283D] border border-[#E8E3DA] dark:border-slate-700 flex items-center justify-center mb-4 shadow-2xs group-hover:scale-110 group-hover:border-[#0A6C74]/40 transition-all">
                  {getIcon(pillar.iconName)}
                </div>
                <h3 className="font-display text-base font-bold text-[#0E1B2A] dark:text-white mb-2 group-hover:text-[#0A6C74] dark:group-hover:text-[#60C3CC] transition-colors">
                  {pillar.title}
                </h3>
                <p className="text-xs text-stone-600 dark:text-slate-300 leading-relaxed">
                  {pillar.description}
                </p>
              </div>

              <div className="mt-5 pt-3.5 border-t border-stone-200/60 dark:border-slate-700/60 flex items-center text-[11px] text-[#0A6C74] dark:text-[#60C3CC] font-semibold">
                <FileCheck2 className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                <span>Verified Direct Fleet Standard</span>
              </div>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
};
