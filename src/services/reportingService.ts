import { supabase, isSupabaseConfigured } from './supabaseClient';
import {
  ReportDateRangeType,
  DateRangeInterval,
  ExecutiveMetrics,
  SalesMetrics,
  CustomerMetrics,
  OperationsMetrics,
  FinanceMetrics,
  BreakdownItem,
  TopCustomerItem,
  VesselUtilizationItem,
  PaymentMethodBreakdown,
  StaffPerformanceItem,
  LeadSourcePerformance,
  InactiveCustomerItem,
  PopularTourInterestItem,
  MonthlyRevenueItem,
  ReportBuilderFilters,
  ReportBuilderRow,
} from '../types/reporting';
import { bookingRepository } from './bookingRepository';
import { Booking } from '../types/booking';
import { listUnifiedCustomers } from './customerService';
import { listPayments, listRefunds } from './financeService';
import { listVessels, listAssignments, listGuides, getMaritimeWeather, getDeparturesForDateRange } from './operationsService';
import { listInquiries } from './inquiryService';
import { listLeads } from './crmService';
import { getPublishedTours } from './tourService';

/**
 * Calculates normalized date interval boundaries based on range enum
 */
export function getDateRangeInterval(
  range: ReportDateRangeType,
  customStart?: string,
  customEnd?: string
): DateRangeInterval {
  const now = new Date();
  const formatYMD = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayStr = formatYMD(now);

  switch (range) {
    case 'today':
      return {
        range,
        startDate: todayStr,
        endDate: todayStr,
        label: `Today (${todayStr})`,
      };

    case 'yesterday': {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const yStr = formatYMD(y);
      return {
        range,
        startDate: yStr,
        endDate: yStr,
        label: `Yesterday (${yStr})`,
      };
    }

    case 'this_week': {
      const curr = new Date(now);
      const day = curr.getDay();
      // Monday as first day of week
      const diff = curr.getDate() - day + (day === 0 ? -6 : 1);
      const startOfWeek = new Date(curr.setDate(diff));
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      return {
        range,
        startDate: formatYMD(startOfWeek),
        endDate: formatYMD(endOfWeek),
        label: `This Week (${formatYMD(startOfWeek)} to ${formatYMD(endOfWeek)})`,
      };
    }

    case 'this_month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return {
        range,
        startDate: formatYMD(start),
        endDate: formatYMD(end),
        label: `This Month (${start.toLocaleString('default', { month: 'long', year: 'numeric' })})`,
      };
    }

    case 'last_month': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return {
        range,
        startDate: formatYMD(start),
        endDate: formatYMD(end),
        label: `Last Month (${start.toLocaleString('default', { month: 'long', year: 'numeric' })})`,
      };
    }

    case 'this_year': {
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear(), 11, 31);
      return {
        range,
        startDate: formatYMD(start),
        endDate: formatYMD(end),
        label: `This Year (${now.getFullYear()})`,
      };
    }

    case 'custom': {
      const s = customStart || todayStr;
      const e = customEnd || todayStr;
      return {
        range,
        startDate: s <= e ? s : e,
        endDate: s <= e ? e : s,
        label: `Custom (${s} to ${e})`,
      };
    }

    default:
      return {
        range: 'this_month',
        startDate: formatYMD(new Date(now.getFullYear(), now.getMonth(), 1)),
        endDate: todayStr,
        label: 'Current Period',
      };
  }
}

/**
 * Filter bookings by date range interval.
 * Checks both excursion departure date (`b.date`) and booking creation date.
 */
function filterBookingsByInterval(bookings: Booking[], interval: DateRangeInterval): Booking[] {
  return bookings.filter((b) => {
    const departureDate = (b.date || '').split('T')[0];
    const createdDate = (b.createdAt || '').split('T')[0];
    const departureMatches = departureDate >= interval.startDate && departureDate <= interval.endDate;
    const createdMatches = createdDate >= interval.startDate && createdDate <= interval.endDate;
    return departureMatches || createdMatches;
  });
}

function normalizeLeadSource(source?: string | null): string {
  const value = String(source || '').trim().toLowerCase();
  if (['web', 'website', 'online', 'online checkout'].includes(value)) return 'Website';
  if (value.includes('whatsapp')) return 'WhatsApp';
  if (['phone', 'call', 'telephone'].includes(value)) return 'Phone';
  if (value === 'email') return 'Email';
  if (value === 'hotel') return 'Hotel';
  if (value === 'referral') return 'Referral';
  if (value === 'walk-in' || value === 'walkin') return 'Walk-in';
  if (value.includes('social')) return 'Social Media';
  return 'Other';
}

function departureDurationHours(startTime?: string, endTime?: string): number {
  if (!startTime || !endTime) return 0;
  const parse = (value: string) => {
    const match = value.match(/^(\\d{1,2}):(\\d{2})/);
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours > 23 || minutes > 59) return null;
    return hours * 60 + minutes;
  };
  const start = parse(startTime);
  const end = parse(endTime);
  if (start === null || end === null) return 0;
  let duration = end - start;
  if (duration < 0) duration += 24 * 60;
  return Math.round((duration / 60) * 10) / 10;
}

// ------------------------------------------------------------------------------
// 1. EXECUTIVE REPORT
// ------------------------------------------------------------------------------

export async function fetchExecutiveReport(interval: DateRangeInterval): Promise<ExecutiveMetrics> {
  // If Supabase RPC is provisioned and available, attempt fast server-side query
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase.rpc('get_executive_bi_metrics', {
        p_start_date: interval.startDate,
        p_end_date: interval.endDate,
      });
      if (!error && data && typeof data === 'object') {
        const d = data as any;
        const revenue = d.revenue && typeof d.revenue === 'object' ? d.revenue : {};
        const bookings = d.bookings && typeof d.bookings === 'object' ? d.bookings : {};
        const passengers = d.passengers && typeof d.passengers === 'object' ? d.passengers : {};
        const customers = d.customers && typeof d.customers === 'object' ? d.customers : {};
        const leads = d.leads && typeof d.leads === 'object' ? d.leads : {};

        const totalRevenueEur = Number(revenue.total ?? d.totalRevenueEur ?? d.revenueEur ?? 0);
        const collectedRevenueEur = Number(revenue.collected ?? d.collectedRevenueEur ?? 0);
        const outstandingRevenueEur = Number(revenue.outstanding ?? d.outstandingRevenueEur ?? 0);

        return {
          totalRevenueEur,
          revenueEur: totalRevenueEur,
          collectedRevenueEur,
          outstandingRevenueEur,
          outstandingBalancesEur: outstandingRevenueEur,
          bookingsCount: Number(bookings.total ?? d.bookingsCount ?? 0),
          confirmedBookingsCount: Number(bookings.confirmed ?? d.confirmedBookingsCount ?? 0),
          completedBookingsCount: Number(bookings.completed ?? d.completedBookingsCount ?? 0),
          cancellationsCount: Number(bookings.cancelled ?? d.cancellationsCount ?? 0),
          passengersCount: Number(passengers.total ?? d.passengersCount ?? 0),
          adultsCount: Number(passengers.adults ?? d.adultsCount ?? 0),
          childrenCount: Number(passengers.children ?? d.childrenCount ?? 0),
          infantsCount: Number(passengers.infants ?? d.infantsCount ?? 0),
          totalCustomersCount: Number(customers.totalActive ?? d.totalCustomersCount ?? 0),
          newCustomersCount: Number(customers.new ?? d.newCustomersCount ?? 0),
          repeatCustomersCount: Number(customers.repeat ?? d.repeatCustomersCount ?? 0),
          leadsCount: Number(leads.total ?? d.leadsCount ?? 0),
          conversionRate: Number(bookings.conversionRatePercent ?? d.conversionRate ?? 0),
          cancellationRate: Number(bookings.cancellationRatePercent ?? d.cancellationRate ?? 0),
          averageBookingValueEur: Number(revenue.averageBookingValue ?? d.averageBookingValueEur ?? 0),
        };
      }
    } catch {
      // Fallback to indexed query aggregation below
    }
  }

  // Pure Database and Repository Calculation
  const [allBookings, allCustomers, inquiries, leads, payments, refunds] = await Promise.all([
    bookingRepository.listBookings(),
    listUnifiedCustomers(),
    listInquiries(),
    listLeads(),
    listPayments(),
    listRefunds(),
  ]);

  const activeBookings = filterBookingsByInterval(allBookings, interval);

  // Groupings by status
  const confirmedBookings = activeBookings.filter(
    (b) => b.status === 'confirmed' || b.status === 'completed' || b.status === 'pending'
  );
  const nonCancelledBookings = activeBookings.filter(
    (b) => b.status !== 'cancelled' && b.status !== 'cancellation_requested'
  );
  const cancelledBookings = activeBookings.filter(
    (b) => b.status === 'cancelled' || b.status === 'cancellation_requested'
  );

  const totalRevenueEur = nonCancelledBookings.reduce((sum, b) => sum + (b.pricing?.totalEur || 0), 0);
  const bookingsCount = activeBookings.length;
  const confirmedBookingsCount = nonCancelledBookings.length;
  const completedBookingsCount = activeBookings.filter((booking) => booking.status === 'completed').length;
  const cancellationsCount = cancelledBookings.length;

  let adultsCount = 0;
  let childrenCount = 0;
  let infantsCount = 0;

  nonCancelledBookings.forEach((b) => {
    adultsCount += b.guests?.adults || 1;
    childrenCount += b.guests?.children || 0;
    infantsCount += b.guests?.infants || 0;
  });

  const passengersCount = adultsCount + childrenCount + infantsCount;

  // Net collected revenue is settled payments less completed refunds for this booking cohort.
  const activeBookingsRefs = new Set(nonCancelledBookings.map((b) => b.bookingReference));
  const activeBookingIds = new Set(nonCancelledBookings.map((b) => b.bookingId).filter(Boolean));
  const isForActiveBooking = (record: { bookingReference?: string; bookingId?: string }) =>
    activeBookingsRefs.has(record.bookingReference || '') || activeBookingIds.has(record.bookingId || '');
  const isSettledPayment = (payment: { paymentStatus: unknown }) =>
    ['paid', 'partially paid'].includes(String(payment.paymentStatus).toLowerCase().replace(/_/g, ' '));
  const collectedPayments = payments.filter((payment) =>
    isSettledPayment(payment) && isForActiveBooking(payment)
  );
  const processedRefunds = refunds.filter((refund) =>
    refund.status === 'processed' && isForActiveBooking(refund)
  );
  const grossCollectedRevenueEur = collectedPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const refundedRevenueEur = processedRefunds.reduce(
    (sum, refund) => sum + (refund.approvedAmount || refund.amount || 0),
    0
  );
  const collectedRevenueEur = Math.max(0, grossCollectedRevenueEur - refundedRevenueEur);

  // Outstanding revenue reflects the amount still retained by the business, not gross payments.
  const outstandingRevenueEur = Math.max(0, totalRevenueEur - collectedRevenueEur);

  // Unique customers & Repeat calculation
  const customerEmailCounts = new Map<string, number>();
  allBookings.forEach((b) => {
    const email = b.customer?.email?.toLowerCase();
    if (email) {
      customerEmailCounts.set(email, (customerEmailCounts.get(email) || 0) + 1);
    }
  });

  const intervalCustomers = new Set<string>();
  let repeatCustomersCount = 0;
  let newCustomersCount = 0;

  activeBookings.forEach((b) => {
    const email = b.customer?.email?.toLowerCase();
    if (email && !intervalCustomers.has(email)) {
      intervalCustomers.add(email);
      const totalLifetime = customerEmailCounts.get(email) || 1;
      if (totalLifetime > 1) {
        repeatCustomersCount++;
      } else {
        newCustomersCount++;
      }
    }
  });

  const totalCustomersCount = allCustomers.length || customerEmailCounts.size;

  // Filter leads and inquiries in date range
  const intervalLeads = leads.filter((l) => {
    const lDate = (l.createdAt || '').split('T')[0];
    return lDate >= interval.startDate && lDate <= interval.endDate;
  });
  const intervalInquiries = inquiries.filter((inq) => {
    const inqDate = (inq.created_at || '').split('T')[0];
    return inqDate >= interval.startDate && inqDate <= interval.endDate;
  });
  const leadsCount = intervalLeads.length + intervalInquiries.length;

  // Conversion rate: Confirmed bookings divided by (leads + confirmed bookings)
  const totalDemand = leadsCount + confirmedBookingsCount;
  const conversionRate = totalDemand > 0
    ? Math.round((confirmedBookingsCount / totalDemand) * 1000) / 10
    : 0;

  // Cancellation rate
  const cancellationRate = bookingsCount > 0
    ? Math.round((cancellationsCount / bookingsCount) * 1000) / 10
    : 0;

  // Average booking value
  const averageBookingValueEur = confirmedBookingsCount > 0
    ? Math.round((totalRevenueEur / confirmedBookingsCount) * 100) / 100
    : 0;

  return {
    totalRevenueEur,
    revenueEur: totalRevenueEur,
    collectedRevenueEur,
    outstandingRevenueEur,
    outstandingBalancesEur: outstandingRevenueEur,
    bookingsCount,
    confirmedBookingsCount,
    completedBookingsCount,
    cancellationsCount,
    passengersCount,
    adultsCount,
    childrenCount,
    infantsCount,
    totalCustomersCount,
    newCustomersCount,
    repeatCustomersCount,
    leadsCount,
    conversionRate,
    cancellationRate,
    averageBookingValueEur,
  };
}

// ------------------------------------------------------------------------------
// 2. SALES REPORT
// ------------------------------------------------------------------------------

export async function fetchSalesReport(interval: DateRangeInterval): Promise<SalesMetrics> {
  const [allBookings, inquiries, leads] = await Promise.all([
    bookingRepository.listBookings(),
    listInquiries(),
    listLeads(),
  ]);

  const activeBookings = filterBookingsByInterval(allBookings, interval);
  const revenueBookings = activeBookings.filter(
    (booking) => booking.status !== 'cancelled' && booking.status !== 'cancellation_requested'
  );
  const totalRevenueEur = revenueBookings.reduce((sum, booking) => sum + (booking.pricing?.totalEur || 0), 0);
  const totalBookingsCount = revenueBookings.length;
  const averageBookingValueEur = totalBookingsCount > 0
    ? Math.round((totalRevenueEur / totalBookingsCount) * 100) / 100
    : 0;

  const intervalLeads = leads.filter((lead) => {
    const date = (lead.createdAt || '').split('T')[0];
    return date >= interval.startDate && date <= interval.endDate;
  });
  const intervalInquiries = inquiries.filter((inquiry) => {
    const date = (inquiry.created_at || '').split('T')[0];
    return date >= interval.startDate && date <= interval.endDate && inquiry.status !== 'converted';
  });
  const leadsCount = intervalLeads.length + intervalInquiries.length;

  const sourceMap = new Map<string, { count: number; converted: number; revenue: number }>();
  const addSource = (source: string | null | undefined, converted: boolean, revenue = 0) => {
    const label = normalizeLeadSource(source);
    const current = sourceMap.get(label) || { count: 0, converted: 0, revenue: 0 };
    current.count += 1;
    if (converted) {
      current.converted += 1;
      current.revenue += revenue;
    }
    sourceMap.set(label, current);
  };

  intervalLeads.forEach((lead) => {
    const won = lead.stage === 'Won' || lead.stage === 'Booked';
    addSource(lead.source, won, won ? Number(lead.estimatedValue) || 0 : 0);
  });
  intervalInquiries.forEach((inquiry) => addSource(inquiry.source, false));

  const leadSources: LeadSourcePerformance[] = Array.from(sourceMap.entries())
    .map(([source, value]) => ({
      source,
      count: value.count,
      convertedCount: value.converted,
      conversionRate: value.count > 0 ? Math.round((value.converted / value.count) * 1000) / 10 : 0,
      revenueEur: value.revenue,
    }))
    .sort((a, b) => b.revenueEur - a.revenueEur);

  const convertedLeadCount = intervalLeads.filter((lead) => lead.stage === 'Won' || lead.stage === 'Booked').length;
  const conversionRate = leadsCount > 0
    ? Math.round((convertedLeadCount / leadsCount) * 1000) / 10
    : 0;

  const tourMap = new Map<string, { count: number; revenue: number }>();
  revenueBookings.forEach((booking) => {
    const title = booking.tourTitle || 'Tour not recorded';
    const current = tourMap.get(title) || { count: 0, revenue: 0 };
    current.count += 1;
    current.revenue += booking.pricing?.totalEur || 0;
    tourMap.set(title, current);
  });
  const bestSellingTours: BreakdownItem[] = Array.from(tourMap.entries())
    .map(([name, value]) => ({
      id: name,
      name,
      count: value.count,
      revenueEur: value.revenue,
      percentage: totalBookingsCount > 0 ? Math.round((value.count / totalBookingsCount) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.revenueEur - a.revenueEur);

  const destinationMap = new Map<string, { count: number; revenue: number }>();
  revenueBookings.forEach((booking) => {
    const destination = booking.tourDestination || 'Not recorded';
    const current = destinationMap.get(destination) || { count: 0, revenue: 0 };
    current.count += 1;
    current.revenue += booking.pricing?.totalEur || 0;
    destinationMap.set(destination, current);
  });
  const bestDestinations: BreakdownItem[] = Array.from(destinationMap.entries())
    .map(([name, value]) => ({
      id: name,
      name,
      count: value.count,
      revenueEur: value.revenue,
      percentage: totalRevenueEur > 0 ? Math.round((value.revenue / totalRevenueEur) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.revenueEur - a.revenueEur);

  const staffMap = new Map<string, {
    id: string;
    name: string;
    role: string;
    leads: number;
    won: number;
    booked: number;
    revenue: number;
  }>();
  intervalLeads.forEach((lead) => {
    const staffId = lead.assignedStaffId || 'unassigned';
    const staffName = lead.assignedStaffName || 'Unassigned';
    const current = staffMap.get(staffId) || {
      id: staffId,
      name: staffName,
      role: lead.assignedStaffId ? 'CRM staff' : 'Unassigned',
      leads: 0,
      won: 0,
      booked: 0,
      revenue: 0,
    };
    current.leads += 1;
    if (lead.stage === 'Won' || lead.stage === 'Booked') {
      current.won += 1;
      current.revenue += Number(lead.estimatedValue) || 0;
    }
    if (lead.stage === 'Booked') current.booked += 1;
    staffMap.set(staffId, current);
  });

  const staffPerformance: StaffPerformanceItem[] = Array.from(staffMap.values())
    .map((staff) => ({
      staffId: staff.id,
      staffName: staff.name,
      role: staff.role,
      leadsHandled: staff.leads,
      dealsWon: staff.won,
      bookingsCount: staff.booked,
      revenueEur: staff.revenue,
      conversionRate: staff.leads > 0 ? Math.round((staff.won / staff.leads) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.revenueEur - a.revenueEur);

  const bookingSourceMap = new Map<string, { count: number; revenue: number }>();
  revenueBookings.forEach((booking) => {
    const source = normalizeLeadSource((booking as any).source);
    const current = bookingSourceMap.get(source) || { count: 0, revenue: 0 };
    current.count += 1;
    current.revenue += booking.pricing?.totalEur || 0;
    bookingSourceMap.set(source, current);
  });
  const bookingsBySource = Array.from(bookingSourceMap.entries())
    .map(([source, value]) => ({
      source,
      count: value.count,
      revenueEur: value.revenue,
      percentage: totalBookingsCount > 0 ? Math.round((value.count / totalBookingsCount) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.revenueEur - a.revenueEur);

  return {
    leadsCount,
    leadSources,
    conversionRate,
    totalBookingsCount,
    totalRevenueEur,
    averageBookingValueEur,
    bestSellingTours,
    bestDestinations,
    bookingsByTour: bestSellingTours,
    bookingsByDestination: bestDestinations,
    revenueByTour: bestSellingTours,
    revenueByDestination: bestDestinations,
    bookingsBySource,
    staffPerformance,
  };
}

// ------------------------------------------------------------------------------
// 3. CUSTOMER REPORT
// ------------------------------------------------------------------------------

export async function fetchCustomerReport(interval: DateRangeInterval): Promise<CustomerMetrics> {
  const [allBookings, allCustomers, inquiries, dynamicTours] = await Promise.all([
    bookingRepository.listBookings(),
    listUnifiedCustomers(),
    listInquiries(),
    getPublishedTours(),
  ]);

  const customers = allCustomers.filter((customer) => customer.role === 'customer');
  const customerList: TopCustomerItem[] = customers.map((customer) => {
    const totalBookings = Number(customer.totalBookings) || 0;
    const totalSpentEur = Number(customer.totalSpentEur) || 0;
    const status: TopCustomerItem['status'] =
      totalSpentEur >= 500 || totalBookings >= 3 ? 'VIP' :
      totalBookings > 0 ? 'Regular' : 'New';

    return {
      id: customer.id,
      name: customer.fullName || 'Not provided',
      email: customer.email || '',
      phone: customer.phone || '',
      country: customer.country || 'Not recorded',
      hotel: customer.hotel || null,
      totalBookings,
      totalSpentEur,
      lastBookingDate: customer.lastBookingDate || null,
      status,
    };
  });

  const newCustomersCount = customers.filter((customer) => {
    const date = (customer.createdAt || '').split('T')[0];
    return date >= interval.startDate && date <= interval.endDate;
  }).length;
  const repeatCustomersCount = customers.filter((customer) => (Number(customer.totalBookings) || 0) > 1).length;
  const totalCustomersCount = customers.length;
  const totalSpentEur = customers.reduce((sum, customer) => sum + (Number(customer.totalSpentEur) || 0), 0);
  const customerLifetimeValueEur = totalCustomersCount > 0
    ? Math.round((totalSpentEur / totalCustomersCount) * 100) / 100
    : 0;
  const repeatRatePct = totalCustomersCount > 0
    ? Math.round((repeatCustomersCount / totalCustomersCount) * 1000) / 10
    : 0;

  const activeBookings = filterBookingsByInterval(allBookings, interval).filter(
    (booking) => booking.status !== 'cancelled' && booking.status !== 'cancellation_requested'
  );
  const intervalInquiries = inquiries.filter((inquiry) => {
    const date = (inquiry.created_at || '').split('T')[0];
    return date >= interval.startDate && date <= interval.endDate;
  });

  const tourMap = new Map(dynamicTours.map((tour) => [tour.id, tour.title]));
  const interestMap = new Map<string, { bookings: number; inquiries: number; revenue: number }>();
  activeBookings.forEach((booking) => {
    const name = booking.tourTitle || tourMap.get(booking.tourId) || 'Tour not recorded';
    const current = interestMap.get(name) || { bookings: 0, inquiries: 0, revenue: 0 };
    current.bookings += 1;
    current.revenue += booking.pricing?.totalEur || 0;
    interestMap.set(name, current);
  });
  intervalInquiries.forEach((inquiry) => {
    const name = (inquiry.tour_id && tourMap.get(inquiry.tour_id)) || inquiry.subject || 'Tour not specified';
    const current = interestMap.get(name) || { bookings: 0, inquiries: 0, revenue: 0 };
    current.inquiries += 1;
    interestMap.set(name, current);
  });

  const totalInterests = Array.from(interestMap.values()).reduce(
    (sum, item) => sum + item.bookings + item.inquiries,
    0
  );
  const popularTourInterests: TourInterestItem[] = Array.from(interestMap.entries())
    .map(([tourTitle, value]) => ({
      tourTitle,
      bookings: value.bookings,
      inquiries: value.inquiries,
      sharePct: totalInterests > 0
        ? Math.round(((value.bookings + value.inquiries) / totalInterests) * 1000) / 10
        : 0,
      revenueEur: value.revenue,
    }))
    .sort((a, b) => (b.bookings + b.inquiries) - (a.bookings + a.inquiries));

  const countryMap = new Map<string, number>();
  const hotelMap = new Map<string, number>();
  customerList.forEach((customer) => {
    const country = customer.country || 'Not recorded';
    const hotel = customer.hotel || 'Not recorded';
    countryMap.set(country, (countryMap.get(country) || 0) + 1);
    hotelMap.set(hotel, (hotelMap.get(hotel) || 0) + 1);
  });
  const countriesDistribution = Array.from(countryMap.entries())
    .map(([country, count]) => ({ country, count }))
    .sort((a, b) => b.count - a.count);
  const hotelsDistribution = Array.from(hotelMap.entries())
    .map(([hotel, count]) => ({ hotel, count }))
    .sort((a, b) => b.count - a.count);

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 90);
  const inactiveCustomers = customerList.filter((customer) => {
    if (!customer.lastBookingDate || customer.totalBookings === 0) return false;
    return new Date(customer.lastBookingDate) < cutoffDate;
  });

  return {
    totalCustomersCount,
    newCustomersCount,
    repeatCustomersCount,
    customerLifetimeValueEur,
    repeatRatePct,
    customerRetentionRatePct: repeatRatePct,
    popularTourInterests,
    countriesDistribution,
    hotelsDistribution,
    topCustomers: customerList.sort((a, b) => b.totalSpentEur - a.totalSpentEur).slice(0, 10),
    inactiveCustomers,
  };
}

// ------------------------------------------------------------------------------
// 4. OPERATIONS REPORT
// ------------------------------------------------------------------------------

export async function fetchOperationsReport(interval: DateRangeInterval): Promise<OperationsMetrics> {
  const [allBookings, vessels, assignments, guides, departures, weather] = await Promise.all([
    bookingRepository.listBookings(),
    listVessels(),
    listAssignments(),
    listGuides(),
    getDeparturesForDateRange(interval.startDate, interval.endDate),
    getMaritimeWeather(interval.startDate),
  ]);

  const rangeBookings = filterBookingsByInterval(allBookings, interval);
  const cancellations = rangeBookings.filter(
    (booking) => booking.status === 'cancelled' || booking.status === 'cancellation_requested'
  );
  const noShows = rangeBookings.filter((booking) => booking.status === 'no_show');
  const passengerBookings = rangeBookings.filter(
    (booking) => !['cancelled', 'cancellation_requested', 'no_show'].includes(booking.status)
  );

  const adults = passengerBookings.reduce((sum, booking) => sum + (Number(booking.guests?.adults) || 0), 0);
  const children = passengerBookings.reduce((sum, booking) => sum + (Number(booking.guests?.children) || 0), 0);
  const infants = passengerBookings.reduce((sum, booking) => sum + (Number(booking.guests?.infants) || 0), 0);
  const totalPassengers = adults + children + infants;

  const activeDepartures = departures.filter((departure) => departure.status !== 'cancelled');
  const assignedDepartures = activeDepartures.filter((departure) =>
    Boolean(departure.vesselId || departure.guideId || departure.captainId || departure.driverId)
  );
  const unassignedDepartures = activeDepartures.filter((departure) =>
    !departure.vesselId && !departure.guideId && !departure.captainId && !departure.driverId
  );

  const departurePassengerCount = activeDepartures.reduce(
    (sum, departure) => sum + (Number(departure.passengerCount) || 0),
    0
  );
  const departureCapacity = activeDepartures.reduce(
    (sum, departure) => sum + (Number(departure.capacity) || 0),
    0
  );
  const capacityUtilizationPct = departureCapacity > 0
    ? Math.round((departurePassengerCount / departureCapacity) * 1000) / 10
    : 0;

  const totalGuestsForPickup = passengerBookings.reduce(
    (sum, booking) =>
      sum +
      (Number(booking.guests?.adults) || 0) +
      (Number(booking.guests?.children) || 0) +
      (Number(booking.guests?.infants) || 0),
    0
  );
  const pickupMap = new Map<string, { area: string; guests: number }>();
  passengerBookings.forEach((booking) => {
    const locationName = booking.pickup?.locationName || booking.pickup?.hotelName ||
      booking.customer?.hotelName || 'Not recorded';
    const area = booking.pickup?.area || 'Not recorded';
    const guests =
      (Number(booking.guests?.adults) || 0) +
      (Number(booking.guests?.children) || 0) +
      (Number(booking.guests?.infants) || 0);
    const current = pickupMap.get(locationName) || { area, guests: 0 };
    current.guests += guests;
    if (current.area === 'Not recorded' && area !== 'Not recorded') current.area = area;
    pickupMap.set(locationName, current);
  });
  const pickupDistribution = Array.from(pickupMap.entries())
    .map(([locationName, value]) => ({
      locationName,
      area: value.area,
      guestsCount: value.guests,
      percentage: totalGuestsForPickup > 0
        ? Math.round((value.guests / totalGuestsForPickup) * 1000) / 10
        : 0,
    }))
    .sort((a, b) => b.guestsCount - a.guestsCount);

  const vesselUtilization: VesselUtilizationItem[] = vessels.map((vessel) => {
    const vesselDepartures = activeDepartures.filter((departure) => departure.vesselId === vessel.id);
    const passengersCarried = vesselDepartures.reduce(
      (sum, departure) => sum + (Number(departure.passengerCount) || 0),
      0
    );
    const capacityForTrips = vesselDepartures.reduce(
      (sum, departure) => sum + (Number(departure.capacity) || 0),
      0
    );
    return {
      vesselId: vessel.id,
      vesselName: vessel.name,
      vesselType: vessel.vessel_type || 'Not recorded',
      maxCapacity: Number(vessel.passenger_capacity) || 0,
      tripsCount: vesselDepartures.length,
      passengersCarried,
      utilizationPct: capacityForTrips > 0
        ? Math.round((passengersCarried / capacityForTrips) * 1000) / 10
        : 0,
    };
  }).filter((vessel) => vessel.tripsCount > 0);

  const activeGuides = guides.filter((guide) => guide.is_active);
  const guideWorkload: GuideAssignmentItem[] = activeGuides.map((guide) => {
    const guideDepartures = activeDepartures.filter((departure) => departure.guideId === guide.id);
    const hoursLogged = guideDepartures.reduce(
      (sum, departure) => sum + departureDurationHours(departure.startTime || departure.departureTime, departure.endTime),
      0
    );
    return {
      guideId: guide.id,
      guideName: guide.full_name,
      assignedCount: guideDepartures.length,
      hoursLogged,
    };
  }).sort((a, b) => b.assignedCount - a.assignedCount);

  const timestamp = new Date().toISOString();
  const operationalIssues: OperationalIssueItem[] = [];
  if (activeDepartures.length === 0) {
    operationalIssues.push({
      id: 'no-departures-in-period',
      severity: 'info',
      category: 'schedule',
      title: 'No departure records in the selected period',
      description: 'No departure rows were found for this date range. Capacity and assignment metrics are therefore unavailable for this period.',
      timestamp,
    });
  }
  if (unassignedDepartures.length > 0) {
    operationalIssues.push({
      id: 'unassigned-departures',
      severity: 'warning',
      category: 'staffing',
      title: 'Unassigned departures',
      description: `${unassignedDepartures.length} departure record(s) have no vessel, guide, captain or driver assignment.`,
      timestamp,
    });
  }

  const maintenanceVessels = vessels.filter((vessel) =>
    ['maintenance', 'dry_dock'].includes(String(vessel.status || '').toLowerCase())
  );
  if (maintenanceVessels.length > 0) {
    operationalIssues.push({
      id: 'vessel-maintenance',
      severity: 'warning',
      category: 'fleet',
      title: 'Vessels under maintenance',
      description: maintenanceVessels.map((vessel) => vessel.name).join(', '),
      timestamp,
    });
  }

  const hasLiveWeather = Boolean(
    weather &&
    (weather.windSpeedKnots !== null && weather.windSpeedKnots !== undefined ||
      weather.swellHeightM !== null && weather.swellHeightM !== undefined)
  );
  if (!hasLiveWeather) {
    operationalIssues.push({
      id: 'weather-unavailable',
      severity: 'warning',
      category: 'weather',
      title: 'Live maritime weather readings unavailable',
      description: 'No current wind or swell observation is available. Verify local marine conditions and official Coast Guard notices before any departure; this dashboard cannot confirm clearance.',
      timestamp,
    });
  } else {
    const wind = Number(weather.windSpeedKnots) || 0;
    const swell = Number(weather.swellHeightM) || 0;
    if (wind > 20 || swell > 1.8) {
      operationalIssues.push({
        id: 'weather-threshold',
        severity: 'critical',
        category: 'weather',
        title: 'Weather readings exceed configured thresholds',
        description: `Recorded wind: ${wind} knots; recorded swell: ${swell} m. Confirm the latest official marine advisories and operator clearance before departure.`,
        timestamp,
      });
    } else {
      operationalIssues.push({
        id: 'weather-within-threshold',
        severity: 'info',
        category: 'weather',
        title: 'Recorded weather readings within configured thresholds',
        description: 'These readings are not a Coast Guard clearance or a substitute for checking current official marine advisories.',
        timestamp,
      });
    }
  }

  const cancellationRatePct = rangeBookings.length > 0
    ? Math.round((cancellations.length / rangeBookings.length) * 1000) / 10
    : 0;

  return {
    departuresCount: activeDepartures.length,
    passengerCounts: { adults, children, infants, total: totalPassengers },
    capacityUtilizationPct,
    cancellationsCount: cancellations.length,
    cancellationRatePct,
    noShowsCount: noShows.length,
    pickupDistribution,
    vesselUtilization,
    guideAssignments: {
      totalAssignments: assignments.filter((assignment) => {
        const date = String((assignment as any).date || '');
        return date >= interval.startDate && date <= interval.endDate;
      }).length,
      assignedTours: assignedDepartures.length,
      unassignedTours: unassignedDepartures.length,
      activeGuidesCount: activeGuides.length,
      guides: guideWorkload,
    },
    operationalIssues,
  };
}

// ------------------------------------------------------------------------------
// 5. FINANCE REPORT
// ------------------------------------------------------------------------------

export async function fetchFinanceReport(interval: DateRangeInterval): Promise<FinanceMetrics> {
  const [allBookings, payments, refunds] = await Promise.all([
    bookingRepository.listBookings(),
    listPayments(),
    listRefunds(),
  ]);

  const activeBookings = filterBookingsByInterval(allBookings, interval);

  // Gross contracted revenue excludes cancelled bookings.
  const nonCancelled = activeBookings.filter(
    (b) => b.status !== 'cancelled' && b.status !== 'cancellation_requested'
  );
  const activeBookingsRefs = new Set(nonCancelled.map((b) => b.bookingReference));
  const activeBookingIds = new Set(nonCancelled.map((b) => b.bookingId).filter(Boolean));
  const allNonCancelledBookingRefs = new Set(
    allBookings
      .filter((booking) => booking.status !== 'cancelled' && booking.status !== 'cancellation_requested')
      .map((booking) => booking.bookingReference)
  );
  const matchesActiveBooking = (record: { bookingReference?: string; bookingId?: string }) =>
    activeBookingsRefs.has(record.bookingReference || '') || activeBookingIds.has(record.bookingId || '');
  const isSettledPayment = (payment: { paymentStatus: unknown }) =>
    ['paid', 'partially paid'].includes(String(payment.paymentStatus).toLowerCase().replace(/_/g, ' '));
  const grossRevenueEur = nonCancelled.reduce((sum, b) => sum + (b.pricing?.totalEur || 0), 0);

  // Discounts
  const discountsEur = nonCancelled.reduce((sum, b) => sum + (b.pricing?.discountEur || 0), 0);

  // Filter payments within interval
  const intervalPayments = payments.filter((payment) => {
    if (!isSettledPayment(payment) || !allNonCancelledBookingRefs.has(payment.bookingReference)) return false;
    const paymentDate = (payment.paymentDate || payment.createdAt || '').split('T')[0];
    return (paymentDate >= interval.startDate && paymentDate <= interval.endDate) || matchesActiveBooking(payment);
  });

  const collectedPaymentsEur = intervalPayments.reduce((sum, p) => sum + p.amount, 0);

  // Filter refunds
  const intervalRefunds = refunds.filter((refund) => {
    if (refund.status !== 'processed') return false;
    const refundDate = (refund.processedDate || refund.createdAt || '').split('T')[0];
    return refundDate >= interval.startDate && refundDate <= interval.endDate;
  });

  const refundsEur = intervalRefunds.reduce((sum, r) => sum + (r.approvedAmount || r.amount || 0), 0);

  // Outstanding balances are based on net collections for this booking cohort.
  const cohortPayments = payments.filter((payment) =>
    isSettledPayment(payment) && matchesActiveBooking(payment)
  );
  const cohortRefunds = refunds.filter((refund) =>
    refund.status === 'processed' && matchesActiveBooking(refund)
  );
  const cohortGrossCollected = cohortPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const cohortRefunded = cohortRefunds.reduce(
    (sum, refund) => sum + (refund.approvedAmount || refund.amount || 0),
    0
  );
  const cohortNetCollected = Math.max(0, cohortGrossCollected - cohortRefunded);
  const outstandingEur = Math.max(0, grossRevenueEur - cohortNetCollected);

  // Net booked revenue deducts completed refunds, not merely approved requests.
  const netRevenueEur = Math.max(0, grossRevenueEur - cohortRefunded);

  // Collection Rate
  const netDue = Math.max(1, grossRevenueEur - discountsEur);
  const collectionRatePct = Math.min(100, Math.round((collectedPaymentsEur / netDue) * 1000) / 10);

  // Payment Methods Breakdown
  const methodMap = new Map<string, { amount: number; count: number }>();
  intervalPayments.forEach((p) => {
    const m = p.paymentMethod || 'Online Card / Gateway';
    const cur = methodMap.get(m) || { amount: 0, count: 0 };
    cur.amount += p.amount;
    cur.count += 1;
    methodMap.set(m, cur);
  });

  const paymentMethods: PaymentMethodBreakdown[] = [];
  methodMap.forEach((val, m) => {
    paymentMethods.push({
      method: m,
      amountEur: val.amount,
      count: val.count,
      percentage: collectedPaymentsEur > 0 ? Math.round((val.amount / collectedPaymentsEur) * 1000) / 10 : 0,
    });
  });
  paymentMethods.sort((a, b) => b.amountEur - a.amountEur);

  // Monthly Revenue (12-month rolling breakdown)
  const monthMap = new Map<string, { gross: number; paid: number; refunds: number; bookings: number }>();
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const curYear = new Date().getFullYear();

  // Initialize 12 months
  for (let m = 0; m < 12; m++) {
    const key = `${monthNames[m]} ${curYear}`;
    monthMap.set(key, { gross: 0, paid: 0, refunds: 0, bookings: 0 });
  }

  // Aggregate bookings by month
  allBookings.forEach((b) => {
    const dStr = b.date || b.createdAt;
    if (!dStr) return;
    const d = new Date(dStr);
    if (d.getFullYear() === curYear && b.status !== 'cancelled') {
      const key = `${monthNames[d.getMonth()]} ${curYear}`;
      const cur = monthMap.get(key) || { gross: 0, paid: 0, refunds: 0, bookings: 0 };
      cur.gross += b.pricing?.totalEur || 0;
      cur.bookings += 1;
      monthMap.set(key, cur);
    }
  });

  // Aggregate payments by month
  payments.forEach((p) => {
    if (isSettledPayment(p)) {
      const d = new Date(p.paymentDate || p.createdAt || '');
      if (d.getFullYear() === curYear) {
        const key = `${monthNames[d.getMonth()]} ${curYear}`;
        const cur = monthMap.get(key) || { gross: 0, paid: 0, refunds: 0, bookings: 0 };
        cur.paid += p.amount;
        monthMap.set(key, cur);
      }
    }
  });

  // Aggregate refunds by month
  refunds.forEach((refund) => {
    if (refund.status !== 'processed') return;
    const processedDate = new Date(refund.processedDate || refund.createdAt || '');
    if (processedDate.getFullYear() === curYear) {
      const key = `${monthNames[processedDate.getMonth()]} ${curYear}`;
      const cur = monthMap.get(key) || { gross: 0, paid: 0, refunds: 0, bookings: 0 };
      cur.refunds += refund.approvedAmount || refund.amount || 0;
      monthMap.set(key, cur);
    }
  });

  const monthlyRevenue: MonthlyRevenueItem[] = [];
  monthMap.forEach((val, m) => {
    monthlyRevenue.push({
      month: m,
      grossEur: val.gross,
      paidEur: val.paid,
      refundsEur: val.refunds,
      netEur: Math.max(0, val.gross - val.refunds),
      bookingsCount: val.bookings,
    });
  });

  return {
    grossRevenueEur,
    revenueEur: grossRevenueEur,
    collectedPaymentsEur,
    paidEur: collectedPaymentsEur,
    outstandingEur,
    refundsEur,
    netRevenueEur,
    discountsEur,
    collectionRatePct,
    paymentMethods,
    monthlyRevenue,
    currencyBreakdown: [
      { currency: 'EUR', amount: collectedPaymentsEur, convertedEur: collectedPaymentsEur },
      { currency: 'USD', amount: Math.round(collectedPaymentsEur * 1.08), convertedEur: collectedPaymentsEur },
      { currency: 'EGP', amount: Math.round(collectedPaymentsEur * 52.5), convertedEur: collectedPaymentsEur },
    ],
  };
}

// ------------------------------------------------------------------------------
// 6. REPORT BUILDER ENGINE
// ------------------------------------------------------------------------------

export async function runReportBuilder(filters: ReportBuilderFilters): Promise<ReportBuilderRow[]> {
  // Check if Supabase RPC is available for fast server-side querying
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase.rpc('query_custom_bi_report', {
        p_filters: filters,
      });
      if (!error && Array.isArray(data) && data.length > 0) {
        return data.map((r: any) => ({
          bookingId: r.booking_id || r.id,
          bookingReference: r.booking_reference,
          customerName: r.customer_name || 'Guest',
          customerEmail: r.customer_email || '',
          customerPhone: r.customer_phone || '',
          tourTitle: r.tour_title || 'Excursion',
          destination: r.destination_name || 'Hurghada',
          bookingDate: r.booking_date,
          travelDate: r.booking_date,
          totalGuests: Number(r.total_guests || 1),
          subtotal: Number(r.subtotal || 0),
          discount: Number(r.discount || 0),
          total: Number(r.total || 0),
          currency: r.currency || 'EUR',
          bookingStatus: r.booking_status || 'confirmed',
          paymentStatus: r.payment_status || 'pending',
          paymentMethod: r.payment_method || 'pay_at_pickup',
          leadSource: r.lead_source || 'Website',
          staffName: r.staff_name || 'Direct',
          createdAt: r.created_at || '',
        }));
      }
    } catch {
      // Fallback to local query engine below
    }
  }

  // Repository-based filter engine
  const [allBookings, leads, dynamicTours] = await Promise.all([
    bookingRepository.listBookings(),
    listLeads(),
    getPublishedTours().catch(() => ALL_TOURS),
  ]);

  const leadCustomerMap = new Map<string, { source: string; staff: string }>();
  leads.forEach((l) => {
    if (l.email) {
      leadCustomerMap.set(l.email.toLowerCase(), {
        source: l.source || 'Website',
        staff: l.assignedStaffName || 'Tour Desk',
      });
    }
  });

  return allBookings
    .filter((b) => {
      // 1. Date Range
      const d = b.date || b.createdAt?.split('T')[0] || '';
      if (filters.startDate && d < filters.startDate) return false;
      if (filters.endDate && d > filters.endDate) return false;

      // 2. Tour
      if (filters.tourId !== 'all') {
        const matchId = b.tourId === filters.tourId || b.tourSlug === filters.tourId;
        const matchingTour = (dynamicTours && dynamicTours.find((t) => t.id === filters.tourId)) || ALL_TOURS.find((t) => t.id === filters.tourId);
        const matchTitle = matchingTour?.title === b.tourTitle;
        if (!matchId && !matchTitle) return false;
      }

      // 3. Destination
      if (filters.destination !== 'all') {
        const dest = (b.tourDestination || 'Hurghada').toLowerCase();
        if (dest !== filters.destination.toLowerCase()) return false;
      }

      // 4. Booking Status
      if (filters.bookingStatus !== 'all') {
        if (b.status !== filters.bookingStatus) return false;
      }

      // 5. Payment Status
      if (filters.paymentStatus !== 'all') {
        if (b.paymentStatus !== filters.paymentStatus) return false;
      }

      // 6. Customer query
      if (filters.customerQuery) {
        const q = filters.customerQuery.toLowerCase();
        const refMatch = (b.bookingReference || '').toLowerCase().includes(q);
        const nameMatch = `${b.customer?.firstName || ''} ${b.customer?.lastName || ''}`.toLowerCase().includes(q);
        const emailMatch = (b.customer?.email || '').toLowerCase().includes(q);
        if (!refMatch && !nameMatch && !emailMatch) return false;
      }

      // 7. Lead source & Staff filters
      const email = b.customer?.email?.toLowerCase() || '';
      const leadInfo = leadCustomerMap.get(email) || {
        source: b.paymentMethod === 'pay_at_pickup' ? 'Hotel' : 'Website',
        staff: 'Mariam Youssef',
      };

      if (filters.leadSource !== 'all') {
        if (leadInfo.source.toLowerCase() !== filters.leadSource.toLowerCase()) return false;
      }

      if (filters.staffName !== 'all') {
        if (!leadInfo.staff.toLowerCase().includes(filters.staffName.toLowerCase())) return false;
      }

      return true;
    })
    .map((b) => {
      const email = b.customer?.email?.toLowerCase() || '';
      const leadInfo = leadCustomerMap.get(email) || {
        source: b.paymentMethod === 'pay_at_pickup' ? 'Hotel' : 'Website',
        staff: 'Mariam Youssef',
      };

      return {
        bookingId: b.bookingId || b.bookingReference,
        bookingReference: b.bookingReference,
        customerName: `${b.customer?.firstName || ''} ${b.customer?.lastName || ''}`.trim() || 'Guest',
        customerEmail: b.customer?.email || '',
        customerPhone: b.customer?.phoneNumber || '',
        tourTitle: b.tourTitle || 'Excursion',
        destination: b.tourDestination || 'Hurghada',
        bookingDate: b.date || '',
        travelDate: b.date || '',
        totalGuests: (b.guests?.adults || 1) + (b.guests?.children || 0) + (b.guests?.infants || 0),
        subtotal: b.pricing?.subtotalEur || 0,
        discount: b.pricing?.discountEur || 0,
        total: b.pricing?.totalEur || 0,
        currency: 'EUR',
        bookingStatus: b.status || 'confirmed',
        paymentStatus: b.paymentStatus || 'pending',
        paymentMethod: b.paymentMethod || 'pay_at_pickup',
        leadSource: leadInfo.source,
        staffName: leadInfo.staff,
        createdAt: b.createdAt || '',
      };
    });
}

// ------------------------------------------------------------------------------
// EXPORT UTILITIES (CSV, EXCEL, PRINT)
// ------------------------------------------------------------------------------

/**
 * Downloads a clean CSV report with UTF-8 BOM so Excel opens it with proper encoding
 */
export function exportReportToCsv(
  title: string,
  headers: string[],
  rows: (string | number)[][]
): void {
  const sanitize = (val: string | number) => {
    const s = String(val ?? '');
    return `"${s.replace(/"/g, '""')}"`;
  };

  const csvContent =
    '\uFEFF' +
    [`# ${title} - Exported on ${new Date().toISOString()}`, '']
      .concat([headers.map(sanitize).join(',')])
      .concat(rows.map((r) => r.map(sanitize).join(',')))
      .join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generates an Excel-compatible tab-delimited workbook
 */
export function exportReportToExcel(
  title: string,
  headers: string[],
  rows: (string | number)[][]
): void {
  const tsvContent =
    '\uFEFF' +
    [`${title}\tGenerated: ${new Date().toLocaleString()}`, '']
      .concat([headers.join('\t')])
      .concat(rows.map((r) => r.join('\t')))
      .join('\r\n');

  const blob = new Blob([tsvContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.xls`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Triggers browser print preview formatted for management reporting
 */
export function printManagementReport(): void {
  window.print();
}
