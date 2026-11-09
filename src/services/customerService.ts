import { supabase, isSupabaseConfigured, formatSupabaseError } from './supabaseClient';
import { bookingRepository } from './bookingRepository';
import { UserRole } from '../types/database';
import { getStoredLocalUsers, LOCAL_USERS_KEY } from './authService';

export interface UnifiedCustomer {
  id: string;
  fullName: string;
  email: string;
  phone?: string | null;
  country?: string | null;
  hotel?: string | null;
  role: UserRole;
  isRegistered: boolean;
  totalBookings: number;
  totalSpentEur: number;
  lastBookingDate?: string | null;
  createdAt: string;
  avatarUrl?: string | null;
}

const SEED_CUSTOMERS: UnifiedCustomer[] = [];

const LOCAL_CUSTOMERS_KEY = 'rse_customers_cache';

function getStoredCustomers(): UnifiedCustomer[] {
  try {
    const raw = localStorage.getItem(LOCAL_CUSTOMERS_KEY);
    if (!raw) {
      return [];
    }
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveStoredCustomers(customers: UnifiedCustomer[]) {
  try {
    localStorage.setItem(LOCAL_CUSTOMERS_KEY, JSON.stringify(customers));
  } catch {
    // ignore
  }
}

/**
 * Loads all customers unified across Supabase profiles, customer records, and bookings
 */
export async function listUnifiedCustomers(): Promise<UnifiedCustomer[]> {
  const customerMap = new Map<string, UnifiedCustomer>();

  // 1. If Supabase configured, load profiles and customers tables
  if (isSupabaseConfigured()) {
    try {
      const [profilesRes, customersRes] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('customers').select('*').order('created_at', { ascending: false }),
      ]);

      if (profilesRes.data) {
        profilesRes.data.forEach((p) => {
          const email = (p.email || '').toLowerCase();
          if (!email) return;
          customerMap.set(email, {
            id: p.id,
            fullName: p.full_name || email.split('@')[0],
            email,
            phone: p.phone,
            country: p.country,
            role: (p.role || 'customer') as UserRole,
            isRegistered: true,
            totalBookings: 0,
            totalSpentEur: 0,
            avatarUrl: p.avatar_url,
            createdAt: p.created_at || new Date().toISOString(),
          });
        });
      }

      if (customersRes.data) {
        customersRes.data.forEach((c) => {
          const email = (c.email || '').toLowerCase();
          if (!email) return;
          const existing = customerMap.get(email);
          const fullName = `${c.first_name || ''} ${c.last_name || ''}`.trim() || email.split('@')[0];

          if (existing) {
            existing.hotel = existing.hotel || c.hotel;
            existing.phone = existing.phone || c.phone;
            existing.country = existing.country || c.country;
            if (existing.fullName === email.split('@')[0] && fullName) {
              existing.fullName = fullName;
            }
          } else {
            customerMap.set(email, {
              id: c.id,
              fullName,
              email,
              phone: c.phone,
              country: c.country,
              hotel: c.hotel,
              role: 'customer',
              isRegistered: Boolean(c.user_id),
              totalBookings: 0,
              totalSpentEur: 0,
              createdAt: c.created_at || new Date().toISOString(),
            });
          }
        });
      }
    } catch (err) {
      console.warn('Error reading profiles/customers from Supabase:', err);
    }
  }

  // 2. Incorporate locally registered user accounts
  try {
    const localUsers = getStoredLocalUsers();
    localUsers.forEach((stored) => {
      const u = stored.user;
      const email = u.email.toLowerCase();
      if (!customerMap.has(email)) {
        customerMap.set(email, {
          id: u.id,
          fullName: u.fullName,
          email,
          phone: u.phoneNumber,
          country: u.country,
          role: u.role,
          isRegistered: true,
          totalBookings: 0,
          totalSpentEur: 0,
          avatarUrl: u.avatarUrl,
          createdAt: new Date().toISOString(),
        });
      }
    });
  } catch {
    // ignore
  }

  // 3. Incorporate local customer cache if map is empty
  if (customerMap.size === 0) {
    const cached = getStoredCustomers();
    cached.forEach((s) => customerMap.set(s.email.toLowerCase(), s));
  }

  // 4. Correlate with all bookings to compute total bookings & lifetime spend
  try {
    const allBookings = await bookingRepository.listBookings();
    allBookings.forEach((b) => {
      const email = (b.customer?.email || '').toLowerCase();
      if (!email) return;

      let cust = customerMap.get(email);
      if (!cust) {
        cust = {
          id: `cust-bk-${b.bookingReference}`,
          fullName: `${b.customer.firstName || ''} ${b.customer.lastName || ''}`.trim() || 'Guest Traveler',
          email,
          phone: `${b.customer.countryCode || ''} ${b.customer.phoneNumber || ''}`.trim() || null,
          country: b.customer.country || null,
          hotel: b.pickup.hotelName || b.customer.hotelName || null,
          role: 'customer',
          isRegistered: false,
          totalBookings: 0,
          totalSpentEur: 0,
          createdAt: b.date || new Date().toISOString(),
        };
        customerMap.set(email, cust);
      }

      cust.totalBookings += 1;
      cust.totalSpentEur += b.pricing?.totalEur || 0;
      cust.hotel = cust.hotel || b.pickup.hotelName || b.customer.hotelName;

      if (!cust.lastBookingDate || b.date > cust.lastBookingDate) {
        cust.lastBookingDate = b.date;
      }
    });
  } catch (err) {
    console.warn('Error correlating customer booking metrics:', err);
  }

  const result = Array.from(customerMap.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  saveStoredCustomers(result);
  return result;
}

/**
 * Updates a customer's role in Supabase profiles
 */
export async function updateCustomerRole(
  userId: string,
  newRole: UserRole
): Promise<boolean> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);

  if (isSupabaseConfigured() && isUuid) {
    try {
      // Authorization check: Verify caller is an authenticated administrator
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Authentication required: You must be signed in as an administrator to change user roles.');
      }
      const { data: callerProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      const callerRole = callerProfile?.role;
      if (callerRole !== 'admin' && callerRole !== 'super_admin' && callerRole !== 'manager') {
        throw new Error('Permission denied: Only system administrators have authorization to modify account roles.');
      }

      // Privilege escalation protection: Users cannot self-promote to admin/super_admin
      if (user.id === userId && (newRole === 'admin' || newRole === 'super_admin')) {
        throw new Error('Permission denied: Self-promotion to administrative roles is strictly prohibited.');
      }

      // Only existing super_admin can delegate super_admin privileges
      if (newRole === 'super_admin' && callerRole !== 'super_admin') {
        throw new Error('Permission denied: Only super administrators can grant the super_admin role.');
      }

      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole, updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (error) {
        throw new Error(formatSupabaseError(error));
      }
    } catch (err: any) {
      console.error('Exception updating customer role in Supabase:', err);
      throw err;
    }
  }

  // Update local cache
  const localList = getStoredCustomers();
  const updated = localList.map((c) => (c.id === userId ? { ...c, role: newRole } : c));
  saveStoredCustomers(updated);

  return true;
}

/**
 * Updates customer contact data
 */
export async function updateCustomerDetails(
  id: string,
  updates: Partial<UnifiedCustomer>
): Promise<boolean> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  if (isSupabaseConfigured() && isUuid) {
    try {
      const { error: profError } = await supabase
        .from('profiles')
        .update({
          full_name: updates.fullName,
          phone: updates.phone,
          country: updates.country,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (profError) {
        throw new Error(formatSupabaseError(profError));
      }

      await supabase
        .from('customers')
        .update({
          first_name: updates.fullName?.split(' ')[0],
          last_name: updates.fullName?.split(' ').slice(1).join(' '),
          phone: updates.phone,
          country: updates.country,
          hotel: updates.hotel,
        })
        .eq('id', id);
    } catch (err: any) {
      console.error('Exception updating customer details in Supabase:', err);
      throw err;
    }
  }

  const localList = getStoredCustomers();
  const updated = localList.map((c) => (c.id === id ? { ...c, ...updates } : c));
  saveStoredCustomers(updated);

  return true;
}

/**
 * Deletes or archives a customer record
 */
export async function deleteCustomerRecord(id: string): Promise<boolean> {
  const localList = getStoredCustomers();
  saveStoredCustomers(localList.filter((c) => c.id !== id));

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  if (isSupabaseConfigured() && isUuid) {
    try {
      const { error: custErr } = await supabase.from('customers').delete().eq('id', id);
      if (custErr) throw new Error(formatSupabaseError(custErr));
      const { error: profErr } = await supabase.from('profiles').delete().eq('id', id);
      if (profErr) throw new Error(formatSupabaseError(profErr));
    } catch (err: any) {
      console.error('Error deleting customer in Supabase:', err);
      throw err;
    }
  }

  return true;
}
