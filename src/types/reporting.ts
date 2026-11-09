export type ReportDateRangeType =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'this_month'
  | 'last_month'
  | 'this_year'
  | 'custom';

export interface DateRangeInterval {
  range: ReportDateRangeType;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  label?: string;
}

export type DashboardViewMode =
  | 'executive'
  | 'sales'
  | 'operations'
  | 'customers'
  | 'finance'
  | 'builder';

// 1. Executive Dashboard Metrics
export interface ExecutiveMetrics {
  totalRevenueEur: number;
  revenueEur: number; // alias
  collectedRevenueEur: number;
  outstandingRevenueEur: number;
  outstandingBalancesEur: number; // alias
  bookingsCount: number;
  totalBookings?: number; // alias
  confirmedBookingsCount: number;
  confirmedBookings?: number; // alias
  cancellationsCount: number;
  passengersCount: number;
  adultsCount: number;
  childrenCount: number;
  infantsCount: number;
  totalCustomersCount: number;
  newCustomersCount: number;
  repeatCustomersCount: number;
  leadsCount: number;
  conversionRate: number; // percentage (0-100)
  cancellationRate: number; // percentage (0-100)
  averageBookingValueEur: number;
  priorPeriodComparison?: {
    priorRevenueEur: number;
    revenueGrowthPct: number;
    priorBookingsCount: number;
    bookingsGrowthPct: number;
  };
}

// 2. Sales Dashboard Metrics
export interface BreakdownItem {
  id: string;
  name: string;
  count: number;
  revenueEur: number;
  percentage: number;
}

export interface StaffPerformanceItem {
  staffId: string;
  staffName: string;
  role: string;
  leadsHandled: number;
  dealsWon: number;
  bookingsCount: number;
  revenueEur: number;
  conversionRate: number; // 0-100%
}

export interface LeadSourcePerformance {
  source: string;
  count: number;
  convertedCount: number;
  conversionRate: number;
  revenueEur: number;
}

export interface SalesMetrics {
  leadsCount: number;
  leadSources: LeadSourcePerformance[];
  conversionRate: number;
  totalBookingsCount: number;
  totalRevenueEur: number;
  averageBookingValueEur: number;
  bestSellingTours: BreakdownItem[];
  bestDestinations: BreakdownItem[];
  bookingsByTour: BreakdownItem[]; // alias for compatibility
  bookingsByDestination: BreakdownItem[]; // alias for compatibility
  revenueByTour: BreakdownItem[];
  revenueByDestination: BreakdownItem[];
  bookingsBySource: Array<{
    source: string;
    count: number;
    revenueEur: number;
    percentage: number;
  }>;
  staffPerformance: StaffPerformanceItem[];
}

// 3. Customers Dashboard Metrics
export interface TopCustomerItem {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  country: string;
  hotel?: string | null;
  totalBookings: number;
  totalSpentEur: number;
  lastBookingDate?: string | null;
  status: 'VIP' | 'Regular' | 'New';
}

export interface InactiveCustomerItem {
  id: string;
  name: string;
  email: string;
  daysSinceLastBooking: number;
  lastBookingDate: string;
  totalSpentEur: number;
}

export interface PopularTourInterestItem {
  tourTitle: string;
  inquiriesCount: number;
  bookingsCount: number;
  totalGuests: number;
  sharePct: number;
}

export interface CustomerMetrics {
  totalCustomersCount: number;
  newCustomersCount: number;
  repeatCustomersCount: number;
  repeatRatePct: number;
  customerLifetimeValueEur: number;
  customerRetentionRatePct: number;
  inactiveCustomersCount: number;
  inactiveCustomers: InactiveCustomerItem[];
  countriesDistribution: Array<{
    country: string;
    count: number;
    percentage: number;
    revenueEur: number;
  }>;
  hotelsDistribution: Array<{
    hotel: string;
    count: number;
    percentage: number;
  }>;
  popularTourInterests: PopularTourInterestItem[];
  topCustomers: TopCustomerItem[];
}

// 4. Operations Dashboard Metrics
export interface VesselUtilizationItem {
  vesselId: string;
  vesselName: string;
  vesselType: string;
  maxCapacity: number;
  tripsCount: number;
  passengersCarried: number;
  utilizationPct: number;
}

export interface GuideAssignmentItem {
  guideId: string;
  guideName: string;
  assignedCount: number;
  hoursLogged: number;
}

export interface OperationalIssueItem {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  category: string;
  title: string;
  description: string;
  timestamp: string;
}

export interface OperationsMetrics {
  departuresCount: number;
  passengerCounts: {
    adults: number;
    children: number;
    infants: number;
    total: number;
  };
  capacityUtilizationPct: number;
  cancellationsCount: number;
  cancellationRatePct: number;
  noShowsCount: number;
  pickupDistribution: Array<{
    locationName: string;
    area: string;
    guestsCount: number;
    percentage: number;
  }>;
  vesselUtilization: VesselUtilizationItem[];
  guideAssignments: {
    totalAssignments: number;
    assignedTours: number;
    unassignedTours: number;
    activeGuidesCount: number;
    guides: GuideAssignmentItem[];
  };
  operationalIssues: OperationalIssueItem[];
}

// 5. Finance Dashboard Metrics
export interface PaymentMethodBreakdown {
  method: string;
  amountEur: number;
  count: number;
  percentage: number;
}

export interface MonthlyRevenueItem {
  month: string; // "Jan 2026"
  grossEur: number;
  paidEur: number;
  refundsEur: number;
  netEur: number;
  bookingsCount: number;
}

export interface FinanceMetrics {
  grossRevenueEur: number; // Contracted Gross Total
  revenueEur: number; // alias
  collectedPaymentsEur: number; // Actually Collected
  paidEur: number; // alias
  outstandingEur: number; // Pending / Pier Balances
  refundsEur: number; // Processed Refunds
  netRevenueEur: number; // Gross - Refunds (or Paid - Refunds)
  discountsEur: number; // Promotional Discounts
  collectionRatePct: number; // % Collected of Net Due
  paymentMethods: PaymentMethodBreakdown[];
  monthlyRevenue: MonthlyRevenueItem[];
  currencyBreakdown: Array<{
    currency: string;
    amount: number;
    convertedEur: number;
  }>;
}

// 6. Report Builder Types
export interface ReportBuilderFilters {
  startDate?: string;
  endDate?: string;
  tourId: string;
  destination: string;
  customerQuery: string;
  staffName: string;
  bookingStatus: string;
  paymentStatus: string;
  leadSource: string;
}

export interface ReportBuilderRow {
  bookingId: string;
  bookingReference: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  tourTitle: string;
  destination: string;
  bookingDate: string;
  travelDate?: string;
  totalGuests: number;
  subtotal: number;
  discount: number;
  total: number;
  currency: string;
  bookingStatus: string;
  paymentStatus: string;
  paymentMethod: string;
  leadSource: string;
  staffName: string;
  createdAt: string;
}
