import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SearchModule } from './SearchModule';
import { Destination, Category } from '../../types';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';

interface HeroProps {
  onSearch: (filters: { destination: string; category: string; date: string; guests: number }) => void;
  resultCount?: number;
  destinations?: Destination[];
  categories?: Category[];
}

interface TourSlide {
  id: string;
  imageUrl: string;
}

const CINEMATIC_SLIDES: TourSlide[] = [
  {
    id: 'snorkeling-orange-bay',
    imageUrl: 'https://uvtbtpxtrrmaublrztgv.supabase.co/storage/v1/object/public/tour-media/tours/1794701564858-yfp2o4-White_island.webp',
  },
  {
    id: 'desert-safari-quad',
    imageUrl: 'https://uvtbtpxtrrmaublrztgv.supabase.co/storage/v1/object/public/tour-media/tours/1794702525466-0in0mt-Red_Canyon0987.webp',
  },
  {
    id: 'padi-scuba-diving',
    imageUrl: 'https://uvtbtpxtrrmaublrztgv.supabase.co/storage/v1/object/public/tour-media/tours/1794762504613-q13f8l-Nationalpark.webp',
  },
  {
    id: 'luxury-private-yacht',
    imageUrl: 'https://uvtbtpxtrrmaublrztgv.supabase.co/storage/v1/object/public/tour-media/tours/1794701566922-pl0sd2-Yachuttour.webp',
  },
  {
    id: 'water-sports-semi-submarine',
    imageUrl: 'https://uvtbtpxtrrmaublrztgv.supabase.co/storage/v1/object/public/tour-media/tours/1794698761078-i17pcl-Orange_Beach.webp',
  }
];

export const Hero: React.FC<HeroProps> = ({ onSearch, resultCount, destinations, categories }) => {
  const { isDark } = useTheme();
  const { t } = useLanguage();
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
      className="relative z-10 w-full bg-gradient-to-b from-[#E2F1F3] via-[#EFF7F8] to-[#FAF8F5] dark:bg-[#0E1B2A] text-stone-900 dark:text-white overflow-hidden transition-colors duration-300"
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

      <div className="relative max-w-7xl mx-auto px-4 sm:px-8 pt-8 sm:pt-12 pb-8 sm:pb-10">
        
        {/* Dynamic Synchronized Headline & Narrative based on active cinematic tour */}
        <div className="max-w-3xl mr-auto ml-0 mb-5 sm:mb-6 min-h-[100px] sm:min-h-[120px] rounded-2xl sm:rounded-3xl border border-white/35 bg-white/30 dark:bg-[#0E1B2A]/40 backdrop-blur-sm shadow-lg shadow-black/10 px-4 py-4 sm:px-6 sm:py-5 text-left [direction:ltr]">
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
                {t('hero.title1', 'Discover the Red Sea')}{' '}
                <span className="italic font-serif text-[#0A6C74] dark:text-[#91E4EB]">
                  {t('hero.title2', 'with our local team')}
                </span>
              </h1>

              {/* Dynamic Subtitle */}
              <p className="text-sm sm:text-base lg:text-lg text-stone-800 dark:text-white font-medium leading-relaxed max-w-2xl drop-shadow-sm ml-0 mr-auto text-left">
                {t('hero.subtitle', 'Join us for boat trips, island days, snorkelling and desert safaris around Hurghada. Choose a tour and check the dates, pickup details and what’s included.')}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>


        {/* Booking / Search Module */}
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.6, delay: prefersReducedMotion ? 0 : 0.2 }}
          className="relative z-20 mt-6 sm:mt-8 w-full max-w-5xl ml-0 mr-auto pb-1"
        >
          <SearchModule onSearch={onSearch} resultCount={resultCount} destinations={destinations} categories={categories} />
        </motion.div>



      </div>
    </section>
  );
};

