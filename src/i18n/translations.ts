import { LanguageCode } from '../types/i18n';

export const TRANSLATIONS: Partial<Record<LanguageCode, Record<string, string>>> = {
  en: {
    // Header Top Bar
    'top.licensed': 'Licensed Egyptian Tour Operator #2491/ETB',
    'top.cancellation': 'Cancellation terms vary by excursion; check before booking',
    'top.pierDesk': 'Support',
    'top.language': 'Language',
    'top.currency': 'Currency',

    // Main Navigation
    'nav.allExcursions': 'Excursions',
    'nav.destinations': 'Destinations',
    'nav.experiences': 'Experiences',
    'nav.whyChooseUs': 'About Us',
    'nav.guestReviews': 'Reviews',
    'nav.findMyBooking': 'My Booking',
    'nav.explore': 'View Tours',
    'nav.bookExcursion': 'Book Now',
    'nav.brandSubtitle': 'Hurghada & Red Sea Tours',

    // Mobile Menu
    'mobile.popularTours': 'Popular Tours & Island Trips',
    'mobile.destinationsDetailed': 'Destinations (Hurghada, El Gouna, Marsa Alam)',
    'mobile.categories': 'Tour Categories',
    'mobile.safety': 'Safety & Guarantees',
    'mobile.reviews': 'Customer Reviews',
    'mobile.findBookingSubtitle': 'My Booking (View & Cancel)',
    'mobile.contactWhatsApp': 'Contact us on WhatsApp',
    'mobile.selectLanguage': 'Select Language',

    // Hero Section
    'hero.badge': 'Direct Tour Operator in Hurghada & El Gouna',
    'hero.guestsHosted': 'Daily Verified Departures',
    'hero.title1': 'Explore the Red Sea',
    'hero.title2': 'with Local Captains',
    'hero.subtitle':
      'Explore snorkeling boat trips, island visits, and desert quad safaris from Hurghada and nearby Red Sea destinations. Check each excursion for departure days, pickup options, and availability.',
    'hero.guarantee1': 'Weather terms explained for each excursion',
    'hero.guarantee2': 'Cancellation terms shown before booking',
    'hero.guarantee3': 'Pickup options vary by excursion',
    'hero.guarantee4': 'Local crews and guides on selected tours',

    // Search Module
    'search.destination': 'Destination',
    'search.allDestinations': 'All Destinations',
    'search.activity': 'Experience',
    'search.allActivities': 'All Activities',
    'search.date': 'Choose your date',
    'search.guests': 'Guests',
    'search.submit': 'Find Tours',
    'search.adults': 'Adults',
    'search.children': 'Children',
    'search.ageAdult': 'Age 12+',
    'search.ageChild': 'Ages 4-11',

    // Popular Tours Section
    'popular.title': 'Popular Tours in the Red Sea',
    'popular.subtitle':
      'Inclusions, pickup coverage, equipment, and marine park fees are listed on each excursion page.',
    'popular.viewAll': 'View All Tours',
    'popular.quickBook': 'Book Now',
    'popular.viewDetails': 'View Tour',
    'popular.from': 'From',
    'popular.perPerson': 'per person',
    'popular.instantConfirmation': 'Instant Confirmation',
    'popular.verified': 'Official Operator',

    // Why Choose Us
    'why.title': 'Why Book Directly With Us',
    'why.subtitle':
      'We work with local activity providers, experienced skippers, and guides. The operating provider and included services are identified for each excursion.',

    // Final CTA
    'cta.title': 'Ready to explore the Red Sea?',
    'cta.subtitle':
      'Book online and review the selected excursion’s cancellation terms and payment options before confirming. Pickup, when available, depends on the tour and hotel area.',
    'cta.browse': 'View All Tours',
    'cta.chat': 'Chat on WhatsApp',
    'cta.lookup': 'Find My Booking',

    // WhatsApp Floating Widget
    'whatsapp.concierge': 'Tour Support Desk',
    'whatsapp.online': 'Online Now · Direct WhatsApp',
    'whatsapp.replies': 'Quick reply',
    'whatsapp.greeting': 'Hello! 🌊 Have questions about tour availability, pickups, or private boat trips?',
    'whatsapp.instruction': 'Choose a topic below or send us a message directly on WhatsApp.',
    'whatsapp.quickInquiries': 'Quick Inquiries',
    'whatsapp.customQuestion': 'Your Question',
    'whatsapp.placeholder': 'e.g. Can we book 6 guests for Orange Bay this Thursday?',
    'whatsapp.openButton': 'Open in WhatsApp',
    'whatsapp.needHelp': 'Need help? Chat with us on WhatsApp',
    'whatsapp.presetAvailability': '🚤 Tour availability: Any spots tomorrow?',
    'whatsapp.presetPickup': '🚐 Hotel pickup: What is the pickup time for my hotel?',
    'whatsapp.presetPrivate': '🛥️ Private boat: Price quote for family or group',
    'whatsapp.presetBooking': '🎟️ Existing booking: Need help with my reservation',

    // Footer
    'footer.companyDesc': 'Hurghada-based tour operator offering Red Sea boat trips, island excursions, snorkeling, and desert experiences. Check each excursion for its operator and included services.',
    'footer.destinations': 'Destinations',
    'footer.experiences': 'Experiences',
    'footer.customerCare': 'Customer Support',
    'footer.hurghadaDesk': 'Hurghada Office',
    'footer.allRights': 'All rights reserved.',

    // PWA & Mobile Install
    'pwa.installApp': 'Install App',
    'pwa.saveToPhone': 'Save to Phone',
    'pwa.installSubtitle': 'Fast offline access to tour vouchers & bookings',
  },

  fr: {
    "top.licensed": "Opérateur touristique égyptien agréé n° 2491/ETB",
    "top.cancellation": "Les conditions d’annulation varient selon l’excursion ; vérifiez-les avant de réserver.",
    "top.pierDesk": "Assistance",
    "top.language": "Langue",
    "top.currency": "Devise",
    "nav.allExcursions": "Excursions",
    "nav.destinations": "Destinations",
    "nav.experiences": "Expériences",
    "nav.whyChooseUs": "À propos",
    "nav.guestReviews": "Avis",
    "nav.findMyBooking": "Ma réservation",
    "nav.explore": "Voir les excursions",
    "nav.bookExcursion": "Réserver",
    "nav.brandSubtitle": "Excursions à Hurghada et en mer Rouge",
    "mobile.popularTours": "Excursions populaires et sorties sur les îles",
    "mobile.destinationsDetailed": "Destinations (Hurghada, El Gouna, Marsa Alam)",
    "mobile.categories": "Catégories d’excursions",
    "mobile.safety": "Sécurité et garanties",
    "mobile.reviews": "Avis des clients",
    "mobile.findBookingSubtitle": "Ma réservation (consulter et annuler)",
    "mobile.contactWhatsApp": "Contactez-nous sur WhatsApp",
    "mobile.selectLanguage": "Choisir la langue",
    "hero.badge": "Opérateur local à Hurghada et El Gouna",
    "hero.guestsHosted": "Départs vérifiés chaque jour",
    "hero.title1": "Explorez la mer Rouge",
    "hero.title2": "avec des capitaines locaux",
    "hero.subtitle": "Excursions en bateau avec snorkeling, visites d’îles et safaris en quad dans le désert, au départ quotidien de Hurghada, El Gouna et Makadi Bay. Opérateur local direct, prise en charge à l’hôtel et tarifs transparents.",
    "hero.guarantee1": "Conditions météo précisées pour chaque excursion",
    "hero.guarantee2": "Conditions d’annulation affichées avant la réservation",
    "hero.guarantee3": "Prise en charge selon l’excursion",
    "hero.guarantee4": "Équipes et guides locaux sur certaines excursions",
    "search.destination": "Destination",
    "search.allDestinations": "Toutes les destinations",
    "search.activity": "Activité",
    "search.allActivities": "Toutes les activités",
    "search.date": "Choisissez votre date",
    "search.guests": "Voyageurs",
    "search.submit": "Rechercher des excursions",
    "search.adults": "Adultes",
    "search.children": "Enfants",
    "search.ageAdult": "12 ans et plus",
    "search.ageChild": "De 4 à 11 ans",
    "popular.title": "Excursions populaires en mer Rouge",
    "popular.subtitle": "Toutes les excursions comprennent la prise en charge à l’hôtel, l’équipement de snorkeling et les frais obligatoires du parc marin.",
    "popular.viewAll": "Voir toutes les excursions",
    "popular.quickBook": "Réserver",
    "popular.viewDetails": "Voir l’excursion",
    "popular.from": "À partir de",
    "popular.perPerson": "par personne",
    "popular.instantConfirmation": "Confirmation immédiate",
    "popular.verified": "Opérateur officiel",
    "why.title": "Pourquoi réserver directement avec nous ?",
    "why.subtitle": "Nous exploitons nos propres bateaux et véhicules avec des capitaines certifiés et des guides locaux accueillants. Vous bénéficiez de tarifs d’opérateur local, sans majoration d’agence.",
    "cta.title": "Prêt à explorer la mer Rouge ?",
    "cta.subtitle": "Réservez en ligne dès maintenant avec annulation gratuite. Vous pouvez choisir de payer au moment de la prise en charge à votre hôtel.",
    "cta.browse": "Voir toutes les excursions",
    "cta.chat": "Discuter sur WhatsApp",
    "cta.lookup": "Retrouver ma réservation",
    "whatsapp.concierge": "Service d’assistance excursions",
    "whatsapp.online": "En ligne · WhatsApp direct",
    "whatsapp.replies": "Réponse rapide",
    "whatsapp.greeting": "Bonjour ! 🌊 Vous avez des questions sur les disponibilités, les transferts ou les sorties en bateau privé ?",
    "whatsapp.instruction": "Choisissez un sujet ci-dessous ou envoyez-nous directement un message sur WhatsApp.",
    "whatsapp.quickInquiries": "Demandes rapides",
    "whatsapp.customQuestion": "Votre question",
    "whatsapp.placeholder": "Ex. : Peut-on réserver pour 6 personnes à Orange Bay ce jeudi ?",
    "whatsapp.openButton": "Ouvrir WhatsApp",
    "whatsapp.needHelp": "Besoin d’aide ? Contactez-nous sur WhatsApp",
    "whatsapp.presetAvailability": "🚤 Disponibilités : reste-t-il des places pour demain ?",
    "whatsapp.presetPickup": "🚐 Transfert hôtel : à quelle heure viendra-t-on me chercher à mon hôtel ?",
    "whatsapp.presetPrivate": "🛥️ Bateau privé : demande de tarif pour une famille ou un groupe",
    "whatsapp.presetBooking": "🎟️ Réservation existante : j’ai besoin d’aide concernant ma réservation",
    "footer.companyDesc": "Organisateur d’excursions basé à Hurghada, proposant des sorties en bateau en mer Rouge, des visites d’îles, du snorkeling et des expériences dans le désert. Consultez chaque excursion pour connaître l’opérateur et les prestations incluses.",
    "footer.destinations": "Destinations",
    "footer.experiences": "Expériences",
    "footer.customerCare": "Service client",
    "footer.hurghadaDesk": "Bureau de Hurghada",
    "footer.allRights": "Tous droits réservés.",
    "pwa.installApp": "Installer l’application",
    "pwa.saveToPhone": "Enregistrer sur le téléphone",
    "pwa.installSubtitle": "Accédez rapidement hors ligne à vos bons d’excursion et réservations",
  },

  nl: {
    "top.licensed": "Erkende Egyptische touroperator #2491/ETB",
    "top.cancellation": "Annuleringsvoorwaarden verschillen per excursie; controleer ze vóór het boeken.",
    "top.pierDesk": "Klantenservice",
    "top.language": "Taal",
    "top.currency": "Valuta",
    "nav.allExcursions": "Excursies",
    "nav.destinations": "Bestemmingen",
    "nav.experiences": "Ervaringen",
    "nav.whyChooseUs": "Over ons",
    "nav.guestReviews": "Beoordelingen",
    "nav.findMyBooking": "Mijn boeking",
    "nav.explore": "Bekijk tours",
    "nav.bookExcursion": "Boek nu",
    "nav.brandSubtitle": "Excursies in Hurghada en aan de Rode Zee",
    "mobile.popularTours": "Populaire tours en eilandtrips",
    "mobile.destinationsDetailed": "Bestemmingen (Hurghada, El Gouna, Marsa Alam)",
    "mobile.categories": "Tourcategorieën",
    "mobile.safety": "Veiligheid en garanties",
    "mobile.reviews": "Klantbeoordelingen",
    "mobile.findBookingSubtitle": "Mijn boeking (bekijken en annuleren)",
    "mobile.contactWhatsApp": "Neem contact met ons op via WhatsApp",
    "mobile.selectLanguage": "Selecteer taal",
    "hero.badge": "Rechtstreekse touroperator in Hurghada en El Gouna",
    "hero.guestsHosted": "Dagelijks gecontroleerde vertrekken",
    "hero.title1": "Ontdek de Rode Zee",
    "hero.title2": "met lokale kapiteins",
    "hero.subtitle": "Snorkelboottochten, eilandbezoeken en quadsafari’s in de woestijn, dagelijks vertrekkend vanuit Hurghada, El Gouna en Makadi Bay. Rechtstreekse lokale aanbieder met hoteltransfer en transparante prijzen.",
    "hero.guarantee1": "Weersvoorwaarden per excursie vermeld",
    "hero.guarantee2": "Annuleringsvoorwaarden vóór het boeken zichtbaar",
    "hero.guarantee3": "Ophaalopties verschillen per excursie",
    "hero.guarantee4": "Lokale teams en gidsen bij geselecteerde excursies",
    "search.destination": "Bestemming",
    "search.allDestinations": "Alle bestemmingen",
    "search.activity": "Ervaring",
    "search.allActivities": "Alle activiteiten",
    "search.date": "Kies je datum",
    "search.guests": "Gasten",
    "search.submit": "Tours zoeken",
    "search.adults": "Volwassenen",
    "search.children": "Kinderen",
    "search.ageAdult": "12 jaar en ouder",
    "search.ageChild": "4–11 jaar",
    "popular.title": "Populaire tours aan de Rode Zee",
    "popular.subtitle": "Alle tours zijn inclusief hoteltransfer, snorkeluitrusting en verplichte kosten voor het marinepark.",
    "popular.viewAll": "Bekijk alle tours",
    "popular.quickBook": "Boek nu",
    "popular.viewDetails": "Bekijk tour",
    "popular.from": "Vanaf",
    "popular.perPerson": "per persoon",
    "popular.instantConfirmation": "Directe bevestiging",
    "popular.verified": "Officiële aanbieder",
    "why.title": "Waarom rechtstreeks bij ons boeken?",
    "why.subtitle": "We beheren onze eigen boten en voertuigen met gecertificeerde kapiteins en vriendelijke lokale gidsen. Je betaalt lokale aanbiedersprijzen zonder toeslagen van tussenpersonen.",
    "cta.title": "Klaar om de Rode Zee te ontdekken?",
    "cta.subtitle": "Boek nu online met gratis annulering. Je kunt ervoor kiezen om te betalen wanneer we je bij je hotel ophalen.",
    "cta.browse": "Bekijk alle tours",
    "cta.chat": "Chat via WhatsApp",
    "cta.lookup": "Mijn boeking zoeken",
    "whatsapp.concierge": "Tourservice",
    "whatsapp.online": "Nu online · Rechtstreeks via WhatsApp",
    "whatsapp.replies": "Snel antwoord",
    "whatsapp.greeting": "Hallo! 🌊 Heb je vragen over beschikbaarheid, transfers of privéboottochten?",
    "whatsapp.instruction": "Kies hieronder een onderwerp of stuur ons rechtstreeks een bericht via WhatsApp.",
    "whatsapp.quickInquiries": "Snelle vragen",
    "whatsapp.customQuestion": "Je vraag",
    "whatsapp.placeholder": "Bijv.: Kunnen we deze donderdag voor 6 personen naar Orange Bay boeken?",
    "whatsapp.openButton": "Open WhatsApp",
    "whatsapp.needHelp": "Hulp nodig? Chat met ons via WhatsApp",
    "whatsapp.presetAvailability": "🚤 Beschikbaarheid: Zijn er morgen nog plaatsen?",
    "whatsapp.presetPickup": "🚐 Hoteltransfer: Hoe laat word ik bij mijn hotel opgehaald?",
    "whatsapp.presetPrivate": "🛥️ Privéboot: Prijsaanvraag voor familie of groep",
    "whatsapp.presetBooking": "🎟️ Bestaande boeking: Ik heb hulp nodig bij mijn reservering",
    "footer.companyDesc": "Touroperator gevestigd in Hurghada met boottochten op de Rode Zee, eilandexcursies, snorkelactiviteiten en woestijnervaringen. Bekijk per excursie wie de uitvoerder is en wat is inbegrepen.",
    "footer.destinations": "Bestemmingen",
    "footer.experiences": "Ervaringen",
    "footer.customerCare": "Klantenservice",
    "footer.hurghadaDesk": "Kantoor Hurghada",
    "footer.allRights": "Alle rechten voorbehouden.",
    "pwa.installApp": "App installeren",
    "pwa.saveToPhone": "Opslaan op telefoon",
    "pwa.installSubtitle": "Snelle offline toegang tot tourvouchers en boekingen",
  },

  de: {
    // Header Top Bar
    'top.licensed': 'Lizenzierter ägyptischer Reiseveranstalter #2491/ETB',
    'top.cancellation': 'Die Stornierungsbedingungen variieren je nach Ausflug; bitte vor der Buchung prüfen.',
    'top.pierDesk': 'Support',
    'top.language': 'Sprache',
    'top.currency': 'Währung',

    // Main Navigation
    'nav.allExcursions': 'Ausflüge',
    'nav.destinations': 'Reiseziele',
    'nav.experiences': 'Erlebnisse',
    'nav.whyChooseUs': 'Über uns',
    'nav.guestReviews': 'Bewertungen',
    'nav.findMyBooking': 'Meine Buchung',
    'nav.explore': 'Touren ansehen',
    'nav.bookExcursion': 'Jetzt buchen',
    'nav.brandSubtitle': 'Hurghada & Rotes Meer Ausflüge',

    // Mobile Menu
    'mobile.popularTours': 'Beliebte Touren & Inselfahrten',
    'mobile.destinationsDetailed': 'Reiseziele (Hurghada, El Gouna, Marsa Alam)',
    'mobile.categories': 'Erlebniskategorien',
    'mobile.safety': 'Sicherheits- & Garantiestandards',
    'mobile.reviews': 'Kundenbewertungen',
    'mobile.findBookingSubtitle': 'Meine Buchung (Einsehen & Stornieren)',
    'mobile.contactWhatsApp': 'Kontaktieren Sie uns auf WhatsApp',
    'mobile.selectLanguage': 'Sprache auswählen',

    // Hero Section
    'hero.badge': 'Direkter Bootsveranstalter in Hurghada & El Gouna',
    'hero.guestsHosted': 'Tägliche verifizierte Abfahrten',
    'hero.title1': 'Erkunden Sie das Rote Meer',
    'hero.title2': 'mit erfahrenen Kapitänen',
    'hero.subtitle':
      'Schnorchelausflüge, Inseltouren und Quad-Safaris mit täglicher Abfahrt von Hurghada, El Gouna und Makadi Bay. Direkter lokaler Anbieter mit Hotelabholung und fairen Preisen.',
    'hero.guarantee1': 'Wetterbedingungen je Ausflug erklärt',
    'hero.guarantee2': 'Stornierungsbedingungen vor der Buchung angezeigt',
    'hero.guarantee3': 'Abholoptionen je Ausflug unterschiedlich',
    'hero.guarantee4': 'Lokale Teams und Guides bei ausgewählten Touren',

    // Search Module
    'search.destination': 'Reiseziel',
    'search.allDestinations': 'Alle Reiseziele',
    'search.activity': 'Erlebnis',
    'search.allActivities': 'Alle Aktivitäten',
    'search.date': 'Datum wählen',
    'search.guests': 'Gäste',
    'search.submit': 'Ausflüge suchen',
    'search.adults': 'Erwachsene',
    'search.children': 'Kinder',
    'search.ageAdult': 'Ab 12 Jahren',
    'search.ageChild': '4-11 Jahre',

    // Popular Tours Section
    'popular.title': 'Beliebte Rote-Meer-Ausflüge',
    'popular.subtitle':
      'Alle Touren enthalten Hotelabholung, Schnorchelausrüstung und Nationalparkgebühren.',
    'popular.viewAll': 'Alle Ausflüge anzeigen',
    'popular.quickBook': 'Jetzt buchen',
    'popular.viewDetails': 'Tour ansehen',
    'popular.from': 'Ab',
    'popular.perPerson': 'pro Person',
    'popular.instantConfirmation': 'Sofortige Bestätigung',
    'popular.verified': 'Offizieller Veranstalter',

    // Why Choose Us
    'why.title': 'Warum direkt bei uns buchen?',
    'why.subtitle':
      'Wir besitzen unsere eigenen Boote und Fahrzeuge und beschäftigen erfahrene Kapitäne und Guides. Sie zahlen faire Preise ohne Vermittlergebühren.',

    // Final CTA
    'cta.title': 'Bereit für das Rote Meer?',
    'cta.subtitle':
      'Buchen Sie online mit kostenloser Stornierung. Sie können auch erst bequem bei der Abholung am Hotel bezahlen.',
    'cta.browse': 'Alle Ausflüge anzeigen',
    'cta.chat': 'Auf WhatsApp chatten',
    'cta.lookup': 'Meine Buchung finden',

    // WhatsApp Floating Widget
    'whatsapp.concierge': 'Tour-Kundenservice',
    'whatsapp.online': 'Jetzt online · Direkt WhatsApp',
    'whatsapp.replies': 'Schnelle Antwort',
    'whatsapp.greeting': 'Hallo! 🌊 Haben Sie Fragen zu Ausflügen, Abholzeiten oder privaten Bootstouren?',
    'whatsapp.instruction': 'Wählen Sie ein Thema oder schreiben Sie uns direkt per WhatsApp.',
    'whatsapp.quickInquiries': 'Schnellanfragen',
    'whatsapp.customQuestion': 'Ihre Frage',
    'whatsapp.placeholder': 'z.B. Haben Sie diesen Donnerstag freie Plätze für Orange Bay?',
    'whatsapp.openButton': 'In WhatsApp öffnen',
    'whatsapp.needHelp': 'Brauchen Sie Hilfe? Chatten Sie mit uns auf WhatsApp',
    'whatsapp.presetAvailability': '🚤 Verfügbarkeit: Gibt es morgen freie Plätze?',
    'whatsapp.presetPickup': '🚐 Hotelabholung: Wann ist die Abholzeit für mein Hotel?',
    'whatsapp.presetPrivate': '🛥️ Privates Boot: Preisangebot für Gruppe/Familie',
    'whatsapp.presetBooking': '🎟️ Bestehende Buchung: Frage zu meiner Reservierung',

    // Footer
    'footer.companyDesc': 'Touroperator mit Sitz in Hurghada für Bootstouren im Roten Meer, Insel-Ausflüge, Schnorcheln und Wüstenerlebnisse. Die Angaben zum ausführenden Anbieter und zu den Leistungen finden Sie bei jeder Tour.',
    'footer.destinations': 'Reiseziele',
    'footer.experiences': 'Erlebnisse',
    'footer.customerCare': 'Kundenservice',
    'footer.hurghadaDesk': 'Büro Hurghada',
    'footer.allRights': 'Alle Rechte vorbehalten.',

    // PWA & Mobile Install
    'pwa.installApp': 'App installieren',
    'pwa.saveToPhone': 'Zum Startbildschirm',
    'pwa.installSubtitle': 'Schneller Offline-Zugriff auf Gutscheine & Buchungen',
  },

  ru: {
    // Header Top Bar
    'top.licensed': 'Лицензированный туроператор Египта #2491/ETB',
    'top.cancellation': 'Условия отмены зависят от экскурсии — проверьте их перед бронированием.',
    'top.pierDesk': 'Поддержка',
    'top.language': 'Язык',
    'top.currency': 'Валюта',

    // Main Navigation
    'nav.allExcursions': 'Экскурсии',
    'nav.destinations': 'Направления',
    'nav.experiences': 'Впечатления',
    'nav.whyChooseUs': 'О нас',
    'nav.guestReviews': 'Отзывы',
    'nav.findMyBooking': 'Мое бронирование',
    'nav.explore': 'Смотреть туры',
    'nav.bookExcursion': 'Забронировать',
    'nav.brandSubtitle': 'Экскурсии в Хургаде и на Красном море',

    // Mobile Menu
    'mobile.popularTours': 'Популярные экскурсии и острова',
    'mobile.destinationsDetailed': 'Направления (Хургада, Эль-Гуна, Марса-Алам)',
    'mobile.categories': 'Категории экскурсий',
    'mobile.safety': 'Стандарты безопасности и гарантии',
    'mobile.reviews': 'Отзывы гостей',
    'mobile.findBookingSubtitle': 'Мое бронирование (просмотр и отмена)',
    'mobile.contactWhatsApp': 'Написать нам в WhatsApp',
    'mobile.selectLanguage': 'Выберите язык',

    // Hero Section
    'hero.badge': 'Прямой оператор в Хургаде и Эль-Гуне',
    'hero.guestsHosted': 'Ежедневные гарантированные отправления',
    'hero.title1': 'Откройте Красное море',
    'hero.title2': 'с местными капитанами',
    'hero.subtitle':
      'Морские прогулки, сноркелинг на рифах и сафари на квадроциклах ежедневно из Хургады, Эль-Гуны и Макади-Бей. Прямой организатор, трансфер из отеля и честные цены без посредников.',
    'hero.guarantee1': 'Погодные условия указаны для каждой экскурсии',
    'hero.guarantee2': 'Условия отмены доступны до бронирования',
    'hero.guarantee3': 'Трансфер зависит от выбранной экскурсии',
    'hero.guarantee4': 'Местные команды и гиды на отдельных экскурсиях',

    // Search Module
    'search.destination': 'Направление',
    'search.allDestinations': 'Все направления',
    'search.activity': 'Впечатление',
    'search.allActivities': 'Все активности',
    'search.date': 'Выберите дату',
    'search.guests': 'Гости',
    'search.submit': 'Найти экскурсии',
    'search.adults': 'Взрослые',
    'search.children': 'Дети',
    'search.ageAdult': 'От 12 лет',
    'search.ageChild': '4-11 лет',

    // Popular Tours Section
    'popular.title': 'Популярные экскурсии на Красном море',
    'popular.subtitle':
      'Все экскурсии включают трансфер от отеля, снаряжение для сноркелинга и сборы заповедников.',
    'popular.viewAll': 'Смотреть все экскурсии',
    'popular.quickBook': 'Забронировать',
    'popular.viewDetails': 'Смотреть тур',
    'popular.from': 'От',
    'popular.perPerson': 'за человека',
    'popular.instantConfirmation': 'Мгновенное подтверждение',
    'popular.verified': 'Официальный оператор',

    // Why Choose Us
    'why.title': 'Почему выгодно бронировать напрямую',
    'why.subtitle':
      'У нас собственные комфортабельные катера, надежные квадроциклы и опытные капитаны. Вы получаете честную цену без переплат агентствам.',

    // Final CTA
    'cta.title': 'Готовы отправиться на экскурсию?',
    'cta.subtitle':
      'Бронируйте онлайн с бесплатной отменой. Вы можете оплатить тур наличными при посадке в трансфер у отеля.',
    'cta.browse': 'Смотреть все экскурсии',
    'cta.chat': 'Чат в WhatsApp',
    'cta.lookup': 'Мое бронирование',

    // WhatsApp Floating Widget
    'whatsapp.concierge': 'Служба поддержки туров',
    'whatsapp.online': 'В сети · Прямой WhatsApp',
    'whatsapp.replies': 'Быстрый ответ',
    'whatsapp.greeting': 'Здравствуйте! 🌊 Есть вопросы по наличию мест, трансферу или аренде катера?',
    'whatsapp.instruction': 'Выберите тему ниже или напишите нам прямо в WhatsApp.',
    'whatsapp.quickInquiries': 'Быстрые вопросы',
    'whatsapp.customQuestion': 'Ваш вопрос',
    'whatsapp.placeholder': 'Например: есть ли места на Оранж Бэй в этот четверг?',
    'whatsapp.openButton': 'Открыть в WhatsApp',
    'whatsapp.needHelp': 'Нужна помощь? Напишите нам в WhatsApp',
    'whatsapp.presetAvailability': '🚤 Наличие мест: есть ли места на завтра?',
    'whatsapp.presetPickup': '🚐 Трансфер: во сколько выезд из моего отеля?',
    'whatsapp.presetPrivate': '🛥️ Аренда катера: расчет для семьи или компании',
    'whatsapp.presetBooking': '🎟️ Моя бронь: помощь по текущему заказу',

    // Footer
    'footer.companyDesc': 'Туроператор из Хургады, предлагающий морские прогулки по Красному морю, поездки на острова, снорклинг и экскурсии в пустыню. Информация об организаторе и включённых услугах указана на странице каждой экскурсии.',
    'footer.destinations': 'Направления',
    'footer.experiences': 'Впечатления',
    'footer.customerCare': 'Служба поддержки',
    'footer.hurghadaDesk': 'Офис в Хургаде',
    'footer.allRights': 'Все права защищены.',

    // PWA & Mobile Install
    'pwa.installApp': 'Установить приложение',
    'pwa.saveToPhone': 'На главный экран',
    'pwa.installSubtitle': 'Быстрый офлайн-доступ к ваучерам и бронированиям',
  },

  it: {
    // Header Top Bar
    'top.licensed': 'Tour Operator Egiziano con Licenza #2491/ETB',
    'top.cancellation': 'Le condizioni di cancellazione variano in base all’escursione; controllale prima di prenotare.',
    'top.pierDesk': 'Assistenza',
    'top.language': 'Lingua',
    'top.currency': 'Valuta',

    // Main Navigation
    'nav.allExcursions': 'Escursioni',
    'nav.destinations': 'Destinazioni',
    'nav.experiences': 'Esperienze',
    'nav.whyChooseUs': 'Chi Siamo',
    'nav.guestReviews': 'Recensioni',
    'nav.findMyBooking': 'La Mia Prenotazione',
    'nav.explore': 'Vedi Tour',
    'nav.bookExcursion': 'Prenota Ora',
    'nav.brandSubtitle': 'Tour Hurghada & Mar Rosso',

    // Mobile Menu
    'mobile.popularTours': 'Tour Popolari & Isole',
    'mobile.destinationsDetailed': 'Destinazioni (Hurghada, El Gouna, Marsa Alam)',
    'mobile.categories': 'Categorie di Tour',
    'mobile.safety': 'Sicurezza & Garanzie',
    'mobile.reviews': 'Recensioni dei Clienti',
    'mobile.findBookingSubtitle': 'La Mia Prenotazione (Vedi & Annulla)',
    'mobile.contactWhatsApp': 'Contattaci su WhatsApp',
    'mobile.selectLanguage': 'Seleziona Lingua',

    // Hero Section
    'hero.badge': 'Operatore Diretto a Hurghada & El Gouna',
    'hero.guestsHosted': 'Partenze Giornaliere Garantite',
    'hero.title1': 'Esplora il Mar Rosso',
    'hero.title2': 'con Capitani Locali',
    'hero.subtitle':
      'Gite in barca con snorkeling, escursioni alle isole e safari nel deserto in quad con partenze giornaliere da Hurghada, El Gouna e Makadi Bay. Operatore diretto con transfer dall\'hotel e prezzi chiari.',
    'hero.guarantee1': 'Condizioni meteo indicate per ogni escursione',
    'hero.guarantee2': 'Condizioni di cancellazione visibili prima della prenotazione',
    'hero.guarantee3': 'Il trasferimento varia in base all’escursione',
    'hero.guarantee4': 'Team e guide locali in alcune escursioni',

    // Search Module
    'search.destination': 'Destinazione',
    'search.allDestinations': 'Tutte le Destinazioni',
    'search.activity': 'Esperienza',
    'search.allActivities': 'Tutte le Attività',
    'search.date': 'Scegli la data',
    'search.guests': 'Ospiti',
    'search.submit': 'Trova Tour',
    'search.adults': 'Adulti',
    'search.children': 'Bambini',
    'search.ageAdult': 'Da 12 anni',
    'search.ageChild': 'Età 4-11',

    // Popular Tours Section
    'popular.title': 'Escursioni Più Richieste nel Mar Rosso',
    'popular.subtitle':
      'Tutti i tour includono transfer dall\'hotel, attrezzatura da snorkeling e ingressi ai parchi marini protetti.',
    'popular.viewAll': 'Vedi Tutte le Escursioni',
    'popular.quickBook': 'Prenota Ora',
    'popular.viewDetails': 'Dettagli Tour',
    'popular.from': 'Da',
    'popular.perPerson': 'a persona',
    'popular.instantConfirmation': 'Conferma Immediata',
    'popular.verified': 'Operatore Ufficiale',

    // Why Choose Us
    'why.title': 'Perché Prenotare Direttamente con Noi',
    'why.subtitle':
      'Disponiamo di imbarcazioni e mezzi propri, con skipper qualificati e guide locali esperte. Tariffe dirette senza intermediari o commissioni d\'agenzia.',

    // Final CTA
    'cta.title': 'Pronto a vivere la magia del Mar Rosso?',
    'cta.subtitle':
      'Prenota online in tutta sicurezza con cancellazione gratuita. Puoi scegliere di pagare comodamente in contanti al momento del prelievo in hotel.',
    'cta.browse': 'Scopri Tutti i Tour',
    'cta.chat': 'Chatta su WhatsApp',
    'cta.lookup': 'Cerca la Mia Prenotazione',

    // WhatsApp
    'whatsapp.concierge': 'Assistenza Escursioni Mar Rosso',
    'whatsapp.online': 'Online Ora · WhatsApp Diretto',
    'whatsapp.replies': 'Risposta rapida',
    'whatsapp.greeting': 'Ciao! 🌊 Hai domande su disponibilità, orari dei transfer o noleggio barca privata?',
    'whatsapp.instruction': 'Seleziona un argomento qui sotto o scrivici direttamente su WhatsApp.',
    'whatsapp.quickInquiries': 'Domande Frequenti',
    'whatsapp.customQuestion': 'La Tua Domanda',
    'whatsapp.placeholder': 'Es. Ci sono posti per 4 persone a Orange Bay questo giovedì?',
    'whatsapp.openButton': 'Apri in WhatsApp',
    'whatsapp.needHelp': 'Hai bisogno di aiuto? Parla con noi su WhatsApp',
    'whatsapp.presetAvailability': '🚤 Disponibilità: ci sono posti per domani?',
    'whatsapp.presetPickup': '🚐 Transfer hotel: a che ora passa il transfer al mio hotel?',
    'whatsapp.presetPrivate': '🛥️ Barca privata: preventivo per famiglia o gruppo',
    'whatsapp.presetBooking': '🎟️ Prenotazione esistente: supporto per il mio ordine',

    // Footer
    'footer.companyDesc': 'Tour operator con sede a Hurghada che propone gite in barca sul Mar Rosso, escursioni alle isole, snorkeling ed esperienze nel deserto. Verifica nella pagina di ogni escursione chi la organizza e cosa è incluso.',
    'footer.destinations': 'Destinazioni',
    'footer.experiences': 'Esperienze',
    'footer.customerCare': 'Assistenza Clienti',
    'footer.hurghadaDesk': 'Ufficio Hurghada',
    'footer.allRights': 'Tutti i diritti riservati.',

    // PWA & Mobile Install
    'pwa.installApp': 'Installa App',
    'pwa.saveToPhone': 'Salva sul Telefono',
    'pwa.installSubtitle': 'Accesso rapido offline a voucher e prenotazioni',
  },

  ro: {
    // Header Top Bar
    'top.licensed': 'Operator Turistic Licențiat în Egipt #2491/ETB',
    'top.cancellation': 'Condițiile de anulare diferă în funcție de excursie; verifică-le înainte de rezervare.',
    'top.pierDesk': 'Asistență',
    'top.language': 'Limbă',
    'top.currency': 'Monedă',

    // Main Navigation
    'nav.allExcursions': 'Excursii',
    'nav.destinations': 'Destinații',
    'nav.experiences': 'Experiențe',
    'nav.whyChooseUs': 'Despre Noi',
    'nav.guestReviews': 'Recenzii',
    'nav.findMyBooking': 'Rezervarea Mea',
    'nav.explore': 'Vezi Tururi',
    'nav.bookExcursion': 'Rezervă Acum',
    'nav.brandSubtitle': 'Tururi Marea Roșie & Hurghada',

    // Mobile Menu
    'mobile.popularTours': 'Tururi Populare & Insule',
    'mobile.destinationsDetailed': 'Destinații (Hurghada, El Gouna, Marsa Alam)',
    'mobile.categories': 'Categorii de Excursii',
    'mobile.safety': 'Siguranță & Garanții',
    'mobile.reviews': 'Recenzii Clienți',
    'mobile.findBookingSubtitle': 'Rezervarea Mea (Vizualizează & Anulează)',
    'mobile.contactWhatsApp': 'Contactează-ne pe WhatsApp',
    'mobile.selectLanguage': 'Selectează Limba',

    // Hero Section
    'hero.badge': 'Operator Direct în Hurghada & El Gouna',
    'hero.guestsHosted': 'Plecări Zilnice Verificate',
    'hero.title1': 'Explorează Marea Roșie',
    'hero.title2': 'cu Căpitani Locali',
    'hero.subtitle':
      'Croaziere cu barca, snorkeling la recife de corali și safari cu ATV-ul în deșert cu plecare zilnică din Hurghada, El Gouna și Makadi Bay. Operator local direct, preluare de la hotel și prețuri corecte fără intermediari.',
    'hero.guarantee1': 'Condițiile meteo sunt indicate pentru fiecare excursie',
    'hero.guarantee2': 'Condițiile de anulare sunt afișate înainte de rezervare',
    'hero.guarantee3': 'Opțiunile de preluare diferă în funcție de excursie',
    'hero.guarantee4': 'Echipe și ghizi locali pentru anumite excursii',

    // Search Module
    'search.destination': 'Destinație',
    'search.allDestinations': 'Toate Destinațiile',
    'search.activity': 'Experiență',
    'search.allActivities': 'Toate Activitățile',
    'search.date': 'Alege data',
    'search.guests': 'Persoane',
    'search.submit': 'Găsește Tururi',
    'search.adults': 'Adulți',
    'search.children': 'Copii',
    'search.ageAdult': 'Vârsta 12+',
    'search.ageChild': 'Vârsta 4-11',

    // Popular Tours Section
    'popular.title': 'Excursii Populare la Marea Roșie',
    'popular.subtitle':
      'Toate excursiile includ transfer dus-întors de la hotel, echipament complet de snorkeling și taxele de parc marin.',
    'popular.viewAll': 'Vezi Toate Excursiile',
    'popular.quickBook': 'Rezervă Acum',
    'popular.viewDetails': 'Detalii Tur',
    'popular.from': 'De la',
    'popular.perPerson': 'de persoană',
    'popular.instantConfirmation': 'Confirmare Imediată',
    'popular.verified': 'Operator Oficial',

    // Why Choose Us
    'why.title': 'De ce să Rezervați Direct cu Noi',
    'why.subtitle':
      'Operăm propriile ambarcațiuni și vehicule de safari, cu căpitani experimentați și ghizi locali prietenoși. Plătiți prețuri directe de operator local, fără adaosuri de agenție.',

    // Final CTA
    'cta.title': 'Ești pregătit să descoperi Marea Roșie?',
    'cta.subtitle':
      'Rezervă online cu anulare gratuită. Poți opta să plătești numerar la preluarea din fața hotelului.',
    'cta.browse': 'Vezi Toate Tururile',
    'cta.chat': 'Scrie-ne pe WhatsApp',
    'cta.lookup': 'Caută Rezervarea Mea',

    // WhatsApp
    'whatsapp.concierge': 'Birou Asistență Excursii',
    'whatsapp.online': 'Online Acum · WhatsApp Direct',
    'whatsapp.replies': 'Răspuns rapid',
    'whatsapp.greeting': 'Bună! 🌊 Ai întrebări legate de locuri disponibile, transferuri sau închiriere barcă privată?',
    'whatsapp.instruction': 'Alege un subiect de mai jos sau trimite-ne un mesaj direct pe WhatsApp.',
    'whatsapp.quickInquiries': 'Întrebări Frecvente',
    'whatsapp.customQuestion': 'Întrebarea Ta',
    'whatsapp.placeholder': 'Ex: Aveți 4 locuri disponibile pentru Orange Bay joi?',
    'whatsapp.openButton': 'Deschide în WhatsApp',
    'whatsapp.needHelp': 'Ai nevoie de ajutor? Scrie-ne pe WhatsApp',
    'whatsapp.presetAvailability': '🚤 Disponibilitate: mai sunt locuri libere mâine?',
    'whatsapp.presetPickup': '🚐 Transfer hotel: la ce oră este preluarea de la hotel?',
    'whatsapp.presetPrivate': '🛥️ Barcă privată: ofertă pentru familie sau grup',
    'whatsapp.presetBooking': '🎟️ Rezervare existentă: asistență pentru comanda mea',

    // Footer
    'footer.companyDesc': 'Operator turistic cu sediul în Hurghada, care oferă excursii cu barca pe Marea Roșie, vizite pe insule, snorkeling și experiențe în deșert. Verifică pagina fiecărei excursii pentru organizator și serviciile incluse.',
    'footer.destinations': 'Destinații',
    'footer.experiences': 'Experiențe',
    'footer.customerCare': 'Suport Clienți',
    'footer.hurghadaDesk': 'Birou Hurghada',
    'footer.allRights': 'Toate drepturile rezervate.',

    // PWA & Mobile Install
    'pwa.installApp': 'Instalează Aplicația',
    'pwa.saveToPhone': 'Salvează pe Telefon',
    'pwa.installSubtitle': 'Acces rapid offline la vouchere și rezervări',
  },
  pl: {
    // Górny pasek
    'top.licensed': 'Licencjonowany egipski organizator turystyki nr 2491/ETB',
    'top.cancellation': 'Warunki anulowania różnią się w zależności od wycieczki; sprawdź je przed rezerwacją.',
    'top.pierDesk': 'Pomoc',
    'top.language': 'Język',
    'top.currency': 'Waluta',

    // Nawigacja
    'nav.allExcursions': 'Wycieczki',
    'nav.destinations': 'Destynacje',
    'nav.experiences': 'Atrakcje',
    'nav.whyChooseUs': 'O nas',
    'nav.guestReviews': 'Opinie',
    'nav.findMyBooking': 'Moja rezerwacja',
    'nav.explore': 'Zobacz wycieczki',
    'nav.bookExcursion': 'Rezerwuj teraz',
    'nav.brandSubtitle': 'Wycieczki w Hurghadzie i nad Morzem Czerwonym',

    // Menu mobilne
    'mobile.popularTours': 'Popularne wycieczki i rejsy na wyspy',
    'mobile.destinationsDetailed': 'Destynacje (Hurghada, El Gouna, Marsa Alam)',
    'mobile.categories': 'Kategorie wycieczek',
    'mobile.safety': 'Bezpieczeństwo i gwarancje',
    'mobile.reviews': 'Opinie klientów',
    'mobile.findBookingSubtitle': 'Moja rezerwacja (sprawdź i anuluj)',
    'mobile.contactWhatsApp': 'Skontaktuj się z nami przez WhatsApp',
    'mobile.selectLanguage': 'Wybierz język',

    // Sekcja główna
    'hero.badge': 'Bezpośredni organizator wycieczek w Hurghadzie i El Gounie',
    'hero.guestsHosted': 'Codziennie potwierdzane wypłynięcia',
    'hero.title1': 'Odkryj Morze Czerwone',
    'hero.title2': 'z lokalnymi kapitanami',
    'hero.subtitle': 'Rejsy ze snorkelingiem, wycieczki na wyspy i pustynne safari quadami, codziennie z Hurghady, El Gouny i Makadi Bay. Bezpośredni lokalny organizator, odbiór z hotelu i przejrzyste ceny.',
    'hero.guarantee1': 'Zasady dotyczące pogody opisane przy każdej wycieczce',
    'hero.guarantee2': 'Warunki anulowania widoczne przed rezerwacją',
    'hero.guarantee3': 'Odbiór zależy od wybranej wycieczki',
    'hero.guarantee4': 'Lokalne zespoły i przewodnicy przy wybranych wycieczkach',

    // Wyszukiwarka
    'search.destination': 'Destynacja',
    'search.allDestinations': 'Wszystkie destynacje',
    'search.activity': 'Atrakcja',
    'search.allActivities': 'Wszystkie atrakcje',
    'search.date': 'Wybierz datę',
    'search.guests': 'Uczestnicy',
    'search.submit': 'Znajdź wycieczki',
    'search.adults': 'Dorośli',
    'search.children': 'Dzieci',
    'search.ageAdult': 'Wiek 12+',
    'search.ageChild': 'Wiek 4–11 lat',

    // Popularne wycieczki
    'popular.title': 'Popularne wycieczki nad Morzem Czerwonym',
    'popular.subtitle': 'Wszystkie wycieczki obejmują odbiór z hotelu, sprzęt do snorkelingu i wymagane opłaty za park morski.',
    'popular.viewAll': 'Zobacz wszystkie wycieczki',
    'popular.quickBook': 'Rezerwuj teraz',
    'popular.viewDetails': 'Zobacz wycieczkę',
    'popular.from': 'Od',
    'popular.perPerson': 'za osobę',
    'popular.instantConfirmation': 'Natychmiastowe potwierdzenie',
    'popular.verified': 'Oficjalny organizator',

    // Dlaczego warto wybrać nas
    'why.title': 'Dlaczego warto rezerwować bezpośrednio u nas?',
    'why.subtitle': 'Korzystamy z własnych łodzi i pojazdów, z certyfikowanymi kapitanami i przyjaznymi lokalnymi przewodnikami. Płacisz lokalne ceny organizatora, bez marży agencji.',

    // Wezwanie do działania
    'cta.title': 'Gotowy, by odkryć Morze Czerwone?',
    'cta.subtitle': 'Zarezerwuj online już teraz z bezpłatnym anulowaniem. Możesz zapłacić podczas odbioru z hotelu.',
    'cta.browse': 'Zobacz wszystkie wycieczki',
    'cta.chat': 'Napisz na WhatsApp',
    'cta.lookup': 'Znajdź moją rezerwację',

    // Pływający widżet WhatsApp
    'whatsapp.concierge': 'Centrum obsługi wycieczek',
    'whatsapp.online': 'Teraz online · Bezpośredni kontakt przez WhatsApp',
    'whatsapp.replies': 'Szybka odpowiedź',
    'whatsapp.greeting': 'Cześć! 🌊 Masz pytania o dostępność wycieczek, odbiór z hotelu lub prywatne rejsy?',
    'whatsapp.instruction': 'Wybierz temat poniżej lub napisz do nas bezpośrednio na WhatsApp.',
    'whatsapp.quickInquiries': 'Szybkie pytania',
    'whatsapp.customQuestion': 'Twoje pytanie',
    'whatsapp.placeholder': 'np. Czy możemy zarezerwować wycieczkę dla 6 osób na Orange Bay w ten czwartek?',
    'whatsapp.openButton': 'Otwórz WhatsApp',
    'whatsapp.needHelp': 'Potrzebujesz pomocy? Napisz do nas na WhatsApp',
    'whatsapp.presetAvailability': '🚤 Dostępność wycieczek: Czy są wolne miejsca na jutro?',
    'whatsapp.presetPickup': '🚐 Odbiór z hotelu: O której godzinie zostanę odebrany?',
    'whatsapp.presetPrivate': '🛥️ Prywatna łódź: Prośba o wycenę dla rodziny lub grupy',
    'whatsapp.presetBooking': '🎟️ Istniejąca rezerwacja: Potrzebuję pomocy z moją rezerwacją',

    // Stopka
    'footer.companyDesc': 'Organizator wycieczek z siedzibą w Hurghadzie, oferujący rejsy po Morzu Czerwonym, wycieczki na wyspy, snorkeling i atrakcje pustynne. Na stronie każdej wycieczki sprawdź organizatora oraz zakres usług.',
    'footer.destinations': 'Destynacje',
    'footer.experiences': 'Atrakcje',
    'footer.customerCare': 'Obsługa klienta',
    'footer.hurghadaDesk': 'Biuro w Hurghadzie',
    'footer.allRights': 'Wszelkie prawa zastrzeżone.',

    // PWA i instalacja mobilna
    'pwa.installApp': 'Zainstaluj aplikację',
    'pwa.saveToPhone': 'Zapisz w telefonie',
    'pwa.installSubtitle': 'Szybki dostęp offline do voucherów i rezerwacji',
  },
};
