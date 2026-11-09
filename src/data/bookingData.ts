import { PickupLocation, BookingExtra } from '../types/booking';

/**
 * Standard Red Sea Transfer Zones & Hotel Pickup Locations
 */
export const STANDARD_PICKUP_LOCATIONS: PickupLocation[] = [
  {
    id: 'hurghada',
    name: 'Hurghada Hotels',
    area: 'Hurghada (Mamsha, Dahar, Sheraton, Marina)',
    feeEurPerPerson: 0,
    note: 'Free pickup from any hotel in Hurghada.',
    isPopular: true,
  },
  {
    id: 'el-gouna',
    name: 'El Gouna',
    area: 'El Gouna Resorts & Marina',
    feeEurPerPerson: 5,
    note: '+€5 per person (approx. 25-30 km north of Hurghada).',
    isPopular: true,
  },
  {
    id: 'makadi-bay',
    name: 'Makadi Bay',
    area: 'Makadi Bay & Madinat Makadi',
    feeEurPerPerson: 5,
    note: '+€5 per person (approx. 30 km south of Hurghada).',
    isPopular: true,
  },
  {
    id: 'sahl-hasheesh',
    name: 'Sahl Hasheesh',
    area: 'Sahl Hasheesh Bay & Old Town',
    feeEurPerPerson: 5,
    note: '+€5 per person (approx. 18 km south of Hurghada).',
    isPopular: true,
  },
  {
    id: 'safaga',
    name: 'Safaga & Soma Bay',
    area: 'Port Safaga, Soma Bay Peninsula',
    feeEurPerPerson: 10,
    note: '+€10 per person (approx. 50 km south of Hurghada).',
  },
  {
    id: 'marsa-alam',
    name: 'Marsa Alam',
    area: 'Marsa Alam / Port Ghalib (for local tours)',
    feeEurPerPerson: 10,
    note: '+€10 per person for regional pickup.',
  },
  {
    id: 'sharm-el-sheikh',
    name: 'Sharm El-Sheikh Hotels',
    area: 'Naama Bay, Nabq, Sharks Bay, Hadaba, Ras Um Sid',
    feeEurPerPerson: 0,
    note: 'Free lobby pickup from any hotel across Sharm El-Sheikh.',
    isPopular: true,
  },
];

/**
 * Centralized Optional Booking Extras
 * Supports both per_booking and per_person pricing types.
 */
export const GLOBAL_BOOKING_EXTRAS: BookingExtra[] = [
  {
    id: 'underwater-photos',
    name: 'Underwater Photos & Video Package',
    description: 'A photographer takes underwater photos and video clips of you and sends them to your phone.',
    priceEur: 20,
    pricingType: 'per_booking',
    category: 'Media',
  },
  {
    id: 'private-guide',
    name: 'Private Guide for Snorkeling',
    description: 'A dedicated marine guide stays with your group throughout the cruise and snorkeling stops.',
    priceEur: 50,
    pricingType: 'per_booking',
    category: 'Service',
  },
  {
    id: 'private-transfer',
    name: 'Private Hotel Transfer Van',
    description: 'Direct van transfer for your party only, without stopping at other hotels.',
    priceEur: 30,
    pricingType: 'per_booking',
    category: 'Transfer',
  },
  {
    id: 'extra-diving',
    name: 'Extra Guided Scuba Dive',
    description: 'Additional 20-minute dive with gear and a certified instructor.',
    priceEur: 25,
    pricingType: 'per_person',
    category: 'Activity',
  },
  {
    id: 'seafood-lunch',
    name: 'Fresh Grilled Seafood Lunch Upgrade',
    description: 'Grilled Red Sea jumbo prawns and calamari added to the buffet.',
    priceEur: 15,
    pricingType: 'per_person',
    category: 'Dining',
  },
  {
    id: 'gopro-rental',
    name: 'GoPro Underwater Camera Rental',
    description: 'Waterproof camera for the full day with handle and SD memory card to keep.',
    priceEur: 20,
    pricingType: 'per_booking',
    category: 'Equipment',
  },
];

/**
 * Common Country Codes with Dial Prefixes for International Guests
 */
export const COUNTRY_DIAL_CODES = [
  { code: 'EG', dial: '+20', country: 'Egypt', flag: '🇪🇬' },
  { code: 'DE', dial: '+49', country: 'Germany', flag: '🇩🇪' },
  { code: 'GB', dial: '+44', country: 'United Kingdom', flag: '🇬🇧' },
  { code: 'CH', dial: '+41', country: 'Switzerland', flag: '🇨🇭' },
  { code: 'AT', dial: '+43', country: 'Austria', flag: '🇦🇹' },
  { code: 'NL', dial: '+31', country: 'Netherlands', flag: '🇳🇱' },
  { code: 'FR', dial: '+33', country: 'France', flag: '🇫🇷' },
  { code: 'IT', dial: '+39', country: 'Italy', flag: '🇮🇹' },
  { code: 'PL', dial: '+48', country: 'Poland', flag: '🇵🇱' },
  { code: 'CZ', dial: '+420', country: 'Czech Republic', flag: '🇨🇿' },
  { code: 'BE', dial: '+32', country: 'Belgium', flag: '🇧🇪' },
  { code: 'SE', dial: '+46', country: 'Sweden', flag: '🇸🇪' },
  { code: 'US', dial: '+1', country: 'United States', flag: '🇺🇸' },
  { code: 'CA', dial: '+1', country: 'Canada', flag: '🇨🇦' },
  { code: 'AE', dial: '+971', country: 'United Arab Emirates', flag: '🇦🇪' },
  { code: 'SA', dial: '+966', country: 'Saudi Arabia', flag: '🇸🇦' },
  { code: 'RU', dial: '+7', country: 'Russia', flag: '🇷🇺' },
  { code: 'UA', dial: '+380', country: 'Ukraine', flag: '🇺🇦' },
];

/**
 * Standard Terms and Cancellation Text for Modal Review
 */
export const BOOKING_LEGAL_TERMS = {
  title: 'Terms of Service & Cancellation Policy',
  lastUpdated: 'September 2026',
  sections: [
    {
      heading: '1. Booking & Voucher Confirmation',
      text: 'Upon completing your reservation, you will receive an official booking confirmation voucher containing your unique reference code, selected departure time, and hotel pickup instructions. In Pay at Pickup mode, no upfront charges are deducted.',
    },
    {
      heading: '2. Free Cancellation & Refund Guarantee',
      text: 'You may cancel or reschedule your booking free of charge up to 24 hours prior to the scheduled hotel pickup time. If cancellation is requested with at least 24 hours notice, no penalties apply. In the rare event of maritime port closure by the Egyptian Coast Guard due to unfavorable weather, a 100% full refund or free rescheduling is guaranteed.',
    },
    {
      heading: '3. Hotel Pickup & Maritime Regulations',
      text: 'Guests must wait in their hotel main reception lobby 10 minutes prior to the pickup window. The operations desk coordinates driver arrival via WhatsApp or phone. Please carry official identification (passport or hotel identity voucher) as mandated by maritime coast guard regulations.',
    },
    {
      heading: '4. Marine Park Conservation',
      text: 'All guests are requested to respect marine sanctuaries: touching or stepping on live coral reefs, taking shells or marine specimens, and discarding plastics are strictly prohibited by Egyptian National Park environmental laws.',
    },
  ],
};
