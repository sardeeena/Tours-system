import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldCheck, 
  Clock, 
  MapPin, 
  Award,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play
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
    imageUrl: 'https://uvtbtpxtrrmaublrztgv.supabase.co/storage/v1/object/public/tour-media/tours/1794698289844-jyr7cx-Orange_Bay.webp',
    accentGradient: 'from-[#0A6C74] via-[#0D838C] to-[#0A6C74] dark:from-[#60C3CC] dark:via-[#91E4EB] dark:to-[#A3E8ED]',
  },
  {
    id: 'desert-safari-quad',
    title1: 'Sunset Dunes &',
    title2: 'Bedouin Nights',
    subtitle: 'High-octane ATV quad biking through Red Sea mountain canyons, sunset camel caravans, and authentic stargazing BBQ.',
    imageUrl: 'https://uvtbtpxtrrmaublrztgv.supabase.co/storage/v1/object/public/tour-media/tours/1794702133040-bwacm6-ATV_Quad_Riding.webp',
    accentGradient: 'from-[#B45309] via-[#D97706] to-[#B45309] dark:from-[#F59E0B] dark:via-[#FBBF24] dark:to-[#FDE68A]',
  },
  {
    id: 'padi-scuba-diving',
    title1: 'Unrivaled Coral Drop-Offs &',
    title2: 'Scuba Encounters',
    subtitle: 'Selected trips in Egypt offer introductory scuba dives and guided diving experiences. Check each tour page for dive format, instructor qualifications, equipment and inclusions.',
    imageUrl: 'https://uvtbtpxtrrmaublrztgv.supabase.co/storage/v1/object/public/tour-media/tours/1794762506883-5brf0x-Ras_Mohamed00.webp',
    accentGradient: 'from-[#0F766E] via-[#0D9488] to-[#0F766E] dark:from-[#2DD4BF] dark:via-[#5EEAD4] dark:to-[#99F6E4]',
  },
  {
    id: 'luxury-private-yacht',
    title1: 'Exclusive Charters &',
    title2: 'Private Sandbars',
    subtitle: 'Tailored luxury yachts and high-speed cruisers with onboard chef, seclusion from crowds, and bespoke itineraries.',
    imageUrl: 'https://images.unsplash.com/photo-1569263979104-865ab7cd8d17?auto=format&fit=crop&w=1600&q=75',
    accentGradient: 'from-[#047857] via-[#059669] to-[#047857] dark:from-[#34D399] dark:via-[#6EE7B7] dark:to-[#A7F3D0]',
  },
  {
    id: 'water-sports-semi-submarine',
    title1: 'Glass Bottom Views &',
    title2: 'Coastal Thrills',
    subtitle: 'Panoramic underwater observatory windows, parasailing high above turquoise lagoons, and safe family bay adventures.',
    imageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=75',
    accentGradient: 'from-[#0369A1] via-[#0284C7] to-[#0369A1] dark:from-[#38BDF8] dark:via-[#7DD3FC] dark:to-[#BAE6FD]',
  }
];

export const Hero: React.FC<HeroProps> = ({ onSearch, resultCount, destinations, categories }) => {
  const { t } = useLanguage();
  const { isDark } = useTheme();
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
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
    if (isPaused || isPointerOver || !isDocumentVisible || !isInViewport || prefersReducedMotion) return;
    const interval = setInterval(() => {
      setCurrentSlideIndex((prev) => (prev + 1) % CINEMATIC_SLIDES.length);
    }, 6500);

    return () => clearInterval(interval);
  }, [currentSlideIndex, isPaused, isPointerOver, isDocumentVisible, isInViewport, prefersReducedMotion]);

  const slide = CINEMATIC_SLIDES[currentSlideIndex];
  const nextSlide = CINEMATIC_SLIDES[(currentSlideIndex + 1) % CINEMATIC_SLIDES.length];

  // Warm the next hero image while the current slide is visible to avoid a blank frame.
  useEffect(() => {
    if (!isDocumentVisible || !isInViewport || prefersReducedMotion) return;
    const image = new Image();
    image.decoding = 'async';
    image.src = nextSlide.imageUrl;
  }, [nextSlide.imageUrl, isDocumentVisible, isInViewport, prefersReducedMotion]);

  const handlePrevSlide = () => {
    setCurrentSlideIndex((prev) => (prev === 0 ? CINEMATIC_SLIDES.length - 1 : prev - 1));
  };

  const handleNextSlide = () => {
    setCurrentSlideIndex((prev) => (prev + 1) % CINEMATIC_SLIDES.length);
  };

  // Keyboard navigation keeps carousel functionality smooth and accessible
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowLeft') {
        handlePrevSlide();
      } else if (e.key === 'ArrowRight') {
        handleNextSlide();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
            animate={{ scale: 1.02, opacity: isDark ? 0.48 : 0.34 }}
            exit={{ scale: prefersReducedMotion ? 1.02 : 1.12, opacity: 0 }}
            transition={{
              opacity: { duration: prefersReducedMotion ? 0 : 1.35, ease: 'easeInOut' },
              scale: { duration: prefersReducedMotion ? 0 : 7.5, ease: 'easeOut' }
            }}
            className="absolute inset-0 bg-cover bg-center will-change-transform"
            style={{
              backgroundImage: `url('${slide.imageUrl}')`,
            }}
          />
        </AnimatePresence>
      </div>

      {/* Decorative ambient gradient light orbs */}
      <div className="absolute top-10 left-1/4 w-96 h-96 bg-[#60C3CC]/20 dark:bg-[#0A6C74]/25 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-[#E8F3F4]/60 dark:bg-[#60C3CC]/15 rounded-full blur-3xl pointer-events-none" />

      {/* Cinematic Film Vignette & Multi-stop Depth Gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#FAF8F5] via-[#FAF8F5]/45 to-transparent dark:from-[#0E1B2A] dark:via-[#0E1B2A]/50 dark:to-[#0E1B2A]/85 pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-transparent via-[#FAF8F5]/20 to-[#FAF8F5]/70 dark:via-[#0E1B2A]/30 dark:to-[#0E1B2A]/85 pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-8 pt-10 sm:pt-14 pb-12 sm:pb-16">
        
        {/* Dynamic Synchronized Headline & Narrative based on active cinematic tour */}
        <div className="max-w-3xl mb-8 min-h-[110px] sm:min-h-[130px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={slide.id}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -16 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.55, ease: 'easeOut' }}
            >
              {/* Dynamic Headline */}
              <h1 className="font-display text-3xl sm:text-5xl lg:text-6xl font-normal tracking-tight text-stone-900 dark:text-white leading-[1.12] mb-3 [text-wrap:balance]">
                {slide.title1}{' '}
                <span className={`italic font-serif text-transparent bg-clip-text bg-gradient-to-r ${slide.accentGradient}`}>
                  {slide.title2}
                </span>
              </h1>

              {/* Dynamic Subtitle */}
              <p className="text-sm sm:text-base lg:text-lg text-stone-600 dark:text-slate-300 font-normal leading-relaxed max-w-2xl">
                {slide.subtitle}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>


        {/* Accessible slide controls: visitors can pause, resume, or choose a scene. */}
        <div className="flex items-center gap-2 mb-6" aria-label="Hero image slideshow controls">
          <button
            type="button"
            onClick={handlePrevSlide}
            aria-label="Show previous hero image"
            className="w-9 h-9 rounded-full border border-stone-300/80 dark:border-slate-600 bg-white/75 dark:bg-[#16283D]/80 text-stone-800 dark:text-white backdrop-blur-sm inline-flex items-center justify-center hover:bg-white dark:hover:bg-slate-700 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          {CINEMATIC_SLIDES.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setCurrentSlideIndex(index)}
              aria-label={`Show hero image ${index + 1}: ${item.title1} ${item.title2}`}
              aria-pressed={currentSlideIndex === index}
              className={`h-2.5 rounded-full transition-all duration-300 ${currentSlideIndex === index ? 'w-7 bg-[#0A6C74] dark:bg-[#60C3CC]' : 'w-2.5 bg-stone-400/70 dark:bg-slate-400/70 hover:bg-stone-600 dark:hover:bg-slate-200'}`}
            />
          ))}
          <button
            type="button"
            onClick={() => setIsPaused((paused) => !paused)}
            aria-label={isPaused ? 'Resume hero slideshow' : 'Pause hero slideshow'}
            aria-pressed={isPaused}
            className="w-9 h-9 rounded-full border border-stone-300/80 dark:border-slate-600 bg-white/75 dark:bg-[#16283D]/80 text-stone-800 dark:text-white backdrop-blur-sm inline-flex items-center justify-center hover:bg-white dark:hover:bg-slate-700 transition-colors ml-1"
          >
            {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={handleNextSlide}
            aria-label="Show next hero image"
            className="w-9 h-9 rounded-full border border-stone-300/80 dark:border-slate-600 bg-white/75 dark:bg-[#16283D]/80 text-stone-800 dark:text-white backdrop-blur-sm inline-flex items-center justify-center hover:bg-white dark:hover:bg-slate-700 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Booking / Search Module */}
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.6, delay: prefersReducedMotion ? 0 : 0.2 }}
          className="w-full max-w-5xl mb-8"
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
          <div className="flex items-center space-x-2.5 group cursor-default">
            <div className="w-8 h-8 rounded-lg bg-white dark:bg-[#16283D] flex items-center justify-center text-[#0A6C74] dark:text-[#60C3CC] border border-stone-200 dark:border-slate-700/60 shadow-2xs group-hover:scale-105 transition-transform">
              <ShieldCheck className="w-4 h-4 shrink-0" />
            </div>
            <span className="font-medium text-stone-800 dark:text-slate-200">{t('hero.guarantee1')}</span>
          </div>

          <div className="flex items-center space-x-2.5 group cursor-default">
            <div className="w-8 h-8 rounded-lg bg-white dark:bg-[#16283D] flex items-center justify-center text-[#0A6C74] dark:text-[#60C3CC] border border-stone-200 dark:border-slate-700/60 shadow-2xs group-hover:scale-105 transition-transform">
              <Clock className="w-4 h-4 shrink-0" />
            </div>
            <span className="font-medium text-stone-800 dark:text-slate-200">{t('hero.guarantee2')}</span>
          </div>

          <div className="flex items-center space-x-2.5 group cursor-default">
            <div className="w-8 h-8 rounded-lg bg-white dark:bg-[#16283D] flex items-center justify-center text-[#0A6C74] dark:text-[#60C3CC] border border-stone-200 dark:border-slate-700/60 shadow-2xs group-hover:scale-105 transition-transform">
              <MapPin className="w-4 h-4 shrink-0" />
            </div>
            <span className="font-medium text-stone-800 dark:text-slate-200">{t('hero.guarantee3')}</span>
          </div>

          <div className="flex items-center space-x-2.5 group cursor-default">
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

