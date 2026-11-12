import React, { useCallback, useEffect, useState } from 'react';
import { Activity, AlertTriangle, ArrowRight, CheckCircle2, Clock3, FileText, Mail, RefreshCw, Send, ShieldCheck } from 'lucide-react';
import { listCommunicationMessages, listEmailProviderEvents, refreshProviderConfigFromServer } from '../../../services/communicationService';
import type { CommunicationMessage, EmailProviderEvent, ProviderConfig } from '../../../types/communication';

interface EmailCenterProps {
  onNavigateTab: (tabId: string, param?: string) => void;
}

const statusIs = (message: CommunicationMessage, value: string) => message.status.toLowerCase() === value;

export const EmailCenter: React.FC<EmailCenterProps> = ({ onNavigateTab }) => {
  const [messages, setMessages] = useState<CommunicationMessage[]>([]);
  const [events, setEvents] = useState<EmailProviderEvent[]>([]);
  const [provider, setProvider] = useState<ProviderConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [eventError, setEventError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setEventError('');
    const [messageResult, eventResult, providerResult] = await Promise.allSettled([
      listCommunicationMessages({ channel: 'Email' }),
      listEmailProviderEvents(12),
      refreshProviderConfigFromServer(),
    ]);
    if (messageResult.status === 'fulfilled') setMessages(messageResult.value);
    if (eventResult.status === 'fulfilled') setEvents(eventResult.value);
    else setEventError('Delivery events are currently unavailable for this account.');
    if (providerResult.status === 'fulfilled') setProvider(providerResult.value);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const delivered = messages.filter((m) => statusIs(m, 'delivered') || statusIs(m, 'opened')).length;
  const sent = messages.filter((m) => statusIs(m, 'sent')).length;
  const failed = messages.filter((m) => statusIs(m, 'failed')).length;
  const queued = messages.filter((m) => statusIs(m, 'queued')).length;
  const cards = [
    { label: 'Total emails', value: messages.length, icon: Mail, tone: 'text-slate-100' },
    { label: 'Delivered / opened', value: delivered, icon: CheckCircle2, tone: 'text-emerald-300' },
    { label: 'Sent, awaiting receipt', value: sent, icon: Send, tone: 'text-sky-300' },
    { label: 'Failed', value: failed, icon: AlertTriangle, tone: 'text-rose-300' },
  ];

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-[#26364b] bg-[#101b2b] text-white shadow-lg">
        <div className="flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#d6ad5b]/30 bg-[#d6ad5b]/10 text-[#e6c77f]"><Mail className="h-6 w-6" /></div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#d6ad5b]">Awesome Adventure Tours</p>
              <h1 className="mt-1 text-2xl font-bold">Email Center</h1>
              <p className="mt-1 text-sm text-slate-300">Monitor customer emails, delivery activity and provider health.</p>
            </div>
          </div>
          <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold hover:bg-white/10 disabled:opacity-60">
            <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} /> Refresh data
          </button>
        </div>
        <div className="grid grid-cols-2 gap-px bg-white/10 md:grid-cols-4">
          {cards.map(({ label, value, icon: Icon, tone }) => (
            <div key={label} className="bg-[#142238] p-4 md:p-5">
              <div className="flex items-center justify-between gap-2 text-xs text-slate-300"><span>{label}</span><Icon className={'h-4 w-4 ' + tone} /></div>
              <div className={'mt-2 text-3xl font-bold tabular-nums ' + tone}>{loading ? '—' : value}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white"><ShieldCheck className="h-4 w-4 text-[#b58b3a]" /> Resend provider</div>
          <div className="mt-3 flex items-center gap-2">
            <span className={provider?.email.isConfigured ? 'h-2.5 w-2.5 rounded-full bg-emerald-500' : 'h-2.5 w-2.5 rounded-full bg-amber-500'} />
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{provider?.email.isConfigured ? 'Configured' : 'Needs configuration'}</span>
          </div>
          <p className="mt-2 break-all text-xs text-slate-500">{provider?.email.fromEmail || 'Sender address is not available'}</p>
          <div className="mt-3 space-y-1 text-xs text-slate-500">
            <p>Webhook signing secret: <strong className={provider?.email.webhookConfigured ? 'text-emerald-600' : 'text-amber-600'}>{provider?.email.webhookConfigured ? 'Configured' : 'Not configured'}</strong></p>
            <p>Booking notification worker: <strong className={provider?.email.bookingWorkerEnabled ? 'text-emerald-600' : 'text-amber-600'}>{provider?.email.bookingWorkerEnabled ? 'Enabled' : 'Disabled'}</strong></p>
            <p>Secrets are never displayed in this dashboard.</p>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white"><Activity className="h-4 w-4 text-[#b58b3a]" /> Delivery activity</div>
          <p className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">{loading ? '—' : events.length}</p>
          <p className="mt-1 text-xs text-slate-500">Recent verified Resend webhook events</p>
          {eventError && <p className="mt-2 text-xs text-amber-600">{eventError}</p>}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white"><Clock3 className="h-4 w-4 text-[#b58b3a]" /> Queue snapshot</div>
          <p className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">{loading ? '—' : queued}</p>
          <p className="mt-1 text-xs text-slate-500">Messages currently recorded as queued</p>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold text-slate-900 dark:text-white">Recent messages</h2>
            <button type="button" onClick={() => onNavigateTab('comm_history')} className="inline-flex items-center gap-1 text-xs font-semibold text-[#9b7428] hover:underline">View history <ArrowRight className="h-3.5 w-3.5" /></button>
          </div>
          <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
            {messages.slice(0, 6).map((message) => (
              <div key={message.id} className="py-3 first:pt-0">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{message.subject || message.templateKey || 'Email message'}</p>
                  <span className={statusIs(message, 'failed') ? 'shrink-0 rounded-full bg-rose-50 px-2 py-1 text-[10px] font-semibold uppercase text-rose-700' : statusIs(message, 'delivered') || statusIs(message, 'opened') ? 'shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold uppercase text-emerald-700' : 'shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase text-slate-600'}>{message.status}</span>
                </div>
                <p className="mt-1 truncate text-xs text-slate-500">{message.recipientAddress} · {new Date(message.createdAt).toLocaleString()}</p>
              </div>
            ))}
            {!loading && messages.length === 0 && <p className="py-5 text-sm text-slate-500">No email records yet. Real records will appear here as emails are processed.</p>}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold text-slate-900 dark:text-white">Latest provider events</h2>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Verified only</span>
          </div>
          <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
            {events.slice(0, 6).map((event) => (
              <div key={event.id} className="py-3 first:pt-0">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{event.eventType.replace(/^email\./, '').replace(/_/g, ' ')}</p>
                  <span className="text-[10px] text-slate-400">{new Date(event.occurredAt || event.receivedAt).toLocaleString()}</span>
                </div>
                <p className="mt-1 truncate text-xs text-slate-500">{event.recipientAddress || event.providerMessageId}</p>
              </div>
            ))}
            {!loading && events.length === 0 && <p className="py-5 text-sm text-slate-500">No provider events have been recorded yet.</p>}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-[#e6d7b6] bg-[#fffaf0] p-5 dark:border-[#55472c] dark:bg-[#211d15]">
        <div className="flex items-start gap-3">
          <FileText className="mt-0.5 h-5 w-5 text-[#9b7428]" />
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-slate-900 dark:text-white">Email operations</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Manage reusable business templates, compose operational emails, or inspect the complete audit history.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => onNavigateTab('comm_email')} className="rounded-lg bg-[#142238] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#20334c]">Open dispatcher</button>
              <button type="button" onClick={() => onNavigateTab('comm_templates')} className="rounded-lg border border-[#d6c49c] bg-white px-3.5 py-2 text-xs font-semibold text-[#6f5420] hover:bg-[#fff5dd]">Manage templates</button>
              <button type="button" onClick={() => onNavigateTab('comm_history')} className="rounded-lg border border-[#d6c49c] bg-white px-3.5 py-2 text-xs font-semibold text-[#6f5420] hover:bg-[#fff5dd]">Full history</button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
