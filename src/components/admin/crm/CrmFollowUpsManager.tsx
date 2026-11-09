import React, { useState, useEffect } from 'react';
import {
  Clock,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Plus,
  Phone,
  MessageCircle,
  RefreshCw,
  ArrowRight,
  User,
  Sparkles,
} from 'lucide-react';
import {
  getFollowUpsDue,
  updateTaskStatus,
  updateTask,
  createTask,
  CrmTask,
} from '../../../services/crmService';
import { useToast } from '../../../contexts/ToastContext';

export const CrmFollowUpsManager: React.FC = () => {
  const { showToast } = useToast();
  const [dueToday, setDueToday] = useState<CrmTask[]>([]);
  const [overdue, setOverdue] = useState<CrmTask[]>([]);
  const [upcoming, setUpcoming] = useState<CrmTask[]>([]);
  const [loading, setLoading] = useState(true);

  // Quick schedule modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [assignedStaff, setAssignedStaff] = useState('Captain Tarek');

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getFollowUpsDue();
      setDueToday(data.dueToday);
      setOverdue(data.overdue);
      setUpcoming(data.upcoming);
    } catch (err) {
      console.warn('Failed to load follow-ups:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleMarkDone = async (task: CrmTask) => {
    await updateTaskStatus(task.id, 'Completed');
    showToast(`Follow-up "${task.title}" completed!`, 'success');
    await loadData();
  };

  const handleReschedule = async (task: CrmTask, daysToAdd: number) => {
    const nextDate = new Date(Date.now() + daysToAdd * 86400000).toISOString();
    await updateTask(task.id, { dueDate: nextDate, status: 'Pending' });
    showToast(`Follow-up rescheduled by +${daysToAdd} day(s).`, 'info');
    await loadData();
  };

  const handleCreateFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    await createTask({
      title: title.trim(),
      customerName: customerName.trim() || undefined,
      dueDate: dueDate || new Date(Date.now() + 86400000).toISOString(),
      assignedStaffName: assignedStaff,
      priority: 'High',
      isFollowUp: true,
      status: 'Pending',
    });

    showToast('Follow-up scheduled successfully.', 'success');
    setIsModalOpen(false);
    setTitle('');
    setCustomerName('');
    setDueDate('');
    await loadData();
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] uppercase tracking-widest text-[#2dd4bf] font-bold block mb-0.5">
            Client Nurturing & Follow-ups
          </span>
          <h1 className="text-2xl font-bold font-display text-white tracking-tight flex items-center space-x-2">
            <Clock className="w-6 h-6 text-[#2dd4bf]" />
            <span>Scheduled Follow-ups</span>
          </h1>
          <p className="text-xs text-stone-400 mt-1">
            Ensure no inquiry goes cold. Timely callbacks, quotation check-ins, and pre-departure briefings.
          </p>
        </div>

        <div className="flex items-center space-x-2">
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
            onClick={() => {
              setDueDate(new Date(Date.now() + 86400000).toISOString().split('T')[0]);
              setIsModalOpen(true);
            }}
            className="inline-flex items-center space-x-1.5 px-4 py-2 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded text-xs font-semibold shadow transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Schedule Follow-up</span>
          </button>
        </div>
      </div>

      {/* OVERDUE SECTION (PROMINENT HIGHLIGHT) */}
      {overdue.length > 0 && (
        <div className="bg-red-950/40 border-2 border-red-500/60 rounded-xl p-5 space-y-3">
          <div className="flex items-center space-x-2.5 text-red-400">
            <AlertTriangle className="w-5 h-5 animate-pulse" />
            <h2 className="text-sm font-bold text-red-100 uppercase tracking-wider">
              CRITICAL: {overdue.length} Overdue Follow-up{overdue.length > 1 ? 's' : ''} Require Immediate Attention!
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {overdue.map((task) => (
              <div
                key={task.id}
                className="p-3 bg-stone-900 border border-red-500/40 rounded-lg flex flex-col justify-between space-y-2 text-xs shadow"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-xs">{task.title}</span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500/30 text-red-300 font-mono">
                      OVERDUE
                    </span>
                  </div>
                  <p className="text-stone-300 text-[11px] mt-1">{task.description || 'Follow-up call'}</p>
                  <div className="text-[10px] text-stone-400 mt-1 font-mono">
                    Traveler: <strong className="text-white">{task.customerName || task.leadName || 'Client'}</strong> &bull; Assigned: {task.assignedStaffName}
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-2 pt-2 border-t border-stone-800">
                  <button
                    type="button"
                    onClick={() => handleReschedule(task, 1)}
                    className="px-2 py-1 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded text-[10px] font-medium cursor-pointer"
                  >
                    +1 Day
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMarkDone(task)}
                    className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-[10px] font-semibold cursor-pointer"
                  >
                    Mark Done
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DUE TODAY SECTION */}
      <div className="bg-stone-950 border border-stone-800 rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-stone-800 pb-2.5">
          <h2 className="text-sm font-bold text-white flex items-center space-x-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <span>Due Today ({dueToday.length})</span>
          </h2>
          <span className="text-[10px] text-stone-500 font-mono">Current Business Day</span>
        </div>

        {dueToday.length === 0 ? (
          <p className="p-6 text-center text-stone-500 text-xs">
            No follow-ups due today. You are completely caught up!
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {dueToday.map((task) => (
              <div
                key={task.id}
                className="p-3 bg-stone-900 border border-stone-800 hover:border-amber-500/40 rounded-lg flex flex-col justify-between space-y-2 text-xs transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white">{task.title}</span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 font-mono">
                      TODAY
                    </span>
                  </div>
                  <p className="text-stone-300 text-[11px] mt-1">{task.description || 'Check-in on tour interest'}</p>
                  <div className="text-[10px] text-stone-400 mt-1 font-mono">
                    Client: <strong className="text-white">{task.customerName || task.leadName || 'Traveler'}</strong> &bull; Staff: {task.assignedStaffName}
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-2 pt-2 border-t border-stone-800">
                  <button
                    type="button"
                    onClick={() => handleReschedule(task, 1)}
                    className="px-2 py-1 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded text-[10px] font-medium cursor-pointer"
                  >
                    Tomorrow
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMarkDone(task)}
                    className="px-3 py-1 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded text-[10px] font-semibold cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* UPCOMING SECTION */}
      <div className="bg-stone-950 border border-stone-800 rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-stone-800 pb-2.5">
          <h2 className="text-sm font-bold text-white flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-sky-400" />
            <span>Upcoming Follow-ups ({upcoming.length})</span>
          </h2>
        </div>

        {upcoming.length === 0 ? (
          <p className="p-6 text-center text-stone-500 text-xs">No upcoming follow-ups scheduled.</p>
        ) : (
          <div className="space-y-2">
            {upcoming.map((task) => (
              <div
                key={task.id}
                className="p-3 bg-stone-900 border border-stone-800 rounded-lg flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-semibold text-white">{task.title}</span>
                  <div className="text-[10px] text-stone-400 font-mono">
                    Client: {task.customerName || task.leadName || 'Traveler'} &bull; Assigned: {task.assignedStaffName} &bull; Date:{' '}
                    {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'TBD'}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleMarkDone(task)}
                  className="px-2.5 py-1 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded text-[10px] font-medium cursor-pointer"
                >
                  Done
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-xl max-w-md w-full p-6 space-y-4 text-xs">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <Clock className="w-4 h-4 text-[#2dd4bf]" />
              <span>Schedule New Follow-up</span>
            </h3>

            <form onSubmit={handleCreateFollowUp} className="space-y-3">
              <div>
                <label className="block text-stone-300 font-semibold mb-1">Follow-up Action *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Call customer tomorrow about Luxor tour..."
                  className="w-full px-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-white"
                />
              </div>

              <div>
                <label className="block text-stone-300 font-semibold mb-1">Traveler / Lead Name</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. David Van Houten"
                  className="w-full px-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-300 font-semibold mb-1">Follow-up Date</label>
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-white"
                  />
                </div>

                <div>
                  <label className="block text-stone-300 font-semibold mb-1">Assigned Staff</label>
                  <select
                    value={assignedStaff}
                    onChange={(e) => setAssignedStaff(e.target.value)}
                    className="w-full px-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-white"
                  >
                    <option value="Captain Tarek">Captain Tarek</option>
                    <option value="Mona Zaki (Concierge)">Mona Zaki (Concierge)</option>
                    <option value="Ahmed Fathy">Ahmed Fathy</option>
                    <option value="Captain Farouk">Captain Farouk</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 bg-stone-800 text-stone-300 rounded font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded font-semibold cursor-pointer"
                >
                  Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
