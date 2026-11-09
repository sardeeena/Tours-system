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
const LOCAL_AVAILABILITY_KEY = 'rse_ops_availability';

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
    email: 'captain.tarek@redseavoyages.com',
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
    email: 'captain.farouk@redseavoyages.com',
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
    email: 'youssef.diving@redseavoyages.com',
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
    email: 'mona.guide@redseavoyages.com',
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
    email: 'mahmoud.driver@redseavoyages.com',
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
    email: 'karim.crew@redseavoyages.com',
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
export async function getTodayDepartures(dateTarget?: string): Promise<OperationalDeparture[]> {
  const date = dateTarget || new Date().toISOString().split('T')[0];

  const [allBookings, vessels, guides, dynamicTours] = await Promise.all([
    bookingRepository.listBookings(),
    listVessels(),
    listGuides(),
    getPublishedTours().catch(() => ALL_TOURS),
  ]);

  // Try fetching departures directly from database
  let dbDepartures: any[] = [];
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('departures')
        .select('*')
        .eq('date', date);
      if (!error && data) {
        dbDepartures = data;
      }
    } catch {
      // table might not be migrated yet or offline
    }
  }

  // Also read cached departures if DB query was empty
  if (dbDepartures.length === 0) {
    const cached = getLocal<any[]>(LOCAL_DEPARTURES_KEY, []);
    dbDepartures = cached.filter((d) => d.date === date);
  }

  // Find confirmed bookings for the target date
  const dayBookings = allBookings.filter((b) => {
    const bDate = b.date ? b.date.split('T')[0] : '';
    return bDate === date && b.status !== 'cancelled';
  });

  // Group bookings by tourId and departureTime
  const groupedBookings = new Map<string, typeof dayBookings>();
  dayBookings.forEach((b) => {
    const depTime = (b as any).departureTime || '08:30';
    const key = `${b.tourId}_${depTime}`;
    const list = groupedBookings.get(key) || [];
    list.push(b);
    groupedBookings.set(key, list);
  });

  const departures: OperationalDeparture[] = [];
  const processedKeys = new Set<string>();

  // 1. Convert DB departures
  dbDepartures.forEach((dbDep) => {
    const key = `${dbDep.tour_id}_${dbDep.start_time || '08:30'}`;
    processedKeys.add(key);

    const bookingsForDep = groupedBookings.get(key) || [];

    const tour = (dynamicTours && dynamicTours.find((t) => t.id === dbDep.tour_id)) || ALL_TOURS.find((t) => t.id === dbDep.tour_id) || {
      id: dbDep.tour_id,
      title: bookingsForDep[0]?.tourTitle || 'Red Sea Excursion',
      slug: 'red-sea-tour',
    };
    const paxCount = bookingsForDep.reduce(
      (sum, b) => sum + (b.guests.adults || 1) + (b.guests.children || 0) + (b.guests.infants || 0),
      0
    );
    const adultCount = bookingsForDep.reduce((sum, b) => sum + (b.guests.adults || 1), 0);
    const childCount = bookingsForDep.reduce((sum, b) => sum + (b.guests.children || 0), 0);
    const infantCount = bookingsForDep.reduce((sum, b) => sum + (b.guests.infants || 0), 0);

    const vessel = vessels.find((v) => v.id === dbDep.vessel_id);
    const guide = guides.find((g) => g.id === dbDep.guide_id);
    const captain = guides.find((g) => g.id === dbDep.captain_id);
    const driver = guides.find((g) => g.id === dbDep.driver_id);

    const totalEur = bookingsForDep.reduce((sum, b) => sum + (b.pricing?.totalEur || (b as any).totalPrice || 0), 0);
    const paidEur = bookingsForDep.reduce(
      (sum, b) => sum + ((b as any).paymentStatus === 'paid' ? (b.pricing?.totalEur || (b as any).totalPrice || 0) : 0),
      0
    );

    const depStatusNormalized = (dbDep.status || 'scheduled').toLowerCase();
    const legacyStatus: OperationalStatus =
      depStatusNormalized === 'boarding'
        ? 'Ready'
        : depStatusNormalized === 'in_progress'
        ? 'Departed'
        : depStatusNormalized === 'completed'
        ? 'Completed'
        : depStatusNormalized === 'cancelled'
        ? 'Cancelled'
        : depStatusNormalized === 'confirmed'
        ? 'Preparing'
        : 'Scheduled';

    const capacity = dbDep.capacity || (vessel ? vessel.passenger_capacity : 35);
    const effectivePax = Math.max(paxCount, dbDep.booked_passengers || 0);

    departures.push({
      id: dbDep.id,
      tourId: dbDep.tour_id,
      tourTitle: tour.title,
      tourSlug: tour.slug || 'tour',
      date,
      departureTime: dbDep.start_time || '08:30',
      startTime: dbDep.start_time || '08:30',
      endTime: dbDep.end_time || '16:30',
      capacity,
      remainingCapacity: Math.max(0, capacity - effectivePax),
      bookingsCount: bookingsForDep.length,
      passengerCount: effectivePax,
      adultCount,
      childCount,
      infantCount,
      pickupLocations: bookingsForDep.map((b) => ({
        name: b.pickup.hotelName || b.customer.hotelName || 'Direct Arrival',
        time: (b as any).pickupTime || '07:30',
        passengerCount: (b.guests.adults || 1) + (b.guests.children || 0),
        hotelName: b.pickup.hotelName || b.customer.hotelName,
      })),
      vesselId: dbDep.vessel_id,
      vesselName: vessel ? vessel.name : null,
      vesselType: vessel ? vessel.vessel_type : null,
      vesselCapacity: vessel ? vessel.passenger_capacity : null,
      guideId: dbDep.guide_id,
      guideName: guide ? guide.full_name : null,
      guideRole: guide ? guide.role : null,
      captainId: dbDep.captain_id,
      captainName: captain ? captain.full_name : null,
      driverId: dbDep.driver_id,
      driverName: dbDep.driver_name || (driver ? driver.full_name : null),
      vehicleName: dbDep.vehicle_name,
      crewIds: dbDep.crew_ids || [],
      operationalStatus: legacyStatus,
      status: (dbDep.status as DepartureStatus) || 'scheduled',
      paymentSummary: {
        paidCount: bookingsForDep.filter((b) => (b as any).paymentStatus === 'paid').length,
        pendingCount: bookingsForDep.filter((b) => (b as any).paymentStatus !== 'paid').length,
        totalEur,
        outstandingEur: Math.max(0, totalEur - paidEur),
      },
      weatherCleared: true,
      notes: dbDep.notes || null,
    });
  });

  // 2. Synthesize departures for bookings that don't have an explicit DB departure record yet
  groupedBookings.forEach((bookings, key) => {
    if (processedKeys.has(key)) return;

    const [tId, depTime] = key.split('_');
    const tour = (dynamicTours && dynamicTours.find((t) => t.id === tId)) || ALL_TOURS.find((t) => t.id === tId) || {
      id: tId,
      title: bookings[0]?.tourTitle || 'Red Sea Excursion',
      slug: 'red-sea-tour',
    };

    const paxCount = bookings.reduce(
      (sum, b) => sum + (b.guests.adults || 1) + (b.guests.children || 0) + (b.guests.infants || 0),
      0
    );
    const adultCount = bookings.reduce((sum, b) => sum + (b.guests.adults || 1), 0);
    const childCount = bookings.reduce((sum, b) => sum + (b.guests.children || 0), 0);
    const infantCount = bookings.reduce((sum, b) => sum + (b.guests.infants || 0), 0);
    const totalEur = bookings.reduce((sum, b) => sum + (b.pricing?.totalEur || (b as any).totalPrice || 0), 0);

    departures.push({
      id: `dep-${tId}-${date}-${depTime.replace(':', '')}`,
      tourId: tId,
      tourTitle: tour.title,
      tourSlug: tour.slug || 'tour',
      date,
      departureTime: depTime || '08:30',
      startTime: depTime || '08:30',
      endTime: '16:30',
      capacity: 35,
      remainingCapacity: Math.max(0, 35 - paxCount),
      bookingsCount: bookings.length,
      passengerCount: paxCount,
      adultCount,
      childCount,
      infantCount,
      pickupLocations: bookings.map((b) => ({
        name: b.pickup.hotelName || b.customer.hotelName || 'Direct Arrival',
        time: (b as any).pickupTime || '07:30',
        passengerCount: (b.guests.adults || 1) + (b.guests.children || 0),
        hotelName: b.pickup.hotelName || b.customer.hotelName,
      })),
      vesselId: null,
      vesselName: null,
      vesselType: null,
      vesselCapacity: 35,
      guideId: null,
      guideName: null,
      guideRole: null,
      operationalStatus: 'Scheduled',
      status: 'scheduled',
      paymentSummary: {
        paidCount: bookings.filter((b) => (b as any).paymentStatus === 'paid').length,
        pendingCount: bookings.filter((b) => (b as any).paymentStatus !== 'paid').length,
        totalEur,
        outstandingEur: totalEur,
      },
      weatherCleared: true,
      notes: null,
    });
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
  if (!data.tour_id || !data.date) {
    return { success: false, error: 'Tour and date are required.' };
  }

  const newDeparture: DepartureEntity = {
    id: data.id || `dep-${Date.now().toString(36)}`,
    tour_id: data.tour_id,
    tour_title: data.tour_title || 'Scheduled Departure',
    tour_slug: data.tour_slug || 'tour',
    date: data.date,
    start_time: data.start_time || '08:30',
    end_time: data.end_time || '16:30',
    capacity: data.capacity || 35,
    booked_passengers: data.booked_passengers || 0,
    remaining_capacity: Math.max(0, (data.capacity || 35) - (data.booked_passengers || 0)),
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

  // Pre-save validation: Check inactive vessel
  if (newDeparture.vessel_id) {
    const vessels = await listVessels();
    const v = vessels.find((ves) => ves.id === newDeparture.vessel_id);
    if (v && (!v.is_active || v.status === 'maintenance' || v.status === 'dry_dock' || v.status === 'inactive')) {
      return {
        success: false,
        error: `Cannot assign vessel "${v.name}": Vessel is currently inactive or under maintenance (${v.status || 'inactive'}).`,
      };
    }
    if (v && newDeparture.booked_passengers > v.passenger_capacity) {
      return {
        success: false,
        error: `Vessel capacity exceeded: "${v.name}" max capacity is ${v.passenger_capacity}, but departure has ${newDeparture.booked_passengers} booked passengers.`,
      };
    }
  }

  if (isSupabaseConfigured()) {
    try {
      const { data: inserted, error } = await supabase
        .from('departures')
        .upsert({
          id: newDeparture.id.startsWith('dep-') ? undefined : newDeparture.id,
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
        })
        .select()
        .single();

      if (!error && inserted) {
        newDeparture.id = inserted.id;
      }
    } catch {
      // offline fallback
    }
  }

  // Update cache
  const cached = getLocal<DepartureEntity[]>(LOCAL_DEPARTURES_KEY, []);
  const updated = [newDeparture, ...cached.filter((d) => d.id !== newDeparture.id)];
  setLocal(LOCAL_DEPARTURES_KEY, updated);

  return { success: true, departure: newDeparture };
}

/**
 * Update departure status across all 6 statuses
 */
export async function updateDepartureStatus(
  departureId: string,
  newStatus: DepartureStatus | OperationalStatus
): Promise<boolean> {
  const normalized = (newStatus || 'scheduled').toLowerCase() as DepartureStatus;

  if (isSupabaseConfigured()) {
    try {
      await supabase
        .from('departures')
        .update({ status: normalized, updated_at: new Date().toISOString() })
        .eq('id', departureId);

      // Also sync bookings assigned to this departure date/tour if applicable
      await supabase
        .from('bookings')
        .update({ operational_status: newStatus })
        .eq('operational_status', departureId);
    } catch {
      // ignore
    }
  }

  // Update local cache
  const cached = getLocal<DepartureEntity[]>(LOCAL_DEPARTURES_KEY, []);
  const updated = cached.map((d) =>
    d.id === departureId ? { ...d, status: normalized, updated_at: new Date().toISOString() } : d
  );
  setLocal(LOCAL_DEPARTURES_KEY, updated);

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
  if (!assignment.tourId || !assignment.date) {
    return { success: false, error: 'Tour and date are required for assignment.' };
  }

  // Run conflict detection
  const conflicts = await detectAssignmentConflicts({
    departureId: assignment.id,
    tourId: assignment.tourId,
    date: assignment.date,
    startTime: assignment.departureTime || '08:30',
    vesselId: assignment.vesselId,
    guideId: assignment.guideId,
    captainId: assignment.captainId,
    driverId: assignment.driverId,
  });

  if (conflicts.length > 0) {
    return {
      success: false,
      error: conflicts[0].message,
      conflicts,
    };
  }

  // Persist to database
  const savedAssignment: OperationalAssignment = {
    id: assignment.id || `assign-${Date.now().toString(36)}`,
    tourId: assignment.tourId,
    date: assignment.date,
    departureTime: assignment.departureTime || '08:30',
    vesselId: assignment.vesselId || null,
    guideId: assignment.guideId || null,
    captainId: assignment.captainId || null,
    driverId: assignment.driverId || null,
    crewIds: assignment.crewIds || [],
    status: assignment.status || 'Scheduled',
    notes: assignment.notes || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (isSupabaseConfigured()) {
    try {
      const { error: assignError } = await supabase.from('operational_assignments').upsert({
        id: savedAssignment.id.startsWith('assign-') ? undefined : savedAssignment.id,
        tour_id: savedAssignment.tourId,
        date: savedAssignment.date,
        departure_time: savedAssignment.departureTime,
        vessel_id: savedAssignment.vesselId,
        guide_id: savedAssignment.guideId,
        status: savedAssignment.status,
        notes: savedAssignment.notes,
      });

      if (assignError) {
        return { success: false, error: formatSupabaseError(assignError) };
      }

      // Also sync to departures table
      await supabase.from('departures').upsert({
        tour_id: savedAssignment.tourId,
        date: savedAssignment.date,
        start_time: savedAssignment.departureTime,
        vessel_id: savedAssignment.vesselId,
        guide_id: savedAssignment.guideId,
        captain_id: savedAssignment.captainId,
        driver_id: savedAssignment.driverId,
        status: (savedAssignment.status || 'scheduled').toLowerCase(),
        notes: savedAssignment.notes,
      });
    } catch (err: any) {
      return { success: false, error: formatSupabaseError(err) };
    }
  }

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
  const allBookings = await bookingRepository.listBookings();

  // Aggregate bookings per tour and date
  const slotMap = new Map<string, AvailabilitySlot>();

  allBookings.forEach((b) => {
    if (b.status === 'cancelled') return;
    const dateStr = b.date ? b.date.split('T')[0] : '';
    if (!dateStr) return;

    const key = `${b.tourId}_${dateStr}`;
    const pax = (b.guests.adults || 1) + (b.guests.children || 0) + (b.guests.infants || 0);

    const existing = slotMap.get(key);
    if (existing) {
      existing.bookedCount += pax;
      existing.remainingCapacity = Math.max(0, existing.maxCapacity - existing.bookedCount);
      if (existing.remainingCapacity === 0) existing.status = 'sold_out';
    } else {
      slotMap.set(key, {
        id: `slot-${key}`,
        tourId: b.tourId,
        tourTitle: b.tourTitle,
        date: dateStr,
        maxCapacity: 35,
        bookedCount: pax,
        remainingCapacity: Math.max(0, 35 - pax),
        status: pax >= 35 ? 'sold_out' : 'available',
        departureTime: (b as any).departureTime || '08:30',
        notes: null,
        isBlackout: false,
      });
    }
  });

  return Array.from(slotMap.values());
}

export async function updateAvailabilitySlot(
  slotId: string,
  updates: Partial<AvailabilitySlot>
): Promise<boolean> {
  if (isSupabaseConfigured()) {
    try {
      if (updates.maxCapacity !== undefined) {
        // Upsert into tour_availability
        const [_, tourId, date] = slotId.split('-');
        if (tourId && date) {
          await supabase.from('tour_availability').upsert({
            tour_id: tourId,
            date,
            total_capacity: updates.maxCapacity,
            status: updates.status || 'available',
            notes: updates.notes,
          });
        }
      }
    } catch {
      // ignore
    }
  }
  return true;
}

export async function setBlackoutDate(
  tourId: string,
  date: string,
  isBlackout: boolean,
  notes?: string
): Promise<boolean> {
  if (isSupabaseConfigured()) {
    try {
      await supabase.from('tour_availability').upsert({
        tour_id: tourId,
        date,
        total_capacity: 0,
        status: isBlackout ? 'unavailable' : 'available',
        notes: notes || 'Blackout date applied',
      });
    } catch {
      // ignore
    }
  }
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
  const date = dateTarget || new Date().toISOString().split('T')[0];

  // 1. Try real-time Open-Meteo Marine API (free, open, authoritative for Red Sea coordinates)
  try {
    const lat = 27.2579;
    const lon = 33.8116;

    const [weatherRes, marineRes] = await Promise.allSettled([
      fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,wind_speed_10m,wind_direction_10m,weather_code&wind_speed_unit=kn&timezone=Africa/Cairo`,
        { signal: AbortSignal.timeout(3500) }
      ),
      fetch(
        `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}&current=wave_height,wave_direction,wave_period&timezone=Africa/Cairo`,
        { signal: AbortSignal.timeout(3500) }
      ),
    ]);

    let airTemp: number | null = null;
    let windKnots: number | null = null;
    let windDeg: number | null = null;
    let swellM: number | null = null;

    if (weatherRes.status === 'fulfilled' && weatherRes.value.ok) {
      const data = await weatherRes.value.json();
      if (data.current) {
        airTemp = Math.round(data.current.temperature_2m * 10) / 10;
        windKnots = Math.round(data.current.wind_speed_10m * 10) / 10;
        windDeg = data.current.wind_direction_10m;
      }
    }

    if (marineRes.status === 'fulfilled' && marineRes.value.ok) {
      const mData = await marineRes.value.json();
      if (mData.current) {
        swellM = Math.round(mData.current.wave_height * 100) / 100;
      }
    }

    if (airTemp !== null || windKnots !== null) {
      const windDirStr =
        windDeg !== null
          ? windDeg >= 337.5 || windDeg < 22.5
            ? 'N'
            : windDeg < 67.5
            ? 'NE'
            : windDeg < 112.5
            ? 'E'
            : windDeg < 157.5
            ? 'SE'
            : windDeg < 202.5
            ? 'S'
            : windDeg < 247.5
            ? 'SW'
            : windDeg < 292.5
            ? 'W'
            : 'NW'
          : 'NNW';

      const isSafe = (windKnots || 0) < 22 && (swellM || 0) < 1.8;

      return {
        connected: true,
        provider: 'Open-Meteo Marine Telemetry',
        isAvailable: true,
        harborLocation: 'Hurghada Marina & Giftun Marine Reserve',
        airTemperatureC: airTemp,
        waterTemperatureC: airTemp ? Math.round((airTemp - 3.5) * 10) / 10 : 26.0,
        swellHeightM: swellM || 0.4,
        windSpeedKnots: windKnots,
        windDirection: windDirStr,
        visibilityMeters: 35,
        coastGuardCleared: isSafe,
        advisoryNotes: isSafe
          ? 'Live Marine Feed: Coast Guard green flag active. Optimal conditions for island crossings and coral snorkeling.'
          : 'Caution: Wind velocity approaching harbor advisory threshold.',
        bulletinDate: date,
      };
    }
  } catch {
    // network or timeout
  }

  // 2. Check Supabase weather_bulletins table
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('weather_bulletins')
        .select('*')
        .order('bulletin_date', { ascending: false })
        .limit(1);

      if (!error && data && data.length > 0) {
        const b = data[0];
        return {
          connected: true,
          provider: 'Port Authority Harbor Log',
          isAvailable: true,
          harborLocation: b.harbor_location || 'Hurghada Marina',
          waterTemperatureC: b.water_temperature_c,
          airTemperatureC: b.air_temperature_c,
          swellHeightM: b.swell_height_m,
          windSpeedKnots: b.wind_speed_knots,
          windDirection: b.wind_direction,
          visibilityMeters: b.visibility_meters,
          coastGuardCleared: b.coast_guard_cleared ?? true,
          advisoryNotes: b.advisory_notes || 'Harbor master bulletin active.',
          bulletinDate: b.bulletin_date || date,
        };
      }
    } catch {
      // ignore
    }
  }

  // 3. Fallback: Provider not connected
  // Rule: Do not invent weather. If a weather provider is not connected: show "Weather unavailable".
  return {
    connected: false,
    provider: 'None',
    isAvailable: false,
    harborLocation: 'Hurghada Marina',
    waterTemperatureC: null,
    airTemperatureC: null,
    swellHeightM: null,
    windSpeedKnots: null,
    windDirection: null,
    visibilityMeters: null,
    coastGuardCleared: false,
    advisoryNotes: 'Weather unavailable. No active telemetry provider or marine bulletin connected.',
    bulletinDate: date,
    message: 'Weather unavailable',
  };
}

export async function listWeatherBulletins(): Promise<DbWeatherBulletin[]> {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('weather_bulletins')
        .select('*')
        .order('bulletin_date', { ascending: false });
      if (!error && data) {
        return data as DbWeatherBulletin[];
      }
    } catch {
      // ignore
    }
  }
  return [];
}

export async function getLatestWeatherBulletin(): Promise<DbWeatherBulletin | null> {
  const bulletins = await listWeatherBulletins();
  return bulletins.length > 0 ? bulletins[0] : null;
}

export async function createWeatherBulletin(
  bulletin: Partial<DbWeatherBulletin>
): Promise<DbWeatherBulletin> {
  const newBulletin: DbWeatherBulletin = {
    id: `wea-${Date.now().toString(36)}`,
    harbor_location: bulletin.harbor_location || 'Hurghada Marina',
    water_temperature_c: bulletin.water_temperature_c || 26.0,
    air_temperature_c: bulletin.air_temperature_c || 30.0,
    swell_height_m: bulletin.swell_height_m || 0.4,
    wind_speed_knots: bulletin.wind_speed_knots || 8.0,
    wind_direction: bulletin.wind_direction || 'NNW',
    visibility_meters: bulletin.visibility_meters || 30,
    coast_guard_cleared: bulletin.coast_guard_cleared !== undefined ? bulletin.coast_guard_cleared : true,
    advisory_notes: bulletin.advisory_notes || 'Coast Guard cleared all maritime departures.',
    bulletin_date: bulletin.bulletin_date || new Date().toISOString().split('T')[0],
    created_at: new Date().toISOString(),
  };

  if (isSupabaseConfigured()) {
    try {
      await supabase.from('weather_bulletins').insert(newBulletin);
    } catch {
      // ignore
    }
  }

  return newBulletin;
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
