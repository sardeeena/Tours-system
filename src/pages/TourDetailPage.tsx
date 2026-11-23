import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Star, 
  MapPin, 
  Clock, 
  CheckCircle2, 
  ShieldCheck, 
  Users, 
  Sparkles, 
  Share2, 
  Heart,
  Scale
} from 'lucide-react';
import { Tour, CurrencyConfig } from '../types';
import { formatPrice } from '../data/toursData';
import { Breadcrumbs } from '../components/common/Breadcrumbs';
import { TourGallery } from '../components/tours/TourGallery';
import { TourBookingPanel } from '../components/tours/TourBookingPanel';
import { MobileBookingBar } from '../components/tours/MobileBookingBar';
import { Itinerary } from '../components/tours/Itinerary';
import { IncludedExcluded } from '../components/tours/IncludedExcluded';
import { ImportantInformation } from '../components/tours/ImportantInformation';
import { TourReviews } from '../components/tours/TourReviews';
import { RelatedTours } from '../components/tours/RelatedTours';
import { useWishlist } from '../contexts/WishlistContext';
import { useComparison } from '../contexts/ComparisonContext';
import { useToast } from '../contexts/ToastContext';
import { useSeo } from '../hooks/useSeo';
import { seoService } from '../services/seoService';
import { recordVisitorEvent } from '../services/visitorAnalyticsService';

interface TourDetailPageProps {
  tour: Tour;
  currency: CurrencyConfig;
  allTours?: Tour[];
  onNavigateHome: () => void;
  onNavigateExcursions: () => void;
  onViewTour: (tour: Tour) => void;
  onBookTour: (bookingDetails: {
    tour: Tour;
    date: string;
    adults: number;
    children: number;
    pickupLocation: string;
    selectedExtras: string[];
    totalEur: number;
  }) => void;
  onDirectBookNow?: (tour: Tour) => void;
}

export const TourDetailPage: React.FC<TourDetailPageProps> = ({
  tour,
  currency,
  allTours = [],
  onNavigateHome,
  onNavigateExcursions,
  onViewTour,
  onBookTour,
  onDirectBookNow,
}) => {
  const { isFavorite, toggleFavorite } = useWishlist();
  const { isCompared, toggleCompare } = useComparison();
  const { showToast } = useToast();
  const [copiedLink, setCopiedLink] = useState(false);
  const [detailTab, setDetailTab] = useState<'overview' | 'itinerary' | 'included' | 'details' | 'reviews'>('overview');

  // Dynamic SEO meta tags, OpenGraph, and Schema.org JSON-LD
  const seoData = React.useMemo(() => seoService.generateTourSeo(tour), [tour]);
  useSeo(seoData);
  React.useEffect(() => {
    void recordVisitorEvent({ event_name: 'tour_view', page_path: `/excursions/${tour.slug}`, event_data: { tour_slug: tour.slug, destination: tour.destination, category: tour.category } });
  }, [tour.slug, tour.destination, tour.category]);

  const favorite = isFavorite(tour.slug);
  const compared = isCompared(tour.slug);

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href);
    void recordVisitorEvent({ event_name: 'tour_shared', page_path: `/excursions/${tour.slug}`, event_data: { tour_slug: tour.slug, interaction: 'link_copied' } });
    setCopiedLink(true);
    showToast('Tour link copied to clipboard!', 'success');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleMobileBook = () => {
    if (onDirectBookNow) {
      onDirectBookNow(tour);
    } else {
      const el = document.getElementById('booking-panel');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="bg-[#FAF8F5] min-h-screen py-5 sm:py-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto pb-28 lg:pb-12"
    >
      {/* Breadcrumbs & Actions Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <Breadcrumbs
          items={[
            { label: 'Home', onClick: onNavigateHome },
            { label: 'Excursions', onClick: onNavigateExcursions },
            { label: tour.title },
          ]}
        />

        <div className="flex items-center space-x-2">
          {/* Wishlist Button */}
          <button
            type="button"
            onClick={() => toggleFavorite(tour.slug, tour.title)}
            className={`p-2 rounded text-xs flex items-center space-x-1.5 transition-all shadow-2xs border ${
              favorite
                ? 'bg-rose-50 text-rose-600 border-rose-200 font-semibold'
                : 'bg-white border-stone-200 hover:border-stone-300 text-stone-700'
            }`}
            title={favorite ? 'Remove from saved' : 'Save to wishlist'}
          >
            <Heart className={`w-3.5 h-3.5 ${favorite ? 'fill-current text-rose-600' : ''}`} />
            <span className="hidden sm:inline">
              {favorite ? 'Saved' : 'Save'}
            </span>
          </button>

          {/* Compare Button */}
          <button
            type="button"
            onClick={() => toggleCompare(tour.slug, tour.title)}
            className={`p-2 rounded text-xs flex items-center space-x-1.5 transition-all shadow-2xs border ${
              compared
                ? 'bg-[#E8F3F4] text-[#0A6C74] border-[#0A6C74]/30 font-semibold'
                : 'bg-white border-stone-200 hover:border-stone-300 text-stone-700'
            }`}
            title="Compare with other excursions"
          >
            <Scale className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {compared ? 'In Comparison' : 'Compare'}
            </span>
          </button>

          {/* Share Button */}
          <button
            type="button"
            onClick={handleShare}
            className="p-2 bg-white border border-stone-200 hover:border-stone-300 rounded text-stone-600 text-xs flex items-center space-x-1.5 transition-colors shadow-2xs"
            title="Copy tour link"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {copiedLink ? 'Link Copied!' : 'Share'}
            </span>
          </button>
        </div>
      </div>

      {/* TOP: Image Gallery */}
      <div className="my-4">
        <TourGallery
          primaryImage={tour.primaryImage}
          galleryImages={tour.galleryImages}
          tourTitle={tour.title}
        />
      </div>

      {/* Main Grid: Left Details & Right Booking Sticky Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start mt-5 sm:mt-6">
        
        {/* Left Column: Comprehensive Details (8 cols) */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-8 min-w-0">
          
          {/* Header Info */}
          <div>
            <div className="flex items-center space-x-2 text-xs text-[#0A6C74] font-semibold mb-2">
              <span className="bg-[#E8F3F4] px-2.5 py-0.5 rounded text-[#0A6C74] font-bold uppercase tracking-wider text-[10px]">
                {tour.category}
              </span>
              <span className="text-stone-300">•</span>
              <span className="flex items-center text-stone-600">
                <MapPin className="w-3.5 h-3.5 mr-1 text-[#0A6C74]" />
                {tour.destination}
              </span>
              <span className="text-stone-300">•</span>
              <span className="flex items-center text-stone-600">
                <Clock className="w-3.5 h-3.5 mr-1 text-stone-400" />
                {tour.durationLabel}
              </span>
            </div>

            <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold text-[#0E1B2A] leading-tight mb-3">
              {tour.title}
            </h1>

            {/* Rating & Review count */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
              {tour.reviewCount > 0 ? (
                <>
                  <div className="flex text-[#C28D32]">
                    {[...Array(5)].map((_, i) => (
                      <Star 
                        key={i} 
                        className={`w-4 h-4 ${i < Math.floor(tour.rating) ? 'fill-current' : 'fill-current opacity-30'}`} 
                      />
                    ))}
                  </div>
                  <span className="font-bold text-stone-900 text-sm">
                    {tour.rating.toFixed(1)}
                  </span>
                  <span className="text-stone-400">•</span>
                  <span className="text-stone-600 font-medium">
                    {tour.reviewCount} customer reviews
                  </span>
                </>
              ) : (
                <span className="text-stone-500 font-medium">
                  No customer reviews yet
                </span>
              )}
              {tour.pickupAvailable && (
                <>
                  <span className="text-stone-400">•</span>
                  <span className="text-emerald-700 font-semibold flex items-center">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                    Hotel Pickup Available
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Short description */}
          <div className="p-4 bg-stone-50 border-l-4 border-[#0A6C74] rounded-r text-xs sm:text-sm text-stone-700 leading-relaxed shadow-xs">
            {tour.shortDescription}
          </div>

          {/* Responsive, focused excursion information tabs */}
          <section className="space-y-5" aria-label="Excursion details">
            <nav aria-label="Tour information" className="sticky top-14 sm:top-16 z-10 bg-[#FAF8F5]/95 backdrop-blur border-y border-stone-200 py-2">
              <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Tour sections">
                {([
                  ['overview', 'Overview'],
                  ['itinerary', 'Itinerary'],
                  ['included', 'Included'],
                  ['details', 'Details & FAQ'],
                  ['reviews', 'Reviews'],
                ] as const).map(([id, label]) => (
                  <button key={id} type="button" role="tab" aria-selected={detailTab === id}
                    aria-controls={`tour-tab-panel-${id}`} id={`tour-tab-${id}`} tabIndex={detailTab === id ? 0 : -1}
                    onClick={() => setDetailTab(id)}
                    onKeyDown={(event) => {
                      const tabIds = ['overview', 'itinerary', 'included', 'details', 'reviews'] as const;
                      const currentIndex = tabIds.indexOf(id);
                      let nextIndex = currentIndex;
                      if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabIds.length;
                      else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabIds.length) % tabIds.length;
                      else if (event.key === 'Home') nextIndex = 0;
                      else if (event.key === 'End') nextIndex = tabIds.length - 1;
                      else return;
                      event.preventDefault();
                      setDetailTab(tabIds[nextIndex]);
                      document.getElementById(`tour-tab-${tabIds[nextIndex]}`)?.focus();
                    }}
                    className={`shrink-0 rounded-full px-4 py-2 text-xs sm:text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A6C74] ${detailTab === id ? 'bg-[#0A6C74] text-white shadow-sm' : 'bg-white border border-stone-200 text-stone-700 hover:border-[#0A6C74]'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </nav>
            <div className="space-y-6">
              <section role="tabpanel" id="tour-tab-panel-overview" aria-labelledby="tour-tab-overview" hidden={detailTab !== 'overview'} className="min-h-[12rem] space-y-6">
                <section className="space-y-3"><h2 className="font-display text-lg font-bold text-[#0E1B2A]">About this tour</h2><p className="text-sm text-stone-600 leading-relaxed whitespace-pre-line">{tour.fullDescription}</p></section>
                {tour.highlights && tour.highlights.length > 0 && <section className="space-y-3"><h2 className="font-display text-lg font-bold text-[#0E1B2A]">What you’ll do</h2><div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">{tour.highlights.map((hl, idx) => <div key={idx} className="flex items-start text-sm text-stone-700 p-3 rounded bg-white border border-stone-200"><Sparkles className="w-4 h-4 text-[#0A6C74] mr-2 mt-0.5 shrink-0" /><span>{hl}</span></div>)}</div></section>}
              </section>
              <section role="tabpanel" id="tour-tab-panel-itinerary" aria-labelledby="tour-tab-itinerary" hidden={detailTab !== 'itinerary'} className="min-h-[12rem]"><Itinerary items={tour.itinerary} /></section>
              <section role="tabpanel" id="tour-tab-panel-included" aria-labelledby="tour-tab-included" hidden={detailTab !== 'included'} className="min-h-[12rem]"><IncludedExcluded included={tour.included} excluded={tour.excluded} /></section>
              <section role="tabpanel" id="tour-tab-panel-details" aria-labelledby="tour-tab-details" hidden={detailTab !== 'details'} className="min-h-[12rem] space-y-6"><ImportantInformation tour={tour} />{tour.faqs && tour.faqs.length > 0 && <section className="space-y-3" aria-labelledby="tour-faq-heading"><h2 id="tour-faq-heading" className="font-display text-xl font-bold text-[#0E1B2A]">Common questions</h2><div className="space-y-2">{tour.faqs.map((faq, index) => <details key={index} className="group rounded border border-stone-200 bg-white px-4 py-3"><summary className="cursor-pointer list-none font-semibold text-sm text-stone-900 flex items-center justify-between gap-3"><span>{faq.question}</span><span aria-hidden="true" className="text-[#0A6C74] group-open:rotate-45 transition-transform">+</span></summary><p className="mt-3 text-sm leading-relaxed text-stone-600">{faq.answer}</p></details>)}</div></section>}</section>
              <section role="tabpanel" id="tour-tab-panel-reviews" aria-labelledby="tour-tab-reviews" hidden={detailTab !== 'reviews'} className="min-h-[12rem]"><TourReviews tour={tour} /></section>
            </div>
          </section>

          {/* RELATED TOURS */}
          <div className="pt-4">
            <RelatedTours
              currentTour={tour}
              allTours={allTours}
              currency={currency}
              onViewTour={onViewTour}
              onBookNow={(relTour) => (onDirectBookNow ? onDirectBookNow(relTour) : handleMobileBook())}
            />
          </div>

        </div>

        {/* Right Column: Sticky Booking Panel (4 cols) */}
        <div className="lg:col-span-5 xl:col-span-4 lg:sticky lg:top-24 min-w-0">
          <TourBookingPanel
            tour={tour}
            currency={currency}
            onBook={onBookTour}
          />
        </div>

      </div>

      {/* Mobile Sticky Booking Bar */}
      <MobileBookingBar
        tour={tour}
        currency={currency}
        onBookNow={handleMobileBook}
      />

    </motion.div>
  );
};
