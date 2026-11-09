import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Search,
  Filter,
  Shield,
  Phone,
  Mail,
  MapPin,
  Calendar,
  CreditCard,
  RefreshCw,
  Download,
  Eye,
  Trash2,
  Building,
  UserCheck,
  AlertTriangle,
} from 'lucide-react';
import {
  listUnifiedCustomers,
  updateCustomerRole,
  updateCustomerDetails,
  deleteCustomerRecord,
  UnifiedCustomer,
} from '../../services/customerService';
import { UserRole } from '../../types/database';
import { useToast } from '../../contexts/ToastContext';

export const AdminCustomersList: React.FC = () => {
  const { showToast } = useToast();
  const [customers, setCustomers] = useState<UnifiedCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [selectedCustomer, setSelectedCustomer] = useState<UnifiedCustomer | null>(null);
  const [editingRole, setEditingRole] = useState(false);
  const [tempRole, setTempRole] = useState<UserRole>('customer');
  const [customerToDelete, setCustomerToDelete] = useState<UnifiedCustomer | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await listUnifiedCustomers();
      setCustomers(data);
    } catch (err: any) {
      console.error('Failed to load customers:', err);
      showToast(err.message || 'Failed to load customers from database', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      const matchesRole = roleFilter === 'all' || c.role === roleFilter;
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        c.fullName.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.phone && c.phone.toLowerCase().includes(q)) ||
        (c.country && c.country.toLowerCase().includes(q)) ||
        (c.hotel && c.hotel.toLowerCase().includes(q));

      return matchesRole && matchesSearch;
    });
  }, [customers, roleFilter, searchQuery]);

  const handleRoleSave = async () => {
    if (!selectedCustomer) return;
    const success = await updateCustomerRole(selectedCustomer.id, tempRole);
    if (success) {
      setCustomers((prev) =>
        prev.map((c) => (c.id === selectedCustomer.id ? { ...c, role: tempRole } : c))
      );
      setSelectedCustomer((prev) => (prev ? { ...prev, role: tempRole } : null));
      setEditingRole(false);
      showToast(`User role updated to "${tempRole}".`, 'success');
    }
  };

  const handleDelete = (cust: UnifiedCustomer) => {
    setCustomerToDelete(cust);
  };

  const confirmDeleteCustomer = async () => {
    if (!customerToDelete) return;
    setIsDeleting(true);
    const success = await deleteCustomerRecord(customerToDelete.id);
    if (success) {
      setCustomers((prev) => prev.filter((c) => c.id !== customerToDelete.id));
      if (selectedCustomer?.id === customerToDelete.id) setSelectedCustomer(null);
      showToast(`Customer record for "${customerToDelete.fullName}" deleted.`, 'info');
    } else {
      showToast('Failed to delete customer record.', 'error');
    }
    setCustomerToDelete(null);
    setIsDeleting(false);
  };

  const exportCSV = () => {
    const headers = ['Full Name', 'Email', 'Phone', 'Country', 'Hotel', 'Role', 'Total Bookings', 'Total Spent EUR', 'Registration Date'];
    const rows = filteredCustomers.map((c) => [
      `"${c.fullName}"`,
      `"${c.email}"`,
      `"${c.phone || ''}"`,
      `"${c.country || ''}"`,
      `"${c.hotel || ''}"`,
      `"${c.role}"`,
      c.totalBookings,
      c.totalSpentEur,
      `"${c.createdAt}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `customers_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // KPIs
  const totalCustomers = customers.length;
  const registeredCount = customers.filter((c) => c.isRegistered).length;
  const totalLifetimeSpend = customers.reduce((sum, c) => sum + c.totalSpentEur, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <Users className="w-5 h-5 text-[#2dd4bf]" />
            <span>Customer & Traveler Directory</span>
          </h2>
          <p className="text-xs text-stone-400 mt-1">
            Unified records from database profiles, reservation guests, and registered traveler accounts.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={exportCSV}
            className="inline-flex items-center space-x-1.5 px-3 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-lg text-xs font-semibold shadow transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center space-x-1.5 px-3 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-lg text-xs font-semibold shadow transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-stone-950 border border-stone-800 p-4 rounded-xl">
          <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
            Total Customers
          </span>
          <p className="text-2xl font-bold text-white mt-1">{totalCustomers}</p>
        </div>
        <div className="bg-stone-950 border border-stone-800 p-4 rounded-xl">
          <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
            Registered Profiles
          </span>
          <p className="text-2xl font-bold text-emerald-300 mt-1">{registeredCount}</p>
        </div>
        <div className="bg-stone-950 border border-stone-800 p-4 rounded-xl">
          <span className="text-[11px] font-semibold text-[#2dd4bf] uppercase tracking-wider">
            Lifetime Excursion Spend
          </span>
          <p className="text-2xl font-bold text-white mt-1">€{totalLifetimeSpend.toLocaleString()}</p>
        </div>
        <div className="bg-stone-950 border border-stone-800 p-4 rounded-xl">
          <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">
            Active Staff / Admins
          </span>
          <p className="text-2xl font-bold text-amber-300 mt-1">
            {customers.filter((c) => c.role !== 'customer').length}
          </p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-stone-950 border border-stone-800 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-stone-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by name, email, country, hotel..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-stone-900 border border-stone-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-[#0A6C74]"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <Filter className="w-3.5 h-3.5 text-stone-400 shrink-0" />
          <div className="flex rounded-lg bg-stone-900 p-1 border border-stone-800 text-xs w-full sm:w-auto">
            {(['all', 'customer', 'staff', 'manager', 'admin'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRoleFilter(r)}
                className={`px-3 py-1 rounded text-xs font-medium capitalize transition-colors ${
                  roleFilter === r
                    ? 'bg-[#0A6C74] text-white'
                    : 'text-stone-400 hover:text-white'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-stone-950 border border-stone-800 rounded-xl overflow-hidden shadow-lg">
        {loading ? (
          <div className="p-12 text-center text-stone-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#0A6C74] mb-2" />
            <p className="text-xs">Loading customer directory from database...</p>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="p-12 text-center text-stone-500 space-y-2">
            <Users className="w-10 h-10 mx-auto text-stone-600" />
            <p className="text-sm text-stone-300 font-medium">No customers found</p>
            <p className="text-xs text-stone-500">Try adjusting your search criteria or register a new customer.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-stone-300">
              <thead className="bg-stone-900 border-b border-stone-800 text-stone-400 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Traveler / Customer</th>
                  <th className="py-3 px-4">Contact & Location</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Bookings</th>
                  <th className="py-3 px-4">Total Spend</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-850">
                {filteredCustomers.map((cust) => (
                  <tr
                    key={cust.id}
                    onClick={() => {
                      setSelectedCustomer(cust);
                      setTempRole(cust.role);
                      setEditingRole(false);
                    }}
                    className="hover:bg-stone-900/60 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 font-medium text-white">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-8 h-8 rounded-full bg-[#0A6C74]/20 border border-[#0A6C74]/40 text-[#2dd4bf] flex items-center justify-center text-xs font-bold shrink-0">
                          {cust.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center space-x-1.5">
                            <span>{cust.fullName}</span>
                            {cust.isRegistered && (
                              <span title="Registered Supabase Account">
                                <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-stone-400 font-mono">{cust.email}</div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="space-y-0.5">
                        {cust.phone ? (
                          <div className="text-[11px] text-stone-300 flex items-center space-x-1">
                            <Phone className="w-3 h-3 text-stone-500" />
                            <span>{cust.phone}</span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-stone-500">No phone</span>
                        )}
                        {cust.country && (
                          <div className="text-[11px] text-stone-400 flex items-center space-x-1">
                            <MapPin className="w-3 h-3 text-stone-500" />
                            <span>{cust.country}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${
                          cust.role === 'admin'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : cust.role === 'manager'
                            ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                            : cust.role === 'staff'
                            ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                            : 'bg-stone-800 text-stone-300 border-stone-700'
                        }`}
                      >
                        {cust.role}
                      </span>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap font-medium text-stone-200">
                      {cust.totalBookings > 0 ? (
                        <span className="text-emerald-400 font-semibold">{cust.totalBookings} tour(s)</span>
                      ) : (
                        <span className="text-stone-500">0</span>
                      )}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap font-semibold text-white">
                      €{cust.totalSpentEur.toFixed(2)}
                    </td>

                    <td
                      className="py-3 px-4 whitespace-nowrap text-right space-x-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCustomer(cust);
                          setTempRole(cust.role);
                          setEditingRole(false);
                        }}
                        className="p-1.5 hover:bg-stone-800 text-stone-300 hover:text-white rounded"
                        title="View Customer Details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(cust)}
                        className="p-1.5 hover:bg-red-950/60 text-stone-500 hover:text-red-400 rounded cursor-pointer"
                        title="Delete Record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Customer Detail Drawer */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="relative w-full max-w-lg bg-stone-900 border border-stone-700 rounded-xl shadow-2xl p-6 text-stone-100 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-start justify-between pb-3 border-b border-stone-800">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-[#0A6C74]/20 border border-[#0A6C74] text-[#2dd4bf] flex items-center justify-center text-sm font-bold">
                  {selectedCustomer.fullName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">{selectedCustomer.fullName}</h3>
                  <p className="text-xs text-stone-400 font-mono">{selectedCustomer.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="p-1 text-stone-400 hover:text-white rounded hover:bg-stone-800"
              >
                ✕
              </button>
            </div>

            {/* Profile Data */}
            <div className="bg-stone-950 border border-stone-800 rounded-lg p-3.5 space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-stone-900">
                <span className="text-stone-500">Phone:</span>
                <span className="text-stone-200">{selectedCustomer.phone || 'Not provided'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-stone-900">
                <span className="text-stone-500">Country of Residence:</span>
                <span className="text-stone-200">{selectedCustomer.country || 'Not specified'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-stone-900">
                <span className="text-stone-500">Recent Resort / Hotel:</span>
                <span className="text-stone-200">{selectedCustomer.hotel || 'Not specified'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-stone-900">
                <span className="text-stone-500">Total Bookings Completed:</span>
                <span className="text-emerald-400 font-semibold">{selectedCustomer.totalBookings}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-stone-900">
                <span className="text-stone-500">Total Lifetime Spend:</span>
                <span className="text-white font-bold">€{selectedCustomer.totalSpentEur.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-stone-500">Registered Account:</span>
                <span className={selectedCustomer.isRegistered ? 'text-emerald-400' : 'text-stone-400'}>
                  {selectedCustomer.isRegistered ? 'Yes (Supabase Auth)' : 'No (Guest Booking)'}
                </span>
              </div>
            </div>

            {/* Role Management */}
            <div className="bg-stone-950 border border-stone-800 rounded-lg p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-stone-300 flex items-center space-x-1.5">
                  <Shield className="w-3.5 h-3.5 text-amber-400" />
                  <span>Access Authorization & Role:</span>
                </span>
                {!editingRole ? (
                  <button
                    type="button"
                    onClick={() => setEditingRole(true)}
                    className="text-xs text-[#2dd4bf] hover:underline"
                  >
                    Change Role
                  </button>
                ) : null}
              </div>

              {editingRole ? (
                <div className="flex items-center space-x-2 pt-2">
                  <select
                    value={tempRole}
                    onChange={(e) => setTempRole(e.target.value as UserRole)}
                    className="bg-stone-900 border border-stone-700 rounded px-2.5 py-1 text-xs text-white focus:outline-none"
                  >
                    <option value="customer">Customer (Standard Traveler)</option>
                    <option value="staff">Staff (Booking Assistant)</option>
                    <option value="manager">Manager (Excursion Dispatcher)</option>
                    <option value="admin">Admin (Full System CMS)</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleRoleSave}
                    className="px-3 py-1 bg-[#0A6C74] hover:bg-[#08545a] text-white rounded text-xs font-semibold shadow"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingRole(false)}
                    className="px-2 py-1 text-stone-400 hover:text-white text-xs"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <p className="text-xs text-stone-300">
                  Current Role:{' '}
                  <strong className="text-white capitalize">{selectedCustomer.role}</strong>
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="pt-2 flex justify-between">
              <a
                href={`mailto:${selectedCustomer.email}`}
                className="inline-flex items-center space-x-1.5 px-3 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded text-xs font-semibold"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Contact Traveler</span>
              </a>

              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded text-xs font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Customer Confirmation Modal */}
      {customerToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-xl max-w-sm w-full p-6 space-y-4 shadow-2xl text-xs">
            <div className="flex items-center space-x-2.5 text-amber-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-bold text-white">Delete Customer Record</h3>
            </div>
            <p className="text-stone-300 leading-relaxed">
              Are you sure you want to delete the traveler record for <strong className="text-white">{customerToDelete.fullName}</strong> (<span className="text-stone-400 font-mono">{customerToDelete.email}</span>)?
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-stone-800">
              <button
                type="button"
                onClick={() => setCustomerToDelete(null)}
                disabled={isDeleting}
                className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteCustomer}
                disabled={isDeleting}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded font-semibold disabled:opacity-50 cursor-pointer"
              >
                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
