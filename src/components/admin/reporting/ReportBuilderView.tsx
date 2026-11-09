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
      <div className="bg-stone-900 border border-stone-800 rounded-xl p-5 shadow-lg space-y-4 print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-800 pb-3">
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-teal-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Custom Multi-Dimensional Report Builder
            </h2>
          </div>
          <div className="flex items-center space-x-2">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-xs text-stone-400 hover:text-rose-400 flex items-center space-x-1 transition-colors px-2 py-1 rounded bg-stone-800/80"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reset Filters</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={isExporting || rows.length === 0}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-lg text-xs font-semibold border border-stone-700 transition-colors disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5 text-teal-400" />
              <span>Export CSV</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              disabled={rows.length === 0}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-lg text-xs font-semibold border border-stone-700 transition-colors disabled:opacity-50"
            >
              <Printer className="w-3.5 h-3.5 text-sky-400" />
              <span>Print PDF</span>
            </button>
          </div>
        </div>

        {/* Filters Matrix (8 Dimensional Filters) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          {/* 1. Date Range: Start */}
          <div>
            <label className="block text-stone-400 font-medium mb-1">Date Range (From)</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters((prev) => ({ ...prev, startDate: e.target.value }))}
              className="w-full bg-stone-950 border border-stone-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-teal-500 font-mono"
            />
          </div>

          {/* 1. Date Range: End */}
          <div>
            <label className="block text-stone-400 font-medium mb-1">Date Range (To)</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters((prev) => ({ ...prev, endDate: e.target.value }))}
              className="w-full bg-stone-950 border border-stone-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-teal-500 font-mono"
            />
          </div>

          {/* 2. Tour Filter */}
          <div>
            <label className="block text-stone-400 font-medium mb-1">Excursion Tour</label>
            <select
              value={filters.tourId}
              onChange={(e) => setFilters((prev) => ({ ...prev, tourId: e.target.value }))}
              className="w-full bg-stone-950 border border-stone-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-teal-500"
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
            <label className="block text-stone-400 font-medium mb-1">Destination Market</label>
            <select
              value={filters.destination}
              onChange={(e) => setFilters((prev) => ({ ...prev, destination: e.target.value }))}
              className="w-full bg-stone-950 border border-stone-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-teal-500"
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
            <label className="block text-stone-400 font-medium mb-1">Customer / Reference</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-stone-500" />
              <input
                type="text"
                placeholder="Name, email, or ref..."
                value={filters.customerQuery}
                onChange={(e) => setFilters((prev) => ({ ...prev, customerQuery: e.target.value }))}
                className="w-full bg-stone-950 border border-stone-800 rounded-lg pl-8 pr-2.5 py-1.5 text-white placeholder-stone-600 focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>

          {/* 5. Staff Filter */}
          <div>
            <label className="block text-stone-400 font-medium mb-1">Assigned Staff</label>
            <select
              value={filters.staffName}
              onChange={(e) => setFilters((prev) => ({ ...prev, staffName: e.target.value }))}
              className="w-full bg-stone-950 border border-stone-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-teal-500"
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
            <label className="block text-stone-400 font-medium mb-1">Booking Status</label>
            <select
              value={filters.bookingStatus}
              onChange={(e) => setFilters((prev) => ({ ...prev, bookingStatus: e.target.value }))}
              className="w-full bg-stone-950 border border-stone-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-teal-500"
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
              <label className="block text-stone-400 font-medium mb-1">Payment</label>
              <select
                value={filters.paymentStatus}
                onChange={(e) => setFilters((prev) => ({ ...prev, paymentStatus: e.target.value }))}
                className="w-full bg-stone-950 border border-stone-800 rounded-lg px-2 py-1.5 text-white focus:outline-none focus:border-teal-500"
              >
                <option value="all">All</option>
                <option value="paid">Paid</option>
                <option value="partially_paid">Partially Paid</option>
                <option value="pending">Pending</option>
                <option value="refunded">Refunded</option>
              </select>
            </div>
            <div>
              <label className="block text-stone-400 font-medium mb-1">Lead Source</label>
              <select
                value={filters.leadSource}
                onChange={(e) => setFilters((prev) => ({ ...prev, leadSource: e.target.value }))}
                className="w-full bg-stone-950 border border-stone-800 rounded-lg px-2 py-1.5 text-white focus:outline-none focus:border-teal-500"
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
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-4 shadow print:bg-stone-100 print:border-stone-300">
          <span className="text-[11px] text-stone-400 font-medium print:text-stone-700">Matching Bookings</span>
          <div className="text-xl font-bold text-white mt-1 font-mono print:text-black">
            {summaryTotals.count}
          </div>
        </div>
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-4 shadow print:bg-stone-100 print:border-stone-300">
          <span className="text-[11px] text-stone-400 font-medium print:text-stone-700">Gross Contracted Total</span>
          <div className="text-xl font-bold text-teal-400 mt-1 font-mono print:text-black">
            €{summaryTotals.grossTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-4 shadow print:bg-stone-100 print:border-stone-300">
          <span className="text-[11px] text-stone-400 font-medium print:text-stone-700">Total Guests Manifested</span>
          <div className="text-xl font-bold text-sky-400 mt-1 font-mono print:text-black">
            {summaryTotals.totalGuests} pax
          </div>
        </div>
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-4 shadow print:bg-stone-100 print:border-stone-300">
          <span className="text-[11px] text-stone-400 font-medium print:text-stone-700">Full Settlement Rate</span>
          <div className="text-xl font-bold text-emerald-400 mt-1 font-mono print:text-black">
            {summaryTotals.collectionPct}% Paid
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-stone-900 border border-stone-800 rounded-xl shadow-lg overflow-hidden print:border-none print:shadow-none">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-stone-300 print:text-black">
            <thead className="bg-stone-950 text-stone-400 uppercase text-[10px] font-semibold border-b border-stone-800 print:bg-stone-200 print:text-black print:border-stone-400">
              <tr>
                <th className="py-3 px-3">Reference</th>
                <th className="py-3 px-3">Customer &amp; Contact</th>
                <th className="py-3 px-3">Excursion Tour</th>
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3 text-center">Pax</th>
                <th className="py-3 px-3 text-right">Total</th>
                <th className="py-3 px-3 text-center">Booking Status</th>
                <th className="py-3 px-3 text-center">Payment</th>
                <th className="py-3 px-3">Lead Source</th>
                <th className="py-3 px-3">Staff</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/60 font-medium print:divide-stone-300">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-stone-400">
                    <RefreshCw className="w-5 h-5 mx-auto mb-2 animate-spin text-teal-400" />
                    Querying records with database filters...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-stone-500">
                    No records found matching the selected filter parameters.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.bookingId} className="hover:bg-stone-800/40 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-bold text-white print:text-black">
                      {row.bookingReference}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-white print:text-black">{row.customerName}</div>
                      <div className="text-[11px] text-stone-400 print:text-stone-600">{row.customerEmail}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="text-white truncate max-w-[200px] print:text-black">{row.tourTitle}</div>
                      <div className="text-[10px] text-stone-500">{row.destination}</div>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-stone-300 whitespace-nowrap">
                      {row.bookingDate}
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold text-white print:text-black">
                      {row.totalGuests}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-teal-400 print:text-black">
                      €{row.total.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          row.bookingStatus === 'confirmed' || row.bookingStatus === 'completed'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : row.bookingStatus === 'cancelled'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {row.bookingStatus}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          row.paymentStatus === 'paid'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : row.paymentStatus === 'partially_paid'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : row.paymentStatus === 'refunded'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : 'bg-stone-800 text-stone-400'
                        }`}
                      >
                        {row.paymentStatus}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-stone-300">
                      <span className="px-1.5 py-0.5 bg-stone-950 rounded border border-stone-800 text-[10px]">
                        {row.leadSource}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-stone-300 truncate max-w-[140px]">
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
