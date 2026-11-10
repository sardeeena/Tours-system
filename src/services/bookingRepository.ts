import { Booking, BookingStatus } from '../types/booking';
import {
  supabase,
  isSupabaseConfigured,
  formatSupabaseError,
  isSchemaMissing,
  isSchemaMissingError,
  setSchemaMissing,
} from './supabaseClient';
import { DbBooking } from '../types/database';
import { ALL_TOURS } from '../data/toursData';
import { bookingRateLimiter } from '../lib/security';
import { findOrCreateAuthoritativeCustomer } from './platformConsistency';
import { recordActivity } from './crmService';
import { publishAutomationEvent } from './communicationService';

export interface IBookingRepository {
  createBooking(booking: Booking): Promise<Booking>;
  getBooking(bookingReference: string): Promise<Booking | null>;
  findBooking(bookingReference: string, emailOrPhone: string): Promise<Booking | null>;
  getBookingsByEmail(email: string): Promise<Booking[]>;
  updateBooking(booking: Booking): Promise<Booking>;
  cancelBooking(bookingReference: string, reason: string): Promise<Booking | null>;
  listBookings(filters?: { status?: string; limit?: number }): Promise<Booking[]>;
}

export function generateBookingReference(): string {
  const currentYear = new Date().getFullYear();
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const char1 = letters.charAt(Math.floor(Math.random() * letters.length));
  const char2 = letters.charAt(Math.floor(Math.random() * letters.length));
  const digits = Math.floor(1000 + Math.random() * 9000);
  return `RST-${currentYear}-${char1}${char2}${digits}`;
}

export function validateBookingPayload(booking: Booking): { isValid: boolean; error?: string } {
  if (!booking.bookingReference || !booking.bookingReference.startsWith('RST-')) {
    return { isValid: false, error: 'Invalid booking reference format. Must start with RST-' };
  }
  if (!booking.customer || !booking.customer.email || !booking.customer.email.includes('@')) {
    return { isValid: false, error: 'A valid customer email address is required.' };
  }
  if (!booking.customer.firstName || booking.customer.firstName.trim().length === 0) {
    return { isValid: false, error: 'Customer first name is required.' };
  }
  if (!booking.guests || booking.guests.adults < 1) {
    return { isValid: false, error: 'At least one adult passenger is required.' };
  }
  if (!booking.date || isNaN(new Date(booking.date).getTime())) {
    return { isValid: false, error: 'A valid excursion departure date is required.' };
  }
  return { isValid: true };
}

const SEED_BOOKINGS: Booking[] = [];

class SupabaseBookingRepository implements IBookingRepository {
  private localKey = 'rse_bookings_cache';

  private getLocalBookings(): Booking[] {
    try {
      const data = localStorage.getItem(this.localKey);
      if (data) {
        return JSON.parse(data);
      }
    } catch {
      // ignore
    }
    return [];
  }

  private saveLocalBookings(bookings: Booking[]): void {
    try {
      localStorage.setItem(this.localKey, JSON.stringify(bookings));
    } catch {
      // ignore
    }
  }

  private static inFlightRefs = new Set<string>();

  async createBooking(booking: Booking): Promise<Booking> {
    const validation = validateBookingPayload(booking);
    if (!validation.isValid) {
      throw new Error(validation.error || 'Invalid booking details provided.');
    }

    // Validate passenger counts with integer and range discipline
    if (booking.guests.adults < 1) {
      throw new Error('At least one adult passenger is required.');
    }
    if ((booking.guests.children || 0) < 0 || (booking.guests.infants || 0) < 0) {
      throw new Error('Passenger counts cannot be negative.');
    }

    const adults = booking.guests?.adults;
    const children = booking.guests?.children ?? 0;
    const infants = booking.guests?.infants ?? 0;

    if (typeof adults !== 'number' || !Number.isInteger(adults) || adults < 1) {
      throw new Error('Reservations require at least 1 adult passenger (positive whole number).');
    }
    if (adults > 100) {
      throw new Error('Maximum allowed adult passenger quantity per reservation is 100.');
    }
    if (typeof children !== 'number' || !Number.isInteger(children) || children < 0) {
      throw new Error('Child passenger count must be a non-negative whole number (0 or greater).');
    }
    if (children > 100) {
      throw new Error('Maximum allowed child passenger quantity per reservation is 100.');
    }
    if (typeof infants !== 'number' || !Number.isInteger(infants) || infants < 0) {
      throw new Error('Infant passenger count must be a non-negative whole number (0 or greater).');
    }
    if (infants > 50) {
      throw new Error('Maximum allowed infant passenger quantity per reservation is 50.');
    }

    // Validate booking date is not in the past
    const bookingDateObj = new Date(booking.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (isNaN(bookingDateObj.getTime()) || bookingDateObj < today) {
      throw new Error('Excursion departure date cannot be in the past.');
    }

    // Genuine request idempotency token: unique per booking submission intent
    const idempotencyKey = booking.idempotencyKey || `idem_${booking.bookingReference}`;
    booking.idempotencyKey = idempotencyKey;
    const dedupeKey = idempotencyKey;

    if (SupabaseBookingRepository.inFlightRefs.has(dedupeKey)) {
      throw new Error('A reservation request with this transaction key is currently being processed. Please wait.');
    }
    SupabaseBookingRepository.inFlightRefs.add(dedupeKey);

    const limit = bookingRateLimiter.check();
    if (limit.isLocked) {
      SupabaseBookingRepository.inFlightRefs.delete(idempotencyKey);
      throw new Error(`Too many reservation requests submitted. Please wait ${limit.remainingSeconds} seconds before trying again.`);
    }

    const bookingDateStr = booking.date ? booking.date.split('T')[0] : '';

    if (!isSupabaseConfigured()) {
      // Never report a production reservation as successful when no authoritative
      // database is configured. Browser-only bookings are permitted only in local
      // development, where they are explicitly non-production test data.
      if (!import.meta.env.DEV) {
        SupabaseBookingRepository.inFlightRefs.delete(idempotencyKey);
        throw new Error('The reservation service is temporarily unavailable. Please try again later or contact our booking team.');
      }

      const newBooking: Booking = {
        ...booking,
        bookingId: booking.bookingId || `dev_bk_${Date.now()}`,
        status: booking.status || 'pending',
        paymentStatus: booking.paymentStatus || 'pending',
        createdAt: new Date().toISOString(),
      };
      const local = this.getLocalBookings();
      this.saveLocalBookings([newBooking, ...local.filter((b) => b.bookingReference !== newBooking.bookingReference)]);
      SupabaseBookingRepository.inFlightRefs.delete(idempotencyKey);
      return newBooking;
    }

    try {
      // 1. Authoritative Primary Path: create_booking_atomic RPC
      // Executes single PostgreSQL transaction with row-level capacity lock, server-side pricing,
      // passenger manifest creation, extras persistence, genuine request idempotency, and audit logging.
      const { data: atomicRes, error: rpcErr } = await supabase.rpc('create_booking_atomic', {
        p_tour_identifier: booking.tourId || booking.tourSlug || '',
        p_booking_date: bookingDateStr,
        p_adult_count: adults,
        p_child_count: children,
        p_infant_count: infants,
        p_customer_first_name: booking.customer.firstName.trim(),
        p_customer_last_name: booking.customer.lastName.trim(),
        p_customer_email: booking.customer.email.trim().toLowerCase(),
        p_customer_phone: `${booking.customer.countryCode || ''} ${booking.customer.phoneNumber || ''}`.trim(),
        p_customer_country: booking.customer.country || 'International',
        p_customer_hotel: booking.customer.hotelName || booking.pickup.hotelName || null,
        p_pickup_location_id: booking.pickup.locationId || null,
        p_pickup_room_number: booking.pickup.roomNumber || null,
        p_coupon_code: booking.couponCode?.trim() || null,
        p_extras: (booking.extras || []).map((e: any) => ({
          id: e.id || e.extraId || '',
          name: e.name,
          quantity: e.quantity || 1,
        })),
        p_payment_method: booking.paymentMethod || 'pay_at_pickup',
        p_special_requests: booking.customer.specialRequests || null,
        p_idempotency_key: idempotencyKey,
      });

      if (!rpcErr && atomicRes && typeof atomicRes === 'object') {
        const res = atomicRes as any;
        if (res.success === false) {
          throw new Error(res.error || 'Failed to complete reservation due to capacity or validation error.');
        }

        // Authoritative reservation confirmed
        booking.bookingId = res.bookingId || booking.bookingId;
        booking.bookingReference = res.bookingReference || booking.bookingReference;
        booking.status = (res.status as any) || 'pending';
        booking.paymentStatus = (res.paymentStatus as any) || 'pending';
        if (res.totalEur !== undefined && res.totalEur !== null) {
          booking.pricing.totalEur = Number(res.totalEur);
          booking.pricing.formattedTotal = `€${Number(res.totalEur).toFixed(2)}`;
        }
        if (res.discountEur !== undefined && res.discountEur !== null) {
          booking.pricing.discountEur = Number(res.discountEur);
        }
        if (res.subtotalEur !== undefined && res.subtotalEur !== null) {
          booking.pricing.subtotalEur = Number(res.subtotalEur);
        }

        // Only commit to local state cache after authoritative database transaction succeeds
        const currentLocal = this.getLocalBookings();
        const updatedLocal = [booking, ...currentLocal.filter((b) => b.bookingReference !== booking.bookingReference)];
        this.saveLocalBookings(updatedLocal);

        return booking;
      }

      // Authoritative reservation pipeline: create_booking_atomic is the sole booking route.
      // Reject any attempt to perform uncoordinated direct client-side table writes.
      if (rpcErr) {
        throw new Error(rpcErr.message || 'The reservation system encountered an error. Please try again.');
      }

      throw new Error('Unexpected response received from reservation service. Please verify your booking status.');
    } catch (err: any) {
      console.error('Failed to create booking in Supabase:', err);
      throw new Error(err.message || 'Unable to register excursion booking in database. Please verify your details.');
    } finally {
      SupabaseBookingRepository.inFlightRefs.delete(dedupeKey);
    }
  }

  async getBooking(bookingReference: string): Promise<Booking | null> {
    const cleanRef = bookingReference.trim().toUpperCase();

    // When Supabase is configured, Supabase is the sole authoritative source of truth.
    // Never fall back to mock data if a reference does not exist in the database.
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('bookings')
          .select(`
            *,
            tours (*),
            customers (*),
            booking_extras (*)
          `)
          .eq('booking_reference', cleanRef)
          .maybeSingle();

        if (error || !data) {
          return null;
        }

        return this.mapDbToBooking(data);
      } catch (err) {
        console.error('Supabase getBooking error:', err);
        return null;
      }
    }

    const local = this.getLocalBookings();
    const found = local.find((b) => b.bookingReference === cleanRef);
    return found || null;
  }

  async findBooking(bookingReference: string, emailOrPhone: string): Promise<Booking | null> {
    const cleanRef = (bookingReference || '').trim().toUpperCase();
    const cleanContact = (emailOrPhone || '').trim();

    if (!cleanRef) return null;

    if (isSupabaseConfigured()) {
      try {
        // 1. If contact verification is supplied, attempt the secure two-factor RPC first
        if (cleanContact) {
          const { data: rpcRes, error: rpcErr } = await supabase.rpc('lookup_booking_secure', {
            p_reference: cleanRef,
            p_verification: cleanContact,
          });

          const rawBooking = (rpcRes && typeof rpcRes === 'object')
            ? ((rpcRes as any).booking || ((rpcRes as any).bookingReference ? rpcRes : null))
            : null;

          if (!rpcErr && rawBooking && rawBooking.bookingReference) {
            return this.mapSecureBookingToBooking(rawBooking);
          }
        }

        // 2. Direct scoped query: retrieve the single booking record by reference
        // Unauthenticated callers without valid two-factor verification cannot browse bookings table directly.
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          // Anonymous visitors MUST provide valid verification and succeed through lookup_booking_secure
          return null;
        }

        const { data, error } = await supabase
          .from('bookings')
          .select(`
            *,
            tours (*),
            customers (*),
            booking_extras (*)
          `)
          .eq('booking_reference', cleanRef)
          .maybeSingle();

        if (error || !data) {
          return null;
        }

        // If contact verification was provided, verify it strictly matches this booking
        if (cleanContact) {
          const custEmail = (data.customers?.email || '').trim().toLowerCase();
          const queryLower = cleanContact.trim().toLowerCase();
          const emailMatch = custEmail === queryLower;

          // Normalized phone comparison: require at least 8 digits and exact match
          const custDigits = (data.customers?.phone || '').replace(/\D/g, '');
          const queryDigits = cleanContact.replace(/\D/g, '');
          const phoneMatch = queryDigits.length >= 8 && custDigits.length >= 8 && custDigits === queryDigits;

          if (!emailMatch && !phoneMatch) {
            return null;
          }
        } else {
          // If no contact verification provided, verify user is administrator or booking owner
          const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
          const isStaff = profile?.role === 'admin' || profile?.role === 'super_admin' || profile?.role === 'manager' || profile?.role === 'staff';
          if (!isStaff && data.user_id !== user.id) {
            return null;
          }
        }

        return this.mapDbToBooking(data);
      } catch (err) {
        console.error('Supabase findBooking error:', err);
        return null;
      }
    }

    // Dev sandbox fallback: require exact email or normalized phone match (>= 8 digits)
    const b = await this.getBooking(bookingReference);
    if (!b || !cleanContact) return null;

    const queryLower = cleanContact.trim().toLowerCase();
    const emailMatch = b.customer.email.trim().toLowerCase() === queryLower;
    const custDigits = (b.customer.phoneNumber || '').replace(/\D/g, '');
    const queryDigits = cleanContact.replace(/\D/g, '');
    const phoneMatch = queryDigits.length >= 8 && custDigits.length >= 8 && custDigits === queryDigits;

    if (emailMatch || phoneMatch) {
      return b;
    }

    return null;
  }

  async getBookingsByEmail(email: string): Promise<Booking[]> {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return [];

    if (isSupabaseConfigured()) {
      try {
        // Enforce session check: Ensure caller is authenticated
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          // Unauthenticated requests cannot browse customer bookings by email
          return [];
        }

        // Ensure user is querying their own email or possesses admin/staff privileges
        const isOwnEmail = (user.email || '').toLowerCase() === cleanEmail;
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();

        const isStaff = profile?.role === 'admin' || profile?.role === 'super_admin' || profile?.role === 'manager' || profile?.role === 'staff';
        if (!isOwnEmail && !isStaff) {
          // Cross-customer boundary: Reject unprivileged requests for another customer's bookings
          return [];
        }

        // Query database scoped by user ID or customer email
        const { data, error } = await supabase
          .from('bookings')
          .select(`
            *,
            tours (*),
            customers!inner (*),
            booking_extras (*)
          `)
          .eq('customers.email', cleanEmail)
          .order('created_at', { ascending: false });

        if (error || !data) {
          // Fallback scoped to user_id directly
          const { data: byUserId } = await supabase
            .from('bookings')
            .select(`
              *,
              tours (*),
              customers (*),
              booking_extras (*)
            `)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

          return (byUserId || []).map((d: any) => this.mapDbToBooking(d));
        }

        return data.map((d: any) => this.mapDbToBooking(d));
      } catch (err) {
        console.error('Supabase getBookingsByEmail error:', err);
        return [];
      }
    }

    // Dev sandbox fallback only
    return this.getLocalBookings().filter((b) => b.customer.email.toLowerCase() === cleanEmail);
  }

  async updateBooking(booking: Booking): Promise<Booking> {
    if (booking.status === 'cancelled') {
      throw new Error('Bookings must be cancelled through the authorized cancellation approval workflow.');
    }
    const local = this.getLocalBookings().map((item) => (item.bookingReference === booking.bookingReference ? booking : item));
    this.saveLocalBookings(local);

    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase
          .from('bookings')
          .update({
            status: booking.status,
            payment_status: booking.paymentStatus,
            pickup_hotel_name: booking.pickup.hotelName,
            pickup_room_number: booking.pickup.roomNumber,
            special_requests: booking.customer.specialRequests,
            updated_at: new Date().toISOString(),
          })
          .eq('booking_reference', booking.bookingReference);

        if (error) {
          throw new Error(formatSupabaseError(error));
        }
      } catch (err) {
        console.error('Update booking Supabase error:', err);
        throw err;
      }
    }

    // CRM Activity Timeline
    try {
      await recordActivity({
        customerId: booking.customerId,
        bookingId: booking.bookingId || booking.bookingReference,
        eventType: 'booking_updated',
        title: `Booking Updated: ${booking.bookingReference}`,
        description: `Status: ${booking.status}. Payment status: ${booking.paymentStatus}. Hotel: ${booking.pickup.hotelName || 'Direct Arrival'}.`,
        actor: 'Staff Dispatch',
        metadata: {
          bookingReference: booking.bookingReference,
          status: booking.status,
          paymentStatus: booking.paymentStatus,
        },
      });
    } catch {}

    // Automation Event
    try {
      await publishAutomationEvent(
        'booking.updated',
        {
          bookingReference: booking.bookingReference,
          status: booking.status,
          paymentStatus: booking.paymentStatus,
          date: booking.date,
          tourTitle: booking.tourTitle,
        },
        'booking',
        booking.bookingId || booking.bookingReference
      );
    } catch {}

    return booking;
  }

  async cancelBooking(bookingReference: string, reason: string, verification: string): Promise<Booking | null> {
    if (!verification?.trim()) {
      throw new Error('The booking email address or full phone number is required to verify a cancellation request.');
    }

    const existing = await this.findBooking(bookingReference, verification);
    if (!existing) return null;

    if (isSupabaseConfigured()) {
      const { data, error } = await supabase.rpc('request_booking_cancellation_secure', {
        p_reference: bookingReference.trim().toUpperCase(),
        p_verification: verification.trim(),
        p_reason: reason.trim().slice(0, 500),
      });
      if (error) throw new Error(formatSupabaseError(error));
      if (!data || (data as any).success !== true) {
        throw new Error((data as any)?.error || 'The cancellation request could not be verified.');
      }
    } else if (!import.meta.env.DEV) {
      throw new Error('The cancellation service is temporarily unavailable.');
    }

    const updated: Booking = {
      ...existing,
      status: 'cancellation_requested',
      cancellationReason: reason,
      cancellationRequestedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      timeline: [
        ...(existing.timeline || []),
        {
          id: `ev-${Date.now()}`,
          timestamp: new Date().toISOString(),
          title: 'Cancellation Requested',
          description: reason,
          type: 'cancellation',
        },
      ],
    };

    const local = this.getLocalBookings().map((item) =>
      item.bookingReference === bookingReference ? updated : item
    );
    this.saveLocalBookings(local);

    try {
      await recordActivity({
        customerId: existing.customerId,
        bookingId: existing.bookingId || existing.bookingReference,
        eventType: 'cancellation',
        title: `Cancellation Request: ${bookingReference}`,
        description: reason || 'Customer requested reservation cancellation.',
        actor: 'Customer Support',
        metadata: { bookingReference, reason, tourTitle: existing.tourTitle },
      });
    } catch {}

    try {
      await publishAutomationEvent(
        'booking.cancellation_requested',
        { bookingReference, reason, tourTitle: existing.tourTitle, tourDate: existing.date },
        'booking',
        existing.bookingId || bookingReference
      );
    } catch {}

    return updated;
  }

  async resolveBookingCancellation(
    bookingReference: string,
    decision: 'approve' | 'reject',
    reason?: string
  ): Promise<Booking | null> {
    if (!isSupabaseConfigured() && !import.meta.env.DEV) {
      throw new Error('The cancellation service is temporarily unavailable.');
    }

    const existing = await this.getBooking(bookingReference);
    if (!existing) return null;

    if (isSupabaseConfigured()) {
      const { data, error } = await supabase.rpc('admin_resolve_booking_cancellation', {
        p_reference: bookingReference.trim().toUpperCase(),
        p_decision: decision,
        p_reason: reason?.trim().slice(0, 500) || null,
      });
      if (error) throw new Error(formatSupabaseError(error));
      if (!data || (data as any).success !== true) {
        throw new Error((data as any)?.error || 'The cancellation decision could not be processed.');
      }
    }

    const resolvedStatus = decision === 'approve' ? 'cancelled' : (existing.status === 'cancellation_requested' ? 'confirmed' : existing.status);
    const updated: Booking = {
      ...existing,
      status: resolvedStatus,
      cancellationReason: reason || existing.cancellationReason,
      cancellationRequestedAt: undefined,
      updatedAt: new Date().toISOString(),
    };
    const local = this.getLocalBookings().map((item) =>
      item.bookingReference === bookingReference ? updated : item
    );
    this.saveLocalBookings(local);
    return updated;
  }

  async listBookings(filters?: { status?: string; limit?: number }): Promise<Booking[]> {
    if (!isSupabaseConfigured() || isSchemaMissing()) {
      const local = this.getLocalBookings();
      if (filters?.status && filters.status !== 'all') {
        return local.filter((b) => b.status === filters.status);
      }
      return local;
    }

    try {
      let query = supabase
        .from('bookings')
        .select(`
          *,
          tours (*),
          customers (*),
          booking_extras (*)
        `)
        .order('created_at', { ascending: false });

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      if (filters?.limit) {
        query = query.limit(filters.limit);
      }

      const { data, error } = await query;
      if (error || !data) {
        if (error && isSchemaMissingError(error)) {
          setSchemaMissing(true);
        }
        return [];
      }

      return data.map((d: any) => this.mapDbToBooking(d));
    } catch (err) {
      if (isSchemaMissingError(err)) {
        setSchemaMissing(true);
      }
      return [];
    }
  }

  private mapDbToBooking(data: any): Booking {
    const tour = data.tours || {};
    const customer = data.customers || {};
    const extras = data.booking_extras || [];
    const tourImg = tour.primary_image || (tour.tour_images && tour.tour_images[0]?.image_url) || '';
    const tourDest = tour.destination || (tour.destinations && tour.destinations.name) || 'Hurghada';

    return {
      bookingId: data.id,
      bookingReference: data.booking_reference,
      tourId: data.tour_id,
      tourSlug: tour.slug || 'orange-bay-island-snorkeling',
      tourTitle: tour.title || 'Red Sea Excursion',
      tourImage: tourImg || 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
      tourDestination: tourDest,
      tourDuration: tour.duration || (tour.duration_hours ? `${tour.duration_hours} Hours` : 'Full Day'),
      date: data.booking_date,
      guests: {
        adults: data.adult_count || 1,
        children: data.child_count || 0,
        infants: data.infant_count || 0,
      },
      pickup: {
        locationId: data.pickup_location_id || 'hurghada',
        locationName: data.pickup_hotel_name || 'Hurghada Hotels',
        area: 'Hurghada Coastal Area',
        feeEur: 0,
        hotelName: data.pickup_hotel_name || customer.hotel || 'Hotel Lobby',
        roomNumber: data.pickup_room_number || '',
      },
      extras: extras.map((ex: any) => ({
        extraId: ex.id,
        name: ex.name,
        priceEur: Number(ex.unit_price),
        pricingType: ex.pricing_type as any,
        quantity: ex.quantity,
        amountEur: Number(ex.total_price),
      })),
      pricing: {
        basePricePerAdultEur: Number(tour.price) || 35,
        basePricePerChildEur: Number(tour.child_price) || 18,
        adultSubtotalEur: (data.adult_count || 1) * (Number(tour.price) || 35),
        childSubtotalEur: (data.child_count || 0) * (Number(tour.child_price) || 18),
        infantSubtotalEur: 0,
        pickupSubtotalEur: 0,
        pickupFeePerPersonEur: 0,
        extrasSubtotalEur: Number(data.extras_total) || 0,
        extrasBreakdown: extras.map((ex: any) => ({
          extraId: ex.id,
          name: ex.name,
          amountEur: Number(ex.total_price),
          pricingType: ex.pricing_type,
          quantity: ex.quantity,
        })),
        discountEur: Number(data.discount) || 0,
        subtotalEur: Number(data.subtotal) || 0,
        totalEur: Number(data.total) || 0,
        formattedTotal: `€${Number(data.total).toFixed(2)}`,
        formattedSubtotal: `€${Number(data.subtotal).toFixed(2)}`,
      },
      customer: {
        firstName: customer.first_name || 'Guest',
        lastName: customer.last_name || '',
        email: customer.email || '',
        countryCode: customer.country_code || '',
        phoneNumber: customer.phone || '',
        country: customer.country || 'International',
        whatsappNumber: customer.whatsapp || customer.phone || '',
        hotelName: data.pickup_hotel_name || customer.hotel,
        roomNumber: data.pickup_room_number,
        specialRequests: data.special_requests || '',
      },
      paymentMethod: data.payment_method || 'pay_at_pickup',
      paymentStatus: data.payment_status || 'pending',
      status: data.status || 'pending',
      bookingStatus: data.status || 'pending',
      cancellationReason: data.cancellation_reason,
      createdAt: data.created_at || new Date().toISOString(),
      updatedAt: data.updated_at || new Date().toISOString(),
      timeline: [
        {
          id: 'ev-1',
          timestamp: data.created_at || new Date().toISOString(),
          title: 'Booking Confirmed',
          description: 'Reservation registered in Supabase database.',
          type: 'created',
        },
      ],
    };
  }

  private mapSecureBookingToBooking(sec: any): Booking {
    const tour = sec.tour || {};
    const customer = sec.customer || {};
    const guests = sec.guests || {};
    const pickup = sec.pickup || {};
    const pricing = sec.pricing || {};
    const extras = sec.extras || [];

    return {
      bookingId: sec.bookingReference,
      bookingReference: sec.bookingReference,
      tourId: tour.id || '',
      tourSlug: tour.slug || 'orange-bay-island-snorkeling',
      tourTitle: tour.title || 'Red Sea Excursion',
      tourImage: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
      tourDestination: 'Hurghada',
      tourDuration: tour.duration || 'Full Day (approx. 7 hours)',
      date: sec.bookingDate,
      guests: {
        adults: guests.adults || 1,
        children: guests.children || 0,
        infants: guests.infants || 0,
      },
      pickup: {
        locationId: 'hurghada',
        locationName: 'Hurghada Hotels',
        area: 'Hurghada Coastal Area',
        feeEur: 0,
        hotelName: pickup.hotelName || 'Hotel Lobby',
        roomNumber: pickup.roomNumber || '',
      },
      extras: extras.map((ex: any, idx: number) => ({
        extraId: `extra-${idx}`,
        name: ex.name,
        priceEur: Number(ex.unitPrice) || 0,
        pricingType: 'per_person' as any,
        quantity: ex.quantity || 1,
        amountEur: Number(ex.totalPrice) || 0,
      })),
      pricing: {
        basePricePerAdultEur: Number(pricing.subtotal) || 35,
        basePricePerChildEur: 18,
        adultSubtotalEur: Number(pricing.subtotal) || 35,
        childSubtotalEur: 0,
        infantSubtotalEur: 0,
        pickupSubtotalEur: 0,
        pickupFeePerPersonEur: 0,
        extrasSubtotalEur: Number(pricing.extrasTotal) || 0,
        extrasBreakdown: extras.map((ex: any, idx: number) => ({
          extraId: `extra-${idx}`,
          name: ex.name,
          amountEur: Number(ex.totalPrice) || 0,
          pricingType: 'per_person' as any,
          quantity: ex.quantity || 1,
        })),
        discountEur: Number(pricing.discount) || 0,
        subtotalEur: Number(pricing.subtotal) || 0,
        totalEur: Number(pricing.total) || 0,
        formattedTotal: pricing.formattedTotal || `€${Number(pricing.total || 0).toFixed(2)}`,
        formattedSubtotal: `€${Number(pricing.subtotal || 0).toFixed(2)}`,
      },
      customer: {
        firstName: customer.firstName || 'Guest',
        lastName: customer.lastName || '',
        email: customer.emailMasked || '',
        countryCode: '+49',
        phoneNumber: customer.phoneMasked || '',
        country: customer.country || 'International',
        whatsappNumber: customer.phoneMasked || '',
        hotelName: pickup.hotelName || '',
        roomNumber: pickup.roomNumber || '',
        specialRequests: sec.specialRequests || '',
      },
      paymentMethod: sec.paymentMethod || 'pay_at_pickup',
      paymentStatus: sec.paymentStatus || 'pending',
      status: sec.status || 'confirmed',
      bookingStatus: sec.status || 'confirmed',
      createdAt: sec.createdAt || new Date().toISOString(),
      updatedAt: sec.createdAt || new Date().toISOString(),
      timeline: [
        {
          id: 'ev-1',
          timestamp: sec.createdAt || new Date().toISOString(),
          title: 'Booking Confirmed',
          description: 'Reservation retrieved via secure verified lookup.',
          type: 'created',
        },
      ],
    };
  }
}

export const bookingRepository = new SupabaseBookingRepository();
