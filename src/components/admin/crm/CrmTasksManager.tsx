import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  User,
  Calendar,
  Trash2,
  Edit2,
  RefreshCw,
  Check,
} from 'lucide-react';
import {
  listTasks,
  createTask,
  updateTaskStatus,
  updateTask,
  deleteTask,
  CrmTask,
} from '../../../services/crmService';
import { TaskStatus, TaskPriority } from '../../../types/crm';
import { useToast } from '../../../contexts/ToastContext';

const STAFF_MEMBERS = [
  'Captain Tarek',
  'Mona Zaki (Concierge)',
  'Ahmed Fathy',
  'Captain Farouk',
  'Youssef Marina Desk',
];

export const CrmTasksManager: React.FC = () => {
  const { showToast } = useToast();
  const [tasks, setTasks] = useState<CrmTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [staffFilter, setStaffFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // New task modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<CrmTask | null>(null);
  const [formData, setFormData] = useState<Partial<CrmTask>>({
    title: '',
    description: '',
    customerName: '',
    leadName: '',
    bookingReference: '',
    assignedStaffName: STAFF_MEMBERS[0],
    dueDate: '',
    priority: 'Medium',
    status: 'Pending',
    isFollowUp: false,
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await listTasks();
      setTasks(data);
    } catch (err) {
      console.warn('Failed to load tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
      if (staffFilter !== 'all' && t.assignedStaffName !== staffFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          t.title.toLowerCase().includes(q) ||
          (t.description && t.description.toLowerCase().includes(q)) ||
          (t.customerName && t.customerName.toLowerCase().includes(q)) ||
          (t.leadName && t.leadName.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [tasks, statusFilter, priorityFilter, staffFilter, searchQuery]);

  const handleToggleStatus = async (task: CrmTask) => {
    const nextStatus: TaskStatus = task.status === 'Completed' ? 'Pending' : 'Completed';
    await updateTaskStatus(task.id, nextStatus);
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t))
    );
    showToast(`Task status set to "${nextStatus}".`, 'success');
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title?.trim()) {
      showToast('Task title is required.', 'error');
      return;
    }

    try {
      if (editingTask) {
        await updateTask(editingTask.id, formData);
        showToast('Task updated successfully.', 'success');
      } else {
        await createTask(formData);
        showToast('New staff task assigned.', 'success');
      }
      setIsModalOpen(false);
      setEditingTask(null);
      await loadData();
    } catch {
      showToast('Error saving task', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this task?')) return;
    await deleteTask(id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
    showToast('Task deleted.', 'info');
  };

  const openCreateModal = () => {
    setEditingTask(null);
    setFormData({
      title: '',
      description: '',
      customerName: '',
      leadName: '',
      bookingReference: '',
      assignedStaffName: STAFF_MEMBERS[0],
      dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      priority: 'Medium',
      status: 'Pending',
      isFollowUp: false,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (task: CrmTask) => {
    setEditingTask(task);
    setFormData({
      title: task.title,
      description: task.description || '',
      customerName: task.customerName || '',
      leadName: task.leadName || '',
      bookingReference: task.bookingReference || '',
      assignedStaffName: task.assignedStaffName || STAFF_MEMBERS[0],
      dueDate: task.dueDate ? task.dueDate.split('T')[0] : '',
      priority: task.priority,
      status: task.status,
      isFollowUp: task.isFollowUp,
    });
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] uppercase tracking-widest text-[#2dd4bf] font-bold block mb-0.5">
            Internal Operations
          </span>
          <h1 className="text-2xl font-bold font-display text-white tracking-tight flex items-center space-x-2">
            <Clock className="w-6 h-6 text-[#2dd4bf]" />
            <span>Staff Tasks & Operational To-Dos</span>
          </h1>
          <p className="text-xs text-stone-400 mt-1">
            Assign concierge tasks, tour guide briefings, Coast Guard manifest collection, and client follow-ups.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="p-2 bg-stone-900 border border-stone-800 text-stone-300 hover:text-white rounded text-xs transition-colors cursor-pointer"
            title="Refresh Tasks"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center space-x-1.5 px-4 py-2 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded text-xs font-semibold shadow transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Assign New Task</span>
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-stone-950 border border-stone-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search task title, traveler, or details..."
            className="w-full pl-9 pr-3 py-1.5 bg-stone-900 border border-stone-800 rounded text-stone-200 placeholder-stone-500 focus:outline-none focus:border-[#0A6C74]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-stone-900 border border-stone-800 rounded text-stone-300 focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-stone-900 border border-stone-800 rounded text-stone-300 focus:outline-none"
          >
            <option value="all">All Priorities</option>
            <option value="Urgent">Urgent</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>

          <select
            value={staffFilter}
            onChange={(e) => setStaffFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-stone-900 border border-stone-800 rounded text-stone-300 focus:outline-none"
          >
            <option value="all">All Staff</option>
            {STAFF_MEMBERS.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tasks Table */}
      {loading ? (
        <div className="p-16 text-center text-stone-400">
          <div className="w-8 h-8 border-2 border-[#0A6C74] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs">Loading staff tasks...</p>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="bg-stone-950 border border-stone-800 rounded-xl p-12 text-center text-stone-400">
          <Clock className="w-8 h-8 text-stone-600 mx-auto mb-2" />
          <p className="text-sm font-semibold text-stone-300">No tasks found</p>
          <p className="text-xs text-stone-500">Assign a new task to staff or adjust filters.</p>
        </div>
      ) : (
        <div className="bg-stone-950 border border-stone-800 rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-900 border-b border-stone-800 text-stone-400 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4 w-10">Done</th>
                  <th className="py-3 px-4">Task Title & Details</th>
                  <th className="py-3 px-4">Associated Entity</th>
                  <th className="py-3 px-4">Assigned To</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800/80">
                {filteredTasks.map((task) => {
                  const isDone = task.status === 'Completed';

                  return (
                    <tr
                      key={task.id}
                      className={`hover:bg-stone-900/50 transition-colors ${
                        isDone ? 'opacity-60 bg-stone-950/40' : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(task)}
                          className={`w-5 h-5 rounded border flex items-center justify-center transition-colors cursor-pointer ${
                            isDone
                              ? 'bg-emerald-600 border-emerald-500 text-white'
                              : 'border-stone-700 bg-stone-900 hover:border-[#0A6C74]'
                          }`}
                        >
                          {isDone && <Check className="w-3.5 h-3.5" />}
                        </button>
                      </td>

                      <td className="py-3 px-4">
                        <div
                          className={`font-semibold text-white ${
                            isDone ? 'line-through text-stone-400' : ''
                          }`}
                        >
                          {task.title}
                        </div>
                        {task.description && (
                          <div className="text-[11px] text-stone-400 line-clamp-1">
                            {task.description}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 text-stone-300">
                        {task.leadName && <div>Lead: {task.leadName}</div>}
                        {task.customerName && <div>Customer: {task.customerName}</div>}
                        {task.bookingReference && (
                          <div className="font-mono text-[10px] text-[#2dd4bf]">
                            Booking: {task.bookingReference}
                          </div>
                        )}
                        {!task.leadName && !task.customerName && !task.bookingReference && (
                          <span className="text-stone-500 italic">General Operations</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-stone-200">
                        {task.assignedStaffName || 'Unassigned'}
                      </td>

                      <td className="py-3 px-4 font-mono text-[11px] text-stone-300">
                        {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No deadline'}
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            task.priority === 'Urgent'
                              ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                              : task.priority === 'High'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-stone-900 text-stone-300 border border-stone-800'
                          }`}
                        >
                          {task.priority}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isDone
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : task.status === 'In Progress'
                              ? 'bg-sky-500/20 text-sky-300'
                              : 'bg-stone-800 text-stone-400'
                          }`}
                        >
                          {task.status}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openEditModal(task)}
                          className="p-1.5 text-stone-400 hover:text-white rounded hover:bg-stone-800 cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(task.id)}
                          className="p-1.5 text-red-400 hover:text-red-300 rounded hover:bg-red-950 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE / EDIT TASK MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl text-xs">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <Clock className="w-4 h-4 text-[#2dd4bf]" />
                <span>{editingTask ? 'Edit Task' : 'Assign New Task'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-stone-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveTask} className="space-y-3">
              <div>
                <label className="block text-stone-300 font-semibold mb-1">Task Title *</label>
                <input
                  type="text"
                  required
                  value={formData.title || ''}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Call customer tomorrow about Luxor tour..."
                  className="w-full px-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-white focus:outline-none focus:border-[#0A6C74]"
                />
              </div>

              <div>
                <label className="block text-stone-300 font-semibold mb-1">Description / Notes</label>
                <textarea
                  rows={2}
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Additional context or specific checklist..."
                  className="w-full px-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-white focus:outline-none focus:border-[#0A6C74]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-300 font-semibold mb-1">Assigned Staff</label>
                  <select
                    value={formData.assignedStaffName || STAFF_MEMBERS[0]}
                    onChange={(e) => setFormData({ ...formData, assignedStaffName: e.target.value })}
                    className="w-full px-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-white"
                  >
                    {STAFF_MEMBERS.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-stone-300 font-semibold mb-1">Due Date</label>
                  <input
                    type="date"
                    value={formData.dueDate || ''}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    className="w-full px-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-300 font-semibold mb-1">Priority</label>
                  <select
                    value={formData.priority || 'Medium'}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                    className="w-full px-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-white"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-stone-300 font-semibold mb-1">Status</label>
                  <select
                    value={formData.status || 'Pending'}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-white"
                  >
                    <option value="Pending">Pending</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="isFollowUpCheck"
                  checked={Boolean(formData.isFollowUp)}
                  onChange={(e) => setFormData({ ...formData, isFollowUp: e.target.checked })}
                  className="rounded border-stone-800 text-[#0A6C74] focus:ring-0"
                />
                <label htmlFor="isFollowUpCheck" className="text-stone-300 cursor-pointer">
                  Mark as Follow-up (tracks in follow-up reminders & overdue dashboard)
                </label>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded font-semibold cursor-pointer shadow"
                >
                  {editingTask ? 'Update Task' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
