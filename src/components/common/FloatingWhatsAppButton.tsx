import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageCircle, X, ArrowUpRight, Sparkles } from 'lucide-react';
import { Tour } from '../../types';
import { APP_CONFIG } from '../../config/appConfig';

interface FloatingWhatsAppButtonProps {
  currentPath: string;
  allTours?: Tour[];
}

/**
 * Builds a page-contextual pre-filled inquiry message for the WhatsApp sales team
 */
function getPreFilledMessage(currentPath: string, allTours: Tour[] = []): { text: string; pageLabel: string } {
  // 1. Tour Detail Page: /excursions/:slug
  if (currentPath.startsWith('/excursions/')) {
    const slug = currentPath.replace('/excursions/', '').split('?')[0].replace(/\/$/, '');
    const tour = allTours.find((t) => t.slug === slug);
    if (tour) {
      return {
        text: `Hello Red Sea Sales Team! I am viewing the "${tour.title}" excursion (${tour.destination} - €${tour.priceEur}) and would like to check availability and ask a question about hotel pickup.`,
        pageLabel: tour.title,
      };
    }
    return {
      text: `Hello Red Sea Sales Team! I am viewing an excursion on your website and would like assistance with tour details, departure dates, and hotel transfers.`,
      pageLabel: 'Excursion Details',
    };
  }

  // 2. Booking / Checkout Page: /booking
  if (currentPath.startsWith('/booking')) {
    const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const tourSlug = params?.get('tour');
    const tour = tourSlug ? allTours.find((t) => t.slug === tourSlug) : null;
    if (tour) {
      return {
        text: `Hello Red Sea Reservations! I am on the booking page for "${tour.title}" and would like assistance completing my reservation with hotel pickup.`,
        pageLabel: `Booking: ${tour.title}`,
      };
    }
    return {
      text: `Hello Red Sea Reservations! I am currently on the booking page and have a quick question before confirming my excursion.`,
      pageLabel: 'Checkout',
    };
  }

  // 3. Booking Confirmation / Voucher Page: /booking/confirmation/:ref
  if (currentPath.startsWith('/booking/confirmation/')) {
    const ref = currentPath.replace('/booking/confirmation/', '').split('?')[0].replace(/\/$/, '');
    return {
      text: `Hello Red Sea Support Team! I have a question regarding my confirmed excursion reservation #${ref}. Could you please assist me?`,
      pageLabel: `Booking #${ref}`,
    };
  }

  // 4. My Booking / Lookup Page: /my-booking
  if (currentPath.startsWith('/my-booking')) {
    return {
      text: `Hello Red Sea Support Team! I am on the reservation lookup page and need help checking or updating my excursion booking.`,
      pageLabel: 'Manage Booking',
    };
  }

  // 5. Excursions Catalog: /excursions
  if (currentPath.startsWith('/excursions')) {
    return {
      text: `Hello Red Sea Sales Team! I am browsing your Red Sea boat trips and excursions catalog and would love recommendations for our holiday.`,
      pageLabel: 'All Excursions',
    };
  }

  // 6. Homepage: /
  if (currentPath === '/' || currentPath === '') {
    return {
      text: `Hello Red Sea Sales Team! I am on your website and would like assistance finding the best boat tour and snorkeling trip for my schedule.`,
      pageLabel: 'Home',
    };
  }

  // 7. General Fallback
  return {
    text: `Hello Red Sea Sales Team! I am browsing your website and would like to speak directly with an excursion specialist.`,
    pageLabel: 'Website Inquiry',
  };
}

export const FloatingWhatsAppButton: React.FC<FloatingWhatsAppButtonProps> = ({
  currentPath,
  allTours = [],
}) => {
  // Visbility state adhering strictly to the Ultimate Rule:
  // ONLY appears for 10 seconds and then disappears if user was on page > 15 seconds.
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // Suppress on administrative backend routes
  const isAdmin = currentPath.startsWith('/admin');

  useEffect(() => {
    // Reset state immediately on any route / page navigation
    setIsVisible(false);
    setIsDismissed(false);

    if (isAdmin) {
      return;
    }

    let disappearTimer: ReturnType<typeof setTimeout> | null = null;

    // RULE: User must be on the page for more than 15 seconds before appearing
    const appearTimer = setTimeout(() => {
      setIsVisible(true);

      // RULE: Once appeared, only appear for 10 seconds and then disappear
      disappearTimer = setTimeout(() => {
        setIsVisible(false);
      }, 10000); // 10 seconds duration
    }, 15000); // 15 seconds threshold

    return () => {
      clearTimeout(appearTimer);
      if (disappearTimer) {
        clearTimeout(disappearTimer);
      }
    };
  }, [currentPath, isAdmin]);

  const { text: prefilledMessage, pageLabel } = useMemo(() => {
    return getPreFilledMessage(currentPath, allTours);
  }, [currentPath, allTours]);

  const whatsappUrl = useMemo(() => {
    const phoneDigits = APP_CONFIG.WHATSAPP_NUMBER.replace(/\D+/g, '');
    return `https://wa.me/${phoneDigits}?text=${encodeURIComponent(prefilledMessage)}`;
  }, [prefilledMessage]);

  if (isAdmin || isDismissed) {
    return null;
  }

  // Adjust bottom clearance for mobile views where sticky booking bars may be rendered
  const isTourOrBooking = currentPath.includes('/excursions/') || currentPath.startsWith('/booking');
  const bottomPositionClass = isTourOrBooking
    ? 'bottom-20 sm:bottom-6'
    : 'bottom-5 sm:bottom-6';

  return (
    <AnimatePresence>
      {isVisible && (
        <div
          className={`fixed right-4 sm:right-6 ${bottomPositionClass} z-40 select-none print:hidden flex flex-col items-end pointer-events-auto`}
        >
          {/* Contextual Teaser Popup Box */}
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.92 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
            className="mb-2.5 w-72 sm:w-80 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-emerald-100 p-3.5 relative overflow-hidden"
          >
            {/* Top gradient accent */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#25D366] via-emerald-500 to-[#128C7E]" />

            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs shadow-xs font-bold">
                  <MessageCircle className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-stone-900 leading-none flex items-center gap-1">
                    <span>Sales Desk Online</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  </h4>
                  <span className="text-[10px] text-stone-500 truncate block max-w-[170px] mt-0.5">
                    Viewing: {pageLabel}
                  </span>
                </div>
              </div>

              {/* Dismiss Button */}
              <button
                type="button"
                onClick={() => setIsDismissed(true)}
                className="text-stone-400 hover:text-stone-700 p-1 rounded-full hover:bg-stone-100 transition-colors"
                title="Dismiss"
                aria-label="Dismiss WhatsApp prompt"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <p className="text-[11px] text-stone-600 mt-2 leading-relaxed">
              Have questions about hotel pickup, schedules, or pricing? Chat directly with our reservations team.
            </p>

            {/* Quick pre-filled message preview */}
            <div className="mt-2 p-1.5 rounded-lg bg-emerald-50/70 border border-emerald-100 text-[10px] text-emerald-900 italic line-clamp-2">
              &ldquo;{prefilledMessage}&rdquo;
            </div>

            {/* 10-second timer indicator bar */}
            <div className="mt-2.5 w-full bg-stone-100 rounded-full h-1 overflow-hidden">
              <motion.div
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: 10, ease: 'linear' }}
                className="h-full bg-gradient-to-r from-emerald-500 to-[#25D366]"
              />
            </div>
          </motion.div>

          {/* Floating WhatsApp Action Pill Button */}
          <motion.a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            initial={{ opacity: 0, scale: 0.85, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 15 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            aria-label="Contact sales team on WhatsApp with pre-filled message"
            className="group flex items-center space-x-2.5 px-4 py-3 rounded-full bg-gradient-to-r from-[#25D366] to-[#128C7E] text-white shadow-xl hover:shadow-2xl hover:shadow-emerald-500/30 border border-white/20 transition-all cursor-pointer font-medium"
          >
            {/* Pulsing ring */}
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-white" />
            </span>

            {/* Official WhatsApp icon */}
            <svg
              className="w-5 h-5 fill-current text-white shrink-0 group-hover:rotate-12 transition-transform duration-300"
              viewBox="0 0 24 24"
            >
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>

            <div className="flex flex-col text-left leading-tight">
              <span className="text-xs font-bold tracking-wide">Contact on WhatsApp</span>
              <span className="text-[10px] text-emerald-100 font-normal">Direct with sales team</span>
            </div>

            <ArrowUpRight className="w-4 h-4 text-emerald-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </motion.a>
        </div>
      )}
    </AnimatePresence>
  );
};
