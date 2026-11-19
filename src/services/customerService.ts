import { supabase, isSupabaseConfigured, formatSupabaseError } from './supabaseClient';
import { bookingRepository } from './bookingRepository';
import { UserRole } from '../types/database';
import { getStoredLocalUsers, LOCAL_USERS_KEY } from './authService';

export interface UnifiedCustomer {
  id: string;
  customerRecordId?: string | null;
  userId?: string | null;
  isRegisteredUser?: boolean;
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
        existing.userId = customer.user_id || existing.userId || null;
        existing.isRegisteredUser = Boolean(customer.user_id) || existing.isRegisteredUser || false;
        existing.hotel = existing.hotel || customer.hotel;
        existing.phone = existing.phone || customer.phone;
        existing.country = existing.country || customer.country;
        if (existing.fullName === 'Not provided' && fullName !== 'Not provided') existing.fullName = fullName;
      } else {
        customerMap.set(email, {
          id: customer.id,
          customerRecordId: customer.id,
          userId: customer.user_id || null,
          isRegisteredUser: Boolean(customer.user_id),
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
        createdAt: user.createdAt || '',
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
        userId: null,
        isRegisteredUser: false,
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
  if (!isSupabaseConfigured()) {
    if (!import.meta.env.DEV) throw new Error('Supabase is not configured; customer roles cannot be changed in production.');
    const localList = getStoredCustomers();
    const updated = localList.map((customer) => customer.id === userId ? { ...customer, role: newRole } : customer);
    if (!updated.some((customer) => customer.id === userId)) throw new Error('Customer profile was not found in the local development directory.');
    saveStoredCustomers(updated);
    return true;
  }

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
  if (!isUuid) throw new Error('Role changes require a registered Supabase user profile.');

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) throw new Error(formatSupabaseError(authError));
  if (!user) throw new Error('Authentication required: sign in as an administrator to change user roles.');

  const { data: callerProfile, error: callerProfileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if (callerProfileError) throw new Error(formatSupabaseError(callerProfileError));

  const callerRole = callerProfile?.role;
  if (callerRole !== 'admin' && callerRole !== 'super_admin' && callerRole !== 'manager') {
    throw new Error('Permission denied: only authorized administrators can modify account roles.');
  }
  if (user.id === userId && (newRole === 'admin' || newRole === 'super_admin')) {
    throw new Error('Self-promotion to administrative roles is prohibited.');
  }
  if (newRole === 'super_admin' && callerRole !== 'super_admin') {
    throw new Error('Only a super administrator can grant super administrator privileges.');
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({ role: newRole, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select('id')
    .maybeSingle();
  if (error) throw new Error(formatSupabaseError(error));
  if (!data?.id) throw new Error('The profile role was not changed because the profile was not found or is not accessible.');

  if (import.meta.env.DEV) {
    saveStoredCustomers(getStoredCustomers().map((customer) =>
      customer.id === userId ? { ...customer, role: newRole } : customer
    ));
  }
  return true;
}

/**
 * Updates customer contact data
 */
export async function updateCustomerDetails(
  id: string,
  updates: Partial<UnifiedCustomer>
): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    if (!import.meta.env.DEV) throw new Error('Supabase is not configured; customer details cannot be changed in production.');
    const localList = getStoredCustomers();
    if (!localList.some((customer) => customer.id === id)) throw new Error('Customer was not found in the local development directory.');
    saveStoredCustomers(localList.map((customer) => customer.id === id ? { ...customer, ...updates } : customer));
    return true;
  }

  const isUuid = (value: string | null | undefined): value is string =>
    Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value));

  const profilePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.fullName !== undefined) profilePayload.full_name = updates.fullName;
  if (updates.phone !== undefined) profilePayload.phone = updates.phone;
  if (updates.country !== undefined) profilePayload.country = updates.country;

  const customerPayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.fullName !== undefined) {
    customerPayload.first_name = updates.fullName.trim().split(/\s+/)[0] || '';
    customerPayload.last_name = updates.fullName.trim().split(/\s+/).slice(1).join(' ');
  }
  if (updates.phone !== undefined) customerPayload.phone = updates.phone;
  if (updates.country !== undefined) customerPayload.country = updates.country;
  if (updates.hotel !== undefined) customerPayload.hotel = updates.hotel;

  let profileUpdated = false;
  let customerUpdated = false;

  if (isUuid(id) && Object.keys(profilePayload).length > 1) {
    const { data, error } = await supabase
      .from('profiles')
      .update(profilePayload)
      .eq('id', id)
      .select('id')
      .maybeSingle();
    if (error) throw new Error(formatSupabaseError(error));
    profileUpdated = Boolean(data?.id);
  }

  const customerId = updates.customerRecordId || (isUuid(id) ? id : null);
  if (isUuid(customerId) && Object.keys(customerPayload).length > 1) {
    const { data, error } = await supabase
      .from('customers')
      .update(customerPayload)
      .eq('id', customerId)
      .select('id')
      .maybeSingle();
    if (error) throw new Error(formatSupabaseError(error));
    customerUpdated = Boolean(data?.id);
  }

  if (!profileUpdated && !customerUpdated) {
    throw new Error('Customer details were not changed because no matching accessible profile or customer record was found.');
  }

  if (import.meta.env.DEV) {
    saveStoredCustomers(getStoredCustomers().map((customer) =>
      customer.id === id ? { ...customer, ...updates } : customer
    ));
  }
  return true;
}

/**
 * Deletes or archives a customer record
 */
export async function deleteCustomerRecord(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    if (!import.meta.env.DEV) throw new Error('Supabase is not configured; customer records cannot be deleted in production.');
    const localList = getStoredCustomers();
    if (!localList.some((customer) => customer.id === id)) throw new Error('Customer record was not found.');
    saveStoredCustomers(localList.filter((customer) => customer.id !== id));
    return true;
  }

  const { data: customer, error: customerReadError } = await supabase
    .from('customers')
    .select('id,user_id')
    .eq('id', id)
    .maybeSingle();
  if (customerReadError) throw new Error(formatSupabaseError(customerReadError));

  if (!customer?.id) {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', id)
      .maybeSingle();
    if (profileError) throw new Error(formatSupabaseError(profileError));
    if (profile?.id) {
      throw new Error('Registered user accounts cannot be deleted from the customer directory. Manage access through Security & Access instead.');
    }
    throw new Error('Customer record was not found or is not accessible.');
  }

  if (customer.user_id) {
    throw new Error('This customer record is linked to a registered user account. Manage account access separately; the customer record is retained.');
  }

  const { data: deleted, error: deleteError } = await supabase
    .from('customers')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle();
  if (deleteError) throw new Error(formatSupabaseError(deleteError));
  if (!deleted?.id) throw new Error('Customer record was not deleted because it no longer exists or is not accessible.');

  if (import.meta.env.DEV) {
    saveStoredCustomers(getStoredCustomers().filter((customer) => customer.id !== id));
  }
  return true;
}
