import { supabase, isSupabaseConfigured, formatSupabaseError } from './supabaseClient';
import { DbFaq } from '../types/database';

const LOCAL_FAQS_KEY = 'rse_faqs_cache';

const INITIAL_FAQS: DbFaq[] = [
  {
    id: 'faq-1',
    category: 'booking',
    question: 'How early should I book?',
    answer: 'Booking ahead is a good idea, especially for busy dates and private trips. Check the live availability for your chosen date before you book.',
    sort_order: 1,
    is_published: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'faq-2',
    category: 'cancellation',
    question: 'Can I cancel my booking?',
    answer: 'Cancellation rules depend on the trip. Check the cancellation terms shown on its page and in your booking before you pay. If bad weather or sea conditions affect your trip, our team will contact you about the next steps.',
    sort_order: 2,
    is_published: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'faq-3',
    category: 'transfers',
    question: 'Is hotel pickup included?',
    answer: 'Pickup depends on the trip and where you’re staying. The tour page and booking form show whether pickup is included and whether there’s an extra charge for your hotel area.',
    sort_order: 3,
    is_published: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'faq-4',
    category: 'marine_safety',
    question: 'Do I need experience to go snorkelling?',
    answer: 'You don’t need a scuba certificate to snorkel. Swimming requirements, life jackets and guide support can vary by trip, so check the tour details and follow the guide’s instructions.',
    sort_order: 4,
    is_published: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'faq-5',
    category: 'general',
    question: 'How can I pay?',
    answer: 'Payment options depend on the trip. You’ll see the available methods and currencies during booking, before you confirm.',
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
    if (!import.meta.env.DEV) throw new Error('Supabase is not configured; FAQ records cannot be loaded in production.');
    const all = getLocalFaqs();
    return category && category !== 'all'
      ? all.filter((faq) => faq.category === category)
      : all.sort((a, b) => a.sort_order - b.sort_order);
  }

  const query = supabase.from('faqs').select('*').order('sort_order', { ascending: true });
  const { data, error } = await (category && category !== 'all' ? query.eq('category', category) : query);
  if (error) throw new Error(formatSupabaseError(error));
  return data || [];
}

export async function createFaq(payload: Omit<DbFaq, 'id' | 'created_at'>): Promise<DbFaq> {
  if (!isSupabaseConfigured()) {
    if (!import.meta.env.DEV) throw new Error('Supabase is not configured; FAQ changes cannot be saved in production.');
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
    if (!import.meta.env.DEV) throw new Error('Supabase is not configured; FAQ changes cannot be saved in production.');
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
    if (!import.meta.env.DEV) throw new Error('Supabase is not configured; FAQ changes cannot be saved in production.');
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
