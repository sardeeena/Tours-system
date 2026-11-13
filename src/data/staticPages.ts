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
    title: 'About Awesome Adventure Tours',
    slug: 'about',
    heroHeadline: 'Explore Egypt’s Red Sea Coast with Awesome Adventure Tours',
    heroSubtitle: 'Discover the excursions and experiences currently listed on Awesome Adventure Tours. Each tour page provides its own description and booking information.',
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
    title: 'Contact Awesome Adventure Tours',
    slug: 'contact',
    heroHeadline: 'Contact Awesome Adventure Tours',
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
    title: 'Why Choose Awesome Adventure Tours',
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
    title: 'Privacy Policy',
    slug: 'privacy',
    heroHeadline: 'Your Privacy Matters',
    heroSubtitle: 'How Awesome Adventure Tours collects, uses, protects and shares information when you browse, contact us or make a reservation.',
    lastUpdated: '2026-11-13',
    seoIndexable: true,
    seoTitle: 'Privacy Policy | Awesome Adventure Tours',
    seoDescription: 'Read how Awesome Adventure Tours handles booking, contact, account and website information, including service providers, analytics choices and your privacy rights.',
    sections: [
      { title: '1. Who we are and how to contact us', content: 'This website is operated under the name Awesome Adventure Tours from Hurghada, Red Sea, Egypt. Our contact location is Hurghada New Marina, Berth B-14, Red Sea, Egypt. For privacy questions or requests, contact us through https://awesomeadventure.tours/contact or call +20 151 5212741. Please include enough information for us to locate your request, but do not send passwords or full payment-card details. This notice describes the website and booking services; it is not a substitute for advice on the laws that apply to a particular traveller or transaction.' },
      { title: '2. Information we may collect', content: 'Depending on how you use the website, we may process: contact and identity details such as name, email address, telephone number and country; reservation details such as selected excursion, date, party size, ages, selected tour language, booking reference, pickup or meeting-point details and special requests; account information needed to register, sign in and manage a profile; messages and support requests you send us; newsletter subscription details and subscription status; and technical information such as browser and device information, preferred browser languages and locale, timezone, screen/viewport categories, pages requested, timestamps, security events and consent preferences. If you enable optional analytics, we may also use your connection IP transiently with IPWhois.io to estimate your country, region and city; we do not store the raw IP address in visitor analytics records. Do not provide sensitive personal information unless it is genuinely needed for a request and you choose to share it.' },
      { title: '3. Why we use information', content: 'We use information to respond to enquiries; check availability and prepare, administer and communicate reservations; provide booking confirmations, vouchers, service updates and customer support; coordinate the relevant excursion, transfer or activity with the supplier responsible for delivering it; manage accounts and protect sign-in and booking services; maintain records, prevent fraud and misuse, resolve disputes and meet legal obligations; and, where you have chosen to receive them, send newsletters or promotional communications. We rely as applicable on steps requested before a contract, performance of a booking, legitimate interests such as service security and customer support, legal obligations, and consent where required (including optional analytics or marketing technologies).' },
      { title: '4. Who may receive information', content: 'We share only information reasonably needed for the relevant purpose. This can include the excursion operator, boat or activity provider, transfer or pickup provider and other suppliers involved in fulfilling your reservation; our website hosting, database, authentication, storage and email-delivery providers (including Hostinger, Supabase and Resend where used); analytics or tag-management providers only in accordance with your cookie choices and applicable settings; IPWhois.io, only when you have enabled analytics, to return an approximate country/region/city estimate from your connection IP (the IP is sent transiently for lookup and is not retained in our visitor analytics database); and public authorities, regulators, courts or professional advisers where disclosure is required or reasonably necessary to protect rights, safety or the service. Suppliers may process information under their own privacy notices when they provide their own service.' },
      { title: '5. International processing', content: 'Some technology and operational suppliers may process or store information in countries outside Egypt, including countries where their infrastructure or support teams operate. Where applicable law requires safeguards for an international transfer, we will use an appropriate transfer mechanism or other legally recognised protection. Contact us if you need more information about a particular service provider or transfer.' },
      { title: '6. Retention and security', content: 'We keep information for as long as reasonably necessary for the purposes described above, including to complete a booking, provide support, maintain accounting and operational records, address complaints and meet legal requirements. Retention periods vary by record type and legal obligation. We use access controls and technical and organisational measures intended to protect information, but no website or electronic transmission can be guaranteed completely secure. Please use a unique password and do not share your account credentials.' },
      { title: '7. Your choices and privacy rights', content: 'Depending on the law that applies to you, you may be entitled to request access to, correction or deletion of personal information, object to or restrict certain processing, withdraw consent, or receive a copy of information you provided. You can unsubscribe from marketing messages using the unsubscribe mechanism where provided; service and booking messages may still be sent when necessary. You can change optional cookie choices using Cookie Settings in the website footer. To make a privacy request, contact us using the details in section 1. We may need to verify your identity and may retain information where the law permits or requires it.' },
      { title: '8. Children and third-party websites', content: 'The website is intended for people arranging travel and reservations. A parent or responsible adult should provide booking details for children where required and should not create an account for a child without appropriate authority. Our website may link to third-party websites or messaging services. We do not control their content or privacy practices; review their notices before using them.' },
      { title: '9. Changes to this notice', content: 'We may update this policy when our services, technology or legal requirements change. The date above shows when this version was last updated. Material changes will be reflected on this page.' },
    ],
  },
  {
    id: 'terms',
    title: 'Terms & Conditions',
    slug: 'terms',
    heroHeadline: 'Website & Booking Terms',
    heroSubtitle: 'Please read these terms before using the website or submitting an excursion reservation.',
    lastUpdated: '2026-11-12',
    seoIndexable: true,
    seoTitle: 'Terms & Conditions | Awesome Adventure Tours',
    seoDescription: 'Review the website use, excursion reservations, prices, supplier responsibilities, safety, changes and governing terms for Awesome Adventure Tours.',
    sections: [
      { title: '1. About these terms', content: 'These terms apply to your use of awesomeadventure.tours and to reservation requests submitted through it. The website is operated under the name Awesome Adventure Tours from Hurghada, Egypt. Individual excursions may be delivered by independent boat, transport, activity or destination suppliers. The specific supplier and service details shown for a trip form part of the information you should review before booking.' },
      { title: '2. Website information and availability', content: 'We take reasonable care to keep tour descriptions, images, schedules, prices, inclusions, pickup details and availability information useful and current. Details can change because of supplier operations, weather, seasonal schedules or availability. A listing is not a guarantee that a departure will operate until your reservation is confirmed. If an important detail appears incorrect, contact us before relying on it.' },
      { title: '3. Reservations and confirmation', content: 'When you submit a booking form, you are asking us to arrange the selected excursion using the details you provide. A request is not a confirmed reservation until the website or our team issues a booking confirmation or voucher. You are responsible for checking the date, excursion, guest numbers and ages, tour language, pickup information, contact details, price and any special conditions. Keep your booking reference and confirmation.' },
      { title: '4. Prices, currency and payment', content: 'The price and currency shown during the booking process for the selected excursion are the relevant quoted amounts, subject to any clearly disclosed supplements or changes confirmed before the booking is accepted. Currency conversion displays are indicative and your bank or payment provider may apply its own rate or fees. Payment arrangements can vary by excursion and will be shown during booking or in your confirmation. Never send card numbers, security codes or passwords through ordinary email, chat or booking notes.' },
      { title: '5. Tour language, participants and pickup', content: 'Tour-guide languages, minimum booking notice, age limits, pickup zones, meeting points and transfer supplements vary by excursion and date. A language option is a request for the selected tour; it is subject to the availability stated for that departure. Provide accurate participant and pickup details and contact us promptly if they change. Arrive at the confirmed meeting point on time and follow the supplier’s instructions.' },
      { title: '6. Safety and conduct', content: 'You must follow reasonable safety instructions from the crew, guide, driver and activity staff, comply with local laws and respect other participants and the environment. Tell the relevant operator in advance about any condition or mobility requirement that may affect safe participation. The operator may refuse or stop participation where a person’s conduct or condition creates a safety risk, subject to applicable law and the circumstances.' },
      { title: '7. Changes, weather and supplier operations', content: 'Excursions may be delayed, rerouted, substituted or cancelled because of weather, sea state, port or authority restrictions, safety concerns, supplier availability or events beyond reasonable control. We or the relevant supplier will communicate material changes when practicable. Where the operator cancels a departure, the available rescheduling or refund arrangement will be explained for that booking. See the Cancellation & Refund Policy for more detail.' },
      { title: '8. Cancellation and refunds', content: 'Cancellation deadlines and refund eligibility are not identical for every excursion. The cancellation terms shown on the selected tour page, at checkout and in your confirmation apply to that reservation and take precedence over general examples on the website. See https://awesomeadventure.tours/cancellation-policy before booking.' },
      { title: '9. Liability and mandatory rights', content: 'Nothing in these terms excludes or limits liability where doing so would be unlawful, including rights or remedies that cannot be waived under applicable consumer-protection law. To the extent permitted by law, responsibility for the actual operation and on-the-day delivery of an excursion rests with the supplier providing that service. We remain responsible for our own obligations as required by applicable law.' },
      { title: '10. Website use, intellectual property and security', content: 'You may use the website for lawful personal travel planning and reservations. Do not misuse the site, interfere with its security, attempt unauthorised access, submit false information, scrape or copy content at scale, or upload malicious material. Website text, branding, design and media are protected by applicable intellectual-property laws unless otherwise stated.' },
      { title: '11. Governing law and contact', content: 'These terms are intended to be interpreted under the laws of Egypt, without removing any mandatory consumer protections that apply to you under the law of your country of residence. Any dispute will be handled by a competent forum as required by applicable law. Contact us through https://awesomeadventure.tours/contact or +20 151 5212741. If a provision is unenforceable, the remaining provisions continue to apply to the extent permitted by law.' },
    ],
  },
  {
    id: 'cancellation-policy',
    title: 'Cancellation & Refund Policy',
    slug: 'cancellation-policy',
    heroHeadline: 'Cancellation & Refunds',
    heroSubtitle: 'Cancellation and refund terms depend on the excursion and are confirmed in your booking details.',
    lastUpdated: '2026-11-12',
    seoIndexable: true,
    seoTitle: 'Cancellation & Refund Policy | Awesome Adventure Tours',
    seoDescription: 'Understand how to request a cancellation, how tour-specific deadlines apply, and what happens when weather or operational restrictions prevent a departure.',
    sections: [
      { title: '1. The policy shown for your excursion applies', content: 'Different excursions and suppliers may have different cancellation windows and refund conditions. Before paying or submitting a reservation, read the cancellation information displayed on the selected tour page, during checkout and in the booking confirmation or voucher. Those trip-specific terms govern your reservation where they differ from this general policy.' },
      { title: '2. Free cancellation windows', content: 'Some excursions may offer free cancellation up to 24 hours before the scheduled start. This is not a universal promise for every tour: the 24-hour window applies only when it is expressly shown for your selected excursion or confirmed in your voucher. If your booking has a different deadline, fee or non-refundable condition, that specific condition applies, subject to mandatory legal rights.' },
      { title: '3. How to request a cancellation or change', content: 'Contact our team as soon as possible using https://awesomeadventure.tours/contact or call +20 151 5212741. Provide your booking reference, the lead traveller’s name and the excursion date. A cancellation is not complete merely because you sent a message; wait for our acknowledgement or written confirmation. Requests received close to departure may not be processed before the supplier’s deadline, so do not delay.' },
      { title: '4. Late arrival and no-shows', content: 'If you miss the pickup or departure, arrive after the confirmed meeting time, or do not attend, the supplier may treat the reservation as a no-show and the booking may be non-refundable under its stated terms. Contact us immediately if an unexpected delay occurs. Any exception is subject to the supplier’s decision and applicable law.' },
      { title: '5. Weather, safety and operator cancellations', content: 'Boat trips and outdoor activities can be affected by weather, sea conditions, port closures, authority instructions or safety decisions. If the responsible operator cancels or cannot safely provide the booked departure, we will contact affected guests about the available options for that reservation. Depending on the circumstances and the applicable booking terms, this may include an alternative date, a suitable replacement or a refund. We will not ask guests to proceed with an activity that the responsible operator considers unsafe.' },
      { title: '6. Refund method and timing', content: 'Where a refund is due, the amount and method will be confirmed with you. Refunds are normally arranged through the original payment route where that route supports a refund; where payment was arranged directly with a supplier or collected at pickup, the team will explain the applicable process. Banks and payment providers may take additional time to post a refund. We do not promise a fixed processing time where it depends on a third party.' },
      { title: '7. Changes made by the traveller', content: 'Date, guest-count, pickup or tour-language changes are subject to availability and supplier approval. A requested change may be treated as a cancellation and new reservation if the supplier cannot amend the original booking. Any price difference or fee will be explained before the change is confirmed.' },
      { title: '8. Questions and disputes', content: 'Keep your booking confirmation and any cancellation correspondence. If you believe a cancellation or refund was handled incorrectly, contact us with the booking reference and a clear description of the issue so we can review it with the relevant supplier. Nothing in this policy limits consumer rights that cannot legally be excluded.' },
    ],
  },
  {
    id: 'cookie-policy',
    title: 'Cookie & Website Storage Policy',
    slug: 'cookie-policy',
    heroHeadline: 'Cookies & Your Choices',
    heroSubtitle: 'Learn how this website uses browser storage and optional analytics technologies, and how to change your choices.',
    lastUpdated: '2026-11-13',
    seoIndexable: true,
    seoTitle: 'Cookie Policy | Awesome Adventure Tours',
    seoDescription: 'Learn about essential website storage, Google Tag Manager analytics and marketing consent, and how to change cookie preferences on Awesome Adventure Tours.',
    sections: [
      { title: '1. Cookies and similar technologies', content: 'Cookies are small files stored by a website in your browser. Websites may also use local storage, session storage, pixels and scripts for similar purposes. This site uses browser storage for essential functions and preferences. The website also has Google Tag Manager installed; optional analytics or advertising tags are held back until you make an optional-consent choice through the cookie banner. When you enable analytics, the server also sends your connection IP transiently to IPWhois.io to estimate country, region and city; the IP itself is not stored in our visitor analytics records.' },
      { title: '2. Essential storage', content: 'Essential storage supports the website you ask to use. Depending on the features you use, this may include remembering your language and light/dark theme, retaining a booking draft or temporary interface preferences, maintaining authentication/session state through our authentication provider, and saving your cookie-consent choice. These functions are not used to create advertising profiles. If you block all browser storage, some account, booking or preference features may not work correctly.' },
      { title: '3. Analytics and marketing choices', content: 'Analytics technologies help us understand site usage and improve navigation and booking journeys. Marketing technologies, if enabled in our tag-management configuration, may measure or personalise promotional activity. These optional categories are disabled by default. Google Tag Manager is loaded only after you choose analytics or marketing consent; the consent signals sent to Google distinguish analytics from advertising choices. Individual tags in the tag manager must also be configured to respect the corresponding consent category.' },
      { title: '4. Third-party services', content: 'When enabled or used, third-party services may set or access their own technologies under their own policies. These can include Google services delivered through our tag manager, Supabase for authentication and application data, IPWhois.io for approximate IP-derived location when analytics consent is enabled, and external services or content you choose to open, such as WhatsApp. Loading external images, fonts or links may also cause your browser to contact the relevant provider. Review the provider’s own privacy and cookie information for details.' },
      { title: '5. Managing and withdrawing consent', content: 'On your first visit, choose Accept all, Reject optional or Customise in the cookie banner. Necessary storage is always active because the website cannot provide core functions without it. You can reopen the controls at any time using Cookie Settings in the website footer and change analytics or marketing choices. A change updates the consent signals used by the site for future tag activity. If a third party has already stored a cookie, you may also need to clear it through your browser settings.' },
      { title: '6. Browser controls and retention', content: 'Most browsers let you view, block or delete cookies and clear site data. The cookie-choice record is stored in this browser so the site can remember your decision; clearing site data or using another browser/device may cause the banner to appear again. Preference and application storage may remain until you clear it or the application replaces it. Third-party cookie lifetimes are controlled by the relevant provider.' },
      { title: '7. Updates and contact', content: 'We may update this policy when website features or providers change. For questions about cookies or your choices, contact us through https://awesomeadventure.tours/contact or call +20 151 5212741. See our Privacy Policy for broader information about personal data.' },
    ],
  },
];
