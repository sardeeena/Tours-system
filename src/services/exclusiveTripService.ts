import { supabase, isSupabaseConfigured } from './supabaseClient';

export interface ExclusiveTrip {
  id: string;
  tour_id: string;
  fixed_trip_price: number;
  currency: string;
  minimum_guests: number;
  maximum_guests: number;
  is_active: boolean;
  tours: {
    id: string;
    title: string;
    slug: string;
    short_description: string | null;
    description: string | null;
    duration: string;
    duration_hours: number;
    destinations?: { name: string } | null;
    tour_images?: Array<{ image_url: string; is_primary: boolean; sort_order: number }>;
  };
}

export interface ExclusiveDeparture {
  id: string;
  exclusive_trip_id: string;
  date: string;
  start_time: string;
  end_time: string;
  maximum_guests: number;
  status: 'scheduled' | 'confirmed' | 'cancelled' | 'completed';
  vessel_id: string | null;
  captain_id: string | null;
  guide_id: string | null;
  driver_id: string | null;
}

export interface ExclusiveReservationInput {
  departureId: string;
  guestCount: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country?: string;
  hotel?: string;
  paymentMethod: 'pay_at_pickup' | 'pay_online';
  specialRequests?: string;
  idempotencyKey: string;
}

function requireSupabase() {
  if (!isSupabaseConfigured()) {
    throw new Error('Exclusive trip reservations are temporarily unavailable. Please try again later.');
  }
  return supabase as any;
}

export async function getExclusiveTrips(): Promise<ExclusiveTrip[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('exclusive_trips')
    .select('id,tour_id,fixed_trip_price,currency,minimum_guests,maximum_guests,is_active,tours!inner(id,title,slug,short_description,description,duration,duration_hours,destinations(name),tour_images(image_url,is_primary,sort_order))')
    .eq('is_active', true)
    .eq('tours.status', 'published')
    .eq('tours.is_exclusive', true)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message || 'Unable to load exclusive trips.');
  return (data || []).map((trip: any) => ({
    ...trip,
    fixed_trip_price: Number(trip.fixed_trip_price),
    tours: {
      ...trip.tours,
      tour_images: [...(trip.tours?.tour_images || [])].sort((a: any, b: any) =>
        Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order
      ),
    },
  }));
}

export async function getExclusiveDepartures(tripId: string): Promise<ExclusiveDeparture[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('exclusive_departures')
    .select('id,exclusive_trip_id,date,start_time,end_time,maximum_guests,status,vessel_id,captain_id,guide_id,driver_id')
    .eq('exclusive_trip_id', tripId)
    .eq('status', 'confirmed')
    .gte('date', new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' }))
    .order('date', { ascending: true })
    .order('start_time', { ascending: true });
  if (error) throw new Error(error.message || 'Unable to load exclusive trip availability.');
  return data || [];
}

export async function reserveExclusiveTrip(input: ExclusiveReservationInput) {
  const client = requireSupabase();
  const { data, error } = await client.rpc('reserve_exclusive_trip', {
    p_departure_id: input.departureId,
    p_guest_count: input.guestCount,
    p_first_name: input.firstName.trim(),
    p_last_name: input.lastName.trim(),
    p_email: input.email.trim().toLowerCase(),
    p_phone: input.phone.trim(),
    p_country: input.country?.trim() || null,
    p_hotel: input.hotel?.trim() || null,
    p_payment_method: input.paymentMethod,
    p_special_requests: input.specialRequests?.trim() || null,
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) throw new Error(error.message || 'Unable to reserve this exclusive trip.');
  if (!data?.success) throw new Error(data?.error || 'The exclusive trip could not be reserved.');
  return data as {
    success: true;
    duplicate: boolean;
    reservationId: string;
    reservationReference: string;
    total: number;
    currency: string;
    status: string;
    guestCount?: number;
  };
}

export async function getAdminExclusiveTours() {
  const client = requireSupabase();
  const { data, error } = await client
    .from('tours')
    .select('id,title,slug,status,is_exclusive,destinations(name),exclusive_trips(id,fixed_trip_price,currency,minimum_guests,maximum_guests,is_active)')
    .order('title', { ascending: true });
  if (error) throw new Error(error.message || 'Unable to load tours for Exclusive management.');
  return data || [];
}

export async function saveExclusiveTrip(input: {
  tourId: string;
  fixedTripPrice: number;
  currency: string;
  minimumGuests: number;
  maximumGuests: number;
  isActive: boolean;
}) {
  const client = requireSupabase();
  if (!Number.isFinite(input.fixedTripPrice) || input.fixedTripPrice <= 0) {
    throw new Error('Enter a fixed trip price greater than zero.');
  }
  if (!Number.isInteger(input.minimumGuests) || !Number.isInteger(input.maximumGuests)
    || input.minimumGuests < 1 || input.maximumGuests < input.minimumGuests || input.maximumGuests > 500) {
    throw new Error('Guest limits must be whole numbers, with maximum greater than or equal to minimum.');
  }
  if (!/^[A-Z]{3}$/.test(input.currency)) {
    throw new Error('Select a valid three-letter currency code.');
  }
  const { data, error } = await client.rpc('save_exclusive_trip_settings', {
    p_tour_id: input.tourId,
    p_fixed_trip_price: input.fixedTripPrice,
    p_currency: input.currency,
    p_minimum_guests: input.minimumGuests,
    p_maximum_guests: input.maximumGuests,
    p_is_active: input.isActive,
  });
  if (error) throw new Error(error.message || 'Unable to save Exclusive trip settings.');
  if (!data?.success) throw new Error('Exclusive trip settings were not saved.');
}

export async function createExclusiveDeparture(input: {
  tripId: string;
  date: string;
  startTime: string;
  endTime: string;
  maximumGuests: number;
  vesselId?: string;
  captainId?: string;
  guideId?: string;
  driverId?: string;
}) {
  const client = requireSupabase();
  const { error } = await client.from('exclusive_departures').insert({
    exclusive_trip_id: input.tripId,
    date: input.date,
    start_time: input.startTime,
    end_time: input.endTime,
    maximum_guests: input.maximumGuests,
    status: 'confirmed',
    vessel_id: input.vesselId || null,
    captain_id: input.captainId || null,
    guide_id: input.guideId || null,
    driver_id: input.driverId || null,
  });
  if (error) throw new Error(error.message || 'Unable to create this Exclusive departure.');
}

export async function getAdminExclusiveDepartures(tripId: string) {
  const client = requireSupabase();
  const { data, error } = await client
    .from('exclusive_departures')
    .select('*,exclusive_reservations(id,reservation_reference,customer_first_name,customer_last_name,customer_email,customer_phone,guest_count,total,currency,status,payment_status)')
    .eq('exclusive_trip_id', tripId)
    .order('date', { ascending: true })
    .order('start_time', { ascending: true });
  if (error) throw new Error(error.message || 'Unable to load Exclusive departures and reservations.');
  return data || [];
}

export async function updateExclusiveReservation(
  reservationId: string,
  changes: { status?: string; payment_status?: string }
) {
  const client = requireSupabase();
  const { data, error } = await client.rpc('update_exclusive_reservation_status', {
    p_reservation_id: reservationId,
    p_status: changes.status || null,
    p_payment_status: changes.payment_status || null,
  });
  if (error) throw new Error(error.message || 'Unable to update the Exclusive reservation and linked booking.');
  if (!data?.success) throw new Error('The Exclusive reservation was not updated.');
}

export async function getExclusiveResourceOptions() {
  const client = requireSupabase();
  const [vessels, guides] = await Promise.all([
    client.from('vessels').select('id,name,passenger_capacity,is_active').eq('is_active', true).order('name'),
    client.from('guides').select('id,full_name,role,is_active').eq('is_active', true).order('full_name'),
  ]);
  if (vessels.error) throw new Error(vessels.error.message || 'Unable to load active vessels.');
  if (guides.error) throw new Error(guides.error.message || 'Unable to load active crew.');
  return { vessels: vessels.data || [], guides: guides.data || [] };
}
