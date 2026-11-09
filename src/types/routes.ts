/**
 * Centralized Strongly-Typed Routes & Navigation Helpers
 */

export type AppRouteType = 
  | 'home'
  | 'excursions'
  | 'tour_detail'
  | 'booking'
  | 'confirmation'
  | 'my_booking'
  | 'login'
  | 'register'
  | 'reset_password'
  | 'forgot_password'
  | 'account'
  | 'profile'
  | 'admin'
  | 'admin_login'
  | 'privacy'
  | 'terms'
  | 'not_found';

export interface RouteParams {
  slug?: string;
  reference?: string;
  tab?: string;
  action?: string;
  redirect?: string;
}

export interface ParsedRoute {
  type: AppRouteType;
  path: string;
  params: RouteParams;
  searchParams: URLSearchParams;
  isValid: boolean;
}

export interface BreadcrumbItem {
  label: string;
  path?: string;
  onClick?: () => void;
  isCurrent?: boolean;
}

export const APP_ROUTES = {
  HOME: '/',
  EXCURSIONS: '/excursions',
  TOUR_DETAIL: (slug: string) => `/excursions/${encodeURIComponent(slug)}`,
  BOOKING: (slug?: string) => (slug ? `/booking?tour=${encodeURIComponent(slug)}` : '/booking'),
  CONFIRMATION: (ref: string) => `/booking/confirmation/${encodeURIComponent(ref)}`,
  MY_BOOKING: (ref?: string) => (ref ? `/my-booking/${encodeURIComponent(ref)}` : '/my-booking'),
  LOGIN: (redirect?: string) => (redirect ? `/login?redirect=${encodeURIComponent(redirect)}` : '/login'),
  REGISTER: (redirect?: string) => (redirect ? `/register?redirect=${encodeURIComponent(redirect)}` : '/register'),
  RESET_PASSWORD: '/reset-password',
  FORGOT_PASSWORD: '/forgot-password',
  ACCOUNT: '/account',
  PROFILE: '/profile',
  ADMIN: '/admin',
  ADMIN_LOGIN: (redirect?: string) => (redirect ? `/admin/login?redirect=${encodeURIComponent(redirect)}` : '/admin/login'),
  ADMIN_TAB: (tab: string) => `/admin/${encodeURIComponent(tab)}`,
  ADMIN_TOUR_NEW: '/admin/tours/new',
  ADMIN_TOUR_EDIT: (id: string) => `/admin/tours/${encodeURIComponent(id)}/edit`,
  PRIVACY: '/privacy',
  TERMS: '/terms',
} as const;

/**
 * Parses pathname and URL search params into a strongly-typed route object
 */
export function parseAppRoute(pathname: string, search: string = ''): ParsedRoute {
  const cleanPath = pathname.replace(/\/+$/, '') || '/';
  const searchParams = new URLSearchParams(search);

  // Home
  if (cleanPath === '/') {
    return { type: 'home', path: '/', params: {}, searchParams, isValid: true };
  }

  // Admin login
  if (cleanPath === '/admin/login') {
    return {
      type: 'admin_login',
      path: cleanPath,
      params: { redirect: searchParams.get('redirect') || undefined },
      searchParams,
      isValid: true,
    };
  }

  // Admin portal
  if (cleanPath.startsWith('/admin')) {
    const parts = cleanPath.slice(6).replace(/^\//, '').split('/');
    return {
      type: 'admin',
      path: cleanPath,
      params: { tab: parts[0] || 'dashboard', action: parts[1] },
      searchParams,
      isValid: true,
    };
  }

  // Auth routes
  if (cleanPath === '/login') {
    return {
      type: 'login',
      path: cleanPath,
      params: { redirect: searchParams.get('redirect') || undefined },
      searchParams,
      isValid: true,
    };
  }

  if (cleanPath === '/register') {
    return {
      type: 'register',
      path: cleanPath,
      params: { redirect: searchParams.get('redirect') || undefined },
      searchParams,
      isValid: true,
    };
  }

  if (cleanPath === '/reset-password') {
    return { type: 'reset_password', path: cleanPath, params: {}, searchParams, isValid: true };
  }

  if (cleanPath === '/forgot-password') {
    return { type: 'forgot_password', path: cleanPath, params: {}, searchParams, isValid: true };
  }

  // Account / Profile
  if (cleanPath === '/account' || cleanPath === '/profile') {
    return { type: 'account', path: cleanPath, params: {}, searchParams, isValid: true };
  }

  // Excursions catalog
  if (cleanPath === '/excursions') {
    return { type: 'excursions', path: cleanPath, params: {}, searchParams, isValid: true };
  }

  // Tour detail
  if (cleanPath.startsWith('/excursions/')) {
    const slug = decodeURIComponent(cleanPath.slice(12));
    return {
      type: 'tour_detail',
      path: cleanPath,
      params: { slug },
      searchParams,
      isValid: Boolean(slug),
    };
  }

  // Booking confirmation
  if (cleanPath.startsWith('/booking/confirmation/')) {
    const reference = decodeURIComponent(cleanPath.slice(22));
    return {
      type: 'confirmation',
      path: cleanPath,
      params: { reference },
      searchParams,
      isValid: Boolean(reference),
    };
  }

  // Booking form
  if (cleanPath.startsWith('/booking')) {
    return {
      type: 'booking',
      path: cleanPath,
      params: { slug: searchParams.get('tour') || undefined },
      searchParams,
      isValid: true,
    };
  }

  // My booking lookup
  if (cleanPath.startsWith('/my-booking')) {
    const reference = cleanPath.length > 11 ? decodeURIComponent(cleanPath.slice(12)) : undefined;
    return {
      type: 'my_booking',
      path: cleanPath,
      params: { reference },
      searchParams,
      isValid: true,
    };
  }

  // Legal
  if (cleanPath === '/privacy') {
    return { type: 'privacy', path: cleanPath, params: {}, searchParams, isValid: true };
  }

  if (cleanPath === '/terms') {
    return { type: 'terms', path: cleanPath, params: {}, searchParams, isValid: true };
  }

  return {
    type: 'not_found',
    path: cleanPath,
    params: {},
    searchParams,
    isValid: false,
  };
}

/**
 * Builds breadcrumbs hierarchy for a given pathname and tour title
 */
export function getRouteBreadcrumbs(
  pathname: string,
  extra?: { tourTitle?: string; bookingRef?: string }
): BreadcrumbItem[] {
  const crumbs: BreadcrumbItem[] = [{ label: 'Home', path: APP_ROUTES.HOME }];

  if (pathname === '/excursions') {
    crumbs.push({ label: 'All Excursions', path: APP_ROUTES.EXCURSIONS, isCurrent: true });
    return crumbs;
  }

  if (pathname.startsWith('/excursions/')) {
    crumbs.push({ label: 'All Excursions', path: APP_ROUTES.EXCURSIONS });
    crumbs.push({ label: extra?.tourTitle || 'Excursion Details', isCurrent: true });
    return crumbs;
  }

  if (pathname.startsWith('/booking/confirmation/')) {
    crumbs.push({ label: 'Booking', path: APP_ROUTES.BOOKING() });
    crumbs.push({ label: `Confirmation ${extra?.bookingRef ? `(${extra.bookingRef})` : ''}`, isCurrent: true });
    return crumbs;
  }

  if (pathname.startsWith('/booking')) {
    crumbs.push({ label: 'Reserve Excursion', path: APP_ROUTES.BOOKING(), isCurrent: true });
    return crumbs;
  }

  if (pathname.startsWith('/my-booking')) {
    crumbs.push({ label: 'Find My Booking', path: APP_ROUTES.MY_BOOKING(), isCurrent: true });
    return crumbs;
  }

  if (pathname === '/account' || pathname === '/profile') {
    crumbs.push({ label: 'My Account Profile', path: APP_ROUTES.ACCOUNT, isCurrent: true });
    return crumbs;
  }

  return crumbs;
}
