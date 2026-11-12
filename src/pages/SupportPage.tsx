import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowLeft, CheckCircle2, Clock3, Headphones, MessageSquare, Plus, RefreshCw, Send, Shield, Ticket, UserRound, Users } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';
import { useAuth } from '../contexts/AuthContext';

type TicketRow = {
  id: string;
  ticket_number: number;
  requester_id: string;
  subject: string;
  description: string;
  category: string;
  department: string;
  priority: string;
  status: string;
  assigned_to: string | null;
  first_response_due_at: string;
  resolution_due_at: string;
  created_at: string;
  updated_at: string;
  last_message_at: string;
};
type TicketMessage = { id: string; ticket_id: string; author_id: string; body: string; is_internal: boolean; created_at: string };
type TicketMode = 'customer' | 'staff';

const statusLabels: Record<string,string> = {
  open:'Open', assigned:'Assigned', in_progress:'In progress', waiting_customer:'Waiting for customer',
  waiting_third_party:'Waiting for third party', resolved:'Resolved', closed:'Closed', reopened:'Reopened'
};
const priorityTone: Record<string,string> = {
  low:'bg-slate-100 text-slate-700', normal:'bg-sky-100 text-sky-800',
  high:'bg-amber-100 text-amber-800', urgent:'bg-orange-100 text-orange-800', critical:'bg-rose-100 text-rose-800'
};
const fieldClass = 'w-full rounded-xl border border-[#E8E3DA] dark:border-[#243447] bg-white dark:bg-[#111E2E] px-3.5 py-3 text-sm text-stone-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-[#0A6C74]';
const panelClass = 'rounded-2xl border border-[#E8E3DA] dark:border-[#243447] bg-white dark:bg-[#111E2E]';

export const SupportPage: React.FC<{ staffMode?: boolean }> = ({ staffMode = false }) => {
  const { user, hasPermission } = useAuth();
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [selected, setSelected] = useState<TicketRow | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [showNew, setShowNew] = useState(false);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('general');
  const [department, setDepartment] = useState('support');
  const [priority, setPriority] = useState('normal');
  const [reply, setReply] = useState('');
  const [internal, setInternal] = useState(false);

  const canReadAll = hasPermission('tickets.read');
  const canReadAssigned = hasPermission('tickets.read_assigned');
  const canReply = hasPermission('tickets.reply');
  const canUpdate = hasPermission('tickets.update');
  const canAssign = hasPermission('tickets.assign');
  const canInternal = hasPermission('tickets.internal_note');
  const isStaff = staffMode || canReadAll || canReadAssigned || canReply;
  const mode: TicketMode = isStaff ? 'staff' : 'customer';

  const loadTickets = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      if (!isSupabaseConfigured()) throw new Error('Support is temporarily unavailable. Please try again later.');
      let query = (supabase as any).from('support_tickets').select('*').order('updated_at', { ascending: false }).limit(100);
      if (filter !== 'all') query = query.eq('status', filter);
      const { data, error: queryError } = await query;
      if (queryError) throw queryError;
      setTickets((data || []) as TicketRow[]);
      if (selected) {
        const fresh = (data || []).find((ticket: TicketRow) => ticket.id === selected.id);
        if (fresh) setSelected(fresh);
      }
    } catch (err: any) {
      setError(err?.message || 'Could not load support tickets.');
    } finally {
      setLoading(false);
    }
  }, [user, filter, selected?.id]);

  const loadMessages = useCallback(async (ticket: TicketRow) => {
    const { data, error: queryError } = await (supabase as any)
      .from('support_ticket_messages').select('*').eq('ticket_id', ticket.id).order('created_at', { ascending: true });
    if (queryError) throw queryError;
    setMessages((data || []) as TicketMessage[]);
  }, []);

  useEffect(() => { void loadTickets(); }, [loadTickets]);
  useEffect(() => {
    if (!selected) { setMessages([]); return; }
    void loadMessages(selected).catch((err: any) => setError(err?.message || 'Could not load conversation.'));
    const channel = supabase.channel('support-ticket-' + selected.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_ticket_messages', filter: 'ticket_id=eq.' + selected.id }, () => {
        void loadMessages(selected).catch(() => undefined);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'support_tickets', filter: 'id=eq.' + selected.id }, () => {
        void loadTickets();
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [selected?.id, loadMessages, loadTickets]);

  const visibleTickets = useMemo(() => tickets, [tickets]);
  const openCount = tickets.filter(t => !['resolved','closed'].includes(t.status)).length;
  const urgentCount = tickets.filter(t => ['urgent','critical'].includes(t.priority) && !['resolved','closed'].includes(t.status)).length;
  const overdueCount = tickets.filter(t => new Date(t.resolution_due_at).getTime() < Date.now() && !['resolved','closed'].includes(t.status)).length;

  const createTicket = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || subject.trim().length < 4 || description.trim().length < 10) return;
    setBusy(true); setError('');
    try {
      const { data, error: insertError } = await (supabase as any).from('support_tickets').insert({
        requester_id: user.id, subject: subject.trim(), description: description.trim(),
        category, department, priority
      }).select('*').single();
      if (insertError) throw insertError;
      setSubject(''); setDescription(''); setCategory('general'); setDepartment('support'); setPriority('normal');
      setShowNew(false);
      await loadTickets();
      setSelected(data as TicketRow);
    } catch (err: any) {
      setError(err?.message || 'Could not create your ticket.');
    } finally { setBusy(false); }
  };

  const sendReply = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !selected || !reply.trim()) return;
    setBusy(true); setError('');
    try {
      const { error: insertError } = await (supabase as any).from('support_ticket_messages').insert({
        ticket_id: selected.id, author_id: user.id, body: reply.trim(), is_internal: internal && canInternal
      });
      if (insertError) throw insertError;
      setReply(''); setInternal(false);
      await loadMessages(selected); await loadTickets();
    } catch (err: any) {
      setError(err?.message || 'Could not send your message.');
    } finally { setBusy(false); }
  };

  const updateTicket = async (changes: Record<string, unknown>) => {
    if (!selected || !user) return;
    setBusy(true); setError('');
    try {
      const { data, error: updateError } = await (supabase as any).from('support_tickets')
        .update(changes).eq('id', selected.id).select('*').single();
      if (updateError) throw updateError;
      setSelected(data as TicketRow); await loadTickets();
    } catch (err: any) { setError(err?.message || 'Ticket update was not permitted.'); }
    finally { setBusy(false); }
  };

  if (!user) {
    return <main className="flex-1 max-w-xl mx-auto w-full px-4 py-20 text-center">
      <div className={panelClass + ' p-8'}><Headphones className="w-10 h-10 text-[#0A6C74] mx-auto mb-4"/>
        <h1 className="font-display text-2xl font-bold text-stone-900 dark:text-white">Kemet Spirit Support</h1>
        <p className="text-sm text-stone-500 mt-2 mb-6">Sign in to create a support request and securely follow your conversations.</p>
        <a href="/login?redirect=%2Fsupport" className="inline-flex rounded-xl bg-[#0A6C74] text-white px-5 py-3 text-sm font-bold">Sign in to continue</a>
      </div>
    </main>;
  }

  if (staffMode && !canReadAll && !canReadAssigned && !canReply) {
    return <main className="flex-1 max-w-xl mx-auto px-4 py-20 text-center"><div className={panelClass+' p-8'}>
      <Shield className="w-9 h-9 text-rose-500 mx-auto mb-3"/><h1 className="text-xl font-bold">Access restricted</h1>
      <p className="text-sm text-stone-500 mt-2">Your account does not have permission to manage support tickets.</p>
    </div></main>;
  }

  return <main className="flex-1 bg-[#FAF8F5] dark:bg-[#0A1118] py-8 sm:py-12">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-[11px] uppercase tracking-[.2em] font-bold text-[#0A6C74]">{isStaff ? 'TEAM WORKSPACE' : 'CUSTOMER PORTAL'}</p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-stone-900 dark:text-white mt-1">{isStaff ? 'Ticket management' : 'My support tickets'}</h1>
          <p className="text-sm text-stone-500 dark:text-slate-400 mt-2">{isStaff ? 'Prioritize, collaborate and resolve customer requests across departments.' : 'Create a request and keep every reply in one secure place.'}</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => void loadTickets()} className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl border border-stone-200 dark:border-slate-700 text-sm"><RefreshCw size={15}/> Refresh</button>
          <button type="button" onClick={() => setShowNew(v => !v)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0A6C74] text-white text-sm font-bold"><Plus size={16}/> New ticket</button>
        </div>
      </div>

      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 text-rose-800 px-4 py-3 text-sm flex gap-2"><AlertCircle size={17} className="shrink-0 mt-0.5"/>{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[{label:'Open tickets',value:openCount,icon:Ticket},{label:'Urgent / critical',value:urgentCount,icon:AlertCircle},{label:'Past SLA target',value:overdueCount,icon:Clock3}].map(card=><div key={card.label} className={panelClass+' p-4 flex items-center gap-3'}><div className="w-10 h-10 rounded-xl bg-[#E8F3F4] text-[#0A6C74] flex items-center justify-center"><card.icon size={19}/></div><div><p className="text-xs text-stone-500">{card.label}</p><p className="text-2xl font-bold text-stone-900 dark:text-white">{card.value}</p></div></div>)}
      </div>

      {showNew && <form onSubmit={createTicket} className={panelClass+' p-5 sm:p-6 space-y-4'}>
        <div className="flex items-center justify-between"><h2 className="font-display text-xl font-bold">Create a support ticket</h2><button type="button" onClick={()=>setShowNew(false)} className="text-sm text-stone-500">Cancel</button></div>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-xs font-semibold space-y-1.5">Subject<input className={fieldClass} maxLength={180} minLength={4} required value={subject} onChange={e=>setSubject(e.target.value)} placeholder="How can we help?"/></label>
          <label className="text-xs font-semibold space-y-1.5">Category<select className={fieldClass} value={category} onChange={e=>setCategory(e.target.value)}>{[['general','General enquiry'],['booking','Booking'],['payment','Payment'],['refund','Refund'],['tour_operation','Tour / excursion'],['pickup','Pickup'],['technical','Technical issue'],['complaint','Complaint'],['other','Other']].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
          {isStaff && <><label className="text-xs font-semibold space-y-1.5">Department<select className={fieldClass} value={department} onChange={e=>setDepartment(e.target.value)}>{['support','booking','operations','finance','sales','technical','management'].map(v=><option key={v} value={v}>{v.replace('_',' ').replace(/^./,x=>x.toUpperCase())}</option>)}</select></label><label className="text-xs font-semibold space-y-1.5">Priority<select className={fieldClass} value={priority} onChange={e=>setPriority(e.target.value)}>{['low','normal','high','urgent','critical'].map(v=><option key={v} value={v}>{v.toUpperCase()}</option>)}</select></label></>}
        </div>
        <label className="block text-xs font-semibold space-y-1.5">Describe your request<textarea className={fieldClass+' min-h-32 resize-y'} maxLength={10000} minLength={10} required value={description} onChange={e=>setDescription(e.target.value)} placeholder="Include relevant details so our team can help quickly."/></label>
        <div className="flex justify-end"><button disabled={busy} className="rounded-xl bg-[#0A6C74] text-white px-5 py-3 text-sm font-bold disabled:opacity-50">{busy?'Creating…':'Submit ticket'}</button></div>
      </form>}

      <div className="grid lg:grid-cols-[minmax(300px,.8fr)_minmax(0,1.5fr)] gap-5 items-start">
        <section className={panelClass+' overflow-hidden'}>
          <div className="p-4 border-b border-stone-100 dark:border-slate-700 flex flex-wrap justify-between items-center gap-2"><h2 className="font-bold text-sm">Ticket queue</h2>
            <select aria-label="Filter tickets" className="text-xs rounded-lg border border-stone-200 dark:border-slate-700 bg-transparent px-2 py-2" value={filter} onChange={e=>setFilter(e.target.value)}>{[['all','All statuses'],...Object.entries(statusLabels)].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>
          </div>
          {loading ? <div className="p-8 text-center text-sm text-stone-500">Loading tickets…</div> : visibleTickets.length===0 ? <div className="p-8 text-center"><MessageSquare className="w-8 h-8 text-stone-300 mx-auto mb-2"/><p className="text-sm font-semibold">No tickets found</p><p className="text-xs text-stone-500 mt-1">New requests will appear here.</p></div> :
            <div className="max-h-[650px] overflow-y-auto divide-y divide-stone-100 dark:divide-slate-700">{visibleTickets.map(ticket=><button key={ticket.id} type="button" onClick={()=>{setSelected(ticket);setShowNew(false);}} className={'w-full p-4 text-left hover:bg-stone-50 dark:hover:bg-slate-800/60 transition-colors '+(selected?.id===ticket.id?'bg-[#E8F3F4]/70 dark:bg-teal-950/30':'')}>
              <div className="flex items-center justify-between gap-2"><span className="text-[10px] font-bold tracking-wide text-[#0A6C74]">KS-{String(ticket.ticket_number).padStart(6,'0')}</span><span className={'text-[10px] px-2 py-1 rounded-full font-bold '+(priorityTone[ticket.priority]||priorityTone.normal)}>{ticket.priority}</span></div>
              <p className="font-semibold text-sm text-stone-900 dark:text-white mt-2 line-clamp-2">{ticket.subject}</p>
              <div className="flex items-center justify-between gap-2 mt-2 text-[11px] text-stone-500"><span>{statusLabels[ticket.status]||ticket.status}</span><span>{new Date(ticket.updated_at).toLocaleDateString()}</span></div>
            </button>)}</div>}
        </section>

        <section className={panelClass+' min-h-[460px] overflow-hidden'}>
          {!selected ? <div className="h-full min-h-[460px] flex flex-col items-center justify-center p-8 text-center"><div className="w-14 h-14 rounded-2xl bg-[#E8F3F4] text-[#0A6C74] flex items-center justify-center mb-4"><Headphones size={26}/></div><h2 className="font-display text-xl font-bold">Select a ticket</h2><p className="text-sm text-stone-500 mt-2 max-w-sm">Choose a ticket from the queue to view its conversation and manage its progress.</p></div> :
          <><div className="p-5 border-b border-stone-100 dark:border-slate-700 space-y-3">
            <button type="button" onClick={()=>setSelected(null)} className="lg:hidden inline-flex items-center gap-1 text-xs text-stone-500"><ArrowLeft size={14}/> Back to queue</button>
            <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-bold text-[#0A6C74]">KS-{String(selected.ticket_number).padStart(6,'0')}</span><span className="text-xs text-stone-500">Created {new Date(selected.created_at).toLocaleString()}</span></div>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-stone-900 dark:text-white">{selected.subject}</h2>
            <div className="flex flex-wrap gap-2"><span className="text-[10px] rounded-full px-2.5 py-1 bg-stone-100 dark:bg-slate-800">{statusLabels[selected.status]||selected.status}</span><span className={'text-[10px] rounded-full px-2.5 py-1 font-bold '+(priorityTone[selected.priority]||priorityTone.normal)}>{selected.priority}</span><span className="text-[10px] rounded-full px-2.5 py-1 bg-stone-100 dark:bg-slate-800">{selected.department}</span></div>
            {isStaff && <div className="flex flex-wrap gap-2 items-center">
              {canUpdate && <><select aria-label="Ticket status" className="text-xs rounded-lg border border-stone-200 dark:border-slate-700 bg-transparent px-2 py-2" value={selected.status} disabled={busy} onChange={e=>void updateTicket({status:e.target.value})}>{Object.entries(statusLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select><select aria-label="Ticket priority" className="text-xs rounded-lg border border-stone-200 dark:border-slate-700 bg-transparent px-2 py-2" value={selected.priority} disabled={busy} onChange={e=>void updateTicket({priority:e.target.value})}>{['low','normal','high','urgent','critical'].map(v=><option key={v} value={v}>{v}</option>)}</select></>}
              {canAssign && <button type="button" disabled={busy} onClick={()=>void updateTicket({assigned_to:user.id,status:selected.status==='open'?'assigned':selected.status})} className="text-xs rounded-lg border border-[#0A6C74]/40 text-[#0A6C74] px-3 py-2 inline-flex items-center gap-1"><UserRound size={13}/> Assign to me</button>}
            </div>}
          </div>
          <div className="p-5 space-y-4 max-h-[480px] overflow-y-auto">
            <article className="rounded-xl bg-stone-50 dark:bg-slate-800/60 p-4"><div className="flex items-center gap-2 text-xs font-bold mb-2"><UserRound size={14}/> Requester <span className="ml-auto text-[10px] font-normal text-stone-500">{new Date(selected.created_at).toLocaleString()}</span></div><p className="text-sm whitespace-pre-wrap text-stone-700 dark:text-slate-200">{selected.description}</p></article>
            {messages.map(message=><article key={message.id} className={'rounded-xl p-4 '+(message.is_internal?'bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900':'bg-[#E8F3F4]/70 dark:bg-teal-950/30')}>
              <div className="flex items-center gap-2 text-xs font-bold mb-2">{message.is_internal?<><Shield size={14}/> Internal note</>:<><Users size={14}/> {message.author_id===user.id?'You':'Team reply'}</>}<span className="ml-auto text-[10px] font-normal text-stone-500">{new Date(message.created_at).toLocaleString()}</span></div><p className="text-sm whitespace-pre-wrap">{message.body}</p>
            </article>)}
          </div>
          {selected.status!=='closed' && <form onSubmit={sendReply} className="p-4 sm:p-5 border-t border-stone-100 dark:border-slate-700 space-y-3">
            {canInternal && <label className="inline-flex items-center gap-2 text-xs font-semibold text-amber-700 dark:text-amber-300"><input type="checkbox" checked={internal} onChange={e=>setInternal(e.target.checked)}/> Add private internal note</label>}
            <textarea className={fieldClass+' min-h-24 resize-y'} value={reply} onChange={e=>setReply(e.target.value)} maxLength={10000} required placeholder={internal?'Write a note visible only to authorized staff…':'Write your reply…'}/>
            <div className="flex items-center justify-between gap-2"><span className="text-[10px] text-stone-500">Never include passwords, payment card details or sensitive credentials.</span><button disabled={busy||!reply.trim()} className="inline-flex items-center gap-2 rounded-xl bg-[#0A6C74] text-white px-4 py-2.5 text-xs font-bold disabled:opacity-50"><Send size={14}/>{busy?'Sending…':internal?'Add note':'Send reply'}</button></div>
          </form>}
          {selected.status==='closed' && <div className="p-5 border-t border-stone-100 dark:border-slate-700 text-xs text-stone-500 flex items-center gap-2"><CheckCircle2 size={16}/> This ticket is closed. Contact support to request reopening.</div>}
          </>}
        </section>
      </div>
      <p className="text-[11px] text-stone-400 flex items-center gap-2"><Shield size={13}/> Conversations are protected by database row-level security. Internal notes are never visible to customers.</p>
    </div>
  </main>;
};
