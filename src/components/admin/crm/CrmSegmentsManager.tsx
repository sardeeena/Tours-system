import React, { useState, useEffect } from 'react';
import {
  Users,
  Sparkles,
  Download,
  DollarSign,
  Tag,
  Hotel,
  Clock,
  Compass,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Mail,
  MessageCircle,
} from 'lucide-react';
import { listCrmCustomers, CrmCustomerDetail } from '../../../services/crmService';
import { useToast } from '../../../contexts/ToastContext';

interface SegmentDef {
  id: string;
  name: string;
  badge: string;
  description: string;
  icon: string;
  color: string;
  filter: (c: CrmCustomerDetail) => boolean;
}

export const CrmSegmentsManager: React.FC = () => {
  const { showToast } = useToast();
  const [customers, setCustomers] = useState<CrmCustomerDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSegmentId, setActiveSegmentId] = useState<string>('vip');

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await listCrmCustomers();
      setCustomers(data);
    } catch (err) {
      console.warn('Failed to load customers for segments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const segments: SegmentDef[] = [
    {
      id: 'vip',
      name: 'VIP Repeat Travelers',
      badge: 'Repeat Guest',
      description: 'Travelers who have booked 2 or more excursions across the Red Sea.',
      icon: '👑',
      color: 'border-amber-500/40 text-amber-300',
      filter: (c) => c.totalBookings >= 2,
    },
    {
      id: 'high_value',
      name: 'High Lifetime Value (€500+)',
      badge: 'High Value',
      description: 'High-yield private yacht charters, diving packages, and luxury desert safaris.',
      icon: '💎',
      color: 'border-emerald-500/40 text-emerald-300',
      filter: (c) => c.totalRevenue >= 500,
    },
    {
      id: 'outstanding',
      name: 'Pending Pier Payments',
      badge: 'Balance Due',
      description: 'Guests with reservations confirmed under "Pay at Pickup" awaiting clearance.',
      icon: '⚠️',
      color: 'border-red-500/40 text-red-300',
      filter: (c) => c.outstandingAmount > 0,
    },
    {
      id: 'inquirers',
      name: 'Inquiry Leads (Unconverted)',
      badge: 'Lead',
      description: 'Prospects who submitted an inquiry or custom request but have not yet completed a booking.',
      icon: '🎯',
      color: 'border-sky-500/40 text-sky-300',
      filter: (c) => c.totalBookings === 0 && c.inquiries.length > 0,
    },
    {
      id: 'gouna_resorts',
      name: 'El Gouna & Sahl Hasheesh Cluster',
      badge: 'Luxury Resorts',
      description: 'High-end coastal resort guests requiring luxury transfer vehicles and private boats.',
      icon: '🌴',
      color: 'border-[#2dd4bf]/40 text-[#2dd4bf]',
      filter: (c) =>
        Boolean(
          c.hotel &&
            (c.hotel.toLowerCase().includes('gouna') ||
              c.hotel.toLowerCase().includes('hasheesh') ||
              c.hotel.toLowerCase().includes('makadi'))
        ),
    },
  ];

  const currentSegment = segments.find((s) => s.id === activeSegmentId) || segments[0];
  const matchedCustomers = customers.filter(currentSegment.filter);

  const exportSegmentCSV = () => {
    const headers = ['Full Name', 'Email', 'Phone', 'WhatsApp', 'Hotel', 'Revenue EUR', 'Total Bookings'];
    const rows = matchedCustomers.map((c) => [
      `"${c.fullName}"`,
      `"${c.email}"`,
      `"${c.phone || ''}"`,
      `"${c.whatsapp || ''}"`,
      `"${c.hotel || ''}"`,
      c.totalRevenue,
      c.totalBookings,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `segment_${currentSegment.id}_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Exported ${matchedCustomers.length} travelers in "${currentSegment.name}".`, 'success');
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] uppercase tracking-widest text-[#2dd4bf] font-bold block mb-0.5">
            Audience Intelligence
          </span>
          <h1 className="text-2xl font-bold font-display text-white tracking-tight flex items-center space-x-2">
            <Tag className="w-6 h-6 text-[#2dd4bf]" />
            <span>Customer Segments & Traveler Cohorts</span>
          </h1>
          <p className="text-xs text-stone-400 mt-1">
            Target high-value travelers, repeat VIP guests, and resort clusters for bespoke promotions.
          </p>
        </div>

        <button
          type="button"
          onClick={loadData}
          disabled={loading}
          className="p-2 bg-stone-900 border border-stone-800 text-stone-300 hover:text-white rounded text-xs transition-colors cursor-pointer"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Segments Selector Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {segments.map((seg) => {
          const count = customers.filter(seg.filter).length;
          const isSelected = activeSegmentId === seg.id;

          return (
            <div
              key={seg.id}
              onClick={() => setActiveSegmentId(seg.id)}
              className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                isSelected
                  ? 'bg-stone-900 border-[#0A6C74] shadow-md ring-1 ring-[#0A6C74]'
                  : 'bg-stone-950 border-stone-800 hover:border-stone-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-lg">{seg.icon}</span>
                <span className="text-sm font-bold font-mono text-white">{count}</span>
              </div>
              <h3 className="font-semibold text-xs text-white truncate">{seg.name}</h3>
              <p className="text-[10px] text-stone-400 mt-1 line-clamp-2 leading-tight">
                {seg.description}
              </p>
            </div>
          );
        })}
      </div>

      {/* Segment Details & Traveler List */}
      <div className="bg-stone-950 border border-stone-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-800 pb-3">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xl">{currentSegment.icon}</span>
              <h2 className="text-sm font-bold text-white">{currentSegment.name}</h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-stone-900 border border-stone-800 text-stone-300">
                {matchedCustomers.length} Travelers
              </span>
            </div>
            <p className="text-xs text-stone-400 mt-0.5">{currentSegment.description}</p>
          </div>

          <button
            type="button"
            onClick={exportSegmentCSV}
            disabled={matchedCustomers.length === 0}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded text-xs font-semibold shadow transition-colors cursor-pointer disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Cohort CSV</span>
          </button>
        </div>

        {matchedCustomers.length === 0 ? (
          <div className="p-12 text-center text-stone-500 text-xs">
            No customers match the criteria for this segment yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-900 border-b border-stone-800 text-stone-400 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Traveler Name</th>
                  <th className="py-2.5 px-3">Email & Contact</th>
                  <th className="py-2.5 px-3">Hotel / Resort</th>
                  <th className="py-2.5 px-3 font-mono">Bookings</th>
                  <th className="py-2.5 px-3 font-mono">Total Revenue</th>
                  <th className="py-2.5 px-3 font-mono">Outstanding</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800/80">
                {matchedCustomers.map((c) => (
                  <tr key={c.id} className="hover:bg-stone-900/50">
                    <td className="py-2.5 px-3">
                      <span className="font-semibold text-white">{c.fullName}</span>
                      <span className="text-[10px] text-stone-500 block">
                        Joined: {new Date(c.createdAt).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-stone-300">
                      <div>{c.email}</div>
                      {c.phone && <div className="text-stone-500 text-[10px]">{c.phone}</div>}
                    </td>
                    <td className="py-2.5 px-3 text-stone-300">{c.hotel || 'None recorded'}</td>
                    <td className="py-2.5 px-3 font-mono text-white font-bold">{c.totalBookings}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-emerald-400">
                      €{c.totalRevenue.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 font-mono">
                      {c.outstandingAmount > 0 ? (
                        <span className="text-amber-400 font-bold">€{c.outstandingAmount}</span>
                      ) : (
                        <span className="text-stone-500">€0</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
