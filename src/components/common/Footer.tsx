import React from 'react';
import { 
  Compass, 
  MapPin, 
  Phone, 
  Mail, 
  Clock, 
  ShieldCheck, 
  MessageCircle,
  CreditCard,
  CheckCircle2,
  HelpCircle,
  Sun,
  Moon
} from 'lucide-react';
import { NewsletterSubscribe } from './NewsletterSubscribe';
import { useTheme } from '../../contexts/ThemeContext';

interface FooterProps {
  onSelectDestination?: (dest: string) => void;
  onSelectCategory?: (cat: string) => void;
  onOpenMyBooking?: () => void;
  onOpenLogin?: () => void;
  onOpenRegister?: () => void;
  onOpenResetPassword?: () => void;
  onOpenAdmin?: () => void;
  onOpenHelpInquiry?: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  onSelectDestination,
  onSelectCategory,
  onOpenMyBooking,
  onOpenLogin,
  onOpenRegister,
  onOpenResetPassword,
  onOpenAdmin,
  onOpenHelpInquiry,
}) => {
  const { toggleTheme, isDark } = useTheme();

  return (
    <footer className="bg-[#FAF8F5] text-stone-600 dark:bg-[#0E1B2A] dark:text-slate-400 text-xs border-t border-[#E8E3DA] dark:border-slate-800 transition-colors duration-300">
      
      {/* Top operational banner */}
      <div className="border-b border-[#E8E3DA] dark:border-slate-800/80 py-8 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="flex items-start space-x-3">
            <div className="p-2 rounded bg-white dark:bg-slate-800/70 border border-stone-200 dark:border-slate-700 text-[#0A6C74] dark:text-[#60C3CC] shadow-2xs">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <span className="text-stone-900 dark:text-white font-semibold block text-xs">Hurghada Office</span>
              <span className="text-[11px] text-stone-500 dark:text-slate-400">Hurghada New Marina, Berth B-14, Red Sea, Egypt</span>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <div className="p-2 rounded bg-white dark:bg-slate-800/70 border border-stone-200 dark:border-slate-700 text-[#0A6C74] dark:text-[#60C3CC] shadow-2xs">
              <Phone className="w-4 h-4" />
            </div>
            <div>
              <span className="text-stone-900 dark:text-white font-semibold block text-xs">Phone & Support</span>
              <a href="tel:+201515212741" className="text-[11px] text-stone-500 dark:text-slate-400 hover:text-[#0A6C74]">+20 151 5212741 (Daily 06:00 – 22:00)</a>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <div className="p-2 rounded bg-white dark:bg-slate-800/70 border border-stone-200 dark:border-slate-700 text-emerald-600 dark:text-emerald-400 shadow-2xs">
              <MessageCircle className="w-4 h-4" />
            </div>
            <div>
              <span className="text-stone-900 dark:text-white font-semibold block text-xs">WhatsApp Support</span>
              <span className="text-[11px] text-stone-500 dark:text-slate-400">Quick reply in English, German & Russian</span>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <div className="p-2 rounded bg-white dark:bg-slate-800/70 border border-stone-200 dark:border-slate-700 text-[#0A6C74] dark:text-[#60C3CC] shadow-2xs">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <span className="text-stone-900 dark:text-white font-semibold block text-xs">Licensed Operator</span>
              <span className="text-[11px] text-stone-500 dark:text-slate-400">Egyptian Tourism Chamber License #2491/ETB</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Links & Newsletter */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-12">
        {/* Newsletter Subscription Card */}
        <div className="mb-12">
          <NewsletterSubscribe source="footer" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
          
          {/* Brand Col */}
          <div className="lg:col-span-2">
            <div className="flex items-center space-x-3 mb-3.5">
              <img 
                src="/logo.png" 
                alt="Awesome Adventure Tours Logo" 
                width="160"
                height="160"
                loading="lazy"
                decoding="async"
                className="h-16 w-16 object-contain shrink-0 drop-shadow-xs"
              />
            </div>
            <p className="text-xs text-stone-600 dark:text-slate-400 leading-relaxed mb-5 max-w-sm">
              Explore trusted Red Sea excursions and experiences from Hurghada, Egypt, with local insight, clear trip information and helpful support.
            </p>
            <div className="flex items-center space-x-2 text-[11px] text-stone-700 dark:text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Safety inspected boats and licensed local guides</span>
            </div>
          </div>

          {/* Destinations Col */}
          <div>
            <h3 className="font-bold text-stone-900 dark:text-white text-xs uppercase tracking-wider mb-3.5">
              Destinations
            </h3>
            <ul className="space-y-2 text-xs text-stone-600 dark:text-slate-400">
              <li>
                <button 
                  type="button" 
                  onClick={() => onSelectDestination && onSelectDestination('Hurghada')}
                  className="hover:text-[#0A6C74] dark:hover:text-white transition-colors cursor-pointer"
                >
                  Hurghada Excursions
                </button>
              </li>
              <li>
                <button 
                  type="button" 
                  onClick={() => onSelectDestination && onSelectDestination('El Gouna')}
                  className="hover:text-[#0A6C74] dark:hover:text-white transition-colors cursor-pointer"
                >
                  El Gouna Cruises
                </button>
              </li>
              <li>
                <button 
                  type="button" 
                  onClick={() => onSelectDestination && onSelectDestination('Makadi Bay & Sahl Hasheesh')}
                  className="hover:text-[#0A6C74] dark:hover:text-white transition-colors cursor-pointer"
                >
                  Makadi Bay & Sahl Hasheesh
                </button>
              </li>
              <li>
                <button 
                  type="button" 
                  onClick={() => onSelectDestination && onSelectDestination('Marsa Alam')}
                  className="hover:text-[#0A6C74] dark:hover:text-white transition-colors cursor-pointer"
                >
                  Marsa Alam & Turtle Bay
                </button>
              </li>
              <li>
                <button 
                  type="button" 
                  onClick={() => onSelectDestination && onSelectDestination('Safaga & Soma Bay')}
                  className="hover:text-[#0A6C74] dark:hover:text-white transition-colors cursor-pointer"
                >
                  Safaga & Sharm El Naga
                </button>
              </li>
              <li>
                <button 
                  type="button" 
                  onClick={() => onSelectDestination && onSelectDestination('Sharm El-Sheikh')}
                  className="hover:text-[#0A6C74] dark:hover:text-white transition-colors cursor-pointer"
                >
                  Sharm El-Sheikh & Ras Mohammed
                </button>
              </li>
            </ul>
          </div>

          {/* Experience Types */}
          <div>
            <h3 className="font-bold text-stone-900 dark:text-white text-xs uppercase tracking-wider mb-3.5">
              Tour Categories
            </h3>
            <ul className="space-y-2 text-xs text-stone-600 dark:text-slate-400">
              <li>
                <button 
                  type="button" 
                  onClick={() => onSelectCategory && onSelectCategory('Boat & Yacht Cruises')}
                  className="hover:text-[#0A6C74] dark:hover:text-white transition-colors cursor-pointer"
                >
                  Orange Bay & Giftun Island
                </button>
              </li>
              <li>
                <button 
                  type="button" 
                  onClick={() => onSelectCategory && onSelectCategory('Snorkeling Excursions')}
                  className="hover:text-[#0A6C74] dark:hover:text-white transition-colors cursor-pointer"
                >
                  Dolphin House Snorkeling
                </button>
              </li>
              <li>
                <button 
                  type="button" 
                  onClick={() => onSelectCategory && onSelectCategory('Scuba Diving (PADI)')}
                  className="hover:text-[#0A6C74] dark:hover:text-white transition-colors cursor-pointer"
                >
                  Certified 2-Tank Boat Dives
                </button>
              </li>
              <li>
                <button 
                  type="button" 
                  onClick={() => onSelectCategory && onSelectCategory('Desert Quad & Buggy Safaris')}
                  className="hover:text-[#0A6C74] dark:hover:text-white transition-colors cursor-pointer"
                >
                  ATV Quad & Bedouin Dinner
                </button>
              </li>
              <li>
                <button 
                  type="button" 
                  onClick={() => onSelectCategory && onSelectCategory('Private Charters & Speedboats')}
                  className="hover:text-[#0A6C74] dark:hover:text-white transition-colors cursor-pointer"
                >
                  Private Speedboat Charters
                </button>
              </li>
              <li>
                <button 
                  type="button" 
                  onClick={() => onSelectCategory && onSelectCategory('Historical Day Trips (Luxor & Cairo)')}
                  className="hover:text-[#0A6C74] dark:hover:text-white transition-colors cursor-pointer"
                >
                  Luxor & Valley of the Kings
                </button>
              </li>
            </ul>
          </div>

          {/* Customer Area & Trust */}
          <div>
            <h3 className="font-bold text-stone-900 dark:text-white text-xs uppercase tracking-wider mb-3.5">
              Customer Support
            </h3>
            <ul className="space-y-2 text-xs text-stone-600 dark:text-slate-400">
              <li>
                <button 
                  type="button" 
                  onClick={onOpenMyBooking}
                  className="text-[#0A6C74] dark:text-[#60C3CC] hover:underline font-semibold cursor-pointer"
                >
                  My Booking & Voucher
                </button>
              </li>
              {onOpenHelpInquiry && (
                <li>
                  <button 
                    type="button" 
                    onClick={onOpenHelpInquiry}
                    className="text-amber-600 dark:text-amber-300 hover:underline transition-colors flex items-center space-x-1 cursor-pointer"
                  >
                    <HelpCircle className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                    <span>Require Help & Concierge</span>
                  </button>
                </li>
              )}
              {onOpenLogin && (
                <li>
                  <button 
                    type="button" 
                    onClick={onOpenLogin}
                    className="hover:text-[#0A6C74] dark:hover:text-white transition-colors cursor-pointer"
                  >
                    Customer Sign In
                  </button>
                </li>
              )}
              {onOpenRegister && (
                <li>
                  <button 
                    type="button" 
                    onClick={onOpenRegister}
                    className="hover:text-[#0A6C74] dark:hover:text-white transition-colors cursor-pointer"
                  >
                    Register Account
                  </button>
                </li>
              )}
              {onOpenResetPassword && (
                <li>
                  <button 
                    type="button" 
                    onClick={onOpenResetPassword}
                    className="hover:text-[#0A6C74] dark:hover:text-white transition-colors cursor-pointer"
                  >
                    Reset Password
                  </button>
                </li>
              )}
              <li><a href="/blog" className="hover:text-[#0A6C74] dark:hover:text-white transition-colors">Travel Journal</a></li>
              <li>
                <a href="/about" className="hover:text-[#0A6C74] dark:hover:text-white transition-colors">About Awesome Adventure Tours</a>
              </li>
              <li>
                <a href="/contact" className="hover:text-[#0A6C74] dark:hover:text-white transition-colors">Contact</a>
              </li>
              <li>
                <a href="/booking-conditions" className="hover:text-[#0A6C74] dark:hover:text-white transition-colors">
                  Hotel Pickup Coverage
                </a>
              </li>
              <li>
                <a href="/why-us" className="hover:text-[#0A6C74] dark:hover:text-white transition-colors">
                  Weather & Refund Policy
                </a>
              </li>
              <li>
                <a href="/marine-safety" className="hover:text-[#0A6C74] dark:hover:text-white transition-colors">
                  Snorkeling Gear Safety
                </a>
              </li>
              <li>
                <a href="/booking-conditions" className="hover:text-[#0A6C74] dark:hover:text-white transition-colors">
                  Terms & Conditions
                </a>
              </li>
              <li>
                <a href="/privacy" className="hover:text-[#0A6C74] dark:hover:text-white transition-colors">
                  Privacy Policy
                </a>
              </li>
            </ul>
          </div>

        </div>

        {/* Payment Methods & Bottom Bar */}
        <div className="mt-12 pt-6 border-t border-[#E8E3DA] dark:border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-stone-500 dark:text-slate-500">
          <div className="flex items-center space-x-3">
            <span>© {new Date().getFullYear()} Awesome Adventure Tours. All rights reserved.</span>
            <span className="text-stone-300 dark:text-slate-700">|</span>
            {/* Footer Theme Toggle */}
            <button
              type="button"
              id="theme-toggle-footer-btn"
              onClick={toggleTheme}
              className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded bg-white hover:bg-stone-100 text-stone-700 hover:text-stone-900 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:hover:text-white border border-stone-200 dark:border-slate-700 transition-colors cursor-pointer text-[10px] font-medium shadow-2xs"
              title={isDark ? "Switch to Light Theme (Default)" : "Switch to Dark Theme"}
            >
              {isDark ? (
                <>
                  <Sun className="w-3 h-3 text-amber-300" />
                  <span>Theme: Dark (Switch to Light)</span>
                </>
              ) : (
                <>
                  <Moon className="w-3 h-3 text-[#0A6C74]" />
                  <span>Theme: Light (Switch to Dark)</span>
                </>
              )}
            </button>
          </div>

          <div className="flex items-center space-x-3 text-stone-600 dark:text-slate-400 text-[11px]">
            <span className="text-stone-500 dark:text-slate-500">Accepted payment methods:</span>
            <span className="px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-stone-200 dark:border-slate-700 text-stone-700 dark:text-slate-300 shadow-2xs">Visa</span>
            <span className="px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-stone-200 dark:border-slate-700 text-stone-700 dark:text-slate-300 shadow-2xs">Mastercard</span>
            <span className="px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-stone-200 dark:border-slate-700 text-stone-700 dark:text-slate-300 shadow-2xs">Apple Pay</span>
            <span className="px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-stone-200 dark:border-slate-700 text-stone-700 dark:text-slate-300 shadow-2xs">Cash on Pickup</span>
          </div>
        </div>

      </div>
    </footer>
  );
};
