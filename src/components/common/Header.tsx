import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Menu, 
  X, 
  Search, 
  CalendarCheck, 
  MessageCircle, 
  Globe, 
  ChevronDown,
  Compass,
  Heart,
  Scale,
  User,
  LogIn,
  LogOut,
  ShieldCheck,
  UserPlus,
  HelpCircle,
  Sun,
  Moon,
} from 'lucide-react';
import { CurrencyConfig } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { useWishlist } from '../../contexts/WishlistContext';
import { useComparison } from '../../contexts/ComparisonContext';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { LanguageCode } from '../../types/i18n';

interface HeaderProps {
  currentCurrency?: CurrencyConfig;
  onCurrencyChange?: (currency: CurrencyConfig) => void;
  onOpenMyBooking?: () => void;
  onNavigateSection?: (sectionId: string) => void;
  onNavigateHome?: () => void;
  onNavigateExcursions?: () => void;
  onNavigateBooking?: (tourSlug?: string) => void;
  onNavigateLogin?: () => void;
  onNavigateRegister?: () => void;
  onNavigateAccount?: () => void;
  onNavigateAdmin?: () => void;
  onOpenWishlist?: () => void;
  onOpenCompare?: () => void;
  onOpenHelpInquiry?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentCurrency: _currentCurrency,
  onCurrencyChange: _onCurrencyChange,
  onOpenMyBooking,
  onNavigateSection,
  onNavigateHome,
  onNavigateExcursions,
  onNavigateBooking,
  onNavigateLogin,
  onNavigateRegister,
  onNavigateAccount,
  onNavigateAdmin,
  onOpenWishlist,
  onOpenCompare,
  onOpenHelpInquiry,
}) => {
  const { language, setLanguage, supportedLanguages, t } = useLanguage();
  const { theme: _theme, toggleTheme, isDark } = useTheme();
  const { wishlistCount } = useWishlist();
  const { comparisonCount } = useComparison();
  const { user, isAdmin, signOut } = useAuth();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const userMenuRef = useRef<HTMLDivElement>(null);

  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [_isScrolled, setIsScrolled] = useState(false);
  const lastScrollY = useRef(0);

  // Auto-hide & fade away on scroll down, animate & fade back in on scroll up
  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;

          // Always visible at the top
          if (currentScrollY <= 25) {
            setIsHeaderVisible(true);
            setIsScrolled(false);
            lastScrollY.current = currentScrollY;
            ticking = false;
            return;
          }

          setIsScrolled(true);

          // Keep visible if mobile menu or dropdowns are open
          if (mobileMenuOpen || userDropdownOpen) {
            setIsHeaderVisible(true);
            lastScrollY.current = currentScrollY;
            ticking = false;
            return;
          }

          // If scrolled down by more than 6px past threshold, fade away
          if (currentScrollY > lastScrollY.current + 6 && currentScrollY > 50) {
            setIsHeaderVisible(false);
          } else if (currentScrollY < lastScrollY.current - 6) {
            // Scrolling up reveals it with animation
            setIsHeaderVisible(true);
          }

          lastScrollY.current = currentScrollY;
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [mobileMenuOpen, userDropdownOpen]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNavClick = (sectionId: string) => {
    setMobileMenuOpen(false);
    if (onNavigateSection) {
      onNavigateSection(sectionId);
    } else {
      const el = document.getElementById(sectionId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  const handleExcursionsClick = () => {
    setMobileMenuOpen(false);
    if (onNavigateExcursions) {
      onNavigateExcursions();
    } else {
      handleNavClick('tours-section');
    }
  };

  const handleBookingClick = () => {
    setMobileMenuOpen(false);
    if (onNavigateBooking) {
      onNavigateBooking();
    } else if (onNavigateExcursions) {
      onNavigateExcursions();
    }
  };

  const handleLogoClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    if (onNavigateHome) {
      onNavigateHome();
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <header 
      className={`sticky top-0 z-40 w-full transition-all duration-300 ease-in-out transform ${
        isHeaderVisible 
          ? 'translate-y-0 opacity-100' 
          : '-translate-y-full opacity-0 pointer-events-none'
      }`}
    >
      {/* Main Navigation */}
      <div 
        className={`w-full bg-[#F7F4ED] dark:bg-[#0E1B2A] text-stone-800 dark:text-slate-100 border-b border-[#E8E3DA] dark:border-slate-800 shadow-xs transition-all duration-300 ease-in-out ${
          isHeaderVisible
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 -translate-y-2 pointer-events-none'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-3.5 flex items-center justify-between bg-[#F7F4ED] dark:bg-[#0E1B2A]">
          {/* Brand Logo */}
          <a 
            href="/" 
            onClick={handleLogoClick}
            className="flex items-center group focus:outline-hidden"
            id="brand-logo-link"
            aria-label="Awesome Adventure Tours Home"
          >
            <img 
              src="/logo.png" 
              alt="Awesome Adventure Tours" 
              width="240"
              height="240"
              fetchPriority="high"
              decoding="async"
              className="h-14 sm:h-16 md:h-20 w-auto object-contain drop-shadow-xs group-hover:scale-105 transition-transform duration-300"
            />
          </a>

          {/* Desktop Nav Links */}
          <nav className="hidden lg:flex items-center space-x-4 xl:space-x-5 text-sm font-semibold text-stone-700 dark:text-slate-200" aria-label="Main Navigation">
            <button 
              type="button"
              onClick={handleExcursionsClick} 
              className="text-stone-700 dark:text-slate-200 hover:text-[#0A6C74] dark:hover:text-[#2dd4bf] transition-colors py-1 cursor-pointer"
            >
              {t('nav.allExcursions')}
            </button>
            <button 
              type="button"
              onClick={() => handleNavClick('destinations-section')} 
              className="text-stone-700 dark:text-slate-200 hover:text-[#0A6C74] dark:hover:text-[#2dd4bf] transition-colors py-1 cursor-pointer"
            >
              {t('nav.destinations')}
            </button>
            <button 
              type="button"
              onClick={() => handleNavClick('categories-section')} 
              className="text-stone-700 dark:text-slate-200 hover:text-[#0A6C74] dark:hover:text-[#2dd4bf] transition-colors py-1 cursor-pointer"
            >
              {t('nav.experiences')}
            </button>
            <button 
              type="button"
              onClick={() => handleNavClick('why-us-section')} 
              className="text-stone-700 dark:text-slate-200 hover:text-[#0A6C74] dark:hover:text-[#2dd4bf] transition-colors py-1 cursor-pointer"
            >
              Why Choose Us
            </button>
            <button 
              type="button"
              onClick={() => handleNavClick('reviews-section')} 
              className="text-stone-700 dark:text-slate-200 hover:text-[#0A6C74] dark:hover:text-[#2dd4bf] transition-colors py-1 cursor-pointer"
            >
              {t('nav.guestReviews')}
            </button>
            <a href="/blog" aria-label="Visit the Awesome Adventure Tours blog" className="inline-flex items-center rounded-full border border-[#0A6C74]/30 bg-[#E8F3F4] px-3.5 py-1.5 text-sm font-bold text-[#0A6C74] shadow-xs transition-colors hover:bg-[#D7EBEC] dark:border-teal-400/30 dark:bg-teal-950/50 dark:text-teal-300 dark:hover:bg-teal-900/60">Blog</a>

            {/* Find My Booking */}
            <button 
              type="button"
              id="my-booking-header-btn"
              onClick={onOpenMyBooking}
              className="inline-flex items-center space-x-1 text-stone-700 dark:text-slate-200 hover:text-[#0A6C74] dark:hover:text-[#2dd4bf] transition-colors py-1 cursor-pointer text-sm font-semibold"
              title={t('nav.findMyBooking')}
            >
              <CalendarCheck className="w-4 h-4 text-[#0A6C74] dark:text-[#2dd4bf]" />
              <span>{t('nav.findMyBooking')}</span>
            </button>

            {/* Wishlist Button */}
            <button
              type="button"
              onClick={onOpenWishlist}
              className="relative p-1.5 text-stone-700 dark:text-slate-200 hover:text-rose-500 dark:hover:text-rose-400 transition-colors cursor-pointer rounded-lg hover:bg-stone-200/50 dark:hover:bg-slate-800/60"
              title="Saved Excursions"
              aria-label={`View ${wishlistCount} saved excursions`}
            >
              <Heart className={`w-4 h-4 ${wishlistCount > 0 ? 'fill-rose-500 text-rose-500' : ''}`} />
              {wishlistCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow-xs">
                  {wishlistCount}
                </span>
              )}
            </button>

            {/* Compare Button */}
            {comparisonCount > 0 && (
              <button
                type="button"
                onClick={onOpenCompare}
                className="relative p-1.5 text-stone-700 dark:text-slate-200 hover:text-[#0A6C74] dark:hover:text-[#2dd4bf] transition-colors cursor-pointer rounded-lg hover:bg-stone-200/50 dark:hover:bg-slate-800/60"
                title="Compare Excursions"
                aria-label={`Compare ${comparisonCount} excursions`}
              >
                <Scale className="w-4 h-4 text-[#0A6C74] dark:text-[#2dd4bf]" />
                <span className="absolute -top-1 -right-1 bg-[#0A6C74] text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow-xs">
                  {comparisonCount}
                </span>
              </button>
            )}

            {/* Theme Mode Toggle (Default: Light, Optional: Dark) */}
            <button
              type="button"
              id="theme-toggle-main-nav"
              onClick={toggleTheme}
              className="p-1.5 text-stone-700 dark:text-slate-200 hover:text-[#0A6C74] dark:hover:text-[#2dd4bf] transition-colors cursor-pointer rounded-lg hover:bg-stone-200/50 dark:hover:bg-slate-800/60"
              title={isDark ? "Switch to Light Mode (Default)" : "Switch to Dark Mode"}
              aria-label={isDark ? "Switch to Light Mode (Default)" : "Switch to Dark Mode"}
            >
              {isDark ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-[#0A6C74]" />
              )}
            </button>

            <a href="/support" aria-label="Open Awesome Adventure Tours customer support" className="text-stone-700 dark:text-slate-200 hover:text-[#0A6C74] dark:hover:text-[#2dd4bf] transition-colors py-1 text-sm font-semibold">Support</a>
          </nav>

        {/* Action Controls */}
        <div className="hidden sm:flex items-center space-x-2">

          {/* User Auth Section */}
          {user ? (
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                id="user-menu-button"
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl border border-stone-300/70 dark:border-slate-700 bg-stone-200/60 dark:bg-slate-800/80 hover:bg-stone-200 dark:hover:bg-slate-700 text-xs font-semibold text-stone-800 dark:text-slate-100 transition-colors cursor-pointer"
                aria-expanded={userDropdownOpen}
              >
                <div className="w-5 h-5 rounded-full bg-[#0A6C74] text-white flex items-center justify-center text-[10px] font-bold overflow-hidden">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span>{user.fullName.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <span className="max-w-[100px] truncate text-stone-800 dark:text-slate-100">{user.fullName.split(' ')[0]}</span>
                <ChevronDown className={`w-3 h-3 text-stone-500 dark:text-slate-400 transition-transform ${userDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {userDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-1.5 w-56 bg-white border border-stone-200 rounded-lg shadow-xl py-1 z-50 text-xs overflow-hidden"
                  >
                    <div className="px-3 py-2 border-b border-stone-100 bg-stone-50/70">
                      <p className="font-bold text-stone-900 truncate">{user.fullName}</p>
                      <p className="text-[11px] text-stone-500 truncate">{user.email}</p>
                      <span className={`inline-block mt-1 text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded ${
                        isAdmin ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {isAdmin ? 'Staff / Admin' : 'Voyager'}
                      </span>
                    </div>

                    <div className="py-1">
                      <button
                        type="button"
                        onClick={() => {
                          setUserDropdownOpen(false);
                          if (onNavigateAccount) onNavigateAccount();
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-stone-50 flex items-center space-x-2 text-stone-700"
                      >
                        <User className="w-3.5 h-3.5 text-[#0A6C74]" />
                        <span>My Account Profile</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setUserDropdownOpen(false);
                          if (onOpenMyBooking) onOpenMyBooking();
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-stone-50 flex items-center space-x-2 text-stone-700"
                      >
                        <CalendarCheck className="w-3.5 h-3.5 text-[#0A6C74]" />
                        <span>My Reservations</span>
                      </button>

                      {isAdmin && onNavigateAdmin && (
                        <button
                          type="button"
                          onClick={() => {
                            setUserDropdownOpen(false);
                            onNavigateAdmin();
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-stone-50 flex items-center space-x-2 text-amber-700 font-semibold"
                        >
                          <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                          <span>Admin CMS Portal</span>
                        </button>
                      )}
                    </div>

                    <div className="border-t border-stone-100 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setUserDropdownOpen(false);
                          signOut();
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-rose-50 text-rose-600 flex items-center space-x-2"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <div className="flex items-center space-x-1.5">
              <button
                type="button"
                id="header-sign-in-btn"
                onClick={() => {
                  if (onNavigateLogin) onNavigateLogin();
                }}
                className="inline-flex items-center px-3 py-2 text-xs font-semibold text-stone-700 hover:text-stone-900 hover:bg-stone-200/60 rounded-xl transition-all cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5 mr-1 text-[#0A6C74]" />
                <span>Sign In</span>
              </button>

              <button
                type="button"
                id="header-register-btn"
                onClick={() => {
                  if (onNavigateRegister) onNavigateRegister();
                }}
                className="inline-flex items-center px-3 py-2 text-xs font-semibold text-[#0A6C74] hover:text-white hover:bg-[#0A6C74] border border-[#0A6C74]/40 rounded-xl transition-all cursor-pointer font-medium"
              >
                <UserPlus className="w-3.5 h-3.5 mr-1" />
                <span>Register</span>
              </button>
            </div>
          )}

          {/* Require Help Button */}
          {onOpenHelpInquiry && (
            <button
              type="button"
              onClick={onOpenHelpInquiry}
              className="hidden md:inline-flex items-center px-3 py-2 text-xs font-semibold text-stone-700 hover:text-stone-900 hover:bg-stone-200/60 rounded-xl transition-all cursor-pointer border border-stone-300/70 bg-stone-200/40"
              title="Require Help, Concierge & Custom Tours"
            >
              <HelpCircle className="w-3.5 h-3.5 mr-1 text-[#0A6C74]" />
              <span>Require Help</span>
            </button>
          )}

          {/* Book Excursion */}
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            type="button"
            id="book-excursion-header-btn"
            onClick={handleBookingClick}
            className="inline-flex items-center px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-[#0A6C74] to-[#0D838C] hover:from-[#08565C] hover:to-[#0A6C74] rounded-xl shadow-xs transition-all cursor-pointer"
          >
            {t('nav.bookExcursion')}
          </motion.button>
        </div>

        {/* Mobile menu button & actions */}
        <div className="flex items-center space-x-2 lg:hidden">
          <a
            href="/blog"
            aria-label="Visit the Awesome Adventure Tours blog"
            className="inline-flex items-center justify-center rounded-lg border border-[#0A6C74]/30 bg-[#E8F3F4] px-3 py-2 text-xs font-bold text-[#0A6C74] dark:border-teal-400/30 dark:bg-teal-950/50 dark:text-teal-300"
          >
            Blog
          </a>

          <button
            type="button"
            id="mobile-menu-toggle-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-stone-800 dark:text-slate-200 hover:bg-stone-200 dark:hover:bg-slate-800 rounded-lg border border-stone-300/70 dark:border-slate-700 bg-stone-200/60 dark:bg-slate-800/80 cursor-pointer"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>

      {/* Mobile Drawer Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="lg:hidden border-t border-[#E8E3DA] bg-[#FAF8F5] px-5 py-5 shadow-lg overflow-hidden"
          >
            <nav className="flex flex-col space-y-3.5 text-base font-medium text-[#0E1B2A]">
              {/* Mobile User Profile Section */}
              {user ? (
                <div className="p-3 bg-stone-100 rounded-lg border border-stone-200 space-y-2.5">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-[#0A6C74] text-white flex items-center justify-center font-bold text-sm overflow-hidden">
                      {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span>{user.fullName.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-stone-900 truncate">{user.fullName}</p>
                      <p className="text-xs text-stone-500 truncate">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 pt-1 border-t border-stone-200">
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        if (onNavigateAccount) onNavigateAccount();
                      }}
                      className="flex-1 py-1.5 px-2 bg-white hover:bg-stone-50 border border-stone-200 rounded text-xs font-semibold text-stone-800 text-center flex items-center justify-center space-x-1"
                    >
                      <User className="w-3.5 h-3.5 text-[#0A6C74]" />
                      <span>My Profile</span>
                    </button>

                    {isAdmin && onNavigateAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          setMobileMenuOpen(false);
                          onNavigateAdmin();
                        }}
                        className="py-1.5 px-2 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded text-xs font-semibold text-amber-800 text-center flex items-center justify-center space-x-1"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                        <span>Admin</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        signOut();
                      }}
                      className="py-1.5 px-2 bg-white hover:bg-rose-50 border border-stone-200 rounded text-xs font-semibold text-rose-600 text-center flex items-center justify-center space-x-1"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      if (onNavigateLogin) onNavigateLogin();
                    }}
                    className="py-2.5 px-3 bg-stone-100 hover:bg-stone-200 border border-stone-300 rounded-md text-xs font-bold text-stone-800 flex items-center justify-center space-x-1.5 transition-colors"
                  >
                    <LogIn className="w-3.5 h-3.5 text-[#0A6C74]" />
                    <span>Sign In</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      if (onNavigateRegister) onNavigateRegister();
                    }}
                    className="py-2.5 px-3 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded-md text-xs font-bold flex items-center justify-center space-x-1.5 transition-colors shadow-2xs"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Register</span>
                  </button>
                </div>
              )}

              {/* Mobile Language Selector */}
              <div className="p-3 bg-stone-100 rounded-lg border border-stone-200 space-y-2">
                <span className="text-[11px] uppercase font-bold text-stone-500 tracking-wider flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-[#0A6C74]" />
                  {t('mobile.selectLanguage')}
                </span>
                <div className="grid grid-cols-5 gap-1">
                  {supportedLanguages.map((langItem) => {
                    const isSelected = language === langItem.code;
                    return (
                      <button
                        key={langItem.code}
                        type="button"
                        onClick={() => {
                          setLanguage(langItem.code as LanguageCode);
                        }}
                        className={`py-1.5 px-2 rounded-md text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all ${
                          isSelected
                            ? 'bg-[#0A6C74] text-white shadow-xs'
                            : 'bg-white text-stone-700 border border-stone-200 hover:bg-stone-50'
                        }`}
                      >
                        <span aria-hidden="true">{langItem.flag}</span>
                        <span>{langItem.code.toUpperCase()}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Mobile Theme Selector (Default: Light, Optional: Dark) */}
              <div className="p-3 bg-stone-100 rounded-lg border border-stone-200 flex items-center justify-between">
                <div className="flex items-center space-x-2 text-xs font-semibold text-stone-800">
                  {isDark ? (
                    <Moon className="w-4 h-4 text-[#60C3CC]" />
                  ) : (
                    <Sun className="w-4 h-4 text-amber-500" />
                  )}
                  <span>Theme: {isDark ? 'Dark Theme' : 'Light Theme (Default)'}</span>
                </div>
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="px-2.5 py-1 text-xs font-semibold rounded-md bg-white text-stone-800 border border-stone-200 shadow-2xs hover:bg-stone-50 transition-colors"
                >
                  {isDark ? 'Switch to Light' : 'Switch to Dark'}
                </button>
              </div>

              {/* Wishlist link in mobile */}
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  if (onOpenWishlist) onOpenWishlist();
                }}
                className="text-left py-2 px-3 rounded hover:bg-stone-100 text-rose-600 font-semibold flex items-center justify-between"
              >
                <div className="flex items-center space-x-2">
                  <Heart className="w-4 h-4 fill-current" />
                  <span>Saved Excursions</span>
                </div>
                <span className="bg-rose-100 text-rose-700 text-xs px-2 py-0.5 rounded-full font-bold">
                  {wishlistCount}
                </span>
              </button>

              {comparisonCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    if (onOpenCompare) onOpenCompare();
                  }}
                  className="text-left py-2 px-3 rounded hover:bg-stone-100 text-[#0A6C74] font-semibold flex items-center justify-between"
                >
                  <div className="flex items-center space-x-2">
                    <Scale className="w-4 h-4" />
                    <span>Compare Excursions</span>
                  </div>
                  <span className="bg-[#E8F3F4] text-[#0A6C74] text-xs px-2 py-0.5 rounded-full font-bold">
                    {comparisonCount}
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={handleExcursionsClick}
                className="text-left py-2 px-3 rounded hover:bg-stone-100 text-[#0A6C74] font-semibold flex items-center justify-between"
              >
                <span>{t('nav.allExcursions')}</span>
                <Search className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleNavClick('tours-section')}
                className="text-left py-2 px-3 rounded hover:bg-stone-100"
              >
                {t('mobile.popularTours')}
              </button>
              <button
                type="button"
                onClick={() => handleNavClick('destinations-section')}
                className="text-left py-2 px-3 rounded hover:bg-stone-100"
              >
                {t('mobile.destinationsDetailed')}
              </button>
              <button
                type="button"
                onClick={() => handleNavClick('categories-section')}
                className="text-left py-2 px-3 rounded hover:bg-stone-100"
              >
                {t('mobile.categories')}
              </button>
              <button
                type="button"
                onClick={() => handleNavClick('why-us-section')}
                className="text-left py-2 px-3 rounded hover:bg-stone-100"
              >
                Why Choose Us
              </button>
              <button
                type="button"
                onClick={() => handleNavClick('reviews-section')}
                className="text-left py-2 px-3 rounded hover:bg-stone-100"
              >
                {t('mobile.reviews')}
              </button>
              <a href="/blog" onClick={() => setMobileMenuOpen(false)} className="text-left py-2 px-3 rounded hover:bg-stone-100 dark:hover:bg-slate-800/60 font-semibold text-[#0A6C74] dark:text-teal-300 flex items-center justify-between">
                <span>Blog &amp; Travel Journal</span>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-[#0A6C74]/10 text-[#0A6C74] px-2 py-0.5 rounded-full">New</span>
              </a>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  if (onOpenMyBooking) onOpenMyBooking();
                }}
                className="text-left py-2 px-3 rounded hover:bg-stone-100 dark:hover:bg-slate-800/60 font-semibold text-stone-800 dark:text-slate-200 flex items-center space-x-2"
              >
                <CalendarCheck className="w-4 h-4 text-[#0A6C74] dark:text-[#2dd4bf]" />
                <span>{t('nav.findMyBooking')}</span>
              </button>
              <a href="/support" onClick={() => setMobileMenuOpen(false)} className="text-left py-2 px-3 rounded hover:bg-stone-100 dark:hover:bg-slate-800/60 font-semibold text-[#0A6C74] dark:text-teal-300">Customer Support &amp; Tickets</a>

              <div className="pt-3 border-t border-stone-200 flex flex-col space-y-2">
                <button
                  type="button"
                  onClick={handleBookingClick}
                  className="w-full py-2.5 px-4 text-center font-bold text-sm bg-[#0A6C74] text-white rounded shadow-sm"
                >
                  {t('nav.bookExcursion')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    if (onOpenMyBooking) onOpenMyBooking();
                  }}
                  className="w-full py-2.5 px-4 text-center font-semibold text-sm bg-stone-100 text-stone-800 rounded border border-stone-300"
                >
                  {t('mobile.findBookingSubtitle')}
                </button>
                {onOpenHelpInquiry && (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onOpenHelpInquiry();
                    }}
                    className="w-full py-2.5 px-4 text-center font-semibold text-sm bg-[#0A6C74]/10 hover:bg-[#0A6C74]/20 text-[#0A6C74] rounded border border-[#0A6C74]/30 flex items-center justify-center space-x-2"
                  >
                    <HelpCircle className="w-4 h-4 text-[#0A6C74]" />
                    <span>Require Help & Support</span>
                  </button>
                )}
                <a
                  href="https://wa.me/201515212741"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 px-4 text-center font-semibold text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded flex items-center justify-center space-x-2"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>{t('mobile.contactWhatsApp')}</span>
                </a>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};
