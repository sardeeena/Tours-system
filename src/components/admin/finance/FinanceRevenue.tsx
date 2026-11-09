import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  TrendingUp,
  CreditCard,
  RotateCcw,
  AlertCircle,
  Calendar,
  Compass,
  MapPin,
  RefreshCw,
  Download,
  CheckCircle2,
  PieChart,
  BarChart3,
  Globe,
} from 'lucide-react';
import { getFinancialReports } from '../../../services/financeService';
import { FinancialReportData } from '../../../types/finance';

interface FinanceRevenueProps {
  onNavigateTab?: (tabId: string, param?: string) => void;
}

export const FinanceRevenue: React.FC<FinanceRevenueProps> = ({ onNavigateTab }) => {
  const [selectedCurrency, setSelectedCurrency] = useState<string>('EUR');
  const [report, setReport] = useState<FinancialReportData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getFinancialReports(selectedCurrency);
      setReport(data);
    } catch (err) {
      console.warn('Failed to load revenue data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedCurrency]);

  const currencySymbol =
    selectedCurrency === 'EUR' ? '€' : selectedCurrency === 'USD' ? '$' : selectedCurrency === 'GBP' ? '£' : 'EGP ';

  const netRealizedRevenue =
    (report?.totals.totalPaid || 0) - (report?.totals.totalRefunded || 0);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] uppercase tracking-widest text-[#2dd4bf] font-bold block mb-0.5">
            Financial Analytics & P&L
          </span>
          <h1 className="text-2xl font-bold font-display text-white tracking-tight flex items-center space-x-2">
            <DollarSign className="w-6 h-6 text-[#2dd4bf]" />
            <span>Revenue & Financial Performance</span>
          </h1>
          <p className="text-xs text-stone-400 mt-1">
            Authoritative financial telemetry separated strictly by operating currency. Zero cross-currency aggregation errors.
          </p>
        </div>

        {/* Currency Switcher */}
        <div className="flex items-center space-x-3 bg-stone-950 border border-stone-800 p-1.5 rounded-xl">
          <span className="text-stone-400 text-xs px-2 font-medium">Reporting Currency:</span>
          {['EUR', 'USD', 'GBP', 'EGP'].map((cur) => (
            <button
              key={cur}
              type="button"
              onClick={() => setSelectedCurrency(cur)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-colors cursor-pointer ${
                selectedCurrency === cur
                  ? 'bg-[#0A6C74] text-white shadow-xs'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              {cur}
            </button>
          ))}
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="p-1.5 text-stone-400 hover:text-white cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Currency Isolation Notice */}
      <div className="bg-sky-500/10 border border-sky-500/20 rounded-xl px-4 py-2.5 text-xs text-sky-300 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0" />
          <span>
            <strong>Auditable Currency Boundary:</strong> Showing exact ledger figures in <strong>{selectedCurrency}</strong>. Exchange rates are never mixed into historical revenue tallies.
          </span>
        </div>
        <span className="text-[11px] font-mono text-sky-400">
          {report?.totals.bookingsCount || 0} Bookings Recorded
        </span>
      </div>

      {/* KPI Cards: Gross Bookings, Collected Payments, Outstanding, Refunds, Net Revenue */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3.5">
        <div className="bg-stone-950 border border-stone-800/80 rounded-xl p-4">
          <span className="text-[10px] uppercase text-stone-500 font-bold block mb-1">
            Gross Bookings
          </span>
          <div className="font-mono font-bold text-xl text-white">
            {currencySymbol}{report?.totals.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[11px] text-stone-500 mt-1 block">Contracted gross value</span>
        </div>

        <div className="bg-stone-950 border border-stone-800/80 rounded-xl p-4">
          <span className="text-[10px] uppercase text-stone-500 font-bold block mb-1">
            Collected Payments
          </span>
          <div className="font-mono font-bold text-xl text-emerald-400">
            {currencySymbol}{report?.totals.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[11px] text-stone-500 mt-1 block">Bank & cashier settled</span>
        </div>

        <div className="bg-stone-950 border border-stone-800/80 rounded-xl p-4">
          <span className="text-[10px] uppercase text-stone-500 font-bold block mb-1">
            Outstanding Balances
          </span>
          <div className="font-mono font-bold text-xl text-amber-400">
            {currencySymbol}{report?.totals.totalOutstanding.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[11px] text-stone-500 mt-1 block">Due at pier / pickup</span>
        </div>

        <div className="bg-stone-950 border border-stone-800/80 rounded-xl p-4">
          <span className="text-[10px] uppercase text-stone-500 font-bold block mb-1">
            Processed Refunds
          </span>
          <div className="font-mono font-bold text-xl text-rose-400">
            -{currencySymbol}{report?.totals.totalRefunded.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[11px] text-stone-500 mt-1 block">Executed returns & claims</span>
        </div>

        <div className="bg-stone-950 border border-stone-800/80 rounded-xl p-4">
          <span className="text-[10px] uppercase text-stone-500 font-bold block mb-1">
            Net Revenue
          </span>
          <div className="font-mono font-bold text-xl text-[#2dd4bf]">
            {currencySymbol}{netRealizedRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[11px] text-stone-500 mt-1 block">Collected less refunds</span>
        </div>
      </div>

      {/* Multi-Currency Comparative Breakdown */}
      <div className="bg-stone-950 border border-stone-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-stone-800 pb-3">
          <div className="flex items-center space-x-2">
            <Globe className="w-4 h-4 text-[#2dd4bf]" />
            <h3 className="font-bold text-white text-sm">Currency Breakdown Across Operating Portfolios</h3>
          </div>
          <span className="text-[11px] text-stone-500 font-mono">Isolated Ledger Balances</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-900/60 text-stone-400 text-[10px] uppercase font-semibold">
              <tr>
                <th className="py-2.5 px-3">Currency</th>
                <th className="py-2.5 px-3">Gross Bookings</th>
                <th className="py-2.5 px-3">Collected Payments</th>
                <th className="py-2.5 px-3">Processed Refunds</th>
                <th className="py-2.5 px-3">Net Revenue</th>
                <th className="py-2.5 px-3">Outstanding Balances</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/60 text-stone-300 font-mono">
              {report?.currencyBreakdown?.map((cb) => (
                <tr key={cb.currency} className="hover:bg-stone-900/30">
                  <td className="py-2.5 px-3 font-bold text-white">
                    <span className="px-2 py-0.5 rounded bg-stone-800 text-stone-200 text-[11px]">
                      {cb.currency}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-stone-300">
                    {cb.grossBookings.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-2.5 px-3 text-emerald-400 font-semibold">
                    {cb.collectedPayments.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-2.5 px-3 text-rose-400">
                    -{cb.refunds.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-2.5 px-3 text-[#2dd4bf] font-bold">
                    {cb.netRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-2.5 px-3 text-amber-400">
                    {cb.outstandingBalances.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Grid: Revenue by Month & Revenue by Tour */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by Month */}
        <div className="bg-stone-950 border border-stone-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-stone-800 pb-3">
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-[#2dd4bf]" />
              <h3 className="font-bold text-white text-sm">Revenue by Month</h3>
            </div>
            <span className="text-[11px] text-stone-500 font-mono">Monthly Run-rate</span>
          </div>

          <div className="space-y-3">
            {(!report?.revenueByMonth || report.revenueByMonth.length === 0) ? (
              <p className="text-xs text-stone-500">No monthly records in {selectedCurrency}.</p>
            ) : (
              report.revenueByMonth.map((m) => {
                const totalGross = report.totals.totalRevenue || 1;
                const percent = Math.min(100, Math.round((m.amount / totalGross) * 100));

                return (
                  <div key={m.month} className="space-y-1 text-xs">
                    <div className="flex justify-between items-center text-stone-300">
                      <span className="font-mono font-medium text-white">{m.month}</span>
                      <span className="font-mono font-bold text-emerald-400">
                        {currencySymbol}{m.amount.toFixed(2)} ({percent}%)
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-stone-900 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-stone-500">
                      <span>{m.bookingsCount} departures confirmed</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Revenue by Tour */}
        <div className="bg-stone-950 border border-stone-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-stone-800 pb-3">
            <div className="flex items-center space-x-2">
              <Compass className="w-4 h-4 text-[#2dd4bf]" />
              <h3 className="font-bold text-white text-sm">Revenue by Tour</h3>
            </div>
            <span className="text-[11px] text-stone-500 font-mono">Ranked by Gross Volume</span>
          </div>

          <div className="space-y-3">
            {report?.revenueByTour.map((tour) => {
              const totalGross = report.totals.totalRevenue || 1;
              const percent = Math.round((tour.amount / totalGross) * 100);

              return (
                <div key={tour.tourId} className="space-y-1 text-xs">
                  <div className="flex justify-between items-center text-stone-300">
                    <span className="font-medium text-white truncate max-w-[260px]">{tour.tourTitle}</span>
                    <span className="font-mono font-bold text-emerald-400">
                      {currencySymbol}{tour.amount.toFixed(2)} ({percent}%)
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-stone-900 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#0A6C74] rounded-full transition-all duration-500"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-stone-500">
                    <span>{tour.bookingsCount} bookings confirmed</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Grid: Revenue by Destination & Methods */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by Destination */}
        <div className="bg-stone-950 border border-stone-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-stone-800 pb-3">
            <div className="flex items-center space-x-2">
              <MapPin className="w-4 h-4 text-emerald-400" />
              <h3 className="font-bold text-white text-sm">Revenue by Destination Sector</h3>
            </div>
            <span className="text-[11px] text-stone-500 font-mono">Red Sea Sector</span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            {report?.revenueByDestination.map((dest) => (
              <div key={dest.destination} className="p-3 bg-stone-900/60 rounded-lg border border-stone-800/80 space-y-1">
                <span className="text-[10px] uppercase font-bold text-stone-400 block">{dest.destination}</span>
                <div className="font-mono font-bold text-base text-white">
                  {currencySymbol}{dest.amount.toFixed(2)}
                </div>
                <div className="text-[10px] text-stone-500">{dest.bookingsCount} departures</div>
              </div>
            ))}
          </div>
        </div>

        {/* Revenue by Payment Method */}
        <div className="bg-stone-950 border border-stone-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-stone-800 pb-3">
            <div className="flex items-center space-x-2">
              <CreditCard className="w-4 h-4 text-amber-400" />
              <h3 className="font-bold text-white text-sm">Collections by Payment Method</h3>
            </div>
            <span className="text-[11px] text-stone-500 font-mono">Settlement Breakdown</span>
          </div>

          <div className="space-y-2 text-xs">
            {report?.paymentsReceivedByMethod.map((item) => (
              <div key={item.method} className="flex justify-between items-center p-2.5 bg-stone-900/40 rounded border border-stone-800/60">
                <div>
                  <span className="font-bold text-white">{item.method}</span>
                  <span className="text-[10px] text-stone-500 block">{item.transactionsCount} transactions</span>
                </div>
                <span className="font-mono font-bold text-sm text-emerald-400">
                  {currencySymbol}{item.amount.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
