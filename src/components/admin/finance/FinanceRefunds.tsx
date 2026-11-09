import React, { useState, useEffect, useMemo } from 'react';
import {
  RotateCcw,
  Search,
  Filter,
  Plus,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  Calendar,
  FileText,
  ShieldCheck,
  User,
  Download,
  XCircle,
  Clock,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import {
  listRefunds,
  requestRefund,
  approveRefund,
  processRefund,
  rejectRefund,
  listPayments,
} from '../../../services/financeService';
import { FinanceRefund, FinancePayment, RefundStatus } from '../../../types/finance';
import { bookingRepository } from '../../../services/bookingRepository';
import { Booking } from '../../../types/booking';
import { useToast } from '../../../contexts/ToastContext';

interface FinanceRefundsProps {
  onNavigateTab?: (tabId: string, param?: string) => void;
}

export const FinanceRefunds: React.FC<FinanceRefundsProps> = ({ onNavigateTab }) => {
  const { showToast } = useToast();
  const [refunds, setRefunds] = useState<FinanceRefund[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [payments, setPayments] = useState<FinancePayment[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currencyFilter, setCurrencyFilter] = useState<string>('all');

  // Request Refund Modal
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [selectedBookingRef, setSelectedBookingRef] = useState<string>('');
  const [requestedAmount, setRequestedAmount] = useState<number>(0);
  const [refundCurrency, setRefundCurrency] = useState<string>('EUR');
  const [refundReason, setRefundReason] = useState<string>(
    'Marine weather advisory - Coast Guard harbour closure'
  );
  const [refundMethod, setRefundMethod] = useState<FinanceRefund['refundMethod']>('Card Reversal');
  const [refundNotes, setRefundNotes] = useState<string>('Authorized by harbor operations supervisor.');
  const [requestedBy, setRequestedBy] = useState<string>('Operations Desk');
  const [requesting, setRequesting] = useState(false);

  // Approve Modal
  const [approvingRefund, setApprovingRefund] = useState<FinanceRefund | null>(null);
  const [approvedAmountInput, setApprovedAmountInput] = useState<number>(0);
  const [approvedByInput, setApprovedByInput] = useState<string>('Finance Manager');
  const [approvingAction, setApprovingAction] = useState(false);

  // Process / Disburse Modal
  const [processingRefund, setProcessingRefund] = useState<FinanceRefund | null>(null);
  const [disburseTxnRef, setDisburseTxnRef] = useState<string>('');
  const [processedByInput, setProcessedByInput] = useState<string>('Senior Treasury Auditor');
  const [processingAction, setProcessingAction] = useState(false);

  // Reject Modal
  const [rejectingRefund, setRejectingRefund] = useState<FinanceRefund | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('Non-refundable policy under 24 hours');
  const [rejectingAction, setRejectingAction] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [allRef, allB, allP] = await Promise.all([
        listRefunds(),
        bookingRepository.listBookings(),
        listPayments(),
      ]);
      setRefunds(allRef);
      setBookings(allB);
      setPayments(allP);
    } catch (err) {
      console.warn('Failed to load refunds:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter bookings that have actual recorded payments and remaining refundable headroom
  const refundableBookings = useMemo(() => {
    return bookings.filter((b) => {
      const bPayments = payments.filter(
        (p) =>
          (p.bookingReference === b.bookingReference || p.bookingId === b.bookingId) &&
          (p.paymentStatus === 'Paid' || p.paymentStatus === 'paid')
      );
      const totalPaid = bPayments.reduce((s, p) => s + p.amount, 0);
      const bRefunds = refunds.filter(
        (r) =>
          (r.bookingReference === b.bookingReference || r.bookingId === b.bookingId) &&
          r.status === 'processed'
      );
      const totalRefunded = bRefunds.reduce((s, r) => s + (r.approvedAmount || r.amount), 0);
      return totalPaid - totalRefunded > 0;
    });
  }, [bookings, payments, refunds]);

  const handleOpenRequestRefund = () => {
    if (refundableBookings.length > 0) {
      const first = refundableBookings[0];
      setSelectedBookingRef(first.bookingReference);
      // Auto set amount to max refundable
      const bPayments = payments.filter(
        (p) =>
          (p.bookingReference === first.bookingReference || p.bookingId === first.bookingId) &&
          (p.paymentStatus === 'Paid' || p.paymentStatus === 'paid')
      );
      const totalPaid = bPayments.reduce((s, p) => s + p.amount, 0);
      const bRefunds = refunds.filter(
        (r) =>
          (r.bookingReference === first.bookingReference || r.bookingId === first.bookingId) &&
          r.status === 'processed'
      );
      const totalRefunded = bRefunds.reduce((s, r) => s + (r.approvedAmount || r.amount), 0);
      setRequestedAmount(Math.max(0, totalPaid - totalRefunded));
      setRefundCurrency((first.pricing as any)?.currency || 'EUR');
    }
    setIsRequestModalOpen(true);
  };

  const handleBookingChange = (ref: string) => {
    setSelectedBookingRef(ref);
    const b = bookings.find((item) => item.bookingReference === ref);
    if (b) {
      const bPayments = payments.filter(
        (p) =>
          (p.bookingReference === ref || p.bookingId === b.bookingId) &&
          (p.paymentStatus === 'Paid' || p.paymentStatus === 'paid')
      );
      const totalPaid = bPayments.reduce((s, p) => s + p.amount, 0);
      const bRefunds = refunds.filter(
        (r) =>
          (r.bookingReference === ref || r.bookingId === b.bookingId) &&
          r.status === 'processed'
      );
      const totalRefunded = bRefunds.reduce((s, r) => s + (r.approvedAmount || r.amount), 0);
      setRequestedAmount(Math.max(0, totalPaid - totalRefunded));
      setRefundCurrency((b.pricing as any)?.currency || 'EUR');
    }
  };

  const handleSubmitRequestRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBookingRef) return;
    const b = bookings.find((item) => item.bookingReference === selectedBookingRef);
    if (!b) return;

    setRequesting(true);
    try {
      const res = await requestRefund({
        bookingId: b.bookingId || b.bookingReference,
        bookingReference: b.bookingReference,
        customerId: (b as any).customerId || null,
        customerName: `${b.customer.firstName} ${b.customer.lastName}`,
        customerEmail: b.customer.email,
        requestedAmount: Number(requestedAmount),
        currency: refundCurrency,
        reason: refundReason,
        refundMethod,
        requestedBy,
        notes: refundNotes,
      });

      if (res.success) {
        showToast(`Refund request logged: €${requestedAmount}. Pending manager approval.`, 'success');
        setIsRequestModalOpen(false);
        await loadData();
      } else {
        showToast(res.error || 'Failed to request refund', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error processing request', 'error');
    } finally {
      setRequesting(false);
    }
  };

  const handleOpenApprove = (r: FinanceRefund) => {
    setApprovingRefund(r);
    setApprovedAmountInput(r.requestedAmount || r.amount);
    setApprovedByInput('Finance Manager');
  };

  const handleSubmitApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!approvingRefund) return;
    setApprovingAction(true);
    try {
      const res = await approveRefund(approvingRefund.id, approvedAmountInput, approvedByInput);
      if (res.success) {
        showToast(`Refund approved for €${approvedAmountInput}. Ready for disbursement.`, 'success');
        setApprovingRefund(null);
        await loadData();
      } else {
        showToast(res.error || 'Failed to approve refund', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error approving refund', 'error');
    } finally {
      setApprovingAction(false);
    }
  };

  const handleOpenProcess = (r: FinanceRefund) => {
    setProcessingRefund(r);
    setDisburseTxnRef(`PAYOUT-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`);
    setProcessedByInput('Treasury Cashier');
  };

  const handleSubmitProcess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!processingRefund) return;
    setProcessingAction(true);
    try {
      const res = await processRefund(processingRefund.id, processedByInput, disburseTxnRef);
      if (res.success) {
        showToast(
          `Refund disbursed successfully. Ledger balance and booking status updated.`,
          'success'
        );
        setProcessingRefund(null);
        await loadData();
      } else {
        showToast(res.error || 'Failed to disburse refund', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error executing refund disbursement', 'error');
    } finally {
      setProcessingAction(false);
    }
  };

  const handleOpenReject = (r: FinanceRefund) => {
    setRejectingRefund(r);
    setRejectReason('Non-refundable cancellation past cutoff window.');
  };

  const handleSubmitReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingRefund) return;
    setRejectingAction(true);
    try {
      const res = await rejectRefund(rejectingRefund.id, 'Finance Manager', rejectReason);
      if (res.success) {
        showToast('Refund request rejected and recorded in audit log.', 'info');
        setRejectingRefund(null);
        await loadData();
      } else {
        showToast(res.error || 'Failed to reject refund', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error rejecting refund', 'error');
    } finally {
      setRejectingAction(false);
    }
  };

  const filteredRefunds = useMemo(() => {
    return refunds.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (currencyFilter !== 'all' && r.currency !== currencyFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          r.bookingReference.toLowerCase().includes(q) ||
          r.customerName.toLowerCase().includes(q) ||
          r.reason.toLowerCase().includes(q) ||
          r.transactionReference.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [refunds, statusFilter, currencyFilter, searchQuery]);

  // Aggregate metrics
  const metrics = useMemo(() => {
    const processedTotal = refunds
      .filter((r) => r.status === 'processed')
      .reduce((sum, r) => sum + (r.approvedAmount || r.amount), 0);

    const pendingCount = refunds.filter((r) => r.status === 'pending_approval' || r.status === 'requested').length;
    const approvedCount = refunds.filter((r) => r.status === 'approved').length;
    const rejectedCount = refunds.filter((r) => r.status === 'rejected').length;

    return { processedTotal, pendingCount, approvedCount, rejectedCount };
  }, [refunds]);

  const handleExportCSV = () => {
    const headers = [
      'ID',
      'Booking Ref',
      'Customer',
      'Requested Amount',
      'Approved Amount',
      'Currency',
      'Status',
      'Requested By',
      'Approved By',
      'Processed Date',
      'Method',
      'Tx Reference',
      'Reason',
    ];
    const rows = filteredRefunds.map((r) => [
      r.id,
      r.bookingReference,
      `"${r.customerName}"`,
      r.requestedAmount || r.amount,
      r.approvedAmount || '',
      r.currency,
      r.status,
      `"${r.requestedBy}"`,
      r.approvedBy ? `"${r.approvedBy}"` : '',
      r.processedDate || '',
      r.refundMethod,
      r.transactionReference,
      `"${r.reason}"`,
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `refunds_audit_${new Date().toISOString().split('T')[0]}.csv`);
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
            Audit Trails & Returns Management
          </span>
          <h1 className="text-2xl font-bold font-display text-white tracking-tight flex items-center space-x-2">
            <RotateCcw className="w-6 h-6 text-[#2dd4bf]" />
            <span>Refunds & Financial Returns</span>
          </h1>
          <p className="text-xs text-stone-400 mt-1">
            Controlled refund approval and disbursement lifecycle. Only executed transactions impact ledger totals.
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
            onClick={handleOpenRequestRefund}
            className="px-4 py-2 bg-[#0A6C74] hover:bg-[#08565d] text-white font-medium text-xs rounded-xl flex items-center space-x-1.5 transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Request Refund</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-stone-900/60 border border-stone-800/80 rounded-2xl p-4 flex items-center space-x-4">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
            <RotateCcw className="w-5 h-5 text-rose-400" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-stone-400">Total Disbursed</span>
            <div className="text-xl font-bold font-mono text-white">€{metrics.processedTotal.toLocaleString()}</div>
          </div>
        </div>

        <div className="bg-stone-900/60 border border-stone-800/80 rounded-2xl p-4 flex items-center space-x-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-stone-400">Pending Review</span>
            <div className="text-xl font-bold font-mono text-amber-300">{metrics.pendingCount}</div>
          </div>
        </div>

        <div className="bg-stone-900/60 border border-stone-800/80 rounded-2xl p-4 flex items-center space-x-4">
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-sky-400" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-stone-400">Approved Payouts</span>
            <div className="text-xl font-bold font-mono text-sky-300">{metrics.approvedCount}</div>
          </div>
        </div>

        <div className="bg-stone-900/60 border border-stone-800/80 rounded-2xl p-4 flex items-center space-x-4">
          <div className="w-10 h-10 rounded-xl bg-stone-500/10 border border-stone-500/20 flex items-center justify-center shrink-0">
            <XCircle className="w-5 h-5 text-stone-400" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-stone-400">Rejected</span>
            <div className="text-xl font-bold font-mono text-stone-300">{metrics.rejectedCount}</div>
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
            placeholder="Search booking ref, customer, reason, reference..."
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
            <option value="pending_approval">Pending Approval</option>
            <option value="approved">Approved (Awaiting Payout)</option>
            <option value="processed">Processed (Completed)</option>
            <option value="rejected">Rejected</option>
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

      {/* Refunds Table */}
      <div className="bg-stone-900/60 border border-stone-800/80 rounded-2xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center">
            <RefreshCw className="w-8 h-8 text-[#0A6C74] animate-spin mx-auto mb-3" />
            <p className="text-xs text-stone-400">Loading refunds ledger...</p>
          </div>
        ) : filteredRefunds.length === 0 ? (
          <div className="p-12 text-center">
            <RotateCcw className="w-10 h-10 text-stone-600 mx-auto mb-3" />
            <p className="text-sm font-semibold text-white">No refund records found</p>
            <p className="text-xs text-stone-500 mt-1">
              Zero return disputes or cancellations filed.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-950/60 border-b border-stone-800 text-stone-400 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4 font-semibold">Booking / Audit Ref</th>
                  <th className="py-3 px-4 font-semibold">Customer</th>
                  <th className="py-3 px-4 font-semibold">Reason & Method</th>
                  <th className="py-3 px-4 font-semibold">Lifecycle Status</th>
                  <th className="py-3 px-4 font-semibold">Requested / Approved</th>
                  <th className="py-3 px-4 font-semibold">Stakeholders</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800/60 text-stone-300">
                {filteredRefunds.map((r) => {
                  const isProcessed = r.status === 'processed';
                  const isPending = r.status === 'pending_approval' || r.status === 'requested';
                  const isApproved = r.status === 'approved';
                  const isRejected = r.status === 'rejected';

                  return (
                    <tr key={r.id} className="hover:bg-stone-800/30 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-bold text-sky-400">{r.bookingReference}</div>
                        <div className="text-[10px] text-stone-500 font-mono">{r.transactionReference}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-white">{r.customerName}</div>
                        <div className="text-[10px] text-stone-400">{r.customerEmail}</div>
                      </td>
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="text-white truncate" title={r.reason}>{r.reason}</div>
                        <div className="text-[10px] text-stone-400">{r.refundMethod}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-semibold border ${
                            isProcessed
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : isApproved
                              ? 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                              : isPending
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isProcessed
                                ? 'bg-emerald-400'
                                : isApproved
                                ? 'bg-sky-400'
                                : isPending
                                ? 'bg-amber-400'
                                : 'bg-rose-400'
                            }`}
                          />
                          <span className="capitalize">
                            {r.status === 'pending_approval'
                              ? 'Pending Approval'
                              : r.status === 'approved'
                              ? 'Approved (Unpaid)'
                              : r.status === 'processed'
                              ? 'Disbursed'
                              : 'Rejected'}
                          </span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono">
                        <div className="font-bold text-white text-sm">
                          €{(r.approvedAmount || r.amount).toLocaleString()}
                        </div>
                        {r.approvedAmount && r.approvedAmount !== r.requestedAmount && (
                          <div className="text-[10px] text-stone-500 line-through">
                            Req: €{r.requestedAmount}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-[11px] text-stone-400">
                        <div>Req: <span className="text-stone-300">{r.requestedBy}</span></div>
                        {r.approvedBy && (
                          <div>Appr: <span className="text-emerald-400">{r.approvedBy}</span></div>
                        )}
                        {r.processedDate && (
                          <div className="text-[10px] text-stone-500">
                            Disbursed: {new Date(r.processedDate).toLocaleDateString()}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-1.5">
                        {isPending && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleOpenApprove(r)}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-[11px] font-medium border border-emerald-500/30 transition-colors cursor-pointer"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenReject(r)}
                              className="px-2.5 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 text-[11px] font-medium border border-rose-500/30 transition-colors cursor-pointer"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {isApproved && (
                          <button
                            type="button"
                            onClick={() => handleOpenProcess(r)}
                            className="px-3 py-1.5 rounded-lg bg-[#0A6C74] hover:bg-[#08565d] text-white text-[11px] font-medium transition-colors shadow-xs cursor-pointer inline-flex items-center space-x-1"
                          >
                            <DollarSign className="w-3 h-3" />
                            <span>Disburse</span>
                          </button>
                        )}
                        {isProcessed && (
                          <span className="text-[11px] text-emerald-400 font-mono font-medium">Settled</span>
                        )}
                        {isRejected && (
                          <span className="text-[11px] text-rose-400 font-mono font-medium">Declined</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Request Refund Modal */}
      {isRequestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center space-x-2">
                  <RotateCcw className="w-5 h-5 text-amber-400" />
                  <span>Request Controlled Return / Refund</span>
                </h3>
                <p className="text-xs text-stone-400 mt-0.5">
                  Submits a refund request for manager review. Balances are only adjusted when disbursed.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsRequestModalOpen(false)}
                className="text-stone-400 hover:text-white text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitRequestRefund} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-stone-300 mb-1">
                  Select Paid Booking Reservation
                </label>
                <select
                  value={selectedBookingRef}
                  onChange={(e) => handleBookingChange(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-[#0A6C74]"
                  required
                >
                  {refundableBookings.map((b) => (
                    <option key={b.bookingReference} value={b.bookingReference}>
                      {b.bookingReference} — {b.customer.firstName} {b.customer.lastName} ({b.tourTitle})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-stone-300 mb-1">Requested Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={requestedAmount}
                    onChange={(e) => setRequestedAmount(parseFloat(e.target.value) || 0)}
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 font-mono font-bold text-white focus:outline-hidden focus:border-[#0A6C74]"
                    required
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-300 mb-1">Currency</label>
                  <select
                    value={refundCurrency}
                    onChange={(e) => setRefundCurrency(e.target.value)}
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-white focus:outline-hidden focus:border-[#0A6C74]"
                  >
                    <option value="EUR">EUR (€)</option>
                    <option value="USD">USD ($)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="EGP">EGP</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-stone-300 mb-1">Disbursement Channel</label>
                  <select
                    value={refundMethod}
                    onChange={(e) => setRefundMethod(e.target.value as any)}
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-white focus:outline-hidden focus:border-[#0A6C74]"
                  >
                    <option value="Card Reversal">Card Reversal (POS Terminal)</option>
                    <option value="Cash Return">Cash Return (Marina Office)</option>
                    <option value="Bank Wire">Bank Wire Transfer</option>
                    <option value="Store Credit / Voucher">Credit Voucher</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-stone-300 mb-1">Requested By</label>
                  <input
                    type="text"
                    value={requestedBy}
                    onChange={(e) => setRequestedBy(e.target.value)}
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-white focus:outline-hidden focus:border-[#0A6C74]"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-stone-300 mb-1">Primary Justification</label>
                <input
                  type="text"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-white focus:outline-hidden focus:border-[#0A6C74]"
                  required
                />
              </div>

              <div>
                <label className="block font-medium text-stone-300 mb-1">Supervisor Notes</label>
                <textarea
                  value={refundNotes}
                  onChange={(e) => setRefundNotes(e.target.value)}
                  rows={2}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl p-3 text-white focus:outline-hidden focus:border-[#0A6C74]"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsRequestModalOpen(false)}
                  className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={requesting}
                  className="px-5 py-2 bg-[#0A6C74] hover:bg-[#08565d] text-white font-medium rounded-xl transition-colors shadow-xs cursor-pointer flex items-center space-x-1.5"
                >
                  {requesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  <span>Submit for Approval</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Approve Refund Modal */}
      {approvingRefund && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 text-xs">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span>Approve Refund Amount</span>
              </h3>
              <button
                type="button"
                onClick={() => setApprovingRefund(null)}
                className="text-stone-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-stone-300">
              You are authorizing return for booking <strong className="text-sky-400">{approvingRefund.bookingReference}</strong> ({approvingRefund.customerName}).
            </p>

            <form onSubmit={handleSubmitApprove} className="space-y-4">
              <div>
                <label className="block text-stone-300 font-medium mb-1">Approved Payout Amount (€)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={approvedAmountInput}
                  onChange={(e) => setApprovedAmountInput(parseFloat(e.target.value) || 0)}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 font-mono font-bold text-white focus:outline-hidden focus:border-[#0A6C74]"
                  required
                />
              </div>

              <div>
                <label className="block text-stone-300 font-medium mb-1">Approving Officer Name</label>
                <input
                  type="text"
                  value={approvedByInput}
                  onChange={(e) => setApprovedByInput(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-white focus:outline-hidden focus:border-[#0A6C74]"
                  required
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => setApprovingRefund(null)}
                  className="px-4 py-2 bg-stone-800 text-stone-300 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={approvingAction}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl cursor-pointer flex items-center space-x-1"
                >
                  {approvingAction ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  <span>Confirm Approval</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Disburse / Process Refund Modal */}
      {processingRefund && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 text-xs">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <DollarSign className="w-5 h-5 text-[#2dd4bf]" />
                <span>Execute Payout Disbursement</span>
              </h3>
              <button
                type="button"
                onClick={() => setProcessingRefund(null)}
                className="text-stone-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-amber-300 text-[11px]">
              Confirming execution will immediately debit the net ledger revenue and record the timestamped audit log.
            </div>

            <form onSubmit={handleSubmitProcess} className="space-y-4">
              <div>
                <label className="block text-stone-300 font-medium mb-1">
                  Disbursed Amount: €{processingRefund.approvedAmount || processingRefund.requestedAmount}
                </label>
                <span className="text-stone-400 text-[11px]">Method: {processingRefund.refundMethod}</span>
              </div>

              <div>
                <label className="block text-stone-300 font-medium mb-1">
                  Bank / POS / Slip Authorization Reference
                </label>
                <input
                  type="text"
                  value={disburseTxnRef}
                  onChange={(e) => setDisburseTxnRef(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 font-mono text-white focus:outline-hidden focus:border-[#0A6C74]"
                  required
                />
              </div>

              <div>
                <label className="block text-stone-300 font-medium mb-1">Treasury Officer</label>
                <input
                  type="text"
                  value={processedByInput}
                  onChange={(e) => setProcessedByInput(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-white focus:outline-hidden focus:border-[#0A6C74]"
                  required
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => setProcessingRefund(null)}
                  className="px-4 py-2 bg-stone-800 text-stone-300 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processingAction}
                  className="px-5 py-2 bg-[#0A6C74] hover:bg-[#08565d] text-white font-medium rounded-xl cursor-pointer flex items-center space-x-1"
                >
                  {processingAction ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  <span>Disburse Funds</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectingRefund && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 text-xs">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <XCircle className="w-5 h-5 text-rose-400" />
                <span>Reject Refund Request</span>
              </h3>
              <button
                type="button"
                onClick={() => setRejectingRefund(null)}
                className="text-stone-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitReject} className="space-y-4">
              <div>
                <label className="block text-stone-300 font-medium mb-1">Rejection Reason</label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl p-3 text-white focus:outline-hidden focus:border-[#0A6C74]"
                  required
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => setRejectingRefund(null)}
                  className="px-4 py-2 bg-stone-800 text-stone-300 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={rejectingAction}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-medium rounded-xl cursor-pointer flex items-center space-x-1"
                >
                  {rejectingAction ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  <span>Decline Request</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
