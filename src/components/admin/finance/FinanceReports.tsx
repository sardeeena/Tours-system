import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  Calendar,
  Compass,
  MapPin,
  CreditCard,
  RotateCcw,
  Tag,
  AlertCircle,
  Download,
  RefreshCw,
  FileSpreadsheet,
  CheckCircle2,
  Filter,
} from 'lucide-react';
import {
  getFinancialReports,
  getOutstandingBalances,
  listRefunds,
  listPayments,
} from '../../../services/financeService';
import { FinancialReportData, OutstandingBalanceItem, FinanceRefund, FinancePayment } from '../../../types/finance';
import { Tour } from '../../../types';
import { ALL_TOURS } from '../../../data/toursData';
import { getPublishedTours } from '../../../services/tourService';
import { useToast } from '../../../contexts/ToastContext';

type ReportTab =
  | 'by_date'
  | 'by_tour'
  | 'by_destination'
  | 'payments_received'
  | 'outstanding_aging'
  | 'refunds_disputes';

export const FinanceReports: React.FC = () => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<ReportTab>('by_date');
  const [selectedCurrency, setSelectedCurrency] = useState<string>('EUR');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [tourFilter, setTourFilter] = useState<string>('all');
  const [destinationFilter, setDestinationFilter] = useState<string>('all');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [report, setReport] = useState<FinancialReportData | null>(null);
  const [balances, setBalances] = useState<OutstandingBalanceItem[]>([]);
  const [payments, setPayments] = useState<FinancePayment[]>([]);
  const [tours, setTours] = useState<Tour[]>(ALL_TOURS);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [rData, bData, pData, loadedTours] = await Promise.all([
        getFinancialReports(
          selectedCurrency,
          startDate && endDate ? { start: startDate, end: endDate } : undefined
        ),
        getOutstandingBalances(),
        listPayments(),
        getPublishedTours().catch(() => []),
      ]);
      setReport(rData);
      setBalances(bData);
      setPayments(pData);
      if (loadedTours && loadedTours.length > 0) {
        setTours(loadedTours);
      }
    } catch (err) {
      console.warn('Failed to load financial reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedCurrency, startDate, endDate]);

  const currencySymbol =
    selectedCurrency === 'EUR' ? '€' : selectedCurrency === 'USD' ? '$' : selectedCurrency === 'GBP' ? '£' : 'EGP ';

  // Filtered views based on user filters
  const filteredRevenueByTour = useMemo(() => {
    if (!report?.revenueByTour) return [];
    return report.revenueByTour.filter((t) => {
      if (tourFilter !== 'all' && t.tourId !== tourFilter) return false;
      return true;
    });
  }, [report, tourFilter]);

  const filteredRevenueByDestination = useMemo(() => {
    if (!report?.revenueByDestination) return [];
    return report.revenueByDestination.filter((d) => {
      if (destinationFilter !== 'all' && d.destination.toLowerCase() !== destinationFilter.toLowerCase()) {
        return false;
      }
      return true;
    });
  }, [report, destinationFilter]);

  const filteredPaymentsByMethod = useMemo(() => {
    if (!report?.paymentsReceivedByMethod) return [];
    return report.paymentsReceivedByMethod.filter((m) => {
      if (methodFilter !== 'all' && m.method !== methodFilter) return false;
      return true;
    });
  }, [report, methodFilter]);

  const filteredBalances = useMemo(() => {
    return balances.filter((b) => {
      if (statusFilter !== 'all' && b.status !== statusFilter) return false;
      if (tourFilter !== 'all') {
        const matchingTour = tours.find((t) => t.id === tourFilter) || ALL_TOURS.find((t) => t.id === tourFilter);
        if (matchingTour && !b.tourTitle.toLowerCase().includes(matchingTour.title.toLowerCase())) return false;
      }
      return true;
    });
  }, [balances, statusFilter, tourFilter, tours]);

  const filteredRefunds = useMemo(() => {
    if (!report?.refundsList) return [];
    return report.refundsList.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      return true;
    });
  }, [report, statusFilter]);

  const handleExportCSV = () => {
    let filename = `financial_report_${activeTab}_${selectedCurrency}_${new Date().toISOString().split('T')[0]}.csv`;
    let headers: string[] = [];
    let rows: any[][] = [];

    if (activeTab === 'by_date') {
      headers = ['Date', 'Currency', 'Bookings Count', 'Gross Revenue'];
      rows = (report?.revenueByDate || []).map((d) => [
        d.date,
        selectedCurrency,
        d.bookingsCount,
        d.amount,
      ]);
    } else if (activeTab === 'by_tour') {
      headers = ['Tour Title', 'Currency', 'Bookings Confirmed', 'Total Revenue'];
      rows = filteredRevenueByTour.map((t) => [
        `"${t.tourTitle}"`,
        selectedCurrency,
        t.bookingsCount,
        t.amount,
      ]);
    } else if (activeTab === 'by_destination') {
      headers = ['Destination Sector', 'Currency', 'Bookings Count', 'Total Revenue'];
      rows = filteredRevenueByDestination.map((d) => [
        `"${d.destination}"`,
        selectedCurrency,
        d.bookingsCount,
        d.amount,
      ]);
    } else if (activeTab === 'payments_received') {
      headers = ['Payment Gateway / Method', 'Currency', 'Transactions Count', 'Total Settled'];
      rows = filteredPaymentsByMethod.map((m) => [
        `"${m.method}"`,
        selectedCurrency,
        m.transactionsCount,
        m.amount,
      ]);
    } else if (activeTab === 'outstanding_aging') {
      headers = ['Booking Ref', 'Customer', 'Due Date', 'Status', 'Total', 'Paid', 'Outstanding'];
      rows = filteredBalances.map((b) => [
        b.bookingReference,
        `"${b.customerName}"`,
        b.dueDate,
        b.status.toUpperCase(),
        b.totalAmount,
        b.paidAmount,
        b.balanceAmount,
      ]);
    } else {
      headers = ['Refund Ref', 'Booking Ref', 'Customer', 'Date', 'Currency', 'Amount', 'Status', 'Method', 'Reason'];
      rows = filteredRefunds.map((r) => [
        r.transactionReference,
        r.bookingReference,
        `"${r.customerName}"`,
        (r.processedDate || r.createdAt).split('T')[0],
        r.currency,
        r.approvedAmount || r.amount,
        r.status,
        r.refundMethod,
        `"${r.reason}"`,
      ]);
    }

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast(`Exported ${activeTab} report to CSV.`, 'success');
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] uppercase tracking-widest text-[#2dd4bf] font-bold block mb-0.5">
            Executive Ledger Intelligence
          </span>
          <h1 className="text-2xl font-bold font-display text-white tracking-tight flex items-center space-x-2">
            <TrendingUp className="w-6 h-6 text-[#2dd4bf]" />
            <span>Financial Reports & Exports</span>
          </h1>
          <p className="text-xs text-stone-400 mt-1">
            Audited financial rollups with granular filtering by date range, tour, destination, currency, method, and status.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3.5 py-1.5 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded text-xs font-semibold flex items-center space-x-1.5 shadow-xs cursor-pointer transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Export View to CSV</span>
          </button>
        </div>
      </div>

      {/* Comprehensive Filter Bar */}
      <div className="bg-stone-950 border border-stone-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center space-x-2 text-xs font-bold text-stone-300 pb-2 border-b border-stone-800">
          <Filter className="w-4 h-4 text-[#2dd4bf]" />
          <span>Report Parameters & Isolation Filters</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-6 gap-3 text-xs">
          {/* Currency */}
          <div>
            <label className="text-stone-400 text-[10px] uppercase font-bold block mb-1">Currency</label>
            <select
              value={selectedCurrency}
              onChange={(e) => setSelectedCurrency(e.target.value)}
              className="w-full bg-stone-900 border border-stone-800 rounded px-2.5 py-1.5 text-stone-200 focus:outline-hidden"
            >
              <option value="EUR">EUR (€)</option>
              <option value="USD">USD ($)</option>
              <option value="GBP">GBP (£)</option>
              <option value="EGP">EGP</option>
            </select>
          </div>

          {/* Date Range Start */}
          <div>
            <label className="text-stone-400 text-[10px] uppercase font-bold block mb-1">From Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-stone-900 border border-stone-800 rounded px-2.5 py-1.5 text-stone-200 font-mono focus:outline-hidden"
            />
          </div>

          {/* Date Range End */}
          <div>
            <label className="text-stone-400 text-[10px] uppercase font-bold block mb-1">To Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-stone-900 border border-stone-800 rounded px-2.5 py-1.5 text-stone-200 font-mono focus:outline-hidden"
            />
          </div>

          {/* Tour Filter */}
          <div>
            <label className="text-stone-400 text-[10px] uppercase font-bold block mb-1">Tour Excursion</label>
            <select
              value={tourFilter}
              onChange={(e) => setTourFilter(e.target.value)}
              className="w-full bg-stone-900 border border-stone-800 rounded px-2.5 py-1.5 text-stone-200 focus:outline-hidden truncate"
            >
              <option value="all">All Excursions</option>
              {(tours.length > 0 ? tours : ALL_TOURS).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </div>

          {/* Destination Filter */}
          <div>
            <label className="text-stone-400 text-[10px] uppercase font-bold block mb-1">Destination Sector</label>
            <select
              value={destinationFilter}
              onChange={(e) => setDestinationFilter(e.target.value)}
              className="w-full bg-stone-900 border border-stone-800 rounded px-2.5 py-1.5 text-stone-200 focus:outline-hidden"
            >
              <option value="all">All Sectors</option>
              <option value="Hurghada">Hurghada</option>
              <option value="El Gouna">El Gouna</option>
              <option value="Makadi Bay">Makadi Bay</option>
              <option value="Soma Bay">Soma Bay</option>
              <option value="Marsa Alam">Marsa Alam</option>
            </select>
          </div>

          {/* Payment Method / Status */}
          <div>
            <label className="text-stone-400 text-[10px] uppercase font-bold block mb-1">Payment Method</label>
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="w-full bg-stone-900 border border-stone-800 rounded px-2.5 py-1.5 text-stone-200 focus:outline-hidden"
            >
              <option value="all">All Methods</option>
              <option value="Cash">Cash</option>
              <option value="Card">Card (POS)</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="Online Payment">Online Payment</option>
            </select>
          </div>
        </div>

        {(startDate || endDate || tourFilter !== 'all' || destinationFilter !== 'all' || methodFilter !== 'all') && (
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={() => {
                setStartDate('');
                setEndDate('');
                setTourFilter('all');
                setDestinationFilter('all');
                setMethodFilter('all');
                setStatusFilter('all');
              }}
              className="text-[11px] text-[#2dd4bf] hover:underline cursor-pointer"
            >
              Clear all parameters
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center space-x-1 border-b border-stone-800 pb-px overflow-x-auto text-xs">
        {[
          { id: 'by_date', label: 'Revenue by Date', icon: Calendar },
          { id: 'by_tour', label: 'Revenue by Tour', icon: Compass },
          { id: 'by_destination', label: 'By Destination', icon: MapPin },
          { id: 'payments_received', label: 'Gateway Settlement', icon: CreditCard },
          { id: 'outstanding_aging', label: 'Aging Receivables', icon: AlertCircle },
          { id: 'refunds_disputes', label: 'Returns & Claims', icon: RotateCcw },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as ReportTab)}
              className={`px-3.5 py-2 font-medium flex items-center space-x-1.5 border-b-2 cursor-pointer transition-colors whitespace-nowrap ${
                isActive
                  ? 'border-[#0A6C74] text-white'
                  : 'border-transparent text-stone-400 hover:text-stone-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Content Area */}
      <div className="bg-stone-950 border border-stone-800 rounded-xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-16 text-center text-stone-400">
            <RefreshCw className="w-8 h-8 text-[#0A6C74] animate-spin mx-auto mb-3" />
            <p className="text-xs">Aggregating database reports...</p>
          </div>
        ) : (
          <div className="p-4">
            {activeTab === 'by_date' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-stone-300">
                  <thead className="bg-stone-900/80 border-b border-stone-800 text-stone-400 text-[11px] uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Currency</th>
                      <th className="py-2.5 px-3 text-center">Bookings Confirmed</th>
                      <th className="py-2.5 px-3 text-right">Gross Booked Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-800/60 font-mono">
                    {report?.revenueByDate.map((d) => (
                      <tr key={d.date} className="hover:bg-stone-900/40">
                        <td className="py-2.5 px-3 text-white font-bold">{d.date}</td>
                        <td className="py-2.5 px-3 text-stone-400">{selectedCurrency}</td>
                        <td className="py-2.5 px-3 text-center text-sky-400">{d.bookingsCount}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-400">
                          {currencySymbol}{d.amount.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'by_tour' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-stone-300">
                  <thead className="bg-stone-900/80 border-b border-stone-800 text-stone-400 text-[11px] uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Excursion Tour</th>
                      <th className="py-2.5 px-3">Currency</th>
                      <th className="py-2.5 px-3 text-center">Bookings Confirmed</th>
                      <th className="py-2.5 px-3 text-right">Total Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-800/60 font-mono">
                    {filteredRevenueByTour.map((t) => (
                      <tr key={t.tourId} className="hover:bg-stone-900/40">
                        <td className="py-2.5 px-3 text-white font-sans font-medium">{t.tourTitle}</td>
                        <td className="py-2.5 px-3 text-stone-400">{selectedCurrency}</td>
                        <td className="py-2.5 px-3 text-center text-sky-400">{t.bookingsCount}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-400">
                          {currencySymbol}{t.amount.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'by_destination' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-stone-300">
                  <thead className="bg-stone-900/80 border-b border-stone-800 text-stone-400 text-[11px] uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Destination Sector</th>
                      <th className="py-2.5 px-3">Currency</th>
                      <th className="py-2.5 px-3 text-center">Confirmed Departures</th>
                      <th className="py-2.5 px-3 text-right">Total Sector Volume</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-800/60 font-mono">
                    {filteredRevenueByDestination.map((d) => (
                      <tr key={d.destination} className="hover:bg-stone-900/40">
                        <td className="py-2.5 px-3 text-white font-sans font-bold">{d.destination}</td>
                        <td className="py-2.5 px-3 text-stone-400">{selectedCurrency}</td>
                        <td className="py-2.5 px-3 text-center text-sky-400">{d.bookingsCount}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-400">
                          {currencySymbol}{d.amount.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'payments_received' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-stone-300">
                  <thead className="bg-stone-900/80 border-b border-stone-800 text-stone-400 text-[11px] uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Gateway / Channel</th>
                      <th className="py-2.5 px-3">Currency</th>
                      <th className="py-2.5 px-3 text-center">Transactions</th>
                      <th className="py-2.5 px-3 text-right">Total Settled</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-800/60 font-mono">
                    {filteredPaymentsByMethod.map((m) => (
                      <tr key={m.method} className="hover:bg-stone-900/40">
                        <td className="py-2.5 px-3 text-white font-sans font-bold">{m.method}</td>
                        <td className="py-2.5 px-3 text-stone-400">{selectedCurrency}</td>
                        <td className="py-2.5 px-3 text-center text-sky-400">{m.transactionsCount}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-400">
                          {currencySymbol}{m.amount.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'outstanding_aging' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-stone-300">
                  <thead className="bg-stone-900/80 border-b border-stone-800 text-stone-400 text-[11px] uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Booking Ref</th>
                      <th className="py-2.5 px-3">Customer</th>
                      <th className="py-2.5 px-3">Due Date</th>
                      <th className="py-2.5 px-3">Aging Status</th>
                      <th className="py-2.5 px-3 text-right">Contracted</th>
                      <th className="py-2.5 px-3 text-right">Collected</th>
                      <th className="py-2.5 px-3 text-right">Outstanding Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-800/60 font-mono">
                    {filteredBalances.map((b) => (
                      <tr key={b.bookingReference} className="hover:bg-stone-900/40">
                        <td className="py-2.5 px-3 text-sky-400 font-bold">{b.bookingReference}</td>
                        <td className="py-2.5 px-3 text-white font-sans">{b.customerName}</td>
                        <td className="py-2.5 px-3 text-stone-400">{b.dueDate}</td>
                        <td className="py-2.5 px-3 uppercase text-[10px] font-bold">
                          <span
                            className={
                              b.status === 'overdue'
                                ? 'text-red-400'
                                : b.status === 'due_today'
                                ? 'text-amber-400'
                                : 'text-stone-400'
                            }
                          >
                            {b.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">€{b.totalAmount.toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-right text-emerald-400">€{b.paidAmount.toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-right text-amber-400 font-bold">
                          €{b.balanceAmount.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'refunds_disputes' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-stone-300">
                  <thead className="bg-stone-900/80 border-b border-stone-800 text-stone-400 text-[11px] uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Tx Reference</th>
                      <th className="py-2.5 px-3">Booking Ref</th>
                      <th className="py-2.5 px-3">Customer</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Method</th>
                      <th className="py-2.5 px-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-800/60 font-mono">
                    {filteredRefunds.map((r) => (
                      <tr key={r.id} className="hover:bg-stone-900/40">
                        <td className="py-2.5 px-3 text-white font-bold">{r.transactionReference}</td>
                        <td className="py-2.5 px-3 text-sky-400">{r.bookingReference}</td>
                        <td className="py-2.5 px-3 text-white font-sans">{r.customerName}</td>
                        <td className="py-2.5 px-3 text-stone-400">
                          {(r.processedDate || r.createdAt).split('T')[0]}
                        </td>
                        <td className="py-2.5 px-3 text-[10px] uppercase font-bold text-rose-400">
                          {r.status}
                        </td>
                        <td className="py-2.5 px-3 text-stone-300 font-sans">{r.refundMethod}</td>
                        <td className="py-2.5 px-3 text-right text-rose-400 font-bold">
                          -€{(r.approvedAmount || r.amount).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
