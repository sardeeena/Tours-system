import { supabase, isSupabaseConfigured, formatSupabaseError, isSchemaMissing, isSchemaMissingError, setSchemaMissing } from './supabaseClient';
import { DbCoupon } from '../types/database';

const LOCAL_COUPONS_KEY = 'rse_coupons_cache';

const INITIAL_COUPONS: DbCoupon[] = [
  {
    id: 'coupon-1',
    code: 'REDSEA15',
    description: 'Welcome 15% discount for newsletter subscribers',
    discount_type: 'percentage',
    discount_value: 15,
    min_spend: 50,
    max_discount: 30,
    valid_from: new Date().toISOString(),
    valid_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    usage_limit: 500,
    max_redemptions: 500,
    times_used: 42,
    times_redeemed: 42,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'coupon-2',
    code: 'VIPYACHT50',
    description: 'Flat €50 discount on private yacht charters',
    discount_type: 'fixed',
    discount_value: 50,
    min_spend: 200,
    max_discount: null,
    valid_from: new Date().toISOString(),
    valid_until: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
    usage_limit: 50,
    max_redemptions: 50,
    times_used: 8,
    times_redeemed: 8,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'coupon-3',
    code: 'EARLYBIRD',
    description: '10% off for bookings made 14 days in advance',
    discount_type: 'percentage',
    discount_value: 10,
    min_spend: 30,
    max_discount: 25,
    valid_from: new Date().toISOString(),
    valid_until: null,
    usage_limit: null,
    max_redemptions: null,
    times_used: 114,
    times_redeemed: 114,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

function getLocalCoupons(): DbCoupon[] {
  try {
    const raw = localStorage.getItem(LOCAL_COUPONS_KEY);
    if (!raw) {
      localStorage.setItem(LOCAL_COUPONS_KEY, JSON.stringify(INITIAL_COUPONS));
      return INITIAL_COUPONS;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_COUPONS;
  }
}

function saveLocalCoupons(coupons: DbCoupon[]) {
  try {
    localStorage.setItem(LOCAL_COUPONS_KEY, JSON.stringify(coupons));
  } catch {
    // ignore
  }
}

export async function getCoupons(): Promise<DbCoupon[]> {
  if (!isSupabaseConfigured() || isSchemaMissing()) {
    return getLocalCoupons();
  }

  try {
    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      if (isSchemaMissingError(error)) {
        setSchemaMissing(true);
        return getLocalCoupons();
      }
      console.error('Supabase coupons fetch failed:', error);
      throw new Error(formatSupabaseError(error));
    }

    if (!data || data.length === 0) {
      return [];
    }

    return data.map((item: any) => ({
      ...item,
      usage_limit: item.usage_limit ?? item.max_redemptions ?? null,
      times_used: item.times_used ?? item.times_redeemed ?? 0,
      max_redemptions: item.usage_limit ?? item.max_redemptions ?? null,
      times_redeemed: item.times_used ?? item.times_redeemed ?? 0,
    }));
  } catch (err) {
    if (isSchemaMissingError(err)) {
      setSchemaMissing(true);
      return getLocalCoupons();
    }
    console.error('Error fetching coupons:', err);
    throw err;
  }
}

export async function createCoupon(
  payload: Omit<DbCoupon, 'id' | 'created_at' | 'updated_at' | 'times_used' | 'times_redeemed'>
): Promise<DbCoupon> {
  const cleanCode = payload.code.trim().toUpperCase();

  if (!isSupabaseConfigured()) {
    const local = getLocalCoupons();
    if (local.some((c) => c.code === cleanCode)) {
      throw new Error(`Coupon with code "${cleanCode}" already exists.`);
    }
    const newCoupon: DbCoupon = {
      ...payload,
      id: `coupon-${Date.now()}`,
      code: cleanCode,
      times_used: 0,
      times_redeemed: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const updated = [newCoupon, ...local];
    saveLocalCoupons(updated);
    return newCoupon;
  }

  try {
    const { data, error } = await supabase
      .from('coupons')
      .insert({
        code: cleanCode,
        description: payload.description,
        discount_type: payload.discount_type,
        discount_value: payload.discount_value,
        min_spend: payload.min_spend || 0,
        max_discount: payload.max_discount || null,
        valid_from: payload.valid_from || new Date().toISOString(),
        valid_until: payload.valid_until || null,
        usage_limit: payload.usage_limit ?? payload.max_redemptions ?? null,
        is_active: payload.is_active ?? true,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err: any) {
    throw new Error(formatSupabaseError(err));
  }
}

export async function updateCoupon(id: string, updates: Partial<DbCoupon>): Promise<void> {
  if (updates.code) {
    updates.code = updates.code.trim().toUpperCase();
  }

  if (!isSupabaseConfigured()) {
    const local = getLocalCoupons();
    const updated = local.map((c) => (c.id === id ? { ...c, ...updates, updated_at: new Date().toISOString() } : c));
    saveLocalCoupons(updated);
    return;
  }

  try {
    const dbPayload: any = { ...updates, updated_at: new Date().toISOString() };
    if ('usage_limit' in updates) dbPayload.usage_limit = updates.usage_limit;
    if ('max_redemptions' in updates && !('usage_limit' in updates)) dbPayload.usage_limit = updates.max_redemptions;

    const { error } = await supabase.from('coupons').update(dbPayload).eq('id', id);
    if (error) throw error;
  } catch (err: any) {
    throw new Error(formatSupabaseError(err));
  }
}

export async function deleteCoupon(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    const local = getLocalCoupons();
    saveLocalCoupons(local.filter((c) => c.id !== id));
    return;
  }

  try {
    const { error } = await supabase.from('coupons').delete().eq('id', id);
    if (error) throw error;
  } catch (err: any) {
    throw new Error(formatSupabaseError(err));
  }
}

export async function toggleCouponStatus(id: string, isActive: boolean): Promise<void> {
  return updateCoupon(id, { is_active: isActive });
}
