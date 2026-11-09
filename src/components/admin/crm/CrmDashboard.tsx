import React, { useState, useEffect } from 'react';
import {
  Users,
  UserCheck,
  TrendingUp,
  Clock,
  AlertCircle,
  CalendarCheck,
  DollarSign,
  PhoneCall,
  MessageSquare,
  Plus,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Compass,
  Building,
  RefreshCw,
} from 'lucide-react';
import {
  getCrmDashboardMetrics,
  getFollowUpsDue,
  getGlobalActivityTimeline,
  updateTaskStatus,
  CrmLead,
  CrmTask,
  CrmActivity,
} from '../../../services/crmService';
import { CrmDashboardMetrics } from '../../../types/crm';
import { useToast } from '../../../contexts/ToastContext';

interface CrmDashboardProps {
  onNavigateTab: (tabId: string, param?: string) => void;
  onOpenNewLead?: () => void;
  onOpenNewTask?: () => void;
}

export const CrmDashboard: React.FC<CrmDashboardProps> = ({
  onNavigateTab,
  onOpenNewLead,
  onOpenNewTask,
}) => {
  const { showToast } = useToast();
  const [metrics, setMetrics] = useState<CrmDashboardMetrics | null>(null);
  const [overdueTasks, setOverdueTasks] = useState<CrmTask[]>([]);
  const [dueTodayTasks, setDueTodayTasks] = useState<CrmTask[]>([]);
  const [recentActivities, setRecentActivities] = useState<CrmActivity[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [m, followUps, acts] = await Promise.all([
        getCrmDashboardMetrics(),
        getFollowUpsDue(),
        getGlobalActivityTimeline(8),
      ]);
      setMetrics(m);
      setOverdueTasks(followUps.overdue);
      setDueTodayTasks(followUps.dueToday);
      setRecentActivities(acts);
    } catch (err) {
      console.warn('Failed to load CRM dashboard metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCompleteTask = async (task: CrmTask) => {
    await updateTaskStatus(task.id, 'Completed');
    showToast(`Task "${task.title}" marked as completed.`, 'success');
    await loadData();
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] uppercase tracking-widest text-[#2dd4bf] font-bold block mb-0.5">
            Customer Relationship Management
          </span>
          <h1 className="text-2xl font-bold font-display text-white tracking-tight flex items-center space-x-2">
            <span>CRM Operations & Lead Velocity</span>
          </h1>
          <p className="text-xs text-stone-400 mt-1">
            Real-time pipeline, traveler touchpoints, task follow-ups, and customer lifetime value.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="p-2 bg-stone-900 border border-stone-800 text-stone-300 hover:text-white rounded text-xs transition-colors cursor-pointer"
            title="Refresh CRM metrics"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('crm_tasks')}
            className="inline-flex items-center space-x-1.5 px-3 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded text-xs font-medium border border-stone-700 transition-colors cursor-pointer"
          >
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>Schedule Follow-up</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('crm_leads')}
            className="inline-flex items-center space-x-1.5 px-4 py-2 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded text-xs font-semibold shadow transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Lead Pipeline</span>
          </button>
        </div>
      </div>

      {/* Overdue Follow-ups Alert Banner */}
      {overdueTasks.length > 0 && (
        <div className="bg-red-950/40 border border-red-500/40 rounded-xl p-4 text-xs text-red-200 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
              <strong className="text-sm font-bold text-red-100">
                Action Required: {overdueTasks.length} Overdue Follow-up{overdueTasks.length > 1 ? 's' : ''}!
              </strong>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('crm_followups')}
              className="text-red-300 hover:text-white underline text-xs font-medium"
            >
              View all follow-ups &rarr;
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
            {overdueTasks.slice(0, 4).map((task) => (
              <div
                key={task.id}
                className="bg-stone-900/80 border border-red-500/30 rounded p-2.5 flex items-center justify-between"
              >
                <div className="space-y-0.5 truncate pr-2">
                  <p className="font-semibold text-white truncate text-[11px]">{task.title}</p>
                  <p className="text-[10px] text-stone-400">
                    Assigned: {task.assignedStaffName || 'Staff'} &bull; Due:{' '}
                    {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'Immediate'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleCompleteTask(task)}
                  className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-[10px] font-semibold shrink-0 cursor-pointer"
                >
                  Mark Done
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total & New Leads */}
        <div
          onClick={() => onNavigateTab('crm_leads')}
          className="bg-stone-950 border border-stone-800 hover:border-stone-700 p-3.5 rounded-xl cursor-pointer transition-colors"
        >
          <div className="flex items-center justify-between text-stone-400 mb-1.5">
            <span className="text-[10px] uppercase font-bold tracking-wider">Leads Pipeline</span>
            <Users className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-xl font-bold font-display text-white">
            {metrics?.totalLeadsCount ?? '...'}
          </div>
          <span className="text-[10px] text-stone-500">
            {metrics?.newLeadsCount ?? 0} new &bull; {metrics?.qualifiedLeadsCount ?? 0} qualified
          </span>
        </div>

        {/* Won & Lost Deals */}
        <div
          onClick={() => onNavigateTab('crm_leads')}
          className="bg-stone-950 border border-stone-800 hover:border-stone-700 p-3.5 rounded-xl cursor-pointer transition-colors"
        >
          <div className="flex items-center justify-between text-stone-400 mb-1.5">
            <span className="text-[10px] uppercase font-bold tracking-wider">Won / Conversion</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold font-display text-white">
            {metrics?.wonLeadsCount ?? 0} <span className="text-xs text-emerald-400 font-normal">({metrics?.conversionRate ?? 0}%)</span>
          </div>
          <span className="text-[10px] text-stone-500">
            €{(metrics?.totalWonLeadsEur || 0).toLocaleString()} closed
          </span>
        </div>

        {/* Open Inquiries */}
        <div
          onClick={() => onNavigateTab('crm_inquiries')}
          className="bg-stone-950 border border-stone-800 hover:border-stone-700 p-3.5 rounded-xl cursor-pointer transition-colors"
        >
          <div className="flex items-center justify-between text-stone-400 mb-1.5">
            <span className="text-[10px] uppercase font-bold tracking-wider">Help Inquiries</span>
            <MessageSquare className="w-4 h-4 text-[#2dd4bf]" />
          </div>
          <div className="text-xl font-bold font-display text-white">
            {metrics?.newInquiriesCount ?? 0}
          </div>
          <span className="text-[10px] text-stone-500">New concierge tickets</span>
        </div>

        {/* Overdue & Open Tasks */}
        <div
          onClick={() => onNavigateTab('crm_followups')}
          className="bg-stone-950 border border-stone-800 hover:border-stone-700 p-3.5 rounded-xl cursor-pointer transition-colors"
        >
          <div className="flex items-center justify-between text-stone-400 mb-1.5">
            <span className="text-[10px] uppercase font-bold tracking-wider">Follow-ups Due</span>
            <Clock className={`w-4 h-4 ${(metrics?.overdueFollowUpsCount || 0) > 0 ? 'text-red-400' : 'text-amber-400'}`} />
          </div>
          <div className="text-xl font-bold font-display text-white">
            {metrics?.followUpsDueCount ?? 0}
          </div>
          <span className={`text-[10px] ${(metrics?.overdueFollowUpsCount || 0) > 0 ? 'text-red-400 font-bold' : 'text-stone-500'}`}>
            {metrics?.overdueFollowUpsCount ?? 0} overdue &bull; {metrics?.openTasksCount ?? 0} open
          </span>
        </div>

        {/* Customers & Repeat */}
        <div
          onClick={() => onNavigateTab('crm_customers')}
          className="bg-stone-950 border border-stone-800 hover:border-stone-700 p-3.5 rounded-xl cursor-pointer transition-colors"
        >
          <div className="flex items-center justify-between text-stone-400 mb-1.5">
            <span className="text-[10px] uppercase font-bold tracking-wider">Repeat Travelers</span>
            <UserCheck className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-xl font-bold font-display text-white">
            {metrics?.repeatCustomersCount ?? 0}
          </div>
          <span className="text-[10px] text-stone-500">
            {metrics?.newCustomersCount ?? 0} new this week
          </span>
        </div>

        {/* Total Revenue & CLV */}
        <div
          onClick={() => onNavigateTab('crm_customers')}
          className="bg-stone-950 border border-stone-800 hover:border-stone-700 p-3.5 rounded-xl cursor-pointer transition-colors"
        >
          <div className="flex items-center justify-between text-stone-400 mb-1.5">
            <span className="text-[10px] uppercase font-bold tracking-wider">Lifetime Value</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold font-display text-white">
            €{(metrics?.customerLifetimeValueAvgEur || 0).toLocaleString()}
          </div>
          <span className="text-[10px] text-emerald-400 font-mono">
            €{(metrics?.totalRevenueEur || 0).toLocaleString()} gross
          </span>
        </div>
      </div>

      {/* Main Grid: Pipeline Quick Actions & Realtime Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Pipeline Stages and Tasks Due Today */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quick Hub Navigation Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button
              type="button"
              onClick={() => onNavigateTab('crm_leads')}
              className="p-3 bg-stone-950 border border-stone-800 hover:border-[#0A6C74] rounded-lg text-left transition-colors cursor-pointer group"
            >
              <Users className="w-4 h-4 text-[#2dd4bf] mb-2 group-hover:scale-110 transition-transform" />
              <div className="font-semibold text-white text-xs">Leads Pipeline</div>
              <div className="text-[10px] text-stone-500">8 stages with Kanban</div>
            </button>

            <button
              type="button"
              onClick={() => onNavigateTab('crm_customers')}
              className="p-3 bg-stone-950 border border-stone-800 hover:border-[#0A6C74] rounded-lg text-left transition-colors cursor-pointer group"
            >
              <UserCheck className="w-4 h-4 text-emerald-400 mb-2 group-hover:scale-110 transition-transform" />
              <div className="font-semibold text-white text-xs">Customer Profiles</div>
              <div className="text-[10px] text-stone-500">History, spend & notes</div>
            </button>

            <button
              type="button"
              onClick={() => onNavigateTab('crm_tasks')}
              className="p-3 bg-stone-950 border border-stone-800 hover:border-[#0A6C74] rounded-lg text-left transition-colors cursor-pointer group"
            >
              <Clock className="w-4 h-4 text-amber-400 mb-2 group-hover:scale-110 transition-transform" />
              <div className="font-semibold text-white text-xs">Staff Tasks</div>
              <div className="text-[10px] text-stone-500">Assignments & priorities</div>
            </button>

            <button
              type="button"
              onClick={() => onNavigateTab('crm_conversations')}
              className="p-3 bg-stone-950 border border-stone-800 hover:border-[#0A6C74] rounded-lg text-left transition-colors cursor-pointer group"
            >
              <PhoneCall className="w-4 h-4 text-purple-400 mb-2 group-hover:scale-110 transition-transform" />
              <div className="font-semibold text-white text-xs">Conversations</div>
              <div className="text-[10px] text-stone-500">WhatsApp & phone log</div>
            </button>
          </div>

          {/* Follow-ups Due Today Panel */}
          <div className="bg-stone-950 border border-stone-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-stone-800 pb-2.5">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-1.5">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>Follow-ups Scheduled for Today ({dueTodayTasks.length})</span>
              </h3>
              <button
                type="button"
                onClick={() => onNavigateTab('crm_followups')}
                className="text-[11px] text-[#2dd4bf] hover:underline"
              >
                Manage all follow-ups
              </button>
            </div>

            {dueTodayTasks.length === 0 ? (
              <div className="p-6 text-center text-stone-500 text-xs">
                No pending follow-ups scheduled for today. Great job staying on top of leads!
              </div>
            ) : (
              <div className="space-y-2">
                {dueTodayTasks.map((task) => (
                  <div
                    key={task.id}
                    className="p-3 bg-stone-900 border border-stone-800 hover:border-stone-700 rounded-lg flex items-center justify-between text-xs transition-colors"
                  >
                    <div className="space-y-0.5 truncate pr-3">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-white">{task.title}</span>
                        {task.priority === 'Urgent' && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-red-500/20 text-red-300 border border-red-500/30">
                            Urgent
                          </span>
                        )}
                        {task.priority === 'High' && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            High
                          </span>
                        )}
                      </div>
                      <p className="text-stone-400 text-[11px] truncate">
                        {task.description || 'Customer phone call & inquiry discussion'}
                      </p>
                      <div className="flex items-center space-x-3 text-[10px] text-stone-500 font-mono">
                        <span>Staff: {task.assignedStaffName || 'Concierge'}</span>
                        {task.leadName && <span>Lead: {task.leadName}</span>}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleCompleteTask(task)}
                        className="px-3 py-1.5 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded text-xs font-semibold cursor-pointer"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Unified Activity Timeline */}
        <div className="bg-stone-950 border border-stone-800 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-stone-800 pb-2.5">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-1.5">
              <Sparkles className="w-4 h-4 text-[#2dd4bf]" />
              <span>Real-Time Activity Feed</span>
            </h3>
            <button
              type="button"
              onClick={() => onNavigateTab('crm_timeline')}
              className="text-[11px] text-[#2dd4bf] hover:underline"
            >
              Full History
            </button>
          </div>

          <div className="space-y-3">
            {recentActivities.map((act) => (
              <div key={act.id} className="flex space-x-3 text-xs">
                <div className="relative mt-1 shrink-0">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#0A6C74] border-2 border-stone-900" />
                </div>
                <div className="space-y-0.5 flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white text-[11px] truncate">
                      {act.title}
                    </span>
                    <span className="text-[10px] text-stone-500 font-mono shrink-0 ml-1">
                      {new Date(act.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-400 line-clamp-2">{act.description}</p>
                  <p className="text-[10px] text-stone-500 italic">By {act.actor}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-stone-800 text-center">
            <button
              type="button"
              onClick={() => onNavigateTab('crm_timeline')}
              className="inline-flex items-center space-x-1 text-xs text-stone-400 hover:text-white transition-colors"
            >
              <span>Explore comprehensive activity audit</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
