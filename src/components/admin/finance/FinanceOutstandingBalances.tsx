import React, { useState, useEffect, useMemo } from 'react';
import {
  AlertCircle,
  Search,
  Filter,
  DollarSign,
  Calendar,
  CheckCircle2,
  Clock,
  Phone,
  Mail,
  Building,
  RefreshCw,
  Plus,
  CreditCard,
  Download,
} from 'lucide-react';
import {
  getOutstandingBalances,
  recordPayment,
} from '../../../services/financeService';
import { OutstandingBalanceItem } from '../../../types/finance';
import { useToast } from '../../../contexts/ToastContext';

interface FinanceOutstandingBalancesProps {
  onNavigateTab?: (tabId: string, param?: string) => void;
}

export const FinanceOutstandingBalances: React.FC<FinanceOutstandingBalancesProps> = ({
  onNavigateTab,
}) => {
  const { showToast } = useToast();
  const [balances, setBalances] = useState<OutstandingBalanceItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Quick Collect Payment Modal
  const [collectingItem, setCollectingItem] = useState<OutstandingBalanceItem | null>(null);
  const [collectAmount, setCollectAmount] = useState<number>(0);
  const [collectMethod, setCollectMethod] = useState<'Cash' | 'Card'>('Cash');
  const [collectTxRef, setCollectTxRef] = useState<string>('');
  const [collectNotes, setCollectNotes] = useState<string>('');
  const [savingAction, setSavingAction] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getOutstandingBalances();
      setBalances(data);
    } catch (err) {
      console.warn('Failed to load outstanding balances:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenCollect = (item: OutstandingBalanceItem) => {
    setCollectingItem(item);
    setCollectAmount(item.balanceAmount);
    setCollectTxRef(`PIER-CASH-${item.bookingReference.replace(/[^a-zA-Z0-9]/g, '')}`);
    setCollectNotes(`Pier settlement received from ${item.customerName} at hotel pickup / marina.`);
  };

  const handleSaveCollect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collectingItem || collectAmount <= 0) return;

    setSavingAction(true);
    try {
      await recordPayment({
        bookingId: collectingItem.bookingId,
        bookingReference: collectingItem.bookingReference,
        customerId: collectingItem.customerId,
        customerName: collectingItem.customerName,
        customerEmail: collectingItem.customerEmail,
        customerPhone: collectingItem.customerPhone,
        amount: Number(collectAmount),
        currency: collectingItem.currency,
        paymentMethod: collectMethod,
        paymentStatus: collectAmount >= collectingItem.balanceAmount ? 'Paid' : 'Partially Paid',
        transactionReference: collectTxRef.trim(),
        notes: collectNotes.trim(),
        recordedBy: 'Pier Cashier',
      });

      showToast(`Settled €${collectAmount} for ${collectingItem.bookingReference}.`, 'success');
      setCollectingItem(null);
      await loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to collect payment', 'error');
    } finally {
      setSavingAction(false);
    }
  };

  const filteredBalances = useMemo(() => {
    return balances.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.bookingReference.toLowerCase().includes(q) ||
          item.customerName.toLowerCase().includes(q) ||
          item.customerEmail.toLowerCase().includes(q) ||
          item.tourTitle.toLowerCase().includes(q) ||
          (item.hotel && item.hotel.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [balances, statusFilter, searchQuery]);

  const totalOutstandingEur = balances.reduce((sum, b) => sum + b.balanceAmount, 0);
  const overdueCount = balances.filter((b) => b.status === 'overdue').length;
  const dueTodayCount = balances.filter((b) => b.status === 'due_today').length;

  const exportBalancesCsv = () => {
    const headers = [
      'Booking Ref',
      'Customer Name',
      'Phone',
      'Hotel',
      'Tour',
      'Tour Date',
      'Total',
      'Paid',
      'Balance Due',
      'Status',
    ];
    const rows = filteredBalances.map((b) => [
      b.bookingReference,
      `"${b.customerName}"`,
      `"${b.customerPhone || 'N/A'}"`,
      `"${b.hotel || 'Direct Marina'}"`,
      `"${b.tourTitle}"`,
      b.tourDate,
      b.totalAmount,
      b.paidAmount,
      b.balanceAmount,
      b.status.toUpperCase(),
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `outstanding_receivables_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Exported outstanding receivables to CSV.', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] uppercase tracking-widest text-[#2dd4bf] font-bold block mb-0.5">
            Credit Control & Receivables
          </span>
          <h1 className="text-2xl font-bold font-display text-white tracking-tight flex items-center space-x-2">
            <AlertCircle className="w-6 h-6 text-[#2dd4bf]" />
            <span>Outstanding Balances & Collections</span>
          </h1>
          <p className="text-xs text-stone-400 mt-1">
            Track unpaid balances across upcoming, today's, and overdue departures. One-click collection at marina gates and shuttle pickups.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={exportBalancesCsv}
            className="px-3 py-1.5 bg-stone-900 border border-stone-800 hover:border-stone-700 text-stone-300 hover:text-white rounded text-xs flex items-center space-x-1.5 cursor-pointer transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="bg-stone-950 border border-stone-800/80 rounded-xl p-4">
          <span className="text-[10px] uppercase text-stone-500 font-bold block mb-1">
            Total Outstanding Receivables
          </span>
          <div className="font-mono font-bold text-2xl text-amber-400">
            €{totalOutstandingEur.toLocaleString()}
          </div>
          <span className="text-[11px] text-stone-500 mt-1 block">
            Across {balances.length} pending reservations
          </span>
        </div>

        <div className="bg-stone-950 border border-stone-800/80 rounded-xl p-4">
          <span className="text-[10px] uppercase text-stone-500 font-bold block mb-1">
            Departing Today (Collect at Pier)
          </span>
          <div className="font-mono font-bold text-2xl text-[#2dd4bf]">
            {dueTodayCount} Bookings
          </div>
          <span className="text-[11px] text-stone-500 mt-1 block">
            Immediate cash/card collection needed
          </span>
        </div>

        <div className="bg-stone-950 border border-stone-800/80 rounded-xl p-4">
          <span className="text-[10px] uppercase text-stone-500 font-bold block mb-1">
            Overdue Balances (Aging Flag)
          </span>
          <div className="font-mono font-bold text-2xl text-red-400">
            {overdueCount} Overdue
          </div>
          <span className="text-[11px] text-stone-500 mt-1 block">
            Departures completed without full settlement
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-stone-950 border border-stone-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-2 flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-stone-500 shrink-0" />
          <input
            type="text"
            placeholder="Search by customer name, booking reference, hotel, or tour..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent border-none text-stone-200 placeholder-stone-500 focus:outline-none text-xs"
          />
        </div>

        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1">
            <span className="text-stone-500 text-[11px]">Aging Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-stone-900 border border-stone-800 rounded px-2.5 py-1 text-stone-300 text-xs focus:outline-none"
            >
              <option value="all">All Receivables</option>
              <option value="due_today">Due Today</option>
              <option value="overdue">Overdue</option>
              <option value="upcoming">Upcoming</option>
            </select>
          </div>

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="p-1.5 bg-stone-900 border border-stone-800 rounded text-stone-400 hover:text-white cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Balances Table */}
      <div className="bg-stone-950 border border-stone-800 rounded-xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-16 text-center text-stone-400">
            <div className="w-8 h-8 border-2 border-[#0A6C74] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs">Compiling receivables ledger...</p>
          </div>
        ) : filteredBalances.length === 0 ? (
          <div className="p-16 text-center text-stone-500 space-y-2">
            <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500 mb-1" />
            <p className="text-sm font-semibold text-stone-300">All balances cleared!</p>
            <p className="text-xs">No outstanding receivables for the selected criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-stone-300">
              <thead className="bg-stone-900/80 border-b border-stone-800 text-stone-400 text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Booking Ref</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Hotel / Pickup</th>
                  <th className="py-3 px-4">Excursion</th>
                  <th className="py-3 px-4">Tour Date</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  <th className="py-3 px-4 text-right">Paid</th>
                  <th className="py-3 px-4 text-right">Balance Due</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800/60 font-sans">
                {filteredBalances.map((item) => (
                  <tr key={item.bookingReference} className="hover:bg-stone-900/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-white">
                      {item.bookingReference}
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-semibold text-white">{item.customerName}</div>
                      <div className="text-[11px] text-stone-500">{item.customerPhone || item.customerEmail}</div>
                    </td>

                    <td className="py-3 px-4 text-stone-300">
                      <div className="font-medium truncate max-w-[150px]">{item.hotel}</div>
                    </td>

                    <td className="py-3 px-4 text-stone-200 truncate max-w-[180px]">
                      {item.tourTitle}
                    </td>

                    <td className="py-3 px-4 font-mono text-stone-400 text-[11px]">
                      {item.tourDate}
                    </td>

                    <td className="py-3 px-4 text-right font-mono text-stone-400">
                      €{item.totalAmount.toFixed(2)}
                    </td>

                    <td className="py-3 px-4 text-right font-mono text-emerald-400">
                      €{item.paidAmount.toFixed(2)}
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-bold text-sm text-amber-400">
                      €{item.balanceAmount.toFixed(2)}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${
                          item.status === 'overdue'
                            ? 'bg-red-500/20 text-red-300 border-red-500/30'
                            : item.status === 'due_today'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                            : 'bg-stone-800 text-stone-300 border-stone-700'
                        }`}
                      >
                        {item.status.replace('_', ' ')}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleOpenCollect(item)}
                        className="px-2.5 py-1 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded text-[11px] font-semibold cursor-pointer shadow-xs transition-colors"
                      >
                        Collect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* QUICK COLLECT MODAL */}
      {collectingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-stone-950 border border-stone-800 rounded-2xl max-w-md w-full p-6 text-xs text-stone-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <div className="flex items-center space-x-2">
                <CreditCard className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Collect Outstanding Balance</h3>
              </div>
              <button
                type="button"
                onClick={() => setCollectingItem(null)}
                className="text-stone-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCollect} className="space-y-4">
              <div className="p-3 bg-stone-900/60 rounded-lg border border-stone-800 space-y-1">
                <div className="text-stone-400">Reservation: <strong className="text-white font-mono">{collectingItem.bookingReference}</strong></div>
                <div className="text-stone-400">Customer: <strong className="text-white">{collectingItem.customerName}</strong></div>
                <div className="text-stone-400">Excursion: <span className="text-stone-200">{collectingItem.tourTitle}</span></div>
                <div className="flex justify-between items-center pt-2 border-t border-stone-800/80 font-mono">
                  <span>Balance Due:</span>
                  <span className="text-base font-bold text-amber-400">€{collectingItem.balanceAmount.toFixed(2)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-stone-400 mb-1">
                    Amount Collected
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={collectAmount}
                    onChange={(e) => setCollectAmount(parseFloat(e.target.value) || 0)}
                    className="w-full bg-stone-900 border border-stone-800 rounded-lg p-2.5 text-white font-mono font-bold text-sm focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-stone-400 mb-1">
                    Payment Method
                  </label>
                  <select
                    value={collectMethod}
                    onChange={(e) => setCollectMethod(e.target.value as any)}
                    className="w-full bg-stone-900 border border-stone-800 rounded-lg p-2.5 text-white text-xs focus:outline-none"
                  >
                    <option value="Cash">Cash (Pier Handover)</option>
                    <option value="Card">Card (POS Terminal)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-stone-400 mb-1">
                  Receipt / Transaction Ref
                </label>
                <input
                  type="text"
                  value={collectTxRef}
                  onChange={(e) => setCollectTxRef(e.target.value)}
                  className="w-full bg-stone-900 border border-stone-800 rounded-lg p-2.5 text-white font-mono text-xs focus:outline-none"
                  required
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => setCollectingItem(null)}
                  className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-stone-300 rounded text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAction}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold cursor-pointer shadow flex items-center space-x-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{savingAction ? 'Saving...' : 'Confirm Receipt'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
