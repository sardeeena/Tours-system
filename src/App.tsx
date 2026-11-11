import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Header } from './components/common/Header';
import { Footer } from './components/common/Footer';
import { WishlistDrawer } from './components/common/WishlistDrawer';
import { CompareModal } from './components/common/CompareModal';
import { CompareFloatingBar } from './components/common/CompareFloatingBar';
import { Hero } from './components/home/Hero';
import { PopularTours } from './components/home/PopularTours';
import { ExperienceCategories } from './components/home/ExperienceCategories';
import { DestinationsSection } from './components/home/DestinationsSection';
import { WhyChooseUs } from './components/home/WhyChooseUs';
import { ReviewsSection } from './components/home/ReviewsSection';
import { FinalCTA } from './components/home/FinalCTA';
import { NotFoundPage } from './components/common/NotFoundPage';
import { ExcursionsPage } from './pages/ExcursionsPage';
import { TourDetailPage } from './pages/TourDetailPage';
import { BookingPage } from './pages/BookingPage';
import { BookingConfirmationPage } from './pages/BookingConfirmationPage';
import { MyBookingPage } from './pages/MyBookingPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { AccountPage } from './pages/AccountPage';
import { StaticContentPage } from './pages/StaticContentPage';
import { DestinationDetailPage } from './pages/DestinationDetailPage';
import { ALL_TOURS, CURRENCY_CONFIGS } from './data/toursData';
import { Tour, CurrencyConfig, Destination, Category } from './types';
import { Booking } from './types/booking';
import { bookingRepository } from './services/bookingRepository';
import { saveBookingDraft, loadBookingDraft } from './services/draftStorage';
import { getPublishedTours, getTourBySlug, getPublishedDestinations, getPublishedCategories } from './services/tourService';
import { isSupabaseConfigured } from './services/supabaseClient';
import { getStaticPages, INITIAL_STATIC_PAGES } from './services/siteSettingsService';
import type { StaticPageContent } from './services/siteSettingsService';
import { getStoredSeoMetadata, seoService } from './services/seoService';
import { getPageSeo } from './services/seoConfig';
import { sanitizeRedirectUrl } from './lib/security';
import { TourDetailSkeleton } from './components/tours/TourDetailSkeleton';
import { BookingPageSkeleton } from './components/booking/BookingPageSkeleton';
import { Compass } from 'lucide-react';

// Providers
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { ToastProvider } from './contexts/ToastContext';
import { WishlistProvider } from './contexts/WishlistContext';
import { ComparisonProvider } from './contexts/ComparisonContext';

// Admin CMS & Layout (Lazy-Loaded to reduce public bundle size)
import type { AdminTab } from './components/admin/AdminLayout';
const AdminLayout = lazy(() => import('./components/admin/AdminLayout').then(m => ({ default: m.AdminLayout })));
const AdminDashboard = lazy(() => import('./components/admin/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const AdminTourList = lazy(() => import('./components/admin/AdminTourList').then(m => ({ default: m.AdminTourList })));
const AdminTourEditor = lazy(() => import('./components/admin/AdminTourEditor').then(m => ({ default: m.AdminTourEditor })));
const AdminBookingsList = lazy(() => import('./components/admin/AdminBookingsList').then(m => ({ default: m.AdminBookingsList })));
const AdminInquiriesList = lazy(() => import('./components/admin/AdminInquiriesList').then(m => ({ default: m.AdminInquiriesList })));
const AdminCustomersList = lazy(() => import('./components/admin/AdminCustomersList').then(m => ({ default: m.AdminCustomersList })));
const AdminNewsletterList = lazy(() => import('./components/admin/AdminNewsletterList').then(m => ({ default: m.AdminNewsletterList })));
const AdminDestinationsList = lazy(() => import('./components/admin/AdminDestinationsList').then(m => ({ default: m.AdminDestinationsList })));
const AdminCategoriesList = lazy(() => import('./components/admin/AdminCategoriesList').then(m => ({ default: m.AdminCategoriesList })));
const AdminPickupList = lazy(() => import('./components/admin/AdminPickupList').then(m => ({ default: m.AdminPickupList })));
const AdminExtrasList = lazy(() => import('./components/admin/AdminExtrasList').then(m => ({ default: m.AdminExtrasList })));
const AdminReviewsList = lazy(() => import('./components/admin/AdminReviewsList').then(m => ({ default: m.AdminReviewsList })));
const AdminAvailabilityManager = lazy(() => import('./components/admin/AdminAvailabilityManager').then(m => ({ default: m.AdminAvailabilityManager })));
const AdminMediaLibrary = lazy(() => import('./components/admin/AdminMediaLibrary').then(m => ({ default: m.AdminMediaLibrary })));
const AdminSeoManager = lazy(() => import('./components/admin/AdminSeoManager').then(m => ({ default: m.AdminSeoManager })));
const AdminCouponsList = lazy(() => import('./components/admin/AdminCouponsList').then(m => ({ default: m.AdminCouponsList })));
const AdminFaqsManager = lazy(() => import('./components/admin/AdminFaqsManager').then(m => ({ default: m.AdminFaqsManager })));
const AdminPagesManager = lazy(() => import('./components/admin/AdminPagesManager').then(m => ({ default: m.AdminPagesManager })));
const AdminSettings = lazy(() => import('./components/admin/AdminSettings').then(m => ({ default: m.AdminSettings })));
const AdminAccessControl = lazy(() => import('./components/admin/AdminAccessControl').then(m => ({ default: m.AdminAccessControl })));
const AdminLoginPage = lazy(() => import('./components/admin/AdminLoginPage').then(m => ({ default: m.AdminLoginPage })));
import { HelpInquiryModal } from './components/common/HelpInquiryModal';

// CRM Modules (Lazy-Loaded)
const CrmDashboard = lazy(() => import('./components/admin/crm/CrmDashboard').then(m => ({ default: m.CrmDashboard })));
const CrmLeadsManager = lazy(() => import('./components/admin/crm/CrmLeadsManager').then(m => ({ default: m.CrmLeadsManager })));
const CrmCustomersManager = lazy(() => import('./components/admin/crm/CrmCustomersManager').then(m => ({ default: m.CrmCustomersManager })));
const CrmInquiriesManager = lazy(() => import('./components/admin/crm/CrmInquiriesManager').then(m => ({ default: m.CrmInquiriesManager })));
const CrmTasksManager = lazy(() => import('./components/admin/crm/CrmTasksManager').then(m => ({ default: m.CrmTasksManager })));
const CrmFollowUpsManager = lazy(() => import('./components/admin/crm/CrmFollowUpsManager').then(m => ({ default: m.CrmFollowUpsManager })));
const CrmConversationsManager = lazy(() => import('./components/admin/crm/CrmConversationsManager').then(m => ({ default: m.CrmConversationsManager })));
const CrmSegmentsManager = lazy(() => import('./components/admin/crm/CrmSegmentsManager').then(m => ({ default: m.CrmSegmentsManager })));
const CrmActivityTimeline = lazy(() => import('./components/admin/crm/CrmActivityTimeline').then(m => ({ default: m.CrmActivityTimeline })));

// Operations Modules (Lazy-Loaded)
const OperationsDepartures = lazy(() => import('./components/admin/operations/OperationsDepartures').then(m => ({ default: m.OperationsDepartures })));
const OperationsCalendar = lazy(() => import('./components/admin/operations/OperationsCalendar').then(m => ({ default: m.OperationsCalendar })));
const OperationsAvailability = lazy(() => import('./components/admin/operations/OperationsAvailability').then(m => ({ default: m.OperationsAvailability })));
const OperationsManifests = lazy(() => import('./components/admin/operations/OperationsManifests').then(m => ({ default: m.OperationsManifests })));
const OperationsPickupSchedule = lazy(() => import('./components/admin/operations/OperationsPickupSchedule').then(m => ({ default: m.OperationsPickupSchedule })));
const OperationsVessels = lazy(() => import('./components/admin/operations/OperationsVessels').then(m => ({ default: m.OperationsVessels })));
const OperationsGuides = lazy(() => import('./components/admin/operations/OperationsGuides').then(m => ({ default: m.OperationsGuides })));
const OperationsAssignments = lazy(() => import('./components/admin/operations/OperationsAssignments').then(m => ({ default: m.OperationsAssignments })));
const OperationsWeather = lazy(() => import('./components/admin/operations/OperationsWeather').then(m => ({ default: m.OperationsWeather })));
const OperationsDocuments = lazy(() => import('./components/admin/operations/OperationsDocuments').then(m => ({ default: m.OperationsDocuments })));

// Finance Modules (Lazy-Loaded)
const FinancePayments = lazy(() => import('./components/admin/finance/FinancePayments').then(m => ({ default: m.FinancePayments })));
const FinanceInvoices = lazy(() => import('./components/admin/finance/FinanceInvoices').then(m => ({ default: m.FinanceInvoices })));
const FinanceRefunds = lazy(() => import('./components/admin/finance/FinanceRefunds').then(m => ({ default: m.FinanceRefunds })));
const FinanceOutstandingBalances = lazy(() => import('./components/admin/finance/FinanceOutstandingBalances').then(m => ({ default: m.FinanceOutstandingBalances })));
const FinanceRevenue = lazy(() => import('./components/admin/finance/FinanceRevenue').then(m => ({ default: m.FinanceRevenue })));
const FinanceReports = lazy(() => import('./components/admin/finance/FinanceReports').then(m => ({ default: m.FinanceReports })));

// Communications Modules (Lazy-Loaded)
const CommunicationsEmail = lazy(() => import('./components/admin/communications/CommunicationsEmail').then(m => ({ default: m.CommunicationsEmail })));
const CommunicationsWhatsApp = lazy(() => import('./components/admin/communications/CommunicationsWhatsApp').then(m => ({ default: m.CommunicationsWhatsApp })));
const CommunicationsTemplates = lazy(() => import('./components/admin/communications/CommunicationsTemplates').then(m => ({ default: m.CommunicationsTemplates })));
const CommunicationsNotifications = lazy(() => import('./components/admin/communications/CommunicationsNotifications').then(m => ({ default: m.CommunicationsNotifications })));
const CommunicationsHistory = lazy(() => import('./components/admin/communications/CommunicationsHistory').then(m => ({ default: m.CommunicationsHistory })));

const AdminLoadingFallback = () => (
  <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white">
    <div className="w-12 h-12 border-4 border-[#0A6C74] border-t-transparent rounded-full animate-spin mb-4" />
    <p className="text-sm font-medium text-slate-200">Loading Management System...</p>
    <p className="text-xs text-slate-400 mt-1">Initializing secure administrative workspace</p>
  </div>
);

function MainApp() {
  const { user, isAdmin, loading: authLoading, refreshUser, checkAdminAccess } = useAuth();
  const [currentCurrency, setCurrentCurrency] = useState<CurrencyConfig>(CURRENCY_CONFIGS.EUR);

  // Live published tours loaded dynamically from Supabase
  const [liveTours, setLiveTours] = useState<Tour[]>([]);
  const [loadingTours, setLoadingTours] = useState<boolean>(true);

  // Live published destinations & categories loaded dynamically from Supabase
  const [liveDestinations, setLiveDestinations] = useState<Destination[]>([]);
  const [loadingDestinations, setLoadingDestinations] = useState<boolean>(true);
  const [destinationsError, setDestinationsError] = useState<string | null>(null);

  const [liveCategories, setLiveCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState<boolean>(true);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);

  // Drawer / Modal states
  const [isWishlistOpen, setIsWishlistOpen] = useState<boolean>(false);
  const [isCompareOpen, setIsCompareOpen] = useState<boolean>(false);
  const [isHelpInquiryOpen, setIsHelpInquiryOpen] = useState<boolean>(false);
  const [helpSelectedTour, setHelpSelectedTour] = useState<Tour | null>(null);

  // Client-side router path & search query
  const [currentPath, setCurrentPath] = useState<string>(() => {
    return window.location.pathname || '/';
  });

  const [searchParams, setSearchParams] = useState<URLSearchParams>(() => {
    return new URLSearchParams(window.location.search);
  });

  // Public CMS pages are loaded from the same saved content managed in Admin > Pages.
  const [staticPages, setStaticPages] = useState<StaticPageContent[]>(INITIAL_STATIC_PAGES);
  const refreshStaticPages = useCallback(async () => {
    try {
      const pages = await getStaticPages();
      setStaticPages(Array.isArray(pages) ? pages : INITIAL_STATIC_PAGES);
    } catch (err) {
      console.warn('Failed to load public static pages:', err);
    }
  }, []);

  useEffect(() => {
    void refreshStaticPages();
    window.addEventListener('rse_pages_updated', refreshStaticPages);
    return () => window.removeEventListener('rse_pages_updated', refreshStaticPages);
  }, [refreshStaticPages]);

  const staticPageSlug = useMemo(
    () => currentPath.replace(/^\/+|\/+$/g, ''),
    [currentPath]
  );
  const staticPage = useMemo(
    () => staticPages.find((page) => page.slug === staticPageSlug) || null,
    [staticPages, staticPageSlug]
  );

  const destinationDetailSlug = useMemo(() => {
    if (!currentPath.startsWith('/destinations/')) return null;
    return currentPath.replace('/destinations/', '').replace(/\/$/, '') || null;
  }, [currentPath]);

  const currentDestination = useMemo(
    () => destinationDetailSlug
      ? liveDestinations.find((destination) => destination.slug === destinationDetailSlug) || null
      : null,
    [destinationDetailSlug, liveDestinations]
  );

  // Active confirmed booking object for immediate view
  const [confirmedBooking, setConfirmedBooking] = useState<Booking | null>(null);

  // Search & Filter state passed from homepage search
  const [initialSearchFilter, setInitialSearchFilter] = useState<{
    destination: string;
    category: string;
  }>({
    destination: 'All',
    category: 'All',
  });

  // Load tours, destinations, and categories in parallel for sub-second homepage rendering
  const refreshCatalogue = useCallback(async () => {
    setLoadingTours(true);
    setLoadingDestinations(true);
    setLoadingCategories(true);
    setDestinationsError(null);
    setCategoriesError(null);

    const [toursRes, destsRes, catsRes] = await Promise.allSettled([
      getPublishedTours(),
      getPublishedDestinations(),
      getPublishedCategories(),
    ]);

    if (toursRes.status === 'fulfilled') {
      setLiveTours(toursRes.value || []);
    } else {
      console.warn('Failed to load published tours from Supabase:', toursRes.reason);
      setLiveTours([]);
    }
    setLoadingTours(false);

    if (destsRes.status === 'fulfilled') {
      setLiveDestinations(destsRes.value || []);
    } else {
      console.warn('Failed to load published destinations from Supabase:', destsRes.reason);
      setDestinationsError(destsRes.reason?.message || 'Unable to load destinations from database.');
      setLiveDestinations([]);
    }
    setLoadingDestinations(false);

    if (catsRes.status === 'fulfilled') {
      setLiveCategories(catsRes.value || []);
    } else {
      console.warn('Failed to load published categories from Supabase:', catsRes.reason);
      setCategoriesError(catsRes.reason?.message || 'Unable to load categories from database.');
      setLiveCategories([]);
    }
    setLoadingCategories(false);
  }, []);

  const refreshPublishedTours = useCallback(async () => {
    setLoadingTours(true);
    try {
      const data = await getPublishedTours();
      setLiveTours(data || []);
    } catch (err) {
      console.warn('Failed to load published tours from Supabase:', err);
      setLiveTours([]);
    } finally {
      setLoadingTours(false);
    }
  }, []);

  const refreshPublishedDestinations = useCallback(async () => {
    setLoadingDestinations(true);
    setDestinationsError(null);
    try {
      const data = await getPublishedDestinations();
      setLiveDestinations(data || []);
    } catch (err: any) {
      console.warn('Failed to load published destinations from Supabase:', err);
      setDestinationsError(err.message || 'Unable to load destinations from database.');
      setLiveDestinations([]);
    } finally {
      setLoadingDestinations(false);
    }
  }, []);

  const refreshPublishedCategories = useCallback(async () => {
    setLoadingCategories(true);
    setCategoriesError(null);
    try {
      const data = await getPublishedCategories();
      setLiveCategories(data || []);
    } catch (err: any) {
      console.warn('Failed to load published categories from Supabase:', err);
      setCategoriesError(err.message || 'Unable to load categories from database.');
      setLiveCategories([]);
    } finally {
      setLoadingCategories(false);
    }
  }, []);

  // Initial catalogue parallel load
  useEffect(() => {
    refreshCatalogue();
  }, [refreshCatalogue]);

  // Synchronize dynamic catalogue when admin mutations occur
  useEffect(() => {
    const handleDataUpdated = () => {
      refreshCatalogue();
    };
    window.addEventListener('rse_data_updated', handleDataUpdated);
    return () => window.removeEventListener('rse_data_updated', handleDataUpdated);
  }, [refreshCatalogue]);

  // Sync browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/');
      setSearchParams(new URLSearchParams(window.location.search));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Central Navigation function
  const navigate = (path: string, param?: string) => {
    let fullPath = path;

    if (path === 'home') {
      fullPath = '/';
    } else if (path === 'excursions') {
      fullPath = '/excursions';
    } else if (path === 'tour-detail' && param) {
      fullPath = `/excursions/${param}`;
    } else if (path === 'booking') {
      fullPath = param ? `/booking?tour=${param}` : '/booking';
    } else if (path === 'confirmation' && param) {
      fullPath = `/booking/confirmation/${param}`;
    } else if (path === 'my-booking') {
      fullPath = param ? `/my-booking/${param}` : '/my-booking';
    } else if (path === 'admin') {
      fullPath = param ? `/admin/${param}` : '/admin';
    } else if (path === 'admin_login') {
      fullPath = '/admin/login';
    } else if (path === 'login') {
      fullPath = param ? `/login${param.startsWith('?') ? param : `?redirect=${param}`}` : '/login';
    } else if (path === 'register') {
      fullPath = param ? `/register${param.startsWith('?') ? param : `?redirect=${param}`}` : '/register';
    } else if (path === 'reset-password' || path === 'forgot-password') {
      fullPath = '/reset-password';
    } else if (path === 'account' || path === 'profile') {
      fullPath = '/account';
    }

    if (window.location.pathname + window.location.search !== fullPath) {
      window.history.pushState({}, '', fullPath);
    }

    const [pathname, searchStr] = fullPath.split('?');
    setCurrentPath(pathname || '/');
    setSearchParams(new URLSearchParams(searchStr || ''));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Resolve booking reference if on confirmation page
  const confirmationReference = useMemo(() => {
    if (currentPath.startsWith('/booking/confirmation/')) {
      return currentPath.replace('/booking/confirmation/', '').replace(/\/$/, '');
    }
    return null;
  }, [currentPath]);

  // Resolve reference if on my-booking page
  const myBookingReference = useMemo(() => {
    if (currentPath.startsWith('/my-booking/')) {
      return currentPath.replace('/my-booking/', '').replace(/\/$/, '');
    }
    return searchParams.get('ref') || undefined;
  }, [currentPath, searchParams]);

  // Resolve tour slug if on tour-details page
  const tourDetailSlug = useMemo(() => {
    if (currentPath.startsWith('/excursions/')) {
      return currentPath.replace('/excursions/', '').replace(/\/$/, '');
    }
    return null;
  }, [currentPath]);

  // Resolve tour slug if on booking page
  const bookingTourSlug = useMemo(() => {
    if (currentPath.startsWith('/booking/')) {
      const slug = currentPath.replace('/booking/', '').replace(/\/$/, '');
      if (slug && slug !== 'confirmation') return slug;
    }
    return searchParams.get('tour') || undefined;
  }, [currentPath, searchParams]);

  // Asynchronously retrieve confirmed booking if loading direct confirmation URL
  useEffect(() => {
    if (confirmationReference && (!confirmedBooking || confirmedBooking.bookingReference !== confirmationReference)) {
      bookingRepository.getBooking(confirmationReference).then((found) => {
        if (found) {
          setConfirmedBooking(found);
        }
      });
    }
  }, [confirmationReference, confirmedBooking]);

  // Dynamic Tour for TourDetailPage (fetched from Supabase or fallback)
  const [currentTourDetail, setCurrentTourDetail] = useState<Tour | null>(null);

  useEffect(() => {
    if (!tourDetailSlug) {
      setCurrentTourDetail(null);
      return;
    }

    // Check in-memory list first
    const quickFind = liveTours.find((t) => t.slug === tourDetailSlug);
    if (quickFind) {
      setCurrentTourDetail(quickFind);
    }

    // Always fetch latest relational details from Supabase (or allow preview if admin)
    getTourBySlug(tourDetailSlug, isAdmin).then((fullTour) => {
      if (fullTour) {
        setCurrentTourDetail(fullTour);
      }
    });
  }, [tourDetailSlug, liveTours, isAdmin]);

  // Synchronize document title, OpenGraph tags, and Schema.org for all routes
  useEffect(() => {
    if (currentPath.startsWith('/admin')) {
      seoService.apply({
        title: 'Staff & Admin Login | Kemet Spirit',
        description: 'Private Kemet Spirit administration portal.',
        robotsIndex: false,
        robotsFollow: false,
      });
      return;
    }

    if (['/login', '/register', '/account', '/profile', '/reset-password'].includes(currentPath)) {
      seoService.apply({
        title: `Private Account | Kemet Spirit`,
        description: 'Private customer account access.',
        canonicalUrl: typeof window !== 'undefined' ? `${window.location.origin}${currentPath}` : undefined,
        robotsIndex: false,
        robotsFollow: false,
      });
      return;
    }

    if (currentPath.startsWith('/booking/confirmation')) {
      seoService.apply({
        title: confirmationReference
          ? `Booking Confirmed (${confirmationReference}) | Kemet Spirit`
          : 'Booking Confirmation | Kemet Spirit',
        description: 'Your excursion booking voucher and confirmed hotel pickup transfer itinerary.',
        canonicalUrl: typeof window !== 'undefined' ? `${window.location.origin}${currentPath}` : undefined,
        robotsIndex: false,
        robotsFollow: false,
      });
      return;
    }

    if (currentPath === '/my-booking' || currentPath.startsWith('/my-booking/')) {
      seoService.apply({
        title: 'Manage Your Booking | Kemet Spirit',
        description: 'Retrieve your booking details and voucher using your secure booking reference.',
        canonicalUrl: typeof window !== 'undefined' ? `${window.location.origin}${currentPath}` : undefined,
        robotsIndex: false,
        robotsFollow: false,
      });
      return;
    }

    if (currentPath === '/booking' || currentPath.startsWith('/booking/')) {
      seoService.apply({
        title: 'Book Your Excursion | Kemet Spirit',
        description: 'Complete your secure reservation for a Red Sea excursion.',
        canonicalUrl: typeof window !== 'undefined' ? `${window.location.origin}${currentPath}` : undefined,
        robotsIndex: false,
        robotsFollow: true,
      });
      return;
    }

    // Apply the route's safe defaults first, then overlay metadata saved in Admin > SEO.
    const baseSeoMetadata = staticPage
      ? {
          title: staticPage.seoTitle || `${staticPage.title} | Kemet Spirit`,
          description: staticPage.seoDescription || staticPage.heroSubtitle,
          canonicalUrl: typeof window !== 'undefined'
            ? `https://kemetspirit.com/${staticPage.slug}`
            : undefined,
          ogType: 'article' as const,
          robotsIndex: staticPage.seoIndexable !== false,
          robotsFollow: staticPage.seoIndexable !== false,
        }
      : getPageSeo(currentPath, {
          tour: currentTourDetail,
          tours: liveTours,
          destination: currentDestination,
        });

    seoService.apply(baseSeoMetadata);

    let seoEntity: { type: string; identifier: string; pageSlug: boolean } | null = null;

    if (staticPage) {
      seoEntity = { type: 'page', identifier: staticPage.slug, pageSlug: true };
    } else if (currentPath === '/') {
      seoEntity = { type: 'page', identifier: 'home', pageSlug: true };
    } else if (tourDetailSlug && currentTourDetail) {
      seoEntity = { type: 'tour', identifier: currentTourDetail.id, pageSlug: false };
    } else if (currentDestination) {
      seoEntity = { type: 'destination', identifier: currentDestination.id, pageSlug: false };
    } else if (currentPath === '/excursions' && searchParams.get('destination')) {
      const selectedDestination = liveDestinations.find((destination) =>
        destination.slug === searchParams.get('destination') ||
        destination.name === searchParams.get('destination')
      );
      if (selectedDestination) {
        seoEntity = { type: 'destination', identifier: selectedDestination.id, pageSlug: false };
      }
    } else if (currentPath === '/excursions' && searchParams.get('category')) {
      const selectedCategory = liveCategories.find((category) =>
        category.slug === searchParams.get('category') ||
        category.name === searchParams.get('category')
      );
      if (selectedCategory) {
        seoEntity = { type: 'category', identifier: selectedCategory.id, pageSlug: false };
      }
    }

    if (!seoEntity) return;

    let cancelled = false;
    void getStoredSeoMetadata(seoEntity.type, seoEntity.identifier, seoEntity.pageSlug).then((savedMetadata) => {
      if (!cancelled && savedMetadata) {
        const mergedMetadata = { ...baseSeoMetadata, ...savedMetadata };
        // The privacy placeholder must stay noindex even if an older saved SEO row says otherwise.
        if (staticPage?.seoIndexable === false) {
          mergedMetadata.robotsIndex = false;
          mergedMetadata.robotsFollow = false;
        }
        const destinationContentLength = currentDestination
          ? `${currentDestination.description || ''} ${currentDestination.tagline || ''}`.trim().length
          : 0;
        if (currentDestination && currentDestination.tourCount < 2 && destinationContentLength < 300) {
          mergedMetadata.robotsIndex = false;
          mergedMetadata.robotsFollow = true;
        }
        seoService.apply(mergedMetadata);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    currentPath,
    confirmationReference,
    currentTourDetail,
    liveTours,
    liveDestinations,
    liveCategories,
    staticPage,
    searchParams,
    tourDetailSlug,
    currentDestination,
  ]);

  // Handlers from Homepage
  const handleHeroSearch = (filters: { destination: string; category: string; date: string; guests: number }) => {
    setInitialSearchFilter({
      destination: filters.destination === 'All Destinations' ? 'All' : filters.destination,
      category: filters.category === 'All Activities' ? 'All' : filters.category,
    });
    navigate('/excursions');
  };

  const handleSelectHomeCategory = (categoryName: string) => {
    setInitialSearchFilter({
      destination: 'All',
      category: categoryName,
    });
    navigate('/excursions');
  };

  const handleSelectHomeDestination = (destName: string) => {
    const selectedDestination = liveDestinations.find(
      (destination) => destination.name === destName || destination.slug === destName
    );
    if (selectedDestination && selectedDestination.tourCount > 0) {
      navigate(`/destinations/${selectedDestination.slug}`);
      return;
    }
    setInitialSearchFilter({
      destination: destName,
      category: 'All',
    });
    navigate('/excursions');
  };

  const handleViewTour = (tour: Tour) => {
    navigate(`/excursions/${tour.slug}`);
  };

  const handleStartBooking = (tour: Tour) => {
    navigate(`/booking?tour=${tour.slug}`);
  };

  const handleBookFromPanel = (bookingState: {
    tour: Tour;
    date: string;
    adults: number;
    children: number;
    pickupLocation: string;
    selectedExtras: string[];
    totalEur: number;
  }) => {
    const existing = loadBookingDraft(bookingState.tour.slug);
    saveBookingDraft({
      ...existing,
      tourSlug: bookingState.tour.slug,
      date: bookingState.date,
      guests: {
        adults: bookingState.adults,
        children: bookingState.children,
        infants: 0,
      },
      selectedExtraIds: bookingState.selectedExtras,
      currentStep: 2,
    });

    navigate(`/booking?tour=${bookingState.tour.slug}`);
  };

  const handleBookingSuccess = (newBooking: Booking) => {
    setConfirmedBooking(newBooking);
    navigate(`/booking/confirmation/${newBooking.bookingReference}`);
  };

  const handleNavigateSection = (sectionId: string) => {
    if (currentPath !== '/') {
      navigate('/');
      setTimeout(() => {
        const el = document.getElementById(sectionId);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else {
      const el = document.getElementById(sectionId);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // ==============================================================================
  // ADMIN CMS ROUTE PARSER
  // ==============================================================================
  const isAdminRoute = currentPath.startsWith('/admin');

  const adminSubRoute = useMemo(() => {
    if (!isAdminRoute) return null;
    const clean = currentPath.replace(/^\/admin/, '').replace(/^\//, '');
    const parts = clean.split('/');
    const main = parts[0] || 'dashboard';
    const sub = parts[1];
    const action = parts[2];
    return { main, sub, action, full: clean };
  }, [isAdminRoute, currentPath]);

  // Admin Tab Navigation
  const handleAdminSelectTab = (tab: AdminTab, param?: string) => {
    if (tab === 'dashboard') {
      navigate('/admin');
    } else if (tab === 'tour_new') {
      navigate('/admin/tours/new');
    } else if (tab === 'tour_edit' && param) {
      navigate(`/admin/tours/${param}/edit`);
    } else if (tab === 'access_control') {
      navigate('/admin/access-control');
    } else {
      navigate(`/admin/${tab}`);
    }
  };

  // Track direct database profiles table verification status for admin routes
  const [adminCheckStatus, setAdminCheckStatus] = useState<'idle' | 'checking' | 'authorized' | 'unauthorized'>('idle');

  // On each admin route mount (except the login page itself), query the 'profiles' table directly
  useEffect(() => {
    let isCancelled = false;

    if (isAdminRoute && currentPath !== '/admin/login') {
      setAdminCheckStatus('checking');

      checkAdminAccess()
        .then((isAuthorized) => {
          if (isCancelled) return;
          if (isAuthorized) {
            setAdminCheckStatus('authorized');
          } else {
            setAdminCheckStatus('unauthorized');
            // If the role check fails, redirect the admin dashboard to the login page
            const targetRedirect = currentPath && currentPath !== '/admin' ? currentPath : '/admin';
            navigate(`/admin/login?redirect=${encodeURIComponent(targetRedirect)}`);
          }
        })
        .catch((err) => {
          console.error('Direct profiles table role check error on admin route mount:', err);
          if (isCancelled) return;
          setAdminCheckStatus('unauthorized');
          navigate(`/admin/login?redirect=${encodeURIComponent(currentPath)}`);
        });
    } else {
      setAdminCheckStatus('idle');
    }

    return () => {
      isCancelled = true;
    };
  }, [currentPath, isAdminRoute, checkAdminAccess]);

  // 1. Admin Login View: /admin/login
  if (currentPath === '/admin/login') {
    const rawRedirect = searchParams.get('redirect');
    const redirectParam = rawRedirect ? sanitizeRedirectUrl(rawRedirect, '/admin') : '/admin';
    return (
      <Suspense fallback={<AdminLoadingFallback />}>
        <AdminLoginPage
          redirectUrl={redirectParam}
          onSuccess={(target) => navigate(sanitizeRedirectUrl(target, '/admin'))}
          onBackToSite={() => navigate('/')}
        />
      </Suspense>
    );
  }

  // 2. Admin Protected Area: /admin/*
  if (isAdminRoute) {
    // If auth is resolving or active database query to 'profiles' table is running:
    if (authLoading || adminCheckStatus === 'checking' || adminCheckStatus === 'idle') {
      return (
        <div className="min-h-screen bg-stone-50 dark:bg-stone-950 flex items-center justify-center p-4 text-stone-700 dark:text-stone-300">
          <div className="text-center space-y-3">
            <div className="w-8 h-8 border-2 border-[#0A6C74] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs">Verifying administrator permissions with database...</p>
          </div>
        </div>
      );
    }

    // If role check failed, properly redirect to login page (the useEffect triggers navigate)
    if (adminCheckStatus === 'unauthorized' || !isAdmin) {
      return (
        <div className="min-h-screen bg-stone-50 dark:bg-stone-950 flex items-center justify-center p-4 text-stone-700 dark:text-stone-300">
          <div className="text-center space-y-3">
            <div className="w-8 h-8 border-2 border-[#0A6C74] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs">Unauthorized: Redirecting to administrator login...</p>
          </div>
        </div>
      );
    }

    let activeAdminTab: AdminTab = 'dashboard';
    let editTourId: string | undefined = undefined;

    if (adminSubRoute?.main === 'dashboard' || adminSubRoute?.main === 'dash') {
      if (adminSubRoute.sub === 'sales') {
        activeAdminTab = 'dash_sales';
      } else if (adminSubRoute.sub === 'ops' || adminSubRoute.sub === 'operations') {
        activeAdminTab = 'dash_ops';
      } else if (adminSubRoute.sub === 'customers' || adminSubRoute.sub === 'cust') {
        activeAdminTab = 'dash_customers';
      } else if (adminSubRoute.sub === 'finance' || adminSubRoute.sub === 'fin') {
        activeAdminTab = 'dash_finance';
      } else if (adminSubRoute.sub === 'builder' || adminSubRoute.sub === 'report_builder') {
        activeAdminTab = 'dash_builder';
      } else {
        activeAdminTab = 'dashboard';
      }
    } else if (adminSubRoute?.main === 'access-control' || adminSubRoute?.main === 'access_control') {
      activeAdminTab = 'access_control';
    } else if (adminSubRoute?.main === 'tours') {
      if (adminSubRoute.sub === 'new') {
        activeAdminTab = 'tour_new';
      } else if (adminSubRoute.sub && adminSubRoute.action === 'edit') {
        activeAdminTab = 'tour_edit';
        editTourId = adminSubRoute.sub;
      } else {
        activeAdminTab = 'tours';
      }
    } else if (adminSubRoute?.main === 'crm') {
      if (adminSubRoute.sub === 'leads') {
        activeAdminTab = 'crm_leads';
      } else if (adminSubRoute.sub === 'customers') {
        activeAdminTab = 'crm_customers';
      } else if (adminSubRoute.sub === 'inquiries') {
        activeAdminTab = 'crm_inquiries';
      } else if (adminSubRoute.sub === 'tasks') {
        activeAdminTab = 'crm_tasks';
      } else if (adminSubRoute.sub === 'followups') {
        activeAdminTab = 'crm_followups';
      } else if (adminSubRoute.sub === 'conversations') {
        activeAdminTab = 'crm_conversations';
      } else if (adminSubRoute.sub === 'segments') {
        activeAdminTab = 'crm_segments';
      } else if (adminSubRoute.sub === 'timeline') {
        activeAdminTab = 'crm_timeline';
      } else {
        activeAdminTab = 'crm_dashboard';
      }
    } else if (adminSubRoute?.main === 'operations' || adminSubRoute?.main === 'ops') {
      if (adminSubRoute.sub === 'departures' || adminSubRoute.sub === 'today') {
        activeAdminTab = 'ops_departures';
      } else if (adminSubRoute.sub === 'calendar') {
        activeAdminTab = 'ops_calendar';
      } else if (adminSubRoute.sub === 'availability') {
        activeAdminTab = 'ops_availability';
      } else if (adminSubRoute.sub === 'manifests' || adminSubRoute.sub === 'manifest') {
        activeAdminTab = 'ops_manifests';
      } else if (adminSubRoute.sub === 'pickups' || adminSubRoute.sub === 'pickup') {
        activeAdminTab = 'ops_pickups';
      } else if (adminSubRoute.sub === 'vessels' || adminSubRoute.sub === 'fleet') {
        activeAdminTab = 'ops_vessels';
      } else if (adminSubRoute.sub === 'guides' || adminSubRoute.sub === 'captains') {
        activeAdminTab = 'ops_guides';
      } else if (adminSubRoute.sub === 'assignments' || adminSubRoute.sub === 'assign') {
        activeAdminTab = 'ops_assignments';
      } else if (adminSubRoute.sub === 'weather') {
        activeAdminTab = 'ops_weather';
      } else if (adminSubRoute.sub === 'documents' || adminSubRoute.sub === 'docs') {
        activeAdminTab = 'ops_documents';
      } else {
        activeAdminTab = 'ops_departures';
      }
    } else if (adminSubRoute?.main === 'finance' || adminSubRoute?.main === 'fin') {
      if (adminSubRoute.sub === 'payments' || adminSubRoute.sub === 'pay') {
        activeAdminTab = 'fin_payments';
      } else if (adminSubRoute.sub === 'invoices' || adminSubRoute.sub === 'inv') {
        activeAdminTab = 'fin_invoices';
      } else if (adminSubRoute.sub === 'refunds' || adminSubRoute.sub === 'ref') {
        activeAdminTab = 'fin_refunds';
      } else if (adminSubRoute.sub === 'balances' || adminSubRoute.sub === 'outstanding') {
        activeAdminTab = 'fin_balances';
      } else if (adminSubRoute.sub === 'revenue' || adminSubRoute.sub === 'rev') {
        activeAdminTab = 'fin_revenue';
      } else if (adminSubRoute.sub === 'reports' || adminSubRoute.sub === 'rep') {
        activeAdminTab = 'fin_reports';
      } else {
        activeAdminTab = 'fin_payments';
      }
    } else if (adminSubRoute?.main === 'communications' || adminSubRoute?.main === 'comm') {
      if (adminSubRoute.sub === 'email' || adminSubRoute.sub === 'mail') {
        activeAdminTab = 'comm_email';
      } else if (adminSubRoute.sub === 'whatsapp' || adminSubRoute.sub === 'wa') {
        activeAdminTab = 'comm_whatsapp';
      } else if (adminSubRoute.sub === 'templates' || adminSubRoute.sub === 'tmpl') {
        activeAdminTab = 'comm_templates';
      } else if (adminSubRoute.sub === 'notifications' || adminSubRoute.sub === 'notif') {
        activeAdminTab = 'comm_notifications';
      } else if (adminSubRoute.sub === 'history' || adminSubRoute.sub === 'log') {
        activeAdminTab = 'comm_history';
      } else {
        activeAdminTab = 'comm_email';
      }
    } else if (
      adminSubRoute?.main &&
      [
        'bookings',
        'inquiries',
        'customers',
        'newsletter',
        'destinations',
        'categories',
        'availability',
        'extras',
        'pickup',
        'coupons',
        'faqs',
        'reviews',
        'media',
        'seo',
        'pages',
        'settings',
        'access_control',
        'crm_dashboard',
        'crm_leads',
        'crm_customers',
        'crm_inquiries',
        'crm_tasks',
        'crm_followups',
        'crm_conversations',
        'crm_segments',
        'crm_timeline',
        'ops_departures',
        'ops_calendar',
        'ops_availability',
        'ops_manifests',
        'ops_pickups',
        'ops_vessels',
        'ops_guides',
        'ops_assignments',
        'ops_weather',
        'ops_documents',
        'fin_payments',
        'fin_invoices',
        'fin_refunds',
        'fin_balances',
        'fin_revenue',
        'fin_reports',
        'comm_email',
        'comm_whatsapp',
        'comm_templates',
        'comm_notifications',
        'comm_history',
        'dash_sales',
        'dash_ops',
        'dash_customers',
        'dash_finance',
        'dash_builder',
      ].includes(adminSubRoute.main)
    ) {
      activeAdminTab = adminSubRoute.main as AdminTab;
    }

    return (
      <Suspense fallback={<AdminLoadingFallback />}>
        <AdminLayout
          activeTab={activeAdminTab}
          onSelectTab={handleAdminSelectTab}
          onNavigateSite={() => navigate('/')}
        >
          {activeAdminTab === 'dashboard' && (
            <AdminDashboard
              onNavigateTab={handleAdminSelectTab}
              onPreviewTour={(slug) => navigate(`/excursions/${slug}`)}
              initialViewMode="executive"
            />
          )}

          {activeAdminTab === 'dash_sales' && (
            <AdminDashboard
              onNavigateTab={handleAdminSelectTab}
              onPreviewTour={(slug) => navigate(`/excursions/${slug}`)}
              initialViewMode="sales"
            />
          )}

          {activeAdminTab === 'dash_ops' && (
            <AdminDashboard
              onNavigateTab={handleAdminSelectTab}
              onPreviewTour={(slug) => navigate(`/excursions/${slug}`)}
              initialViewMode="operations"
            />
          )}

          {activeAdminTab === 'dash_customers' && (
            <AdminDashboard
              onNavigateTab={handleAdminSelectTab}
              onPreviewTour={(slug) => navigate(`/excursions/${slug}`)}
              initialViewMode="customers"
            />
          )}

          {activeAdminTab === 'dash_finance' && (
            <AdminDashboard
              onNavigateTab={handleAdminSelectTab}
              onPreviewTour={(slug) => navigate(`/excursions/${slug}`)}
              initialViewMode="finance"
            />
          )}

          {activeAdminTab === 'dash_builder' && (
            <AdminDashboard
              onNavigateTab={handleAdminSelectTab}
              onPreviewTour={(slug) => navigate(`/excursions/${slug}`)}
              initialViewMode="builder"
            />
          )}

          {activeAdminTab === 'tours' && (
            <AdminTourList
              onNavigateTab={handleAdminSelectTab}
              onPreviewTour={(slug) => navigate(`/excursions/${slug}`)}
            />
          )}

          {activeAdminTab === 'tour_new' && (
            <AdminTourEditor
              onNavigateTab={handleAdminSelectTab}
              onPreviewTour={(slug) => navigate(`/excursions/${slug}`)}
            />
          )}

          {activeAdminTab === 'tour_edit' && (
            <AdminTourEditor
              tourId={editTourId}
              onNavigateTab={handleAdminSelectTab}
              onPreviewTour={(slug) => navigate(`/excursions/${slug}`)}
            />
          )}

          {activeAdminTab === 'bookings' && <AdminBookingsList />}

          {/* OPERATIONS MODULES */}
          {activeAdminTab === 'ops_departures' && (
            <OperationsDepartures
              onNavigateTab={(tabId, param) => handleAdminSelectTab(tabId as AdminTab, param)}
            />
          )}

          {activeAdminTab === 'ops_calendar' && (
            <OperationsCalendar
              onSelectDepartureDate={(d) => handleAdminSelectTab('ops_departures')}
            />
          )}

          {activeAdminTab === 'ops_availability' && <OperationsAvailability />}

          {activeAdminTab === 'ops_manifests' && <OperationsManifests />}

          {activeAdminTab === 'ops_pickups' && <OperationsPickupSchedule />}

          {activeAdminTab === 'ops_vessels' && <OperationsVessels />}

          {activeAdminTab === 'ops_guides' && <OperationsGuides />}

          {activeAdminTab === 'ops_assignments' && <OperationsAssignments />}

          {activeAdminTab === 'ops_weather' && <OperationsWeather />}

          {activeAdminTab === 'ops_documents' && (
            <OperationsDocuments
              onNavigateTab={(tabId, param) => handleAdminSelectTab(tabId as AdminTab, param)}
            />
          )}

          {/* FINANCE MODULES */}
          {activeAdminTab === 'fin_payments' && (
            <FinancePayments
              onNavigateTab={(tabId, param) => handleAdminSelectTab(tabId as AdminTab, param)}
            />
          )}

          {activeAdminTab === 'fin_invoices' && (
            <FinanceInvoices
              onNavigateTab={(tabId, param) => handleAdminSelectTab(tabId as AdminTab, param)}
            />
          )}

          {activeAdminTab === 'fin_refunds' && (
            <FinanceRefunds
              onNavigateTab={(tabId, param) => handleAdminSelectTab(tabId as AdminTab, param)}
            />
          )}

          {activeAdminTab === 'fin_balances' && (
            <FinanceOutstandingBalances
              onNavigateTab={(tabId, param) => handleAdminSelectTab(tabId as AdminTab, param)}
            />
          )}

          {activeAdminTab === 'fin_revenue' && (
            <FinanceRevenue
              onNavigateTab={(tabId, param) => handleAdminSelectTab(tabId as AdminTab, param)}
            />
          )}

          {activeAdminTab === 'fin_reports' && <FinanceReports />}

          {/* COMMUNICATIONS MODULES */}
          {activeAdminTab === 'comm_email' && (
            <CommunicationsEmail
              onNavigateTab={(tabId, param) => handleAdminSelectTab(tabId as AdminTab, param)}
            />
          )}

          {activeAdminTab === 'comm_whatsapp' && (
            <CommunicationsWhatsApp
              onNavigateTab={(tabId, param) => handleAdminSelectTab(tabId as AdminTab, param)}
            />
          )}

          {activeAdminTab === 'comm_templates' && (
            <CommunicationsTemplates
              onNavigateTab={(tabId, param) => handleAdminSelectTab(tabId as AdminTab, param)}
            />
          )}

          {activeAdminTab === 'comm_notifications' && (
            <CommunicationsNotifications
              onNavigateTab={(tabId, param) => handleAdminSelectTab(tabId as AdminTab, param)}
            />
          )}

          {activeAdminTab === 'comm_history' && (
            <CommunicationsHistory
              onNavigateTab={(tabId, param) => handleAdminSelectTab(tabId as AdminTab, param)}
            />
          )}

          {/* CRM Modules */}
          {activeAdminTab === 'crm_dashboard' && (
            <CrmDashboard
              onNavigateTab={(tabId, param) => handleAdminSelectTab(tabId as AdminTab, param)}
            />
          )}

          {activeAdminTab === 'crm_leads' && <CrmLeadsManager />}

          {(activeAdminTab === 'customers' || activeAdminTab === 'crm_customers') && (
            <CrmCustomersManager />
          )}

          {(activeAdminTab === 'inquiries' || activeAdminTab === 'crm_inquiries') && (
            <CrmInquiriesManager />
          )}

          {activeAdminTab === 'crm_tasks' && <CrmTasksManager />}

          {activeAdminTab === 'crm_followups' && <CrmFollowUpsManager />}

          {activeAdminTab === 'crm_conversations' && <CrmConversationsManager />}

          {activeAdminTab === 'crm_segments' && <CrmSegmentsManager />}

          {activeAdminTab === 'crm_timeline' && <CrmActivityTimeline />}

          {activeAdminTab === 'newsletter' && <AdminNewsletterList />}

          {activeAdminTab === 'destinations' && <AdminDestinationsList />}

          {activeAdminTab === 'categories' && <AdminCategoriesList />}

          {activeAdminTab === 'pickup' && <AdminPickupList />}

          {activeAdminTab === 'extras' && (
            <AdminExtrasList
              onNavigateTab={(tab, param) => handleAdminSelectTab(tab, param)}
            />
          )}

          {activeAdminTab === 'coupons' && <AdminCouponsList />}

          {activeAdminTab === 'faqs' && <AdminFaqsManager />}

          {activeAdminTab === 'reviews' && <AdminReviewsList />}

          {activeAdminTab === 'availability' && <OperationsAvailability />}

          {activeAdminTab === 'media' && <AdminMediaLibrary />}

          {activeAdminTab === 'seo' && <AdminSeoManager />}

          {activeAdminTab === 'pages' && <AdminPagesManager />}

          {activeAdminTab === 'settings' && <AdminSettings />}

          {activeAdminTab === 'access_control' && <AdminAccessControl />}
        </AdminLayout>
      </Suspense>
    );
  }

  // ==============================================================================
  // PUBLIC WEBSITE VIEWS
  // ==============================================================================
  const renderCurrentView = () => {
    // Auth: Login Page
    if (currentPath === '/login') {
      const rawRedirect = searchParams.get('redirect');
      const redirectParam = rawRedirect ? sanitizeRedirectUrl(rawRedirect, '/') : undefined;
      return (
        <LoginPage
          redirectUrl={redirectParam}
          onNavigate={(page, param) => navigate(page, param)}
        />
      );
    }

    // Auth: Register Page
    if (currentPath === '/register') {
      const rawRedirect = searchParams.get('redirect');
      const redirectParam = rawRedirect ? sanitizeRedirectUrl(rawRedirect, '/') : undefined;
      return (
        <RegisterPage
          redirectUrl={redirectParam}
          onNavigate={(page, param) => navigate(page, param)}
        />
      );
    }

    // Auth: Reset Password Page
    if (currentPath === '/reset-password' || currentPath === '/forgot-password') {
      return (
        <ResetPasswordPage
          onNavigate={(page, param) => navigate(page, param)}
        />
      );
    }

    // Account & Profile Portal
    if (currentPath === '/account' || currentPath === '/profile') {
      return (
        <AccountPage
          currency={currentCurrency}
          onNavigate={(page, param) => navigate(page, param)}
          onOpenWishlist={() => setIsWishlistOpen(true)}
        />
      );
    }

    // 1. Confirmation Screen: /booking/confirmation/:bookingReference
    if (confirmationReference) {
      if (confirmedBooking) {
        return (
          <BookingConfirmationPage
            booking={confirmedBooking}
            currency={currentCurrency}
            onNavigate={(page, param) => navigate(page, param)}
          />
        );
      }

      return (
        <div className="min-h-screen bg-[#FAF8F5] py-20 px-4 text-center">
          <div className="w-8 h-8 border-2 border-[#0A6C74] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <h2 className="font-display text-lg font-bold text-stone-900">Loading Voucher Details...</h2>
          <p className="text-xs text-stone-500 mt-1">Retrieving reference: {confirmationReference}</p>
        </div>
      );
    }

    // Dedicated destination pages are backed only by published Supabase destinations and tours.
    if (destinationDetailSlug) {
      if (currentDestination) {
        const destinationTours = liveTours.filter(
          (tour) => tour.destination.toLowerCase() === currentDestination.name.toLowerCase()
        );
        return (
          <DestinationDetailPage
            destination={currentDestination}
            tours={destinationTours}
            currency={currentCurrency}
            onViewTour={handleViewTour}
            onBookTour={handleStartBooking}
            onViewAllExcursions={() => navigate('/excursions')}
          />
        );
      }
      if (loadingDestinations || loadingTours) {
        return (
          <div className="min-h-[50vh] flex items-center justify-center text-stone-600">
            Loading destination information...
          </div>
        );
      }
      return (
        <NotFoundPage
          popularTours={liveTours}
          currency={currentCurrency}
          onNavigateHome={() => navigate('/')}
          onNavigateExcursions={() => navigate('/excursions')}
          onSelectTour={handleViewTour}
          onOpenMyBooking={() => navigate('/my-booking')}
        />
      );
    }

    // Public CMS pages must be resolved before the booking route so /booking-conditions
    // is not mistaken for the multi-step booking application.
    if (staticPage) {
      return <StaticContentPage page={staticPage} />;
    }

    // 2. Booking Multi-Step Experience: /booking or /booking?tour=:slug
    if (currentPath === '/booking' || currentPath.startsWith('/booking/')) {
      if (loadingTours && liveTours.length === 0) {
        return <BookingPageSkeleton />;
      }

      return (
        <BookingPage
          tours={liveTours}
          initialTourSlug={bookingTourSlug}
          currency={currentCurrency}
          onBookingSuccess={handleBookingSuccess}
          onNavigate={(page, param) => navigate(page, param)}
        />
      );
    }

    // 3. Customer Portal: /my-booking or /my-booking/:bookingReference
    if (currentPath.startsWith('/my-booking')) {
      return (
        <MyBookingPage
          initialReference={myBookingReference}
          currency={currentCurrency}
          onNavigate={(page, param) => navigate(page, param)}
        />
      );
    }

    // 4. Tour Detail Page: /excursions/:slug
    if (tourDetailSlug) {
      if (currentTourDetail) {
        return (
          <TourDetailPage
            tour={currentTourDetail}
            allTours={liveTours}
            currency={currentCurrency}
            onNavigateHome={() => navigate('/')}
            onNavigateExcursions={() => navigate('/excursions')}
            onViewTour={handleViewTour}
            onBookTour={handleBookFromPanel}
            onDirectBookNow={handleStartBooking}
          />
        );
      }

      if (!loadingTours) {
        return (
          <div className="min-h-[60vh] max-w-xl mx-auto px-4 py-20 text-center">
            <div className="w-14 h-14 rounded-full bg-stone-100 text-[#0A6C74] flex items-center justify-center mx-auto mb-4 border border-stone-200">
              <Compass className="w-7 h-7" />
            </div>
            <h2 className="font-display text-2xl font-bold text-stone-900 mb-2">Excursion Not Found</h2>
            <p className="text-xs sm:text-sm text-stone-600 mb-6">
              The excursion "{tourDetailSlug}" could not be located in our fleet schedule. It may have been updated or concluded for the season.
            </p>
            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={() => navigate('/excursions')}
                className="px-5 py-2.5 bg-[#0A6C74] hover:bg-[#08565C] text-white text-xs font-semibold rounded-full transition-colors cursor-pointer"
              >
                Browse All Excursions
              </button>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="px-5 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold rounded-full transition-colors cursor-pointer"
              >
                Return Home
              </button>
            </div>
          </div>
        );
      }

      return <TourDetailSkeleton />;
    }

    // 5. Excursions Discovery Page: /excursions
    if (currentPath === '/excursions') {
      return (
        <ExcursionsPage
          currency={currentCurrency}
          tours={liveTours}
          isLoading={loadingTours}
          initialDestination={initialSearchFilter.destination}
          initialCategory={initialSearchFilter.category}
          destinations={liveDestinations}
          categories={liveCategories}
          onNavigateHome={() => navigate('/')}
          onViewTour={handleViewTour}
          onBookTour={handleStartBooking}
        />
      );
    }

    // 6. Homepage: /
    if (currentPath === '/') {
      return (
        <main className="flex-1">
          {/* Hero Section */}
          <Hero
            onSearch={handleHeroSearch}
            resultCount={liveTours.length}
            destinations={liveDestinations}
            categories={liveCategories}
          />

          {/* Destinations Section */}
          <DestinationsSection
            destinations={liveDestinations}
            isLoading={loadingDestinations}
            error={destinationsError}
            onRetry={refreshPublishedDestinations}
            onSelectDestination={handleSelectHomeDestination}
          />

          {/* Popular Tours Section with Skeleton Loading */}
          <PopularTours
            tours={liveTours.slice(0, 8)}
            currency={currentCurrency}
            isLoading={loadingTours}
            onSelectTour={handleViewTour}
            onQuickBook={handleStartBooking}
            onViewAllExcursions={() => navigate('/excursions')}
          />

          {/* Experience Categories */}
          <ExperienceCategories
            categories={liveCategories}
            isLoading={loadingCategories}
            error={categoriesError}
            onRetry={refreshPublishedCategories}
            onSelectCategory={handleSelectHomeCategory}
          />

          {/* Why Choose Us Trust Pillars */}
          <WhyChooseUs />

          {/* Reviews */}
          <ReviewsSection />

          {/* Final CTA */}
          <FinalCTA
            onExploreTours={() => navigate('/excursions')}
            onOpenMyBooking={() => navigate('/my-booking')}
          />
        </main>
      );
    }

    // 7. Unknown / Unmatched Route -> 404 Not Found Page
    return (
      <NotFoundPage
        popularTours={liveTours}
        currency={currentCurrency}
        onNavigateHome={() => navigate('/')}
        onNavigateExcursions={() => navigate('/excursions')}
        onSelectTour={handleViewTour}
        onOpenMyBooking={() => navigate('/my-booking')}
      />
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F5] dark:bg-[#0A1118] text-[#111A24] dark:text-[#F1F5F9] transition-colors duration-200">
      {/* Global Header */}
      <Header
        currentCurrency={currentCurrency}
        onCurrencyChange={setCurrentCurrency}
        onOpenMyBooking={() => navigate('/my-booking')}
        onNavigateHome={() => navigate('/')}
        onNavigateExcursions={() => navigate('/excursions')}
        onNavigateBooking={() => navigate('/booking')}
        onNavigateLogin={() => navigate('/login')}
        onNavigateRegister={() => navigate('/register')}
        onNavigateAccount={() => navigate('/account')}
        onNavigateAdmin={() => navigate('/admin')}
        onNavigateSection={handleNavigateSection}
        onOpenWishlist={() => setIsWishlistOpen(true)}
        onOpenCompare={() => setIsCompareOpen(true)}
        onOpenHelpInquiry={() => {
          setHelpSelectedTour(null);
          setIsHelpInquiryOpen(true);
        }}
      />

      {/* Main View Flow with Smooth Page Entrance */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentPath}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="flex-1 flex flex-col"
        >
          {renderCurrentView()}
        </motion.div>
      </AnimatePresence>

      {/* Global Commercial Footer */}
      <Footer
        onSelectDestination={(dest) => {
          setInitialSearchFilter({ destination: dest, category: 'All' });
          navigate('/excursions');
        }}
        onSelectCategory={(cat) => {
          setInitialSearchFilter({ destination: 'All', category: cat });
          navigate('/excursions');
        }}
        onOpenMyBooking={() => navigate('/my-booking')}
        onOpenLogin={() => navigate('/login')}
        onOpenRegister={() => navigate('/register')}
        onOpenResetPassword={() => navigate('/reset-password')}
        onOpenAdmin={() => navigate('/admin')}
        onOpenHelpInquiry={() => {
          setHelpSelectedTour(null);
          setIsHelpInquiryOpen(true);
        }}
      />



      {/* Slide-over Saved Excursions (Wishlist) Drawer */}
      <WishlistDrawer
        isOpen={isWishlistOpen}
        onClose={() => setIsWishlistOpen(false)}
        allTours={liveTours}
        currency={currentCurrency}
        onSelectTour={handleViewTour}
        onBookTour={handleStartBooking}
      />

      {/* Side-by-Side Excursions Comparison Modal */}
      <CompareModal
        isOpen={isCompareOpen}
        onClose={() => setIsCompareOpen(false)}
        allTours={liveTours}
        currency={currentCurrency}
        onSelectTour={handleViewTour}
        onBookTour={handleStartBooking}
      />

      {/* Floating Comparison Sticky Trigger Bar */}
      {!isAdminRoute && (
        <CompareFloatingBar
          allTours={liveTours}
          onOpenCompareModal={() => setIsCompareOpen(true)}
        />
      )}

      {/* Global Help & Support Inquiry Modal */}
      <HelpInquiryModal
        isOpen={isHelpInquiryOpen}
        onClose={() => {
          setIsHelpInquiryOpen(false);
          setHelpSelectedTour(null);
        }}
        selectedTour={helpSelectedTour}
        tours={liveTours}
      />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <ToastProvider>
          <WishlistProvider>
            <ComparisonProvider>
              <AuthProvider>
                <MainApp />
              </AuthProvider>
            </ComparisonProvider>
          </WishlistProvider>
        </ToastProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
