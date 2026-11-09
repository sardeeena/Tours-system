import React from 'react';
import {
  DollarSign,
  CheckCircle2,
  Clock,
  RotateCcw,
  Tag,
  CreditCard,
  Percent,
  TrendingUp,
  ArrowUpRight,
  ShieldCheck,
  Calendar,
} from 'lucide-react';
import { FinanceMetrics, DateRangeInterval } from '../../../types/reporting';

interface FinanceDashboardViewProps {
  metrics: FinanceMetrics;
  interval: DateRangeInterval;
  onNavigateTab?: (tabId: string, param?: string) => void;
}

export const FinanceDashboardView: React.FC<FinanceDashboardViewProps> = ({
  metrics,
  interval,
  onNavigateTab,
}) => {
  return (
    <div className="space-y-6">
      {/* 5 Core Financial Entities KPI Grid (Gross, Payments, Outstanding, Refunds, Net Revenue) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Gross Revenue */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-5 shadow">
          <div className="flex items-center justify-between text-xs text-stone-400">
            <span>Gross Revenue</span>
            <DollarSign className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-xl lg:text-2xl font-bold text-white mt-2 font-mono">
            €{metrics.grossRevenueEur.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] text-stone-500 mt-1 block">Contracted gross bookings</span>
        </div>

        {/* Collected Payments */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-5 shadow">
          <div className="flex items-center justify-between text-xs text-stone-400">
            <span>Payments Collected</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl lg:text-2xl font-bold text-emerald-400 mt-2 font-mono">
            €{metrics.collectedPaymentsEur.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] text-stone-500 mt-1 block">Verified payment transactions</span>
        </div>

        {/* Outstanding */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-5 shadow">
          <div className="flex items-center justify-between text-xs text-stone-400">
            <span>Outstanding Balances</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl lg:text-2xl font-bold text-amber-400 mt-2 font-mono">
            €{metrics.outstandingEur.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] text-stone-500 mt-1 block">Pier pay-at-pickup balance</span>
        </div>

        {/* Refunds */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-5 shadow">
          <div className="flex items-center justify-between text-xs text-stone-400">
            <span>Audited Refunds</span>
            <RotateCcw className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-xl lg:text-2xl font-bold text-rose-400 mt-2 font-mono">
            €{metrics.refundsEur.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] text-stone-500 mt-1 block">Processed refund records</span>
        </div>

        {/* Net Revenue */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-5 shadow">
          <div className="flex items-center justify-between text-xs text-stone-400">
            <span>Net Realized Revenue</span>
            <TrendingUp className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-xl lg:text-2xl font-bold text-sky-400 mt-2 font-mono">
            €{metrics.netRevenueEur.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] text-stone-500 mt-1 block">Gross minus approved refunds</span>
        </div>
      </div>

      {/* Monthly Revenue Breakdown (12 Months Rolling Trend) */}
      <div className="bg-stone-900 border border-stone-800 rounded-xl p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between border-b border-stone-800 pb-3">
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-teal-400" />
            <h3 className="text-sm font-bold text-white">Monthly Revenue Breakdown &amp; Performance Trend</h3>
          </div>
          <span className="text-[11px] text-stone-400 font-mono">Annualized FY 2026</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-stone-300">
            <thead className="bg-stone-950 text-stone-400 uppercase text-[10px] font-semibold border-b border-stone-800">
              <tr>
                <th className="py-2.5 px-3">Month</th>
                <th className="py-2.5 px-3 text-center">Bookings Count</th>
                <th className="py-2.5 px-3 text-right">Gross Contracted</th>
                <th className="py-2.5 px-3 text-right">Payments Collected</th>
                <th className="py-2.5 px-3 text-right">Refunds Processed</th>
                <th className="py-2.5 px-3 text-right">Net Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/60 font-medium">
              {metrics.monthlyRevenue.map((m) => (
                <tr key={m.month} className="hover:bg-stone-800/40 transition-colors">
                  <td className="py-2.5 px-3 font-semibold text-white">{m.month}</td>
                  <td className="py-2.5 px-3 text-center text-stone-300">{m.bookingsCount}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-white">
                    €{m.grossEur.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-emerald-400">
                    €{m.paidEur.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-rose-400">
                    €{m.refundsEur.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-sky-400 font-bold">
                    €{m.netEur.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Middle Row: Payment Methods & Collection Rate */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payment Methods Breakdown */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-stone-800 pb-3">
            <div className="flex items-center space-x-2">
              <CreditCard className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white">Payment Method Channels</h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab?.('fin_payments')}
              className="text-xs text-teal-400 hover:text-teal-300 underline font-medium"
            >
              All Payments
            </button>
          </div>

          <div className="space-y-3">
            {metrics.paymentMethods.length === 0 ? (
              <p className="text-stone-500 text-xs py-8 text-center">No payment transactions recorded.</p>
            ) : (
              metrics.paymentMethods.map((pm) => (
                <div key={pm.method} className="p-3 bg-stone-950/70 border border-stone-800 rounded-lg space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-white">{pm.method}</span>
                    <span className="font-mono text-emerald-400 font-bold">€{pm.amountEur.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-stone-400">
                    <span>{pm.count} transactions</span>
                    <span>{pm.percentage}% of collections</span>
                  </div>
                  <div className="w-full bg-stone-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full"
                      style={{ width: `${Math.min(100, pm.percentage)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Multi-Currency & Collection Integrity */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-stone-800 pb-3">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-4 h-4 text-teal-400" />
              <h3 className="text-sm font-bold text-white">Collection Health &amp; Currency Breakdown</h3>
            </div>
            <span className="text-xs font-mono text-teal-400">{metrics.collectionRatePct}% Collected</span>
          </div>

          <div className="p-4 bg-stone-950 rounded-lg border border-stone-800 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-stone-400">Net Realized Collection Rate:</span>
              <span className="text-emerald-400 font-bold font-mono">{metrics.collectionRatePct}%</span>
            </div>
            <div className="w-full bg-stone-800 h-2 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-teal-500 to-emerald-400 h-full rounded-full"
                style={{ width: `${metrics.collectionRatePct}%` }}
              />
            </div>
            <p className="text-[11px] text-stone-500 leading-relaxed">
              Currencies are kept separate and auditable. Converted equivalents are calculated at official CIB central bank fixing rates for executive reference without corrupting the historical cash ledger.
            </p>
          </div>

          <div className="space-y-2">
            <span className="text-xs font-medium text-stone-400">Currency Exposure (Collected Equivalent):</span>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {metrics.currencyBreakdown.map((cb) => (
                <div key={cb.currency} className="p-2.5 bg-stone-950 rounded border border-stone-800 text-center">
                  <span className="text-[10px] text-stone-500 block uppercase font-bold">{cb.currency}</span>
                  <span className="font-mono text-white font-bold text-xs mt-0.5 block">
                    {cb.currency === 'EUR' ? '€' : cb.currency === 'USD' ? '$' : 'E£'}
                    {cb.amount.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
