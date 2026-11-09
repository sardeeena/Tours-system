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

const LOCAL_NEWSLETTER_KEY = 'rse_newsletter_subscriptions';

function getStoredSubscribers(): NewsletterSubscriber[] {
  try {
    const raw = localStorage.getItem(LOCAL_NEWSLETTER_KEY);
    if (!raw) {
      return [];
    }
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveStoredSubscribers(subscribers: NewsletterSubscriber[]) {
  try {
    localStorage.setItem(LOCAL_NEWSLETTER_KEY, JSON.stringify(subscribers));
  } catch {
    // ignore
  }
}

function notifyNewsletterUpdated(subscriber?: NewsletterSubscriber) {
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('rse_newsletter_updated', { detail: subscriber }));
    } catch {
      // ignore
    }
  }
}

/**
 * Subscribes a user email to promotional updates in Supabase and local cache
 */
export async function subscribeToNewsletter(
  email: string,
  source = 'footer',
  honeypot?: string
): Promise<{ 
  success: boolean; 
  alreadySubscribed?: boolean; 
  discountCode: string; 
  message: string; 
  error?: string 
}> {
  // 0. Anti-bot honeypot check: If filled, trap bot and return fake success without database insert
  if (honeypot && honeypot.trim() !== '') {
    console.warn('Bot subscription blocked via honeypot field.');
    return {
      success: true,
      discountCode: 'REDSEA15',
      message: 'Thank you for subscribing to Red Sea Voyagers! Your promo code is REDSEA15.',
    };
  }

  const limit = newsletterRateLimiter.check();
  if (limit.isLocked) {
    return {
      success: false,
      discountCode: 'REDSEA15',
      message: `Too many attempts. Please wait ${limit.remainingSeconds} seconds.`,
      error: 'Rate limit exceeded',
    };
  }

  const cleanEmail = email.trim().toLowerCase();

  if (!cleanEmail) {
    return {
      success: false,
      discountCode: 'REDSEA15',
      message: 'Please provide a valid email address.',
      error: 'Email is required',
    };
  }

  if (!isValidEmail(cleanEmail)) {
    return {
      success: false,
      discountCode: 'REDSEA15',
      message: 'Please enter a valid email address format (e.g. name@domain.com).',
      error: 'Invalid email address format',
    };
  }

  const discountCode = 'REDSEA15';
  const now = new Date().toISOString();

  // 1. Try Supabase
  if (isSupabaseConfigured()) {
    try {
      // Check if already subscribed in database
      const { data: existing, error: checkError } = await supabase
        .from('newsletter_subscriptions')
        .select('id, email, status, discount_code, created_at')
        .eq('email', cleanEmail)
        .maybeSingle();

      if (existing) {
        if (existing.status === 'unsubscribed') {
          // Re-subscribe
          await supabase
            .from('newsletter_subscriptions')
            .update({ status: 'subscribed', updated_at: now })
            .eq('id', existing.id);

          const localList = getStoredSubscribers();
          const updated = localList.map((s) => s.email === cleanEmail ? { ...s, status: 'subscribed' as const } : s);
          saveStoredSubscribers(updated);
          notifyNewsletterUpdated({
            id: existing.id,
            email: cleanEmail,
            source,
            status: 'subscribed',
            discountCode,
            createdAt: existing.created_at || now,
          });

          return {
            success: true,
            discountCode,
            message: 'Welcome back! You have been re-subscribed to our seasonal updates.',
          };
        }

        // Already active subscriber
        const localList = getStoredSubscribers();
        if (!localList.some((s) => s.email === cleanEmail)) {
          localList.unshift({
            id: existing.id,
            email: cleanEmail,
            source,
            status: 'subscribed',
            discountCode: existing.discount_code || discountCode,
            createdAt: existing.created_at || now,
          });
          saveStoredSubscribers(localList);
        }

        return {
          success: true,
          alreadySubscribed: true,
          discountCode: existing.discount_code || discountCode,
          message: `You are already subscribed to Red Sea Voyagers! Your 15% promotional voucher code is ${existing.discount_code || discountCode}.`,
        };
      }

      // Insert new subscriber into Supabase table
      const { data: inserted, error: insertError } = await supabase
        .from('newsletter_subscriptions')
        .insert({
          email: cleanEmail,
          source,
          status: 'subscribed',
          discount_code: discountCode,
          ...(honeypot ? { website_url_hp: honeypot } : {}),
          metadata: {
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
            subscribedAt: now,
          },
        })
        .select()
        .single();

      if (insertError) {
        // If server-side abuse prevention trigger fired
        if (insertError.message?.includes('Rate limit exceeded') || insertError.code === 'P0001') {
          return {
            success: false,
            discountCode,
            message: insertError.message || 'Rate limit exceeded: Too many subscriptions from this network. Please try again later.',
            error: 'Rate limit exceeded',
          };
        }
        // If unique constraint conflict happens
        if (insertError.code === '23505') {
          return {
            success: true,
            alreadySubscribed: true,
            discountCode,
            message: 'You are already subscribed! Use promo voucher code REDSEA15 on your next excursion booking.',
          };
        }
        console.warn('Supabase newsletter insert error:', insertError);
      } else {
        // Record in local cache
        const newSub: NewsletterSubscriber = {
          id: inserted?.id || `sub-${Date.now().toString(36)}`,
          email: cleanEmail,
          source,
          status: 'subscribed',
          discountCode,
          createdAt: inserted?.created_at || now,
        };

        const localList = getStoredSubscribers().filter((s) => s.email !== cleanEmail);
        localList.unshift(newSub);
        saveStoredSubscribers(localList);
        notifyNewsletterUpdated(newSub);

        return {
          success: true,
          discountCode,
          message: 'Welcome aboard! You have been subscribed to exclusive updates & seasonal deals.',
        };
      }
    } catch (err) {
      console.warn('Supabase newsletter connection fallback:', err);
    }
  }

  // 2. Local fallback storage
  const localList = getStoredSubscribers();
  const existingLocal = localList.find((s) => s.email === cleanEmail);

  if (existingLocal) {
    if (existingLocal.status === 'unsubscribed') {
      existingLocal.status = 'subscribed';
      saveStoredSubscribers(localList);
      notifyNewsletterUpdated(existingLocal);
      return {
        success: true,
        discountCode,
        message: 'Welcome back! You have been re-subscribed to our seasonal updates.',
      };
    }
    return {
      success: true,
      alreadySubscribed: true,
      discountCode,
      message: 'You are already subscribed! Your 15% discount voucher code is REDSEA15.',
    };
  }

  const fallbackSub: NewsletterSubscriber = {
    id: `sub-${Date.now().toString(36)}`,
    email: cleanEmail,
    source,
    status: 'subscribed',
    discountCode,
    createdAt: now,
  };

  localList.unshift(fallbackSub);
  saveStoredSubscribers(localList);
  notifyNewsletterUpdated(fallbackSub);

  return {
    success: true,
    discountCode,
    message: 'Welcome to Red Sea Voyagers! You have been subscribed to exclusive updates & seasonal deals.',
  };
}

/**
 * Lists all newsletter subscribers for admin dashboard (merges Supabase and local cache)
 */
export async function listNewsletterSubscribers(): Promise<NewsletterSubscriber[]> {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('newsletter_subscriptions')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        const dbSubscribers: NewsletterSubscriber[] = data.map((d: any) => ({
          id: d.id,
          email: d.email,
          source: d.source || 'footer',
          status: (d.status === 'unsubscribed' ? 'unsubscribed' : 'subscribed') as 'subscribed' | 'unsubscribed',
          discountCode: d.discount_code || 'REDSEA15',
          createdAt: d.created_at || new Date().toISOString(),
        }));

        // Merge any local subscriber that hasn't been synced to Supabase yet
        const localList = getStoredSubscribers();
        const seenEmails = new Set(dbSubscribers.map((s) => s.email.toLowerCase()));
        localList.forEach((local) => {
          if (!seenEmails.has(local.email.toLowerCase())) {
            dbSubscribers.push(local);
            // Opportunistically sync to Supabase in the background
            Promise.resolve(
              supabase.from('newsletter_subscriptions').insert({
                email: local.email.toLowerCase(),
                source: local.source || 'local_sync',
                status: local.status,
                discount_code: local.discountCode || 'REDSEA15',
              })
            ).catch(() => {});
          }
        });

        // Keep local cache fresh
        saveStoredSubscribers(dbSubscribers);

        return dbSubscribers;
      }
    } catch (err) {
      console.warn('Supabase newsletter listing error, using local fallback:', err);
    }
  }

  return getStoredSubscribers();
}

/**
 * Manually adds a subscriber from the Admin CMS
 */
export async function addSubscriberManual(
  email: string,
  source = 'admin_cms'
): Promise<{ success: boolean; subscriber?: NewsletterSubscriber; error?: string }> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !isValidEmail(cleanEmail)) {
    return { success: false, error: 'Please enter a valid email address.' };
  }

  const discountCode = 'REDSEA15';
  const now = new Date().toISOString();

  let createdId = `sub-${Date.now().toString(36)}`;

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('newsletter_subscriptions')
        .upsert(
          {
            email: cleanEmail,
            source,
            status: 'subscribed',
            discount_code: discountCode,
            updated_at: now,
          },
          { onConflict: 'email' }
        )
        .select()
        .single();

      if (error) {
        return { success: false, error: formatSupabaseError(error) };
      }
      if (data?.id) {
        createdId = data.id;
      }
    } catch (err: any) {
      return { success: false, error: err?.message || 'Database error' };
    }
  }

  const sub: NewsletterSubscriber = {
    id: createdId,
    email: cleanEmail,
    source,
    status: 'subscribed',
    discountCode,
    createdAt: now,
  };

  const localList = getStoredSubscribers().filter((s) => s.email !== cleanEmail);
  localList.unshift(sub);
  saveStoredSubscribers(localList);
  notifyNewsletterUpdated(sub);

  return { success: true, subscriber: sub };
}

/**
 * Updates subscriber status (e.g. toggle between subscribed and unsubscribed)
 */
export async function updateSubscriberStatus(
  idOrEmail: string,
  status: 'subscribed' | 'unsubscribed'
): Promise<boolean> {
  if (isSupabaseConfigured()) {
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrEmail);
      const query = supabase
        .from('newsletter_subscriptions')
        .update({ status, updated_at: new Date().toISOString() });

      const { error } = isUuid
        ? await query.eq('id', idOrEmail)
        : await query.eq('email', idOrEmail.toLowerCase());

      if (error) throw error;
    } catch (err: any) {
      console.error('Failed to update newsletter status in database:', err);
      throw new Error(formatSupabaseError(err));
    }
  }

  const localList = getStoredSubscribers();
  const updated = localList.map((s) => {
    if (s.id === idOrEmail || s.email.toLowerCase() === idOrEmail.toLowerCase()) {
      return { ...s, status };
    }
    return s;
  });
  saveStoredSubscribers(updated);

  notifyNewsletterUpdated();
  return true;
}

/**
 * Deletes a subscriber record
 */
export async function deleteSubscriber(idOrEmail: string): Promise<boolean> {
  if (isSupabaseConfigured()) {
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrEmail);
      const query = supabase.from('newsletter_subscriptions').delete();

      const { error } = isUuid
        ? await query.eq('id', idOrEmail)
        : await query.eq('email', idOrEmail.toLowerCase());

      if (error) throw error;
    } catch (err: any) {
      console.error('Failed to delete newsletter subscriber from database:', err);
      throw new Error(formatSupabaseError(err));
    }
  }

  const localList = getStoredSubscribers();
  const filtered = localList.filter((s) => s.id !== idOrEmail && s.email.toLowerCase() !== idOrEmail.toLowerCase());
  saveStoredSubscribers(filtered);

  notifyNewsletterUpdated();
  return true;
}
