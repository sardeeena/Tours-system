import { supabase, isSupabaseConfigured, formatSupabaseError } from './supabaseClient';
import {
  DbVessel,
  DbGuide,
  DbWeatherBulletin,
  DbTourAvailability,
} from '../types/database';
import {
  OperationalDeparture,
  OperationalStatus,
  DepartureStatus,
  PickupScheduleItem,
  PickupStatus,
  PassengerManifestItem,
  AvailabilitySlot,
  OperationalAssignment,
  AssignmentConflict,
  DepartureEntity,
  WeatherInfo,
} from '../types/operations';
import { bookingRepository } from './bookingRepository';
import { getPublishedTours } from './tourService';
import { ALL_TOURS } from '../data/toursData';

// Local storage keys for offline/fallback caching only
const LOCAL_VESSELS_KEY = 'rse_ops_vessels';
const LOCAL_GUIDES_KEY = 'rse_ops_guides';
const LOCAL_WEATHER_KEY = 'rse_ops_weather';
const LOCAL_DEPARTURES_KEY = 'rse_ops_departures';
const LOCAL_PICKUPS_KEY = 'rse_ops_pickups';

// Initial maritime fleet (fallback seed)
const INITIAL_VESSELS: DbVessel[] = [
  {
    id: 'c0000001-0000-0000-0000-000000000001',
    name: 'M/Y Red Sea Star VIP',
    vessel_type: 'motor_yacht',
    registration_number: 'HUR-8841-VIP',
    port_marina: 'Hurghada Marina',
    passenger_capacity: 45,
    crew_capacity: 5,
    year_built: 2021,
    safety_inspection_expiry: '2027-04-15',
    amenities: ['Air Conditioning', 'Sundeck with loungers', 'VIP Dining Saloon', 'Snorkel Gear Deck', 'Freshwater Showers'],
    is_active: true,
    status: 'active',
    maintenance_notes: 'Monthly engine check completed.',
    next_maintenance: '2026-11-15',
    crew: 'Captain Tarek + 3 Marine Crew',
    created_at: '2026-01-10T08:00:00Z',
    updated_at: '2026-01-10T08:00:00Z',
  },
  {
    id: 'c0000001-0000-0000-0000-000000000002',
    name: 'Dolphin Express II',
    vessel_type: 'speedboat',
    registration_number: 'HUR-3209-SPD',
    port_marina: 'Hurghada Marina',
    passenger_capacity: 12,
    crew_capacity: 2,
    year_built: 2023,
    safety_inspection_expiry: '2027-08-20',
    amenities: ['Twin 300HP Yamaha Engines', 'Bluetooth Marine Audio', 'Canopy Shade', 'Safety Life Vests'],
    is_active: true,
    status: 'active',
    maintenance_notes: 'Hull cleaned and inspected.',
    next_maintenance: '2026-12-01',
    crew: 'Captain Farouk + 1 Deckhand',
    created_at: '2026-02-15T09:00:00Z',
    updated_at: '2026-02-15T09:00:00Z',
  },
  {
    id: 'c0000001-0000-0000-0000-000000000003',
    name: 'Blue Horizon Catamaran',
    vessel_type: 'catamaran',
    registration_number: 'ELG-5512-CAT',
    port_marina: 'Abu Tig Marina, El Gouna',
    passenger_capacity: 35,
    crew_capacity: 4,
    year_built: 2020,
    safety_inspection_expiry: '2027-06-01',
    amenities: ['Trampoline Netting', 'Full Bar', 'Sound System', 'Snorkeling Platform', 'Shaded Cockpit'],
    is_active: true,
    status: 'active',
    maintenance_notes: 'Sails inspected; rigging verified.',
    next_maintenance: '2026-11-20',
    crew: 'Captain Nabil + 2 Stewards',
    created_at: '2026-03-01T10:00:00Z',
    updated_at: '2026-03-01T10:00:00Z',
  },
  {
    id: 'c0000001-0000-0000-0000-000000000004',
    name: 'Submarine Coral Explorer',
    vessel_type: 'semi_submarine',
    registration_number: 'MAK-1104-SUB',
    port_marina: 'Makadi Bay Jetty',
    passenger_capacity: 30,
    crew_capacity: 3,
    year_built: 2022,
    safety_inspection_expiry: '2027-05-10',
    amenities: ['Panoramic Underwater Windows', 'Reef Identification Charts', 'Air-Conditioned Observation Hull'],
    is_active: true,
    status: 'active',
    maintenance_notes: 'Sub-surface glass seals certified watertight.',
    next_maintenance: '2026-12-10',
    crew: 'Captain Hossam + 1 Marine Biologist',
    created_at: '2026-03-10T11:00:00Z',
    updated_at: '2026-03-10T11:00:00Z',
  },
  {
    id: 'c0000001-0000-0000-0000-000000000005',
    name: 'Red Sea Explorer (Drydock)',
    vessel_type: 'motor_yacht',
    registration_number: 'HUR-9901-DRY',
    port_marina: 'Hurghada Shipyard',
    passenger_capacity: 40,
    crew_capacity: 4,
    year_built: 2018,
    safety_inspection_expiry: '2026-06-01',
    amenities: ['Life Vests'],
    is_active: false,
    status: 'maintenance',
    maintenance_notes: 'Scheduled drydock overhaul and hull repainting.',
    next_maintenance: '2026-11-30',
    crew: 'Shipyard Team',
    created_at: '2026-01-01T08:00:00Z',
    updated_at: '2026-01-01T08:00:00Z',
  },
];

// Initial operational staff profiles (fallback seed)
const INITIAL_GUIDES: DbGuide[] = [
  {
    id: 'd0000001-0000-0000-0000-000000000001',
    full_name: 'Captain Tarek Mansour',
    role: 'captain',
    languages: ['Arabic', 'English', 'German'],
    phone: '+20 100 456 7891',
    email: '',
    license_number: 'EGY-MAR-MASTER-8842',
    rating: 4.95,
    is_active: true,
    availability_status: 'available',
    notes: 'Senior Yacht Master with 15+ years Red Sea navigation.',
    created_at: '2026-01-05T08:00:00Z',
  },
  {
    id: 'd0000001-0000-0000-0000-000000000002',
    full_name: 'Captain Farouk El-Sayed',
    role: 'captain',
    languages: ['Arabic', 'English', 'Russian'],
    phone: '+20 100 123 4567',
    email: '',
    license_number: 'EGY-MAR-MASTER-7210',
    rating: 5.0,
    is_active: true,
    availability_status: 'available',
    notes: 'Speedboat and marine rescue certified.',
    created_at: '2026-01-05T08:00:00Z',
  },
  {
    id: 'd0000001-0000-0000-0000-000000000003',
    full_name: 'Youssef Al-Bahr',
    role: 'dive_master',
    languages: ['English', 'German', 'French', 'Arabic'],
    phone: '+20 111 889 9001',
    email: '',
    license_number: 'PADI-DM-491023',
    rating: 4.9,
    is_active: true,
    availability_status: 'available',
    notes: 'PADI Master Scuba Diver Trainer; reef conservation expert.',
    created_at: '2026-01-12T09:00:00Z',
  },
  {
    id: 'd0000001-0000-0000-0000-000000000004',
    full_name: 'Mona Zaki',
    role: 'guide',
    languages: ['English', 'Italian', 'Russian', 'Arabic'],
    phone: '+20 102 334 5566',
    email: '',
    license_number: 'EGY-TOUR-GUIDE-3391',
    rating: 4.98,
    is_active: true,
    availability_status: 'available',
    notes: 'Ministry of Tourism licensed guide; Egyptology specialist.',
    created_at: '2026-01-15T10:00:00Z',
  },
  {
    id: 'd0000001-0000-0000-0000-000000000005',
    full_name: 'Mahmoud Hassan',
    role: 'driver',
    languages: ['Arabic', 'English'],
    phone: '+20 101 223 4455',
    email: '',
    license_number: 'EGY-COMM-DRV-4412',
    rating: 4.92,
    is_active: true,
    availability_status: 'available',
    notes: 'Air-conditioned Mercedes Sprinter VIP transfer driver.',
    created_at: '2026-01-20T10:00:00Z',
  },
  {
    id: 'd0000001-0000-0000-0000-000000000006',
    full_name: 'Karim Bedouin',
    role: 'crew',
    languages: ['Arabic', 'English', 'German'],
    phone: '+20 122 778 9911',
    email: '',
    license_number: 'EGY-MAR-CREW-0981',
    rating: 4.88,
    is_active: true,
    availability_status: 'available',
    notes: 'Marine deckhand and first aid responder.',
    created_at: '2026-02-01T11:00:00Z',
  },
];

// Helper storage cache with headless memory fallback
const memoryStore = new Map<string, string>();

function getLocal<T>(key: string, defaultValue: T): T {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(key);
      if (raw !== null && raw !== undefined) {
        return JSON.parse(raw);
      }
    }
  } catch {
    // fallback to memoryStore
  }
  const mem = memoryStore.get(key);
  return mem ? JSON.parse(mem) : defaultValue;
}

function setLocal<T>(key: string, data: T): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(data));
      return;
    }
  } catch {
    // fallback to memoryStore
  }
  memoryStore.set(key, JSON.stringify(data));
}

// ==============================================================================
// 1. DEPARTURES MANAGEMENT (SCHEDULED TOUR DEPARTURES)
// ==============================================================================

/**
 * List all departures for a specific date or date range.
 * Merges real database `departures` records with active bookings.
 */
function normalizeDepartureTime(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const match = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
  if (!match) return raw;
  let hour = Number(match[1]);
  const minute = match[2];
  const meridiem = match[3]?.toUpperCase();
  if (meridiem === 'PM' && hour < 12) hour += 12;
  if (meridiem === 'AM' && hour === 12) hour = 0;
  return `${String(hour).padStart(2, '0')}:${minute}`;
}

/**
 * Lists only explicit database departures for the selected date.
 * Bookings are attached to real departure rows; bookings never synthesize
 * departures, capacities, times, vessels, or weather clearance.
 */
export async function getTodayDepartures(dateTarget?: string): Promise<OperationalDeparture[]> {
  const now = new Date();
  const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const date = dateTarget || localToday;

  if (!isSupabaseConfigured()) {
    if (import.meta.env.DEV) {
      return getLocal<OperationalDeparture[]>(LOCAL_DEPARTURES_KEY, []).filter((departure) => departure.date === date);
    }
    throw new Error('Supabase is not configured; live departures cannot be loaded.');
  }

  const [{ data: dbDepartures, error: departuresError }, allBookings, vessels, guides, dynamicTours] = await Promise.all([
    supabase.from('departures').select('*').eq('date', date),
    bookingRepository.listBookings(),
    listVessels(),
    listGuides(),
    getPublishedTours().catch(() => []),
  ]);

  if (departuresError) throw new Error(formatSupabaseError(departuresError));

  const dayBookings = allBookings.filter((booking) => {
    const bookingDate = booking.date ? booking.date.split('T')[0] : '';
    return bookingDate === date && booking.status !== 'cancelled';
  });

  const groupedBookings = new Map<string, typeof dayBookings>();
  dayBookings.forEach((booking) => {
    const time = normalizeDepartureTime((booking as any).departureTime);
    const key = `${booking.tourId}_${time}`;
    const group = groupedBookings.get(key) || [];
    group.push(booking);
    groupedBookings.set(key, group);
  });

  const departures: OperationalDeparture[] = (dbDepartures || []).map((dbDep: any) => {
    const startTime = normalizeDepartureTime(dbDep.start_time);
    const key = `${dbDep.tour_id}_${startTime}`;
    const bookingsForDep = groupedBookings.get(key) || [];
    const tour = dynamicTours.find((item) => item.id === dbDep.tour_id);
    const vessel = vessels.find((item) => item.id === dbDep.vessel_id);
    const guide = guides.find((item) => item.id === dbDep.guide_id);
    const captain = guides.find((item) => item.id === dbDep.captain_id);
    const driver = guides.find((item) => item.id === dbDep.driver_id);

    const adultCount = bookingsForDep.reduce((sum, booking) => sum + (Number(booking.guests.adults) || 0), 0);
    const childCount = bookingsForDep.reduce((sum, booking) => sum + (Number(booking.guests.children) || 0), 0);
    const infantCount = bookingsForDep.reduce((sum, booking) => sum + (Number(booking.guests.infants) || 0), 0);
    const passengerCount = adultCount + childCount + infantCount;
    const effectivePassengers = Math.max(passengerCount, Number(dbDep.booked_passengers) || 0);
    const capacity = Math.max(0, Number(dbDep.capacity) || 0);

    const totalEur = bookingsForDep.reduce(
      (sum, booking) => sum + (Number(booking.pricing?.totalEur) || Number((booking as any).totalPrice) || 0),
      0
    );
    const paidEur = bookingsForDep.reduce(
      (sum, booking) => sum + ((booking as any).paymentStatus === 'paid'
        ? (Number(booking.pricing?.totalEur) || Number((booking as any).totalPrice) || 0)
        : 0),
      0
    );

    const pickupMap = new Map<string, { name: string; time: string; passengerCount: number; hotelName?: string }>();
    bookingsForDep.forEach((booking) => {
      const hotelName = (booking as any).pickup?.hotelName || (booking as any).customer?.hotelName || '';
      const name = hotelName || 'Pickup not specified';
      const pickupTime = String((booking as any).pickupTime || '');
      const pickupKey = `${name}_${pickupTime}`;
      const existing = pickupMap.get(pickupKey);
      const guests =
        (Number(booking.guests.adults) || 0) +
        (Number(booking.guests.children) || 0) +
        (Number(booking.guests.infants) || 0);
      if (existing) existing.passengerCount += guests;
      else pickupMap.set(pickupKey, { name, time: pickupTime, passengerCount: guests, hotelName: hotelName || undefined });
    });

    const status = (dbDep.status || 'scheduled') as DepartureStatus;
    const legacyStatus: OperationalStatus =
      status === 'boarding' ? 'Ready' :
      status === 'in_progress' ? 'Departed' :
      status === 'completed' ? 'Completed' :
      status === 'cancelled' ? 'Cancelled' :
      status === 'confirmed' ? 'Preparing' : 'Scheduled';

    return {
      id: dbDep.id,
      tourId: dbDep.tour_id,
      tourTitle: tour?.title || 'Tour record unavailable',
      tourSlug: tour?.slug || '',
      date,
      departureTime: startTime,
      startTime,
      endTime: normalizeDepartureTime(dbDep.end_time),
      capacity,
      remainingCapacity: Math.max(0, capacity - effectivePassengers),
      bookingsCount: bookingsForDep.length,
      passengerCount: effectivePassengers,
      adultCount,
      childCount,
      infantCount,
      pickupLocations: Array.from(pickupMap.values()),
      vesselId: dbDep.vessel_id || null,
      vesselName: vessel?.name || null,
      vesselType: vessel?.vessel_type || null,
      vesselCapacity: vessel ? Number(vessel.passenger_capacity) || null : null,
      guideId: dbDep.guide_id || null,
      guideName: guide?.full_name || null,
      guideRole: guide?.role || null,
      captainId: dbDep.captain_id || null,
      captainName: captain?.full_name || null,
      driverId: dbDep.driver_id || null,
      driverName: dbDep.driver_name || driver?.full_name || null,
      vehicleName: dbDep.vehicle_name || null,
      crewIds: dbDep.crew_ids || [],
      operationalStatus: legacyStatus,
      status,
      paymentSummary: {
        paidCount: bookingsForDep.filter((booking) => (booking as any).paymentStatus === 'paid').length,
        pendingCount: bookingsForDep.filter((booking) => (booking as any).paymentStatus !== 'paid').length,
        totalEur,
        outstandingEur: Math.max(0, totalEur - paidEur),
      },
      weatherCleared: null,
      notes: dbDep.notes || null,
    };
  });

  return departures.sort((a, b) => a.departureTime.localeCompare(b.departureTime));
}

/**
 * Create or save a scheduled tour departure in Supabase
 */
export async function createDeparture(data: Partial<DepartureEntity>): Promise<{
  success: boolean;
  departure?: DepartureEntity;
  error?: string;
}> {
  const capacity = Math.floor(Number(data.capacity) || 0);
  const bookedPassengers = Math.max(0, Math.floor(Number(data.booked_passengers) || 0));
  const startTime = String(data.start_time || '').trim();
  const endTime = String(data.end_time || '').trim();

  if (!data.tour_id || !data.date || !startTime || !endTime || capacity <= 0) {
    return { success: false, error: 'Tour, date, actual start time, end time, and positive capacity are required.' };
  }
  if (endTime <= startTime) {
    return { success: false, error: 'End time must be later than the start time.' };
  }
  if (bookedPassengers > capacity) {
    return { success: false, error: 'Booked passengers cannot exceed the configured departure capacity.' };
  }

  const newDeparture: DepartureEntity = {
    id: data.id || '',
    tour_id: data.tour_id,
    tour_title: data.tour_title || '',
    tour_slug: data.tour_slug || '',
    date: data.date,
    start_time: startTime,
    end_time: endTime,
    capacity,
    booked_passengers: bookedPassengers,
    remaining_capacity: capacity - bookedPassengers,
    status: data.status || 'scheduled',
    guide_id: data.guide_id || null,
    vessel_id: data.vessel_id || null,
    captain_id: data.captain_id || null,
    driver_id: data.driver_id || null,
    driver_name: data.driver_name || null,
    vehicle_name: data.vehicle_name || null,
    crew_ids: data.crew_ids || [],
    notes: data.notes || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (newDeparture.vessel_id) {
    const vessels = await listVessels();
    const vessel = vessels.find((item) => item.id === newDeparture.vessel_id);
    if (!vessel) return { success: false, error: 'The selected vessel does not exist in the live fleet records.' };
    if (!vessel.is_active || ['maintenance', 'dry_dock', 'inactive'].includes(vessel.status ?? '')) {
      return { success: false, error: `Cannot assign vessel "${vessel.name}": it is inactive or under maintenance.` };
    }
    if (bookedPassengers > vessel.passenger_capacity) {
      return { success: false, error: `Vessel capacity exceeded: "${vessel.name}" supports ${vessel.passenger_capacity} passengers.` };
    }
  }

  if (!isSupabaseConfigured()) {
    if (import.meta.env.DEV) {
      const cached = getLocal<DepartureEntity[]>(LOCAL_DEPARTURES_KEY, []);
      newDeparture.id = `local-departure-${Date.now()}`;
      setLocal(LOCAL_DEPARTURES_KEY, [newDeparture, ...cached]);
      return { success: true, departure: newDeparture };
    }
    return { success: false, error: 'Supabase is not configured; the departure was not saved.' };
  }

  const payload = {
    tour_id: newDeparture.tour_id,
    date: newDeparture.date,
    start_time: newDeparture.start_time,
    end_time: newDeparture.end_time,
    capacity: newDeparture.capacity,
    booked_passengers: newDeparture.booked_passengers,
    remaining_capacity: newDeparture.remaining_capacity,
    status: newDeparture.status,
    guide_id: newDeparture.guide_id,
    vessel_id: newDeparture.vessel_id,
    captain_id: newDeparture.captain_id,
    driver_id: newDeparture.driver_id,
    driver_name: newDeparture.driver_name,
    vehicle_name: newDeparture.vehicle_name,
    crew_ids: newDeparture.crew_ids,
    notes: newDeparture.notes,
  };

  const result = data.id
    ? await supabase.from('departures').update(payload).eq('id', data.id).select().single()
    : await supabase.from('departures').insert(payload).select().single();

  if (result.error || !result.data) {
    return { success: false, error: result.error ? formatSupabaseError(result.error) : 'The departure was not returned after saving.' };
  }

  newDeparture.id = result.data.id;
  return { success: true, departure: newDeparture };
}

/**
 * Update departure status and synchronize the operational status of bookings
 * assigned to that tour/date. Database errors are surfaced to the caller.
 */
export async function updateDepartureStatus(
  departureId: string,
  newStatus: DepartureStatus | OperationalStatus
): Promise<boolean> {
  const normalized = String(newStatus || 'scheduled').toLowerCase() as DepartureStatus;

  if (!isSupabaseConfigured()) {
    if (!import.meta.env.DEV) return false;
    const cached = getLocal<DepartureEntity[]>(LOCAL_DEPARTURES_KEY, []);
    setLocal(LOCAL_DEPARTURES_KEY, cached.map((departure) =>
      departure.id === departureId
        ? { ...departure, status: normalized, updated_at: new Date().toISOString() }
        : departure
    ));
    return true;
  }

  const { data: departure, error: lookupError } = await supabase
    .from('departures')
    .select('id,tour_id,date')
    .eq('id', departureId)
    .maybeSingle();

  if (lookupError || !departure) return false;

  const { error: departureError } = await supabase
    .from('departures')
    .update({ status: normalized, updated_at: new Date().toISOString() })
    .eq('id', departureId);

  if (departureError) return false;

  const { error: bookingError } = await supabase
    .from('bookings')
    .update({ operational_status: normalized })
    .eq('tour_id', departure.tour_id)
    .eq('booking_date', departure.date)
    .neq('status', 'cancelled');

  if (bookingError) return false;
  return true;
}

// ==============================================================================
// 2. ASSIGNMENT CONFLICT DETECTION (PRE-SAVE VALIDATION)
// ==============================================================================

function computeEndTime(startTime: string, durationHours?: number): string {
  const parts = (startTime || '08:30').split(':').map(Number);
  const dur = durationHours && durationHours > 0 ? durationHours : 8;
  const startMins = (parts[0] || 0) * 60 + (parts[1] || 0);
  const totalMins = startMins + Math.round(dur * 60);
  const endH = Math.min(23, Math.floor(totalMins / 60));
  const endM = totalMins % 60;
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
}

function isTimeConflicting(
  startA: string,
  endA?: string,
  startB?: string,
  endB?: string,
  durA?: number,
  durB?: number
): boolean {
  if (!startA || !startB) return false;
  if (startA.trim() === startB.trim()) return true;

  const toMins = (t?: string, defaultMins?: number) => {
    if (!t) return defaultMins ?? 0;
    const parts = t.split(':').map(Number);
    return (parts[0] || 0) * 60 + (parts[1] || 0);
  };

  const sA = toMins(startA, 510);
  const durMinsA = durA && durA > 0 ? Math.round(durA * 60) : 480;
  const eA = endA ? toMins(endA, sA + durMinsA) : sA + durMinsA;

  const sB = toMins(startB, 510);
  const durMinsB = durB && durB > 0 ? Math.round(durB * 60) : 480;
  const eB = endB ? toMins(endB, sB + durMinsB) : sB + durMinsB;

  return Math.max(sA, sB) < Math.min(eA, eB);
}

/**
 * Deep conflict detector: checks if vessel, guide, captain, or driver
 * is double-booked on overlapping departures, or if vessel capacity is exceeded.
 */
export async function detectAssignmentConflicts(params: {
  departureId?: string;
  tourId: string;
  date: string;
  startTime: string;
  vesselId?: string | null;
  guideId?: string | null;
  captainId?: string | null;
  driverId?: string | null;
  bookedPassengers?: number;
}): Promise<AssignmentConflict[]> {
  const conflicts: AssignmentConflict[] = [];

  const [departures, vessels, guides] = await Promise.all([
    getTodayDepartures(params.date),
    listVessels(),
    listGuides(),
  ]);

  const targetDeparture = departures.find(
    (d) => d.id === params.departureId || (d.tourId === params.tourId && d.departureTime === params.startTime)
  );
  const targetTour = ALL_TOURS.find((t) => t.id === params.tourId);
  const targetDuration = targetTour?.durationHours;
  const targetEndTime = targetDeparture?.endTime || computeEndTime(params.startTime, targetDuration);

  const passengerCount = params.bookedPassengers ?? targetDeparture?.passengerCount ?? 0;

  // 1. Vessel Checks
  if (params.vesselId) {
    const vessel = vessels.find((v) => v.id === params.vesselId);
    if (vessel) {
      // Check active status
      if (!vessel.is_active || vessel.status === 'maintenance' || vessel.status === 'dry_dock' || vessel.status === 'inactive') {
        conflicts.push({
          type: 'vessel_inactive',
          entityId: vessel.id,
          entityName: vessel.name,
          message: `Vessel "${vessel.name}" is currently ${vessel.status || 'inactive'}. Inactive vessels cannot be assigned.`,
        });
      }

      // Check capacity
      if (passengerCount > vessel.passenger_capacity) {
        conflicts.push({
          type: 'vessel_capacity_exceeded',
          entityId: vessel.id,
          entityName: vessel.name,
          message: `Exceeds capacity: ${passengerCount} passengers booked, but "${vessel.name}" only holds ${vessel.passenger_capacity} pax (Over by ${passengerCount - vessel.passenger_capacity}).`,
        });
      }

      // Check double booking
      const busyDep = departures.find((d) => {
        if (d.id === params.departureId || d.vesselId !== params.vesselId || d.status === 'cancelled') {
          return false;
        }
        const busyTour = ALL_TOURS.find((t) => t.id === d.tourId);
        const busyDuration = busyTour?.durationHours;
        const busyEndTime = d.endTime || computeEndTime(d.startTime || d.departureTime, busyDuration);
        return isTimeConflicting(
          d.startTime || d.departureTime,
          busyEndTime,
          params.startTime,
          targetEndTime,
          busyDuration,
          targetDuration
        );
      });

      if (busyDep) {
        conflicts.push({
          type: 'vessel_double_booked',
          entityId: vessel.id,
          entityName: vessel.name,
          conflictingDepartureId: busyDep.id,
          conflictingTourTitle: busyDep.tourTitle,
          message: `Vessel "${vessel.name}" is already assigned to "${busyDep.tourTitle}" at ${busyDep.departureTime}.`,
        });
      }
    }
  }

  // 2. Guide Checks
  if (params.guideId) {
    const guide = guides.find((g) => g.id === params.guideId);
    if (guide) {
      const busyDep = departures.find((d) => {
        if (d.id === params.departureId || d.guideId !== params.guideId || d.status === 'cancelled') {
          return false;
        }
        const busyTour = ALL_TOURS.find((t) => t.id === d.tourId);
        const busyDuration = busyTour?.durationHours;
        const busyEndTime = d.endTime || computeEndTime(d.startTime || d.departureTime, busyDuration);
        return isTimeConflicting(
          d.startTime || d.departureTime,
          busyEndTime,
          params.startTime,
          targetEndTime,
          busyDuration,
          targetDuration
        );
      });

      if (busyDep) {
        conflicts.push({
          type: 'guide_double_booked',
          entityId: guide.id,
          entityName: guide.full_name,
          conflictingDepartureId: busyDep.id,
          conflictingTourTitle: busyDep.tourTitle,
          message: `Tour Guide "${guide.full_name}" is already dispatched to "${busyDep.tourTitle}" at ${busyDep.departureTime}.`,
        });
      }
    }
  }

  // 3. Captain Checks
  if (params.captainId) {
    const captain = guides.find((g) => g.id === params.captainId);
    if (captain) {
      const busyDep = departures.find((d) => {
        if (
          d.id === params.departureId ||
          (d.captainId !== params.captainId && d.guideId !== params.captainId) ||
          d.status === 'cancelled'
        ) {
          return false;
        }
        const busyTour = ALL_TOURS.find((t) => t.id === d.tourId);
        const busyDuration = busyTour?.durationHours;
        const busyEndTime = d.endTime || computeEndTime(d.startTime || d.departureTime, busyDuration);
        return isTimeConflicting(
          d.startTime || d.departureTime,
          busyEndTime,
          params.startTime,
          targetEndTime,
          busyDuration,
          targetDuration
        );
      });

      if (busyDep) {
        conflicts.push({
          type: 'captain_double_booked',
          entityId: captain.id,
          entityName: captain.full_name,
          conflictingDepartureId: busyDep.id,
          conflictingTourTitle: busyDep.tourTitle,
          message: `Captain "${captain.full_name}" is already piloting "${busyDep.tourTitle}" at ${busyDep.departureTime}.`,
        });
      }
    }
  }

  // 4. Driver Checks
  if (params.driverId) {
    const driver = guides.find((g) => g.id === params.driverId);
    if (driver) {
      const busyDep = departures.find((d) => {
        if (d.id === params.departureId || d.driverId !== params.driverId || d.status === 'cancelled') {
          return false;
        }
        const busyTour = ALL_TOURS.find((t) => t.id === d.tourId);
        const busyDuration = busyTour?.durationHours;
        const busyEndTime = d.endTime || computeEndTime(d.startTime || d.departureTime, busyDuration);
        return isTimeConflicting(
          d.startTime || d.departureTime,
          busyEndTime,
          params.startTime,
          targetEndTime,
          busyDuration,
          targetDuration
        );
      });

      if (busyDep) {
        conflicts.push({
          type: 'driver_double_booked',
          entityId: driver.id,
          entityName: driver.full_name,
          conflictingDepartureId: busyDep.id,
          conflictingTourTitle: busyDep.tourTitle,
          message: `Transfer Driver "${driver.full_name}" is already assigned to "${busyDep.tourTitle}" pickup runs.`,
        });
      }
    }
  }

  return conflicts;
}

/**
 * Save operational assignment with pre-save conflict enforcement
 */
export async function saveAssignment(assignment: Partial<OperationalAssignment>): Promise<{
  success: boolean;
  error?: string;
  assignment?: OperationalAssignment;
  conflicts?: AssignmentConflict[];
}> {
  if (!assignment.tourId || !assignment.date || !assignment.departureTime) {
    return { success: false, error: 'Tour, date, and an explicit departure time are required.' };
  }
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase is not configured; operational assignments were not saved.' };
  }

  const departureTime = normalizeDepartureTime(assignment.departureTime);
  const { data: candidates, error: lookupError } = await supabase
    .from('departures')
    .select('id,start_time,end_time,capacity')
    .eq('tour_id', assignment.tourId)
    .eq('date', assignment.date);

  if (lookupError) return { success: false, error: formatSupabaseError(lookupError) };

  const departure = (candidates || []).find(
    (item: any) => normalizeDepartureTime(item.start_time) === departureTime
  );

  if (!departure || !departure.end_time || Number(departure.capacity) <= 0) {
    return {
      success: false,
      error: 'Create a departure with an actual start time, end time, and capacity before assigning staff or a vessel.',
    };
  }

  const conflicts = await detectAssignmentConflicts({
    departureId: departure.id,
    tourId: assignment.tourId,
    date: assignment.date,
    startTime: departureTime,
    vesselId: assignment.vesselId || null,
    guideId: assignment.guideId || null,
    captainId: assignment.captainId || null,
    driverId: assignment.driverId || null,
  });

  if (conflicts.length > 0) {
    return { success: false, error: conflicts[0].message, conflicts };
  }

  const now = new Date().toISOString();
  const operationalStatus = assignment.status || 'Scheduled';
  const statusMap: Record<string, DepartureStatus> = {
    Scheduled: 'scheduled',
    Preparing: 'confirmed',
    Ready: 'boarding',
    Departed: 'in_progress',
    Completed: 'completed',
    Cancelled: 'cancelled',
  };

  const { error: departureUpdateError } = await supabase
    .from('departures')
    .update({
      vessel_id: assignment.vesselId || null,
      guide_id: assignment.guideId || null,
      captain_id: assignment.captainId || null,
      driver_id: assignment.driverId || null,
      crew_ids: assignment.crewIds || [],
      status: statusMap[operationalStatus] || 'scheduled',
      notes: assignment.notes || null,
      updated_at: now,
    })
    .eq('id', departure.id);

  if (departureUpdateError) {
    return { success: false, error: formatSupabaseError(departureUpdateError) };
  }

  const { data: saved, error: assignError } = await supabase
    .from('operational_assignments')
    .upsert({
      tour_id: assignment.tourId,
      date: assignment.date,
      departure_time: departureTime,
      vessel_id: assignment.vesselId || null,
      guide_id: assignment.guideId || null,
      status: operationalStatus,
      notes: assignment.notes || null,
      updated_at: now,
    }, { onConflict: 'tour_id,date,departure_time' })
    .select()
    .single();

  if (assignError || !saved) {
    return {
      success: false,
      error: assignError ? formatSupabaseError(assignError) : 'Assignment was not returned after saving.',
    };
  }

  const savedAssignment: OperationalAssignment = {
    ...assignment,
    id: saved.id,
    tourId: assignment.tourId,
    date: assignment.date,
    departureTime,
    vesselId: assignment.vesselId || null,
    guideId: assignment.guideId || null,
    status: operationalStatus as OperationalAssignment['status'],
    notes: assignment.notes || null,
    createdAt: saved.created_at,
    updatedAt: saved.updated_at,
  };

  return { success: true, assignment: savedAssignment };
}

// ==============================================================================
// 3. PASSENGER MANIFESTS (OFFICIAL & PIER DISPATCH)
// ==============================================================================

/**
 * Generates an authoritative passenger manifest for a departure.
 * Never exposes raw payment/credit card tokens.
 */
export async function getPassengerManifest(
  dateFilter?: string,
  tourIdFilter?: string
): Promise<PassengerManifestItem[]> {
  const date = dateFilter || new Date().toISOString().split('T')[0];
  const allBookings = await bookingRepository.listBookings();

  const targetBookings = allBookings.filter((b) => {
    const bDate = b.date ? b.date.split('T')[0] : '';
    if (bDate !== date) return false;
    if (tourIdFilter && tourIdFilter !== 'all' && b.tourId !== tourIdFilter) return false;
    if (b.status === 'cancelled') return false;
    return true;
  });

  const manifest: PassengerManifestItem[] = [];

  targetBookings.forEach((b) => {
    const leadPartyId = `pass-lead-${b.bookingReference}`;
    const partyCount = (b.guests.adults || 1) + (b.guests.children || 0) + (b.guests.infants || 0);

    // Safely format payment status without revealing sensitive details
    const paymentStatus: PassengerManifestItem['paymentStatus'] =
      (b as any).paymentStatus === 'paid'
        ? 'paid'
        : (b as any).paymentStatus === 'deposit_paid'
        ? 'deposit_paid'
        : 'pending';

    // Format extras safely
    const extrasList = b.extras && Array.isArray(b.extras) && b.extras.length > 0
      ? b.extras.map((e: any) => `${e.name || e.id} (x${e.quantity || 1})`).join(', ')
      : null;

    // 1. Lead Passenger
    manifest.push({
      id: leadPartyId,
      bookingId: b.bookingId || b.bookingReference,
      bookingReference: b.bookingReference,
      tourId: b.tourId,
      tourTitle: b.tourTitle,
      tourDate: b.date || date,
      departureTime: (b as any).departureTime || '08:30',
      fullName: `${b.customer.firstName} ${b.customer.lastName}`,
      nationality: b.customer.country || 'International',
      passportOrId: null,
      dateOfBirth: null,
      gender: null,
      passengerType: 'adult',
      phone: b.customer.phoneNumber
        ? `${b.customer.countryCode || ''} ${b.customer.phoneNumber}`.trim()
        : null,
      hotel: b.pickup.hotelName || b.customer.hotelName || 'Direct Arrival',
      pickupTime: (b as any).pickupTime || '07:30',
      specialRequests: b.customer.specialRequests || null,
      extras: extrasList,
      paymentStatus,
      bookingStatus: (b.status as any) || 'confirmed',
      partySize: partyCount,
      isLeadPassenger: true,
    });

    // 2. Accompanying party members
    const totalAccompanying = partyCount - 1;
    for (let idx = 1; idx <= totalAccompanying; idx++) {
      const passId = `pass-${b.bookingReference}-${idx}`;
      const isChild = idx > Math.max(0, (b.guests.adults || 1) - 1);

      manifest.push({
        id: passId,
        bookingId: b.bookingId || b.bookingReference,
        bookingReference: b.bookingReference,
        tourId: b.tourId,
        tourTitle: b.tourTitle,
        tourDate: b.date || date,
        departureTime: (b as any).departureTime || '08:30',
        fullName: `Guest ${idx} (${b.customer.lastName} Party)`,
        nationality: b.customer.country || 'International',
        passportOrId: null,
        dateOfBirth: null,
        gender: null,
        passengerType: isChild ? 'child' : 'adult',
        phone: null,
        hotel: b.pickup.hotelName || b.customer.hotelName || 'Direct Arrival',
        pickupTime: (b as any).pickupTime || '07:30',
        specialRequests: null,
        extras: null,
        paymentStatus,
        bookingStatus: (b.status as any) || 'confirmed',
        partySize: partyCount,
        isLeadPassenger: false,
      });
    }
  });

  return manifest;
}

export async function updateManifestPassenger(
  passengerId: string,
  updates: Partial<PassengerManifestItem>
): Promise<boolean> {
  if (isSupabaseConfigured()) {
    try {
      if (updates.passportOrId || updates.nationality || updates.fullName) {
        await supabase.from('booking_passengers').upsert({
          id: passengerId.startsWith('pass-') ? undefined : passengerId,
          full_name: updates.fullName || 'Guest',
          nationality: updates.nationality,
          passport_or_id_number: updates.passportOrId,
        });
      }
    } catch {
      // ignore
    }
  }
  return true;
}

// ==============================================================================
// 4. PICKUP MANAGEMENT & STAFF BOARD
// ==============================================================================

/**
 * List daily pickup schedules with support for all 5 statuses:
 * 'pending' | 'confirmed' | 'picked_up' | 'no_show' | 'cancelled'
 */
export async function getDailyPickupSchedule(dateTarget?: string): Promise<PickupScheduleItem[]> {
  const date = dateTarget || new Date().toISOString().split('T')[0];
  const allBookings = await bookingRepository.listBookings();

  // Query dedicated pickup_schedules table if populated
  let dbPickups: any[] = [];
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('pickup_schedules')
        .select('*')
        .eq('tour_date', date);
      if (!error && data && data.length > 0) {
        dbPickups = data;
      }
    } catch {
      // ignore
    }
  }

  // Also read cached state
  const cachedExtras = getLocal<Record<string, Partial<PickupScheduleItem>>>(LOCAL_PICKUPS_KEY, {});

  const dayBookings = allBookings.filter((b) => {
    const bDate = b.date ? b.date.split('T')[0] : '';
    return bDate === date && b.status !== 'cancelled';
  });

  return dayBookings.map((b) => {
    const extra = cachedExtras[b.bookingReference] || {};
    const dbItem = dbPickups.find((p) => p.booking_reference === b.bookingReference);

    const partySize = (b.guests.adults || 1) + (b.guests.children || 0) + (b.guests.infants || 0);

    const rawStatus = dbItem?.status || extra.status || (b as any).pickupStatus || 'pending';
    const normalizedStatus: PickupStatus =
      rawStatus === 'Picked Up' || rawStatus === 'picked_up'
        ? 'picked_up'
        : rawStatus === 'No Show' || rawStatus === 'no_show'
        ? 'no_show'
        : rawStatus === 'Confirmed' || rawStatus === 'confirmed'
        ? 'confirmed'
        : rawStatus === 'Cancelled' || rawStatus === 'cancelled'
        ? 'cancelled'
        : 'pending';

    return {
      id: dbItem?.id || b.bookingId || b.bookingReference,
      bookingId: b.bookingId || b.bookingReference,
      bookingReference: b.bookingReference,
      customerName: `${b.customer.firstName} ${b.customer.lastName}`,
      customerPhone: b.customer.phoneNumber
        ? `${b.customer.countryCode || ''} ${b.customer.phoneNumber}`.trim()
        : null,
      hotelName: dbItem?.hotel || b.pickup.hotelName || b.customer.hotelName || 'Direct Arrival (Marina)',
      roomNumber: b.pickup.roomNumber || b.customer.roomNumber || null,
      pickupArea: dbItem?.location || b.pickup.area || 'Hurghada Central',
      pickupTime: dbItem?.pickup_time || extra.pickupTime || (b as any).pickupTime || '07:30',
      passengerCount: partySize,
      tourTitle: b.tourTitle,
      tourDate: b.date || date,
      departureTime: (b as any).departureTime || '08:30',
      driverId: dbItem?.driver_id || extra.driverId || null,
      driverName: dbItem?.driver_name || extra.driverName || 'Captain Mahmoud (Van #12)',
      driverVehicle: dbItem?.vehicle || extra.driverVehicle || 'Toyota HiAce VIP',
      status: normalizedStatus,
      specialRequests: b.customer.specialRequests || null,
      notes: dbItem?.notes || extra.notes || null,
    };
  }).sort((a, b) => a.pickupTime.localeCompare(b.pickupTime));
}

/**
 * Update pickup status and driver assignment on the pickup board
 */
export async function updatePickupScheduleStatus(
  bookingRef: string,
  newStatus: PickupStatus,
  driverVehicle?: string,
  driverName?: string
): Promise<boolean> {
  const normalized = (newStatus || 'pending').toLowerCase() as PickupStatus;

  // Update in-memory cache
  const cached = getLocal<Record<string, Partial<PickupScheduleItem>>>(LOCAL_PICKUPS_KEY, {});
  cached[bookingRef] = {
    ...(cached[bookingRef] || {}),
    status: normalized,
    driverVehicle: driverVehicle || cached[bookingRef]?.driverVehicle,
    driverName: driverName || cached[bookingRef]?.driverName,
  };
  setLocal(LOCAL_PICKUPS_KEY, cached);

  if (isSupabaseConfigured()) {
    try {
      // 1. Update pickup_schedules table if present
      await supabase
        .from('pickup_schedules')
        .update({
          status: normalized,
          vehicle: driverVehicle,
          driver_name: driverName,
          updated_at: new Date().toISOString(),
        })
        .eq('booking_reference', bookingRef);

      // 2. Sync to bookings table
      await supabase
        .from('bookings')
        .update({
          pickup_status: normalized,
          driver_vehicle: driverVehicle,
        })
        .eq('booking_reference', bookingRef);
    } catch {
      // ignore
    }
  }

  return true;
}

// ==============================================================================
// 5. VESSELS FLEET MANAGEMENT
// ==============================================================================

export async function listVessels(): Promise<DbVessel[]> {
  let vessels = getLocal<DbVessel[]>(LOCAL_VESSELS_KEY, INITIAL_VESSELS);

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase.from('vessels').select('*').order('name');
      if (!error && data && data.length > 0) {
        const dbVessels: DbVessel[] = data.map((d: any) => ({
          ...d,
          status: d.status || (d.is_active ? 'active' : 'inactive'),
        }));
        const dbIds = new Set(dbVessels.map((v) => v.id));
        const unsynced = vessels.filter((v) => !dbIds.has(v.id));
        vessels = [...dbVessels, ...unsynced];
        setLocal(LOCAL_VESSELS_KEY, vessels);
      }
    } catch {
      // ignore
    }
  }

  return vessels;
}

export async function saveVessel(vessel: Partial<DbVessel>): Promise<DbVessel> {
  const all = await listVessels();
  let saved: DbVessel;

  const status = vessel.status || (vessel.is_active !== false ? 'active' : 'inactive');
  const isActive = status === 'active' || status === 'in_service';

  if (vessel.id) {
    saved = {
      ...all.find((v) => v.id === vessel.id)!,
      ...vessel,
      status,
      is_active: isActive,
      updated_at: new Date().toISOString(),
    };
    const updated = all.map((v) => (v.id === vessel.id ? saved : v));
    setLocal(LOCAL_VESSELS_KEY, updated);
  } else {
    saved = {
      id: `ves-${Date.now().toString(36)}`,
      name: vessel.name || 'New Vessel',
      vessel_type: vessel.vessel_type || 'motor_yacht',
      registration_number: vessel.registration_number || null,
      port_marina: vessel.port_marina || 'Hurghada Marina',
      passenger_capacity: vessel.passenger_capacity || 35,
      crew_capacity: vessel.crew_capacity || 4,
      year_built: vessel.year_built || new Date().getFullYear(),
      safety_inspection_expiry: vessel.safety_inspection_expiry || '2027-12-31',
      amenities: vessel.amenities || ['Life Vests', 'First Aid Kit'],
      is_active: isActive,
      status,
      maintenance_notes: vessel.maintenance_notes || null,
      next_maintenance: vessel.next_maintenance || null,
      crew: vessel.crew || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setLocal(LOCAL_VESSELS_KEY, [saved, ...all]);
  }

  if (isSupabaseConfigured()) {
    try {
      const { error } = await supabase.from('vessels').upsert({
        id: saved.id.startsWith('ves-') ? undefined : saved.id,
        name: saved.name,
        vessel_type: saved.vessel_type,
        registration_number: saved.registration_number,
        port_marina: saved.port_marina,
        passenger_capacity: saved.passenger_capacity,
        crew_capacity: saved.crew_capacity,
        year_built: saved.year_built,
        safety_inspection_expiry: saved.safety_inspection_expiry,
        amenities: saved.amenities,
        is_active: saved.is_active,
        status: saved.status,
        maintenance_notes: saved.maintenance_notes,
        next_maintenance: saved.next_maintenance,
        crew: saved.crew,
      });
      if (error) {
        throw new Error(formatSupabaseError(error));
      }
    } catch (err: any) {
      console.error('Error saving vessel to Supabase:', err);
      throw err;
    }
  }

  return saved;
}

export async function deleteVessel(id: string): Promise<boolean> {
  const all = await listVessels();
  setLocal(LOCAL_VESSELS_KEY, all.filter((v) => v.id !== id));

  if (isSupabaseConfigured()) {
    try {
      const { error } = await supabase.from('vessels').delete().eq('id', id);
      if (error) {
        throw new Error(formatSupabaseError(error));
      }
    } catch (err: any) {
      console.error('Error deleting vessel from Supabase:', err);
      throw err;
    }
  }

  return true;
}

// ==============================================================================
// 6. GUIDES & OPERATIONAL STAFF PROFILES
// ==============================================================================

export async function listGuides(): Promise<DbGuide[]> {
  let guides = getLocal<DbGuide[]>(LOCAL_GUIDES_KEY, INITIAL_GUIDES);

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase.from('guides').select('*').order('full_name');
      if (!error && data && data.length > 0) {
        guides = data.map((d: any) => ({
          ...d,
          availability_status: d.availability_status || (d.is_active ? 'available' : 'unavailable'),
        }));
        setLocal(LOCAL_GUIDES_KEY, guides);
      }
    } catch {
      // ignore
    }
  }

  return guides;
}

export async function saveGuide(guide: Partial<DbGuide>): Promise<DbGuide> {
  const all = await listGuides();
  let saved: DbGuide;

  const avail = guide.availability_status || (guide.is_active !== false ? 'available' : 'unavailable');
  const isActive = avail === 'available' || avail === 'on_duty';

  if (guide.id) {
    saved = {
      ...all.find((g) => g.id === guide.id)!,
      ...guide,
      availability_status: avail,
      is_active: isActive,
    };
    const updated = all.map((g) => (g.id === guide.id ? saved : g));
    setLocal(LOCAL_GUIDES_KEY, updated);
  } else {
    saved = {
      id: `gui-${Date.now().toString(36)}`,
      full_name: guide.full_name || 'Staff Member',
      role: guide.role || 'guide',
      languages: guide.languages || ['English', 'Arabic'],
      phone: guide.phone || null,
      email: guide.email || null,
      license_number: guide.license_number || null,
      rating: guide.rating || 5.0,
      is_active: isActive,
      availability_status: avail,
      notes: guide.notes || null,
      created_at: new Date().toISOString(),
    };
    setLocal(LOCAL_GUIDES_KEY, [saved, ...all]);
  }

  if (isSupabaseConfigured()) {
    try {
      const { error } = await supabase.from('guides').upsert({
        id: saved.id.startsWith('gui-') ? undefined : saved.id,
        full_name: saved.full_name,
        role: saved.role,
        languages: saved.languages,
        phone: saved.phone,
        email: saved.email,
        license_number: saved.license_number,
        rating: saved.rating,
        is_active: saved.is_active,
        availability_status: saved.availability_status,
        notes: saved.notes,
      });
      if (error) {
        throw new Error(formatSupabaseError(error));
      }
    } catch (err: any) {
      console.error('Error saving guide to Supabase:', err);
      throw err;
    }
  }

  return saved;
}

export async function deleteGuide(id: string): Promise<boolean> {
  const all = await listGuides();
  setLocal(LOCAL_GUIDES_KEY, all.filter((g) => g.id !== id));

  if (isSupabaseConfigured()) {
    try {
      const { error } = await supabase.from('guides').delete().eq('id', id);
      if (error) {
        throw new Error(formatSupabaseError(error));
      }
    } catch (err: any) {
      console.error('Error deleting guide from Supabase:', err);
      throw err;
    }
  }

  return true;
}

// ==============================================================================
// 7. AVAILABILITY SLOTS
// ==============================================================================

export async function listAvailabilitySlots(): Promise<AvailabilitySlot[]> {
  if (!isSupabaseConfigured()) {
    if (import.meta.env.DEV) return [];
    throw new Error('Supabase is not configured; live availability cannot be loaded.');
  }

  const { data: rows, error } = await supabase
    .from('tour_availability')
    .select('id,tour_id,date,max_capacity,booked_count,status,notes')
    .order('date', { ascending: true });

  if (error) throw new Error(formatSupabaseError(error));
  if (!rows?.length) return [];

  const tourIds = [...new Set(rows.map((row: any) => row.tour_id).filter(Boolean))];
  const [{ data: tours, error: toursError }, allBookings] = await Promise.all([
    supabase.from('tours').select('id,title,slug,departure_time').in('id', tourIds),
    bookingRepository.listBookings(),
  ]);

  if (toursError) throw new Error(formatSupabaseError(toursError));

  const tourMap = new Map((tours || []).map((tour: any) => [tour.id, tour]));
  const bookedByDate = new Map<string, number>();

  allBookings.forEach((booking) => {
    if (booking.status === 'cancelled') return;
    const date = booking.date?.split('T')[0];
    if (!date) return;
    const key = `${booking.tourId}_${date}`;
    const passengers =
      (booking.guests.adults || 0) +
      (booking.guests.children || 0) +
      (booking.guests.infants || 0);
    bookedByDate.set(key, (bookedByDate.get(key) || 0) + passengers);
  });

  return rows.map((row: any) => {
    const tour = tourMap.get(row.tour_id);
    const maxCapacity = Math.max(0, Number(row.max_capacity) || 0);
    const bookedCount = Math.max(
      0,
      Number(row.booked_count) || 0,
      bookedByDate.get(`${row.tour_id}_${row.date}`) || 0
    );
    const remainingCapacity = Math.max(0, maxCapacity - bookedCount);
    const status: AvailabilitySlot['status'] =
      row.status === 'unavailable'
        ? 'unavailable'
        : row.status === 'sold_out' || (row.status === 'available' && remainingCapacity === 0)
          ? 'sold_out'
          : row.status === 'available'
            ? 'available'
            : 'unavailable';

    return {
      id: row.id,
      tourId: row.tour_id,
      tourTitle: tour?.title || 'Tour record unavailable',
      date: row.date,
      maxCapacity,
      bookedCount,
      remainingCapacity,
      status,
      departureTime: tour?.departure_time || '',
      notes: row.notes || null,
      isBlackout: status === 'unavailable',
    };
  });
}

export async function updateAvailabilitySlot(
  tourId: string,
  date: string,
  updates: Partial<AvailabilitySlot>
): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured; availability changes were not saved.');
  }

  const { data: existing, error: readError } = await supabase
    .from('tour_availability')
    .select('max_capacity,booked_count,status,notes')
    .eq('tour_id', tourId)
    .eq('date', date)
    .maybeSingle();

  if (readError) throw new Error(formatSupabaseError(readError));

  const maxCapacity = Math.max(
    0,
    Number(updates.maxCapacity ?? existing?.max_capacity) || 0
  );
  const bookedCount = Math.max(0, Number(existing?.booked_count) || 0);
  const status = updates.status ?? existing?.status ?? 'unavailable';

  if (maxCapacity < bookedCount) {
    throw new Error('Capacity cannot be reduced below the number of passengers already booked.');
  }
  if (status === 'available' && maxCapacity <= bookedCount) {
    throw new Error('A date needs an explicit capacity greater than its booked count before it can be opened.');
  }

  const { error } = await supabase
    .from('tour_availability')
    .upsert({
      tour_id: tourId,
      date,
      max_capacity: maxCapacity,
      status,
      notes: updates.notes ?? existing?.notes ?? 'Manual override: updated by operations',
    }, { onConflict: 'tour_id,date' });

  if (error) throw new Error(formatSupabaseError(error));
  return true;
}

export async function setBlackoutDate(
  tourId: string,
  date: string,
  isBlackout: boolean,
  notes?: string
): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured; blackout changes were not saved.');
  }

  const { data: existing, error: readError } = await supabase
    .from('tour_availability')
    .select('max_capacity,booked_count')
    .eq('tour_id', tourId)
    .eq('date', date)
    .maybeSingle();

  if (readError) throw new Error(formatSupabaseError(readError));

  const maxCapacity = Math.max(0, Number(existing?.max_capacity) || 0);
  const bookedCount = Math.max(0, Number(existing?.booked_count) || 0);
  if (!isBlackout && maxCapacity <= bookedCount) {
    throw new Error('This date cannot be reopened until an actual capacity greater than its booked count is configured.');
  }

  const { error } = await supabase
    .from('tour_availability')
    .upsert({
      tour_id: tourId,
      date,
      max_capacity: maxCapacity,
      status: isBlackout ? 'unavailable' : 'available',
      notes: isBlackout
        ? `Manual blackout: ${notes || 'Closed by operations'}`
        : `Manual override: ${notes || 'Reopened by operations'}`,
    }, { onConflict: 'tour_id,date' });

  if (error) throw new Error(formatSupabaseError(error));
  return true;
}

// ==============================================================================
// 8. WEATHER TELEMETRY (LIVE OPEN-METEO WITH 'WEATHER UNAVAILABLE' FALLBACK)
// ==============================================================================

/**
 * Fetches real marine weather for Red Sea (Hurghada / Giftun).
 * Per prompt requirements:
 * "Important: Do not invent weather.
 *  If a weather provider is not connected: show 'Weather unavailable'."
 */
export async function getMaritimeWeather(dateTarget?: string): Promise<WeatherInfo> {
  const now = new Date();
  const date = dateTarget || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  let bulletin: DbWeatherBulletin | null = null;
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('weather_bulletins')
      .select('*')
      .order('bulletin_date', { ascending: false })
      .limit(30);

    if (error) {
      console.warn('Unable to load operator weather bulletins:', error);
    } else {
      bulletin = (data || []).find((item: any) => String(item.bulletin_date || '').split('T')[0] === date) || null;
    }
  }

  let airTemperatureC: number | null = null;
  let liveWindKnots: number | null = null;
  let liveWindDirection: string | null = null;
  let liveSwellHeightM: number | null = null;

  try {
    const lat = 27.2579;
    const lon = 33.8116;
    const [weatherResult, marineResult] = await Promise.allSettled([
      fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,wind_speed_10m,wind_direction_10m&wind_speed_unit=kn&timezone=Africa/Cairo`,
        { signal: AbortSignal.timeout(5000) }
      ),
      fetch(
        `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}&current=wave_height&timezone=Africa/Cairo`,
        { signal: AbortSignal.timeout(5000) }
      ),
    ]);

    if (weatherResult.status === 'fulfilled' && weatherResult.value.ok) {
      const data = await weatherResult.value.json();
      const current = data.current || {};
      if (current.temperature_2m !== null && current.temperature_2m !== undefined) {
        airTemperatureC = Number(current.temperature_2m);
      }
      if (current.wind_speed_10m !== null && current.wind_speed_10m !== undefined) {
        liveWindKnots = Number(current.wind_speed_10m);
      }
      if (current.wind_direction_10m !== null && current.wind_direction_10m !== undefined) {
        const direction = Number(current.wind_direction_10m);
        const labels = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
        liveWindDirection = labels[Math.round(direction / 45) % 8];
      }
    }

    if (marineResult.status === 'fulfilled' && marineResult.value.ok) {
      const data = await marineResult.value.json();
      const height = data.current?.wave_height;
      if (height !== null && height !== undefined) liveSwellHeightM = Number(height);
    }
  } catch (error) {
    console.warn('Live marine forecast unavailable:', error);
  }

  const bulletinAvailable = Boolean(bulletin);
  const liveAvailable =
    airTemperatureC !== null ||
    liveWindKnots !== null ||
    liveSwellHeightM !== null;

  const isAvailable = bulletinAvailable || liveAvailable;
  const windSpeedKnots = liveWindKnots ?? (bulletin ? Number(bulletin.wind_speed_knots) : null);
  const swellHeightM = liveSwellHeightM ?? (bulletin ? Number(bulletin.swell_height_m) : null);

  return {
    connected: isAvailable,
    provider: liveAvailable && bulletinAvailable
      ? 'Open-Meteo + operator bulletin'
      : liveAvailable
        ? 'Open-Meteo forecast'
        : bulletinAvailable
          ? 'Operator-recorded bulletin'
          : 'Unavailable',
    isAvailable,
    harborLocation: bulletin?.harbor_location || 'Hurghada Marina & Giftun Marine Reserve',
    waterTemperatureC: bulletin ? Number(bulletin.water_temperature_c) : null,
    airTemperatureC: airTemperatureC ?? (bulletin ? Number(bulletin.air_temperature_c) : null),
    swellHeightM,
    windSpeedKnots,
    windDirection: liveWindDirection ?? bulletin?.wind_direction ?? null,
    visibilityMeters: bulletin ? Number(bulletin.visibility_meters) : null,
    // Forecast data cannot establish official harbor or Coast Guard clearance.
    coastGuardCleared: bulletin?.coast_guard_cleared ?? null,
    advisoryNotes: bulletin?.advisory_notes || (
      liveAvailable
        ? 'Live forecast measurements only. Official port clearance has not been verified; confirm sailing permission with the harbor authority.'
        : 'No live weather measurements or operator-recorded port bulletin are available for this date.'
    ),
    bulletinDate: bulletin ? String(bulletin.bulletin_date).split('T')[0] : date,
    message: isAvailable ? undefined : 'Weather feed and operator-recorded harbor bulletin are unavailable.',
  };
}

export async function listWeatherBulletins(): Promise<DbWeatherBulletin[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await supabase
    .from('weather_bulletins')
    .select('*')
    .order('bulletin_date', { ascending: false });
  if (error) throw new Error(formatSupabaseError(error));
  return (data || []) as DbWeatherBulletin[];
}

export async function getLatestWeatherBulletin(): Promise<DbWeatherBulletin | null> {
  const bulletins = await listWeatherBulletins();
  return bulletins.length > 0 ? bulletins[0] : null;
}

export async function createWeatherBulletin(
  bulletin: Partial<DbWeatherBulletin>
): Promise<DbWeatherBulletin> {
  const requiredText = [bulletin.harbor_location, bulletin.wind_direction, bulletin.advisory_notes];
  const requiredNumbers = [
    bulletin.water_temperature_c,
    bulletin.air_temperature_c,
    bulletin.swell_height_m,
    bulletin.wind_speed_knots,
    bulletin.visibility_meters,
  ];

  if (!bulletin.bulletin_date || requiredText.some((value) => !String(value || '').trim())) {
    throw new Error('Harbor, wind direction, bulletin date, and advisory notes are required.');
  }
  if (requiredNumbers.some((value) => value === null || value === undefined || !Number.isFinite(Number(value)))) {
    throw new Error('Enter actual measured values for water temperature, air temperature, swell, wind speed, and visibility.');
  }
  if (typeof bulletin.coast_guard_cleared !== 'boolean') {
    throw new Error('Select the port authority clearance status explicitly. It cannot be inferred from weather data.');
  }

  const waterTemperature = Number(bulletin.water_temperature_c);
  const airTemperature = Number(bulletin.air_temperature_c);
  const swellHeight = Number(bulletin.swell_height_m);
  const windSpeed = Number(bulletin.wind_speed_knots);
  const visibility = Number(bulletin.visibility_meters);
  if (waterTemperature < 0 || waterTemperature > 40 ||
      airTemperature < -20 || airTemperature > 60 ||
      swellHeight < 0 || swellHeight > 20 ||
      windSpeed < 0 || windSpeed > 100 ||
      visibility <= 0 || visibility > 100000) {
    throw new Error('One or more weather measurements are outside the accepted physical range. Check the units and values.');
  }

  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured; the harbor bulletin was not saved.');
  }

  const payload = {
    harbor_location: String(bulletin.harbor_location).trim(),
    water_temperature_c: Number(bulletin.water_temperature_c),
    air_temperature_c: Number(bulletin.air_temperature_c),
    swell_height_m: Number(bulletin.swell_height_m),
    wind_speed_knots: Number(bulletin.wind_speed_knots),
    wind_direction: String(bulletin.wind_direction).trim(),
    visibility_meters: Math.floor(Number(bulletin.visibility_meters)),
    coast_guard_cleared: bulletin.coast_guard_cleared,
    advisory_notes: String(bulletin.advisory_notes).trim(),
    bulletin_date: bulletin.bulletin_date,
    provider: 'operator_manual',
    is_available: true,
  };

  const { data, error } = await supabase
    .from('weather_bulletins')
    .insert(payload)
    .select()
    .single();

  if (error) throw new Error(formatSupabaseError(error));
  if (!data) throw new Error('The weather bulletin was not returned after saving.');
  return data as DbWeatherBulletin;
}

// ------------------------------------------------------------------------------
// Legacy bridge for assignments
// ------------------------------------------------------------------------------
export async function listAssignments(dateTarget?: string): Promise<OperationalAssignment[]> {
  const departures = await getTodayDepartures(dateTarget);
  return departures.map((d) => ({
    id: d.id,
    tourId: d.tourId,
    tourTitle: d.tourTitle,
    date: d.date,
    departureTime: d.departureTime,
    vesselId: d.vesselId,
    vesselName: d.vesselName,
    guideId: d.guideId,
    guideName: d.guideName,
    captainId: d.captainId,
    captainName: d.captainName,
    driverId: d.driverId,
    driverName: d.driverName,
    crewIds: d.crewIds,
    status: d.operationalStatus,
    notes: d.notes,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));
}

/**
 * Authoritative customer-facing bridge:
 * Loads authoritative departure details (vessel, guide, boarding status, harbor berth)
 * directly from operations for a customer's specific booking.
 */
export async function getAuthoritativeDepartureForBooking(
  bookingReference: string,
  tourId: string,
  date: string
): Promise<{
  departure: OperationalDeparture | null;
  manifestItem: PassengerManifestItem | null;
  pickupItem: PickupScheduleItem | null;
}> {
  const departures = await getTodayDepartures(date);
  const matched =
    departures.find((d) => d.tourId === tourId) ||
    departures.find((d) => d.bookingsCount > 0) ||
    departures[0] ||
    null;

  let manifestItem: PassengerManifestItem | null = null;
  if (matched) {
    const manifest = await getPassengerManifest(date, tourId);
    manifestItem = manifest.find((m) => m.bookingReference === bookingReference) || null;
  }

  const pickups = await getDailyPickupSchedule(date);
  const pickupItem = pickups.find((p) => p.bookingReference === bookingReference) || null;

  return {
    departure: matched,
    manifestItem,
    pickupItem,
  };
}
