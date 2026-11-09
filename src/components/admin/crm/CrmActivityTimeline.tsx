import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  CalendarCheck,
  CreditCard,
  MessageSquare,
  Users,
  Clock,
  Phone,
  AlertTriangle,
  RefreshCw,
  Search,
  Filter,
} from 'lucide-react';
import { getGlobalActivityTimeline, CrmActivity } from '../../../services/crmService';
import { CrmEventType } from '../../../types/crm';

export const CrmActivityTimeline: React.FC = () => {
  const [activities, setActivities] = useState<CrmActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getGlobalActivityTimeline(100);
      setActivities(data);
    } catch (err) {
      console.warn('Failed to load activity timeline:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getEventIcon = (type: CrmEventType) => {
    switch (type) {
      case 'booking_created':
        return <CalendarCheck className="w-4 h-4 text-emerald-400" />;
      case 'payment_recorded':
        return <CreditCard className="w-4 h-4 text-emerald-300" />;
      case 'inquiry_created':
        return <MessageSquare className="w-4 h-4 text-sky-400" />;
      case 'lead_created':
      case 'stage_changed':
        return <Users className="w-4 h-4 text-amber-400" />;
      case 'communication':
        return <Phone className="w-4 h-4 text-purple-400" />;
      case 'task_created':
      case 'task_completed':
        return <Clock className="w-4 h-4 text-teal-400" />;
      case 'cancellation':
        return <AlertTriangle className="w-4 h-4 text-red-400" />;
      default:
        return <Sparkles className="w-4 h-4 text-[#2dd4bf]" />;
    }
  };

  const filtered = activities.filter((act) => {
    if (typeFilter !== 'all' && act.eventType !== typeFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        act.title.toLowerCase().includes(q) ||
        (act.description && act.description.toLowerCase().includes(q)) ||
        act.actor.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] uppercase tracking-widest text-[#2dd4bf] font-bold block mb-0.5">
            Audit & Event Stream
          </span>
          <h1 className="text-2xl font-bold font-display text-white tracking-tight flex items-center space-x-2">
            <Sparkles className="w-6 h-6 text-[#2dd4bf]" />
            <span>Unified CRM Activity Timeline</span>
          </h1>
          <p className="text-xs text-stone-400 mt-1">
            Real-time chronology combining reservations, payments, inquiries, staff notes, and communications.
          </p>
        </div>

        <button
          type="button"
          onClick={loadData}
          disabled={loading}
          className="p-2 bg-stone-900 border border-stone-800 text-stone-300 hover:text-white rounded text-xs transition-colors cursor-pointer"
          title="Refresh Feed"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Filter and Search */}
      <div className="bg-stone-950 border border-stone-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search activity title, details, or actor..."
            className="w-full pl-9 pr-3 py-1.5 bg-stone-900 border border-stone-800 rounded text-stone-200 placeholder-stone-500 focus:outline-none focus:border-[#0A6C74]"
          />
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-stone-400 text-xs hidden sm:inline">Event Type:</span>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-stone-900 border border-stone-800 rounded text-stone-300 focus:outline-none"
          >
            <option value="all">All Events ({activities.length})</option>
            <option value="lead_created">Lead Created</option>
            <option value="stage_changed">Stage Changed</option>
            <option value="booking_created">Booking Created</option>
            <option value="payment_recorded">Payment Recorded</option>
            <option value="inquiry_created">Inquiry Created</option>
            <option value="communication">Communication</option>
            <option value="staff_note">Staff Note</option>
            <option value="task_created">Task Created</option>
            <option value="task_completed">Task Completed</option>
          </select>
        </div>
      </div>

      {/* Timeline Stream */}
      {loading ? (
        <div className="p-16 text-center text-stone-400">
          <div className="w-8 h-8 border-2 border-[#0A6C74] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs">Streaming activity audit records...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-stone-950 border border-stone-800 rounded-xl p-12 text-center text-stone-400">
          <Sparkles className="w-8 h-8 text-stone-600 mx-auto mb-2" />
          <p className="text-sm font-semibold text-stone-300">No events found</p>
          <p className="text-xs text-stone-500">Activity will automatically record as actions occur.</p>
        </div>
      ) : (
        <div className="bg-stone-950 border border-stone-800 rounded-xl p-6">
          <div className="border-l-2 border-stone-800 ml-4 pl-6 space-y-6">
            {filtered.map((act) => (
              <div key={act.id} className="relative text-xs space-y-1">
                {/* Node icon */}
                <div className="absolute -left-[37px] top-0.5 w-6 h-6 rounded-full bg-stone-900 border-2 border-stone-800 flex items-center justify-center">
                  {getEventIcon(act.eventType)}
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <span className="font-bold text-white text-sm">{act.title}</span>
                  <span className="text-[10px] text-stone-500 font-mono">
                    {new Date(act.createdAt).toLocaleString()}
                  </span>
                </div>

                {act.description && (
                  <p className="text-stone-300 text-xs bg-stone-900/60 p-3 rounded-lg border border-stone-800/80 leading-relaxed">
                    {act.description}
                  </p>
                )}

                <div className="flex items-center space-x-2 text-[10px] text-stone-500">
                  <span>Actor: <strong className="text-stone-400">{act.actor}</strong></span>
                  <span>&bull;</span>
                  <span className="uppercase tracking-wider font-mono text-[9px] px-1.5 py-0.2 rounded bg-stone-900 border border-stone-800 text-stone-400">
                    {act.eventType}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
