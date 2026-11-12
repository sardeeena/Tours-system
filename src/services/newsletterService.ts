import { supabase, isSupabaseConfigured, formatSupabaseError } from './supabaseClient';
import { isValidEmail, newsletterRateLimiter } from '../lib/security';

export interface NewsletterSubscriber {
  id?: string;
  email: string;
  source?: string;
  status: 'subscribed' | 'unsubscribed';
  discountCode?: string;
  createdAt: string;
}

function notifyNewsletterUpdated(subscriber?: NewsletterSubscriber) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('rse_newsletter_updated', { detail: subscriber }));
}

/** Public signup is handled by the server so database persistence and email delivery use server-only credentials. */
export async function subscribeToNewsletter(
  email: string,
  source = 'footer',
  honeypot?: string
): Promise<{ success: boolean; alreadySubscribed?: boolean; discountCode: string; message: string; error?: string }> {
  const discountCode = 'REDSEA15';
  if (honeypot?.trim()) {
    return { success: true, discountCode, message: 'Thank you for subscribing.' };
  }

  const limit = newsletterRateLimiter.check();
  if (limit.isLocked) {
    return { success: false, discountCode, message: `Too many attempts. Please wait ${limit.remainingSeconds} seconds.`, error: 'Rate limit exceeded' };
  }

  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !isValidEmail(cleanEmail)) {
    return { success: false, discountCode, message: 'Please enter a valid email address.', error: 'Invalid email address' };
  }

  try {
    const response = await fetch('/api/newsletter/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: cleanEmail,
        source: source.slice(0, 80),
        preferredLanguage: typeof navigator !== 'undefined' ? navigator.language : 'en',
        website_url_hp: honeypot || '',
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result?.success !== true) {
      return {
        success: false,
        discountCode,
        message: typeof result?.error === 'string' ? result.error : 'We could not save your subscription. Please try again.',
        error: 'Newsletter service unavailable',
      };
    }

    const subscriber: NewsletterSubscriber = {
      id: result.subscriberId,
      email: cleanEmail,
      source,
      status: 'subscribed',
      discountCode: result.discountCode || discountCode,
      createdAt: result.createdAt || new Date().toISOString(),
    };
    notifyNewsletterUpdated(subscriber);
    return {
      success: true,
      alreadySubscribed: result.alreadySubscribed === true,
      discountCode: result.discountCode || discountCode,
      message: typeof result.message === 'string' ? result.message : 'Your subscription has been saved.',
    };
  } catch {
    return {
      success: false,
      discountCode,
      message: 'A connection error occurred. Your subscription was not confirmed. Please try again.',
      error: 'Network error',
    };
  }
}

/** Admin directory is database-only. Never merge device-local records into the production audience. */
export async function listNewsletterSubscribers(): Promise<NewsletterSubscriber[]> {
  if (!isSupabaseConfigured()) throw new Error('Supabase is not configured. Newsletter records cannot be loaded.');
  const { data, error } = await supabase
    .from('newsletter_subscriptions')
    .select('id,email,source,status,discount_code,created_at')
    .order('created_at', { ascending: false });
  if (error) throw new Error(formatSupabaseError(error));
  return (data || []).map((row: any) => ({
    id: row.id,
    email: row.email,
    source: row.source || 'footer',
    status: row.status === 'unsubscribed' ? 'unsubscribed' : 'subscribed',
    discountCode: row.discount_code || 'REDSEA15',
    createdAt: row.created_at || new Date().toISOString(),
  }));
}

export async function addSubscriberManual(
  email: string,
  source = 'admin_cms'
): Promise<{ success: boolean; subscriber?: NewsletterSubscriber; error?: string }> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !isValidEmail(cleanEmail)) return { success: false, error: 'Please enter a valid email address.' };
  if (!isSupabaseConfigured()) return { success: false, error: 'Supabase is not configured.' };

  const { data, error } = await supabase
    .from('newsletter_subscriptions')
    .upsert({ email: cleanEmail, source, status: 'subscribed', discount_code: 'REDSEA15', updated_at: new Date().toISOString() }, { onConflict: 'email' })
    .select('id,email,source,status,discount_code,created_at')
    .single();
  if (error) return { success: false, error: formatSupabaseError(error) };

  const subscriber: NewsletterSubscriber = {
    id: data.id,
    email: data.email,
    source: data.source || source,
    status: data.status === 'unsubscribed' ? 'unsubscribed' : 'subscribed',
    discountCode: data.discount_code || 'REDSEA15',
    createdAt: data.created_at || new Date().toISOString(),
  };
  notifyNewsletterUpdated(subscriber);
  return { success: true, subscriber };
}

export async function updateSubscriberStatus(
  idOrEmail: string,
  status: 'subscribed' | 'unsubscribed'
): Promise<boolean> {
  if (!isSupabaseConfigured()) throw new Error('Supabase is not configured.');
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrEmail);
  let query = supabase.from('newsletter_subscriptions').update({ status, updated_at: new Date().toISOString() });
  const result = isUuid ? await query.eq('id', idOrEmail) : await query.eq('email', idOrEmail.trim().toLowerCase());
  if (result.error) throw new Error(formatSupabaseError(result.error));
  notifyNewsletterUpdated();
  return true;
}

export async function deleteSubscriber(idOrEmail: string): Promise<boolean> {
  if (!isSupabaseConfigured()) throw new Error('Supabase is not configured.');
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrEmail);
  let query = supabase.from('newsletter_subscriptions').delete();
  const result = isUuid ? await query.eq('id', idOrEmail) : await query.eq('email', idOrEmail.trim().toLowerCase());
  if (result.error) throw new Error(formatSupabaseError(result.error));
  notifyNewsletterUpdated();
  return true;
}
