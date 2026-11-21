import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, MapPin, Users, Ship, AlertCircle } from 'lucide-react';
import { ExclusiveDeparture, ExclusiveTrip, getExclusiveDepartures, getExclusiveTrips, reserveExclusiveTrip } from '../services/exclusiveTripService';

interface Props { onNavigateHome?: () => void; }

const money = (amount: number, currency: string) => {
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount); }
  catch { return `${amount.toFixed(2)} ${currency}`; }
};

export const ExclusiveTripsPage: React.FC<Props> = () => {
  const [trips, setTrips] = useState<ExclusiveTrip[]>([]);
  const [selectedTripId, setSelectedTripId] = useState('');
  const [departures, setDepartures] = useState<ExclusiveDeparture[]>([]);
  const [selectedDepartureId, setSelectedDepartureId] = useState('');
  const [guestCount, setGuestCount] = useState(2);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('');
  const [hotel, setHotel] = useState('');
  const [requests, setRequests] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'pay_at_pickup'|'pay_online'>('pay_at_pickup');
  const [loading, setLoading] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState<{ reference: string; total: number; currency: string } | null>(null);

  const selectedTrip = useMemo(() => trips.find((trip) => trip.id === selectedTripId) || null, [trips, selectedTripId]);
  const selectedDeparture = useMemo(() => departures.find((slot) => slot.id === selectedDepartureId) || null, [departures, selectedDepartureId]);

  useEffect(() => {
    let active = true;
    getExclusiveTrips().then((items) => {
      if (!active) return;
      setTrips(items);
      if (items[0]) setSelectedTripId(items[0].id);
    }).catch((err) => active && setError(err instanceof Error ? err.message : 'Unable to load Exclusive trips.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!selectedTripId) { setDepartures([]); setSelectedDepartureId(''); return; }
    let active = true;
    setSlotsLoading(true);
    setSelectedDepartureId('');
    getExclusiveDepartures(selectedTripId).then((items) => {
      if (!active) return;
      setDepartures(items);
    }).catch((err) => active && setError(err instanceof Error ? err.message : 'Unable to load availability.'))
      .finally(() => active && setSlotsLoading(false));
    return () => { active = false; };
  }, [selectedTripId]);

  const handleReserve = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedTrip || !selectedDeparture) { setError('Please select an available date and time.'); return; }
    if (guestCount < selectedTrip.minimum_guests || guestCount > Math.min(selectedTrip.maximum_guests, selectedDeparture.maximum_guests)) {
      setError('Please choose a guest count within this trip’s limits.'); return;
    }
    setSubmitting(true); setError('');
    try {
      const result = await reserveExclusiveTrip({
        departureId: selectedDeparture.id, guestCount, firstName, lastName, email, phone,
        country, hotel, paymentMethod, specialRequests: requests,
        idempotencyKey: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `exclusive-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      });
      setConfirmation({ reference: result.reservationReference, total: result.total, currency: result.currency });
      setDepartures((current) => current.filter((slot) => slot.id !== selectedDeparture.id));
      setSelectedDepartureId('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to complete your reservation.');
      const refreshed = await getExclusiveDepartures(selectedTrip.id).catch(() => departures);
      setDepartures(refreshed);
    } finally { setSubmitting(false); }
  };

  if (loading) return <main className="min-h-[60vh] grid place-items-center text-stone-600">Loading exclusive experiences…</main>;

  return (
    <main className="min-h-screen bg-[#FAF8F5] dark:bg-[#0A1118] text-stone-900 dark:text-slate-100">
      <section className="bg-[#102B32] text-white px-4 sm:px-8 py-14 sm:py-20">
        <div className="max-w-7xl mx-auto">
          <p className="uppercase tracking-[.22em] text-xs text-teal-200 font-semibold">Made entirely yours</p>
          <h1 className="font-display text-4xl sm:text-5xl font-bold mt-3">Exclusive Private Trips</h1>
          <p className="mt-4 max-w-2xl text-white/75 text-base sm:text-lg">Your own boat, yacht or private adventure. One fixed price for the entire trip, with no per-person price changes.</p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(340px,.82fr)] gap-8">
        <section className="space-y-5">
          <div className="flex items-center justify-between gap-3"><h2 className="text-2xl font-bold">Choose your experience</h2><span className="text-sm text-stone-500">{trips.length} experiences</span></div>
          {trips.length === 0 && <div className="rounded-2xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-7">No exclusive trips are currently published. Please check back soon.</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {trips.map((trip) => {
              const image = trip.tours.tour_images?.[0]?.image_url;
              const active = selectedTripId === trip.id;
              return <button key={trip.id} type="button" onClick={() => { setSelectedTripId(trip.id); setConfirmation(null); setError(''); }} aria-pressed={active}
                className={`overflow-hidden rounded-2xl text-left bg-white dark:bg-slate-900 border-2 transition ${active ? 'border-teal-700 shadow-lg' : 'border-stone-200 dark:border-slate-700 hover:border-teal-500'}`}>
                {image ? <img src={image} alt={trip.tours.title} className="w-full h-48 object-cover" loading="lazy" /> : <div className="h-48 bg-stone-200 dark:bg-slate-800 grid place-items-center"><Ship size={42}/></div>}
                <div className="p-5">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-teal-700 dark:text-teal-300 font-semibold"><Ship size={14}/> Exclusive experience</div>
                  <h3 className="text-xl font-bold mt-2">{trip.tours.title}</h3>
                  {trip.tours.destinations?.name && <p className="text-sm text-stone-500 mt-1 flex items-center gap-1"><MapPin size={14}/>{trip.tours.destinations.name}</p>}
                  <p className="text-sm text-stone-600 dark:text-slate-300 mt-3 line-clamp-3">{trip.tours.short_description || trip.tours.description}</p>
                  <div className="mt-5 flex justify-between items-end gap-2">
                    <div><p className="text-xs text-stone-500">Fixed price · entire trip</p><p className="text-2xl font-bold">{money(trip.fixed_trip_price, trip.currency)}</p></div>
                    <span className="text-xs text-stone-500 flex items-center gap-1"><Users size={14}/>{trip.minimum_guests}–{trip.maximum_guests} guests</span>
                  </div>
                </div>
              </button>;
            })}
          </div>
        </section>

        <aside className="lg:sticky lg:top-24 self-start">
          {confirmation ? (
            <div className="rounded-2xl border border-emerald-200 bg-white dark:bg-slate-900 dark:border-emerald-900 p-6 sm:p-8">
              <CheckCircle2 className="text-emerald-600" size={42}/>
              <h2 className="text-2xl font-bold mt-4">Reservation received</h2>
              <p className="mt-2 text-stone-600 dark:text-slate-300">Your exclusive trip request has been recorded. Keep this reference for your records.</p>
              <p className="mt-5 text-xs text-stone-500">Reservation reference</p><p className="text-xl font-bold tracking-wide">{confirmation.reference}</p>
              <div className="mt-5 border-t border-stone-200 dark:border-slate-700 pt-4 flex justify-between"><span>Total · entire trip</span><strong>{money(confirmation.total, confirmation.currency)}</strong></div>
              <button type="button" onClick={() => setConfirmation(null)} className="mt-6 w-full rounded-xl bg-teal-800 text-white py-3 font-semibold">Book another exclusive trip</button>
            </div>
          ) : selectedTrip ? (
            <form onSubmit={handleReserve} className="rounded-2xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 sm:p-7 shadow-sm space-y-4">
              <div><p className="text-xs uppercase tracking-wider text-teal-700 dark:text-teal-300 font-semibold">Reserve privately</p><h2 className="text-2xl font-bold mt-1">{selectedTrip.tours.title}</h2><p className="text-sm text-stone-500 mt-1">One reservation secures the entire slot.</p></div>
              <div className="rounded-xl bg-stone-50 dark:bg-slate-800 p-4 flex justify-between gap-3"><div><p className="text-xs text-stone-500">Fixed total · not per person</p><p className="text-2xl font-bold">{money(selectedTrip.fixed_trip_price, selectedTrip.currency)}</p></div><Ship className="text-teal-700" size={26}/></div>
              <label className="block text-sm font-semibold">Available date and time
                <select required value={selectedDepartureId} onChange={(e) => setSelectedDepartureId(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 dark:border-slate-600 bg-white dark:bg-slate-800 p-3">
                  <option value="">{slotsLoading ? 'Loading slots…' : 'Select a departure'}</option>
                  {departures.map((slot) => <option key={slot.id} value={slot.id}>{slot.date} · {slot.start_time.slice(0,5)}–{slot.end_time.slice(0,5)} · max {Math.min(slot.maximum_guests, selectedTrip.maximum_guests)} guests</option>)}
                </select>
              </label>
              {!slotsLoading && departures.length === 0 && <p className="text-sm text-amber-700 dark:text-amber-300 flex gap-2"><Clock3 size={16}/>No confirmed dates are available for this experience right now.</p>}
              <label className="block text-sm font-semibold">Number of guests
                <input type="number" min={selectedTrip.minimum_guests} max={selectedDeparture ? Math.min(selectedTrip.maximum_guests, selectedDeparture.maximum_guests) : selectedTrip.maximum_guests} value={guestCount} onChange={(e) => setGuestCount(Number(e.target.value))} required className="mt-1 w-full rounded-lg border border-stone-300 dark:border-slate-600 bg-white dark:bg-slate-800 p-3"/>
                <span className="text-xs text-stone-500 font-normal">Allowed: {selectedTrip.minimum_guests}–{selectedDeparture ? Math.min(selectedTrip.maximum_guests, selectedDeparture.maximum_guests) : selectedTrip.maximum_guests} guests. Total price stays the same.</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="text-sm font-semibold">First name<input required value={firstName} onChange={(e)=>setFirstName(e.target.value)} autoComplete="given-name" className="mt-1 w-full rounded-lg border border-stone-300 dark:border-slate-600 bg-transparent p-3"/></label>
                <label className="text-sm font-semibold">Last name<input required value={lastName} onChange={(e)=>setLastName(e.target.value)} autoComplete="family-name" className="mt-1 w-full rounded-lg border border-stone-300 dark:border-slate-600 bg-transparent p-3"/></label>
              </div>
              <label className="block text-sm font-semibold">Email<input required type="email" value={email} onChange={(e)=>setEmail(e.target.value)} autoComplete="email" className="mt-1 w-full rounded-lg border border-stone-300 dark:border-slate-600 bg-transparent p-3"/></label>
              <label className="block text-sm font-semibold">Phone / WhatsApp<input required type="tel" value={phone} onChange={(e)=>setPhone(e.target.value)} autoComplete="tel" className="mt-1 w-full rounded-lg border border-stone-300 dark:border-slate-600 bg-transparent p-3"/></label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="text-sm font-semibold">Country<input value={country} onChange={(e)=>setCountry(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 dark:border-slate-600 bg-transparent p-3"/></label>
                <label className="text-sm font-semibold">Hotel / pickup<input value={hotel} onChange={(e)=>setHotel(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 dark:border-slate-600 bg-transparent p-3"/></label>
              </div>
              <label className="block text-sm font-semibold">Special requests <span className="font-normal text-stone-500">(optional)</span><textarea rows={2} value={requests} onChange={(e)=>setRequests(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 dark:border-slate-600 bg-transparent p-3"/></label>
              <label className="block text-sm font-semibold">Payment preference<select value={paymentMethod} onChange={(e)=>setPaymentMethod(e.target.value as any)} className="mt-1 w-full rounded-lg border border-stone-300 dark:border-slate-600 bg-white dark:bg-slate-800 p-3"><option value="pay_at_pickup">Pay on the day</option><option value="pay_online">Pay online (payment arranged after request)</option></select></label>
              {error && <p role="alert" className="rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 p-3 text-sm flex gap-2"><AlertCircle size={16} className="shrink-0"/>{error}</p>}
              <div className="border-t border-stone-200 dark:border-slate-700 pt-4 flex justify-between items-center"><span className="font-semibold">Total for the entire trip</span><strong className="text-xl">{money(selectedTrip.fixed_trip_price, selectedTrip.currency)}</strong></div>
              <button type="submit" disabled={submitting || slotsLoading || !selectedDepartureId || !departures.length} className="w-full rounded-xl bg-teal-800 hover:bg-teal-900 disabled:opacity-50 text-white py-3.5 font-bold">{submitting ? 'Reserving…' : 'Reserve this private trip'}</button>
              <p className="text-xs text-stone-500 text-center">A slot can be reserved by one group only. Guest count does not change the trip price.</p>
            </form>
          ) : <div className="rounded-2xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-700 p-7">Choose an Exclusive experience to see its dates and booking details.</div>}
        </aside>
      </div>
    </main>
  );
};
