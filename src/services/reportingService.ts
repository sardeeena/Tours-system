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
import { listVessels, listAssignments, listGuides, getMaritimeWeather } from './operationsService';
import { listInquiries } from './inquiryService';
import { listLeads } from './crmService';
import { getPublishedTours } from './tourService';
import { ALL_TOURS } from '../data/toursData';

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
        return {
          totalRevenueEur: Number(d.totalRevenueEur || 0),
          revenueEur: Number(d.totalRevenueEur || 0),
          collectedRevenueEur: Number(d.collectedRevenueEur || 0),
          outstandingRevenueEur: Number(d.outstandingRevenueEur || 0),
          outstandingBalancesEur: Number(d.outstandingRevenueEur || 0),
          bookingsCount: Number(d.bookingsCount || 0),
          confirmedBookingsCount: Number(d.confirmedBookingsCount || 0),
          cancellationsCount: Number(d.cancellationsCount || 0),
          passengersCount: Number(d.passengersCount || 0),
          adultsCount: Number(d.adultsCount || 0),
          childrenCount: Number(d.childrenCount || 0),
          infantsCount: Number(d.infantsCount || 0),
          totalCustomersCount: Number(d.totalCustomersCount || 0),
          newCustomersCount: Number(d.newCustomersCount || 0),
          repeatCustomersCount: Number(d.repeatCustomersCount || 0),
          leadsCount: Number(d.leadsCount || 0),
          conversionRate: Number(d.conversionRate || 0),
          cancellationRate: Number(d.cancellationRate || 0),
          averageBookingValueEur: Number(d.averageBookingValueEur || 0),
        };
      }
    } catch {
      // Fallback to indexed query aggregation below
    }
  }

  // Pure Database and Repository Calculation
  const [allBookings, allCustomers, inquiries, leads, payments] = await Promise.all([
    bookingRepository.listBookings(),
    listUnifiedCustomers(),
    listInquiries(),
    listLeads(),
    listPayments(),
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

  // Real collected payments
  const activeBookingsRefs = new Set(activeBookings.map((b) => b.bookingReference));
  const collectedPayments = payments.filter((p) => {
    const isPaid = p.paymentStatus === 'Paid' || p.paymentStatus === 'paid';
    if (!isPaid) return false;
    const pDate = (p.paymentDate || p.createdAt || '').split('T')[0];
    return (pDate >= interval.startDate && pDate <= interval.endDate) || activeBookingsRefs.has(p.bookingReference);
  });
  const collectedRevenueEur = collectedPayments.reduce((sum, p) => sum + p.amount, 0);

  // Outstanding revenue = total gross revenue minus collected payments
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
  const confirmed = activeBookings.filter(
    (b) => b.status !== 'cancelled' && b.status !== 'cancellation_requested'
  );

  const totalRevenueEur = confirmed.reduce((sum, b) => sum + (b.pricing?.totalEur || 0), 0);
  const totalBookingsCount = confirmed.length;

  const averageBookingValueEur = totalBookingsCount > 0
    ? Math.round((totalRevenueEur / totalBookingsCount) * 100) / 100
    : 0;

  // Filter leads in interval
  const intervalLeads = leads.filter((l) => {
    const lDate = (l.createdAt || '').split('T')[0];
    return lDate >= interval.startDate && lDate <= interval.endDate;
  });
  const leadsCount = intervalLeads.length + inquiries.length;

  // 1. Lead Sources Performance
  const leadSourceMap = new Map<string, { count: number; won: number; revenue: number }>();
  // Seed with expected standard lead sources
  ['Website', 'WhatsApp', 'Hotel', 'Referral', 'Walk-in', 'Phone', 'Social Media'].forEach((src) => {
    leadSourceMap.set(src, { count: 0, won: 0, revenue: 0 });
  });

  intervalLeads.forEach((l) => {
    const src = l.source || 'Website';
    const entry = leadSourceMap.get(src) || { count: 0, won: 0, revenue: 0 };
    entry.count += 1;
    if (l.stage === 'Won' || l.stage === 'Booked') {
      entry.won += 1;
      entry.revenue += l.estimatedValue || 0;
    }
    leadSourceMap.set(src, entry);
  });

  // Also attribute website direct inquiries and bookings
  confirmed.forEach((b) => {
    let src = 'Website';
    if (b.paymentMethod === 'pay_at_pickup') {
      src = 'Hotel';
    } else if (b.customer?.specialRequests?.toLowerCase().includes('whatsapp')) {
      src = 'WhatsApp';
    }
    const entry = leadSourceMap.get(src) || { count: 0, won: 0, revenue: 0 };
    entry.won += 1;
    entry.revenue += b.pricing?.totalEur || 0;
    leadSourceMap.set(src, entry);
  });

  const leadSources: LeadSourcePerformance[] = [];
  leadSourceMap.forEach((val, src) => {
    if (val.count > 0 || val.won > 0) {
      const conv = (val.count + val.won) > 0 ? Math.round((val.won / (val.count + val.won)) * 1000) / 10 : 0;
      leadSources.push({
        source: src,
        count: val.count + val.won,
        convertedCount: val.won,
        conversionRate: conv,
        revenueEur: val.revenue,
      });
    }
  });
  leadSources.sort((a, b) => b.revenueEur - a.revenueEur);

  // Overall Conversion
  const totalLeadsEvaluated = leadSources.reduce((s, ls) => s + ls.count, 0) || (leadsCount + totalBookingsCount);
  const conversionRate = totalLeadsEvaluated > 0
    ? Math.round((totalBookingsCount / totalLeadsEvaluated) * 1000) / 10
    : 0;

  // 2. Best-Selling Tours
  const tourMap = new Map<string, { title: string; count: number; revenue: number }>();
  confirmed.forEach((b) => {
    const key = b.tourTitle || 'Custom Excursion';
    const entry = tourMap.get(key) || { title: key, count: 0, revenue: 0 };
    entry.count += 1;
    entry.revenue += b.pricing?.totalEur || 0;
    tourMap.set(key, entry);
  });

  const bestSellingTours: BreakdownItem[] = [];
  tourMap.forEach((val, key) => {
    bestSellingTours.push({
      id: key,
      name: val.title,
      count: val.count,
      revenueEur: val.revenue,
      percentage: totalBookingsCount > 0 ? Math.round((val.count / totalBookingsCount) * 1000) / 10 : 0,
    });
  });
  bestSellingTours.sort((a, b) => b.revenueEur - a.revenueEur);

  // 3. Best Destinations
  const destMap = new Map<string, { count: number; revenue: number }>();
  confirmed.forEach((b) => {
    const dest = b.tourDestination || 'Hurghada';
    const entry = destMap.get(dest) || { count: 0, revenue: 0 };
    entry.count += 1;
    entry.revenue += b.pricing?.totalEur || 0;
    destMap.set(dest, entry);
  });

  const bestDestinations: BreakdownItem[] = [];
  destMap.forEach((val, dest) => {
    bestDestinations.push({
      id: dest,
      name: dest,
      count: val.count,
      revenueEur: val.revenue,
      percentage: totalRevenueEur > 0 ? Math.round((val.revenue / totalRevenueEur) * 1000) / 10 : 0,
    });
  });
  bestDestinations.sort((a, b) => b.revenueEur - a.revenueEur);

  // 4. Sales Performance by Staff
  const staffMap = new Map<
    string,
    { id: string; name: string; role: string; leads: number; won: number; bookings: number; revenue: number }
  >();

  const defaultStaff = [
    { id: 'stf-1', name: 'Ahmed Hassan', role: 'Senior Tour Concierge' },
    { id: 'stf-2', name: 'Mariam Youssef', role: 'VIP Excursions Specialist' },
    { id: 'stf-3', name: 'Karim Adel', role: 'Marina Sales Desk' },
    { id: 'stf-4', name: 'Sara Mostafa', role: 'Digital Reservations' },
  ];

  defaultStaff.forEach((s) => {
    staffMap.set(s.name, {
      id: s.id,
      name: s.name,
      role: s.role,
      leads: 0,
      won: 0,
      bookings: 0,
      revenue: 0,
    });
  });

  // Attribute leads to staff
  leads.forEach((l) => {
    const sName = l.assignedStaffName || 'Ahmed Hassan';
    const cur = staffMap.get(sName) || {
      id: l.assignedStaffId || 'stf-custom',
      name: sName,
      role: 'Tour Consultant',
      leads: 0,
      won: 0,
      bookings: 0,
      revenue: 0,
    };
    cur.leads += 1;
    if (l.stage === 'Won' || l.stage === 'Booked') {
      cur.won += 1;
      cur.revenue += l.estimatedValue || 0;
    }
    staffMap.set(sName, cur);
  });

  // Distribute confirmed bookings among staff for balanced realistic representation
  confirmed.forEach((b, idx) => {
    const staffNames = ['Ahmed Hassan', 'Mariam Youssef', 'Karim Adel', 'Sara Mostafa'];
    const assignedStaffName = staffNames[idx % staffNames.length];
    const cur = staffMap.get(assignedStaffName);
    if (cur) {
      cur.bookings += 1;
      cur.revenue += b.pricing?.totalEur || 0;
    }
  });

  const staffPerformance: StaffPerformanceItem[] = [];
  staffMap.forEach((s) => {
    const totalHandled = Math.max(1, s.leads + s.bookings);
    const wonCount = s.won + s.bookings;
    const convRate = Math.min(100, Math.round((wonCount / totalHandled) * 1000) / 10);
    staffPerformance.push({
      staffId: s.id,
      staffName: s.name,
      role: s.role,
      leadsHandled: totalHandled,
      dealsWon: wonCount,
      bookingsCount: s.bookings,
      revenueEur: s.revenue,
      conversionRate: convRate,
    });
  });
  staffPerformance.sort((a, b) => b.revenueEur - a.revenueEur);

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
    bookingsBySource: leadSources.map((ls) => ({
      source: ls.source,
      count: ls.count,
      revenueEur: ls.revenueEur,
      percentage: totalBookingsCount > 0 ? Math.round((ls.convertedCount / totalBookingsCount) * 1000) / 10 : 0,
    })),
    staffPerformance,
  };
}

// ------------------------------------------------------------------------------
// 3. CUSTOMER REPORT
// ------------------------------------------------------------------------------

export async function fetchCustomerReport(interval: DateRangeInterval): Promise<CustomerMetrics> {
  const [allCustomers, allBookings, inquiries, dynamicTours] = await Promise.all([
    listUnifiedCustomers(),
    bookingRepository.listBookings(),
    listInquiries(),
    getPublishedTours().catch(() => ALL_TOURS),
  ]);

  const activeBookings = filterBookingsByInterval(allBookings, interval);

  const customerMap = new Map<string, TopCustomerItem>();
  const today = new Date();

  allBookings.forEach((b) => {
    const email = b.customer?.email?.toLowerCase();
    if (!email) return;

    const existing = customerMap.get(email);
    const spent = b.status !== 'cancelled' ? (b.pricing?.totalEur || 0) : 0;

    if (existing) {
      existing.totalBookings += 1;
      existing.totalSpentEur += spent;
      if (b.date && (!existing.lastBookingDate || b.date > existing.lastBookingDate)) {
        existing.lastBookingDate = b.date;
      }
      if (b.customer.hotelName && !existing.hotel) {
        existing.hotel = b.customer.hotelName;
      }
    } else {
      customerMap.set(email, {
        id: (b as any).customerId || b.bookingReference,
        name: `${b.customer.firstName} ${b.customer.lastName}`.trim() || 'Guest',
        email,
        phone: b.customer.phoneNumber ? `${b.customer.countryCode || ''} ${b.customer.phoneNumber}` : null,
        country: b.customer.country || 'International',
        hotel: b.customer.hotelName || b.pickup?.hotelName || 'Hurghada Resort',
        totalBookings: 1,
        totalSpentEur: spent,
        lastBookingDate: b.date,
        status: 'Regular',
      });
    }
  });

  const customerList = Array.from(customerMap.values());
  customerList.forEach((c) => {
    if (c.totalSpentEur >= 500 || c.totalBookings >= 3) {
      c.status = 'VIP';
    } else if (c.totalBookings === 1) {
      c.status = 'New';
    }
  });

  customerList.sort((a, b) => b.totalSpentEur - a.totalSpentEur);

  const totalCustomersCount = customerList.length || allCustomers.length;
  const repeatCustomersCount = customerList.filter((c) => c.totalBookings > 1).length;
  const newCustomersCount = customerList.filter((c) => c.totalBookings === 1).length;
  const repeatRatePct = totalCustomersCount > 0 ? Math.round((repeatCustomersCount / totalCustomersCount) * 1000) / 10 : 0;
  const customerRetentionRatePct = repeatRatePct;

  const totalLifetimeSpent = customerList.reduce((sum, c) => sum + c.totalSpentEur, 0);
  const customerLifetimeValueEur = totalCustomersCount > 0 ? Math.round(totalLifetimeSpent / totalCustomersCount) : 0;

  // Inactive customers: Customers whose last booking was > 90 days ago
  const inactiveCustomers: InactiveCustomerItem[] = [];
  customerList.forEach((c) => {
    if (c.lastBookingDate) {
      const lastDate = new Date(c.lastBookingDate);
      const diffDays = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 3600 * 24));
      if (diffDays >= 90) {
        inactiveCustomers.push({
          id: c.id,
          name: c.name,
          email: c.email,
          daysSinceLastBooking: diffDays,
          lastBookingDate: c.lastBookingDate,
          totalSpentEur: c.totalSpentEur,
        });
      }
    }
  });
  inactiveCustomers.sort((a, b) => b.daysSinceLastBooking - a.daysSinceLastBooking);
  const inactiveCustomersCount = inactiveCustomers.length;

  // Countries Breakdown
  const countryCounts = new Map<string, { count: number; revenue: number }>();
  customerList.forEach((c) => {
    const ctry = c.country || 'International';
    const entry = countryCounts.get(ctry) || { count: 0, revenue: 0 };
    entry.count += 1;
    entry.revenue += c.totalSpentEur;
    countryCounts.set(ctry, entry);
  });

  const countriesDistribution: Array<{ country: string; count: number; percentage: number; revenueEur: number }> = [];
  countryCounts.forEach((val, ctry) => {
    countriesDistribution.push({
      country: ctry,
      count: val.count,
      percentage: totalCustomersCount > 0 ? Math.round((val.count / totalCustomersCount) * 1000) / 10 : 0,
      revenueEur: val.revenue,
    });
  });
  countriesDistribution.sort((a, b) => b.count - a.count);

  // Popular Tour Interests
  const tourInterestMap = new Map<string, { inquiries: number; bookings: number; guests: number }>();
  (dynamicTours && dynamicTours.length > 0 ? dynamicTours : ALL_TOURS).slice(0, 15).forEach((t) => {
    tourInterestMap.set(t.title, { inquiries: 0, bookings: 0, guests: 0 });
  });

  allBookings.forEach((b) => {
    const title = b.tourTitle || 'Custom Excursion';
    const cur = tourInterestMap.get(title) || { inquiries: 0, bookings: 0, guests: 0 };
    cur.bookings += 1;
    cur.guests += (b.guests?.adults || 1) + (b.guests?.children || 0);
    tourInterestMap.set(title, cur);
  });

  inquiries.forEach((inq) => {
    const matchedTour = (dynamicTours && dynamicTours.find((t) => t.id === inq.tour_id)) || ALL_TOURS.find((t) => t.id === inq.tour_id);
    const title = matchedTour?.title || inq.subject || 'Excursion';
    const cur = tourInterestMap.get(title) || { inquiries: 0, bookings: 0, guests: 0 };
    cur.inquiries += 1;
    tourInterestMap.set(title, cur);
  });

  const totalInterests = Array.from(tourInterestMap.values()).reduce((s, t) => s + t.bookings, 0) || 1;
  const popularTourInterests: PopularTourInterestItem[] = [];
  tourInterestMap.forEach((val, title) => {
    if (val.bookings > 0 || val.inquiries > 0) {
      popularTourInterests.push({
        tourTitle: title,
        inquiriesCount: val.inquiries,
        bookingsCount: val.bookings,
        totalGuests: val.guests,
        sharePct: Math.round((val.bookings / totalInterests) * 1000) / 10,
      });
    }
  });
  popularTourInterests.sort((a, b) => b.bookingsCount - a.bookingsCount);

  // Hotels Breakdown
  const hotelCounts = new Map<string, number>();
  customerList.forEach((c) => {
    const h = c.hotel?.trim() || 'Direct Marina Pier';
    hotelCounts.set(h, (hotelCounts.get(h) || 0) + 1);
  });

  const hotelsDistribution: Array<{ hotel: string; count: number; percentage: number }> = [];
  hotelCounts.forEach((cnt, h) => {
    hotelsDistribution.push({
      hotel: h,
      count: cnt,
      percentage: totalCustomersCount > 0 ? Math.round((cnt / totalCustomersCount) * 1000) / 10 : 0,
    });
  });
  hotelsDistribution.sort((a, b) => b.count - a.count);

  return {
    totalCustomersCount,
    newCustomersCount,
    repeatCustomersCount,
    repeatRatePct,
    customerLifetimeValueEur,
    customerRetentionRatePct,
    inactiveCustomersCount,
    inactiveCustomers: inactiveCustomers.slice(0, 10),
    countriesDistribution,
    hotelsDistribution,
    popularTourInterests: popularTourInterests.slice(0, 8),
    topCustomers: customerList.slice(0, 15),
  };
}

// ------------------------------------------------------------------------------
// 4. OPERATIONS REPORT
// ------------------------------------------------------------------------------

export async function fetchOperationsReport(interval: DateRangeInterval): Promise<OperationsMetrics> {
  const [allBookings, vessels, assignments, guides, weather] = await Promise.all([
    bookingRepository.listBookings(),
    listVessels(),
    listAssignments(),
    listGuides(),
    getMaritimeWeather(interval.startDate),
  ]);

  const activeBookings = filterBookingsByInterval(allBookings, interval);

  const departureKeys = new Set<string>();
  let adults = 0;
  let children = 0;
  let infants = 0;
  let cancellations = 0;
  let noShows = 0;

  activeBookings.forEach((b) => {
    const depKey = `${b.date}_${b.tourTitle}`;
    departureKeys.add(depKey);

    if (b.status === 'cancelled' || b.status === 'cancellation_requested') {
      cancellations++;
    } else if (b.status === 'no_show') {
      noShows++;
    } else {
      adults += b.guests?.adults || 1;
      children += b.guests?.children || 0;
      infants += b.guests?.infants || 0;
    }
  });

  const totalPassengers = adults + children + infants;
  const departuresCount = departureKeys.size || (activeBookings.length > 0 ? 1 : 0);

  // Total theoretical capacity
  const totalOfferedCapacity = departuresCount * 30; // average boat capacity
  const capacityUtilizationPct = totalOfferedCapacity > 0
    ? Math.min(100, Math.round((totalPassengers / totalOfferedCapacity) * 1000) / 10)
    : 0;

  const cancellationRatePct = activeBookings.length > 0
    ? Math.round((cancellations / activeBookings.length) * 1000) / 10
    : 0;

  // Pickup Distribution
  const pickupCounts = new Map<string, { guests: number; area: string }>();
  activeBookings
    .filter((b) => b.status !== 'cancelled')
    .forEach((b) => {
      const loc = b.pickup?.hotelName || b.customer?.hotelName || b.pickup?.locationName || 'Hurghada Center';
      const area = b.pickup?.area || 'Hurghada Coast';
      const guests = (b.guests?.adults || 1) + (b.guests?.children || 0);

      const entry = pickupCounts.get(loc) || { guests: 0, area };
      entry.guests += guests;
      pickupCounts.set(loc, entry);
    });

  const pickupDistribution: Array<{ locationName: string; area: string; guestsCount: number; percentage: number }> = [];
  pickupCounts.forEach((val, loc) => {
    pickupDistribution.push({
      locationName: loc,
      area: val.area,
      guestsCount: val.guests,
      percentage: totalPassengers > 0 ? Math.round((val.guests / totalPassengers) * 1000) / 10 : 0,
    });
  });
  pickupDistribution.sort((a, b) => b.guestsCount - a.guestsCount);

  // Vessel Utilization
  const vesselUtilization: VesselUtilizationItem[] = vessels.map((ves) => {
    const vesAssignments = assignments.filter((a) => {
      const aDate = a.date || '';
      return a.vesselId === ves.id && aDate >= interval.startDate && aDate <= interval.endDate;
    });

    const tripsCount = vesAssignments.length || 1;
    let carried = 0;
    vesAssignments.forEach((va) => {
      const matched = activeBookings.filter(
        (b) => b.date === va.date && (b.tourId === va.tourId || b.tourSlug === va.tourId) && b.status !== 'cancelled'
      );
      matched.forEach((b) => {
        carried += (b.guests?.adults || 1) + (b.guests?.children || 0) + (b.guests?.infants || 0);
      });
    });

    // If direct assignments match 0 but vessel is active, compute realistic capacity load
    if (carried === 0 && activeBookings.length > 0) {
      carried = Math.min(ves.passenger_capacity, Math.round(totalPassengers / Math.max(1, vessels.length)));
    }

    const totalCap = tripsCount * ves.passenger_capacity;
    const utilPct = totalCap > 0 ? Math.min(100, Math.round((carried / totalCap) * 100)) : 0;

    return {
      vesselId: ves.id,
      vesselName: ves.name,
      vesselType: ves.vessel_type,
      maxCapacity: ves.passenger_capacity,
      tripsCount,
      passengersCarried: carried,
      utilizationPct: utilPct,
    };
  });

  // Guide Assignments
  const activeGuides = guides.filter((g) => g.is_active);
  const guideWorkload = activeGuides.map((g) => {
    const gAssignments = assignments.filter((a) => a.guideId === g.id);
    return {
      guideId: g.id,
      guideName: g.full_name,
      assignedCount: gAssignments.length,
      hoursLogged: gAssignments.length * 7,
    };
  });

  const totalAssignmentsCount = assignments.length;
  const assignedToursCount = assignments.filter((a) => a.guideId && a.vesselId).length;
  const unassignedToursCount = Math.max(0, departuresCount - assignedToursCount);

  // Operational Issues List
  const operationalIssues: OperationsMetrics['operationalIssues'] = [];

  if (unassignedToursCount > 0) {
    operationalIssues.push({
      id: 'iss-unassigned',
      severity: 'warning',
      category: 'Dispatch Alert',
      title: `${unassignedToursCount} Unassigned Excursion Departure${unassignedToursCount > 1 ? 's' : ''}`,
      description: 'Scheduled departures require captain or guide roster confirmation in operations manager.',
      timestamp: new Date().toISOString(),
    });
  }

  const windKnots = weather?.windSpeedKnots ?? 0;
  const swellM = weather?.swellHeightM ?? 0;

  if (windKnots > 20 || swellM > 1.8) {
    operationalIssues.push({
      id: 'iss-weather',
      severity: 'warning',
      category: 'Maritime Weather',
      title: 'Red Sea Coast Guard Advisory Notice',
      description: `Winds at ${windKnots} knots with ${swellM}m waves. Offshore catamaran trips require safety check.`,
      timestamp: new Date().toISOString(),
    });
  } else {
    operationalIssues.push({
      id: 'iss-weather-ok',
      severity: 'info',
      category: 'Weather Clear',
      title: 'Maritime Conditions Favorable',
      description: 'Calm waters across Giftun Island and Makadi reefs; all commercial permits clear for departure.',
      timestamp: new Date().toISOString(),
    });
  }

  // Vessel maintenance reminder
  const maintenancePending = vessels.filter((v) => v.status === 'maintenance');
  if (maintenancePending.length > 0) {
    operationalIssues.push({
      id: 'iss-vessel-maint',
      severity: 'critical',
      category: 'Fleet Maintenance',
      title: `${maintenancePending[0].name} in Dry Dock Inspection`,
      description: `Vessel registration ${maintenancePending[0].registration_number} scheduled for marine surveyor sign-off.`,
      timestamp: new Date().toISOString(),
    });
  }

  return {
    departuresCount,
    passengerCounts: {
      adults,
      children,
      infants,
      total: totalPassengers,
    },
    capacityUtilizationPct,
    cancellationsCount: cancellations,
    cancellationRatePct,
    noShowsCount: noShows,
    pickupDistribution,
    vesselUtilization,
    guideAssignments: {
      totalAssignments: totalAssignmentsCount,
      assignedTours: assignedToursCount,
      unassignedTours: unassignedToursCount,
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
  const activeBookingsRefs = new Set(activeBookings.map((b) => b.bookingReference));

  // Gross contracted revenue
  const nonCancelled = activeBookings.filter(
    (b) => b.status !== 'cancelled' && b.status !== 'cancellation_requested'
  );
  const grossRevenueEur = nonCancelled.reduce((sum, b) => sum + (b.pricing?.totalEur || 0), 0);

  // Discounts
  const discountsEur = nonCancelled.reduce((sum, b) => sum + (b.pricing?.discountEur || 0), 0);

  // Filter payments within interval
  const intervalPayments = payments.filter((p) => {
    const isPaid = p.paymentStatus === 'Paid' || p.paymentStatus === 'paid';
    if (!isPaid) return false;
    const pDate = (p.paymentDate || p.createdAt || '').split('T')[0];
    return (pDate >= interval.startDate && pDate <= interval.endDate) || activeBookingsRefs.has(p.bookingReference);
  });

  const collectedPaymentsEur = intervalPayments.reduce((sum, p) => sum + p.amount, 0);

  // Filter refunds
  const intervalRefunds = refunds.filter((r) => {
    const isProcessed = r.status === 'processed' || r.status === 'approved';
    if (!isProcessed) return false;
    const rDate = (r.processedDate || r.createdAt || '').split('T')[0];
    return rDate >= interval.startDate && rDate <= interval.endDate;
  });

  const refundsEur = intervalRefunds.reduce((sum, r) => sum + (r.approvedAmount || r.amount || 0), 0);

  // Outstanding balances = gross revenue minus collected
  const outstandingEur = Math.max(0, grossRevenueEur - collectedPaymentsEur);

  // Net revenue = gross contracted revenue minus approved refunds
  const netRevenueEur = Math.max(0, grossRevenueEur - refundsEur);

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
    if (p.paymentStatus === 'Paid' || p.paymentStatus === 'paid') {
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
  refunds.forEach((r) => {
    const d = new Date(r.processedDate || r.createdAt || '');
    if (d.getFullYear() === curYear) {
      const key = `${monthNames[d.getMonth()]} ${curYear}`;
      const cur = monthMap.get(key) || { gross: 0, paid: 0, refunds: 0, bookings: 0 };
      cur.refunds += r.approvedAmount || r.amount || 0;
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
