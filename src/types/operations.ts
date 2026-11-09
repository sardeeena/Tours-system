import { DbVessel, DbGuide, DbWeatherBulletin, DbBookingPassenger } from './database';

export type OperationalStatus =
  | 'scheduled'
  | 'confirmed'
  | 'boarding'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'Scheduled'
  | 'Preparing'
  | 'Ready'
  | 'Departed'
  | 'Completed'
  | 'Cancelled';

export type DepartureStatus =
  | 'scheduled'
  | 'confirmed'
  | 'boarding'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export type PickupStatus =
  | 'pending'
  | 'confirmed'
  | 'picked_up'
  | 'no_show'
  | 'cancelled'
  | 'Waiting'
  | 'Picked Up'
  | 'No Show'
  | 'Cancelled';

export type StaffRole =
  | 'guide'
  | 'captain'
  | 'driver'
  | 'crew'
  | 'photographer'
  | 'tour_guide'
  | 'dive_master'
  | 'snorkel_guide'
  | 'safari_lead'
  | 'other';

export type StaffAvailability =
  | 'available'
  | 'on_duty'
  | 'day_off'
  | 'leave'
  | 'unavailable';

export type VesselStatus =
  | 'active'
  | 'in_service'
  | 'maintenance'
  | 'dry_dock'
  | 'inactive';

export interface OperationalDeparture {
  id: string;
  tourId: string;
  tourTitle: string;
  tourSlug: string;
  date: string; // YYYY-MM-DD
  departureTime: string; // e.g. "08:30"
  startTime?: string;
  endTime?: string;
  capacity?: number;
  remainingCapacity?: number;
  bookingsCount: number;
  passengerCount: number;
  adultCount: number;
  childCount: number;
  infantCount: number;
  pickupLocations: Array<{
    name: string;
    time: string;
    passengerCount: number;
    hotelName?: string;
  }>;
  vesselId: string | null;
  vesselName: string | null;
  vesselType: string | null;
  vesselCapacity: number | null;
  guideId: string | null;
  guideName: string | null;
  guideRole: string | null;
  captainId?: string | null;
  captainName?: string | null;
  driverId?: string | null;
  driverName?: string | null;
  vehicleName?: string | null;
  crewIds?: string[];
  operationalStatus: OperationalStatus;
  status?: DepartureStatus;
  paymentSummary: {
    paidCount: number;
    pendingCount: number;
    totalEur: number;
    outstandingEur: number;
  };
  weatherCleared: boolean;
  notes: string | null;
}

export interface DepartureEntity {
  id: string;
  tour_id: string;
  tour_title: string;
  tour_slug?: string;
  date: string;
  start_time: string;
  end_time: string;
  capacity: number;
  booked_passengers: number;
  remaining_capacity: number;
  status: DepartureStatus;
  guide_id: string | null;
  guide_name?: string | null;
  vessel_id: string | null;
  vessel_name?: string | null;
  captain_id: string | null;
  captain_name?: string | null;
  driver_id: string | null;
  driver_name: string | null;
  vehicle_name: string | null;
  crew_ids: string[];
  notes: string | null;
  weather_status?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface PickupScheduleItem {
  id: string;
  bookingId: string;
  bookingReference: string;
  customerName: string;
  customerPhone: string | null;
  hotelName: string;
  roomNumber: string | null;
  pickupArea: string;
  pickupTime: string;
  passengerCount: number;
  tourTitle: string;
  tourDate: string;
  departureTime: string;
  driverId?: string | null;
  driverName?: string | null;
  driverVehicle: string | null;
  status: PickupStatus;
  specialRequests: string | null;
  notes?: string | null;
}

export interface PassengerManifestItem {
  id: string;
  bookingId: string;
  bookingReference: string;
  tourId: string;
  tourTitle: string;
  tourDate: string;
  departureTime: string;
  fullName: string;
  nationality: string | null;
  passportOrId: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  passengerType: 'adult' | 'child' | 'infant';
  phone: string | null;
  hotel: string | null;
  pickupTime?: string | null;
  specialRequests: string | null;
  extras?: string | null;
  paymentStatus?: 'paid' | 'deposit_paid' | 'pending' | 'partially_paid' | 'pay_on_arrival';
  bookingStatus?: 'confirmed' | 'completed' | 'cancelled' | 'pending';
  partySize?: number;
  isLeadPassenger: boolean;
}

export interface AvailabilitySlot {
  id: string;
  tourId: string;
  tourTitle: string;
  date: string; // YYYY-MM-DD
  maxCapacity: number;
  bookedCount: number;
  remainingCapacity: number;
  status: 'available' | 'unavailable' | 'sold_out';
  departureTime: string;
  notes: string | null;
  isBlackout: boolean;
}

export interface OperationalAssignment {
  id: string;
  tourId: string;
  tourTitle?: string;
  date: string;
  departureTime: string;
  vesselId: string | null;
  vesselName?: string | null;
  guideId: string | null;
  guideName?: string | null;
  captainId?: string | null;
  captainName?: string | null;
  driverId?: string | null;
  driverName?: string | null;
  crewIds?: string[];
  status: OperationalStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AssignmentConflict {
  type:
    | 'vessel_double_booked'
    | 'vessel_inactive'
    | 'vessel_capacity_exceeded'
    | 'guide_double_booked'
    | 'captain_double_booked'
    | 'driver_double_booked'
    | 'crew_double_booked';
  message: string;
  entityId: string;
  entityName: string;
  conflictingDepartureId?: string;
  conflictingTourTitle?: string;
}

export interface WeatherInfo {
  connected: boolean;
  provider: string;
  isAvailable: boolean;
  harborLocation: string;
  waterTemperatureC: number | null;
  airTemperatureC: number | null;
  swellHeightM: number | null;
  windSpeedKnots: number | null;
  windDirection: string | null;
  visibilityMeters: number | null;
  coastGuardCleared: boolean;
  advisoryNotes: string;
  bulletinDate: string;
  message?: string;
}

export interface OperationalDocument {
  id: string;
  type: 'passenger_manifest' | 'coast_guard_packet' | 'pickup_run_sheet' | 'captain_briefing';
  title: string;
  date: string;
  tourTitle?: string;
  vesselName?: string;
  passengerCount?: number;
}
