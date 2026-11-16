import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard,
  TrendingUp,
  Anchor,
  Users,
  CreditCard,
  Calendar,
  Download,
  Printer,
  RefreshCw,
  FileSpreadsheet,
  FileText,
  Clock,
  CheckCircle2,
  Filter,
  ChevronDown,
  Check,
} from 'lucide-react';
import {
  DashboardViewMode,
  ReportDateRangeType,
  DateRangeInterval,
  ExecutiveMetrics,
  SalesMetrics,
  CustomerMetrics,
  OperationsMetrics,
  FinanceMetrics,
} from '../../../types/reporting';
import {
  getDateRangeInterval,
  fetchExecutiveReport,
  fetchSalesReport,
  fetchCustomerReport,
  fetchOperationsReport,
  fetchFinanceReport,
  exportReportToCsv,
  exportReportToExcel,
  printManagementReport,
} from '../../../services/reportingService';
import { ExecutiveDashboardView } from './ExecutiveDashboardView';
import { SalesDashboardView } from './SalesDashboardView';
import { OperationsDashboardView } from './OperationsDashboardView';
import { CustomerDashboardView } from './CustomerDashboardView';
import { FinanceDashboardView } from './FinanceDashboardView';
import { ReportBuilderView } from './ReportBuilderView';
import { useToast } from '../../../contexts/ToastContext';
import { AdminTab } from '../AdminLayout';

interface ManagementReportingDashboardProps {
  onNavigateTab: (tab: AdminTab, param?: string) => void;
  onPreviewTour?: (slug: string) => void;
  initialViewMode?: DashboardViewMode;
}

export const ManagementReportingDashboard: React.FC<ManagementReportingDashboardProps> = ({
  onNavigateTab,
  onPreviewTour,
  initialViewMode = 'executive',
}) => {
  const { showToast } = useToast();

  const [activeView, setActiveView] = useState<DashboardViewMode>(initialViewMode);
  const [isSectionMenuOpen, setIsSectionMenuOpen] = useState(false);
  const [dateRange, setDateRange] = useState<ReportDateRangeType>('this_month');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Loaded Metrics Data
  const [executiveData, setExecutiveData] = useState<ExecutiveMetrics | null>(null);
  const [salesData, setSalesData] = useState<SalesMetrics | null>(null);
  const [customerData, setCustomerData] = useState<CustomerMetrics | null>(null);
  const [operationsData, setOperationsData] = useState<OperationsMetrics | null>(null);
  const [financeData, setFinanceData] = useState<FinanceMetrics | null>(null);
  // Keep previously loaded metrics visible while the same report/date range refreshes.
  // This avoids replacing a usable dashboard with a full-page loading state on tab revisits.
  const loadedReportKeys = React.useRef<Set<string>>(new Set());

  const currentInterval: DateRangeInterval = getDateRangeInterval(
    dateRange,
    customStartDate,
    customEndDate
  );

  const loadData = useCallback(async () => {
    if (activeView === 'builder') {
      setLoading(false);
      setIsRefreshing(false);
      return;
    }

    const reportKey = `${activeView}:${currentInterval.startDate}:${currentInterval.endDate}`;
    setLoading(!loadedReportKeys.current.has(reportKey));
    try {
      if (activeView === 'executive') {
        const data = await fetchExecutiveReport(currentInterval);
        setExecutiveData(data);
      } else if (activeView === 'sales') {
        const data = await fetchSalesReport(currentInterval);
        setSalesData(data);
      } else if (activeView === 'customers') {
        const data = await fetchCustomerReport(currentInterval);
        setCustomerData(data);
      } else if (activeView === 'operations') {
        const data = await fetchOperationsReport(currentInterval);
        setOperationsData(data);
      } else if (activeView === 'finance') {
        const data = await fetchFinanceReport(currentInterval);
        setFinanceData(data);
      }
      loadedReportKeys.current.add(reportKey);
    } catch (err) {
      console.error('Failed to query reporting metrics:', err);
      showToast('Could not refresh report data from Supabase', 'error');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [activeView, dateRange, customStartDate, customEndDate, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  // Export handlers
  const handleExportCsv = () => {
    const title = `${activeView.toUpperCase()}_REPORT_${currentInterval.startDate}_TO_${currentInterval.endDate}`;

    if (activeView === 'executive' && executiveData) {
      const headers = ['Metric', 'Value', 'Unit / Currency'];
      const rows = [
        ['Total Gross Revenue', executiveData.totalRevenueEur, 'EUR'],
        ['Net Collected Revenue', executiveData.collectedRevenueEur, 'EUR'],
        ['Outstanding Revenue', executiveData.outstandingRevenueEur, 'EUR'],
        ['Total Bookings Placed', executiveData.bookingsCount, 'Count'],
        ['Confirmed Bookings', executiveData.confirmedBookingsCount, 'Count'],
        ['Cancellations', executiveData.cancellationsCount, 'Count'],
        ['Total Customers', executiveData.totalCustomersCount, 'Count'],
        ['New Customers', executiveData.newCustomersCount, 'Count'],
        ['Repeat Customers', executiveData.repeatCustomersCount, 'Count'],
        ['Sales Leads', executiveData.leadsCount, 'Count'],
        ['Conversion Rate', `${executiveData.conversionRate}%`, 'Percentage'],
        ['Cancellation Rate', `${executiveData.cancellationRate}%`, 'Percentage'],
        ['Average Booking Value', executiveData.averageBookingValueEur, 'EUR'],
        ['Passengers Carried', executiveData.passengersCount, 'Count'],
        ['Adults', executiveData.adultsCount, 'Count'],
        ['Children', executiveData.childrenCount, 'Count'],
        ['Infants', executiveData.infantsCount, 'Count'],
      ];
      exportReportToCsv(title, headers, rows);
    } else if (activeView === 'sales' && salesData) {
      const headers = ['Tour / Excursion Name', 'Bookings Count', 'Revenue (EUR)', 'Share (%)'];
      const rows = salesData.bestSellingTours.map((t) => [
        t.name,
        t.count,
        t.revenueEur,
        `${t.percentage}%`,
      ]);
      exportReportToCsv(title, headers, rows);
    } else if (activeView === 'customers' && customerData) {
      const headers = ['Guest Name', 'Email', 'Country', 'Hotel', 'Bookings Count', 'Lifetime Spend (EUR)', 'Tier'];
      const rows = customerData.topCustomers.map((c) => [
        c.name,
        c.email,
        c.country,
        c.hotel || '',
        c.totalBookings,
        c.totalSpentEur,
        c.status,
      ]);
      exportReportToCsv(title, headers, rows);
    } else if (activeView === 'operations' && operationsData) {
      const headers = ['Vessel Name', 'Vessel Type', 'Max Capacity', 'Trips Deployed', 'Passengers Carried', 'Capacity Load (%)'];
      const rows = operationsData.vesselUtilization.map((v) => [
        v.vesselName,
        v.vesselType,
        v.maxCapacity,
        v.tripsCount,
        v.passengersCarried,
        `${v.utilizationPct}%`,
      ]);
      exportReportToCsv(title, headers, rows);
    } else if (activeView === 'finance' && financeData) {
      const headers = ['Payment Method', 'Amount (EUR)', 'Transactions Count', 'Share (%)'];
      const rows = financeData.paymentMethods.map((pm) => [
        pm.method,
        pm.amountEur,
        pm.count,
        `${pm.percentage}%`,
      ]);
      exportReportToCsv(title, headers, rows);
    }

    showToast('Report downloaded as CSV (UTF-8 Excel Compatible)', 'success');
  };

  const handleExportExcel = () => {
    const title = `${activeView.toUpperCase()}_REPORT_${currentInterval.startDate}_TO_${currentInterval.endDate}`;

    if (activeView === 'executive' && executiveData) {
      const headers = ['Metric', 'Value', 'Unit'];
      const rows = [
        ['Total Gross Revenue', `€${executiveData.totalRevenueEur.toFixed(2)}`, 'EUR'],
        ['Net Collected Revenue', `€${executiveData.collectedRevenueEur.toFixed(2)}`, 'EUR'],
        ['Outstanding Balances', `€${executiveData.outstandingRevenueEur.toFixed(2)}`, 'EUR'],
        ['Total Bookings Placed', executiveData.bookingsCount, 'Count'],
        ['Confirmed Bookings', executiveData.confirmedBookingsCount, 'Count'],
        ['Total Passengers', executiveData.passengersCount, 'Count'],
        ['New Customers', executiveData.newCustomersCount, 'Count'],
        ['Repeat Customers', executiveData.repeatCustomersCount, 'Count'],
        ['Conversion Rate', `${executiveData.conversionRate}%`, '%'],
        ['Cancellation Rate', `${executiveData.cancellationRate}%`, '%'],
      ];
      exportReportToExcel(title, headers, rows);
    } else {
      handleExportCsv();
    }
  };

  const handlePrint = () => {
    printManagementReport();
  };

  const viewTabs: Array<{ id: DashboardViewMode; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'executive', label: '1. Executive Dashboard', icon: LayoutDashboard },
    { id: 'sales', label: '2. Sales Dashboard', icon: TrendingUp },
    { id: 'operations', label: '3. Operations Dashboard', icon: Anchor },
    { id: 'customers', label: '4. Customer Dashboard', icon: Users },
    { id: 'finance', label: '5. Finance Dashboard', icon: CreditCard },
    { id: 'builder', label: '6. Report Builder', icon: Filter },
  ];

  return (
    <div className="space-y-6 print:space-y-4 print:text-black print:bg-white">
      {/* Header & Controls Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-[#111E2E] border border-[#E8E3DA] dark:border-[#1F3854] p-5 lg:p-6 rounded-2xl shadow-xs print:border-none print:shadow-none print:bg-transparent print:p-0">
        <div>
          <div className="flex items-center space-x-3.5">
            <div className="w-11 h-11 rounded-xl bg-[#0A6C74]/10 dark:bg-[#0A6C74]/20 border border-[#0A6C74]/20 flex items-center justify-center text-[#0A6C74] dark:text-[#2DD4BF] print:hidden shadow-2xs">
              <LayoutDashboard className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl lg:text-2xl font-bold font-display text-[#0E1B2A] dark:text-white tracking-tight print:text-black">
                Management Reporting &amp; Business Intelligence
              </h1>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 print:text-stone-700">
                Audited real-time intelligence querying live Supabase databases · Awesome Adventure Tours Operations
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons: Export & Refresh */}
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          {activeView !== 'builder' && (
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-white dark:bg-[#16283D] hover:bg-[#FAF8F5] dark:hover:bg-[#1F3854] text-stone-700 dark:text-stone-200 rounded-xl text-xs font-semibold border border-[#E8E3DA] dark:border-[#1F3854] shadow-2xs hover:border-[#0A6C74]/40 transition-colors"
              title="Refresh database metrics"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#0A6C74] dark:text-[#2DD4BF] ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          )}

          {activeView !== 'builder' && (
            <button
              type="button"
              onClick={handleExportCsv}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-white dark:bg-[#16283D] hover:bg-[#FAF8F5] dark:hover:bg-[#1F3854] text-stone-700 dark:text-stone-200 rounded-xl text-xs font-semibold border border-[#E8E3DA] dark:border-[#1F3854] shadow-2xs hover:border-[#0A6C74]/40 transition-colors"
              title="Download CSV"
            >
              <Download className="w-3.5 h-3.5 text-stone-500 dark:text-stone-400" />
              <span>Export CSV</span>
            </button>
          )}

          {activeView !== 'builder' && (
            <button
              type="button"
              onClick={handleExportExcel}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-white dark:bg-[#16283D] hover:bg-[#FAF8F5] dark:hover:bg-[#1F3854] text-stone-700 dark:text-stone-200 rounded-xl text-xs font-semibold border border-[#E8E3DA] dark:border-[#1F3854] shadow-2xs hover:border-[#0A6C74]/40 transition-colors"
              title="Download Excel Workbook"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Excel</span>
            </button>
          )}

          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-white dark:bg-[#16283D] hover:bg-[#FAF8F5] dark:hover:bg-[#1F3854] text-stone-700 dark:text-stone-200 rounded-xl text-xs font-semibold border border-[#E8E3DA] dark:border-[#1F3854] shadow-2xs hover:border-[#0A6C74]/40 transition-colors"
            title="Print Report"
          >
            <Printer className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
            <span>Print PDF</span>
          </button>
        </div>
      </div>

      {/* Compact dashboard section menu */}
      <div className="relative print:hidden">
        <button type="button" aria-haspopup="menu" aria-expanded={isSectionMenuOpen} onClick={() => setIsSectionMenuOpen((open) => !open)}
          className="inline-flex min-w-[240px] max-w-full items-center justify-between gap-4 rounded-xl border border-[#D8E2E3] dark:border-[#294653] bg-white dark:bg-[#111E2E] px-4 py-3 text-sm font-semibold text-[#0E1B2A] dark:text-white shadow-sm hover:border-[#0A6C74]/60 focus:outline-none focus:ring-2 focus:ring-[#0A6C74]/30">
          <span className="flex items-center gap-2.5">
            {React.createElement(viewTabs.find((tab) => tab.id === activeView)?.icon || LayoutDashboard, { className: 'w-4 h-4 text-[#0A6C74] dark:text-[#2DD4BF]' })}
            {viewTabs.find((tab) => tab.id === activeView)?.label.replace(/^\d+\.\s*/, '') || 'Executive Dashboard'}
          </span>
          <ChevronDown className={`w-4 h-4 text-stone-400 transition-transform ${isSectionMenuOpen ? 'rotate-180' : ''}`} />
        </button>
        {isSectionMenuOpen && <>
          <button type="button" aria-label="Close section menu" className="fixed inset-0 z-20 cursor-default" onClick={() => setIsSectionMenuOpen(false)} />
          <div role="menu" className="absolute left-0 top-full z-30 mt-2 w-full min-w-[260px] max-w-sm overflow-hidden rounded-2xl border border-[#E8E3DA] dark:border-[#294653] bg-white dark:bg-[#111E2E] p-1.5 shadow-xl">
            {viewTabs.map((tab) => { const Icon = tab.icon; const isActive = activeView === tab.id; return (
              <button key={tab.id} type="button" role="menuitem" onClick={() => { setActiveView(tab.id); setIsSectionMenuOpen(false); }}
                className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left text-sm transition-colors ${isActive ? 'bg-[#E8F3F4] dark:bg-[#0A6C74]/20 text-[#0A6C74] dark:text-[#2DD4BF] font-semibold' : 'text-stone-700 dark:text-stone-200 hover:bg-[#FAF8F5] dark:hover:bg-[#16283D]'}`}>
                <Icon className="h-4 w-4 shrink-0" /><span className="flex-1">{tab.label.replace(/^\d+\.\s*/, '')}</span>{isActive && <Check className="h-4 w-4" />}
              </button>
            ); })}
          </div>
        </>}
      </div>

      {/* Date Filter Bar (Shown for dashboards) */}
      {activeView !== 'builder' && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-[#111E2E] border border-[#E8E3DA] dark:border-[#1F3854] p-3.5 lg:p-4 rounded-2xl text-xs shadow-xs print:hidden">
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-[#0A6C74] dark:text-[#2DD4BF]" />
            <span className="font-semibold text-stone-700 dark:text-stone-200">Reporting Interval:</span>
            <span className="text-stone-500 dark:text-stone-400 font-mono font-medium">{currentInterval.label}</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'today', label: 'Today' },
                { id: 'yesterday', label: 'Yesterday' },
                { id: 'this_week', label: 'This Week' },
                { id: 'this_month', label: 'This Month' },
                { id: 'last_month', label: 'Last Month' },
                { id: 'this_year', label: 'This Year' },
                { id: 'custom', label: 'Custom' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setDateRange(opt.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  dateRange === opt.id
                    ? 'bg-[#0A6C74] text-white shadow-2xs font-semibold'
                    : 'text-stone-600 dark:text-stone-300 hover:text-[#0A6C74] hover:bg-[#FAF8F5] dark:hover:bg-[#16283D]'
                }`}
              >
                {opt.label}
              </button>
            ))}

            {dateRange === 'custom' && (
              <div className="flex items-center space-x-1.5 ml-2 border-l border-[#E8E3DA] dark:border-[#1F3854] pl-3">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="bg-[#FAF8F5] dark:bg-[#0A1118] border border-[#E8E3DA] dark:border-[#1F3854] rounded-lg px-2.5 py-1 text-[#0E1B2A] dark:text-white font-mono text-xs focus:outline-none focus:border-[#0A6C74]"
                />
                <span className="text-stone-400">to</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="bg-[#FAF8F5] dark:bg-[#0A1118] border border-[#E8E3DA] dark:border-[#1F3854] rounded-lg px-2.5 py-1 text-[#0E1B2A] dark:text-white font-mono text-xs focus:outline-none focus:border-[#0A6C74]"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Content Render */}
      {loading ? (
        <div className="bg-white dark:bg-[#111E2E] border border-[#E8E3DA] dark:border-[#1F3854] rounded-2xl p-16 text-center shadow-xs">
          <RefreshCw className="w-8 h-8 text-[#0A6C74] dark:text-[#2DD4BF] animate-spin mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-[#0E1B2A] dark:text-white font-display">Aggregating Database Records</h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">Executing mathematical operations across live bookings &amp; financial ledgers...</p>
        </div>
      ) : (
        <>
          {activeView === 'executive' && executiveData && (
            <ExecutiveDashboardView
              metrics={executiveData}
              interval={currentInterval}
              onNavigateTab={(tab) => onNavigateTab(tab as AdminTab)}
            />
          )}

          {activeView === 'sales' && salesData && (
            <SalesDashboardView
              metrics={salesData}
              interval={currentInterval}
              onNavigateTab={(tab) => onNavigateTab(tab as AdminTab)}
            />
          )}

          {activeView === 'operations' && operationsData && (
            <OperationsDashboardView
              metrics={operationsData}
              interval={currentInterval}
              onNavigateTab={(tab) => onNavigateTab(tab as AdminTab)}
            />
          )}

          {activeView === 'customers' && customerData && (
            <CustomerDashboardView
              metrics={customerData}
              interval={currentInterval}
              onNavigateTab={(tab) => onNavigateTab(tab as AdminTab)}
            />
          )}

          {activeView === 'finance' && financeData && (
            <FinanceDashboardView
              metrics={financeData}
              interval={currentInterval}
              onNavigateTab={(tab) => onNavigateTab(tab as AdminTab)}
            />
          )}

          {activeView === 'builder' && (
            <ReportBuilderView
              onNavigateTab={(tab) => onNavigateTab(tab as AdminTab)}
            />
          )}
        </>
      )}
    </div>
  );
};
