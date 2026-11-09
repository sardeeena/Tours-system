import React, { useState, useEffect, useMemo } from 'react';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  Calendar,
  CreditCard,
  MessageSquare,
  Users,
  Compass,
  Star,
  ShieldAlert,
  Check,
  RefreshCw,
  Filter,
  ExternalLink,
  ShieldCheck,
  Clock,
  Car,
  FileCheck,
} from 'lucide-react';
import {
  listStaffNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  checkAndGenerateStaffNotifications,
} from '../../../services/communicationService';
import { StaffNotification, NotificationCategory } from '../../../types/communication';
import { useToast } from '../../../contexts/ToastContext';

interface CommunicationsNotificationsProps {
  onNavigateTab?: (tabId: string, param?: string) => void;
}

const CATEGORY_LABELS: Record<NotificationCategory, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  new_booking: { label: 'New Booking', icon: Calendar },
  new_inquiry: { label: 'New Inquiry', icon: MessageSquare },
  new_payment: { label: 'New Payment', icon: CreditCard },
  payment_overdue: { label: 'Payment Overdue', icon: AlertTriangle },
  new_lead: { label: 'New Lead', icon: Users },
  followup_due: { label: 'Follow-up Due', icon: Clock },
  task_overdue: { label: 'Task Overdue', icon: AlertCircle },
  departure_unassigned: { label: 'Departure Unassigned', icon: Compass },
  pickup_pending: { label: 'Pickup Pending', icon: Car },
  document_expiring: { label: 'Document Expiring', icon: FileCheck },
  cancellation: { label: 'Cancellation', icon: AlertTriangle },
  new_review: { label: 'Traveler Review', icon: Star },
  operational_issue: { label: 'Harbor Warning', icon: ShieldAlert },
  payment_pending: { label: 'Pier Balance Due', icon: CreditCard },
};

export const CommunicationsNotifications: React.FC<CommunicationsNotificationsProps> = ({ onNavigateTab }) => {
  const { showToast } = useToast();

  const [notifications, setNotifications] = useState<StaffNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [scanning, setScanning] = useState(false);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const items = await listStaffNotifications();
      setNotifications(items);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const handleScanNow = async () => {
    setScanning(true);
    try {
      await checkAndGenerateStaffNotifications();
      await loadNotifications();
      showToast('Intelligent scan completed. Anti-spam deduplication active.', 'info');
    } catch (err) {
      console.error('Scan error:', err);
    } finally {
      setScanning(false);
    }
  };

  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
    } catch (err) {
      console.error('Mark read error:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      showToast('All notifications marked as read', 'success');
    } catch (err) {
      console.error('Mark all read error:', err);
    }
  };

  const handleNavigateToEntity = (n: StaffNotification) => {
    if (!n.isRead) {
      handleMarkAsRead(n.id);
    }
    if (n.linkTab && onNavigateTab) {
      onNavigateTab(n.linkTab, n.entityId);
    }
  };

  // Filtered notifications
  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      if (onlyUnread && n.isRead) return false;
      if (filterCategory !== 'all' && n.category !== filterCategory) return false;
      if (filterSeverity !== 'all' && n.severity !== filterSeverity) return false;
      return true;
    });
  }, [notifications, onlyUnread, filterCategory, filterSeverity]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const criticalCount = notifications.filter((n) => n.severity === 'critical' && !n.isRead).length;
  const warningCount = notifications.filter((n) => n.severity === 'warning' && !n.isRead).length;

  return (
    <div className="space-y-6">
      {/* Top Banner & Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-stone-900 border border-stone-800 p-5 rounded-xl shadow-lg">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              Staff Notification Center
              {unreadCount > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 font-semibold">
                  {unreadCount} Unread
                </span>
              )}
            </h1>
            <p className="text-xs text-stone-400">
              Operational event stream with strict deduplication engine preventing alert spam across all 10 operational categories
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={handleScanNow}
            disabled={scanning}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-medium rounded-lg border border-stone-700 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin text-teal-400' : ''}`} />
            <span>{scanning ? 'Scanning...' : 'Scan Events'}</span>
          </button>

          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-medium rounded-lg border border-stone-700 transition-colors cursor-pointer"
            >
              <Check className="w-3.5 h-3.5 text-teal-400" />
              <span>Mark All Read</span>
            </button>
          )}
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-4 shadow">
          <span className="text-[11px] font-medium text-stone-400">Unread Alerts</span>
          <div className="text-2xl font-bold text-white mt-1">{unreadCount}</div>
          <span className="text-[10px] text-teal-400 mt-0.5 block">Requires attention</span>
        </div>

        <div className="bg-stone-900 border border-stone-800 rounded-xl p-4 shadow">
          <span className="text-[11px] font-medium text-stone-400">Critical Warnings</span>
          <div className="text-2xl font-bold text-rose-400 mt-1">{criticalCount}</div>
          <span className="text-[10px] text-stone-500 mt-0.5 block">Harbor &amp; Unassigned</span>
        </div>

        <div className="bg-stone-900 border border-stone-800 rounded-xl p-4 shadow">
          <span className="text-[11px] font-medium text-stone-400">Warnings / Due</span>
          <div className="text-2xl font-bold text-amber-400 mt-1">{warningCount}</div>
          <span className="text-[10px] text-stone-500 mt-0.5 block">Follow-ups, Pickups &amp; Balances</span>
        </div>

        <div className="bg-stone-900 border border-stone-800 rounded-xl p-4 shadow">
          <span className="text-[11px] font-medium text-stone-400">Anti-Spam Engine</span>
          <div className="text-2xl font-bold text-emerald-400 mt-1 flex items-center gap-1.5">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <span>Active</span>
          </div>
          <span className="text-[10px] text-stone-500 mt-0.5 block">Zero duplicate spam</span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-stone-900 border border-stone-800 rounded-xl p-4 shadow flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Read vs Unread */}
          <div className="flex items-center bg-stone-950 p-1 rounded-lg border border-stone-800">
            <button
              type="button"
              onClick={() => setOnlyUnread(false)}
              className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
                !onlyUnread ? 'bg-stone-800 text-white' : 'text-stone-400 hover:text-white'
              }`}
            >
              All Alerts ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setOnlyUnread(true)}
              className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
                onlyUnread ? 'bg-teal-600 text-white' : 'text-stone-400 hover:text-white'
              }`}
            >
              Unread ({unreadCount})
            </button>
          </div>

          {/* Category Dropdown (All 10 + Standard categories) */}
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="bg-stone-950 border border-stone-800 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-teal-500"
          >
            <option value="all">All Event Categories</option>
            <option value="new_booking">New Bookings</option>
            <option value="new_inquiry">New Inquiries</option>
            <option value="new_payment">New Payments</option>
            <option value="payment_overdue">Payment Overdue</option>
            <option value="new_lead">New CRM Leads</option>
            <option value="followup_due">Follow-ups Due</option>
            <option value="task_overdue">Tasks Overdue</option>
            <option value="departure_unassigned">Departures Unassigned</option>
            <option value="pickup_pending">Pickups Pending</option>
            <option value="document_expiring">Documents Expiring</option>
            <option value="cancellation">Cancellations</option>
            <option value="new_review">Traveler Reviews</option>
            <option value="operational_issue">Harbor / Operational Warnings</option>
          </select>

          {/* Severity Dropdown */}
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="bg-stone-950 border border-stone-800 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-teal-500"
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
            <option value="success">Success</option>
          </select>
        </div>

        <div className="flex items-center text-stone-400 text-[11px]">
          Showing {filteredNotifications.length} of {notifications.length} alerts
        </div>
      </div>

      {/* Notifications Stream */}
      <div className="space-y-2.5">
        {loading ? (
          <div className="py-12 text-center text-stone-500 text-xs">
            Scanning internal notification streams...
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="bg-stone-900 border border-stone-800 rounded-xl p-12 text-center text-stone-500 text-xs">
            <CheckCircle2 className="w-8 h-8 text-teal-500/40 mx-auto mb-2" />
            <p className="font-medium text-stone-400">All caught up!</p>
            <p className="text-[11px] mt-1 text-stone-500">
              No staff alerts matching the current filter. New events are automatically monitored.
            </p>
          </div>
        ) : (
          filteredNotifications.map((n) => {
            const cat = CATEGORY_LABELS[n.category] || { label: n.category, icon: Bell };
            const IconComponent = cat.icon;

            const isCritical = n.severity === 'critical';
            const isWarning = n.severity === 'warning';
            const isSuccess = n.severity === 'success';

            return (
              <div
                key={n.id}
                onClick={() => handleNavigateToEntity(n)}
                className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  n.isRead
                    ? 'bg-stone-900/60 border-stone-800/80 hover:border-stone-700'
                    : isCritical
                    ? 'bg-rose-950/20 border-rose-500/30 hover:border-rose-500/50 shadow-xs'
                    : isWarning
                    ? 'bg-amber-950/20 border-amber-500/30 hover:border-amber-500/50 shadow-xs'
                    : isSuccess
                    ? 'bg-emerald-950/20 border-emerald-500/30 hover:border-emerald-500/50'
                    : 'bg-stone-900 border-stone-700/80 hover:border-teal-500/40 shadow-xs'
                }`}
              >
                <div className="flex items-start space-x-3.5">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      isCritical
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        : isWarning
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : isSuccess
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-teal-500/10 text-teal-400 border border-teal-500/20'
                    }`}
                  >
                    <IconComponent className="w-4 h-4" />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-white">{n.title}</span>
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-medium uppercase tracking-wider bg-stone-950 border border-stone-800 text-stone-400">
                        {cat.label}
                      </span>
                      {!n.isRead && (
                        <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
                      )}
                    </div>
                    <p className="text-xs text-stone-300 leading-relaxed max-w-2xl">{n.message}</p>
                    <div className="flex items-center space-x-3 text-[10px] text-stone-500 font-mono pt-0.5">
                      <span>{new Date(n.createdAt).toLocaleString()}</span>
                      {n.linkTab && (
                        <span className="text-teal-400 font-sans hover:underline flex items-center gap-0.5">
                          <span>Action in {n.linkTab.replace(/_/g, ' ')}</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2 self-end sm:self-center shrink-0">
                  {!n.isRead && (
                    <button
                      type="button"
                      onClick={(e) => handleMarkAsRead(n.id, e)}
                      title="Mark as read"
                      className="px-2.5 py-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white text-[11px] font-medium border border-stone-700 transition-colors cursor-pointer"
                    >
                      Mark Read
                    </button>
                  )}
                  {n.linkTab && (
                    <button
                      type="button"
                      onClick={() => handleNavigateToEntity(n)}
                      className="px-3 py-1 rounded bg-[#0A6C74] hover:bg-[#08545a] text-white text-[11px] font-semibold shadow transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <span>Open</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
