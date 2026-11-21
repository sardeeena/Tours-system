import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldCheck, 
  Clock, 
  MapPin, 
  Award
} from 'lucide-react';
import { SearchModule } from './SearchModule';
import { Destination, Category } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';

interface HeroProps {
  onSearch: (filters: { destination: string; category: string; date: string; guests: number }) => void;
  resultCount?: number;
  destinations?: Destination[];
  categories?: Category[];
}

interface TourSlide {
  id: string;
  title1: string;
  title2: string;
  subtitle: string;
  imageUrl: string;
  accentGradient: string;
}

const CINEMATIC_SLIDES: TourSlide[] = [
  {
    id: 'snorkeling-orange-bay',
    title1: 'Pristine Lagoons &',
    title2: 'Giftun Island Reefs',
    subtitle: 'Sail to Orange Bay and Paradise Island with crystal shallow sands, live coral gardens, and wild dolphin pods.',
    imageUrl: 'https://uvtbtpxtrrmaublrztgv.supabase.co/storage/v1/object/public/tour-media/tours/1794701564858-yfp2o4-White_island.webp',
    accentGradient: 'from-[#0A6C74] via-[#0D838C] to-[#0A6C74] dark:from-[#60C3CC] dark:via-[#91E4EB] dark:to-[#A3E8ED]',
  },
  {
    id: 'desert-safari-quad',
    title1: 'Sunset Dunes &',
    title2: 'Bedouin Nights',
    subtitle: 'High-octane ATV quad biking through Red Sea mountain canyons, sunset camel caravans, and authentic stargazing BBQ.',
    imageUrl: 'https://uvtbtpxtrrmaublrztgv.supabase.co/storage/v1/object/public/tour-media/tours/1794702525466-0in0mt-Red_Canyon0987.webp',
    accentGradient: 'from-[#B45309] via-[#D97706] to-[#B45309] dark:from-[#F59E0B] dark:via-[#FBBF24] dark:to-[#FDE68A]',
  },
  {
    id: 'padi-scuba-diving',
    title1: 'Unrivaled Coral Drop-Offs &',
    title2: 'Scuba Encounters',
    subtitle: 'Selected trips in Egypt offer introductory scuba dives and guided diving experiences. Check each tour page for dive format, instructor qualifications, equipment and inclusions.',
    imageUrl: 'https://uvtbtpxtrrmaublrztgv.supabase.co/storage/v1/object/public/tour-media/tours/1794762504613-q13f8l-Nationalpark.webp',
    accentGradient: 'from-[#0F766E] via-[#0D9488] to-[#0F766E] dark:from-[#2DD4BF] dark:via-[#5EEAD4] dark:to-[#99F6E4]',
  },
  {
    id: 'luxury-private-yacht',
    title1: 'Exclusive Charters &',
    title2: 'Private Sandbars',
    subtitle: 'Tailored luxury yachts and high-speed cruisers with onboard chef, seclusion from crowds, and bespoke itineraries.',
    imageUrl: 'https://uvtbtpxtrrmaublrztgv.supabase.co/storage/v1/object/public/tour-media/tours/1794701566922-pl0sd2-Yachuttour.webp',
    accentGradient: 'from-[#047857] via-[#059669] to-[#047857] dark:from-[#34D399] dark:via-[#6EE7B7] dark:to-[#A7F3D0]',
  },
  {
    id: 'water-sports-semi-submarine',
    title1: 'Glass Bottom Views &',
    title2: 'Coastal Thrills',
    subtitle: 'Panoramic underwater observatory windows, parasailing high above turquoise lagoons, and safe family bay adventures.',
    imageUrl: 'https://uvtbtpxtrrmaublrztgv.supabase.co/storage/v1/object/public/tour-media/tours/1794698761078-i17pcl-Orange_Beach.webp',
    accentGradient: 'from-[#0369A1] via-[#0284C7] to-[#0369A1] dark:from-[#38BDF8] dark:via-[#7DD3FC] dark:to-[#BAE6FD]',
  }
];

export const Hero: React.FC<HeroProps> = ({ onSearch, resultCount, destinations, categories }) => {
  const { t } = useLanguage();
  const { isDark } = useTheme();
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isPointerOver, setIsPointerOver] = useState(false);
  const [isDocumentVisible, setIsDocumentVisible] = useState(() => typeof document === 'undefined' || !document.hidden);
  const [isInViewport, setIsInViewport] = useState(true);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const heroSectionRef = useRef<HTMLElement | null>(null);

  // Avoid downloading successive background slides while the page is hidden
  // or the hero is outside the viewport. Respect the visitor's motion setting.
  useEffect(() => {
    const updateVisibility = () => setIsDocumentVisible(!document.hidden);
    document.addEventListener('visibilitychange', updateVisibility);
    updateVisibility();
    return () => document.removeEventListener('visibilitychange', updateVisibility);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);
    updatePreference();
    mediaQuery.addEventListener?.('change', updatePreference);
    return () => mediaQuery.removeEventListener?.('change', updatePreference);
  }, []);

  useEffect(() => {
    const element = heroSectionRef.current;
    if (!element || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(([entry]) => {
      setIsInViewport(entry.isIntersecting);
    }, { threshold: 0.01 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Auto-advance cinematic background & matching content every 6.5 seconds
  useEffect(() => {
    if (isPointerOver || !isDocumentVisible || !isInViewport || prefersReducedMotion) return;
    const interval = setInterval(() => {
      setCurrentSlideIndex((prev) => (prev + 1) % CINEMATIC_SLIDES.length);
    }, 6500);

    return () => clearInterval(interval);
  }, [currentSlideIndex, isPointerOver, isDocumentVisible, isInViewport, prefersReducedMotion]);

  const slide = CINEMATIC_SLIDES[currentSlideIndex];
  const nextSlide = CINEMATIC_SLIDES[(currentSlideIndex + 1) % CINEMATIC_SLIDES.length];

  // Warm the next hero image while the current slide is visible to avoid a blank frame.
  useEffect(() => {
    if (!isDocumentVisible || !isInViewport || prefersReducedMotion) return;
    const image = new Image();
    image.decoding = 'async';
    image.src = nextSlide.imageUrl;
  }, [nextSlide.imageUrl, isDocumentVisible, isInViewport, prefersReducedMotion]);


  return (
    <section
      ref={heroSectionRef}
      className="relative w-full bg-gradient-to-b from-[#E2F1F3] via-[#EFF7F8] to-[#FAF8F5] dark:bg-[#0E1B2A] text-stone-900 dark:text-white overflow-hidden transition-colors duration-300"
      onMouseEnter={() => setIsPointerOver(true)}
      onMouseLeave={() => setIsPointerOver(false)}
    >
      {/* Cinematic Layer: Smooth Cross-fading background image with slow Ken Burns pan/zoom */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <AnimatePresence mode="sync">
          <motion.div
            key={slide.id}
            initial={prefersReducedMotion ? false : { scale: 1.08, opacity: 0 }}
            animate={{ scale: 1.015, opacity: isDark ? 0.9 : 1 }}
            exit={{ scale: prefersReducedMotion ? 1.015 : 1.06, opacity: 0 }}
            transition={{
              opacity: { duration: prefersReducedMotion ? 0 : 1.35, ease: 'easeInOut' },
              scale: { duration: prefersReducedMotion ? 0 : 6.5, ease: 'easeOut' }
            }}
            className="absolute inset-0 bg-cover bg-center will-change-transform"
            style={{
              backgroundImage: `url('${slide.imageUrl}')`,
            }}
          />
        </AnimatePresence>
      </div>

      {/* Subtle tonal treatment: preserve photo detail, protect headline contrast, and avoid a washed-out white veil. */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-[#0E1B2A]/10 via-[#0E1B2A]/[0.04] to-[#FAF8F5]/45 dark:from-[#0E1B2A]/35 dark:via-[#0E1B2A]/20 dark:to-[#0E1B2A]/75" />
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-[#FAF8F5]/10 via-transparent to-[#FAF8F5]/10 dark:from-black/10 dark:via-transparent dark:to-black/10" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-8 pt-10 sm:pt-14 pb-12 sm:pb-16">
        
        {/* Dynamic Synchronized Headline & Narrative based on active cinematic tour */}
        <div className="max-w-3xl mr-auto ml-0 mb-8 min-h-[110px] sm:min-h-[130px] text-left [direction:ltr]">
          <AnimatePresence mode="wait">
            <motion.div
              key={slide.id}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -16 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.55, ease: 'easeOut' }}
            >
              {/* Dynamic Headline */}
              <h1 className="font-display text-3xl sm:text-5xl lg:text-6xl font-normal tracking-tight text-stone-900 dark:text-white leading-[1.12] mb-3 text-left [text-wrap:balance] drop-shadow-[0_1px_1px_rgba(255,255,255,0.12)]">
                {slide.title1}{' '}
                <span className={`italic font-serif text-transparent bg-clip-text bg-gradient-to-r ${slide.accentGradient}`}>
                  {slide.title2}
                </span>
              </h1>

              {/* Dynamic Subtitle */}
              <p className="text-sm sm:text-base lg:text-lg text-stone-600 dark:text-slate-300 font-normal leading-relaxed max-w-2xl ml-0 mr-auto text-left">
                {slide.subtitle}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>


        {/* Booking / Search Module */}
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.6, delay: prefersReducedMotion ? 0 : 0.2 }}
          className="w-full max-w-5xl ml-0 mr-auto mb-8"
        >
          <SearchModule onSearch={onSearch} resultCount={resultCount} destinations={destinations} categories={categories} />
        </motion.div>

        {/* Practical Booking Information */}
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.7, delay: prefersReducedMotion ? 0 : 0.3 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 pt-5 border-t border-[#E8E3DA] dark:border-slate-800/80 text-xs text-stone-700 dark:text-slate-300"
        >
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-2.5 text-center group cursor-default">
            <div className="w-8 h-8 rounded-lg bg-white dark:bg-[#16283D] flex items-center justify-center text-[#0A6C74] dark:text-[#60C3CC] border border-stone-200 dark:border-slate-700/60 shadow-2xs group-hover:scale-105 transition-transform">
              <ShieldCheck className="w-4 h-4 shrink-0" />
            </div>
            <span className="font-medium text-stone-800 dark:text-slate-200">{t('hero.guarantee1')}</span>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-2.5 text-center group cursor-default">
            <div className="w-8 h-8 rounded-lg bg-white dark:bg-[#16283D] flex items-center justify-center text-[#0A6C74] dark:text-[#60C3CC] border border-stone-200 dark:border-slate-700/60 shadow-2xs group-hover:scale-105 transition-transform">
              <Clock className="w-4 h-4 shrink-0" />
            </div>
            <span className="font-medium text-stone-800 dark:text-slate-200">{t('hero.guarantee2')}</span>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-2.5 text-center group cursor-default">
            <div className="w-8 h-8 rounded-lg bg-white dark:bg-[#16283D] flex items-center justify-center text-[#0A6C74] dark:text-[#60C3CC] border border-stone-200 dark:border-slate-700/60 shadow-2xs group-hover:scale-105 transition-transform">
              <MapPin className="w-4 h-4 shrink-0" />
            </div>
            <span className="font-medium text-stone-800 dark:text-slate-200">{t('hero.guarantee3')}</span>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-2.5 text-center group cursor-default">
            <div className="w-8 h-8 rounded-lg bg-white dark:bg-[#16283D] flex items-center justify-center text-[#0A6C74] dark:text-[#60C3CC] border border-stone-200 dark:border-slate-700/60 shadow-2xs group-hover:scale-105 transition-transform">
              <Award className="w-4 h-4 shrink-0" />
            </div>
            <span className="font-medium text-stone-800 dark:text-slate-200">{t('hero.guarantee4')}</span>
          </div>
        </motion.div>

      </div>
    </section>
  );
};

