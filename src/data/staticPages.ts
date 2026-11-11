export interface StaticPageContent {
  id: string;
  title: string;
  slug: string;
  heroHeadline: string;
  heroSubtitle: string;
  lastUpdated: string;
  sections: Array<{
    title: string;
    content: string;
  }>;
  seoTitle?: string;
  seoDescription?: string;
  seoIndexable?: boolean;
}

/**
 * Conservative public fallbacks used only when the CMS has no published page
 * content. Operational, legal, certification and safety claims must be supplied
 * and verified by the business before they are published.
 */
export const INITIAL_STATIC_PAGES: StaticPageContent[] = [
  {
    id: 'about',
    title: 'About Kemet Spirit',
    slug: 'about',
    heroHeadline: 'Explore Egypt’s Red Sea Coast with Kemet Spirit',
    heroSubtitle: 'Discover the excursions and experiences currently listed on Kemet Spirit. Each tour page provides its own description and booking information.',
    lastUpdated: '2026-11-11',
    seoIndexable: true,
    sections: [
      {
        title: 'Explore the available experiences',
        content: 'Browse the published excursion catalogue to compare destinations, activities and trip details across Egypt’s Red Sea coast.',
      },
      {
        title: 'Review each tour before booking',
        content: 'Tour pages provide the information available for each experience, including its description, price, duration, inclusions and pickup arrangements where applicable.',
      },
    ],
  },
  {
    id: 'contact',
    title: 'Contact Kemet Spirit',
    slug: 'contact',
    heroHeadline: 'Contact Kemet Spirit',
    heroSubtitle: 'Speak with our Hurghada support team about published excursions, pickup information and reservations.',
    lastUpdated: '2026-11-12',
    seoIndexable: true,
    sections: [
      {
        title: 'Phone support',
        content: '+20 151 5212741',
      },
      {
        title: 'Hurghada office',
        content: 'Hurghada New Marina, Berth B-14, Red Sea, Egypt.',
      },
      {
        title: 'Before you book',
        content: 'Check the selected excursion page for its current price, availability, pickup arrangements and booking conditions.',
      },
    ],
  },
  {
    id: 'why-us',
    title: 'Why Choose Kemet Spirit',
    slug: 'why-us',
    heroHeadline: 'Plan Your Red Sea Experience',
    heroSubtitle: 'Use the published tour information to compare available experiences and choose the trip that suits your plans.',
    lastUpdated: '2026-11-11',
    seoIndexable: false,
    sections: [
      {
        title: 'Tour information in one place',
        content: 'Review each excursion’s description, price, duration, itinerary and included items before you make a reservation.',
      },
      {
        title: 'Check the details that matter',
        content: 'Pickup options, age requirements, availability and cancellation conditions can differ by excursion. Check the relevant tour page and booking details before confirming.',
      },
    ],
  },
  {
    id: 'marine-safety',
    title: 'Marine Safety & Departure Information',
    slug: 'marine-safety',
    heroHeadline: 'Safety and Departure Information',
    heroSubtitle: 'Marine excursions can be affected by weather, sea conditions and operational restrictions. Review the information provided for your selected trip.',
    lastUpdated: '2026-11-11',
    seoIndexable: false,
    sections: [
      {
        title: 'Before departure',
        content: 'Read the selected excursion’s departure instructions, passenger requirements and equipment information. Follow the instructions provided by the crew and activity staff during the experience.',
      },
      {
        title: 'Weather and operational changes',
        content: 'Marine activities may be changed, delayed or cancelled when conditions do not permit a safe departure. Check the booking terms supplied for your specific excursion for the applicable arrangements.',
      },
    ],
  },
  {
    id: 'booking-conditions',
    title: 'Booking Terms & Conditions',
    slug: 'booking-conditions',
    heroHeadline: 'Booking Information',
    heroSubtitle: 'Review the details and conditions that apply to your selected excursion before completing a reservation.',
    lastUpdated: '2026-11-11',
    seoIndexable: false,
    sections: [
      {
        title: 'Reservations and confirmation',
        content: 'Check the selected date, number of guests, price, pickup information and other booking details before submitting your reservation. Keep the confirmation information provided after booking.',
      },
      {
        title: 'Pickup and departure',
        content: 'Pickup availability, meeting points, supplements and departure times may vary by excursion and location. Review the details shown for your selected trip before confirming.',
      },
      {
        title: 'Changes and cancellations',
        content: 'Cancellation periods, refund arrangements and rescheduling conditions are specific to the booking terms shown for the selected excursion. Review those terms before completing your reservation.',
      },
    ],
  },
  {
    id: 'privacy',
    title: 'Privacy Information',
    slug: 'privacy',
    heroHeadline: 'Privacy Information',
    heroSubtitle: 'This page requires confirmation of Kemet Spirit’s actual data handling practices before it can serve as a complete privacy policy.',
    lastUpdated: '2026-11-11',
    seoIndexable: false,
    sections: [
      {
        title: 'Policy information under review',
        content: 'The privacy details on this website are being reviewed. Do not rely on this placeholder as a complete description of how personal information is collected, used, shared or retained.',
      },
      {
        title: 'Before submitting personal information',
        content: 'For questions about information requested during a booking, use the current contact channels shown on the website and ask for the applicable privacy information before submitting details.',
      },
    ],
  },
];
