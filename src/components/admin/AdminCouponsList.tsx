import React, { useState, useEffect } from 'react';
import {
  Tag,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Percent,
  DollarSign,
  Calendar,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import {
  getCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  toggleCouponStatus,
} from '../../services/couponService';
import { DbCoupon } from '../../types/database';
import { useToast } from '../../contexts/ToastContext';

export const AdminCouponsList: React.FC = () => {
  const { showToast } = useToast();
  const [coupons, setCoupons] = useState<DbCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'expired'>('all');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Edit / Create Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Partial<DbCoupon> | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete confirmation
  const [couponToDelete, setCouponToDelete] = useState<DbCoupon | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getCoupons();
      setCoupons(data);
    } catch (err) {
      console.error('Error fetching coupons:', err);
      showToast('Failed to load coupons', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
    showToast(`Code "${code}" copied to clipboard!`, 'info');
  };

  const handleOpenCreate = () => {
    setFormError(null);
    setEditingCoupon({
      code: '',
      description: '',
      discount_type: 'percentage',
      discount_value: 10,
      min_spend: 0,
      max_discount: null,
      valid_from: new Date().toISOString().split('T')[0],
      valid_until: null,
      usage_limit: null,
      is_active: true,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (coupon: DbCoupon) => {
    setFormError(null);
    setEditingCoupon({
      ...coupon,
      valid_from: coupon.valid_from ? coupon.valid_from.split('T')[0] : '',
      valid_until: coupon.valid_until ? coupon.valid_until.split('T')[0] : null,
    });
    setIsModalOpen(true);
  };

  const handleToggle = async (coupon: DbCoupon) => {
    try {
      const nextStatus = !coupon.is_active;
      await toggleCouponStatus(coupon.id, nextStatus);
      setCoupons((prev) =>
        prev.map((c) => (c.id === coupon.id ? { ...c, is_active: nextStatus } : c))
      );
      showToast(`Coupon "${coupon.code}" ${nextStatus ? 'activated' : 'deactivated'}.`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to update status', 'error');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCoupon?.code?.trim()) {
      setFormError('Coupon code is required.');
      return;
    }
    if (!editingCoupon?.discount_value || Number(editingCoupon.discount_value) <= 0) {
      setFormError('Discount value must be greater than zero.');
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      const cleanCode = editingCoupon.code.trim().toUpperCase();
      const payload = {
        code: cleanCode,
        description: editingCoupon.description || null,
        discount_type: editingCoupon.discount_type || 'percentage',
        discount_value: Number(editingCoupon.discount_value),
        min_spend: Number(editingCoupon.min_spend) || 0,
        max_discount: editingCoupon.max_discount ? Number(editingCoupon.max_discount) : null,
        valid_from: editingCoupon.valid_from
          ? new Date(editingCoupon.valid_from).toISOString()
          : new Date().toISOString(),
        valid_until: editingCoupon.valid_until ? new Date(editingCoupon.valid_until).toISOString() : null,
        usage_limit: editingCoupon.usage_limit ? Number(editingCoupon.usage_limit) : null,
        is_active: editingCoupon.is_active ?? true,
      };

      if (editingCoupon.id) {
        await updateCoupon(editingCoupon.id, payload);
        showToast(`Coupon "${cleanCode}" updated successfully.`, 'success');
      } else {
        await createCoupon(payload);
        showToast(`Coupon "${cleanCode}" created successfully.`, 'success');
      }

      setIsModalOpen(false);
      setEditingCoupon(null);
      await loadData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save coupon.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!couponToDelete) return;
    setIsDeleting(true);
    try {
      await deleteCoupon(couponToDelete.id);
      showToast(`Coupon "${couponToDelete.code}" deleted permanently.`, 'success');
      setCoupons((prev) => prev.filter((c) => c.id !== couponToDelete.id));
      setCouponToDelete(null);
    } catch (err: any) {
      showToast(err.message || 'Failed to delete coupon', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtering
  const now = new Date().getTime();
  const filteredCoupons = coupons.filter((c) => {
    const isExpired = c.valid_until ? new Date(c.valid_until).getTime() < now : false;

    if (statusFilter === 'active') {
      if (!c.is_active || isExpired) return false;
    } else if (statusFilter === 'inactive') {
      if (c.is_active) return false;
    } else if (statusFilter === 'expired') {
      if (!isExpired) return false;
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        c.code.toLowerCase().includes(q) ||
        (c.description && c.description.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display text-white tracking-tight flex items-center space-x-2">
            <Tag className="w-6 h-6 text-[#2dd4bf]" />
            <span>Promotional Coupons & Vouchers</span>
          </h1>
          <p className="text-xs text-stone-400 mt-1">
            Manage promotional campaign discount codes, percentage vouchers, and minimum spend rules.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="p-2 bg-stone-900 border border-stone-800 text-stone-300 hover:text-white rounded text-xs transition-colors cursor-pointer"
            title="Refresh coupons"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center space-x-1.5 px-4 py-2 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded text-xs font-semibold shadow transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Coupon</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-stone-950 border border-stone-800 rounded-lg p-3 text-xs">
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search coupon code or description..."
            className="w-full pl-9 pr-3 py-1.5 bg-stone-900 border border-stone-800 rounded text-stone-200 placeholder-stone-500 focus:outline-none focus:border-[#0A6C74]"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <span className="text-stone-400 text-xs hidden sm:inline">Status:</span>
          <div className="inline-flex rounded border border-stone-800 bg-stone-900 p-0.5">
            {(['all', 'active', 'inactive', 'expired'] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setStatusFilter(filter)}
                className={`px-3 py-1 rounded text-xs font-medium capitalize transition-colors ${
                  statusFilter === filter
                    ? 'bg-[#0A6C74] text-white'
                    : 'text-stone-400 hover:text-white'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table / List */}
      {loading ? (
        <div className="p-12 text-center text-stone-400">
          <div className="w-8 h-8 border-2 border-[#0A6C74] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs">Loading coupons from Supabase...</p>
        </div>
      ) : filteredCoupons.length === 0 ? (
        <div className="bg-stone-950 border border-stone-800 rounded-xl p-12 text-center text-stone-400 space-y-2">
          <Tag className="w-8 h-8 text-stone-600 mx-auto" />
          <p className="text-sm font-semibold text-stone-300">No coupons found</p>
          <p className="text-xs text-stone-500">
            {search ? 'Try modifying your search query.' : 'Create your first promotional discount coupon above.'}
          </p>
        </div>
      ) : (
        <div className="bg-stone-950 border border-stone-800 rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-900/80 text-stone-400 uppercase tracking-wider border-b border-stone-800 text-[10px]">
                <tr>
                  <th className="py-3 px-4">Coupon Code</th>
                  <th className="py-3 px-4">Discount</th>
                  <th className="py-3 px-4">Restrictions</th>
                  <th className="py-3 px-4">Validity</th>
                  <th className="py-3 px-4">Usage</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-850 text-stone-200">
                {filteredCoupons.map((coupon) => {
                  const isExpired = coupon.valid_until
                    ? new Date(coupon.valid_until).getTime() < now
                    : false;

                  return (
                    <tr key={coupon.id} className="hover:bg-stone-900/50 transition-colors">
                      <td className="py-3 px-4 font-mono">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-white bg-stone-800 px-2 py-0.5 rounded border border-stone-700">
                            {coupon.code}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyCode(coupon.code)}
                            className="text-stone-400 hover:text-white transition-colors cursor-pointer"
                            title="Copy Code"
                          >
                            {copiedCode === coupon.code ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                        {coupon.description && (
                          <p className="text-[11px] text-stone-400 font-sans mt-0.5 truncate max-w-xs">
                            {coupon.description}
                          </p>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <span className="inline-flex items-center space-x-1 font-semibold text-emerald-400">
                          {coupon.discount_type === 'percentage' ? (
                            <>
                              <Percent className="w-3.5 h-3.5" />
                              <span>{coupon.discount_value}% OFF</span>
                            </>
                          ) : (
                            <>
                              <span>€{coupon.discount_value.toFixed(2)} OFF</span>
                            </>
                          )}
                        </span>
                        {coupon.max_discount && (
                          <span className="block text-[10px] text-stone-400">
                            Max: €{coupon.max_discount}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-stone-300">
                        {coupon.min_spend > 0 ? (
                          <span>Min Spend: €{coupon.min_spend}</span>
                        ) : (
                          <span className="text-stone-500">No minimum</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-[11px]">
                        {coupon.valid_until ? (
                          <div>
                            <span className={isExpired ? 'text-red-400 font-medium' : 'text-stone-300'}>
                              Until {new Date(coupon.valid_until).toLocaleDateString()}
                            </span>
                            {isExpired && (
                              <span className="block text-[9px] text-red-400 uppercase font-bold">
                                Expired
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-stone-400">Never expires</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-[11px]">
                        <span className="font-semibold text-white">
                          {coupon.times_used ?? coupon.times_redeemed ?? 0}
                        </span>
                        {coupon.usage_limit ? (
                          <span className="text-stone-400"> / {coupon.usage_limit} limit</span>
                        ) : (
                          <span className="text-stone-500"> / unlimited</span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => handleToggle(coupon)}
                          className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer transition-colors ${
                            coupon.is_active && !isExpired
                              ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800'
                              : 'bg-stone-800 text-stone-400 border border-stone-700'
                          }`}
                        >
                          {coupon.is_active && !isExpired ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              <span>Active</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3 text-stone-400" />
                              <span>Inactive</span>
                            </>
                          )}
                        </button>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(coupon)}
                            className="p-1.5 text-stone-400 hover:text-white hover:bg-stone-800 rounded transition-colors cursor-pointer"
                            title="Edit Coupon"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setCouponToDelete(coupon)}
                            className="p-1.5 text-stone-400 hover:text-red-400 hover:bg-stone-800 rounded transition-colors cursor-pointer"
                            title="Delete Coupon"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {isModalOpen && editingCoupon && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl text-xs max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <Tag className="w-4 h-4 text-[#2dd4bf]" />
                <span>{editingCoupon.id ? 'Edit Coupon' : 'Create New Coupon'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-stone-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-300 rounded text-xs flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-stone-300 font-semibold mb-1">Coupon Code *</label>
                <input
                  type="text"
                  required
                  value={editingCoupon.code || ''}
                  onChange={(e) =>
                    setEditingCoupon({ ...editingCoupon, code: e.target.value.toUpperCase() })
                  }
                  placeholder="e.g. SUMMER25"
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded text-white font-mono uppercase tracking-wider focus:outline-none focus:border-[#0A6C74]"
                />
              </div>

              <div>
                <label className="block text-stone-300 font-semibold mb-1">Description</label>
                <input
                  type="text"
                  value={editingCoupon.description || ''}
                  onChange={(e) =>
                    setEditingCoupon({ ...editingCoupon, description: e.target.value })
                  }
                  placeholder="e.g. VIP season 15% discount for website guests"
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded text-white focus:outline-none focus:border-[#0A6C74]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-300 font-semibold mb-1">Discount Type *</label>
                  <select
                    value={editingCoupon.discount_type || 'percentage'}
                    onChange={(e) =>
                      setEditingCoupon({
                        ...editingCoupon,
                        discount_type: e.target.value as 'percentage' | 'fixed',
                      })
                    }
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded text-white focus:outline-none focus:border-[#0A6C74]"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount (EUR €)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-stone-300 font-semibold mb-1">Discount Value *</label>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    required
                    value={editingCoupon.discount_value ?? 10}
                    onChange={(e) =>
                      setEditingCoupon({
                        ...editingCoupon,
                        discount_value: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded text-white focus:outline-none focus:border-[#0A6C74]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-300 font-semibold mb-1">
                    Minimum Spend (€ EUR)
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={editingCoupon.min_spend ?? 0}
                    onChange={(e) =>
                      setEditingCoupon({
                        ...editingCoupon,
                        min_spend: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded text-white focus:outline-none focus:border-[#0A6C74]"
                  />
                </div>

                <div>
                  <label className="block text-stone-300 font-semibold mb-1">
                    Max Discount Cap (€ EUR)
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    placeholder="Optional (No cap)"
                    value={editingCoupon.max_discount ?? ''}
                    onChange={(e) =>
                      setEditingCoupon({
                        ...editingCoupon,
                        max_discount: e.target.value ? parseFloat(e.target.value) : null,
                      })
                    }
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded text-white focus:outline-none focus:border-[#0A6C74]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-300 font-semibold mb-1">Valid From</label>
                  <input
                    type="date"
                    value={editingCoupon.valid_from || ''}
                    onChange={(e) =>
                      setEditingCoupon({ ...editingCoupon, valid_from: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded text-white focus:outline-none focus:border-[#0A6C74]"
                  />
                </div>

                <div>
                  <label className="block text-stone-300 font-semibold mb-1">Valid Until</label>
                  <input
                    type="date"
                    value={editingCoupon.valid_until || ''}
                    onChange={(e) =>
                      setEditingCoupon({
                        ...editingCoupon,
                        valid_until: e.target.value || null,
                      })
                    }
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded text-white focus:outline-none focus:border-[#0A6C74]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-300 font-semibold mb-1">Usage Limit</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Optional (Unlimited)"
                    value={editingCoupon.usage_limit ?? ''}
                    onChange={(e) =>
                      setEditingCoupon({
                        ...editingCoupon,
                        usage_limit: e.target.value ? parseInt(e.target.value, 10) : null,
                      })
                    }
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded text-white focus:outline-none focus:border-[#0A6C74]"
                  />
                </div>

                <div className="flex items-center pt-6">
                  <label className="inline-flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingCoupon.is_active ?? true}
                      onChange={(e) =>
                        setEditingCoupon({ ...editingCoupon, is_active: e.target.checked })
                      }
                      className="rounded bg-stone-950 border-stone-800 text-[#0A6C74] focus:ring-0"
                    />
                    <span className="text-stone-300 font-medium">Coupon is Active</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={saving}
                  className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-1.5 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded font-semibold disabled:opacity-50 cursor-pointer shadow"
                >
                  {saving ? 'Saving...' : editingCoupon.id ? 'Save Changes' : 'Create Coupon'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {couponToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-xl max-w-sm w-full p-6 space-y-4 shadow-2xl text-xs">
            <div className="flex items-center space-x-2.5 text-amber-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-bold text-white">Delete Coupon</h3>
            </div>
            <p className="text-stone-300 leading-relaxed">
              Are you sure you want to permanently delete coupon code{' '}
              <strong className="text-white font-mono bg-stone-800 px-1 py-0.5 rounded">
                "{couponToDelete.code}"
              </strong>
              ? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-stone-800">
              <button
                type="button"
                onClick={() => setCouponToDelete(null)}
                disabled={isDeleting}
                className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={isDeleting}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded font-semibold disabled:opacity-50 cursor-pointer"
              >
                {isDeleting ? 'Deleting...' : 'Delete Coupon'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
