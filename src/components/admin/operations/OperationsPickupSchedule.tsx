import React, { useState, useEffect, useMemo } from 'react';
import {
  Car,
  Search,
  Filter,
  Phone,
  Printer,
  Download,
  Clock,
  MapPin,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Users,
  Building,
  LayoutGrid,
  List,
  Edit2,
  UserCheck,
} from 'lucide-react';
import {
  getDailyPickupSchedule,
  updatePickupScheduleStatus,
  listGuides,
} from '../../../services/operationsService';
import { PickupScheduleItem, PickupStatus } from '../../../types/operations';
import { DbGuide } from '../../../types/database';
import { useToast } from '../../../contexts/ToastContext';

export const OperationsPickupSchedule: React.FC = () => {
  const { showToast } = useToast();
  const [selectedDate, setSelectedDate] = useState<string>(
    () => new Date().toISOString().split('T')[0]
  );
  const [pickups, setPickups] = useState<PickupScheduleItem[]>([]);
  const [drivers, setDrivers] = useState<DbGuide[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');

  // Edit pickup driver modal
  const [editingItem, setEditingItem] = useState<PickupScheduleItem | null>(null);
  const [assignedDriver, setAssignedDriver] = useState('');
  const [assignedVehicle, setAssignedVehicle] = useState('');
  const [assignedTime, setAssignedTime] = useState('');
  const [savingAction, setSavingAction] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [data, allGuides] = await Promise.all([
        getDailyPickupSchedule(selectedDate),
        listGuides(),
      ]);
      setPickups(data);
      setDrivers(allGuides.filter((g) => g.role === 'driver' || g.role === 'guide'));
    } catch (err) {
      console.warn('Failed to load pickup schedule:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedDate]);

  const filteredPickups = useMemo(() => {
    return pickups.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.hotelName.toLowerCase().includes(q) ||
          item.customerName.toLowerCase().includes(q) ||
          item.bookingReference.toLowerCase().includes(q) ||
          (item.pickupArea && item.pickupArea.toLowerCase().includes(q)) ||
          (item.driverName && item.driverName.toLowerCase().includes(q)) ||
          (item.driverVehicle && item.driverVehicle.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [pickups, statusFilter, searchQuery]);

  const handleStatusChange = async (bookingRef: string, newStatus: PickupStatus) => {
    await updatePickupScheduleStatus(bookingRef, newStatus);
    setPickups((prev) =>
      prev.map((p) => (p.bookingReference === bookingRef ? { ...p, status: newStatus } : p))
    );
    showToast(`Pickup status for ${bookingRef} updated to "${newStatus}".`, 'success');
  };

  const handleOpenEdit = (item: PickupScheduleItem) => {
    setEditingItem(item);
    setAssignedDriver(item.driverName || 'Captain Mahmoud');
    setAssignedVehicle(item.driverVehicle || 'Toyota HiAce VIP');
    setAssignedTime(item.pickupTime || '07:30');
  };

  const handleSaveDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setSavingAction(true);
    try {
      await updatePickupScheduleStatus(
        editingItem.bookingReference,
        editingItem.status,
        assignedVehicle.trim(),
        assignedDriver.trim()
      );
      setPickups((prev) =>
        prev.map((p) =>
          p.bookingReference === editingItem.bookingReference
            ? {
                ...p,
                driverName: assignedDriver.trim(),
                driverVehicle: assignedVehicle.trim(),
                pickupTime: assignedTime,
              }
            : p
        )
      );
      showToast(`Driver & vehicle assigned for ${editingItem.bookingReference}.`, 'success');
      setEditingItem(null);
    } catch {
      showToast('Failed to update driver assignment.', 'error');
    } finally {
      setSavingAction(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const getStatusColor = (status: PickupStatus) => {
    switch (status) {
      case 'pending':
        return 'bg-stone-800 text-stone-300 border-stone-700';
      case 'confirmed':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'picked_up':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'no_show':
        return 'bg-red-500/20 text-red-300 border-red-500/30';
      case 'cancelled':
        return 'bg-stone-800 text-stone-400 border-stone-700';
      default:
        return 'bg-stone-800 text-stone-300';
    }
  };

  const totalPassengers = pickups.reduce((sum, p) => sum + p.passengerCount, 0);

  // Status columns for the Pickup Board
  const boardColumns: Array<{
    id: PickupStatus;
    title: string;
    color: string;
  }> = [
    { id: 'pending', title: 'Pending Pickup', color: 'border-stone-700 text-stone-400' },
    { id: 'confirmed', title: 'Confirmed / On Route', color: 'border-blue-500/40 text-blue-400' },
    { id: 'picked_up', title: 'Picked Up (Boarded)', color: 'border-emerald-500/40 text-emerald-400' },
    { id: 'no_show', title: 'No Show', color: 'border-red-500/40 text-red-400' },
    { id: 'cancelled', title: 'Cancelled', color: 'border-stone-800 text-stone-500' },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <span className="text-[10px] uppercase tracking-widest text-[#2dd4bf] font-bold block mb-0.5">
            Logistics & Hotel Transfers
          </span>
          <h1 className="text-2xl font-bold font-display text-white tracking-tight flex items-center space-x-2">
            <Car className="w-6 h-6 text-[#2dd4bf]" />
            <span>Hotel Pickup Board & Schedules</span>
          </h1>
          <p className="text-xs text-stone-400 mt-1">
            Real-time hotel lobby dispatch, room number manifests, driver assignments, and boarding checks.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View toggle */}
          <div className="bg-stone-900 border border-stone-800 rounded-lg p-0.5 flex items-center text-xs">
            <button
              type="button"
              onClick={() => setViewMode('board')}
              className={`px-3 py-1.5 rounded flex items-center space-x-1 font-medium transition-colors cursor-pointer ${
                viewMode === 'board' ? 'bg-[#0A6C74] text-white' : 'text-stone-400 hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Pickup Board</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded flex items-center space-x-1 font-medium transition-colors cursor-pointer ${
                viewMode === 'list' ? 'bg-[#0A6C74] text-white' : 'text-stone-400 hover:text-white'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Table View</span>
            </button>
          </div>

          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-1.5 bg-stone-900 border border-stone-800 rounded text-white text-xs font-mono"
          />

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="p-2 bg-stone-900 border border-stone-800 text-stone-300 hover:text-white rounded text-xs transition-colors cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-stone-900 border border-stone-800 text-stone-300 hover:text-white rounded text-xs cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Run Sheet</span>
          </button>
        </div>
      </div>

      {/* Overview Stat Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs print:hidden">
        {boardColumns.map((col) => {
          const count = pickups.filter((p) => p.status === col.id).length;
          const pax = pickups
            .filter((p) => p.status === col.id)
            .reduce((sum, p) => sum + p.passengerCount, 0);

          return (
            <div
              key={col.id}
              onClick={() => setStatusFilter(statusFilter === col.id ? 'all' : col.id)}
              className={`p-3 bg-stone-950 border rounded-xl cursor-pointer transition-all ${
                statusFilter === col.id
                  ? 'border-[#2dd4bf] ring-1 ring-[#2dd4bf]'
                  : 'border-stone-800 hover:border-stone-700'
              }`}
            >
              <span className="text-[10px] uppercase font-bold text-stone-400 block truncate">
                {col.title}
              </span>
              <div className="text-xl font-bold font-mono text-white mt-0.5">{count}</div>
              <div className="text-[10px] text-[#2dd4bf] mt-0.5">{pax} total guests</div>
            </div>
          );
        })}
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-stone-950 border border-stone-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs print:hidden">
        <div className="flex items-center space-x-2">
          <span className="text-stone-400 text-xs">Filter Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-stone-900 border border-stone-800 rounded text-stone-200"
          >
            <option value="all">All Pickup Statuses</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="picked_up">Picked Up</option>
            <option value="no_show">No Show</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search hotel, guest, driver, ref..."
            className="w-full pl-9 pr-3 py-1.5 bg-stone-900 border border-stone-800 rounded text-stone-200 placeholder-stone-500 focus:outline-none focus:border-[#0A6C74]"
          />
        </div>
      </div>

      {/* VIEW: PICKUP BOARD (KANBAN COLUMNS) */}
      {viewMode === 'board' && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {boardColumns.map((col) => {
            const colItems = filteredPickups.filter((p) => p.status === col.id);

            return (
              <div
                key={col.id}
                className="bg-stone-950 border border-stone-800 rounded-xl p-3 flex flex-col space-y-3 min-h-[480px]"
              >
                <div className="flex items-center justify-between border-b border-stone-800 pb-2">
                  <span className={`text-xs font-bold uppercase tracking-wider ${col.color}`}>
                    {col.title}
                  </span>
                  <span className="px-2 py-0.2 rounded text-[10px] font-mono font-bold bg-stone-900 text-stone-300">
                    {colItems.length}
                  </span>
                </div>

                <div className="space-y-2 flex-1 overflow-y-auto pr-0.5">
                  {colItems.length === 0 ? (
                    <div className="text-[11px] text-stone-600 text-center pt-8 italic">
                      No pickups in this stage
                    </div>
                  ) : (
                    colItems.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 bg-stone-900 rounded-lg border border-stone-800 hover:border-stone-700 transition-colors text-xs space-y-2 shadow-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-amber-300 flex items-center space-x-1">
                            <Clock className="w-3 h-3" />
                            <span>{item.pickupTime}</span>
                          </span>
                          <span className="text-[10px] font-mono text-stone-400">
                            {item.bookingReference}
                          </span>
                        </div>

                        <div>
                          <div className="font-bold text-white text-[12px]">{item.customerName}</div>
                          <div className="text-[10px] text-[#2dd4bf]">{item.passengerCount} Passengers</div>
                        </div>

                        <div className="space-y-0.5 text-[11px] text-stone-300 border-t border-stone-800/80 pt-1.5">
                          <div className="flex items-start space-x-1 font-medium">
                            <MapPin className="w-3 h-3 text-stone-500 shrink-0 mt-0.5" />
                            <span className="truncate">{item.hotelName}</span>
                          </div>
                          {item.roomNumber && (
                            <div className="text-[10px] text-stone-400 pl-4">
                              Room: <strong className="text-stone-200">{item.roomNumber}</strong>
                            </div>
                          )}
                        </div>

                        <div className="text-[10px] text-stone-400 bg-stone-950 p-1.5 rounded flex items-center justify-between">
                          <span className="truncate">{item.driverName || 'Unassigned Driver'}</span>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(item)}
                            className="text-[#2dd4bf] hover:underline cursor-pointer"
                          >
                            Assign
                          </button>
                        </div>

                        {/* Status Quick Action Buttons */}
                        <div className="flex items-center justify-between pt-1 border-t border-stone-800/60">
                          {col.id !== 'confirmed' && (
                            <button
                              type="button"
                              onClick={() => handleStatusChange(item.bookingReference, 'confirmed')}
                              className="text-[10px] px-1.5 py-0.5 bg-blue-500/20 text-blue-300 rounded hover:bg-blue-500/30 cursor-pointer"
                            >
                              Confirm
                            </button>
                          )}
                          {col.id !== 'picked_up' && (
                            <button
                              type="button"
                              onClick={() => handleStatusChange(item.bookingReference, 'picked_up')}
                              className="text-[10px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 rounded hover:bg-emerald-500/30 cursor-pointer"
                            >
                              Picked Up
                            </button>
                          )}
                          {col.id !== 'no_show' && (
                            <button
                              type="button"
                              onClick={() => handleStatusChange(item.bookingReference, 'no_show')}
                              className="text-[10px] px-1.5 py-0.5 bg-red-500/20 text-red-300 rounded hover:bg-red-500/30 cursor-pointer"
                            >
                              No Show
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW: TABLE VIEW */}
      {viewMode === 'list' && (
        <div className="bg-stone-950 border border-stone-800 rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-900 border-b border-stone-800 text-stone-400 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-3">Pickup Time</th>
                  <th className="py-3 px-3">Guest & Contact</th>
                  <th className="py-3 px-3">Hotel & Room</th>
                  <th className="py-3 px-3">Area</th>
                  <th className="py-3 px-3">Pax</th>
                  <th className="py-3 px-3">Tour</th>
                  <th className="py-3 px-3">Assigned Driver & Vehicle</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800/80">
                {filteredPickups.map((p) => (
                  <tr key={p.id} className="hover:bg-stone-900/50 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-bold text-amber-300">
                      {p.pickupTime}
                    </td>

                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-white">{p.customerName}</div>
                      <div className="text-[10px] text-stone-400 font-mono">
                        {p.customerPhone || p.bookingReference}
                      </div>
                    </td>

                    <td className="py-2.5 px-3">
                      <div className="font-medium text-stone-200">{p.hotelName}</div>
                      {p.roomNumber && (
                        <div className="text-[10px] text-stone-400">Room {p.roomNumber}</div>
                      )}
                    </td>

                    <td className="py-2.5 px-3 text-stone-300">{p.pickupArea}</td>

                    <td className="py-2.5 px-3 font-mono font-bold text-[#2dd4bf]">
                      {p.passengerCount}
                    </td>

                    <td className="py-2.5 px-3 text-stone-300 truncate max-w-xs">{p.tourTitle}</td>

                    <td className="py-2.5 px-3">
                      <div className="text-white font-medium">{p.driverName || 'Unassigned'}</div>
                      <div className="text-[10px] text-stone-400">{p.driverVehicle || 'Van #12'}</div>
                    </td>

                    <td className="py-2.5 px-3">
                      <select
                        value={p.status}
                        onChange={(e) =>
                          handleStatusChange(p.bookingReference, e.target.value as PickupStatus)
                        }
                        className={`px-2 py-1 rounded text-[11px] font-bold border uppercase tracking-wider focus:outline-none ${getStatusColor(
                          p.status
                        )}`}
                      >
                        <option value="pending">Pending</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="picked_up">Picked Up</option>
                        <option value="no_show">No Show</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </td>

                    <td className="py-2.5 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(p)}
                        className="p-1.5 text-stone-400 hover:text-white rounded hover:bg-stone-800 cursor-pointer"
                        title="Assign Driver"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Driver Assignment Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-xl p-6 w-full max-w-md space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <h3 className="font-bold text-white text-base">Assign Transfer Driver & Vehicle</h3>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="text-stone-400 hover:text-white cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveDriver} className="space-y-4 text-xs">
              <div>
                <span className="text-stone-400 block text-[11px]">Passenger</span>
                <div className="font-bold text-white text-sm">
                  {editingItem.customerName} ({editingItem.passengerCount} pax) &bull; {editingItem.hotelName}
                </div>
              </div>

              <div>
                <label className="block text-stone-300 font-semibold mb-1">Pickup Time</label>
                <input
                  type="time"
                  value={assignedTime}
                  onChange={(e) => setAssignedTime(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded text-stone-200 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-stone-300 font-semibold mb-1">Assigned Driver</label>
                <input
                  type="text"
                  value={assignedDriver}
                  onChange={(e) => setAssignedDriver(e.target.value)}
                  placeholder="e.g. Captain Mahmoud Hassan"
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded text-stone-200"
                  required
                />
              </div>

              <div>
                <label className="block text-stone-300 font-semibold mb-1">Vehicle Details</label>
                <input
                  type="text"
                  value={assignedVehicle}
                  onChange={(e) => setAssignedVehicle(e.target.value)}
                  placeholder="e.g. Toyota HiAce VIP (Plate 8841-RED)"
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded text-stone-200"
                  required
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-3 py-1.5 bg-stone-800 text-stone-300 rounded hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAction}
                  className="px-4 py-1.5 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded font-semibold cursor-pointer disabled:opacity-50"
                >
                  {savingAction ? 'Saving...' : 'Save Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
