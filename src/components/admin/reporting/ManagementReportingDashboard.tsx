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

    setLoading(true);
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
        ['Collected Revenue', executiveData.collectedRevenueEur, 'EUR'],
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
        ['Collected Revenue', `€${executiveData.collectedRevenueEur.toFixed(2)}`, 'EUR'],
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
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-stone-900 border border-stone-800 p-5 rounded-xl shadow-lg print:border-none print:shadow-none print:bg-transparent print:p-0">
        <div>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 print:hidden">
              <LayoutDashboard className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl lg:text-2xl font-bold font-display text-white tracking-tight print:text-black">
                Management Reporting &amp; Business Intelligence
              </h1>
              <p className="text-xs text-stone-400 mt-0.5 print:text-stone-700">
                Audited real-time intelligence querying live Supabase databases · Red Sea Voyages S.A.E.
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
              className="flex items-center space-x-1.5 px-3 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-lg text-xs font-semibold border border-stone-700 transition-colors"
              title="Refresh database metrics"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-teal-400 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          )}

          {activeView !== 'builder' && (
            <button
              type="button"
              onClick={handleExportCsv}
              className="flex items-center space-x-1.5 px-3 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-lg text-xs font-semibold border border-stone-700 transition-colors"
              title="Download CSV"
            >
              <Download className="w-3.5 h-3.5 text-stone-400" />
              <span>Export CSV</span>
            </button>
          )}

          {activeView !== 'builder' && (
            <button
              type="button"
              onClick={handleExportExcel}
              className="flex items-center space-x-1.5 px-3 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-lg text-xs font-semibold border border-stone-700 transition-colors"
              title="Download Excel Workbook"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Excel</span>
            </button>
          )}

          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center space-x-1.5 px-3 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-lg text-xs font-semibold border border-stone-700 transition-colors"
            title="Print Report"
          >
            <Printer className="w-3.5 h-3.5 text-sky-400" />
            <span>Print PDF</span>
          </button>
        </div>
      </div>

      {/* View Switcher Tabs (6 Views including Report Builder) */}
      <div className="flex items-center space-x-1 overflow-x-auto pb-1 bg-stone-950 p-1.5 rounded-xl border border-stone-800 text-xs print:hidden">
        {viewTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeView === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveView(tab.id)}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg font-semibold transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-teal-600 text-white shadow-md'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900/60'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-stone-500'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Date Filter Bar (Shown for dashboards) */}
      {activeView !== 'builder' && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-stone-900/90 border border-stone-800 p-3.5 rounded-xl text-xs print:hidden">
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-teal-400" />
            <span className="font-semibold text-stone-300">Reporting Interval:</span>
            <span className="text-stone-400 font-mono">{currentInterval.label}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
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
                className={`px-2.5 py-1.5 rounded-md font-medium transition-colors ${
                  dateRange === opt.id
                    ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                    : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800'
                }`}
              >
                {opt.label}
              </button>
            ))}

            {dateRange === 'custom' && (
              <div className="flex items-center space-x-1.5 ml-2 border-l border-stone-800 pl-3">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="bg-stone-950 border border-stone-800 rounded px-2 py-1 text-white font-mono text-xs focus:outline-none focus:border-teal-500"
                />
                <span className="text-stone-500">to</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="bg-stone-950 border border-stone-800 rounded px-2 py-1 text-white font-mono text-xs focus:outline-none focus:border-teal-500"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Content Render */}
      {loading ? (
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-16 text-center shadow-lg">
          <RefreshCw className="w-8 h-8 text-teal-400 animate-spin mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-white">Aggregating Database Records</h3>
          <p className="text-xs text-stone-400 mt-1">Executing mathematical operations across live bookings &amp; financial ledgers...</p>
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
