import { serializeSpreadsheetRows } from '../../utils/spreadsheetExport';
import React, { useState, useEffect } from 'react';
import {
  CalendarCheck,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  User,
  Phone,
  Mail,
  MapPin,
  Eye,
  FileSpreadsheet,
  AlertTriangle,
  Download,
} from 'lucide-react';
import { bookingRepository } from '../../services/bookingRepository';
import { Booking, BookingStatus } from '../../types/booking';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { listPayments, listRefunds, recordPayment } from '../../services/financeService';

export const AdminBookingsList: React.FC = () => {
  const { showToast } = useToast();
  const { hasPermission, user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [bookingToCancel, setBookingToCancel] = useState<Booking | null>(null);
  const [cancelReason, setCancelReason] = useState('Customer requested cancellation');
  const [paymentToRecord, setPaymentToRecord] = useState<Booking | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Card' | 'Bank Transfer' | 'Other'>('Cash');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [bookingToRejectCancellation, setBookingToRejectCancellation] = useState<Booking | null>(null);
  const [savingPayment, setSavingPayment] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingManifest, setLoadingManifest] = useState(false);
  const [manifestError, setManifestError] = useState<string | null>(null);

  const openBookingDetails = async (booking: Booking) => {
    setSelectedBooking(booking);
    setManifestError(null);
    if (!hasPermission('bookings.manage')) return;

    setLoadingManifest(true);
    try {
      const detailed = await bookingRepository.getAdminBookingDetails(booking.bookingReference);
      if (detailed) setSelectedBooking(detailed);
    } catch (err: any) {
      setManifestError(err.message || 'Passenger details could not be loaded.');
      showToast(err.message || 'Passenger details could not be loaded.', 'error');
    } finally {
      setLoadingManifest(false);
    }
  };

  const loadBookings = async () => {
    setLoading(true);
    try {
      setLoadError(null);
      const data = await bookingRepository.listBookings();
      setBookings(data);
      setPage(1);
    } catch (err: any) {
      console.error('Error fetching bookings:', err);
      setLoadError(err.message || 'Failed to load bookings from database');
      showToast(err.message || 'Failed to load bookings from database', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBookings();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const isAdminOrSuperAdmin = user?.role === 'admin' || user?.role === 'super_admin' || Boolean(user?.roles?.some((role) => role === 'admin' || role === 'super_admin'));

  const handleUpdateStatus = async (ref: string, newStatus: BookingStatus) => {
    const currentBooking = bookings.find((item) => item.bookingReference === ref);
    if (currentBooking?.status === 'completed' && currentBooking.paymentStatus === 'paid' && !isAdminOrSuperAdmin) {
      showToast('This booking is completed and paid. Only Admin or Superadmin can change its status.', 'error');
      return;
    }
    if (!hasPermission(newStatus === 'cancelled' ? 'bookings.approve' : 'bookings.update')) {
      showToast('Your role does not permit this booking action.', 'error'); return;
    }
    if (newStatus === 'cancelled') {
      const b = bookings.find((item) => item.bookingReference === ref);
      if (b) {
        setBookingToCancel(b);
        return;
      }
    }

    const existing = bookings.find((b) => b.bookingReference === ref);
    if (!existing) return;

    const updated: Booking = {
      ...existing,
      status: newStatus,
      updatedAt: new Date().toISOString(),
      timeline: [
        ...(existing.timeline || []),
        {
          id: `ev-${Date.now()}`,
          timestamp: new Date().toISOString(),
          title: `Status Changed to ${newStatus.toUpperCase()}`,
          description: `Updated by administrator`,
          type: newStatus === 'cancelled' ? 'cancellation' : 'modification',
        },
      ],
    };

    try {
      await bookingRepository.updateBooking(updated);
      showToast(`Booking ${ref} marked as ${newStatus.toUpperCase()}`, 'success');
      if (selectedBooking?.bookingReference === ref) {
        setSelectedBooking(updated);
      }
      await loadBookings();
    } catch (err: any) {
      showToast(err.message || 'Failed to update booking status', 'error');
    }
  };

  const confirmRecordPayment = async () => {
    if (!paymentToRecord || !hasPermission('finance.create')) return;
    setSavingPayment(true);
    try {
      const currency = String(paymentToRecord.pricing?.currency || 'EUR').toUpperCase();
      const existingPayments = await listPayments({ bookingId: paymentToRecord.bookingReference, currency });
      const settled = existingPayments
        .filter((payment) => ['paid', 'partially paid', 'partially_paid'].includes(String(payment.paymentStatus).toLowerCase()))
        .reduce((sum, payment) => sum + payment.amount, 0);
      const existingRefunds = await listRefunds({ bookingId: paymentToRecord.bookingReference });
      const refunded = existingRefunds
        .filter((refund) => refund.currency === currency && refund.status === 'processed')
        .reduce((sum, refund) => sum + (refund.approvedAmount || refund.amount), 0);
      const netPaid = Math.max(0, settled - refunded);
      const bookingTotal = Number(paymentToRecord.pricing?.totalEur || 0);
      const remaining = Math.max(0, Math.round((bookingTotal - netPaid) * 100) / 100);
      if (remaining <= 0) throw new Error('This booking has no outstanding balance in the payment ledger.');
      const amount = Number(paymentAmount);
      if (!Number.isFinite(amount) || amount <= 0 || Math.abs(amount * 100 - Math.round(amount * 100)) > 0.000001) {
        throw new Error('Enter a valid payment amount with no more than two decimal places.');
      }
      if (amount > remaining + 0.00001) {
        throw new Error(`The payment exceeds the remaining balance of ${currency} ${remaining.toFixed(2)}.`);
      }
      if (!paymentReference.trim() || paymentReference.trim().length < 3 || paymentReference.trim().length > 160) {
        throw new Error('Enter the actual receipt or transaction reference (3–160 characters).');
      }
      await recordPayment({
        bookingId: paymentToRecord.bookingId || paymentToRecord.bookingReference,
        bookingReference: paymentToRecord.bookingReference,
        customerName: `${paymentToRecord.customer.firstName} ${paymentToRecord.customer.lastName}`,
        customerEmail: paymentToRecord.customer.email,
        customerPhone: paymentToRecord.customer.phoneNumber || null,
        amount,
        currency,
        paymentMethod,
        provider: paymentMethod === 'Cash' ? 'cash' : paymentMethod === 'Card' ? 'pos_terminal' : 'bank_transfer',
        paymentStatus: 'Paid',
        transactionReference: paymentReference.trim(),
        notes: paymentNotes.trim() || `Manual payment recorded from booking ${paymentToRecord.bookingReference}`,
        recordedBy: user?.email || 'Authenticated staff',
      });
      showToast(`Payment of ${currency} ${amount.toFixed(2)} recorded in the audited ledger.`, 'success');
      setPaymentToRecord(null);
      setPaymentAmount('');
      setPaymentReference('');
      try {
        const refreshedBookings = await bookingRepository.listBookings();
        setBookings(refreshedBookings);
        const refreshed = refreshedBookings.find((item) => item.bookingReference === paymentToRecord.bookingReference);
        if (selectedBooking?.bookingReference === paymentToRecord.bookingReference && refreshed) {
          setSelectedBooking({ ...selectedBooking, paymentStatus: refreshed.paymentStatus });
        }
      } catch (refreshError: any) {
        showToast('Payment was recorded, but the booking display could not be refreshed. Reload the booking list to see the updated balance.', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to record payment', 'error');
    } finally {
      setSavingPayment(false);
    }
  };

  const confirmCancelBooking = async () => {
    if (!hasPermission('bookings.approve')) { showToast('Your role does not permit booking cancellation approval.', 'error'); return; }
    if (!bookingToCancel) return;
    const ref = bookingToCancel.bookingReference;
    try {
      const resolved = await bookingRepository.resolveBookingCancellation(ref, 'approve', cancelReason);
      if (!resolved) throw new Error('Booking not found.');
      showToast(`Booking ${ref} cancelled and capacity released.`, 'info');
      if (selectedBooking?.bookingReference === ref) {
        setSelectedBooking({
          ...bookingToCancel,
          status: 'cancelled',
          cancellationReason: cancelReason,
        });
      }
      setBookingToCancel(null);
      await loadBookings();
    } catch (err: any) {
      showToast(err.message || 'Failed to cancel booking', 'error');
    }
  };

  const confirmRejectCancellation = async () => {
    if (!hasPermission('bookings.approve')) {
      showToast('Your role does not permit cancellation decisions.', 'error');
      return;
    }
    if (!bookingToRejectCancellation) return;
    const reason = rejectionReason.trim();
    if (reason.length < 5 || reason.length > 500) {
      showToast('Provide a rejection reason between 5 and 500 characters.', 'error');
      return;
    }
    const ref = bookingToRejectCancellation.bookingReference;
    try {
      const resolved = await bookingRepository.resolveBookingCancellation(ref, 'reject', reason);
      if (!resolved) throw new Error('Booking not found.');
      showToast(`Cancellation request for ${ref} was rejected.`, 'success');
      if (selectedBooking?.bookingReference === ref) {
        setSelectedBooking({ ...selectedBooking, status: resolved.status, cancellationReason: reason });
      }
      setBookingToRejectCancellation(null);
      setRejectionReason('');
      await loadBookings();
    } catch (err: any) {
      showToast(err.message || 'Failed to reject cancellation request.', 'error');
    }
  };

  const exportBookingsCSV = () => {
    if (!hasPermission('bookings.export')) { showToast('Your role does not permit exporting bookings.', 'error'); return; }
    const headers = [
      'Booking Reference',
      'Tour Title',
      'Tour Language',
      'Date',
      'Customer Name',
      'Email',
      'Phone',
      'Country',
      'Hotel',
      'Adults',
      'Children',
      'Infants',
      'Total',
      'Currency',
      'Status',
      'Payment Status',
      'Created At',
    ];

    const rows = filtered.map((b) => [
      `${b.bookingReference}`,
      `${b.tourTitle}`,
      `${(b.tourLanguage || '')}`,
      `${b.date}`,
      `${b.customer.firstName} ${b.customer.lastName}`,
      `${b.customer.email}`,
      `${b.customer.countryCode} ${b.customer.phoneNumber}`,
      `${b.customer.country}`,
      `${b.pickup.hotelName || ''}`,
      b.guests.adults,
      b.guests.children,
      b.guests.infants,
      b.pricing.totalEur,
      b.pricing.currency || 'EUR',
      `${b.status}`,
      `${b.paymentStatus}`,
      `${b.createdAt}`,
    ]);

    const csvContent = serializeSpreadsheetRows([headers, ...rows]);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `redsea_bookings_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`Exported ${filtered.length} booking records to CSV.`, 'success');
  };

  const filtered = bookings.filter((b) => {
    const matchSearch =
      b.bookingReference.toLowerCase().includes(search.toLowerCase()) ||
      b.customer.firstName.toLowerCase().includes(search.toLowerCase()) ||
      b.customer.lastName.toLowerCase().includes(search.toLowerCase()) ||
      b.customer.email.toLowerCase().includes(search.toLowerCase()) ||
      b.tourTitle.toLowerCase().includes(search.toLowerCase());

    if (!matchSearch) return false;
    if (statusFilter === 'all') return true;
    return b.status === statusFilter;
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginatedBookings = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display text-white tracking-tight">
            Bookings & Reservations
          </h1>
          <p className="text-xs text-stone-400 mt-1">
            View and manage customer reservations and booking details.
          </p>
        </div>

        <div className="flex items-center space-x-3 text-xs text-stone-400">
          {hasPermission('bookings.export') && <button
            type="button"
            onClick={exportBookingsCSV}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded font-medium border border-stone-700 transition-colors cursor-pointer"
            title="Download reservations as CSV"
          >
            <Download className="w-3.5 h-3.5 text-[#2dd4bf]" />
            <span>Export CSV ({filtered.length})</span>
          </button>}
          <span>
            Total: <strong className="text-white font-bold">{bookings.length}</strong>
          </span>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="bg-stone-950 p-4 rounded-lg border border-stone-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by reference, guest name, email, or tour..."
            className="w-full pl-9 pr-4 py-2 bg-stone-900 border border-stone-800 rounded text-xs text-white placeholder-stone-500 focus:outline-none focus:border-[#0A6C74]"
          />
        </div>

        <div className="flex items-center space-x-1.5 overflow-x-auto text-xs">
          {['all', 'confirmed', 'pending', 'cancellation_requested', 'cancelled', 'completed'].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded capitalize whitespace-nowrap transition-colors ${
                statusFilter === st
                  ? 'bg-[#0A6C74] text-white font-semibold'
                  : 'bg-stone-900 text-stone-400 hover:text-stone-200 border border-stone-800'
              }`}
            >
              {st.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Bookings Table */}
      <div className="bg-stone-950 border border-stone-800 rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-stone-400 space-y-2">
            <div className="w-6 h-6 border-2 border-[#0A6C74] border-t-transparent rounded-full animate-spin mx-auto" />
            <p>Loading bookings from database...</p>
          </div>
        ) : loadError ? (
          <div className="p-8 text-center text-sm text-rose-300 space-y-3">
            <p>{loadError}</p>
            <button type="button" onClick={loadBookings} className="rounded border border-rose-500/40 px-3 py-2 text-xs hover:bg-rose-500/10">Retry loading bookings</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-xs text-stone-400">
            No booking records match your criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-900/80 text-stone-400 border-b border-stone-800">
                <tr>
                  <th className="py-3 px-4 font-semibold">Reference</th>
                  <th className="py-3 px-4 font-semibold">Guest Contact</th>
                  <th className="py-3 px-4 font-semibold">Excursion</th>
                  <th className="py-3 px-4 font-semibold">Trip Date</th>
                  <th className="py-3 px-4 font-semibold">Party</th>
                  <th className="py-3 px-4 font-semibold">Total</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800/60 text-stone-300">
                {paginatedBookings.map((b) => (
                  <tr key={b.bookingReference} className="hover:bg-stone-900/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-white">
                      {b.bookingReference}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-stone-200 block truncate max-w-[160px]">
                        {b.customer.firstName} {b.customer.lastName}
                      </span>
                      <span className="text-[11px] text-stone-400 block truncate max-w-[160px]">
                        {b.customer.email}
                      </span>
                    </td>
                    <td className="py-3 px-4 max-w-[200px]">
                      <span className="truncate block font-medium text-stone-200">
                        {b.tourTitle}
                      </span>
                      <span className="text-[10px] text-stone-400">
                        Pickup: {b.pickup.hotelName || 'Central Marina'}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-medium text-stone-200">
                      {b.date}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-stone-400">
                      {b.guests.adults}A {b.guests.children > 0 ? `+ ${b.guests.children}C` : ''} {b.guests.infants > 0 ? `+ ${b.guests.infants}I` : ''}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-bold text-white">
                      {b.pricing.currency || 'EUR'} {Number(b.pricing.totalEur).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold capitalize ${
                          b.status === 'confirmed'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : b.status === 'completed'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            : b.status === 'cancellation_requested'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : b.status === 'cancelled'
                            ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {b.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => void openBookingDetails(b)}
                        className="px-2.5 py-1 bg-stone-900 hover:bg-stone-800 text-stone-300 hover:text-white rounded border border-stone-800 text-[11px] font-medium transition-colors"
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {!loading && !loadError && filtered.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-400">
          <span>Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} of {filtered.length} matching bookings</span>
          <div className="flex items-center gap-2">
            <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded border border-stone-700 px-3 py-1.5 disabled:opacity-40">Previous</button>
            <span>Page {page} of {totalPages}</span>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} className="rounded border border-stone-700 px-3 py-1.5 disabled:opacity-40">Next</button>
          </div>
        </div>
      )}

      {/* DETAIL MODAL */}
      {selectedBooking && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-lg max-w-2xl w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto text-xs">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <div>
                <span className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold">
                  Reservation Inspection
                </span>
                <h3 className="text-lg font-bold text-white font-mono">
                  {selectedBooking.bookingReference}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBooking(null)}
                className="text-stone-400 hover:text-white text-base"
              >
                ✕
              </button>
            </div>

            {/* Quick Status & Payment Controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-stone-950 p-3 rounded border border-stone-800 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-stone-400 block">Booking Status:</span>
                  <span className="text-xs font-bold text-white capitalize">
                    {selectedBooking.status.replace('_', ' ')}
                  </span>
                </div>

                <div className="flex items-center space-x-1.5">
                  {hasPermission('bookings.update') && (selectedBooking.status !== 'completed' || selectedBooking.paymentStatus !== 'paid' || isAdminOrSuperAdmin) && <>
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus(selectedBooking.bookingReference, 'confirmed')}
                    className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-medium text-[10px]"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus(selectedBooking.bookingReference, 'completed')}
                    className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium text-[10px]"
                  >
                    Complete
                  </button>
                  </>}
                  {hasPermission('bookings.approve') && selectedBooking.status === 'cancellation_requested' && <>
                    <button type="button" onClick={() => { setBookingToCancel(selectedBooking); setCancelReason(selectedBooking.cancellationReason || 'Customer requested cancellation'); }} className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white rounded font-medium text-[10px]">Approve Request</button>
                    <button type="button" onClick={() => { setBookingToRejectCancellation(selectedBooking); setRejectionReason(''); }} className="px-2 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded font-medium text-[10px]">Reject Request</button>
                  </>}
                  {hasPermission('bookings.approve') && selectedBooking.status !== 'cancellation_requested' && (selectedBooking.status !== 'completed' || selectedBooking.paymentStatus !== 'paid' || isAdminOrSuperAdmin) && <button type="button" onClick={() => handleUpdateStatus(selectedBooking.bookingReference, 'cancelled')} className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white rounded font-medium text-[10px]">Cancel</button>}
                </div>
              </div>

              <div className="bg-stone-950 p-3 rounded border border-stone-800 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-stone-400 block">Payment Status:</span>
                  <span className={`text-xs font-bold uppercase ${
                    selectedBooking.paymentStatus === 'paid' ? 'text-emerald-400' :
                    selectedBooking.paymentStatus === 'refunded' ? 'text-red-400' : 'text-amber-400'
                  }`}>
                    {selectedBooking.paymentStatus || 'pending'}
                  </span>
                </div>

                <div className="flex flex-col items-end gap-2">
                  {hasPermission('finance.create') && !['paid', 'refunded'].includes(selectedBooking.paymentStatus) && (
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentToRecord(selectedBooking);
                        setPaymentMethod('Cash');
                        setPaymentNotes('');
                        setPaymentAmount('');
                        setPaymentReference('');
                      }}
                      className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded font-medium text-[10px]"
                    >
                      Record Payment
                    </button>
                  )}
                  <p className="max-w-xs text-right text-[10px] leading-relaxed text-stone-500">
                    Payment status follows recorded payments and processed refunds. Refunds must be managed through the Finance refund workflow.
                  </p>
                </div>
              </div>
            </div>

            {selectedBooking.status === 'completed' && selectedBooking.paymentStatus === 'paid' && !isAdminOrSuperAdmin && <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">This booking is completed and paid. Status changes are restricted to Admin and Superadmin.</p>}

            {/* Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3 bg-stone-950 p-3 rounded border border-stone-800">
                <h4 className="font-semibold text-white uppercase text-[10px] tracking-wider text-stone-400">
                  Guest Information
                </h4>
                <div className="space-y-1.5 text-stone-300">
                  <p><strong>Name:</strong> {selectedBooking.customer.firstName} {selectedBooking.customer.lastName}</p>
                  <p><strong>Email:</strong> {selectedBooking.customer.email}</p>
                  <p><strong>Phone:</strong> {selectedBooking.customer.countryCode} {selectedBooking.customer.phoneNumber}</p>
                  <p><strong>Country:</strong> {selectedBooking.customer.country}</p>
                  <p><strong>Hotel:</strong> {selectedBooking.pickup.hotelName} (Room {selectedBooking.pickup.roomNumber || 'N/A'})</p>
                </div>
              </div>

              <div className="space-y-3 bg-stone-950 p-3 rounded border border-stone-800">
                <h4 className="font-semibold text-white uppercase text-[10px] tracking-wider text-stone-400">
                  Trip & Pricing Breakdown
                </h4>
                <div className="space-y-1.5 text-stone-300">
                  <p><strong>Tour:</strong> {selectedBooking.tourTitle}</p>
                  <p><strong>Booking Type:</strong> {selectedBooking.bookingKind === 'exclusive' ? 'Exclusive private trip · fixed price for the entire trip' : 'Standard excursion'}</p>
                  <p><strong>Tour Language:</strong> {selectedBooking.tourLanguage || 'Not recorded'}</p>
                  <p><strong>Date:</strong> {selectedBooking.date}</p>
                  <p><strong>Party:</strong> {selectedBooking.bookingKind === 'exclusive' ? `${selectedBooking.guests.adults + selectedBooking.guests.children + selectedBooking.guests.infants} guests · entire private trip` : `${selectedBooking.guests.adults} Adults, ${selectedBooking.guests.children} Children, ${selectedBooking.guests.infants} Infants`}</p>
                  <p><strong>Payment Method:</strong> {selectedBooking.paymentMethod.replace('_', ' ')}</p>
                  <p><strong>Pickup:</strong> {selectedBooking.pickup.locationName} — {selectedBooking.pickup.hotelName || 'Not specified'} (Room {selectedBooking.pickup.roomNumber || 'N/A'})</p>
                  <p className="text-sm font-bold text-white pt-1">Total: {selectedBooking.pricing.currency || 'EUR'} {Number(selectedBooking.pricing.totalEur).toFixed(2)}</p>
                </div>
              </div>
            </div>

            <div className="space-y-3 rounded border border-stone-800 bg-stone-950 p-3">
              <h4 className="font-semibold uppercase tracking-wider text-[10px] text-stone-400">Passenger Manifest</h4>
              {!hasPermission('bookings.manage') ? (
                <p className="text-[11px] text-stone-500">Passenger details are restricted to booking managers. Guest counts remain visible above.</p>
              ) : loadingManifest ? (
                <p className="text-[11px] text-stone-400">Loading passenger details…</p>
              ) : manifestError ? (
                <p className="text-[11px] text-rose-300">{manifestError}</p>
              ) : selectedBooking.passengers?.length ? (
                <div className="space-y-2">
                  {selectedBooking.passengers.map((passenger) => (
                    <div key={passenger.id} className="rounded border border-stone-800 p-2 text-stone-300">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <strong>{passenger.fullName}</strong>
                        <span className="text-[10px] uppercase text-teal-300">{passenger.passengerType}{passenger.isLeadPassenger ? ' · Lead passenger' : ''}</span>
                      </div>
                      <p className="text-[11px] text-stone-400">
                        {[passenger.nationality, passenger.dateOfBirth, passenger.gender, passenger.phone].filter(Boolean).join(' · ') || 'No additional passenger details recorded'}
                      </p>
                      {passenger.pickupLocation && <p className="text-[11px]">Pickup: {passenger.pickupLocation}</p>}
                      {passenger.specialRequests && <p className="text-[11px]">Requests: {passenger.specialRequests}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-stone-500">Individual passenger names were not captured for this reservation. The guest counts above remain authoritative.</p>
              )}
            </div>

            <div className="space-y-3 rounded border border-stone-800 bg-stone-950 p-3">
              <h4 className="font-semibold uppercase tracking-wider text-[10px] text-stone-400">Selected Extras</h4>
              {selectedBooking.extras.length ? selectedBooking.extras.map((extra) => (
                <div key={extra.extraId} className="flex items-center justify-between gap-3 text-stone-300">
                  <span>{extra.name} × {extra.quantity}</span>
                  <strong>{selectedBooking.pricing.currency || 'EUR'} {Number(extra.amountEur).toFixed(2)}</strong>
                </div>
              )) : <p className="text-[11px] text-stone-500">No extras selected.</p>}
            </div>

            {selectedBooking.customer.specialRequests && (
              <div className="p-3 bg-stone-950 rounded border border-stone-800 text-stone-300">
                <strong className="text-amber-300 block mb-1">Special Guest Notes:</strong>
                <p>{selectedBooking.customer.specialRequests}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {paymentToRecord && (
        <div className="fixed inset-0 z-[60] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-2xl space-y-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Record received payment</h3>
              <p className="mt-1 text-sm text-slate-600">This creates an audited payment transaction and updates the booking balance.</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 text-sm">
              <div className="font-semibold">{paymentToRecord.bookingReference}</div>
              <div className="text-slate-600">{paymentToRecord.customer.firstName} {paymentToRecord.customer.lastName}</div>
              <div className="mt-1 text-lg font-bold">{paymentToRecord.pricing.currency || 'EUR'} {Number(paymentToRecord.pricing?.totalEur || 0).toFixed(2)}</div>
              <div className="text-xs text-slate-600">Enter a full or partial amount. The database enforces the remaining balance.</div>
            </div>
            <label className="block text-sm font-medium text-slate-800">Amount received ({paymentToRecord.pricing.currency || 'EUR'})
              <input type="number" min="0.01" step="0.01" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} required className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900" />
            </label>
            <label className="block text-sm font-medium text-slate-800">Receipt / transaction reference
              <input type="text" minLength={3} maxLength={160} value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} required className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900" placeholder="Enter the actual receipt number" />
            </label>
            <label className="block text-sm font-medium text-slate-800">Payment method
              <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as typeof paymentMethod)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900">
                <option value="Cash">Cash</option><option value="Card">Card terminal</option><option value="Bank Transfer">Bank transfer</option><option value="Other">Other</option>
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-800">Notes (optional)
              <textarea value={paymentNotes} onChange={(event) => setPaymentNotes(event.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900" placeholder="Receipt details or reference" />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setPaymentToRecord(null)} disabled={savingPayment} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">Cancel</button>
              <button type="button" onClick={confirmRecordPayment} disabled={savingPayment} className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{savingPayment ? 'Recording…' : 'Confirm payment received'}</button>
            </div>
          </div>
        </div>
      )}

      {bookingToRejectCancellation && (
        <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl border border-stone-700 bg-stone-900 p-5 text-white shadow-2xl space-y-4">
            <h3 className="text-base font-bold">Reject cancellation request</h3>
            <p className="text-xs text-stone-300">Booking {bookingToRejectCancellation.bookingReference} will return to its previous booking status. A reason is required and will be recorded in the audit trail.</p>
            <label className="block text-xs font-medium text-stone-300">Reason for rejection
              <textarea value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} minLength={5} maxLength={500} rows={3} className="mt-1 w-full rounded border border-stone-700 bg-stone-950 p-3 text-white" placeholder="Explain why the cancellation request cannot be approved." />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setBookingToRejectCancellation(null)} className="rounded border border-stone-700 px-3 py-2 text-xs">Keep request pending</button>
              <button type="button" onClick={confirmRejectCancellation} disabled={rejectionReason.trim().length < 5} className="rounded bg-amber-600 px-3 py-2 text-xs font-semibold disabled:opacity-40">Confirm rejection</button>
            </div>
          </div>
        </div>
      )}

      {/* Cancellation Confirmation Modal */}
      {bookingToCancel && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl text-xs">
            <div className="flex items-center space-x-2.5 text-amber-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-bold text-white">Cancel Reservation</h3>
            </div>
            <p className="text-stone-300 leading-relaxed">
              Are you sure you want to cancel booking <strong className="text-white font-mono">{bookingToCancel.bookingReference}</strong> for <strong className="text-white">{bookingToCancel.customer.firstName} {bookingToCancel.customer.lastName}</strong>?
            </p>
            <div>
              <label className="text-stone-300 block mb-1 font-semibold">Cancellation Reason:</label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded text-white focus:outline-none focus:border-[#0A6C74]"
              />
            </div>
            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-stone-800">
              <button
                type="button"
                onClick={() => setBookingToCancel(null)}
                className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded font-medium cursor-pointer"
              >
                Keep Booking
              </button>
              {hasPermission('bookings.approve') && <button
                type="button"
                onClick={confirmCancelBooking}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded font-semibold cursor-pointer"
              >
                Confirm Cancellation
              </button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
