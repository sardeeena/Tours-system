import { supabase, isSupabaseConfigured, formatSupabaseError } from './supabaseClient';
import { DbFaq } from '../types/database';

const LOCAL_FAQS_KEY = 'rse_faqs_cache';

const INITIAL_FAQS: DbFaq[] = [
  {
    id: 'faq-1',
    category: 'booking',
    question: 'How far in advance should I book my Red Sea excursion?',
    answer: 'We recommend reserving at least 24 to 48 hours in advance, especially during high season (October through May). For private yacht charters and scuba diving packages, early booking ensures boat permit clearances with port authorities.',
    sort_order: 1,
    is_published: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'faq-2',
    category: 'cancellation',
    question: 'What is your cancellation and weather refund policy?',
    answer: 'All direct bookings feature free cancellation up to 24 hours prior to departure with a 100% refund. If the Egyptian Coast Guard issues a marine weather advisory prohibiting boat departures, you can reschedule at no charge or receive a full immediate refund.',
    sort_order: 2,
    is_published: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'faq-3',
    category: 'transfers',
    question: 'Is hotel pickup and drop-off included in the price?',
    answer: 'Yes, complimentary round-trip air-conditioned transfers are included from all central Hurghada resorts. For outer zones (El Gouna, Makadi Bay, Sahl Hasheesh, Soma Bay, and Safaga), a nominal transfer surcharge is clearly displayed at checkout.',
    sort_order: 3,
    is_published: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'faq-4',
    category: 'marine_safety',
    question: 'Do I need scuba certification or strong swimming skills for snorkeling trips?',
    answer: 'No previous experience is needed. Our boats carry US Coast Guard approved life jackets in all adult and child sizes, and certified marine guides accompany swimmers into the water during every snorkeling session.',
    sort_order: 4,
    is_published: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'faq-5',
    category: 'general',
    question: 'What currencies and payment methods do you accept at the pier desk?',
    answer: 'We accept Euros (EUR), US Dollars (USD), British Pounds (GBP), and Egyptian Pounds (EGP) in cash, as well as Visa and MasterCard at our dispatch counters.',
    sort_order: 5,
    is_published: true,
    created_at: new Date().toISOString(),
  },
];

function getLocalFaqs(): DbFaq[] {
  try {
    const raw = localStorage.getItem(LOCAL_FAQS_KEY);
    if (!raw) {
      localStorage.setItem(LOCAL_FAQS_KEY, JSON.stringify(INITIAL_FAQS));
      return INITIAL_FAQS;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_FAQS;
  }
}

function saveLocalFaqs(faqs: DbFaq[]) {
  try {
    localStorage.setItem(LOCAL_FAQS_KEY, JSON.stringify(faqs));
  } catch {
    // ignore
  }
}

export async function getFaqs(category?: string): Promise<DbFaq[]> {
  if (!isSupabaseConfigured()) {
    const all = getLocalFaqs();
    if (category && category !== 'all') {
      return all.filter((f) => f.category === category);
    }
    return all.sort((a, b) => a.sort_order - b.sort_order);
  }

  try {
    let query = supabase.from('faqs').select('*').order('sort_order', { ascending: true });

    if (category && category !== 'all') {
      query = query.eq('category', category);
    }

    const { data, error } = await query;
    if (error) {
      console.warn('Supabase faqs fetch error, falling back to local cache:', error);
      return getLocalFaqs();
    }

    if (!data || data.length === 0) {
      return getLocalFaqs();
    }

    return data;
  } catch (err) {
    console.warn('Error fetching faqs:', err);
    return getLocalFaqs();
  }
}

export async function createFaq(payload: Omit<DbFaq, 'id' | 'created_at'>): Promise<DbFaq> {
  if (!isSupabaseConfigured()) {
    const local = getLocalFaqs();
    const newFaq: DbFaq = {
      ...payload,
      id: `faq-${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    saveLocalFaqs([...local, newFaq]);
    return newFaq;
  }

  try {
    const { data, error } = await supabase
      .from('faqs')
      .insert({
        category: payload.category,
        question: payload.question,
        answer: payload.answer,
        sort_order: payload.sort_order ?? 0,
        is_published: payload.is_published ?? true,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err: any) {
    throw new Error(formatSupabaseError(err));
  }
}

export async function updateFaq(id: string, updates: Partial<DbFaq>): Promise<void> {
  if (!isSupabaseConfigured()) {
    const local = getLocalFaqs();
    saveLocalFaqs(local.map((f) => (f.id === id ? { ...f, ...updates } : f)));
    return;
  }

  try {
    const { error } = await supabase
      .from('faqs')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;
  } catch (err: any) {
    throw new Error(formatSupabaseError(err));
  }
}

export async function deleteFaq(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    const local = getLocalFaqs();
    saveLocalFaqs(local.filter((f) => f.id !== id));
    return;
  }

  try {
    const { error } = await supabase.from('faqs').delete().eq('id', id);
    if (error) throw error;
  } catch (err: any) {
    throw new Error(formatSupabaseError(err));
  }
}
