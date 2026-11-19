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
  GuideAssignmentItem,
  OperationalIssueItem,
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
  // The existing get_executive_bi_metrics RPC reports mixed-currency sums as EUR
  // and its customer/booking cohort semantics do not match the dashboard filters.
  // Use the authoritative repositories until a corrected, currency-aware RPC is deployed.

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

  const confirmedStatuses = ['confirmed', 'boarding', 'in_progress', 'completed'];
  const confirmedBookings = activeBookings.filter((booking) => confirmedStatuses.includes(booking.status));
  const nonCancelledBookings = activeBookings.filter(
    (booking) => booking.status !== 'cancelled' && booking.status !== 'cancellation_requested'
  );
  const cancelledBookings = activeBookings.filter(
    (booking) => booking.status === 'cancelled' || booking.status === 'cancellation_requested'
  );

  const totalRevenueEur = nonCancelledBookings.reduce(
    (sum, booking) => sum + (Number(booking.pricing?.totalEur) || 0),
    0
  );
  const bookingsCount = activeBookings.length;
  const confirmedBookingsCount = confirmedBookings.length;
  const completedBookingsCount = activeBookings.filter((booking) => booking.status === 'completed').length;
  const cancellationsCount = cancelledBookings.length;

  const passengerBookings = nonCancelledBookings.filter((booking) => booking.status !== 'no_show');
  const adultsCount = passengerBookings.reduce((sum, booking) => sum + (Number(booking.guests?.adults) || 0), 0);
  const childrenCount = passengerBookings.reduce((sum, booking) => sum + (Number(booking.guests?.children) || 0), 0);
  const infantsCount = passengerBookings.reduce((sum, booking) => sum + (Number(booking.guests?.infants) || 0), 0);
  const passengersCount = adultsCount + childrenCount + infantsCount;

  const activeBookingsRefs = new Set(nonCancelledBookings.map((booking) => booking.bookingReference));
  const activeBookingIds = new Set(nonCancelledBookings.map((booking) => booking.bookingId).filter(Boolean));
  const isForActiveBooking = (record: { bookingReference?: string; bookingId?: string }) =>
    activeBookingsRefs.has(record.bookingReference || '') || activeBookingIds.has(record.bookingId || '');
  const isSettledPayment = (payment: { paymentStatus: unknown }) =>
    ['paid', 'partially paid'].includes(String(payment.paymentStatus).toLowerCase().replace(/_/g, ' '));
  const isEur = (record: { currency?: string | null }) => String(record.currency || '').toUpperCase() === 'EUR';

  const collectedPayments = payments.filter(
    (payment) => isSettledPayment(payment) && isForActiveBooking(payment) && isEur(payment)
  );
  const processedRefunds = refunds.filter(
    (refund) => refund.status === 'processed' && isForActiveBooking(refund) && isEur(refund)
  );
  const grossCollectedRevenueEur = collectedPayments.reduce(
    (sum, payment) => sum + (Number(payment.amount) || 0),
    0
  );
  const refundedRevenueEur = processedRefunds.reduce(
    (sum, refund) => sum + (Number(refund.approvedAmount ?? refund.amount) || 0),
    0
  );
  const collectedRevenueEur = Math.max(0, grossCollectedRevenueEur - refundedRevenueEur);
  const outstandingRevenueEur = Math.max(0, totalRevenueEur - collectedRevenueEur);

  const customerEmailCounts = new Map<string, number>();
  nonCancelledBookings.forEach((booking) => {
    const email = booking.customer?.email?.toLowerCase();
    if (email) customerEmailCounts.set(email, (customerEmailCounts.get(email) || 0) + 1);
  });

  const customers = allCustomers.filter((customer) => customer.role === 'customer');
  const totalCustomersCount = customers.length || customerEmailCounts.size;
  const newCustomersCount = customers.filter((customer) => {
    const createdDate = (customer.createdAt || '').split('T')[0];
    return createdDate >= interval.startDate && createdDate <= interval.endDate;
  }).length;
  const repeatCustomersCount = customers.length > 0
    ? customers.filter((customer) => (Number(customer.totalBookings) || 0) > 1).length
    : Array.from(customerEmailCounts.values()).filter((count) => count > 1).length;

  const intervalLeads = leads.filter((lead) => {
    const date = (lead.createdAt || '').split('T')[0];
    return date >= interval.startDate && date <= interval.endDate;
  });
  const intervalInquiries = inquiries.filter((inquiry) => {
    const date = (inquiry.created_at || '').split('T')[0];
    return date >= interval.startDate && date <= interval.endDate && inquiry.status !== 'converted';
  });
  const leadsCount = intervalLeads.length + intervalInquiries.length;
  const convertedLeadCount = intervalLeads.filter(
    (lead) => ['Won', 'Booked', 'Completed'].includes(lead.stage)
  ).length;
  const conversionRate = leadsCount > 0
    ? Math.round((convertedLeadCount / leadsCount) * 1000) / 10
    : 0;

  const cancellationRate = bookingsCount > 0
    ? Math.round((cancellationsCount / bookingsCount) * 1000) / 10
    : 0;
  const averageBookingValueEur = nonCancelledBookings.length > 0
    ? Math.round((totalRevenueEur / nonCancelledBookings.length) * 100) / 100
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
  const interestMap = new Map<string, { bookings: number; inquiries: number; revenue: number; totalGuests: number }>();
  activeBookings.forEach((booking) => {
    const name = booking.tourTitle || tourMap.get(booking.tourId) || 'Tour not recorded';
    const current = interestMap.get(name) || { bookings: 0, inquiries: 0, revenue: 0, totalGuests: 0 };
    current.bookings += 1;
    current.revenue += booking.pricing?.totalEur || 0;
    current.totalGuests += (Number(booking.guests?.adults) || 0) + (Number(booking.guests?.children) || 0) + (Number(booking.guests?.infants) || 0);
    interestMap.set(name, current);
  });
  intervalInquiries.forEach((inquiry) => {
    const name = (inquiry.tour_id && tourMap.get(inquiry.tour_id)) || inquiry.subject || 'Tour not specified';
    const current = interestMap.get(name) || { bookings: 0, inquiries: 0, revenue: 0, totalGuests: 0 };
    current.inquiries += 1;
    interestMap.set(name, current);
  });

  const totalInterests = Array.from(interestMap.values()).reduce(
    (sum, item) => sum + item.bookings + item.inquiries,
    0
  );
  const popularTourInterests: PopularTourInterestItem[] = Array.from(interestMap.entries())
    .map(([tourTitle, value]) => ({
      tourTitle,
      inquiriesCount: value.inquiries,
      bookingsCount: value.bookings,
      totalGuests: value.totalGuests,
      sharePct: totalInterests > 0
        ? Math.round(((value.bookings + value.inquiries) / totalInterests) * 1000) / 10
        : 0,
    }))
    .sort((a, b) => (b.bookingsCount + b.inquiriesCount) - (a.bookingsCount + a.inquiriesCount));

  const countryMap = new Map<string, { count: number; revenueEur: number }>();
  const hotelMap = new Map<string, number>();
  customerList.forEach((customer) => {
    const country = customer.country || 'Not recorded';
    const hotel = customer.hotel || 'Not recorded';
    const countryValue = countryMap.get(country) || { count: 0, revenueEur: 0 };
    countryValue.count += 1;
    countryValue.revenueEur += Number(customer.totalSpentEur) || 0;
    countryMap.set(country, countryValue);
    hotelMap.set(hotel, (hotelMap.get(hotel) || 0) + 1);
  });
  const countriesDistribution = Array.from(countryMap.entries())
    .map(([country, value]) => ({
      country,
      count: value.count,
      percentage: totalCustomersCount > 0 ? Math.round((value.count / totalCustomersCount) * 1000) / 10 : 0,
      revenueEur: value.revenueEur,
    }))
    .sort((a, b) => b.count - a.count);
  const hotelsDistribution = Array.from(hotelMap.entries())
    .map(([hotel, count]) => ({
      hotel,
      count,
      percentage: totalCustomersCount > 0 ? Math.round((count / totalCustomersCount) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 90);
  const inactiveCustomers: InactiveCustomerItem[] = customerList.flatMap((customer) => {
    if (!customer.lastBookingDate || customer.totalBookings === 0) return [];
    const lastBookingDate = new Date(customer.lastBookingDate);
    if (Number.isNaN(lastBookingDate.getTime()) || lastBookingDate >= cutoffDate) return [];
    return [{
      id: customer.id,
      name: customer.name,
      email: customer.email,
      daysSinceLastBooking: Math.max(0, Math.floor((Date.now() - lastBookingDate.getTime()) / 86_400_000)),
      lastBookingDate: customer.lastBookingDate,
      totalSpentEur: customer.totalSpentEur,
    }];
  });

  return {
    totalCustomersCount,
    newCustomersCount,
    repeatCustomersCount,
    customerLifetimeValueEur,
    repeatRatePct,
    customerRetentionRatePct: repeatRatePct,
    inactiveCustomersCount: inactiveCustomers.length,
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
    weather?.isAvailable &&
    (weather.windSpeedKnots !== null && weather.windSpeedKnots !== undefined ||
      weather.swellHeightM !== null && weather.swellHeightM !== undefined)
  );
  if (weather?.coastGuardCleared === false) {
    operationalIssues.push({
      id: 'coast-guard-not-cleared',
      severity: 'critical',
      category: 'clearance',
      title: 'Operator bulletin records no Coast Guard clearance',
      description: 'The recorded operator bulletin does not indicate clearance. Do not treat this dashboard as authorization to sail; follow the harbor authority and operator decision.',
      timestamp,
    });
  } else if (weather?.coastGuardCleared === null || weather?.coastGuardCleared === undefined) {
    operationalIssues.push({
      id: 'coast-guard-not-recorded',
      severity: 'warning',
      category: 'clearance',
      title: 'Coast Guard clearance is not recorded',
      description: 'No operator-recorded clearance is available for this date. Verify sailing permission with the harbor authority before departure.',
      timestamp,
    });
  }

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
  const nonCancelled = activeBookings.filter(
    (booking) => booking.status !== 'cancelled' && booking.status !== 'cancellation_requested'
  );
  const activeBookingRefs = new Set(nonCancelled.map((booking) => booking.bookingReference));
  const activeBookingIds = new Set(nonCancelled.map((booking) => booking.bookingId).filter(Boolean));
  const allNonCancelledBookingRefs = new Set(
    allBookings
      .filter((booking) => booking.status !== 'cancelled' && booking.status !== 'cancellation_requested')
      .map((booking) => booking.bookingReference)
  );
  const matchesActiveBooking = (record: { bookingReference?: string; bookingId?: string }) =>
    activeBookingRefs.has(record.bookingReference || '') || activeBookingIds.has(record.bookingId || '');
  const isSettledPayment = (payment: { paymentStatus: unknown }) =>
    ['paid', 'partially paid'].includes(String(payment.paymentStatus).toLowerCase().replace(/_/g, ' '));
  const isEur = (record: { currency?: string | null }) => String(record.currency || '').toUpperCase() === 'EUR';

  const grossRevenueEur = nonCancelled.reduce((sum, booking) => sum + (booking.pricing?.totalEur || 0), 0);
  const discountsEur = nonCancelled.reduce((sum, booking) => sum + (booking.pricing?.discountEur || 0), 0);

  const intervalPayments = payments.filter((payment) => {
    if (!isSettledPayment(payment) || !allNonCancelledBookingRefs.has(payment.bookingReference)) return false;
    const paymentDate = (payment.paymentDate || payment.createdAt || '').split('T')[0];
    return (paymentDate >= interval.startDate && paymentDate <= interval.endDate) || matchesActiveBooking(payment);
  });

  const eurIntervalPayments = intervalPayments.filter(isEur);
  const collectedPaymentsEur = eurIntervalPayments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);

  const intervalRefunds = refunds.filter((refund) => {
    if (refund.status !== 'processed') return false;
    const refundDate = (refund.processedDate || refund.createdAt || '').split('T')[0];
    return matchesActiveBooking(refund) || (
      refundDate >= interval.startDate &&
      refundDate <= interval.endDate &&
      allNonCancelledBookingRefs.has(refund.bookingReference)
    );
  });
  const eurIntervalRefunds = intervalRefunds.filter(isEur);
  const refundsEur = eurIntervalRefunds.reduce(
    (sum, refund) => sum + (Number(refund.approvedAmount ?? refund.amount) || 0),
    0
  );

  const cohortPayments = payments.filter((payment) => isSettledPayment(payment) && matchesActiveBooking(payment));
  const cohortRefunds = refunds.filter((refund) => refund.status === 'processed' && matchesActiveBooking(refund));
  const cohortGrossCollectedEur = cohortPayments.filter(isEur).reduce(
    (sum, payment) => sum + (Number(payment.amount) || 0),
    0
  );
  const cohortRefundedEur = cohortRefunds.filter(isEur).reduce(
    (sum, refund) => sum + (Number(refund.approvedAmount ?? refund.amount) || 0),
    0
  );
  const cohortNetCollectedEur = Math.max(0, cohortGrossCollectedEur - cohortRefundedEur);
  const outstandingEur = Math.max(0, grossRevenueEur - cohortNetCollectedEur);
  const netRevenueEur = Math.max(0, grossRevenueEur - cohortRefundedEur);

  const netDue = Math.max(1, grossRevenueEur - discountsEur);
  const collectionRatePct = Math.min(100, Math.round((collectedPaymentsEur / netDue) * 1000) / 10);

  const methodMap = new Map<string, { amount: number; count: number }>();
  eurIntervalPayments.forEach((payment) => {
    const method = payment.paymentMethod || 'Unknown';
    const current = methodMap.get(method) || { amount: 0, count: 0 };
    current.amount += Number(payment.amount) || 0;
    current.count += 1;
    methodMap.set(method, current);
  });
  const paymentMethods: PaymentMethodBreakdown[] = Array.from(methodMap.entries())
    .map(([method, value]) => ({
      method,
      amountEur: value.amount,
      count: value.count,
      percentage: collectedPaymentsEur > 0
        ? Math.round((value.amount / collectedPaymentsEur) * 1000) / 10
        : 0,
    }))
    .sort((a, b) => b.amountEur - a.amountEur);

  const monthMap = new Map<string, { gross: number; paid: number; refunds: number; bookings: number }>();
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const currentYear = new Date().getFullYear();
  for (let month = 0; month < 12; month++) {
    monthMap.set(`${monthNames[month]} ${currentYear}`, { gross: 0, paid: 0, refunds: 0, bookings: 0 });
  }

  allBookings.forEach((booking) => {
    const dateValue = booking.date || booking.createdAt;
    if (!dateValue || ['cancelled', 'cancellation_requested'].includes(booking.status)) return;
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime()) || date.getFullYear() !== currentYear) return;
    const key = `${monthNames[date.getMonth()]} ${currentYear}`;
    const current = monthMap.get(key)!;
    current.gross += booking.pricing?.totalEur || 0;
    current.bookings += 1;
  });

  payments.forEach((payment) => {
    if (!isSettledPayment(payment) || !isEur(payment)) return;
    const date = new Date(payment.paymentDate || payment.createdAt || '');
    if (Number.isNaN(date.getTime()) || date.getFullYear() !== currentYear) return;
    const key = `${monthNames[date.getMonth()]} ${currentYear}`;
    const current = monthMap.get(key)!;
    current.paid += Number(payment.amount) || 0;
  });

  refunds.forEach((refund) => {
    if (refund.status !== 'processed' || !isEur(refund)) return;
    const date = new Date(refund.processedDate || refund.createdAt || '');
    if (Number.isNaN(date.getTime()) || date.getFullYear() !== currentYear) return;
    const key = `${monthNames[date.getMonth()]} ${currentYear}`;
    const current = monthMap.get(key)!;
    current.refunds += Number(refund.approvedAmount ?? refund.amount) || 0;
  });

  const monthlyRevenue: MonthlyRevenueItem[] = Array.from(monthMap.entries()).map(([month, value]) => ({
    month,
    grossEur: value.gross,
    paidEur: value.paid,
    refundsEur: value.refunds,
    netEur: Math.max(0, value.gross - value.refunds),
    bookingsCount: value.bookings,
  }));

  const currencyMap = new Map<string, number>();
  intervalPayments.forEach((payment) => {
    const currency = String(payment.currency || 'UNKNOWN').toUpperCase();
    currencyMap.set(currency, (currencyMap.get(currency) || 0) + (Number(payment.amount) || 0));
  });
  const currencyBreakdown = Array.from(currencyMap.entries())
    .map(([currency, amount]) => ({
      currency,
      amount,
      convertedEur: currency === 'EUR' ? amount : null,
    }))
    .sort((a, b) => b.amount - a.amount);

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
    currencyBreakdown,
  };
}

// ------------------------------------------------------------------------------
// 6. REPORT BUILDER ENGINE
// ------------------------------------------------------------------------------

export async function runReportBuilder(filters: ReportBuilderFilters): Promise<ReportBuilderRow[]> {
  if (filters.startDate && filters.endDate && filters.startDate > filters.endDate) {
    throw new Error('The report start date must be on or before the end date.');
  }

  if (isSupabaseConfigured()) {
    const { data, error } = await supabase.rpc('query_custom_bi_report', {
      p_filters: filters,
    });
    if (error) throw new Error(`The report query failed: ${error.message}`);
    if (data === null || data === undefined) return [];
    if (!Array.isArray(data)) throw new Error('The report query returned an invalid result format.');

    return data.map((row: any) => ({
      bookingId: String(row.booking_id || row.id || row.booking_reference || ''),
      bookingReference: String(row.booking_reference || ''),
      customerName: String(row.customer_name || ''),
      customerEmail: String(row.customer_email || ''),
      customerPhone: String(row.customer_phone || ''),
      tourTitle: String(row.tour_title || ''),
      destination: String(row.destination_name || ''),
      bookingDate: String(row.booking_date || ''),
      travelDate: String(row.travel_date || row.booking_date || ''),
      totalGuests: Number(row.total_guests ?? 0),
      subtotal: Number(row.subtotal ?? 0),
      discount: Number(row.discount ?? 0),
      total: Number(row.total ?? 0),
      currency: String(row.currency || 'EUR').toUpperCase(),
      bookingStatus: String(row.booking_status || 'unknown'),
      paymentStatus: String(row.payment_status || 'unknown'),
      paymentMethod: String(row.payment_method || 'unknown'),
      leadSource: normalizeLeadSource(row.lead_source),
      staffName: String(row.staff_name || 'Unassigned'),
      createdAt: String(row.created_at || ''),
    }));
  }

  if (!import.meta.env.DEV) {
    throw new Error('Supabase is not configured; custom reports cannot be generated in production.');
  }

  // Development-only local query engine. It uses only records actually present
  // in the local repository; it never invents staff, destinations or booking facts.
  const [allBookings, leads, dynamicTours] = await Promise.all([
    bookingRepository.listBookings(),
    listLeads(),
    getPublishedTours(),
  ]);

  const leadCustomerMap = new Map<string, { source: string; staff: string }>();
  leads.forEach((lead) => {
    if (!lead.email) return;
    leadCustomerMap.set(lead.email.toLowerCase(), {
      source: normalizeLeadSource(lead.source),
      staff: lead.assignedStaffName || 'Unassigned',
    });
  });

  return allBookings
    .filter((booking) => {
      const date = booking.date || booking.createdAt?.split('T')[0] || '';
      if (filters.startDate && date < filters.startDate) return false;
      if (filters.endDate && date > filters.endDate) return false;

      if (filters.tourId !== 'all') {
        const matchingTour = dynamicTours.find((tour) => tour.id === filters.tourId);
        const matchId = booking.tourId === filters.tourId || booking.tourSlug === filters.tourId;
        if (!matchId && matchingTour?.title !== booking.tourTitle) return false;
      }

      if (filters.destination !== 'all' &&
        (booking.tourDestination || '').toLowerCase() !== filters.destination.toLowerCase()) return false;
      if (filters.bookingStatus !== 'all' && booking.status !== filters.bookingStatus) return false;
      if (filters.paymentStatus !== 'all' && booking.paymentStatus !== filters.paymentStatus) return false;

      if (filters.customerQuery) {
        const query = filters.customerQuery.toLowerCase();
        const referenceMatch = (booking.bookingReference || '').toLowerCase().includes(query);
        const nameMatch = `${booking.customer?.firstName || ''} ${booking.customer?.lastName || ''}`.toLowerCase().includes(query);
        const emailMatch = (booking.customer?.email || '').toLowerCase().includes(query);
        if (!referenceMatch && !nameMatch && !emailMatch) return false;
      }

      const email = booking.customer?.email?.toLowerCase() || '';
      const leadInfo = leadCustomerMap.get(email);
      const source = leadInfo?.source || normalizeLeadSource((booking as any).source);
      const staff = leadInfo?.staff || (booking as any).assignedStaffName || 'Unassigned';
      if (filters.leadSource !== 'all' && source.toLowerCase() !== filters.leadSource.toLowerCase()) return false;
      if (filters.staffName !== 'all' && !staff.toLowerCase().includes(filters.staffName.toLowerCase())) return false;
      return true;
    })
    .map((booking) => {
      const email = booking.customer?.email?.toLowerCase() || '';
      const leadInfo = leadCustomerMap.get(email);
      return {
        bookingId: booking.bookingId || booking.bookingReference,
        bookingReference: booking.bookingReference,
        customerName: `${booking.customer?.firstName || ''} ${booking.customer?.lastName || ''}`.trim(),
        customerEmail: booking.customer?.email || '',
        customerPhone: booking.customer?.phoneNumber || '',
        tourTitle: booking.tourTitle || '',
        destination: booking.tourDestination || '',
        bookingDate: booking.date || '',
        travelDate: booking.date || '',
        totalGuests: (Number(booking.guests?.adults) || 0) +
          (Number(booking.guests?.children) || 0) +
          (Number(booking.guests?.infants) || 0),
        subtotal: booking.pricing?.subtotalEur || 0,
        discount: booking.pricing?.discountEur || 0,
        total: booking.pricing?.totalEur || 0,
        currency: String(booking.pricing?.currency || 'EUR').toUpperCase(),
        bookingStatus: booking.status || 'unknown',
        paymentStatus: booking.paymentStatus || 'unknown',
        paymentMethod: booking.paymentMethod || 'unknown',
        leadSource: leadInfo?.source || normalizeLeadSource((booking as any).source),
        staffName: leadInfo?.staff || (booking as any).assignedStaffName || 'Unassigned',
        createdAt: booking.createdAt || '',
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
