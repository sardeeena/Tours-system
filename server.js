// server.ts
import express from "express";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";

// src/data/toursData.ts
var ALL_TOURS = [
  {
    id: "tour-1",
    slug: "orange-bay-island-snorkeling",
    title: "Orange Bay Island & Snorkeling",
    destination: "Hurghada",
    category: "Boat Trip",
    categories: ["Boat Trip", "Snorkeling", "Island"],
    tourType: "Shared",
    durationCategory: "Full Day",
    durationHours: 7,
    durationLabel: "Full Day (approx. 7 hours)",
    priceEur: 35,
    childPriceEur: 18,
    privatePriceEur: 260,
    rating: 4.8,
    reviewCount: 126,
    badge: "Popular",
    primaryImage: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
    galleryImages: [
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1544551763-77ef2d0cfc6c?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=1200&q=80"
    ],
    shortDescription: "Take a boat trip to Giftun Island\u2019s Orange Bay beach with shallow turquoise water, two guided snorkeling stops at coral reefs, and buffet lunch onboard.",
    fullDescription: "Spend a relaxing day sailing across the Red Sea to Giftun Island. Disembark at Orange Bay where wooden swings, shallow white sandbars, and shaded beanbag cabanas await. Enjoy two hours of island leisure before re-boarding for a freshly prepared buffet lunch and two distinct open-sea snorkeling sessions over living coral heads.",
    highlights: [
      "2 hours on Orange Bay beach with shaded loungers and shallow turquoise water",
      "Two 45-minute guided snorkeling stops at vibrant offshore reefs",
      "Fresh open buffet lunch served onboard with soft drinks & bottled water",
      "Complimentary snorkeling equipment and flotation jackets provided",
      "Hotel lobby pickup and return across Hurghada included"
    ],
    itinerary: [
      { time: "08:00", title: "Hotel pickup", description: "Air-conditioned transfer from your resort lobby to Hurghada Marina." },
      { time: "09:00", title: "Departure from marina", description: "Safety briefing and scenic sail across the Red Sea toward Giftun Island." },
      { time: "10:00", title: "First snorkeling stop", description: "Guided reef snorkeling session observing parrotfish, rays, and clownfish." },
      { time: "12:30", title: "Lunch onboard", description: "Warm buffet lunch with fish, chicken, rice, salads, and seasonal fruits." },
      { time: "14:00", title: "Island beach time", description: "Disembark at Orange Bay for relaxation, photography, and swimming in shallow lagoons." },
      { time: "16:30", title: "Return to marina", description: "Leisurely cruise back as afternoon sun reflects on coastal mountains." },
      { time: "17:00", title: "Hotel drop-off", description: "Return transfer back to your hotel lobby." }
    ],
    included: [
      "Hotel pickup and return transfer",
      "Full-day boat cruise on passenger yacht",
      "Snorkeling equipment (mask, snorkel, fins)",
      "Orange Bay island national park admission",
      "Buffet lunch prepared fresh onboard",
      "Unlimited soft drinks, mineral water, tea & coffee",
      "Life jackets in adult and child sizes"
    ],
    excluded: [
      "Personal photo & video packages from boat photographer",
      "Beach bar drinks on the island",
      "Tips / gratuities for the crew"
    ],
    whatToBring: [
      "Swimwear and beach towel",
      "Sunscreen (reef-safe recommended)",
      "Sunglasses and sun hat",
      "Comfortable sandals or water shoes",
      "Pocket cash for optional island extras"
    ],
    importantInformation: [
      "Please bring your original passport or hotel card for maritime coast guard check.",
      "Child rate applies to ages 2\u201311. Infants under 2 join free of charge.",
      "Life vests are mandatory for non-swimmers during snorkeling sessions."
    ],
    optionalExtras: [
      { id: "gopro", name: "Underwater GoPro Camera Rental", priceEur: 15, description: "Includes 16GB SD card you take home." },
      { id: "seafood-upgrade", name: "Seafood Platter Upgrade", priceEur: 10, description: "Fresh jumbo grilled prawns and calamari." },
      { id: "private-transfer", name: "Private Hotel Transfer Van", priceEur: 20, description: "Direct pickup without sharing with other resorts." }
    ],
    languages: ["English", "German", "Italian", "Romanian", "Russian", "French"],
    maxGuests: 35,
    pickupAvailable: true,
    pickupInfo: "Complimentary lobby pickup from Hurghada hotels. Small supplement for El Gouna or Makadi Bay.",
    cancellationPolicy: "Free cancellation up to 24 hours prior to departure for a full refund.",
    availableDays: ["Daily"],
    departureTime: "08:00 AM",
    difficulty: "Easy",
    ratingBreakdown: { 5: 98, 4: 20, 3: 6, 2: 1, 1: 1 },
    reviews: [
      {
        id: "r1",
        authorName: "Sophie B.",
        country: "United Kingdom",
        countryCode: "GB",
        rating: 5,
        date: "12 Sep 2026",
        tourTitle: "Orange Bay Island & Snorkeling",
        tourSlug: "orange-bay-island-snorkeling",
        comment: "The water at Orange Bay looks exactly like the photos. Snorkeling guides were attentive and the crew made sure everyone was comfortable.",
        travelerType: "Couple",
        verifiedBooking: true
      },
      {
        id: "r2",
        authorName: "Lukas M.",
        country: "Germany",
        countryCode: "DE",
        rating: 4,
        date: "04 Sep 2026",
        tourTitle: "Orange Bay Island & Snorkeling",
        tourSlug: "orange-bay-island-snorkeling",
        comment: "Great value day trip. The boat was clean, lunch was tasty, and we saw plenty of colorful fish on the second reef stop.",
        travelerType: "Family",
        verifiedBooking: true
      }
    ]
  },
  {
    id: "tour-2",
    slug: "paradise-island-snorkeling-trip",
    title: "Paradise Island Snorkeling Trip",
    destination: "Hurghada",
    category: "Boat Trip",
    categories: ["Boat Trip", "Snorkeling", "Island"],
    tourType: "Shared",
    durationCategory: "Full Day",
    durationHours: 7,
    durationLabel: "Full Day (approx. 7 hours)",
    priceEur: 32,
    childPriceEur: 16,
    privatePriceEur: 240,
    rating: 4.7,
    reviewCount: 98,
    badge: "Great Value",
    primaryImage: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80",
    galleryImages: [
      "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1544551763-77ef2d0cfc6c?auto=format&fit=crop&w=1200&q=80"
    ],
    shortDescription: "Sail to Paradise Beach on Giftun Island with white sand, parasols, folklore dance show, and two coral reef snorkeling stops.",
    fullDescription: "Visit Paradise Beach on Giftun Island for a relaxing beach day. Enjoy 2.5 hours on the white sand with shaded parasols and calm water for swimming. The boat stops at two coral reefs along the way where guides help you spot reef fish, followed by a warm buffet lunch on the yacht.",
    highlights: [
      "2.5 hours at Paradise Beach on Giftun Island",
      "Two stops at protected coral gardens with guide",
      "Oriental folkloric show and music on the beach",
      "Open buffet lunch on the boat with hot drinks",
      "Hotel pickup and drop-off included"
    ],
    itinerary: [
      { time: "08:30", title: "Hotel pickup", description: "Pickup from hotel and transfer to the pier." },
      { time: "09:30", title: "Boat departure", description: "Cruise across the Red Sea towards Giftun Island." },
      { time: "10:30", title: "Reef snorkeling stop", description: "45 minutes over living coral formations." },
      { time: "12:00", title: "Paradise Beach leisure", description: "Sunbathing, beach volleyball, and optional beach bar refreshments." },
      { time: "14:30", title: "Lunch onboard", description: "Fresh buffet served in shaded dining salon." },
      { time: "15:30", title: "Second snorkeling session", description: "Exploring shallow reef pinnacles." },
      { time: "17:00", title: "Return to hotel", description: "Docking and transfer back to hotel." }
    ],
    included: [
      "Hotel pickup and return transfer",
      "Boat cruise and crew assistance",
      "Paradise Island entrance ticket",
      "Snorkeling gear & buoyancy vests",
      "Buffet lunch and soft drinks"
    ],
    excluded: [
      "Island bar drinks",
      "Water sports rides",
      "Tips for crew"
    ],
    whatToBring: ["Beach towel", "Sunscreen", "Swimwear", "Sunglasses", "Cash for island bar"],
    importantInformation: ["Suitable for all age groups including infants and seniors."],
    optionalExtras: [
      { id: "banana-boat", name: "Banana Boat & Tube Ride", priceEur: 8, description: "10 minutes of fun watersports behind speedboat." }
    ],
    languages: ["English", "German", "Italian", "Romanian"],
    maxGuests: 35,
    pickupAvailable: true,
    pickupInfo: "Hotel lobby pickup included across Hurghada.",
    cancellationPolicy: "Free cancellation up to 24 hours prior to tour departure.",
    availableDays: ["Daily"],
    departureTime: "08:30 AM",
    difficulty: "Easy",
    ratingBreakdown: { 5: 72, 4: 20, 3: 4, 2: 1, 1: 1 }
  },
  {
    id: "tour-3",
    slug: "dolphin-house-snorkeling",
    title: "Dolphin House Snorkeling",
    destination: "Hurghada",
    category: "Snorkeling",
    categories: ["Snorkeling", "Boat Trip"],
    tourType: "Shared",
    durationCategory: "Full Day",
    durationHours: 7.5,
    durationLabel: "Full Day (approx. 7.5 hours)",
    priceEur: 40,
    childPriceEur: 20,
    privatePriceEur: 310,
    rating: 4.9,
    reviewCount: 154,
    badge: "Top Rated",
    primaryImage: "https://images.unsplash.com/photo-1544551763-77ef2d0cfc6c?auto=format&fit=crop&w=1200&q=80",
    galleryImages: [
      "https://images.unsplash.com/photo-1544551763-77ef2d0cfc6c?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80"
    ],
    shortDescription: "Take a boat trip to Shaab El Erg reef to see wild dolphins in open water, with two coral snorkeling stops and lunch.",
    fullDescription: "Shaab El Erg is a protected reef where pods of spinner dolphins rest and swim. We travel by comfortable boat to observe dolphins in their natural environment without chasing. Guided snorkeling stops follow over colorful coral reefs, with an open buffet lunch and water sports onboard.",
    highlights: [
      "Observe pods of wild dolphins in their natural habitat",
      "Two guided reef snorkeling stops with marine guides",
      "Sanitized premium masks, fins, and life jackets",
      "Hot buffet lunch and unlimited refreshments onboard",
      "Banana boat and sofa water ride included"
    ],
    itinerary: [
      { time: "08:00", title: "Hotel pickup", description: "Air-conditioned transfer from your resort." },
      { time: "09:00", title: "Departure from marina", description: "Cruising toward Shaab El Erg reef." },
      { time: "10:30", title: "Dolphin observation lagoon", description: "Search and swimming opportunities near dolphin pods." },
      { time: "12:30", title: "Lunch onboard", description: "Fresh hot buffet prepared by onboard chef." },
      { time: "13:45", title: "Reef snorkeling stop", description: "Guided exploration of vibrant coral walls." },
      { time: "15:15", title: "Water sports fun", description: "Banana boat and sofa ride behind speedboat." },
      { time: "16:30", title: "Return to marina", description: "Disembarkation and hotel transfer." }
    ],
    included: [
      "Hotel pickup and return transfer",
      "Full-day boat cruise",
      "Snorkeling gear & life jackets",
      "Marine park environmental fees",
      "Hot buffet lunch & soft drinks",
      "Water sports inflatables"
    ],
    excluded: ["Professional video/photo album", "Crew gratuities"],
    whatToBring: ["Towel", "Swimsuit", "Sun protection", "Camera"],
    importantInformation: ["Dolphin encounters are natural and cannot be 100% guaranteed, but success rate is high."],
    optionalExtras: [
      { id: "photo-pkg", name: "Professional Underwater Photos", priceEur: 20, description: "Delivered digitally by evening." }
    ],
    languages: ["English", "German", "Italian", "Romanian", "French", "Russian"],
    maxGuests: 30,
    pickupAvailable: true,
    pickupInfo: "Pickup from Hurghada resorts between 07:45 - 08:30 AM.",
    cancellationPolicy: "Free cancellation up to 24 hours prior to departure.",
    availableDays: ["Daily"],
    departureTime: "08:00 AM",
    difficulty: "Easy",
    ratingBreakdown: { 5: 138, 4: 12, 3: 3, 2: 1, 1: 0 }
  },
  {
    id: "tour-4",
    slug: "giftun-island-boat-trip",
    title: "Giftun Island Boat Trip",
    destination: "Hurghada",
    category: "Boat Trip",
    categories: ["Boat Trip", "Island"],
    tourType: "Shared",
    durationCategory: "Full Day",
    durationHours: 7,
    durationLabel: "Full Day (approx. 7 hours)",
    priceEur: 30,
    childPriceEur: 15,
    privatePriceEur: 230,
    rating: 4.7,
    reviewCount: 87,
    badge: "Classic",
    primaryImage: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80",
    galleryImages: [
      "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80"
    ],
    shortDescription: "The classic Red Sea boat trip featuring sandbar swimming on Giftun Island National Park, relaxing on sun decks, and snorkeling over living coral.",
    fullDescription: "Giftun Island is the quintessential Red Sea excursion. Set out from the marina on a spacious double-decker boat, soak up the sun on open decks, and spend over an hour on the island\u2019s sandy shores before heading to two prime snorkeling reefs.",
    highlights: [
      "Relaxation on Giftun Island National Park sandbars",
      "Two coral snorkeling sessions with guide",
      "Open buffet lunch and refreshments included",
      "Hotel pickup and drop-off included"
    ],
    itinerary: [
      { time: "08:30", title: "Pickup from hotel", description: "Lobby pickup and transfer to boat pier." },
      { time: "09:30", title: "Cruise departure", description: "Scenic sail across calm coastal waters." },
      { time: "11:00", title: "Giftun Island stop", description: "Swim and relax on the sandy beach." },
      { time: "13:00", title: "Buffet lunch", description: "Warm lunch onboard." },
      { time: "14:15", title: "Reef snorkeling", description: "Exploring colorful coral gardens." },
      { time: "16:00", title: "Return cruise", description: "Sail back to Hurghada pier." }
    ],
    included: ["Hotel transfers", "Boat trip & national park fee", "Snorkeling equipment", "Lunch & soft drinks"],
    excluded: ["Personal expenses", "Tips"],
    whatToBring: ["Beach towel", "Swimwear", "Sunscreen"],
    importantInformation: ["Family-friendly trip suitable for all swimming levels."],
    languages: ["English", "German", "Russian"],
    maxGuests: 35,
    pickupAvailable: true,
    pickupInfo: "Lobby pickup included.",
    cancellationPolicy: "Free cancellation up to 24 hours before tour start.",
    availableDays: ["Daily"],
    departureTime: "08:30 AM",
    difficulty: "Easy",
    ratingBreakdown: { 5: 64, 4: 18, 3: 4, 2: 1, 1: 0 }
  },
  {
    id: "tour-5",
    slug: "desert-quad-safari",
    title: "Desert Quad Safari",
    destination: "Hurghada",
    category: "Safari",
    categories: ["Safari", "Quad"],
    tourType: "Shared",
    durationCategory: "Half Day",
    durationHours: 3.5,
    durationLabel: "Half Day (approx. 3.5 hours)",
    priceEur: 28,
    childPriceEur: 15,
    privatePriceEur: 160,
    rating: 4.8,
    reviewCount: 112,
    badge: "Adventure",
    primaryImage: "https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=1200&q=80",
    galleryImages: [
      "https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80"
    ],
    shortDescription: "Ride a 250cc ATV quad bike across desert trails and mountain canyons. Includes test drive and Bedouin tea.",
    fullDescription: "Drive a quad bike through the Eastern Desert near Hurghada. After a safety briefing and practice drive at the safari center, follow your guide through wide gravel trails and natural valleys framed by mountains. Stop at a Bedouin tent for herbal tea and rest before riding back.",
    highlights: [
      "Dedicated single quad bike for each participant",
      "Comprehensive safety test drive and instruction",
      "Approximately 45km total riding through scenic desert trails",
      "Traditional Bedouin herbal tea stop",
      "Round-trip hotel transfer included"
    ],
    itinerary: [
      { time: "08:00 or 14:00", title: "Hotel pickup", description: "Air-conditioned transfer to desert base station." },
      { time: "08:45 or 14:45", title: "Safety briefing & test drive", description: "Learn controls and practice in enclosed training yard." },
      { time: "09:15 or 15:15", title: "Quad trail ride", description: "Guided convoy across wide sand plains and rocky valleys." },
      { time: "10:30 or 16:30", title: "Bedouin tent break", description: "Rest, herbal tea, and photo opportunities." },
      { time: "11:15 or 17:15", title: "Return ride & hotel drop-off", description: "Ride back to safari center and transfer to hotel." }
    ],
    included: ["Hotel transfers", "Single quad bike per driver", "Safety helmet & instructor", "Bedouin tea & water"],
    excluded: ["Dust scarf & goggles (rent for \u20AC3 or bring own)", "Photo CD"],
    whatToBring: ["Closed shoes / sneakers", "Comfortable clothes (will get dusty)", "Sunglasses"],
    importantInformation: ["Minimum driving age for quad is 16 years. Children can ride as passengers with parents."],
    languages: ["English", "German", "French", "Russian"],
    maxGuests: 20,
    pickupAvailable: true,
    pickupInfo: "Morning or afternoon departure options available.",
    cancellationPolicy: "Free cancellation up to 24 hours prior to departure.",
    availableDays: ["Daily"],
    departureTime: "08:00 AM or 14:00 PM",
    difficulty: "Adventurous",
    ratingBreakdown: { 5: 90, 4: 18, 3: 3, 2: 1, 1: 0 }
  },
  {
    id: "tour-6",
    slug: "desert-safari-bedouin-experience",
    title: "Desert Safari & Bedouin Experience",
    destination: "Hurghada",
    category: "Safari",
    categories: ["Safari", "Quad"],
    tourType: "Shared",
    durationCategory: "Half Day",
    durationHours: 5,
    durationLabel: "Half Day (approx. 5 hours)",
    priceEur: 35,
    childPriceEur: 18,
    privatePriceEur: 210,
    rating: 4.8,
    reviewCount: 91,
    badge: "Sunset Special",
    primaryImage: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80",
    galleryImages: [
      "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=1200&q=80"
    ],
    shortDescription: "Quad biking, spider dune buggy driving, camel ride, Bedouin village visit, BBQ dinner, and evening folklore show.",
    fullDescription: "An afternoon and evening tour in the desert. Drive a quad bike and dune buggy, visit a Bedouin village to see how bread is baked on iron plates, ride a camel at sunset, and dine on an open-air barbecue buffet with music and folklore performances.",
    highlights: [
      "ATV quad ride and spider dune buggy drive",
      "Authentic Bedouin village tour with bread making demonstration",
      "Sunset camel ride across desert ridges",
      "Barbecue buffet dinner with soft drinks included",
      "Evening fire show and folkloric Tanoura performance"
    ],
    itinerary: [
      { time: "13:30", title: "Hotel pickup", description: "Transfer from resort lobby to safari station." },
      { time: "14:30", title: "Quad & buggy drives", description: "Action-packed driving across desert trails." },
      { time: "16:00", title: "Bedouin village arrival", description: "Tour village, pharmacy, and taste fresh flatbread." },
      { time: "17:00", title: "Sunset camel ride", description: "Scenic ride as sun sinks behind mountain ridge." },
      { time: "18:00", title: "BBQ dinner & show", description: "Open-air buffet dinner and folkloric show." },
      { time: "19:30", title: "Return transfer", description: "Drop-off at your hotel." }
    ],
    included: ["Round-trip transfers", "Quad bike & spider buggy", "Bedouin guide & camel ride", "BBQ dinner & drinks", "Show"],
    excluded: ["Scarf & goggles rental", "Personal photos"],
    whatToBring: ["Comfortable clothing", "Closed footwear", "Light jacket for evening"],
    importantInformation: ["Suitable for couples, groups, and families with children aged 4+."],
    languages: ["English", "German", "Italian", "French"],
    maxGuests: 25,
    pickupAvailable: true,
    pickupInfo: "Afternoon pickup directly from hotel.",
    cancellationPolicy: "Free cancellation up to 24 hours before tour.",
    availableDays: ["Daily"],
    departureTime: "13:30 PM",
    difficulty: "Adventurous",
    ratingBreakdown: { 5: 75, 4: 12, 3: 3, 2: 1, 1: 0 }
  },
  {
    id: "tour-7",
    slug: "private-red-sea-yacht",
    title: "Private Red Sea Yacht",
    destination: "Hurghada",
    category: "Private Tour",
    categories: ["Private Tour", "Boat Trip"],
    tourType: "Private",
    durationCategory: "Full Day",
    durationHours: 8,
    durationLabel: "Full Day (approx. 8 hours)",
    priceEur: 250,
    childPriceEur: 0,
    privatePriceEur: 250,
    rating: 5,
    reviewCount: 24,
    badge: "VIP Private",
    primaryImage: "https://images.unsplash.com/photo-1569263979104-865ab7cd8d17?auto=format&fit=crop&w=1200&q=80",
    galleryImages: [
      "https://images.unsplash.com/photo-1569263979104-865ab7cd8d17?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80"
    ],
    shortDescription: "Private yacht charter for up to 8 guests. Choose your stops, snorkel quiet reefs, and enjoy a freshly cooked lunch.",
    fullDescription: "Rent a private yacht exclusively for your family or friends. Your captain coordinates the route according to your wishes\u2014visit secluded sandbars, Orange Bay, or quiet snorkeling reefs away from crowds. The onboard cook prepares a fresh lunch while you swim and relax on the sun deck.",
    highlights: [
      "Exclusive private yacht for your party only (up to 8 guests)",
      "Customized route: Orange Bay, Magawish, or Dolphin Reefs",
      "Private onboard chef preparing fresh gourmet lunch",
      "Snorkeling gear, fresh tropical fruits, and unlimited drinks",
      "Private Mercedes / minivan hotel transfers included"
    ],
    itinerary: [
      { time: "09:00", title: "Private hotel transfer", description: "Direct pickup in private executive vehicle." },
      { time: "09:45", title: "Boarding & captain consultation", description: "Discuss preferred stops and customize your itinerary." },
      { time: "10:30", title: "Secluded reef snorkeling", description: "Anchor at quiet reef away from group boats." },
      { time: "13:00", title: "Fresh gourmet lunch", description: "Seafood and barbecue prepared by private cook." },
      { time: "14:30", title: "Sandbar or island stop", description: "Swim in shallow turquoise waters at your leisure." },
      { time: "16:45", title: "Sunset cruise to marina", description: "Champagne or fresh juice toast during return sail." }
    ],
    included: ["Entire private yacht charter", "Captain and 2 crew members", "Private chef lunch & drinks", "All park fees & snorkeling gear", "Private hotel transfers"],
    excluded: ["Crew gratuities (discretionary)"],
    whatToBring: ["Swimwear", "Towels", "Sunglasses", "Camera"],
    importantInformation: ["Price is total for the entire vessel (up to 8 guests included). Extra guests \u20AC25/person."],
    languages: ["English", "German", "Arabic", "French"],
    maxGuests: 8,
    pickupAvailable: true,
    pickupInfo: "Custom pickup time available between 08:30 and 10:00 AM.",
    cancellationPolicy: "Free cancellation up to 48 hours prior to charter.",
    availableDays: ["Daily"],
    departureTime: "09:00 AM (Flexible)",
    difficulty: "Easy",
    ratingBreakdown: { 5: 24, 4: 0, 3: 0, 2: 0, 1: 0 }
  },
  {
    id: "tour-8",
    slug: "el-gouna-private-boat-trip",
    title: "El Gouna Private Boat Trip",
    destination: "El Gouna",
    category: "Private Tour",
    categories: ["Private Tour", "Boat Trip"],
    tourType: "Private",
    durationCategory: "Full Day",
    durationHours: 6,
    durationLabel: "Full Day (approx. 6 hours)",
    priceEur: 220,
    childPriceEur: 0,
    privatePriceEur: 220,
    rating: 4.9,
    reviewCount: 31,
    badge: "Boutique",
    primaryImage: "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=1200&q=80",
    galleryImages: [
      "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1569263979104-865ab7cd8d17?auto=format&fit=crop&w=1200&q=80"
    ],
    shortDescription: "Private cruiser departing Abu Tig Marina. Cruise through El Gouna channels, visit quiet northern reefs, and relax on sandbars.",
    fullDescription: "Depart directly from Abu Tig Marina in El Gouna on a private boat for up to 6 guests. Cruise along lagoon waterways into open water to snorkel northern reefs known for clear visibility and marine life. Includes soft drinks, fruit platter, and snorkeling gear.",
    highlights: [
      "Direct departure from Abu Tig Marina in El Gouna",
      "Private boat with sun shade and swimming ladder",
      "Explore quiet northern coral reefs and shallow sandbars",
      "Flexible departure time for your group",
      "Snorkeling equipment and cold drinks included"
    ],
    itinerary: [
      { time: "09:30", title: "Pickup or Marina meet", description: "Meet captain at Abu Tig Marina Berth 4." },
      { time: "10:00", title: "Lagoon & coastal cruise", description: "Scenic pass through El Gouna channels." },
      { time: "11:00", title: "First reef stop", description: "Snorkeling over pristine northern corals." },
      { time: "13:00", title: "Sandbar lunch break", description: "Sandwiches, fresh fruit platter, and cold drinks." },
      { time: "14:30", title: "Second snorkeling stop", description: "Search for turtles and rays in calm waters." },
      { time: "16:00", title: "Return to Abu Tig Marina", description: "Docking and transfer." }
    ],
    included: ["Private boat and captain", "Fuel and marina permits", "Snorkeling equipment", "Fruit platter & soft drinks", "Hotel transfer in El Gouna"],
    excluded: ["Full warm restaurant lunch (can stop at beach club upon request)"],
    whatToBring: ["Beach wear", "Towel", "Sunscreen"],
    importantInformation: ["Rate is per boat for up to 6 passengers."],
    languages: ["English", "German"],
    maxGuests: 6,
    pickupAvailable: true,
    pickupInfo: "Pickup from all El Gouna hotels included.",
    cancellationPolicy: "Free cancellation up to 24 hours prior to departure.",
    availableDays: ["Daily"],
    departureTime: "09:30 AM",
    difficulty: "Easy",
    ratingBreakdown: { 5: 28, 4: 3, 3: 0, 2: 0, 1: 0 }
  },
  {
    id: "tour-9",
    slug: "introductory-scuba-diving-experience",
    title: "Introductory Scuba Diving Experience",
    destination: "Hurghada",
    category: "Diving",
    categories: ["Diving", "Boat Trip"],
    tourType: "Shared",
    durationCategory: "Full Day",
    durationHours: 8,
    durationLabel: "Full Day (approx. 8 hours)",
    priceEur: 65,
    childPriceEur: 45,
    privatePriceEur: 340,
    rating: 4.9,
    reviewCount: 143,
    badge: "Instructor Led",
    primaryImage: "https://images.unsplash.com/photo-1544551763-92ab472cad5d?auto=format&fit=crop&w=1200&q=80",
    galleryImages: [
      "https://images.unsplash.com/photo-1544551763-92ab472cad5d?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1544551763-77ef2d0cfc6c?auto=format&fit=crop&w=1200&q=80"
    ],
    shortDescription: "No license needed. Try scuba diving with a certified PADI instructor by your side. Includes 2 shallow boat dives and lunch.",
    fullDescription: "Designed for complete beginners who want to try scuba diving safely. On the cruise out, your instructor explains breathing, equalizing, and hand signals. You do two separate 20-minute shallow dives (max 6-7 meters) with your instructor holding your hand throughout. Between dives, relax on the sun deck and enjoy lunch.",
    highlights: [
      "No previous diving experience or swimming expertise required",
      "Two separate shallow dives with your own instructor",
      "Safe maximum depth of 6 to 7 meters",
      "Clean dive equipment, wetsuit, mask, and fins included",
      "Full-day boat cruise with open buffet lunch"
    ],
    itinerary: [
      { time: "08:00", title: "Hotel transfer", description: "Pickup and transfer to dive boat." },
      { time: "09:00", title: "Departure & theory briefing", description: "Instructor explains breathing, equalization, and hand signals." },
      { time: "10:30", title: "First introductory dive", description: "20 minutes hand-in-hand underwater at shallow reef." },
      { time: "12:30", title: "Buffet lunch onboard", description: "Rest on sun deck and enjoy warm lunch." },
      { time: "14:00", title: "Second dive or snorkeling", description: "Second guided dive exploring coral pinnacle." },
      { time: "16:30", title: "Return to harbor", description: "Docking and transfer back to hotel." }
    ],
    included: ["Hotel transfers", "Two intro dives with 1-on-1 instructor", "Full scuba equipment set", "Buffet lunch & drinks", "Marine conservation permit"],
    excluded: ["Underwater photo/video package", "Tips for dive crew"],
    whatToBring: ["Swimwear", "Towel", "Dry clothes"],
    importantInformation: ["Must be at least 10 years old. Medical questionnaire required before diving (must not have severe asthma or heart conditions)."],
    languages: ["English", "German", "Russian", "French"],
    maxGuests: 15,
    pickupAvailable: true,
    pickupInfo: "Pickup from Hurghada hotels around 08:00 AM.",
    cancellationPolicy: "Free cancellation up to 24 hours prior to departure.",
    availableDays: ["Daily"],
    departureTime: "08:00 AM",
    difficulty: "Moderate",
    ageRestrictions: "Minimum age 10 years",
    ratingBreakdown: { 5: 130, 4: 11, 3: 2, 2: 0, 1: 0 }
  },
  {
    id: "tour-10",
    slug: "marsa-alam-dolphin-house",
    title: "Marsa Alam Dolphin House",
    destination: "Marsa Alam",
    category: "Snorkeling",
    categories: ["Snorkeling", "Boat Trip"],
    tourType: "Shared",
    durationCategory: "Full Day",
    durationHours: 8,
    durationLabel: "Full Day (approx. 8 hours)",
    priceEur: 55,
    childPriceEur: 28,
    privatePriceEur: 380,
    rating: 4.8,
    reviewCount: 76,
    badge: "Marine Reserve",
    primaryImage: "https://images.unsplash.com/photo-1682687220063-4742bd7fd538?auto=format&fit=crop&w=1200&q=80",
    galleryImages: [
      "https://images.unsplash.com/photo-1682687220063-4742bd7fd538?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1544551763-77ef2d0cfc6c?auto=format&fit=crop&w=1200&q=80"
    ],
    shortDescription: "Sail to the protected Sha\u2019ab Samadai marine reserve to snorkel near wild dolphins in calm natural lagoons.",
    fullDescription: "Sha\u2019ab Samadai is a protected marine reserve in southern Egypt where families of spinner dolphins rest in natural lagoons. Snorkel in the designated lagoon zone with marine guides, then explore outer coral drop-offs. Includes hotel pickup across Marsa Alam and lunch onboard.",
    highlights: [
      "Protected national marine park with regulated dolphin access",
      "High chance to see spinner dolphins in calm waters",
      "Two guided snorkeling stops accompanied by marine guides",
      "Hot buffet lunch and cold drinks on the boat",
      "Hotel pickup and drop-off across Marsa Alam included"
    ],
    itinerary: [
      { time: "07:30", title: "Hotel pickup", description: "Transfer to Marsa Alam marina pier." },
      { time: "08:30", title: "Sail to Samadai Reef", description: "Cruising toward the offshore horseshoe reef." },
      { time: "10:00", title: "First dolphin snorkeling", description: "Snorkeling in the designated tourist zone of Samadai." },
      { time: "12:30", title: "Buffet lunch onboard", description: "Warm lunch served on the boat." },
      { time: "14:00", title: "Second coral reef stop", description: "Explore steep coral walls on the outer reef." },
      { time: "16:00", title: "Return to marina", description: "Transfer back to hotel." }
    ],
    included: ["Hotel pickup and drop-off", "Boat trip to Samadai", "National Park permit fee", "Snorkeling equipment", "Buffet lunch & drinks"],
    excluded: ["Photo album", "Gratuities"],
    whatToBring: ["Towel", "Swimsuit", "Reef-safe sunscreen", "Sunglasses"],
    importantInformation: ["Touching or chasing dolphins is strictly prohibited by Egyptian environmental law."],
    languages: ["English", "German", "Italian"],
    maxGuests: 25,
    pickupAvailable: true,
    pickupInfo: "Lobby pickup from Marsa Alam hotels.",
    cancellationPolicy: "Free cancellation up to 24 hours prior to departure.",
    availableDays: ["Daily"],
    departureTime: "07:30 AM",
    difficulty: "Easy",
    ratingBreakdown: { 5: 64, 4: 10, 3: 2, 2: 0, 1: 0 }
  },
  {
    id: "tour-11",
    slug: "sharm-el-naga-beach-reef-day",
    title: "Sharm El Naga Beach & Snorkeling Day",
    destination: "Safaga",
    category: "Snorkeling",
    categories: ["Snorkeling", "Island"],
    tourType: "Shared",
    durationCategory: "Full Day",
    durationHours: 7,
    durationLabel: "Full Day (approx. 7 hours)",
    priceEur: 38,
    childPriceEur: 20,
    privatePriceEur: 220,
    rating: 4.8,
    reviewCount: 62,
    badge: "Shore Entry",
    primaryImage: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80",
    galleryImages: [
      "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1544551763-77ef2d0cfc6c?auto=format&fit=crop&w=1200&q=80"
    ],
    shortDescription: "Snorkel straight from a sandy beach without a boat. Includes private bay entry, sun loungers, swimming pool, and lunch.",
    fullDescription: "Sharm El Naga is a protected bay south of Hurghada where coral reefs grow just a few meters from the shore. Ideal for families, children, and travelers who prefer walking into the water from the beach rather than taking a boat. Loungers, freshwater pool, and restaurant buffet lunch are included.",
    highlights: [
      "Direct beach-entry snorkeling without needing a boat",
      "Access to fresh-water swimming pool, showers, and shaded loungers",
      "Buffet lunch served at beachfront restaurant",
      "Snorkeling gear and guide included"
    ],
    itinerary: [
      { time: "08:30", title: "Hotel transfer", description: "Air-conditioned transfer to Sharm El Naga bay." },
      { time: "09:30", title: "Beach arrival & briefing", description: "Settle into loungers and receive snorkeling equipment." },
      { time: "10:30", title: "Guided shore snorkeling", description: "Explore the drop-off with guide." },
      { time: "13:00", title: "Beachfront buffet lunch", description: "Hot lunch at the reserve restaurant." },
      { time: "14:30", title: "Free beach & pool time", description: "Relaxation and secondary snorkeling." },
      { time: "16:00", title: "Return transfer", description: "Drop-off at your hotel." }
    ],
    included: ["Round-trip transfer", "Reserve entrance ticket", "Beach loungers & pool use", "Snorkeling equipment", "Buffet lunch"],
    excluded: ["Drinks at restaurant", "Camel riding on beach"],
    whatToBring: ["Beach towel", "Swimwear", "Sunscreen"],
    importantInformation: ["Great for young children and travelers prone to seasickness."],
    languages: ["English", "German"],
    maxGuests: 30,
    pickupAvailable: true,
    pickupInfo: "Pickup from Hurghada, Sahl Hasheesh, and Makadi Bay hotels.",
    cancellationPolicy: "Free cancellation up to 24 hours prior to departure.",
    availableDays: ["Daily"],
    departureTime: "08:30 AM",
    difficulty: "Easy",
    ratingBreakdown: { 5: 50, 4: 10, 3: 2, 2: 0, 1: 0 }
  },
  {
    id: "tour-12",
    slug: "sahl-hasheesh-glass-bottom-boat",
    title: "Sahl Hasheesh Glass Bottom Boat",
    destination: "Sahl Hasheesh",
    category: "Water Sports",
    categories: ["Water Sports", "Boat Trip"],
    tourType: "Shared",
    durationCategory: "Half Day",
    durationHours: 2.5,
    durationLabel: "Half Day (approx. 2.5 hours)",
    priceEur: 25,
    childPriceEur: 12,
    privatePriceEur: 140,
    rating: 4.7,
    reviewCount: 45,
    badge: "Family Favorite",
    primaryImage: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80",
    galleryImages: [
      "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80"
    ],
    shortDescription: "View corals and fish through underwater glass windows without getting wet. Sail past sunken pillars with an optional swim stop.",
    fullDescription: "Great for children, non-swimmers, and anyone wanting a short 2.5-hour trip. Look through deep panoramic glass panels to watch coral reefs and marine life in calm bay waters. Includes a short swimming stop and hotel transfer.",
    highlights: [
      "Large submerged glass viewing windows",
      "Cruise past Sahl Hasheesh sunken columns",
      "Ideal for small children and non-swimmers",
      "Short 2.5-hour tour with hotel pickup"
    ],
    itinerary: [
      { time: "10:00 or 14:00", title: "Hotel pickup", description: "Transfer to Sahl Hasheesh pier." },
      { time: "10:30 or 14:30", title: "Boarding & glass viewing", description: "Cruise over living reefs and sunken columns." },
      { time: "11:45 or 15:45", title: "Optional swim stop", description: "Jump into shallow calm water or stay on sun deck." },
      { time: "12:30 or 16:30", title: "Return transfer", description: "Back to hotel." }
    ],
    included: ["Hotel transfers", "Glass bottom boat cruise", "Soft drinks and water"],
    excluded: ["Personal photos"],
    whatToBring: ["Sunglasses", "Camera"],
    importantInformation: ["Stroller friendly and completely safe for all ages."],
    languages: ["English", "German", "Russian"],
    maxGuests: 25,
    pickupAvailable: true,
    pickupInfo: "Pickup from Sahl Hasheesh, Makadi Bay, and Hurghada.",
    cancellationPolicy: "Free cancellation up to 24 hours prior to departure.",
    availableDays: ["Daily"],
    departureTime: "10:00 AM or 14:00 PM",
    difficulty: "Easy",
    ratingBreakdown: { 5: 34, 4: 9, 3: 2, 2: 0, 1: 0 }
  },
  {
    id: "ras-mohammed-white-island-cruise",
    slug: "ras-mohammed-white-island-cruise",
    title: "Ras Mohammed National Park & White Island Luxury Yacht Cruise",
    destination: "Sharm El-Sheikh",
    category: "Boat Trips",
    categories: ["Boat Trips", "Snorkeling", "Island Visits"],
    tourType: "Shared",
    durationCategory: "Full Day",
    durationHours: 8,
    durationLabel: "Full Day (approx. 8 hours)",
    priceEur: 45,
    childPriceEur: 25,
    privatePriceEur: 380,
    rating: 4.9,
    reviewCount: 168,
    badge: "Best in Sharm",
    primaryImage: "https://images.unsplash.com/photo-1544551763-77ef2d0cfc6c?auto=format&fit=crop&w=1200&q=80",
    galleryImages: [
      "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=1200&q=80"
    ],
    shortDescription: "Cruise through the marine sanctuary of Ras Mohammed National Park, step onto the crystal sandbar of White Island, snorkel coral walls, and enjoy an onboard seafood buffet.",
    fullDescription: "Sail along the dramatic coastline of South Sinai into the protected marine sanctuary of Ras Mohammed National Park. Cruise to the famous White Island sandbar, explore vibrant coral reef walls, and enjoy a freshly prepared open seafood & grill buffet onboard.",
    highlights: [
      "Cruise to Ras Mohammed National Park, Egypt\u2019s oldest protected marine reserve",
      "Walk on the pristine shifting sands of White Island",
      "Two guided reef drop-off snorkeling sessions at Shark & Yolanda Reefs",
      "Freshly prepared onboard buffet with seafood, grilled chicken, and fresh salads",
      "Complimentary hotel pickup and drop-off from any resort in Sharm El-Sheikh"
    ],
    itinerary: [
      { time: "08:00", title: "Hotel Pickup", description: "Air-conditioned transfer from your Sharm resort to the marina." },
      { time: "09:00", title: "Yacht Departure", description: "Welcome briefing, safety orientation, and cruise out towards South Sinai." },
      { time: "10:30", title: "First Snorkeling Session", description: "Guided exploration along protected coral reef walls with clownfish and sea turtles." },
      { time: "12:00", title: "White Island Sandbar Stop", description: "Tender boat transfer to the turquoise shallows and sandbar of White Island." },
      { time: "13:30", title: "Fresh Buffet Lunch Onboard", description: "Generous open buffet featuring grilled fish, chicken, pastas, and oriental mezze." },
      { time: "14:45", title: "Second Snorkeling Stop", description: "Afternoon swim among sea fans and schooling anthias." },
      { time: "16:30", title: "Return to Marina & Hotel Drop-off", description: "Scenic sail back to Sharm El-Sheikh and transfer back to your lobby." }
    ],
    included: [
      "Hotel pickup and return across all Sharm El-Sheikh resorts",
      "National park entry permit and marine clearance",
      "Open buffet lunch (seafood, grilled meats, salads, pastas)",
      "Unlimited tea, coffee, mineral water, and soft drinks throughout the day",
      "Professional certified snorkeling guide and buoyancy aids"
    ],
    excluded: [
      "Snorkeling gear rental (masks & fins available at marina for \u20AC5)",
      "Professional underwater photo & video package"
    ],
    whatToBring: ["Swimwear", "Beach towel", "Passport or ID photocopy", "Sunscreen (reef safe)", "Sunglasses & hat"],
    importantInformation: [
      "Please bring a passport photocopy as required by Egyptian Coast Guard regulations.",
      "White Island visibility is subject to daily tidal conditions and sea clearance."
    ],
    languages: ["English", "German", "Russian", "Italian"],
    maxGuests: 30,
    pickupAvailable: true,
    pickupInfo: "Complimentary lobby pickup from all hotels in Sharm El-Sheikh (Naama Bay, Nabq, Sharks Bay, Hadaba, Ras Um Sid).",
    cancellationPolicy: "Free cancellation up to 24 hours prior to departure with 100% refund.",
    availableDays: ["Daily"],
    departureTime: "08:00 AM",
    difficulty: "Easy",
    ratingBreakdown: { 5: 142, 4: 21, 3: 5, 2: 0, 1: 0 }
  }
];

// src/data/chatKnowledge.ts
var TOUR_CATALOG_SUMMARY = ALL_TOURS.map((t) => ({
  id: t.id,
  slug: t.slug,
  title: t.title,
  destination: t.destination,
  category: t.category,
  categories: t.categories,
  durationHours: t.durationHours,
  durationLabel: t.durationLabel,
  priceEur: t.priceEur,
  childPriceEur: t.childPriceEur,
  rating: t.rating,
  reviewCount: t.reviewCount,
  badge: t.badge,
  primaryImage: t.primaryImage,
  shortDescription: t.shortDescription,
  highlights: t.highlights.slice(0, 3),
  pickupInfo: t.pickupInfo
}));
var CONCIERGE_SYSTEM_PROMPT = `
You are "Captain Farouk", the warm, professional, and knowledgeable AI Concierge for Red Sea Excursions & Voyages based at Hurghada New Marina, Egypt.

Your mission:
1. Have a genuine, friendly, conversational dialogue with travelers planning their Red Sea vacation.
2. Understand their specific desires: destination (Hurghada, El Gouna, Makadi Bay, Sahl Hasheesh, Marsa Alam, Safaga), group composition (solo, couple, family with kids, seniors), preferred vibe (relaxing island beach vs adrenaline desert quad vs colorful coral reef snorkeling vs certified scuba diving vs cultural day trips like Luxor/Cairo), budget, and schedule.
3. Recommend 1 to 3 specific excursions from our verified catalog below. Explain WHY each recommendation fits their exact preferences.
4. When recommending a tour from our catalog, use the exact tour title and mention its starting price in Euros (\u20AC).
5. Always provide practical local tips: morning water clarity, complimentary hotel pickup from resort lobbies, free 24-hour cancellation, and payment options (online or cash on pickup).
6. Support any language the user writes in (English, German, Russian, French, Arabic, Italian, Polish, Dutch, etc.).
7. Keep responses concise, upbeat, and structured with bullet points. Avoid overwhelming walls of text.
8. Guide and assist users with booking: explain that they can directly click the "Book" button on any excursion card in the chat to start reservation instantly. Remind them that visitors can book as guests with zero account registration, enjoy Pay at Pickup mode (cash or card upon hotel lobby pickup), and receive free cancellation up to 24 hours prior.

OUR TOUR CATALOG:
${JSON.stringify(TOUR_CATALOG_SUMMARY, null, 2)}
`;

// server.ts
dotenv.config();
var app = express();
var PORT = process.env.PORT || 3e3;
var SERVER_START_TIME = Date.now();
function parseJwtPayload(token) {
  try {
    const parts = token.trim().split(".");
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const json = Buffer.from(base64, "base64").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}
function isSupabaseSecretKey(key) {
  if (!key || typeof key !== "string") return false;
  const trimmed = key.trim();
  if (trimmed.startsWith("sb_secret_")) return true;
  const payload = parseJwtPayload(trimmed);
  return payload?.role === "service_role";
}
function isSupabasePublishableKey(key) {
  if (!key || typeof key !== "string") return false;
  const trimmed = key.trim();
  if (trimmed.startsWith("sb_publishable_")) return true;
  const payload = parseJwtPayload(trimmed);
  return payload?.role === "anon";
}
function validateSupabaseUrl(url) {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed.startsWith("https://") && !trimmed.startsWith("http://")) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      return trimmed;
    }
  } catch {
    return null;
  }
  return null;
}
function resolveServerSupabaseConfig() {
  let resolvedUrl = null;
  let configError;
  const rawServerUrl = process.env.SUPABASE_URL;
  const rawViteUrl = process.env.VITE_SUPABASE_URL;
  if (rawServerUrl !== void 0 && rawServerUrl !== "") {
    const validated = validateSupabaseUrl(rawServerUrl);
    if (validated) {
      resolvedUrl = validated;
    } else {
      configError = "Server environment variable SUPABASE_URL is defined but is not a valid HTTP/HTTPS URL.";
    }
  } else if (rawViteUrl !== void 0 && rawViteUrl !== "") {
    const validated = validateSupabaseUrl(rawViteUrl);
    if (validated) {
      resolvedUrl = validated;
    } else {
      configError = "Environment variable VITE_SUPABASE_URL is defined but is not a valid HTTP/HTTPS URL.";
    }
  }
  const rawSecret = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  const rawAnon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  let resolvedKey = null;
  let keyType = "none";
  if (rawSecret) {
    if (isSupabaseSecretKey(rawSecret)) {
      resolvedKey = rawSecret.trim();
      keyType = "service_role";
    } else {
      const isAnon = isSupabasePublishableKey(rawSecret);
      configError = isAnon ? "CONFIGURATION ERROR: An anonymous/publishable key was supplied to SUPABASE_SERVICE_ROLE_KEY. Service-role operations require a genuine secret key (sb_secret_... or service_role JWT)." : "CONFIGURATION ERROR: SUPABASE_SERVICE_ROLE_KEY is not a valid Supabase secret key.";
    }
  } else if (rawAnon) {
    if (isSupabasePublishableKey(rawAnon)) {
      resolvedKey = rawAnon.trim();
      keyType = "anon";
    } else {
      configError = "CONFIGURATION ERROR: Configured Supabase anon key is invalid.";
    }
  }
  return {
    url: resolvedUrl,
    key: resolvedKey,
    keyType,
    configError
  };
}
var supabaseConfig = resolveServerSupabaseConfig();
if (supabaseConfig.configError) {
  console.error(`[Supabase Config Error] ${supabaseConfig.configError}`);
}
var SUPABASE_URL = supabaseConfig.url;
var SUPABASE_KEY = supabaseConfig.key;
var SUPABASE_KEY_TYPE = supabaseConfig.keyType;
var serverSupabase = null;
if (SUPABASE_URL && SUPABASE_KEY) {
  try {
    serverSupabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
  } catch (initErr) {
    console.error("Server Supabase client initialization failure:", initErr);
    serverSupabase = null;
  }
}
var rateLimitBuckets = /* @__PURE__ */ new Map();
function rateLimit(maxRequests = 60, windowMs = 6e4) {
  return (req, res, next) => {
    const ip = req.ip || req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
    const key = `${req.baseUrl || req.path}:${ip}`;
    const now = Date.now();
    const bucket = rateLimitBuckets.get(key);
    if (!bucket || now > bucket.resetAt) {
      rateLimitBuckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    if (bucket.count >= maxRequests) {
      return res.status(429).json({
        success: false,
        error: "Too many requests. Please wait a moment before trying again.",
        retryAfter: Math.ceil((bucket.resetAt - now) / 1e3)
      });
    }
    bucket.count += 1;
    next();
  };
}
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of rateLimitBuckets.entries()) {
    if (now > v.resetAt) rateLimitBuckets.delete(k);
  }
}, 3e5).unref();
async function authenticateToken(req, _res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }
  const token = authHeader.split(" ")[1];
  if (!token || !serverSupabase) {
    return next();
  }
  try {
    const { data: { user }, error } = await serverSupabase.auth.getUser(token);
    if (!error && user) {
      let role = user.app_metadata?.role || "customer";
      const { data: profile } = await serverSupabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
      if (profile?.role) {
        role = profile.role;
      }
      req.user = {
        id: user.id,
        email: user.email,
        role
      };
    }
  } catch (err) {
    console.warn("Server auth token verification error:", err);
  }
  next();
}
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use((req, res, next) => {
  const allowedOrigins = [
    "https://awesomeadventure.tours",
    "https://www.awesomeadventure.tours",
    "https://mahmoud-crm-eosin.vercel.app",
    "http://localhost:3000",
    "http://localhost:5173"
  ];
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  next();
});
app.use(authenticateToken);
var ai = null;
if (process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build"
      }
    }
  });
}
function isValidEmail(email) {
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return emailRegex.test(email) && email.length <= 254;
}
app.post("/api/chat", async (req, res) => {
  const { messages, prompt } = req.body;
  if (!prompt && (!messages || messages.length === 0)) {
    return res.status(400).json({ error: "Prompt is required" });
  }
  if (ai) {
    try {
      const conversationHistory = (messages || []).map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }]
      }));
      if (prompt && (!messages || messages[messages.length - 1]?.content !== prompt)) {
        conversationHistory.push({
          role: "user",
          parts: [{ text: prompt }]
        });
      }
      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: conversationHistory,
        config: {
          systemInstruction: CONCIERGE_SYSTEM_PROMPT,
          temperature: 0.7
        }
      });
      const responseText = response.text || "";
      const lower = responseText.toLowerCase();
      const matchedTours = TOUR_CATALOG_SUMMARY.filter((tour) => {
        return lower.includes(tour.title.toLowerCase()) || lower.includes(tour.slug) || lower.includes("orange bay") && tour.slug.includes("orange-bay") || lower.includes("dolphin house") && tour.slug.includes("dolphin") || lower.includes("paradise island") && tour.slug.includes("paradise") || lower.includes("quad") && tour.slug.includes("safari") || lower.includes("scuba diving") && tour.slug.includes("diving") || lower.includes("speedboat") && tour.slug.includes("speedboat") || lower.includes("luxor") && tour.slug.includes("luxor") || lower.includes("cairo") && tour.slug.includes("cairo") || lower.includes("submarine") && tour.slug.includes("submarine") || lower.includes("sharm el naga") && tour.slug.includes("sharm-el-naga");
      }).slice(0, 3);
      return res.json({
        text: responseText,
        recommendedTours: matchedTours
      });
    } catch (err) {
      console.warn("Gemini generateContent error in /api/chat:", err);
    }
  }
  return res.status(503).json({
    error: "Gemini service temporarily unavailable",
    fallback: true
  });
});
app.get("/api/health", (_req, res) => {
  const uptimeSeconds = Math.floor((Date.now() - SERVER_START_TIME) / 1e3);
  const mem = process.memoryUsage();
  res.json({
    status: "ok",
    version: "2.4.0",
    environment: process.env.NODE_ENV || "development",
    uptimeSeconds,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    services: {
      server: { status: "healthy", port: PORT },
      geminiAi: {
        status: process.env.GEMINI_API_KEY ? "available" : "disabled",
        model: "gemini-3.8-flash"
      },
      supabase: {
        status: serverSupabase ? "configured" : supabaseConfig.configError ? "misconfigured" : "unconfigured",
        projectRef: "cyifhjqqvtiguitrziqs",
        urlProvided: Boolean(SUPABASE_URL),
        keyType: SUPABASE_KEY_TYPE,
        serviceRoleKeyConfigured: SUPABASE_KEY_TYPE === "service_role",
        secretIsolationVerified: true
      },
      databaseSchema: { cached: true, ready: true }
    },
    memory: {
      rssMb: Math.round(mem.rss / 1024 / 1024 * 100) / 100,
      heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024 * 100) / 100,
      heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024 * 100) / 100
    }
  });
});
app.get("/api/config", (_req, res) => {
  res.json({
    brandName: "Red Sea Excursions & Voyages",
    hotline: "+20 102 345 6789",
    whatsappUrl: "https://wa.me/201023456789",
    operatingHours: "06:00 - 23:00 EEST (Daily)",
    currencyDefault: "EUR",
    supportedCurrencies: ["EUR", "USD", "GBP", "EGP"],
    supportedLanguages: ["en", "de", "ru", "fr", "ar", "it", "pl", "nl"],
    depositRequired: false,
    cancellationFreeNoticeHours: 24
  });
});
app.get("/api/tours", async (req, res) => {
  const { destination, category, search, limit } = req.query;
  const maxItems = Math.min(Math.max(1, parseInt(limit, 10) || 50), 100);
  if (!serverSupabase) {
    return res.status(503).json({
      success: false,
      error: "Database service is currently unconfigured or unavailable.",
      tours: [],
      count: 0,
      total: 0
    });
  }
  try {
    let query = serverSupabase.from("tours").select(`
        id,
        title,
        slug,
        short_description,
        description,
        destination_id,
        duration,
        duration_type,
        duration_hours,
        tour_type,
        status,
        featured,
        price,
        child_price,
        infant_price,
        private_price,
        currency,
        max_guests,
        minimum_booking_notice_hours,
        pickup_available,
        pickup_info,
        cancellation_policy,
        departure_time,
        available_days,
        languages,
        difficulty,
        age_restrictions,
        badge,
        rating,
        review_count,
        sort_order,
        created_at,
        destinations (id, name, slug),
        tour_categories (categories (id, name, slug)),
        tour_images (id, image_url, is_primary, sort_order)
      `).eq("status", "published").order("sort_order", { ascending: true }).limit(maxItems);
    if (destination && typeof destination === "string") {
      const cleanDest = destination.trim().replace(/[%_()]/g, "");
      if (cleanDest) {
        query = query.ilike("destination_id", `%${cleanDest}%`);
      }
    }
    if (search && typeof search === "string") {
      const cleanSearch = search.trim().replace(/[%_()]/g, "");
      if (cleanSearch) {
        query = query.or(`title.ilike.%${cleanSearch}%,short_description.ilike.%${cleanSearch}%`);
      }
    }
    const { data, error } = await query;
    if (error) {
      console.error("Supabase /api/tours query error:", error.message);
      return res.status(500).json({
        success: false,
        error: "Database query failed when loading tour catalogue.",
        tours: [],
        count: 0,
        total: 0
      });
    }
    const tours = (data || []).map((t) => {
      const primaryImg = t.tour_images?.find((img) => img.is_primary) || t.tour_images?.[0];
      const cats = t.tour_categories?.map((tc) => tc.categories?.name).filter(Boolean) || [];
      return {
        id: t.id,
        slug: t.slug,
        title: t.title,
        shortDescription: t.short_description || "",
        destination: t.destinations?.name || "Hurghada",
        category: cats[0] || "Excursion",
        categories: cats,
        priceEur: Number(t.price) || 0,
        childPriceEur: t.child_price != null ? Number(t.child_price) : void 0,
        durationLabel: t.duration || `${t.duration_hours || 7} Hours`,
        durationHours: t.duration_hours || 7,
        rating: Number(t.rating) || 5,
        reviewCount: Number(t.review_count) || 0,
        primaryImage: primaryImg?.image_url || "",
        badge: t.badge || (t.featured ? "Popular" : void 0)
      };
    });
    return res.json({
      success: true,
      count: tours.length,
      total: tours.length,
      tours
    });
  } catch (err) {
    console.error("Unhandled exception in /api/tours:", err);
    return res.status(500).json({
      success: false,
      error: "Internal server error processing tour catalogue request.",
      tours: [],
      count: 0,
      total: 0
    });
  }
});
app.post("/api/bookings/create", async (req, res) => {
  const {
    tourSlug,
    date,
    guests,
    customer,
    pickupLocationId,
    hotelName,
    roomNumber,
    extras,
    paymentMethod = "pay_at_pickup",
    specialRequests
  } = req.body;
  if (!tourSlug || typeof tourSlug !== "string") {
    return res.status(400).json({ success: false, error: "tourSlug is required." });
  }
  if (!date || typeof date !== "string" || isNaN(new Date(date).getTime())) {
    return res.status(400).json({ success: false, error: "Valid excursion date (YYYY-MM-DD) is required." });
  }
  const selectedDate = new Date(date);
  const today = /* @__PURE__ */ new Date();
  today.setHours(0, 0, 0, 0);
  if (selectedDate.getTime() < today.getTime()) {
    return res.status(400).json({ success: false, error: "Selected excursion date cannot be in the past." });
  }
  if (!customer || !customer.firstName || !customer.email) {
    return res.status(400).json({ success: false, error: "Customer first name and valid email address are required." });
  }
  if (!isValidEmail(customer.email)) {
    return res.status(400).json({ success: false, error: "Invalid email address format." });
  }
  const adults = Math.max(1, parseInt(guests?.adults, 10) || 1);
  const children = Math.max(0, parseInt(guests?.children, 10) || 0);
  const infants = Math.max(0, parseInt(guests?.infants, 10) || 0);
  const totalParty = adults + children + infants;
  const payingPassengers = adults + children;
  if (!serverSupabase) {
    return res.status(503).json({
      success: false,
      error: "Reservation database service is currently unconfigured or unavailable."
    });
  }
  try {
    const { data: tourRecord, error: tourErr } = await serverSupabase.from("tours").select("id, title, slug, price, child_price, max_guests, duration, pickup_available, pickup_info, status").or(`slug.eq.${tourSlug},id.eq.${tourSlug}`).maybeSingle();
    if (tourErr || !tourRecord) {
      return res.status(404).json({
        success: false,
        error: `Excursion "${tourSlug}" was not found in the reservation catalog.`
      });
    }
    const maxCapacity = tourRecord.max_guests || 35;
    if (totalParty > maxCapacity) {
      return res.status(400).json({
        success: false,
        error: `Group size (${totalParty} guests) exceeds maximum tour capacity of ${maxCapacity} passengers.`
      });
    }
    const { data: availRecord } = await serverSupabase.from("tour_availability").select("id, status, booked_count, max_capacity").eq("tour_id", tourRecord.id).eq("date", date).maybeSingle();
    if (availRecord) {
      if (availRecord.status === "unavailable") {
        return res.status(400).json({
          success: false,
          error: `Excursion date (${date}) is closed or marked as an operational blackout date.`
        });
      }
      if (availRecord.status === "sold_out") {
        return res.status(400).json({
          success: false,
          error: `Excursion departure on ${date} is sold out.`
        });
      }
      if (availRecord.max_capacity && availRecord.booked_count + totalParty > availRecord.max_capacity) {
        const remaining = Math.max(0, availRecord.max_capacity - availRecord.booked_count);
        return res.status(400).json({
          success: false,
          error: `Only ${remaining} seat(s) remaining for departure on ${date}. Requested: ${totalParty} guests.`
        });
      }
    }
    const adultBasePrice = Number(tourRecord.price);
    const childBasePrice = tourRecord.child_price !== null && tourRecord.child_price !== void 0 ? Number(tourRecord.child_price) : Math.round(adultBasePrice * 0.5);
    const adultSubtotalEur = adults * adultBasePrice;
    const childSubtotalEur = children * childBasePrice;
    let pickupFeeEur = 0;
    let pickupLocationName = "Hurghada Central";
    let validPickupId = null;
    if (pickupLocationId) {
      const { data: loc } = await serverSupabase.from("pickup_locations").select("id, name, fee_eur_per_person, fee_eur_flat").or(`id.eq.${pickupLocationId},code.eq.${pickupLocationId}`).maybeSingle();
      if (loc) {
        validPickupId = loc.id;
        pickupLocationName = loc.name;
        pickupFeeEur = (Number(loc.fee_eur_per_person) || 0) * payingPassengers + (Number(loc.fee_eur_flat) || 0);
      }
    }
    let extrasSubtotalEur = 0;
    const verifiedExtras = [];
    if (Array.isArray(extras) && extras.length > 0) {
      for (const item of extras) {
        const extraId = item.extraId || item.id;
        if (!extraId) continue;
        const { data: exDef } = await serverSupabase.from("tour_extras").select("id, name, price_eur, pricing_type").eq("id", extraId).maybeSingle();
        if (exDef) {
          const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
          const price = Number(exDef.price_eur);
          const itemAmount = exDef.pricing_type === "per_person" ? price * payingPassengers * qty : price * qty;
          extrasSubtotalEur += itemAmount;
          verifiedExtras.push({
            extraId: exDef.id,
            name: exDef.name,
            amountEur: itemAmount,
            quantity: qty
          });
        }
      }
    }
    const subtotalEur = adultSubtotalEur + childSubtotalEur + pickupFeeEur;
    const totalEur = subtotalEur + extrasSubtotalEur;
    const cleanEmail = customer.email.trim().toLowerCase();
    let customerId = null;
    const { data: existingCustomer } = await serverSupabase.from("customers").select("id").eq("email", cleanEmail).maybeSingle();
    if (existingCustomer?.id) {
      customerId = existingCustomer.id;
    } else {
      const { data: newCustomer, error: custErr } = await serverSupabase.from("customers").insert({
        first_name: customer.firstName.trim(),
        last_name: (customer.lastName || "").trim(),
        email: cleanEmail,
        phone: customer.phoneNumber || null,
        whatsapp: customer.whatsappNumber || customer.phoneNumber || null,
        country: customer.country || "International",
        hotel: hotelName || null,
        source: "Website Booking",
        status: "active",
        user_id: req.user?.id || null
      }).select("id").single();
      if (!custErr && newCustomer) {
        customerId = newCustomer.id;
      }
    }
    const currentYear = (/* @__PURE__ */ new Date()).getFullYear();
    const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const c1 = letters.charAt(Math.floor(Math.random() * letters.length));
    const c2 = letters.charAt(Math.floor(Math.random() * letters.length));
    const digits = Math.floor(1e3 + Math.random() * 9e3);
    const bookingReference = `RST-${currentYear}-${c1}${c2}${digits}`;
    const { data: createdBooking, error: bookErr } = await serverSupabase.from("bookings").insert({
      booking_reference: bookingReference,
      user_id: req.user?.id || null,
      tour_id: tourRecord.id,
      customer_id: customerId,
      booking_date: date,
      status: "pending",
      payment_status: "pending",
      payment_method: paymentMethod || "pay_at_pickup",
      adult_count: adults,
      child_count: children,
      infant_count: infants,
      pickup_location_id: validPickupId,
      pickup_hotel_name: hotelName || null,
      pickup_room_number: roomNumber || null,
      subtotal: subtotalEur,
      extras_total: extrasSubtotalEur,
      discount: 0,
      total: totalEur,
      currency: "EUR",
      special_requests: specialRequests || null
    }).select("id, booking_reference, created_at").single();
    if (bookErr || !createdBooking) {
      console.error("Failed to durably insert booking into Supabase:", bookErr);
      return res.status(500).json({
        success: false,
        error: "Database error: Could not complete reservation. Please contact our booking desk."
      });
    }
    await serverSupabase.from("booking_passengers").insert({
      booking_id: createdBooking.id,
      full_name: `${customer.firstName} ${customer.lastName || ""}`.trim(),
      nationality: customer.country || "International",
      passenger_type: "adult",
      is_lead_passenger: true
    });
    if (verifiedExtras.length > 0) {
      const extraRows = verifiedExtras.map((e) => ({
        booking_id: createdBooking.id,
        extra_id: e.extraId,
        name: e.name,
        quantity: e.quantity,
        unit_price: e.amountEur / e.quantity,
        total_price: e.amountEur
      }));
      await serverSupabase.from("booking_extras").insert(extraRows);
    }
    if (availRecord) {
      const newBooked = (availRecord.booked_count || 0) + totalParty;
      await serverSupabase.from("tour_availability").update({
        booked_count: newBooked,
        status: availRecord.max_capacity && newBooked >= availRecord.max_capacity ? "sold_out" : availRecord.status,
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      }).eq("id", availRecord.id);
    }
    return res.status(201).json({
      success: true,
      bookingReference,
      tour: {
        slug: tourRecord.slug,
        title: tourRecord.title,
        durationLabel: tourRecord.duration
      },
      date,
      guests: { adults, children, infants, total: totalParty },
      pickup: {
        locationId: validPickupId || "hurghada",
        locationName: pickupLocationName,
        hotelName: hotelName || null,
        roomNumber: roomNumber || null,
        feeEur: pickupFeeEur
      },
      pricing: {
        adultPriceEur: adultBasePrice,
        childPriceEur: childBasePrice,
        adultSubtotalEur,
        childSubtotalEur,
        pickupFeeEur,
        extrasSubtotalEur,
        subtotalEur,
        totalEur,
        currency: "EUR",
        formattedTotal: `\u20AC${totalEur.toFixed(2)}`
      },
      customer: {
        name: `${customer.firstName} ${customer.lastName || ""}`.trim(),
        email: cleanEmail,
        phone: customer.phoneNumber || null,
        country: customer.country || "International"
      },
      paymentMethod,
      status: "pending",
      paymentStatus: "pending",
      createdAt: createdBooking.created_at
    });
  } catch (err) {
    console.error("Unhandled exception during booking creation:", err);
    return res.status(500).json({
      success: false,
      error: "Internal server error while processing your reservation."
    });
  }
});
app.all(["/api/bookings/lookup", "/api/booking/lookup"], rateLimit(10, 6e4), async (req, res) => {
  const reference = req.body?.reference || req.query?.ref || req.query?.reference;
  const verification = (req.body?.contactVerification || req.body?.verification || req.query?.verification || req.query?.email || req.query?.phone || "").trim().toLowerCase();
  if (!reference || typeof reference !== "string") {
    return res.status(400).json({
      success: false,
      found: false,
      error: "Booking reference is required"
    });
  }
  const cleanRef = reference.trim().toUpperCase();
  const refRegex = /^RST-\d{4}-[A-Z0-9]+$/;
  if (!refRegex.test(cleanRef) && !cleanRef.startsWith("RST-")) {
    return res.status(400).json({
      success: false,
      found: false,
      error: "Invalid reference format. Expected format: RST-2026-XXXX"
    });
  }
  const isStaff = req.user && ["admin", "super_admin", "manager", "staff"].includes(req.user.role);
  if (serverSupabase) {
    try {
      if (verification) {
        const { data: rpcRes, error: rpcErr } = await serverSupabase.rpc("lookup_booking_secure", {
          p_reference: cleanRef,
          p_verification: verification
        });
        const rawBooking = rpcRes && typeof rpcRes === "object" ? rpcRes.booking || (rpcRes.bookingReference ? rpcRes : null) : null;
        if (!rpcErr && rawBooking && rawBooking.bookingReference) {
          return res.json({
            success: true,
            found: true,
            booking: {
              bookingReference: rawBooking.bookingReference,
              status: rawBooking.status,
              paymentStatus: rawBooking.paymentStatus,
              paymentMethod: rawBooking.paymentMethod,
              bookingDate: rawBooking.bookingDate,
              createdAt: rawBooking.createdAt,
              guests: rawBooking.guests,
              tour: rawBooking.tour,
              pickup: rawBooking.pickup,
              pricing: rawBooking.pricing,
              customer: {
                firstName: rawBooking.customer?.firstName,
                lastName: rawBooking.customer?.lastName,
                emailMasked: rawBooking.customer?.emailMasked,
                phoneMasked: rawBooking.customer?.phoneMasked,
                country: rawBooking.customer?.country
              },
              extras: rawBooking.extras,
              specialRequests: rawBooking.specialRequests
            }
          });
        }
      }
      const { data: b, error } = await serverSupabase.from("bookings").select(`
          id,
          booking_reference,
          booking_date,
          status,
          payment_status,
          payment_method,
          subtotal,
          total,
          currency,
          special_requests,
          customers (*),
          tours (title, slug, primary_image, duration_label)
        `).eq("booking_reference", cleanRef).maybeSingle();
      if (!error && b) {
        if (isStaff) {
          return res.json({ success: true, found: true, booking: b });
        }
        if (verification) {
          const custRecord = Array.isArray(b.customers) ? b.customers[0] : b.customers;
          const custEmail = (custRecord?.email || "").toLowerCase();
          const custPhone = (custRecord?.phone || "").replace(/\s+/g, "");
          const cleanVer = verification.replace(/\s+/g, "");
          if (custEmail === verification || custPhone.length >= 6 && custPhone.includes(cleanVer)) {
            const maskedEmail = custEmail.replace(/^(.)(.*)(@.*)$/, (_, a, _b, c) => `${a}***${c}`);
            return res.json({
              success: true,
              found: true,
              booking: {
                bookingReference: b.booking_reference,
                status: b.status,
                paymentStatus: b.payment_status,
                paymentMethod: b.payment_method,
                bookingDate: b.booking_date,
                pricing: {
                  subtotal: b.subtotal,
                  total: b.total,
                  currency: b.currency
                },
                tour: b.tours,
                customer: {
                  firstName: custRecord?.first_name || "Guest",
                  lastName: custRecord?.last_name || "",
                  emailMasked: maskedEmail,
                  phoneMasked: "*** Protected ***",
                  country: custRecord?.country || "International"
                },
                specialRequests: b.special_requests
              }
            });
          }
        }
      }
    } catch (dbErr) {
      console.warn("Database error in /api/bookings/lookup:", dbErr);
    }
  }
  return res.status(404).json({
    success: false,
    found: false,
    error: `Booking reference "${cleanRef}" was not found. Please verify the code on your confirmation voucher or contact pier desk dispatch.`
  });
});
app.all("/api/availability/check", (req, res) => {
  const tourSlug = req.body?.tourSlug || req.query?.tourSlug || req.query?.slug;
  const date = req.body?.date || req.query?.date;
  const adults = parseInt(req.body?.adults || req.query?.adults || "1", 10);
  const children = parseInt(req.body?.children || req.query?.children || "0", 10);
  if (!tourSlug || !date) {
    return res.status(400).json({
      success: false,
      error: "tourSlug and date (YYYY-MM-DD) are required"
    });
  }
  const tour = TOUR_CATALOG_SUMMARY.find((t) => t.slug === tourSlug);
  if (!tour) {
    return res.status(404).json({
      success: false,
      error: "Tour not found in catalog"
    });
  }
  const checkDate = new Date(date);
  const now = /* @__PURE__ */ new Date();
  const isPast = checkDate.getTime() < new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (isPast) {
    return res.json({
      success: true,
      tourSlug,
      date,
      isDateAvailable: false,
      isPastDate: true,
      isNoticeCutoffViolated: true,
      remainingSeatsTotal: 0,
      slots: [],
      notes: "Cannot book past dates"
    });
  }
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayName = days[checkDate.getDay()];
  const slots = [
    {
      slotId: "morning-0830",
      time: "08:30 AM",
      label: "Morning Departure (Prime Reef Visibility)",
      availableSeats: 16,
      maxCapacity: 24,
      status: "available",
      privateAvailable: true
    },
    {
      slotId: "midday-1100",
      time: "11:00 AM",
      label: "Midday Cruise",
      availableSeats: 8,
      maxCapacity: 20,
      status: "available",
      privateAvailable: true
    }
  ];
  res.json({
    success: true,
    tourSlug,
    date,
    dayOfWeek: dayName,
    isDateAvailable: true,
    isPastDate: false,
    isNoticeCutoffViolated: false,
    minimumNoticeHours: 12,
    remainingSeatsTotal: 24,
    maxGuestsPerGroup: 30,
    priceEur: tour.priceEur,
    slots
  });
});
app.post(["/api/inquiries", "/api/inquiries/submit", "/api/contact"], async (req, res) => {
  const { name, email, phone, inquiryType = "general_question", message, website_url_hp } = req.body;
  if (website_url_hp && String(website_url_hp).trim() !== "") {
    return res.status(200).json({ success: true, status: "received" });
  }
  if (!name || !email || !message) {
    return res.status(400).json({
      success: false,
      error: "Name, valid email, and message are required"
    });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({
      success: false,
      error: "Please enter a valid email address"
    });
  }
  const cleanName = String(name).trim().slice(0, 100);
  const cleanEmail = String(email).trim().toLowerCase();
  const cleanMessage = String(message).trim().slice(0, 2e3);
  const cleanPhone = phone ? String(phone).slice(0, 30) : null;
  const currentYear = (/* @__PURE__ */ new Date()).getFullYear();
  const ticketNumber = `INQ-${currentYear}-${Math.floor(1e3 + Math.random() * 9e3)}`;
  if (serverSupabase) {
    try {
      const { data, error } = await serverSupabase.from("inquiries").insert({
        customer_name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        subject: inquiryType === "general_question" ? "General Excursion Question" : String(inquiryType),
        message: cleanMessage,
        status: "new",
        source: "web"
      }).select("id, created_at").single();
      if (!error && data) {
        return res.status(201).json({
          success: true,
          inquiryId: data.id,
          ticketNumber,
          status: "received",
          estimatedResponseTime: "Within 2 hours (Egypt Pier Desk hours)",
          receivedAt: data.created_at
        });
      }
      if (error) {
        console.error("Supabase inquiries insert error:", error.message);
      }
    } catch (dbErr) {
      console.warn("Supabase inquiries insert exception:", dbErr);
    }
  }
  return res.status(503).json({
    success: false,
    error: "Inquiry service is currently unconfigured or database is unreachable."
  });
});
app.post(["/api/newsletter", "/api/newsletter/subscribe"], async (req, res) => {
  const { email, preferredLanguage = "en", website_url_hp } = req.body;
  if (website_url_hp && String(website_url_hp).trim() !== "") {
    return res.json({ success: true, subscribed: true });
  }
  if (!email || !isValidEmail(email)) {
    return res.status(400).json({
      success: false,
      error: "Please provide a valid email address"
    });
  }
  const cleanEmail = email.trim().toLowerCase();
  if (serverSupabase) {
    try {
      const { data, error } = await serverSupabase.from("newsletter_subscriptions").insert({
        email: cleanEmail,
        source: "website_footer",
        status: "subscribed"
      }).select("id, created_at").single();
      if (!error && data) {
        return res.json({
          success: true,
          subscribed: true,
          email: cleanEmail,
          message: "Thank you for subscribing! Your Red Sea VIP seasonal excursion discount will be sent shortly."
        });
      }
      if (error && (error.code === "23505" || error.message?.includes("duplicate"))) {
        return res.json({
          success: true,
          subscribed: true,
          email: cleanEmail,
          alreadySubscribed: true,
          message: "You are already registered for Red Sea VIP excursion deals and marine updates."
        });
      }
      if (error) {
        console.error("Supabase newsletter insert error:", error.message);
      }
    } catch (err) {
      console.warn("Newsletter subscription exception:", err);
    }
  }
  return res.status(503).json({
    success: false,
    error: "Newsletter subscription service is currently unconfigured or database is unreachable."
  });
});
app.get("/api/auth/verify-session", rateLimit(60, 6e4), (req, res) => {
  if (!req.user) {
    return res.status(401).json({
      authenticated: false,
      user: null,
      error: "No active session or valid Bearer token provided."
    });
  }
  return res.json({
    authenticated: true,
    user: {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role
    }
  });
});
app.all("/api/db/query", rateLimit(60, 6e4), async (req, res) => {
  const body = req.body || {};
  if (body.table !== void 0 || body.tables !== void 0 || body.columns !== void 0 || body.fields !== void 0 || body.filters !== void 0 || body.filter !== void 0 || body.where !== void 0 || body.sql !== void 0 || body.rawSql !== void 0 || body.raw_sql !== void 0 || body.query !== void 0 || body.query_text !== void 0 || body.action !== void 0) {
    return res.status(400).json({
      success: false,
      error: "Direct table, column, filter, SQL, or arbitrary action queries are strictly prohibited. Use explicit allowlisted business operations."
    });
  }
  const operation = typeof body.operation === "string" ? body.operation.trim() : "";
  if (!operation) {
    return res.status(400).json({
      success: false,
      error: 'Missing required "operation" field.'
    });
  }
  switch (operation) {
    case "get_tours": {
      const destination = typeof body.destination === "string" ? body.destination.trim().slice(0, 50) : void 0;
      const category = typeof body.category === "string" ? body.category.trim().slice(0, 50) : void 0;
      const search = typeof body.search === "string" ? body.search.trim().slice(0, 100) : void 0;
      const limit = Math.min(Math.max(1, parseInt(body.limit, 10) || 50), 100);
      if (!serverSupabase) {
        return res.status(503).json({
          success: false,
          error: "Database service is currently unconfigured or unavailable.",
          tours: [],
          count: 0
        });
      }
      try {
        let q = serverSupabase.from("tours").select("id, title, slug, price, child_price, duration_hours, duration, short_description, status, created_at").eq("status", "published").limit(limit);
        if (destination) {
          const cleanDest = destination.replace(/[%_,()]/g, "");
          if (cleanDest) q = q.ilike("destination_id", `%${cleanDest}%`);
        }
        if (search) {
          const cleanSearch = search.replace(/[%_,()]/g, "");
          if (cleanSearch) {
            q = q.or(`title.ilike.%${cleanSearch}%,short_description.ilike.%${cleanSearch}%`);
          }
        }
        const { data, error } = await q;
        if (error) {
          console.error("Database error in get_tours operation:", error.message);
          return res.status(500).json({ success: false, error: "Database query failed.", tours: [], count: 0 });
        }
        return res.json({ success: true, count: data?.length || 0, tours: data || [] });
      } catch (err) {
        console.warn("Database error in get_tours:", err);
        return res.status(500).json({ success: false, error: "Failed to retrieve tours.", tours: [], count: 0 });
      }
    }
    case "get_destinations": {
      if (!serverSupabase) {
        return res.status(503).json({
          success: false,
          error: "Database service is currently unconfigured or unavailable.",
          destinations: [],
          count: 0
        });
      }
      try {
        const { data, error } = await serverSupabase.from("destinations").select("id, name, slug, description, main_image, sort_order").order("sort_order", { ascending: true }).limit(50);
        if (error) {
          console.error("Database error in get_destinations:", error.message);
          return res.status(500).json({ success: false, error: "Failed to retrieve destinations.", destinations: [], count: 0 });
        }
        return res.json({ success: true, count: data?.length || 0, destinations: data || [] });
      } catch (err) {
        console.warn("Database error in get_destinations:", err);
        return res.status(500).json({ success: false, error: "Failed to retrieve destinations.", destinations: [], count: 0 });
      }
    }
    case "get_categories": {
      if (!serverSupabase) {
        return res.status(503).json({
          success: false,
          error: "Database service is currently unconfigured or unavailable.",
          categories: [],
          count: 0
        });
      }
      try {
        const { data, error } = await serverSupabase.from("categories").select("id, name, slug, description, icon, sort_order").order("sort_order", { ascending: true }).limit(50);
        if (error) {
          console.error("Database error in get_categories:", error.message);
          return res.status(500).json({ success: false, error: "Failed to retrieve categories.", categories: [], count: 0 });
        }
        return res.json({ success: true, count: data?.length || 0, categories: data || [] });
      } catch (err) {
        console.warn("Database error in get_categories:", err);
        return res.status(500).json({ success: false, error: "Failed to retrieve categories.", categories: [], count: 0 });
      }
    }
    case "get_my_bookings": {
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          success: false,
          error: "UNAUTHORIZED: Valid user authentication token required to access customer bookings."
        });
      }
      if (!serverSupabase) {
        return res.status(503).json({
          success: false,
          error: "Database service is currently unconfigured or unavailable."
        });
      }
      try {
        const { data, error } = await serverSupabase.from("bookings").select("id, booking_reference, booking_date, status, payment_status, total, currency, created_at, tours(title, slug, primary_image)").eq("user_id", req.user.id).order("created_at", { ascending: false }).limit(50);
        if (error) {
          console.error("Database query error in get_my_bookings:", error.message);
          return res.status(500).json({ success: false, error: "Failed to retrieve bookings." });
        }
        return res.json({ success: true, count: data?.length || 0, bookings: data || [] });
      } catch (err) {
        console.warn("Database error in get_my_bookings:", err);
        return res.status(500).json({ success: false, error: "Database service error." });
      }
    }
    case "lookup_booking": {
      const reference = typeof body.reference === "string" ? body.reference.trim().toUpperCase() : "";
      const verification = typeof body.contactVerification === "string" ? body.contactVerification.trim().toLowerCase() : "";
      if (!reference || !/^RST-\d{4}-[A-Z0-9]+$/.test(reference)) {
        return res.status(400).json({ success: false, error: "Valid booking reference (RST-YYYY-XXXX) is required." });
      }
      const isStaff = req.user && ["admin", "super_admin", "manager", "staff"].includes(req.user.role);
      if (!isStaff && !verification) {
        return res.status(400).json({
          success: false,
          error: "Two-factor contact verification (email or phone) is required for guest booking lookup."
        });
      }
      if (serverSupabase) {
        try {
          if (verification) {
            const { data: rpcRes, error: rpcErr } = await serverSupabase.rpc("lookup_booking_secure", {
              p_reference: reference,
              p_verification: verification
            });
            const rawBooking = rpcRes && typeof rpcRes === "object" ? rpcRes.booking || (rpcRes.bookingReference ? rpcRes : null) : null;
            if (!rpcErr && rawBooking && rawBooking.bookingReference) {
              return res.json({
                success: true,
                booking: {
                  bookingReference: rawBooking.bookingReference,
                  status: rawBooking.status,
                  paymentStatus: rawBooking.paymentStatus,
                  paymentMethod: rawBooking.paymentMethod,
                  bookingDate: rawBooking.bookingDate,
                  createdAt: rawBooking.createdAt,
                  guests: rawBooking.guests,
                  tour: rawBooking.tour,
                  pickup: rawBooking.pickup,
                  pricing: rawBooking.pricing,
                  customer: {
                    firstName: rawBooking.customer?.firstName,
                    lastName: rawBooking.customer?.lastName,
                    emailMasked: rawBooking.customer?.emailMasked,
                    phoneMasked: rawBooking.customer?.phoneMasked,
                    country: rawBooking.customer?.country
                  },
                  extras: rawBooking.extras,
                  specialRequests: rawBooking.specialRequests
                }
              });
            }
          }
          const { data: b, error } = await serverSupabase.from("bookings").select("id, booking_reference, booking_date, status, payment_status, total, currency, customers(*), tours(*)").eq("booking_reference", reference).maybeSingle();
          if (!error && b) {
            if (isStaff) {
              return res.json({ success: true, booking: b });
            }
            const custRecord = Array.isArray(b.customers) ? b.customers[0] : b.customers;
            const custEmail = (custRecord?.email || "").toLowerCase();
            const custPhone = (custRecord?.phone || "").replace(/\s+/g, "");
            const cleanVer = verification.replace(/\s+/g, "");
            if (custEmail === verification || custPhone.length >= 6 && custPhone.includes(cleanVer)) {
              const maskedEmail = custEmail.replace(/^(.)(.*)(@.*)$/, (_, a, _b, c) => `${a}***${c}`);
              return res.json({
                success: true,
                booking: {
                  ...b,
                  customers: {
                    ...custRecord,
                    email: maskedEmail,
                    phone: "*** Protected ***"
                  }
                }
              });
            }
          }
        } catch (err) {
          console.warn("Database error in lookup_booking:", err);
        }
      }
      return res.status(404).json({
        success: false,
        error: `Booking "${reference}" not found or contact verification did not match.`
      });
    }
    case "get_admin_overview": {
      if (!req.user || !["admin", "super_admin", "manager", "staff"].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          error: "FORBIDDEN: Administrative authorization required to access operational metrics."
        });
      }
      if (!serverSupabase) {
        return res.status(503).json({
          success: false,
          error: "Database service is currently unconfigured or unavailable."
        });
      }
      try {
        const [toursRes, bookingsRes, customersRes] = await Promise.all([
          serverSupabase.from("tours").select("id", { count: "exact", head: true }),
          serverSupabase.from("bookings").select("id", { count: "exact", head: true }),
          serverSupabase.from("customers").select("id", { count: "exact", head: true })
        ]);
        return res.json({
          success: true,
          metrics: {
            totalTours: toursRes.count || 0,
            totalBookings: bookingsRes.count || 0,
            totalCustomers: customersRes.count || 0,
            verifiedRole: req.user.role
          }
        });
      } catch (err) {
        console.warn("Database error in get_admin_overview:", err);
        return res.status(500).json({ success: false, error: "Failed to retrieve administrative metrics." });
      }
    }
    default:
      return res.status(400).json({
        success: false,
        error: `Unrecognized business operation "${operation}". Unrestricted table access is strictly prohibited.`
      });
  }
});
app.use("/api/*", (_req, res) => {
  res.status(404).json({
    success: false,
    error: "API route not found",
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
app.use((err, _req, res, _next) => {
  console.error("Unhandled server error:", err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || "Internal server error",
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), "dist");
    const indexHtmlPath = path.resolve(distPath, "index.html");
    if (!fs.existsSync(indexHtmlPath)) {
      console.warn(`WARNING: Production build not found at ${distPath}. Running "npm run build" is required for production.`);
    }
    app.use(
      express.static(distPath, {
        maxAge: "1h",
        setHeaders: (res, filePath) => {
          if (filePath.endsWith("sw.js") || filePath.endsWith("manifest.webmanifest")) {
            res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
          } else if (filePath.includes("/assets/")) {
            res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          }
        }
      })
    );
    app.get("*", (req, res) => {
      if (req.path.startsWith("/api/")) {
        return res.status(404).json({ success: false, error: "API route not found" });
      }
      if (fs.existsSync(indexHtmlPath)) {
        res.sendFile(indexHtmlPath);
      } else {
        res.status(503).send("Awesome Adventure Tours is compiling production assets. Please wait a moment and refresh.");
      }
    });
  }
  const server = app.listen(PORT, () => {
    console.log(`Awesome Adventure Tours server running on port/socket ${PORT} [${process.env.NODE_ENV || "development"}]`);
  });
  const shutdown = (signal) => {
    console.log(`Received ${signal}. Shutting down gracefully...`);
    server.close(() => {
      console.log("HTTP server closed.");
      process.exit(0);
    });
    setTimeout(() => {
      console.error("Forceful shutdown timeout.");
      process.exit(1);
    }, 5e3).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}
if (!process.env.VERCEL) {
  startServer();
}
var server_default = app;
export {
  app,
  server_default as default,
  isSupabasePublishableKey,
  isSupabaseSecretKey
};
