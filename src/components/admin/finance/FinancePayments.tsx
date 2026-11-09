import React, { useState, useEffect, useMemo } from 'react';
import {
  CreditCard,
  Search,
  Filter,
  Plus,
  RefreshCw,
  DollarSign,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RotateCcw,
  FileText,
  User,
  ShieldCheck,
  Eye,
  Download,
  Building,
  HelpCircle,
} from 'lucide-react';
import {
  listPayments,
  recordPayment,
  listPaymentProviders,
  listInvoices,
} from '../../../services/financeService';
import {
  FinancePayment,
  FinancePaymentMethod,
  FinancePaymentStatus,
  PaymentProvider,
} from '../../../types/finance';
import { bookingRepository } from '../../../services/bookingRepository';
import { Booking } from '../../../types/booking';
import { useToast } from '../../../contexts/ToastContext';

interface FinancePaymentsProps {
  onNavigateTab?: (tabId: string, param?: string) => void;
}

export const FinancePayments: React.FC<FinancePaymentsProps> = ({ onNavigateTab }) => {
  const { showToast } = useToast();
  const [payments, setPayments] = useState<FinancePayment[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [providers, setProviders] = useState<PaymentProvider[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [providerFilter, setProviderFilter] = useState<string>('all');
  const [currencyFilter, setCurrencyFilter] = useState<string>('all');

  // New Payment Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedBookingRef, setSelectedBookingRef] = useState<string>('');
  const [amountInput, setAmountInput] = useState<number>(0);
  const [currencyInput, setCurrencyInput] = useState<string>('EUR');
  const [methodInput, setMethodInput] = useState<FinancePaymentMethod>('Cash');
  const [providerInput, setProviderInput] = useState<string>('cash');
  const [statusInput, setStatusInput] = useState<FinancePaymentStatus>('Paid');
  const [txRefInput, setTxRefInput] = useState<string>('');
  const [notesInput, setNotesInput] = useState<string>('');
  const [recordedByInput, setRecordedByInput] = useState<string>('Pier Cashier');
  const [savingAction, setSavingAction] = useState(false);

  // Payment Detail Modal
  const [viewingPayment, setViewingPayment] = useState<FinancePayment | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [allP, allB, allProv] = await Promise.all([
        listPayments(),
        bookingRepository.listBookings(),
        listPaymentProviders(),
      ]);
      setPayments(allP);
      setBookings(allB);
      setProviders(allProv);
      if (allB.length > 0 && !selectedBookingRef) {
        setSelectedBookingRef(allB[0].bookingReference);
        setAmountInput(allB[0].pricing?.totalEur || 50);
      }
    } catch (err) {
      console.warn('Failed to load payments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // When selected booking changes in modal, auto-update amount to remaining due
  const handleBookingSelect = (ref: string) => {
    setSelectedBookingRef(ref);
    const b = bookings.find((item) => item.bookingReference === ref);
    if (b) {
      const bPayments = payments.filter(
        (p) =>
          (p.bookingReference === ref || p.bookingId === b.bookingId) &&
          (p.paymentStatus === 'Paid' || p.paymentStatus === 'paid')
      );
      const paidSoFar = bPayments.reduce((sum, p) => sum + p.amount, 0);
      const total = b.pricing?.totalEur || 0;
      const remaining = Math.max(0, total - paidSoFar);
      setAmountInput(remaining > 0 ? remaining : total);
      setCurrencyInput((b.pricing as any)?.currency || 'EUR');
    }
  };

  const handleOpenNewPayment = () => {
    if (bookings.length > 0 && !selectedBookingRef) {
      handleBookingSelect(bookings[0].bookingReference);
    } else if (selectedBookingRef) {
      handleBookingSelect(selectedBookingRef);
    }
    setTxRefInput(`TXN-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`);
    setNotesInput('Settlement recorded at marina departure pier.');
    setIsModalOpen(true);
  };

  const handleSubmitNewPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBookingRef) {
      showToast('Please select a booking reservation.', 'error');
      return;
    }
    if (amountInput <= 0) {
      showToast('Payment amount must be greater than zero.', 'error');
      return;
    }

    const b = bookings.find((item) => item.bookingReference === selectedBookingRef);
    if (!b) {
      showToast('Booking reference not found.', 'error');
      return;
    }

    // Check provider connection honesty
    const prov = providers.find((p) => p.id === providerInput);
    if (prov && !prov.isConnected && !prov.isManual) {
      showToast(
        `Provider "${prov.name}" is currently disconnected. Live API keys are not provisioned. Please choose an active manual provider (Cash Office, Pier POS, or Bank Wire).`,
        'error'
      );
      return;
    }

    setSavingAction(true);
    try {
      await recordPayment({
        bookingId: b.bookingId || b.bookingReference,
        bookingReference: b.bookingReference,
        customerId: (b as any).customerId || null,
        customerName: `${b.customer.firstName} ${b.customer.lastName}`,
        customerEmail: b.customer.email,
        customerPhone: b.customer.phoneNumber
          ? `${b.customer.countryCode || ''} ${b.customer.phoneNumber}`
          : null,
        amount: Number(amountInput),
        currency: currencyInput,
        paymentMethod: methodInput,
        provider: providerInput,
        paymentStatus: statusInput,
        transactionReference: txRefInput.trim(),
        notes: notesInput.trim(),
        recordedBy: recordedByInput.trim(),
      });

      showToast(`Payment of €${amountInput} successfully logged.`, 'success');
      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to record payment', 'error');
    } finally {
      setSavingAction(false);
    }
  };

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      if (statusFilter !== 'all') {
        const pNorm = p.paymentStatus.toLowerCase();
        const fNorm = statusFilter.toLowerCase();
        if (pNorm !== fNorm) return false;
      }
      if (methodFilter !== 'all' && p.paymentMethod !== methodFilter) return false;
      if (providerFilter !== 'all' && p.provider !== providerFilter) return false;
      if (currencyFilter !== 'all' && p.currency !== currencyFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          p.bookingReference.toLowerCase().includes(q) ||
          p.customerName.toLowerCase().includes(q) ||
          p.customerEmail.toLowerCase().includes(q) ||
          p.transactionReference.toLowerCase().includes(q) ||
          (p.notes && p.notes.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [payments, statusFilter, methodFilter, providerFilter, currencyFilter, searchQuery]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    const totalCollected = filteredPayments
      .filter((p) => p.paymentStatus === 'Paid' || p.paymentStatus === 'paid')
      .reduce((sum, p) => sum + p.amount, 0);

    const pendingCount = filteredPayments.filter(
      (p) => p.paymentStatus === 'Pending' || p.paymentStatus === 'pending'
    ).length;

    const manualCount = filteredPayments.filter((p) => p.isManual).length;

    return { totalCollected, pendingCount, manualCount };
  }, [filteredPayments]);

  const handleExportCSV = () => {
    const headers = [
      'ID',
      'Booking Ref',
      'Customer',
      'Email',
      'Amount',
      'Currency',
      'Method',
      'Provider',
      'Manual',
      'Status',
      'Tx Reference',
      'Date',
      'Recorded By',
    ];
    const rows = filteredPayments.map((p) => [
      p.id,
      p.bookingReference,
      `"${p.customerName}"`,
      p.customerEmail,
      p.amount,
      p.currency,
      p.paymentMethod,
      p.provider,
      p.isManual ? 'Yes' : 'No',
      p.paymentStatus,
      p.transactionReference,
      p.paymentDate,
      `"${p.recordedBy}"`,
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `payments_ledger_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] uppercase tracking-widest text-[#2dd4bf] font-bold block mb-0.5">
            Accounting Ledger & Cash Desk
          </span>
          <h1 className="text-2xl font-bold font-display text-white tracking-tight flex items-center space-x-2">
            <CreditCard className="w-6 h-6 text-[#2dd4bf]" />
            <span>Payments Management</span>
          </h1>
          <p className="text-xs text-stone-400 mt-1">
            Audited financial transactions. Providers strictly categorized with manual fallback indicators.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="px-3 py-2 bg-stone-900 border border-stone-800 rounded-xl text-stone-300 hover:text-white hover:border-stone-700 text-xs font-medium flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3 py-2 bg-stone-900 border border-stone-800 rounded-xl text-stone-300 hover:text-white hover:border-stone-700 text-xs font-medium flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-stone-400" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={handleOpenNewPayment}
            className="px-4 py-2 bg-[#0A6C74] hover:bg-[#08565d] text-white font-medium text-xs rounded-xl flex items-center space-x-1.5 transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Record Payment</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-stone-900/60 border border-stone-800/80 rounded-2xl p-4 flex items-center space-x-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <DollarSign className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-stone-400">Total Settled</span>
            <div className="text-xl font-bold font-mono text-white">€{metrics.totalCollected.toLocaleString()}</div>
          </div>
        </div>

        <div className="bg-stone-900/60 border border-stone-800/80 rounded-2xl p-4 flex items-center space-x-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-stone-400">Pending</span>
            <div className="text-xl font-bold font-mono text-amber-300">{metrics.pendingCount}</div>
          </div>
        </div>

        <div className="bg-stone-900/60 border border-stone-800/80 rounded-2xl p-4 flex items-center space-x-4">
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5 text-sky-400" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-stone-400">Transactions</span>
            <div className="text-xl font-bold font-mono text-white">{filteredPayments.length}</div>
          </div>
        </div>

        <div className="bg-stone-900/60 border border-stone-800/80 rounded-2xl p-4 flex items-center space-x-4">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-stone-400">Manual Marked</span>
            <div className="text-xl font-bold font-mono text-purple-300">{metrics.manualCount}</div>
          </div>
        </div>
      </div>

      {/* Provider Connectivity Notice */}
      <div className="bg-stone-900/80 border border-stone-800 rounded-2xl p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <Building className="w-5 h-5 text-[#2dd4bf] shrink-0" />
            <div>
              <h2 className="text-sm font-semibold text-white">Payment Provider Architecture & Status</h2>
              <p className="text-xs text-stone-400">
                Payment channels are strictly separated. Disconnected third-party providers cannot process transactions.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {providers.map((pr) => (
              <span
                key={pr.id}
                className={`text-[10px] px-2.5 py-1 rounded-full border font-medium flex items-center space-x-1 ${
                  pr.isConnected
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : 'bg-stone-800 text-stone-400 border-stone-700'
                }`}
                title={pr.description}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${pr.isConnected ? 'bg-emerald-400' : 'bg-stone-500'}`} />
                <span>{pr.name}</span>
                <span className="text-stone-500">({pr.isManual ? 'Manual' : pr.isConnected ? 'Live' : 'Disconnected'})</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-stone-900/60 border border-stone-800/80 rounded-2xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search reference, customer, email, tx code..."
            className="w-full bg-stone-950 border border-stone-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-stone-500 focus:outline-hidden focus:border-[#0A6C74]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs text-stone-300 focus:outline-hidden focus:border-[#0A6C74]"
          >
            <option value="all">All Statuses</option>
            <option value="paid">Paid</option>
            <option value="partially_paid">Partially Paid</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </select>

          <select
            value={providerFilter}
            onChange={(e) => setProviderFilter(e.target.value)}
            className="bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs text-stone-300 focus:outline-hidden focus:border-[#0A6C74]"
          >
            <option value="all">All Providers</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} {p.isManual ? '(Manual)' : ''}
              </option>
            ))}
          </select>

          <select
            value={currencyFilter}
            onChange={(e) => setCurrencyFilter(e.target.value)}
            className="bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs text-stone-300 focus:outline-hidden focus:border-[#0A6C74]"
          >
            <option value="all">All Currencies</option>
            <option value="EUR">EUR (€)</option>
            <option value="USD">USD ($)</option>
            <option value="GBP">GBP (£)</option>
            <option value="EGP">EGP</option>
          </select>
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-stone-900/60 border border-stone-800/80 rounded-2xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center">
            <RefreshCw className="w-8 h-8 text-[#0A6C74] animate-spin mx-auto mb-3" />
            <p className="text-xs text-stone-400">Loading verified payments ledger...</p>
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="p-12 text-center">
            <CreditCard className="w-10 h-10 text-stone-600 mx-auto mb-3" />
            <p className="text-sm font-semibold text-white">No payment transactions found</p>
            <p className="text-xs text-stone-500 mt-1">
              {searchQuery || statusFilter !== 'all'
                ? 'Try adjusting your search criteria.'
                : 'Record manual settlements or bookings to populate ledger.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-950/60 border-b border-stone-800 text-stone-400 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4 font-semibold">Payment / Tx Ref</th>
                  <th className="py-3 px-4 font-semibold">Booking Ref</th>
                  <th className="py-3 px-4 font-semibold">Customer</th>
                  <th className="py-3 px-4 font-semibold">Provider & Method</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold">Amount</th>
                  <th className="py-3 px-4 font-semibold">Date</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800/60 text-stone-300">
                {filteredPayments.map((p) => {
                  const statusNormalized = p.paymentStatus.toLowerCase();
                  const isPaid = statusNormalized === 'paid';
                  const isPartiallyPaid = statusNormalized === 'partially paid' || statusNormalized === 'partially_paid';
                  const isPending = statusNormalized === 'pending';
                  const isRefunded = statusNormalized === 'refunded';

                  return (
                    <tr key={p.id} className="hover:bg-stone-800/30 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-bold text-white text-[11px]">{p.transactionReference}</div>
                        <div className="text-[10px] text-stone-500 font-mono">ID: {p.id.substring(0, 12)}...</div>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-medium text-sky-400">
                        {p.bookingReference}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-white">{p.customerName}</div>
                        <div className="text-[10px] text-stone-400">{p.customerEmail}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-medium text-stone-200">{p.paymentMethod}</span>
                          {p.isManual && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-purple-500/10 border border-purple-500/20 text-purple-300 font-medium">
                              Manual
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-stone-400 capitalize">{p.provider || 'Desk'}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-semibold border ${
                            isPaid
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : isPartiallyPaid
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              : isPending
                              ? 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                              : isRefunded
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                              : 'bg-stone-800 text-stone-400 border-stone-700'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isPaid ? 'bg-emerald-400' : isPartiallyPaid ? 'bg-amber-400' : isRefunded ? 'bg-rose-400' : 'bg-sky-400'
                            }`}
                          />
                          <span className="capitalize">{p.paymentStatus}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-bold text-white text-sm">
                          {p.currency === 'EUR' ? '€' : p.currency === 'USD' ? '$' : p.currency === 'GBP' ? '£' : 'EGP '}
                          {p.amount.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-stone-500 uppercase">{p.currency}</div>
                      </td>
                      <td className="py-3.5 px-4 text-stone-400 text-[11px]">
                        <div>{new Date(p.paymentDate).toLocaleDateString()}</div>
                        <div className="text-[10px] text-stone-500">
                          {new Date(p.paymentDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setViewingPayment(p)}
                          className="px-2.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white text-[11px] font-medium transition-colors cursor-pointer inline-flex items-center space-x-1"
                        >
                          <Eye className="w-3 h-3 text-stone-400" />
                          <span>Audit</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record Payment Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-stone-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center space-x-2">
                  <CreditCard className="w-5 h-5 text-[#2dd4bf]" />
                  <span>Record Verified Settlement</span>
                </h3>
                <p className="text-xs text-stone-400 mt-0.5">
                  Transactions are logged directly into the financial ledger. Never enter raw card numbers or CVV.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-stone-400 hover:text-white text-sm cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitNewPayment} className="space-y-4">
              {/* Booking Selection */}
              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">
                  Select Reservation (Booking Reference)
                </label>
                <select
                  value={selectedBookingRef}
                  onChange={(e) => handleBookingSelect(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-[#0A6C74]"
                  required
                >
                  {bookings.map((b) => (
                    <option key={b.bookingReference} value={b.bookingReference}>
                      {b.bookingReference} — {b.customer.firstName} {b.customer.lastName} ({b.tourTitle}) [€
                      {b.pricing?.totalEur || 0}]
                    </option>
                  ))}
                </select>
              </div>

              {/* Amount & Currency */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-300 mb-1">
                    Settlement Amount
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={amountInput}
                    onChange={(e) => setAmountInput(parseFloat(e.target.value) || 0)}
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white focus:outline-hidden focus:border-[#0A6C74]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-300 mb-1">Operating Currency</label>
                  <select
                    value={currencyInput}
                    onChange={(e) => setCurrencyInput(e.target.value)}
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-[#0A6C74]"
                  >
                    <option value="EUR">EUR (€)</option>
                    <option value="USD">USD ($)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="EGP">EGP</option>
                  </select>
                </div>
              </div>

              {/* Payment Method & Provider */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-300 mb-1">Payment Method</label>
                  <select
                    value={methodInput}
                    onChange={(e) => setMethodInput(e.target.value as FinancePaymentMethod)}
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-[#0A6C74]"
                  >
                    <option value="Cash">Cash (Harbour / Pier Office)</option>
                    <option value="Card">Card (Mobile POS Terminal)</option>
                    <option value="Bank Transfer">Bank Transfer (CIB Wire)</option>
                    <option value="Online Payment">Online Gateway</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-300 mb-1">Payment Provider</label>
                  <select
                    value={providerInput}
                    onChange={(e) => setProviderInput(e.target.value)}
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-[#0A6C74]"
                  >
                    {providers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.isManual ? '(Manual Active)' : p.isConnected ? '(Connected)' : '(Disconnected)'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Transaction Reference & Cashier Name */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-300 mb-1">
                    Tx / Receipt / Slip Reference
                  </label>
                  <input
                    type="text"
                    value={txRefInput}
                    onChange={(e) => setTxRefInput(e.target.value)}
                    placeholder="e.g. POS-RECEIPT-9482"
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-hidden focus:border-[#0A6C74]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-300 mb-1">
                    Cashier / Recorded By
                  </label>
                  <input
                    type="text"
                    value={recordedByInput}
                    onChange={(e) => setRecordedByInput(e.target.value)}
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-[#0A6C74]"
                    required
                  />
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">Payment Status</label>
                <select
                  value={statusInput}
                  onChange={(e) => setStatusInput(e.target.value as FinancePaymentStatus)}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-[#0A6C74]"
                >
                  <option value="Paid">Paid (Full settlement)</option>
                  <option value="Partially Paid">Partially Paid (Deposit only)</option>
                  <option value="Pending">Pending</option>
                  <option value="Failed">Failed</option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">Auditing Notes</label>
                <textarea
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  rows={2}
                  placeholder="Optional audit comments or hotel pickup receipt reference..."
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl p-3 text-xs text-white focus:outline-hidden focus:border-[#0A6C74]"
                />
              </div>

              {/* Security Banner */}
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-start space-x-2 text-amber-300 text-[11px]">
                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  PCI-DSS Compliance Notice: Raw credit card numbers and CVV codes are never stored. Only external terminal transaction authorizations are retained.
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-medium rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAction}
                  className="px-5 py-2 bg-[#0A6C74] hover:bg-[#08565d] text-white text-xs font-medium rounded-xl transition-colors shadow-xs cursor-pointer flex items-center space-x-1.5"
                >
                  {savingAction ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  <span>Commit to Ledger</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Audit Detail Modal */}
      {viewingPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center space-x-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <span>Transaction Audit Trail</span>
                </h3>
                <p className="text-xs text-stone-400 mt-0.5">Reference: {viewingPayment.transactionReference}</p>
              </div>
              <button
                type="button"
                onClick={() => setViewingPayment(null)}
                className="text-stone-400 hover:text-white text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-stone-950 border border-stone-800/80 rounded-xl p-3 space-y-2">
                <div className="flex justify-between">
                  <span className="text-stone-400">Transaction ID:</span>
                  <span className="font-mono text-white">{viewingPayment.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Booking Reference:</span>
                  <span className="font-mono text-sky-400 font-bold">{viewingPayment.bookingReference}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Customer Name:</span>
                  <span className="text-white font-medium">{viewingPayment.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Customer Email:</span>
                  <span className="text-stone-300">{viewingPayment.customerEmail}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Settled Amount:</span>
                  <span className="font-mono text-emerald-400 font-bold text-sm">
                    {viewingPayment.currency === 'EUR' ? '€' : viewingPayment.currency}{' '}
                    {viewingPayment.amount.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Payment Channel:</span>
                  <span className="text-stone-200">
                    {viewingPayment.paymentMethod} ({viewingPayment.provider || 'Desk'})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Processing Mode:</span>
                  <span className="text-purple-300">{viewingPayment.isManual ? 'Manual Reconciliation' : 'Automated Gateway'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Status:</span>
                  <span className="text-emerald-300 uppercase font-bold">{viewingPayment.paymentStatus}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Recorded By:</span>
                  <span className="text-stone-200">{viewingPayment.recordedBy}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Timestamp:</span>
                  <span className="text-stone-300">{new Date(viewingPayment.paymentDate).toLocaleString()}</span>
                </div>
              </div>

              {viewingPayment.notes && (
                <div className="bg-stone-950/60 border border-stone-800 p-3 rounded-xl">
                  <span className="text-[10px] text-stone-500 uppercase font-bold block mb-1">Auditor Notes</span>
                  <p className="text-stone-300 text-xs italic">{viewingPayment.notes}</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-stone-800">
              {onNavigateTab && (
                <button
                  type="button"
                  onClick={() => {
                    setViewingPayment(null);
                    onNavigateTab('fin_invoices');
                  }}
                  className="text-xs text-sky-400 hover:text-sky-300 flex items-center space-x-1 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>View Linked Invoice</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setViewingPayment(null)}
                className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-white text-xs font-medium rounded-xl transition-colors cursor-pointer ml-auto"
              >
                Close Audit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
