import { ALL_TOURS } from '../data/toursData';
import { Tour } from '../types';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  recommendedTours?: Tour[];
}

/**
 * Searches the response text or user query for matches in ALL_TOURS
 */
export function extractMatchingTours(text: string): Tour[] {
  const lower = text.toLowerCase();
  const matched: Tour[] = [];

  for (const tour of ALL_TOURS) {
    const titleLower = tour.title.toLowerCase();
    const slugLower = tour.slug.toLowerCase();

    // Check direct slug or distinctive keywords from title
    const keywords = titleLower
      .replace(/[()&,]/g, ' ')
      .split(' ')
      .filter((w) => w.length > 4);

    let matchCount = 0;
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        matchCount++;
      }
    }

    if (
      lower.includes(slugLower) || 
      lower.includes(titleLower) ||
      matchCount >= 2 ||
      (lower.includes('orange bay') && tour.slug.includes('orange-bay')) ||
      (lower.includes('dolphin') && tour.slug.includes('dolphin')) ||
      (lower.includes('paradise') && tour.slug.includes('paradise')) ||
      (lower.includes('quad') && tour.slug.includes('safari')) ||
      (lower.includes('diving') && tour.slug.includes('diving')) ||
      (lower.includes('speedboat') && tour.slug.includes('speedboat')) ||
      (lower.includes('luxor') && tour.slug.includes('luxor')) ||
      (lower.includes('cairo') && tour.slug.includes('cairo')) ||
      (lower.includes('submarine') && tour.slug.includes('submarine')) ||
      (lower.includes('sharm el naga') && tour.slug.includes('sharm-el-naga'))
    ) {
      if (!matched.some((m) => m.id === tour.id)) {
        matched.push(tour);
      }
    }
  }

  return matched.slice(0, 3);
}

/**
 * Fallback recommendation engine in case server API is offline or without key
 */
function generateSmartFallback(userPrompt: string): { content: string; recommendedTours: Tour[] } {
  const p = userPrompt.toLowerCase();
  let content = '';
  let tours: Tour[] = [];

  if (p.includes('dolphin') || p.includes('delphin') || p.includes('дельфин')) {
    const tour = ALL_TOURS.find((t) => t.slug === 'dolphin-house-snorkeling') || ALL_TOURS[1];
    tours = [tour];
    content = `Ahlan! If you want to encounter wild dolphins in their natural habitat, our **Dolphin House Snorkeling Sanctuary** is the premier trip!

• **Why it's special:** We sail to Shaab El Erg reef lagoon where resident pods of spinner and bottlenose dolphins rest and play in crystal waters.
• **Price:** €${tour.priceEur} / person (kids €${tour.childPriceEur})
• **Inclusions:** 2 guided reef snorkeling stops, fresh onboard buffet lunch, hotel pickup & return transfer across Hurghada.
• **Tip:** Morning visibility is around 25-30m. Snorkeling gear & life jackets are provided onboard!`;
  } else if (p.includes('family') || p.includes('kid') || p.includes('child') || p.includes('kinder') || p.includes('orange')) {
    const tour1 = ALL_TOURS.find((t) => t.slug === 'orange-bay-island-snorkeling') || ALL_TOURS[0];
    const tour2 = ALL_TOURS.find((t) => t.slug === 'paradise-island-trip') || ALL_TOURS[2];
    tours = [tour1, tour2];
    content = `For families with children and travelers seeking relaxing shallow turquoise waters, **Orange Bay** and **Paradise Island** on Giftun Island are absolute favorites!

1. **${tour1.title}** (€${tour1.priceEur})
   • Shallow, crystal-clear white sandbars perfect for children to safely paddle and swim.
   • Relaxing shaded beanbags, wooden beach swings, and fresh buffet lunch onboard.

2. **${tour2.title}** (€${tour2.priceEur})
   • Vibrant tropical beach resort with parasols, sunbeds, and gentle shore access.
   
Both excursions include hotel lobby pickup and return, life jackets for all ages, and two guided reef snorkeling sessions.`;
  } else if (p.includes('safari') || p.includes('quad') || p.includes('desert') || p.includes('buggy') || p.includes('atv')) {
    const tour = ALL_TOURS.find((t) => t.slug === 'super-safari-quad-buggy') || ALL_TOURS[3];
    tours = [tour];
    content = `Ready for an adrenaline rush across the desert mountain dunes? Our **Mega Desert Quad & Buggy Safari** is a must-do!

• **Highlights:** Drive powerful 250cc ATVs across desert mountain canyons, ride spider buggies, visit an authentic Bedouin village, and enjoy an evening barbecue dinner with oriental folklore show under the stars.
• **Price:** €${tour.priceEur} / person (includes transfer, quad riding, Bedouin dinner & tea).
• **Tip:** We provide protective scarves and safety goggles at our desert base. Wear comfortable closed shoes!`;
  } else if (p.includes('diving') || p.includes('scuba') || p.includes('tauchen') || p.includes('padi')) {
    const tour = ALL_TOURS.find((t) => t.slug === 'scuba-diving-beginners') || ALL_TOURS[4];
    tours = [tour];
    content = `The Red Sea is internationally renowned as one of the top 3 scuba diving destinations in the world!

For beginners or uncertified divers, our **Scuba Diving for Beginners (Intro Dive)** includes:
• **2 boat dives** accompanied 1-on-1 by certified PADI dive instructors down to a safe depth of 6–10 meters.
• Full professional Cressi/Mares equipment, safety briefing, and fresh lunch onboard.
• **Price:** €${tour.priceEur} / person.
• Certified divers are also welcome to join for guided deep drift and pinnacle dives!`;
  } else if (p.includes('luxor') || p.includes('cairo') || p.includes('pyramid') || p.includes('history') || p.includes('karnak')) {
    const tour1 = ALL_TOURS.find((t) => t.slug === 'luxor-day-trip-kings-valley') || ALL_TOURS[6];
    const tour2 = ALL_TOURS.find((t) => t.slug === 'cairo-pyramids-day-trip') || ALL_TOURS[7];
    tours = [tour1, tour2];
    content = `Egypt's ancient historical wonders are easily accessible on a day excursion from your Red Sea resort!

1. **${tour1.title}** (€${tour1.priceEur})
   • Journey to Luxor: Visit Karnak Temple, Colossi of Memnon, Hatshepsut Temple, and the tombs inside the Valley of the Kings with an Egyptologist guide.

2. **${tour2.title}** (€${tour2.priceEur})
   • Explore Cairo: See the Great Pyramids of Giza, the Sphinx, and the Egyptian Antiquities Museum.

Both trips include air-conditioned coach transfers, lunch at a local restaurant, and entry tickets.`;
  } else if (p.includes('private') || p.includes('charter') || p.includes('vip') || p.includes('couple') || p.includes('romantic')) {
    const tour = ALL_TOURS.find((t) => t.slug === 'private-speedboat-charter') || ALL_TOURS[5];
    tours = [tour];
    content = `Looking for privacy, flexibility, or a romantic excursion? Our **Private Speedboat Charter** gives you an exclusive luxury vessel with your own private captain!

• **Flexibility:** Custom itinerary tailored to you—visit secret sandbars, snorkel with wild dolphins away from crowded big boats, or dock at Orange Bay early.
• **Price:** €${tour.priceEur} per boat (up to 6 guests).
• **Inclusions:** Captain, fuel, private hotel transfers, snorkeling gear, fresh fruit platter, and soft drinks.`;
  } else if (p.includes('book') || p.includes('reservation') || p.includes('how to') || p.includes('pay') || p.includes('cash') || p.includes('reserve')) {
    tours = ALL_TOURS.slice(0, 2);
    content = `Booking your Red Sea excursion is fast, simple, and completely risk-free:

• **Direct Booking from Chat:** Simply click the **"Book"** button on any excursion card above or below to start reservation instantly!
• **Pay on Pickup Option:** Zero upfront card payment needed if you prefer—you can select "Pay at Pickup" and pay in cash (EUR, USD, GBP, EGP) or card upon hotel lobby pickup.
• **Free 24-Hour Cancellation:** Full flexibility to modify dates or cancel up to 24 hours prior.
• **Coast Guard Voucher:** You'll immediately receive an official voucher with your pickup schedule and harbor berth details.

Which excursion would you like to reserve?`;
  } else {
    // General overview
    tours = ALL_TOURS.slice(0, 3);
    content = `Welcome to Red Sea Excursions! I am Captain Farouk, your local AI Concierge.

Here are 3 of our most celebrated trips this season:
1. **Orange Bay Island & Snorkeling** (€35) – The Red Sea's Caribbean sandbar, shallow turquoise water, great for relaxing and families.
2. **Dolphin House Sanctuary** (€38) – High probability of wild dolphin sightings over living coral reefs.
3. **Mega Desert Quad & Buggy Safari** (€30) – Fast desert ATV riding, Bedouin village, camel ride, and evening barbecue dinner.

What type of experience sounds best to you? Tell me who you're traveling with (family, couple, friends), your preferred departure resort (Hurghada, El Gouna, Makadi Bay), or any specific adventure in mind!`;
  }

  return { content, recommendedTours: tours };
}

/**
 * Main chat interaction function
 */
export async function sendChatMessage(
  messages: { role: 'user' | 'assistant'; content: string }[],
  latestPrompt: string
): Promise<{
  content: string;
  recommendedTours: Tour[];
  isAiGenerated: boolean;
}> {
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages,
        prompt: latestPrompt,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.text) {
        const recommendedTours = data.recommendedTours?.length 
          ? data.recommendedTours 
          : extractMatchingTours(data.text + ' ' + latestPrompt);

        return {
          content: data.text,
          recommendedTours,
          isAiGenerated: true,
        };
      }
    }
  } catch (err) {
    console.warn('Backend /api/chat notice, switching to concierge fallback:', err);
  }

  // Graceful fallback
  const fallback = generateSmartFallback(latestPrompt);
  return {
    content: fallback.content,
    recommendedTours: fallback.recommendedTours,
    isAiGenerated: false,
  };
}
