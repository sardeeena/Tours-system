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

export const AdminBookingsList: React.FC = () => {
  const { showToast } = useToast();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [bookingToCancel, setBookingToCancel] = useState<Booking | null>(null);
  const [cancelReason, setCancelReason] = useState('Customer requested cancellation');

  const loadBookings = async () => {
    setLoading(true);
    try {
      const data = await bookingRepository.listBookings();
      setBookings(data);
    } catch (err: any) {
      console.error('Error fetching bookings:', err);
      showToast(err.message || 'Failed to load bookings from database', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBookings();
  }, []);

  const handleUpdateStatus = async (ref: string, newStatus: BookingStatus) => {
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

  const handleUpdatePaymentStatus = async (ref: string, newPaymentStatus: 'paid' | 'pending' | 'refunded') => {
    const existing = bookings.find((b) => b.bookingReference === ref);
    if (!existing) return;

    const updated: Booking = {
      ...existing,
      paymentStatus: newPaymentStatus,
      updatedAt: new Date().toISOString(),
      timeline: [
        ...(existing.timeline || []),
        {
          id: `ev-${Date.now()}`,
          timestamp: new Date().toISOString(),
          title: `Payment Status Changed to ${newPaymentStatus.toUpperCase()}`,
          description: `Updated by administrator`,
          type: 'modification',
        },
      ],
    };

    try {
      await bookingRepository.updateBooking(updated);
      showToast(`Payment status for ${ref} updated to ${newPaymentStatus.toUpperCase()}`, 'success');
      if (selectedBooking?.bookingReference === ref) {
        setSelectedBooking(updated);
      }
      await loadBookings();
    } catch (err: any) {
      showToast(err.message || 'Failed to update payment status', 'error');
    }
  };

  const confirmCancelBooking = async () => {
    if (!bookingToCancel) return;
    const ref = bookingToCancel.bookingReference;
    try {
      await bookingRepository.cancelBooking(ref, cancelReason);
      showToast(`Booking ${ref} cancelled.`, 'info');
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

  const exportBookingsCSV = () => {
    const headers = [
      'Booking Reference',
      'Tour Title',
      'Date',
      'Customer Name',
      'Email',
      'Phone',
      'Country',
      'Hotel',
      'Adults',
      'Children',
      'Total EUR',
      'Status',
      'Payment Status',
      'Created At',
    ];

    const rows = filtered.map((b) => [
      `"${b.bookingReference}"`,
      `"${b.tourTitle.replace(/"/g, '""')}"`,
      `"${b.date}"`,
      `"${b.customer.firstName} ${b.customer.lastName}"`,
      `"${b.customer.email}"`,
      `"${b.customer.countryCode} ${b.customer.phoneNumber}"`,
      `"${b.customer.country}"`,
      `"${b.pickup.hotelName || ''}"`,
      b.guests.adults,
      b.guests.children,
      b.pricing.totalEur,
      `"${b.status}"`,
      `"${b.paymentStatus}"`,
      `"${b.createdAt}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
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

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display text-white tracking-tight">
            Bookings & Reservations
          </h1>
          <p className="text-xs text-stone-400 mt-1">
            Real-time reservations stored in the Supabase <code className="text-[#2dd4bf]">bookings</code> table.
          </p>
        </div>

        <div className="flex items-center space-x-3 text-xs text-stone-400">
          <button
            type="button"
            onClick={exportBookingsCSV}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded font-medium border border-stone-700 transition-colors cursor-pointer"
            title="Download reservations as CSV"
          >
            <Download className="w-3.5 h-3.5 text-[#2dd4bf]" />
            <span>Export CSV ({filtered.length})</span>
          </button>
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
            placeholder="Search by reference (e.g. RST-2026-...), guest name, email, or tour..."
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
                {filtered.map((b) => (
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
                      {b.guests.adults}A {b.guests.children > 0 ? `+ ${b.guests.children}C` : ''}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-bold text-white">
                      €{b.pricing.totalEur}
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
                        onClick={() => setSelectedBooking(b)}
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
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus(selectedBooking.bookingReference, 'cancelled')}
                    className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white rounded font-medium text-[10px]"
                  >
                    Cancel
                  </button>
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

                <div className="flex items-center space-x-1.5">
                  {selectedBooking.paymentStatus !== 'paid' && (
                    <button
                      type="button"
                      onClick={() => handleUpdatePaymentStatus(selectedBooking.bookingReference, 'paid')}
                      className="px-2 py-1 bg-teal-600 hover:bg-teal-500 text-white rounded font-medium text-[10px]"
                    >
                      Mark Paid
                    </button>
                  )}
                  {selectedBooking.paymentStatus === 'paid' && (
                    <button
                      type="button"
                      onClick={() => handleUpdatePaymentStatus(selectedBooking.bookingReference, 'refunded')}
                      className="px-2 py-1 bg-stone-700 hover:bg-stone-600 text-stone-200 rounded font-medium text-[10px]"
                    >
                      Refund
                    </button>
                  )}
                  {selectedBooking.paymentStatus !== 'pending' && (
                    <button
                      type="button"
                      onClick={() => handleUpdatePaymentStatus(selectedBooking.bookingReference, 'pending')}
                      className="px-2 py-1 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded font-medium text-[10px]"
                    >
                      Reset Pending
                    </button>
                  )}
                </div>
              </div>
            </div>

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
                  <p><strong>Date:</strong> {selectedBooking.date}</p>
                  <p><strong>Party:</strong> {selectedBooking.guests.adults} Adults, {selectedBooking.guests.children} Children</p>
                  <p><strong>Payment Method:</strong> {selectedBooking.paymentMethod.replace('_', ' ')}</p>
                  <p className="text-sm font-bold text-white pt-1">Total: €{selectedBooking.pricing.totalEur}</p>
                </div>
              </div>
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
              <button
                type="button"
                onClick={confirmCancelBooking}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded font-semibold cursor-pointer"
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
