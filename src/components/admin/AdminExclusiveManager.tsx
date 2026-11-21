import React, { useEffect, useMemo, useState } from 'react';
import { CalendarPlus, RefreshCw, Save, Ship, Users, DollarSign, AlertTriangle } from 'lucide-react';
import {
  createExclusiveDeparture, getAdminExclusiveDepartures, getAdminExclusiveTours,
  getExclusiveResourceOptions, saveExclusiveTrip, updateExclusiveReservation,
} from '../../services/exclusiveTripService';

type AdminTour = {
  id: string; title: string; slug: string; status: string; is_exclusive: boolean;
  exclusive_trips?: Array<{ id: string; fixed_trip_price: number; currency: string; minimum_guests: number; maximum_guests: number; is_active: boolean }>;
};

export const AdminExclusiveManager: React.FC = () => {
  const [tours, setTours] = useState<AdminTour[]>([]);
  const [selectedTourId, setSelectedTourId] = useState('');
  const [resources, setResources] = useState<{ vessels: any[]; guides: any[] }>({ vessels: [], guides: [] });
  const [departures, setDepartures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [price, setPrice] = useState('500');
  const [currency, setCurrency] = useState('EUR');
  const [minimum, setMinimum] = useState('1');
  const [maximum, setMaximum] = useState('10');
  const [active, setActive] = useState(true);
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('16:00');
  const [slotCapacity, setSlotCapacity] = useState('10');
  const [vesselId, setVesselId] = useState('');
  const [captainId, setCaptainId] = useState('');
  const [guideId, setGuideId] = useState('');
  const [driverId, setDriverId] = useState('');

  const selectedTour = useMemo(() => tours.find((tour) => tour.id === selectedTourId) || null, [tours, selectedTourId]);
  const config = selectedTour?.exclusive_trips?.[0] || null;

  const refresh = async (preserve = true) => {
    setLoading(true); setError('');
    try {
      const [items, assignmentResources] = await Promise.all([getAdminExclusiveTours(), getExclusiveResourceOptions()]);
      setTours(items as AdminTour[]);
      setResources(assignmentResources);
      const nextId = preserve && items.some((tour: any) => tour.id === selectedTourId) ? selectedTourId : (items[0]?.id || '');
      setSelectedTourId(nextId);
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to load Exclusive management.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { void refresh(false); }, []);
  useEffect(() => {
    if (!selectedTour?.exclusive_trips?.[0]) { setDepartures([]); return; }
    const trip = selectedTour.exclusive_trips[0];
    setPrice(String(trip.fixed_trip_price));
    setCurrency(trip.currency);
    setMinimum(String(trip.minimum_guests));
    setMaximum(String(trip.maximum_guests));
    setActive(trip.is_active);
    let current = true;
    getAdminExclusiveDepartures(trip.id).then((items) => current && setDepartures(items))
      .catch((err) => current && setError(err instanceof Error ? err.message : 'Unable to load reservations.'));
    return () => { current = false; };
  }, [selectedTourId, tours]);

  const saveConfig = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedTour) return;
    setSaving(true); setError(''); setNotice('');
    try {
      await saveExclusiveTrip({
        tourId: selectedTour.id, fixedTripPrice: Number(price), currency,
        minimumGuests: Number(minimum), maximumGuests: Number(maximum), isActive: active,
      });
      await refresh(true);
      setNotice('Exclusive trip settings saved.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to save Exclusive settings.'); }
    finally { setSaving(false); }
  };

  const addSlot = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!config) return;
    setSaving(true); setError(''); setNotice('');
    try {
      await createExclusiveDeparture({
        tripId: config.id, date, startTime, endTime, maximumGuests: Number(slotCapacity),
        vesselId, captainId, guideId, driverId,
      });
      const items = await getAdminExclusiveDepartures(config.id);
      setDepartures(items);
      setNotice('Exclusive trip slot created and published as confirmed.');
      setDate('');
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to create the departure slot.'); }
    finally { setSaving(false); }
  };

  const changeReservation = async (id: string, changes: { status?: string; payment_status?: string }) => {
    setError(''); setNotice('');
    try {
      await updateExclusiveReservation(id, changes);
      if (config) setDepartures(await getAdminExclusiveDepartures(config.id));
      setNotice('Reservation updated.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to update reservation.'); }
  };

  const revenue = departures.flatMap((slot) => slot.exclusive_reservations || [])
    .filter((reservation: any) => reservation.status !== 'cancelled')
    .reduce((sum: number, reservation: any) => sum + Number(reservation.total || 0), 0);

  if (loading) return <div className="p-8 text-stone-500">Loading Exclusive trips…</div>;

  return (
    <div className="space-y-6 max-w-[1500px]">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div><p className="text-xs uppercase tracking-[.18em] text-teal-700 font-bold">Separate product & reservation rules</p><h1 className="text-2xl sm:text-3xl font-bold mt-1">Exclusive Trips</h1><p className="text-sm text-stone-500 mt-2">Set a fixed price for the entire trip, schedule exclusive slots, assign resources and manage one-group reservations.</p></div>
        <button type="button" onClick={() => void refresh(true)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold hover:bg-stone-50"><RefreshCw size={15}/>Refresh</button>
      </header>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 text-red-800 p-3 text-sm flex gap-2"><AlertTriangle size={17}/>{error}</div>}
      {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 p-3 text-sm">{notice}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(280px,.7fr)_minmax(0,1.5fr)] gap-6">
        <section className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4">
          <div className="flex justify-between items-center"><h2 className="font-bold text-lg">Select a tour listing</h2><span className="text-xs text-stone-500">{tours.length} tours</span></div>
          <select value={selectedTourId} onChange={(event) => setSelectedTourId(event.target.value)} className="w-full rounded-lg border border-stone-300 p-3 bg-white">
            {tours.map((tour) => <option key={tour.id} value={tour.id}>{tour.title} · {tour.status}</option>)}
          </select>
          {selectedTour ? <div className="rounded-xl bg-stone-50 p-4"><p className="font-semibold">{selectedTour.title}</p><p className="text-xs text-stone-500 mt-1">/{selectedTour.slug}</p><p className="text-xs mt-2">{selectedTour.is_exclusive ? 'Currently classified as Exclusive' : 'Not yet in the Exclusive catalogue'}</p></div> : <p className="text-sm text-stone-500">No tours found. Create the listing in Tours & Excursions first, then select it here.</p>}
          <p className="text-xs text-stone-500">Tour title, descriptions, photos and itinerary are edited in the existing Tours & Excursions editor. This area controls the separate Exclusive pricing and schedules.</p>
        </section>

        <div className="space-y-6 min-w-0">
          <form onSubmit={saveConfig} className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2"><DollarSign className="text-teal-700"/><h2 className="font-bold text-lg">Exclusive pricing & guest limits</h2></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <label className="text-sm font-semibold">Fixed trip price<input type="number" min="0.01" step="0.01" required value={price} onChange={(e)=>setPrice(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 p-3"/></label>
              <label className="text-sm font-semibold">Currency<select value={currency} onChange={(e)=>setCurrency(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 p-3 bg-white"><option>EUR</option><option>USD</option><option>GBP</option><option>EGP</option></select></label>
              <label className="text-sm font-semibold">Minimum guests<input type="number" min="1" max="500" required value={minimum} onChange={(e)=>setMinimum(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 p-3"/></label>
              <label className="text-sm font-semibold">Maximum guests<input type="number" min="1" max="500" required value={maximum} onChange={(e)=>setMaximum(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 p-3"/></label>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={active} onChange={(e)=>setActive(e.target.checked)}/>Publish this Exclusive product and show it in the public catalogue</label>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-stone-100 pt-4">
              <p className="text-xs text-stone-500">This price is charged once per reservation, regardless of the number of guests.</p>
              <button disabled={!selectedTour || saving} className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-800 text-white px-5 py-3 font-semibold disabled:opacity-50"><Save size={16}/>{saving ? 'Saving…' : config ? 'Save Exclusive settings' : 'Create Exclusive product'}</button>
            </div>
          </form>

          {config && (
            <>
              <form onSubmit={addSlot} className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6 space-y-4">
                <div className="flex items-center gap-2"><CalendarPlus className="text-teal-700"/><h2 className="font-bold text-lg">Schedule an exclusive trip</h2></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <label className="text-sm font-semibold">Date<input type="date" required min={new Date().toLocaleDateString('en-CA')} value={date} onChange={(e)=>setDate(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 p-3"/></label>
                  <label className="text-sm font-semibold">Start time<input type="time" required value={startTime} onChange={(e)=>setStartTime(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 p-3"/></label>
                  <label className="text-sm font-semibold">End time<input type="time" required value={endTime} onChange={(e)=>setEndTime(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 p-3"/></label>
                  <label className="text-sm font-semibold">Maximum guests<input type="number" required min="1" max={maximum} value={slotCapacity} onChange={(e)=>setSlotCapacity(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 p-3"/></label>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <label className="text-sm font-semibold">Boat / vessel<select value={vesselId} onChange={(e)=>setVesselId(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 p-3 bg-white"><option value="">Not assigned</option>{resources.vessels.map((v:any)=><option key={v.id} value={v.id}>{v.name} · {v.passenger_capacity} pax</option>)}</select></label>
                  <label className="text-sm font-semibold">Captain<select value={captainId} onChange={(e)=>setCaptainId(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 p-3 bg-white"><option value="">Not assigned</option>{resources.guides.filter((g:any)=>/captain|crew/i.test(g.role)).map((g:any)=><option key={g.id} value={g.id}>{g.full_name}</option>)}</select></label>
                  <label className="text-sm font-semibold">Guide<select value={guideId} onChange={(e)=>setGuideId(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 p-3 bg-white"><option value="">Not assigned</option>{resources.guides.map((g:any)=><option key={g.id} value={g.id}>{g.full_name} · {g.role}</option>)}</select></label>
                  <label className="text-sm font-semibold">Driver<select value={driverId} onChange={(e)=>setDriverId(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 p-3 bg-white"><option value="">Not assigned</option>{resources.guides.filter((g:any)=>/driver/i.test(g.role)).map((g:any)=><option key={g.id} value={g.id}>{g.full_name}</option>)}</select></label>
                </div>
                <div className="flex justify-end"><button disabled={saving || !date} className="rounded-lg bg-teal-800 text-white px-5 py-3 font-semibold disabled:opacity-50">Add confirmed slot</button></div>
              </form>

              <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2"><div><h2 className="font-bold text-lg">Schedules & reservations</h2><p className="text-xs text-stone-500">One active reservation blocks the whole trip slot.</p></div><div className="rounded-lg bg-stone-50 px-3 py-2 text-sm"><span className="text-stone-500">Reserved revenue </span><strong>{new Intl.NumberFormat(undefined,{style:'currency',currency}).format(revenue)}</strong></div></div>
                {departures.length === 0 ? <p className="text-sm text-stone-500 py-4">No Exclusive slots scheduled yet.</p> : departures.map((slot:any) => {
                  const reservations = slot.exclusive_reservations || [];
                  return <article key={slot.id} className="border border-stone-200 rounded-xl p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2"><div><p className="font-bold">{slot.date} · {String(slot.start_time).slice(0,5)}–{String(slot.end_time).slice(0,5)}</p><p className="text-xs text-stone-500 mt-1">Maximum {slot.maximum_guests} guests · {slot.status}</p></div><span className={`text-xs font-semibold rounded-full px-3 py-1 ${reservations.some((r:any)=>['pending','confirmed'].includes(r.status))?'bg-amber-100 text-amber-800':'bg-emerald-100 text-emerald-800'}`}>{reservations.some((r:any)=>['pending','confirmed'].includes(r.status))?'Reserved':'Available'}</span></div>
                    {reservations.map((reservation:any)=><div key={reservation.id} className="bg-stone-50 rounded-lg p-3 space-y-2">
                      <div className="flex flex-col sm:flex-row sm:justify-between gap-2"><div><p className="font-semibold">{reservation.customer_first_name} {reservation.customer_last_name} · {reservation.guest_count} guests</p><p className="text-xs text-stone-500">{reservation.reservation_reference} · {reservation.customer_email} · {reservation.customer_phone}</p></div><strong>{new Intl.NumberFormat(undefined,{style:'currency',currency:reservation.currency}).format(Number(reservation.total))}</strong></div>
                      <div className="flex flex-wrap gap-2"><select aria-label="Reservation status" value={reservation.status} onChange={(e)=>void changeReservation(reservation.id,{status:e.target.value})} className="text-xs rounded border border-stone-300 p-2 bg-white"><option value="pending">Pending</option><option value="confirmed">Confirmed</option><option value="cancelled">Cancelled</option><option value="completed">Completed</option><option value="no_show">No show</option></select><select aria-label="Payment status" value={reservation.payment_status} onChange={(e)=>void changeReservation(reservation.id,{payment_status:e.target.value})} className="text-xs rounded border border-stone-300 p-2 bg-white"><option value="pending">Payment pending</option><option value="paid">Paid</option><option value="partially_paid">Partially paid</option><option value="refunded">Refunded</option><option value="failed">Failed</option></select></div>
                    </div>)}
                  </article>;
                })}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
