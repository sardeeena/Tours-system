import React from 'react';
import { motion } from 'motion/react';
import { ArrowRight, MessageCircle, ShieldCheck, Clock, CalendarCheck, Sparkles } from 'lucide-react';

interface FinalCTAProps {
  onExploreTours: () => void;
  onOpenMyBooking?: () => void;
}

export const FinalCTA: React.FC<FinalCTAProps> = ({ onExploreTours, onOpenMyBooking }) => {
  return (
    <section className="py-16 sm:py-24 bg-transparent">
      <div className="max-w-7xl mx-auto px-4 sm:px-8">
        <motion.div 
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.55 }}
          className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-[#E2F1F3] via-[#EFF8F8] to-[#FAF8F5] dark:from-[#0E1B2A] dark:via-[#122236] dark:to-[#0A1726] text-stone-900 dark:text-white p-8 sm:p-14 lg:p-16 border border-[#BDE0E2] dark:border-slate-800 shadow-xl transition-colors duration-300"
        >
          {/* Ambient blur lighting */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#60C3CC]/20 dark:bg-[#0A6C74]/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-10 left-10 w-80 h-80 bg-[#0A6C74]/10 dark:bg-[#60C3CC]/10 rounded-full blur-3xl pointer-events-none" />

          {/* Background image overlay */}
          <div 
            className="absolute inset-0 bg-cover bg-center opacity-10 dark:opacity-15 mix-blend-overlay pointer-events-none"
            style={{
              backgroundImage: `url('https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1600&q=80')`,
            }}
            aria-hidden="true"
          />

          <div className="relative z-10 max-w-2xl space-y-4">
            <div className="inline-flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-[#0A6C74] dark:text-[#60C3CC] bg-[#0A6C74]/10 dark:bg-white/5 border border-[#0A6C74]/20 dark:border-white/10 px-3.5 py-1.5 rounded-full backdrop-blur-md">
              <Sparkles className="w-3.5 h-3.5 text-[#0A6C74] dark:text-[#60C3CC]" />
              <span>Direct Booking Guarantee</span>
            </div>

            <h2 className="font-display text-3xl sm:text-5xl text-stone-900 dark:text-white font-normal tracking-tight leading-[1.15]">
              Ready to explore the crystal waters of the Red Sea?
            </h2>

            <p className="text-sm sm:text-base text-stone-600 dark:text-slate-300 leading-relaxed max-w-xl">
              Reserve your excursion date online with free cancellation up to 24 hours prior. Hotel pickup from your resort lobby is always included, with option to pay cash on pickup.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                type="button"
                id="final-cta-explore-btn"
                onClick={onExploreTours}
                className="px-6 py-3.5 bg-gradient-to-r from-[#0A6C74] to-[#0D838C] hover:from-[#08565C] hover:to-[#0A6C74] text-white text-xs sm:text-sm font-semibold rounded-xl flex items-center justify-center space-x-2 shadow-lg transition-all group cursor-pointer"
              >
                <span>View All Tours & Dates</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </motion.button>

              <motion.a
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                href="https://wa.me/201515212741"
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold rounded-xl flex items-center justify-center space-x-2 transition-all shadow-md cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Chat on WhatsApp</span>
              </motion.a>

              {onOpenMyBooking && (
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  type="button"
                  onClick={onOpenMyBooking}
                  className="px-5 py-3.5 bg-white hover:bg-stone-50 dark:bg-white/10 dark:hover:bg-white/15 text-stone-800 dark:text-slate-200 text-xs sm:text-sm font-semibold rounded-xl border border-stone-300 dark:border-white/10 transition-all flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs"
                >
                  <CalendarCheck className="w-4 h-4 text-[#0A6C74] dark:text-slate-300" />
                  <span>Find My Booking</span>
                </motion.button>
              )}
            </div>

            {/* Micro guarantees */}
            <div className="flex flex-wrap items-center gap-6 pt-6 border-t border-[#BDE0E2] dark:border-slate-800/80 text-xs text-stone-600 dark:text-slate-400">
              <span className="flex items-center space-x-1.5">
                <Clock className="w-4 h-4 text-[#0A6C74] dark:text-[#60C3CC]" />
                <span>Instant voucher dispatch</span>
              </span>
              <span className="flex items-center space-x-1.5">
                <ShieldCheck className="w-4 h-4 text-[#0A6C74] dark:text-[#60C3CC]" />
                <span>Licensed Egyptian tour operator #2491/ETB</span>
              </span>
            </div>
          </div>

        </motion.div>
      </div>
    </section>
  );
};
