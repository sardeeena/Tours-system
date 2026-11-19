import { supabase, isSupabaseConfigured, formatSupabaseError } from './supabaseClient';
import { bookingRepository } from './bookingRepository';
import { UserRole } from '../types/database';
import { getStoredLocalUsers, LOCAL_USERS_KEY } from './authService';

export interface UnifiedCustomer {
  id: string;
  customerRecordId?: string | null;
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
  const localMode = !isSupabaseConfigured();

  if (localMode && !import.meta.env.DEV) {
    throw new Error('Supabase is not configured; the customer directory cannot be loaded in production.');
  }

  if (!localMode) {
    const [profilesRes, customersRes] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('customers').select('*').order('created_at', { ascending: false }),
    ]);
    if (profilesRes.error) throw new Error(formatSupabaseError(profilesRes.error));
    if (customersRes.error) throw new Error(formatSupabaseError(customersRes.error));

    (profilesRes.data || []).forEach((profile) => {
      const email = (profile.email || '').toLowerCase().trim();
      if (!email) return;
      customerMap.set(email, {
        id: profile.id,
        fullName: profile.full_name || 'Not provided',
        email,
        phone: profile.phone,
        country: profile.country,
        role: (profile.role || 'customer') as UserRole,
        isRegistered: true,
        totalBookings: 0,
        totalSpentEur: 0,
        avatarUrl: profile.avatar_url,
        createdAt: profile.created_at || '',
      });
    });

    (customersRes.data || []).forEach((customer) => {
      const email = (customer.email || '').toLowerCase().trim();
      if (!email) return;
      const existing = customerMap.get(email);
      const fullName = `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'Not provided';

      if (existing) {
        existing.customerRecordId = customer.id;
        existing.hotel = existing.hotel || customer.hotel;
        existing.phone = existing.phone || customer.phone;
        existing.country = existing.country || customer.country;
        if (existing.fullName === 'Not provided' && fullName !== 'Not provided') existing.fullName = fullName;
      } else {
        customerMap.set(email, {
          id: customer.id,
          customerRecordId: customer.id,
          fullName,
          email,
          phone: customer.phone,
          country: customer.country,
          hotel: customer.hotel,
          role: 'customer',
          isRegistered: Boolean(customer.user_id),
          totalBookings: 0,
          totalSpentEur: 0,
          createdAt: customer.created_at || '',
        });
      }
    });
  } else {
    getStoredLocalUsers().forEach((stored) => {
      const user = stored.user;
      const email = user.email.toLowerCase().trim();
      if (!email || customerMap.has(email)) return;
      customerMap.set(email, {
        id: user.id,
        fullName: user.fullName,
        email,
        phone: user.phoneNumber,
        country: user.country,
        role: user.role,
        isRegistered: true,
        totalBookings: 0,
        totalSpentEur: 0,
        avatarUrl: user.avatarUrl,
        createdAt: '',
      });
    });

    getStoredCustomers().forEach((customer) => {
      if (customer.email && !customerMap.has(customer.email.toLowerCase())) {
        customerMap.set(customer.email.toLowerCase(), customer);
      }
    });
  }

  // Booking aggregation is part of the customer directory contract; do not return a partial directory on query failure.
  const allBookings = await bookingRepository.listBookings();
  allBookings.forEach((booking) => {
    const email = (booking.customer?.email || '').toLowerCase().trim();
    if (!email) return;

    let customer = customerMap.get(email);
    if (!customer) {
      customer = {
        id: booking.customerId || `booking-customer:${booking.bookingReference}`,
        customerRecordId: null,
        fullName: `${booking.customer.firstName || ''} ${booking.customer.lastName || ''}`.trim() || 'Not provided',
        email,
        phone: `${booking.customer.countryCode || ''} ${booking.customer.phoneNumber || ''}`.trim() || null,
        country: booking.customer.country || null,
        hotel: booking.pickup.hotelName || booking.customer.hotelName || null,
        role: 'customer',
        isRegistered: false,
        totalBookings: 0,
        totalSpentEur: 0,
        createdAt: booking.createdAt || booking.date || '',
      };
      customerMap.set(email, customer);
    }

    if (booking.status === 'cancelled' || booking.status === 'cancellation_requested') return;
    customer.totalBookings += 1;
    customer.totalSpentEur += Number(booking.pricing?.totalEur) || 0;
    customer.hotel = customer.hotel || booking.pickup.hotelName || booking.customer.hotelName;
    if (!customer.lastBookingDate || (booking.date && booking.date > customer.lastBookingDate)) {
      customer.lastBookingDate = booking.date || null;
    }
  });

  const result = Array.from(customerMap.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  if (import.meta.env.DEV) saveStoredCustomers(result);
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
