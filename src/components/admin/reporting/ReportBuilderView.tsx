import React, { useState, useEffect, useMemo } from 'react';
import {
  Filter,
  Download,
  Printer,
  RefreshCw,
  Search,
  Calendar,
  Compass,
  MapPin,
  Users,
  CreditCard,
  FileSpreadsheet,
  CheckCircle2,
  FileText,
  X,
  ChevronDown,
} from 'lucide-react';
import { ReportBuilderFilters, ReportBuilderRow } from '../../../types/reporting';
import { runReportBuilder, exportReportToCsv } from '../../../services/reportingService';
import { ALL_TOURS } from '../../../data/toursData';
import { Tour } from '../../../types';
import { getPublishedTours } from '../../../services/tourService';
import { useToast } from '../../../contexts/ToastContext';

interface ReportBuilderViewProps {
  onNavigateTab?: (tabId: string, param?: string) => void;
}

export const ReportBuilderView: React.FC<ReportBuilderViewProps> = ({ onNavigateTab }) => {
  const { showToast } = useToast();

  // Filters State
  const [filters, setFilters] = useState<ReportBuilderFilters>({
    startDate: '',
    endDate: '',
    tourId: 'all',
    destination: 'all',
    customerQuery: '',
    staffName: 'all',
    bookingStatus: 'all',
    paymentStatus: 'all',
    leadSource: 'all',
  });

  const [rows, setRows] = useState<ReportBuilderRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [tours, setTours] = useState<Tour[]>(ALL_TOURS);

  useEffect(() => {
    let isMounted = true;
    getPublishedTours()
      .then((res) => {
        if (isMounted && res && res.length > 0) {
          setTours(res);
        }
      })
      .catch((err) => {
        console.warn('Could not load dynamic tours for ReportBuilder, falling back to static list:', err);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Available unique options for dropdowns
  const availableDestinations = useMemo(() => {
    const set = new Set<string>();
    (tours.length > 0 ? tours : ALL_TOURS).forEach((t) => {
      if (t.destination) set.add(t.destination);
    });
    return Array.from(set);
  }, [tours]);

  const availableStaff = ['Ahmed Hassan', 'Mariam Youssef', 'Karim Adel', 'Sara Mostafa'];
  const availableLeadSources = ['Website', 'WhatsApp', 'Hotel', 'Referral', 'Walk-in', 'Phone', 'Social Media'];

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await runReportBuilder(filters);
      setRows(data);
    } catch (err) {
      console.error('Failed to run report builder query:', err);
      showToast('Could not load report builder results', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [
    filters.startDate,
    filters.endDate,
    filters.tourId,
    filters.destination,
    filters.customerQuery,
    filters.staffName,
    filters.bookingStatus,
    filters.paymentStatus,
    filters.leadSource,
  ]);

  // Summary KPI Totals for the current filtered rows
  const summaryTotals = useMemo(() => {
    let grossTotal = 0;
    let totalGuests = 0;
    let paidCount = 0;

    rows.forEach((r) => {
      grossTotal += r.total;
      totalGuests += r.totalGuests;
      if (r.paymentStatus === 'paid') paidCount++;
    });

    return {
      count: rows.length,
      grossTotal,
      totalGuests,
      paidCount,
      collectionPct: rows.length > 0 ? Math.round((paidCount / rows.length) * 100) : 0,
    };
  }, [rows]);

  // CSV Export Handler
  const handleExportCsv = () => {
    setIsExporting(true);
    try {
      const title = `CUSTOM_BUSINESS_REPORT_${new Date().toISOString().split('T')[0]}`;
      const headers = [
        'Booking Ref',
        'Customer Name',
        'Customer Email',
        'Phone',
        'Excursion Tour',
        'Destination',
        'Tour Date',
        'Guests',
        'Subtotal (EUR)',
        'Discount (EUR)',
        'Total (EUR)',
        'Booking Status',
        'Payment Status',
        'Payment Method',
        'Lead Source',
        'Assigned Staff',
        'Placed At',
      ];

      const csvRows = rows.map((r) => [
        r.bookingReference,
        r.customerName,
        r.customerEmail,
        r.customerPhone || '',
        r.tourTitle,
        r.destination,
        r.bookingDate,
        r.totalGuests,
        r.subtotal,
        r.discount,
        r.total,
        r.bookingStatus,
        r.paymentStatus,
        r.paymentMethod,
        r.leadSource,
        r.staffName,
        r.createdAt,
      ]);

      exportReportToCsv(title, headers, csvRows);
      showToast(`Exported ${rows.length} rows to CSV`, 'success');
    } catch {
      showToast('Failed to export CSV', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  // Secure print formatting handler
  const handlePrint = () => {
    window.print();
  };

  const handleResetFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      tourId: 'all',
      destination: 'all',
      customerQuery: '',
      staffName: 'all',
      bookingStatus: 'all',
      paymentStatus: 'all',
      leadSource: 'all',
    });
  };

  const hasActiveFilters =
    Boolean(filters.startDate) ||
    Boolean(filters.endDate) ||
    filters.tourId !== 'all' ||
    filters.destination !== 'all' ||
    Boolean(filters.customerQuery) ||
    filters.staffName !== 'all' ||
    filters.bookingStatus !== 'all' ||
    filters.paymentStatus !== 'all' ||
    filters.leadSource !== 'all';

  return (
    <div className="space-y-6 print:space-y-4 print:text-black print:bg-white">
      {/* Filters Form Container */}
      <div className="bg-white dark:bg-[#111E2E] border border-[#E8E3DA] dark:border-[#1F3854] rounded-2xl p-5 lg:p-6 shadow-xs space-y-4 print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E8E3DA] dark:border-[#1F3854] pb-3.5">
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-[#0A6C74] dark:text-[#2DD4BF]" />
            <h2 className="text-sm font-bold text-[#0E1B2A] dark:text-white uppercase tracking-wider font-display">
              Custom Multi-Dimensional Report Builder
            </h2>
          </div>
          <div className="flex items-center space-x-2">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-xs text-stone-500 hover:text-rose-600 flex items-center space-x-1 transition-colors px-2.5 py-1.5 rounded-xl bg-[#FAF8F5] dark:bg-stone-800 border border-[#E8E3DA] dark:border-stone-700"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reset Filters</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={isExporting || rows.length === 0}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-white dark:bg-[#16283D] hover:bg-[#FAF8F5] dark:hover:bg-[#1F3854] text-stone-700 dark:text-stone-200 rounded-xl text-xs font-semibold border border-[#E8E3DA] dark:border-[#1F3854] shadow-2xs hover:border-[#0A6C74]/40 transition-colors disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5 text-[#0A6C74] dark:text-[#2DD4BF]" />
              <span>Export CSV</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              disabled={rows.length === 0}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-white dark:bg-[#16283D] hover:bg-[#FAF8F5] dark:hover:bg-[#1F3854] text-stone-700 dark:text-stone-200 rounded-xl text-xs font-semibold border border-[#E8E3DA] dark:border-[#1F3854] shadow-2xs hover:border-[#0A6C74]/40 transition-colors disabled:opacity-50"
            >
              <Printer className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              <span>Print PDF</span>
            </button>
          </div>
        </div>

        {/* Filters Matrix (8 Dimensional Filters) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          {/* 1. Date Range: Start */}
          <div>
            <label className="block text-stone-600 dark:text-stone-400 font-medium mb-1">Date Range (From)</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters((prev) => ({ ...prev, startDate: e.target.value }))}
              className="w-full bg-[#FAF8F5] dark:bg-[#0A1118] border border-[#E8E3DA] dark:border-[#1F3854] rounded-xl px-2.5 py-1.5 text-[#0E1B2A] dark:text-white focus:outline-none focus:border-[#0A6C74] font-mono"
            />
          </div>

          {/* 1. Date Range: End */}
          <div>
            <label className="block text-stone-600 dark:text-stone-400 font-medium mb-1">Date Range (To)</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters((prev) => ({ ...prev, endDate: e.target.value }))}
              className="w-full bg-[#FAF8F5] dark:bg-[#0A1118] border border-[#E8E3DA] dark:border-[#1F3854] rounded-xl px-2.5 py-1.5 text-[#0E1B2A] dark:text-white focus:outline-none focus:border-[#0A6C74] font-mono"
            />
          </div>

          {/* 2. Tour Filter */}
          <div>
            <label className="block text-stone-600 dark:text-stone-400 font-medium mb-1">Excursion Tour</label>
            <select
              value={filters.tourId}
              onChange={(e) => setFilters((prev) => ({ ...prev, tourId: e.target.value }))}
              className="w-full bg-[#FAF8F5] dark:bg-[#0A1118] border border-[#E8E3DA] dark:border-[#1F3854] rounded-xl px-2.5 py-1.5 text-[#0E1B2A] dark:text-white focus:outline-none focus:border-[#0A6C74]"
            >
              <option value="all">All Tours &amp; Excursions</option>
              {(tours.length > 0 ? tours : ALL_TOURS).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Destination Filter */}
          <div>
            <label className="block text-stone-600 dark:text-stone-400 font-medium mb-1">Destination Market</label>
            <select
              value={filters.destination}
              onChange={(e) => setFilters((prev) => ({ ...prev, destination: e.target.value }))}
              className="w-full bg-[#FAF8F5] dark:bg-[#0A1118] border border-[#E8E3DA] dark:border-[#1F3854] rounded-xl px-2.5 py-1.5 text-[#0E1B2A] dark:text-white focus:outline-none focus:border-[#0A6C74]"
            >
              <option value="all">All Destinations</option>
              {availableDestinations.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Customer Query */}
          <div>
            <label className="block text-stone-600 dark:text-stone-400 font-medium mb-1">Customer / Reference</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-stone-400" />
              <input
                type="text"
                placeholder="Name, email, or ref..."
                value={filters.customerQuery}
                onChange={(e) => setFilters((prev) => ({ ...prev, customerQuery: e.target.value }))}
                className="w-full bg-[#FAF8F5] dark:bg-[#0A1118] border border-[#E8E3DA] dark:border-[#1F3854] rounded-xl pl-8 pr-2.5 py-1.5 text-[#0E1B2A] dark:text-white placeholder-stone-400 focus:outline-none focus:border-[#0A6C74]"
              />
            </div>
          </div>

          {/* 5. Staff Filter */}
          <div>
            <label className="block text-stone-600 dark:text-stone-400 font-medium mb-1">Assigned Staff</label>
            <select
              value={filters.staffName}
              onChange={(e) => setFilters((prev) => ({ ...prev, staffName: e.target.value }))}
              className="w-full bg-[#FAF8F5] dark:bg-[#0A1118] border border-[#E8E3DA] dark:border-[#1F3854] rounded-xl px-2.5 py-1.5 text-[#0E1B2A] dark:text-white focus:outline-none focus:border-[#0A6C74]"
            >
              <option value="all">All Staff Members</option>
              {availableStaff.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* 6. Booking Status */}
          <div>
            <label className="block text-stone-600 dark:text-stone-400 font-medium mb-1">Booking Status</label>
            <select
              value={filters.bookingStatus}
              onChange={(e) => setFilters((prev) => ({ ...prev, bookingStatus: e.target.value }))}
              className="w-full bg-[#FAF8F5] dark:bg-[#0A1118] border border-[#E8E3DA] dark:border-[#1F3854] rounded-xl px-2.5 py-1.5 text-[#0E1B2A] dark:text-white focus:outline-none focus:border-[#0A6C74]"
            >
              <option value="all">All Statuses</option>
              <option value="confirmed">Confirmed</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="no_show">No Show</option>
            </select>
          </div>

          {/* 7. Payment Status & Lead Source */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-stone-600 dark:text-stone-400 font-medium mb-1">Payment</label>
              <select
                value={filters.paymentStatus}
                onChange={(e) => setFilters((prev) => ({ ...prev, paymentStatus: e.target.value }))}
                className="w-full bg-[#FAF8F5] dark:bg-[#0A1118] border border-[#E8E3DA] dark:border-[#1F3854] rounded-xl px-2 py-1.5 text-[#0E1B2A] dark:text-white focus:outline-none focus:border-[#0A6C74]"
              >
                <option value="all">All</option>
                <option value="paid">Paid</option>
                <option value="partially_paid">Partially Paid</option>
                <option value="pending">Pending</option>
                <option value="refunded">Refunded</option>
              </select>
            </div>
            <div>
              <label className="block text-stone-600 dark:text-stone-400 font-medium mb-1">Lead Source</label>
              <select
                value={filters.leadSource}
                onChange={(e) => setFilters((prev) => ({ ...prev, leadSource: e.target.value }))}
                className="w-full bg-[#FAF8F5] dark:bg-[#0A1118] border border-[#E8E3DA] dark:border-[#1F3854] rounded-xl px-2 py-1.5 text-[#0E1B2A] dark:text-white focus:outline-none focus:border-[#0A6C74]"
              >
                <option value="all">All</option>
                {availableLeadSources.map((ls) => (
                  <option key={ls} value={ls}>
                    {ls}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Summary KPI Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 print:grid-cols-4">
        <div className="bg-white dark:bg-[#111E2E] border border-[#E8E3DA] dark:border-[#1F3854] rounded-2xl p-5 shadow-xs hover:border-[#0A6C74]/50 transition-colors print:bg-stone-100 print:border-stone-300">
          <span className="text-[11px] text-stone-500 dark:text-stone-400 font-medium print:text-stone-700">Matching Bookings</span>
          <div className="text-xl font-bold text-[#0E1B2A] dark:text-white mt-1 font-mono print:text-black">
            {summaryTotals.count}
          </div>
        </div>
        <div className="bg-white dark:bg-[#111E2E] border border-[#E8E3DA] dark:border-[#1F3854] rounded-2xl p-5 shadow-xs hover:border-[#0A6C74]/50 transition-colors print:bg-stone-100 print:border-stone-300">
          <span className="text-[11px] text-stone-500 dark:text-stone-400 font-medium print:text-stone-700">Gross Contracted Total</span>
          <div className="text-xl font-bold text-[#0A6C74] dark:text-[#2DD4BF] mt-1 font-mono print:text-black">
            €{summaryTotals.grossTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <div className="bg-white dark:bg-[#111E2E] border border-[#E8E3DA] dark:border-[#1F3854] rounded-2xl p-5 shadow-xs hover:border-sky-500/50 transition-colors print:bg-stone-100 print:border-stone-300">
          <span className="text-[11px] text-stone-500 dark:text-stone-400 font-medium print:text-stone-700">Total Guests Manifested</span>
          <div className="text-xl font-bold text-sky-600 dark:text-sky-400 mt-1 font-mono print:text-black">
            {summaryTotals.totalGuests} pax
          </div>
        </div>
        <div className="bg-white dark:bg-[#111E2E] border border-[#E8E3DA] dark:border-[#1F3854] rounded-2xl p-5 shadow-xs hover:border-emerald-500/50 transition-colors print:bg-stone-100 print:border-stone-300">
          <span className="text-[11px] text-stone-500 dark:text-stone-400 font-medium print:text-stone-700">Full Settlement Rate</span>
          <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 font-mono print:text-black">
            {summaryTotals.collectionPct}% Paid
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white dark:bg-[#111E2E] border border-[#E8E3DA] dark:border-[#1F3854] rounded-2xl shadow-xs overflow-hidden print:border-none print:shadow-none">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-stone-700 dark:text-stone-300 print:text-black">
            <thead className="bg-[#FAF8F5] dark:bg-[#0E1B2A] text-stone-600 dark:text-stone-300 uppercase text-[10px] font-semibold border-b border-[#E8E3DA] dark:border-[#1F3854] print:bg-stone-200 print:text-black print:border-stone-400">
              <tr>
                <th className="py-3 px-3.5">Reference</th>
                <th className="py-3 px-3.5">Customer &amp; Contact</th>
                <th className="py-3 px-3.5">Excursion Tour</th>
                <th className="py-3 px-3.5">Date</th>
                <th className="py-3 px-3.5 text-center">Pax</th>
                <th className="py-3 px-3.5 text-right">Total</th>
                <th className="py-3 px-3.5 text-center">Booking Status</th>
                <th className="py-3 px-3.5 text-center">Payment</th>
                <th className="py-3 px-3.5">Lead Source</th>
                <th className="py-3 px-3.5">Staff</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8E3DA]/80 dark:divide-[#1F3854]/80 font-medium print:divide-stone-300">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-stone-500 dark:text-stone-400">
                    <RefreshCw className="w-5 h-5 mx-auto mb-2 animate-spin text-[#0A6C74] dark:text-[#2DD4BF]" />
                    Querying records with database filters...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-stone-400">
                    No records found matching the selected filter parameters.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.bookingId} className="hover:bg-[#FAF8F5]/80 dark:hover:bg-[#16283D]/60 transition-colors">
                    <td className="py-3 px-3.5 font-mono font-bold text-[#0E1B2A] dark:text-white print:text-black">
                      {row.bookingReference}
                    </td>
                    <td className="py-3 px-3.5">
                      <div className="font-semibold text-[#0E1B2A] dark:text-white print:text-black">{row.customerName}</div>
                      <div className="text-[11px] text-stone-500 dark:text-stone-400 print:text-stone-600">{row.customerEmail}</div>
                    </td>
                    <td className="py-3 px-3.5">
                      <div className="text-[#0E1B2A] dark:text-white truncate max-w-[200px] print:text-black">{row.tourTitle}</div>
                      <div className="text-[10px] text-stone-500 dark:text-stone-400">{row.destination}</div>
                    </td>
                    <td className="py-3 px-3.5 font-mono text-stone-600 dark:text-stone-300 whitespace-nowrap">
                      {row.bookingDate}
                    </td>
                    <td className="py-3 px-3.5 text-center font-bold text-[#0E1B2A] dark:text-white print:text-black">
                      {row.totalGuests}
                    </td>
                    <td className="py-3 px-3.5 text-right font-mono font-bold text-[#0A6C74] dark:text-[#2DD4BF] print:text-black">
                      €{row.total.toFixed(2)}
                    </td>
                    <td className="py-3 px-3.5 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          row.bookingStatus === 'confirmed' || row.bookingStatus === 'completed'
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20'
                            : row.bookingStatus === 'cancelled'
                            ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20'
                            : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20'
                        }`}
                      >
                        {row.bookingStatus}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          row.paymentStatus === 'paid'
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20'
                            : row.paymentStatus === 'partially_paid'
                            ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20'
                            : row.paymentStatus === 'refunded'
                            ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20'
                            : 'bg-[#FAF8F5] dark:bg-stone-800 text-stone-600 dark:text-stone-400 border border-[#E8E3DA] dark:border-stone-700'
                        }`}
                      >
                        {row.paymentStatus}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 text-stone-600 dark:text-stone-300">
                      <span className="px-1.5 py-0.5 bg-[#FAF8F5] dark:bg-[#0E1B2A] rounded border border-[#E8E3DA] dark:border-[#1F3854] text-[10px]">
                        {row.leadSource}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 text-stone-600 dark:text-stone-300 truncate max-w-[140px]">
                      {row.staffName}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
