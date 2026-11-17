import { Tour } from '../types';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  recommendedTours?: Tour[];
}

/**
 * Safe fallback used when the live concierge endpoint is unavailable.
 */
/**
 * Fail closed rather than guessing from the legacy static catalogue.
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
          : [];

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
