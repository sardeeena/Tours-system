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
function generateSmartFallback(_userPrompt: string): { content: string; recommendedTours: Tour[] } {
  return {
    content: 'Thanks for contacting Awesome Adventure Tours. Our live recommendation assistant is temporarily unavailable, so I do not want to guess about prices, availability, pickup fees, or excursion details. Please browse the current excursions catalogue and open a tour to see its latest details, dates, and booking options. You can also contact our team for help choosing.',
    recommendedTours: [],
  };
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
