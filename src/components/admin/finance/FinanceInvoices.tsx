import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Search,
  Filter,
  Plus,
  Printer,
  Download,
  Eye,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Building2,
  Calendar,
  Users,
} from 'lucide-react';
import {
  listInvoices,
  generateInvoiceForBooking,
  COMPANY_DETAILS,
} from '../../../services/financeService';
import { FinanceInvoice } from '../../../types/finance';
import { bookingRepository } from '../../../services/bookingRepository';
import { Booking } from '../../../types/booking';
import { useToast } from '../../../contexts/ToastContext';

interface FinanceInvoicesProps {
  onNavigateTab?: (tabId: string, param?: string) => void;
}

export const FinanceInvoices: React.FC<FinanceInvoicesProps> = ({ onNavigateTab }) => {
  const { showToast } = useToast();
  const [invoices, setInvoices] = useState<FinanceInvoice[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Preview / Printable Invoice Modal
  const [selectedInvoice, setSelectedInvoice] = useState<FinanceInvoice | null>(null);

  // Generate Invoice Modal
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [selectedBookingRef, setSelectedBookingRef] = useState<string>('');
  const [generating, setGenerating] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [allInv, allB] = await Promise.all([
        listInvoices(),
        bookingRepository.listBookings(),
      ]);
      setInvoices(allInv);
      setBookings(allB);
      if (allB.length > 0 && !selectedBookingRef) {
        setSelectedBookingRef(allB[0].bookingReference);
      }
    } catch (err) {
      console.warn('Failed to load invoices:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleGenerateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBookingRef) return;
    setGenerating(true);
    try {
      const inv = await generateInvoiceForBooking(selectedBookingRef);
      if (inv) {
        showToast(`Invoice ${inv.invoiceNumber} generated successfully.`, 'success');
        setIsGenerateModalOpen(false);
        await loadData();
        setSelectedInvoice(inv);
      } else {
        showToast('Unable to locate reservation to generate invoice.', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error generating invoice', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (statusFilter !== 'all' && inv.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          inv.invoiceNumber.toLowerCase().includes(q) ||
          inv.bookingReference.toLowerCase().includes(q) ||
          inv.customer.name.toLowerCase().includes(q) ||
          inv.customer.email.toLowerCase().includes(q) ||
          inv.tourTitle.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [invoices, statusFilter, searchQuery]);

  const getStatusBadge = (status: FinanceInvoice['status']) => {
    switch (status) {
      case 'paid':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'partially_paid':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'issued':
        return 'bg-sky-500/20 text-sky-300 border-sky-500/30';
      case 'overdue':
        return 'bg-red-500/20 text-red-300 border-red-500/30';
      case 'cancelled':
        return 'bg-stone-800 text-stone-400 border-stone-700';
      default:
        return 'bg-stone-800 text-stone-300 border-stone-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <span className="text-[10px] uppercase tracking-widest text-[#2dd4bf] font-bold block mb-0.5">
            Commercial Billing & Accounting
          </span>
          <h1 className="text-2xl font-bold font-display text-white tracking-tight flex items-center space-x-2">
            <FileText className="w-6 h-6 text-[#2dd4bf]" />
            <span>Commercial Invoices</span>
          </h1>
          <p className="text-xs text-stone-400 mt-1">
            Itemized commercial invoices generated directly from excursion reservations with official company tax and registry credentials.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setIsGenerateModalOpen(true)}
            className="px-3.5 py-1.5 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded text-xs font-semibold flex items-center space-x-1.5 shadow-xs cursor-pointer transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Create Invoice</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar (Hidden in Print) */}
      <div className="bg-stone-950 border border-stone-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs print:hidden">
        <div className="flex items-center space-x-2 flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-stone-500 shrink-0" />
          <input
            type="text"
            placeholder="Search by invoice number, customer, tour, or booking ref..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent border-none text-stone-200 placeholder-stone-500 focus:outline-none text-xs"
          />
        </div>

        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1">
            <span className="text-stone-500 text-[11px]">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-stone-900 border border-stone-800 rounded px-2.5 py-1 text-stone-300 text-xs focus:outline-none"
            >
              <option value="all">All Invoices</option>
              <option value="paid">Paid</option>
              <option value="partially_paid">Partially Paid</option>
              <option value="issued">Issued / Unpaid</option>
              <option value="overdue">Overdue</option>
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

      {/* Invoices Table (Hidden in Print) */}
      <div className="bg-stone-950 border border-stone-800 rounded-xl overflow-hidden shadow-xs print:hidden">
        {loading ? (
          <div className="p-16 text-center text-stone-400">
            <div className="w-8 h-8 border-2 border-[#0A6C74] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs">Loading commercial invoices...</p>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="p-16 text-center text-stone-500 space-y-2">
            <FileText className="w-10 h-10 mx-auto text-stone-600 mb-1" />
            <p className="text-sm font-semibold text-stone-300">No invoices found</p>
            <p className="text-xs">Generate an invoice from an existing booking above.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-stone-300">
              <thead className="bg-stone-900/80 border-b border-stone-800 text-stone-400 text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Invoice No.</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Booking Ref</th>
                  <th className="py-3 px-4">Tour / Excursion</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  <th className="py-3 px-4 text-right">Paid</th>
                  <th className="py-3 px-4 text-right">Balance Due</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800/60 font-sans">
                {filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-stone-900/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-white">
                      {inv.invoiceNumber}
                    </td>

                    <td className="py-3 px-4 text-stone-400 font-mono text-[11px]">
                      {inv.issueDate}
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-semibold text-white">{inv.customer.name}</div>
                      <div className="text-[11px] text-stone-500 truncate max-w-[150px]">
                        {inv.customer.email}
                      </div>
                    </td>

                    <td className="py-3 px-4 font-mono text-[#2dd4bf] font-semibold">
                      {inv.bookingReference}
                    </td>

                    <td className="py-3 px-4 text-stone-200 truncate max-w-[180px]">
                      {inv.tourTitle}
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-bold text-white">
                      €{inv.total.toFixed(2)}
                    </td>

                    <td className="py-3 px-4 text-right font-mono text-emerald-400">
                      €{inv.paid.toFixed(2)}
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-bold">
                      {inv.balance > 0 ? (
                        <span className="text-amber-400">€{inv.balance.toFixed(2)}</span>
                      ) : (
                        <span className="text-stone-500">€0.00</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${getStatusBadge(
                          inv.status
                        )}`}
                      >
                        {inv.status}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedInvoice(inv)}
                        className="px-2.5 py-1 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded text-[11px] font-semibold cursor-pointer transition-colors shadow-xs"
                      >
                        View & Print
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* GENERATE INVOICE MODAL */}
      {isGenerateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-stone-950 border border-stone-800 rounded-2xl max-w-md w-full p-6 text-xs text-stone-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-[#2dd4bf]" />
                <h3 className="text-base font-bold text-white">Generate Commercial Invoice</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsGenerateModalOpen(false)}
                className="text-stone-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleGenerateInvoice} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-stone-400 mb-1">
                  Select Confirmed Reservation
                </label>
                <select
                  value={selectedBookingRef}
                  onChange={(e) => setSelectedBookingRef(e.target.value)}
                  className="w-full bg-stone-900 border border-stone-800 rounded-lg p-2.5 text-white text-xs focus:outline-none"
                  required
                >
                  {bookings.map((b) => (
                    <option key={b.bookingReference} value={b.bookingReference}>
                      {b.bookingReference} &bull; {b.customer.firstName} {b.customer.lastName} &bull; {b.tourTitle} (€{b.pricing?.totalEur || 0})
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3 bg-stone-900/60 rounded border border-stone-800 text-[11px] text-stone-400">
                The invoice will be generated with full company tax registration details, itemized excursions, pickup transfers, and live payment settlements.
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsGenerateModalOpen(false)}
                  className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-stone-300 rounded text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={generating}
                  className="px-4 py-2 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded text-xs font-semibold cursor-pointer shadow flex items-center space-x-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{generating ? 'Generating...' : 'Create Invoice'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FULL PRINTABLE INVOICE MODAL / SHEET */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 bg-black/85 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:static">
          <div className="bg-white text-stone-900 rounded-2xl max-w-4xl w-full p-8 sm:p-12 shadow-2xl relative space-y-8 my-auto print:p-0 print:m-0 print:shadow-none print:border-none print:rounded-none">
            {/* Top Action Bar (Hidden in Print) */}
            <div className="flex items-center justify-between border-b border-stone-200 pb-4 print:hidden">
              <div className="flex items-center space-x-2">
                <span className="text-xs uppercase font-bold tracking-wider text-stone-500">
                  Invoice Preview &bull; {selectedInvoice.invoiceNumber}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase ${
                    selectedInvoice.status === 'paid'
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : 'bg-amber-100 text-amber-800 border-amber-300'
                  }`}
                >
                  {selectedInvoice.status}
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-3.5 py-1.5 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded text-xs font-semibold flex items-center space-x-1.5 shadow-xs cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print / Save PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedInvoice(null)}
                  className="p-1.5 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded text-xs cursor-pointer"
                >
                  ✕ Close
                </button>
              </div>
            </div>

            {/* Official Company Header & Invoice Metadata */}
            <div className="grid grid-cols-2 gap-6 items-start border-b border-stone-300 pb-6">
              <div>
                <span className="text-xs uppercase font-bold text-teal-800 tracking-wider block">
                  {selectedInvoice.companyDetails.tagline}
                </span>
                <h2 className="text-2xl font-bold font-serif text-stone-900 mt-0.5">
                  {selectedInvoice.companyDetails.name}
                </h2>
                <div className="text-xs text-stone-600 space-y-0.5 mt-2">
                  <p>{selectedInvoice.companyDetails.address}</p>
                  <p>{selectedInvoice.companyDetails.city}, {selectedInvoice.companyDetails.country}</p>
                  <p>Tel: {selectedInvoice.companyDetails.phone} &bull; Email: {selectedInvoice.companyDetails.email}</p>
                  <p className="font-mono text-[11px] text-stone-500">
                    Tax Reg: {selectedInvoice.companyDetails.taxRegistrationNumber} &bull; CR: {selectedInvoice.companyDetails.commercialRegistryNumber}
                  </p>
                </div>
              </div>

              <div className="text-right space-y-1">
                <h1 className="text-3xl font-extrabold font-mono tracking-tight text-stone-900">
                  INVOICE
                </h1>
                <div className="font-mono text-sm font-bold text-stone-800">
                  {selectedInvoice.invoiceNumber}
                </div>
                <div className="text-xs text-stone-600 font-mono">
                  Issue Date: <strong>{selectedInvoice.issueDate}</strong>
                </div>
                <div className="text-xs text-stone-600 font-mono">
                  Tour Date: <strong>{selectedInvoice.tourDate}</strong>
                </div>
                <div className="text-xs text-teal-800 font-mono font-bold">
                  Booking Ref: {selectedInvoice.bookingReference}
                </div>
              </div>
            </div>

            {/* Bill To & Reservation Details */}
            <div className="grid grid-cols-2 gap-6 text-xs bg-stone-50 p-4 rounded-lg border border-stone-200">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-stone-500 block mb-1">
                  BILL TO / CUSTOMER
                </span>
                <div className="font-bold text-stone-900 text-sm">{selectedInvoice.customer.name}</div>
                <div className="text-stone-600">{selectedInvoice.customer.email}</div>
                {selectedInvoice.customer.phone && (
                  <div className="text-stone-600">{selectedInvoice.customer.phone}</div>
                )}
                {selectedInvoice.customer.country && (
                  <div className="text-stone-500">Nationality: {selectedInvoice.customer.country}</div>
                )}
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-stone-500 block mb-1">
                  EXCURSION & LOGISTICS
                </span>
                <div className="font-bold text-stone-900">{selectedInvoice.tourTitle}</div>
                <div className="text-stone-600">
                  Guests: {selectedInvoice.guests.adults} Adults
                  {selectedInvoice.guests.children > 0 ? `, ${selectedInvoice.guests.children} Children` : ''}
                  {selectedInvoice.guests.infants > 0 ? `, ${selectedInvoice.guests.infants} Infants` : ''}
                </div>
                <div className="text-stone-600">
                  Pickup: {selectedInvoice.customer.hotel || 'Direct Marina'}
                  {selectedInvoice.customer.roomNumber ? ` (Room ${selectedInvoice.customer.roomNumber})` : ''}
                </div>
              </div>
            </div>

            {/* Itemized Line Items Table */}
            <div>
              <table className="w-full text-left text-xs border border-stone-300">
                <thead>
                  <tr className="bg-stone-100 text-stone-700 font-bold border-b border-stone-300">
                    <th className="p-3 border-r border-stone-300">Item Description</th>
                    <th className="p-3 border-r border-stone-300 w-16 text-center">Qty</th>
                    <th className="p-3 border-r border-stone-300 w-28 text-right">Unit Price</th>
                    <th className="p-3 w-28 text-right">Total (EUR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200 font-mono">
                  {selectedInvoice.lineItems.map((item) => (
                    <tr key={item.id}>
                      <td className="p-3 border-r border-stone-200 font-sans text-stone-900 font-medium">
                        {item.description}
                      </td>
                      <td className="p-3 border-r border-stone-200 text-center text-stone-600">
                        {item.quantity}
                      </td>
                      <td className="p-3 border-r border-stone-200 text-right text-stone-700">
                        €{item.unitPrice.toFixed(2)}
                      </td>
                      <td className="p-3 text-right font-bold text-stone-900">
                        €{item.total.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals & Settlement Calculation */}
            <div className="flex justify-between items-start gap-8 pt-2">
              <div className="space-y-3 text-xs text-stone-600 max-w-sm">
                <div>
                  <span className="font-bold text-stone-900 block mb-0.5">Wire Transfer Details:</span>
                  <p className="font-mono text-[11px] leading-tight">
                    Bank: {selectedInvoice.companyDetails.bankName}<br />
                    IBAN: {selectedInvoice.companyDetails.iban}<br />
                    SWIFT: {selectedInvoice.companyDetails.swiftBic}
                  </p>
                </div>
                <p className="text-[11px] text-stone-500 italic">
                  {selectedInvoice.notes}
                </p>
              </div>

              <div className="w-64 space-y-2 font-mono text-xs">
                <div className="flex justify-between text-stone-600">
                  <span>Subtotal:</span>
                  <span>€{selectedInvoice.subtotal.toFixed(2)}</span>
                </div>

                {selectedInvoice.discount > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Discount:</span>
                    <span>-€{selectedInvoice.discount.toFixed(2)}</span>
                  </div>
                )}

                <div className="flex justify-between text-stone-600">
                  <span>Tax (0% Marine Tourism):</span>
                  <span>€0.00</span>
                </div>

                <div className="flex justify-between text-base font-bold text-stone-900 border-t border-stone-300 pt-2">
                  <span>Total Due:</span>
                  <span>€{selectedInvoice.total.toFixed(2)}</span>
                </div>

                <div className="flex justify-between text-emerald-800 font-semibold border-b border-stone-200 pb-1">
                  <span>Amount Paid:</span>
                  <span>€{selectedInvoice.paid.toFixed(2)}</span>
                </div>

                <div className="flex justify-between text-base font-bold text-amber-900 pt-1">
                  <span>Balance Due:</span>
                  <span>€{selectedInvoice.balance.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Stamp & Authorized Signature */}
            <div className="pt-8 border-t border-stone-300 grid grid-cols-2 gap-8 text-xs text-stone-600">
              <div>
                <span className="text-[10px] uppercase font-bold text-stone-500 block">
                  Commercial Stamp
                </span>
                <div className="w-20 h-20 border border-dashed border-stone-300 rounded-full flex items-center justify-center text-[10px] text-stone-400 mt-2">
                  OFFICIAL SEAL
                </div>
              </div>

              <div className="text-right space-y-8">
                <span className="text-[10px] uppercase font-bold text-stone-500 block">
                  Authorized Accounting Officer
                </span>
                <div className="border-b border-stone-400 pb-1">
                  Finance Controller &bull; Red Sea Voyages
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
