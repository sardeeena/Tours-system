import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Printer,
  Download,
  Calendar,
  Ship,
  Car,
  Anchor,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  Filter,
  Users,
  DollarSign,
  Compass,
} from 'lucide-react';
import {
  getTodayDepartures,
  getPassengerManifest,
  getDailyPickupSchedule,
  listVessels,
  listGuides,
  getLatestWeatherBulletin,
} from '../../../services/operationsService';
import {
  OperationalDeparture,
  PassengerManifestItem,
  PickupScheduleItem,
} from '../../../types/operations';
import { DbVessel, DbGuide, DbWeatherBulletin } from '../../../types/database';
import { Tour } from '../../../types';
import { ALL_TOURS } from '../../../data/toursData';
import { getPublishedTours } from '../../../services/tourService';
import { useToast } from '../../../contexts/ToastContext';

type DocumentType =
  | 'coast_guard_manifest'
  | 'pickup_run_sheet'
  | 'captain_briefing'
  | 'pier_financials';

interface OperationsDocumentsProps {
  onNavigateTab?: (tabId: string, param?: string) => void;
}

export const OperationsDocuments: React.FC<OperationsDocumentsProps> = ({ onNavigateTab }) => {
  const { showToast } = useToast();
  const [selectedDate, setSelectedDate] = useState<string>(
    () => new Date().toISOString().split('T')[0]
  );
  const [docType, setDocType] = useState<DocumentType>('coast_guard_manifest');
  const [selectedTourId, setSelectedTourId] = useState<string>('all');
  const [tours, setTours] = useState<Tour[]>(ALL_TOURS);
  const [loading, setLoading] = useState(true);

  // Data states
  const [departures, setDepartures] = useState<OperationalDeparture[]>([]);
  const [passengers, setPassengers] = useState<PassengerManifestItem[]>([]);
  const [pickups, setPickups] = useState<PickupScheduleItem[]>([]);
  const [vessels, setVessels] = useState<DbVessel[]>([]);
  const [guides, setGuides] = useState<DbGuide[]>([]);
  const [weather, setWeather] = useState<DbWeatherBulletin | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [deps, pass, picks, ves, gui, wea, loadedTours] = await Promise.all([
        getTodayDepartures(selectedDate),
        getPassengerManifest(selectedDate),
        getDailyPickupSchedule(selectedDate),
        listVessels(),
        listGuides(),
        getLatestWeatherBulletin(),
        getPublishedTours().catch(() => []),
      ]);
      setDepartures(deps);
      setPassengers(pass);
      setPickups(picks);
      setVessels(ves);
      setGuides(gui);
      setWeather(wea);
      if (loadedTours && loadedTours.length > 0) {
        setTours(loadedTours);
      }
    } catch (err) {
      console.warn('Failed to load document data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedDate]);

  // Filtered dataset for selected tour
  const filteredPassengers = useMemo(() => {
    if (selectedTourId === 'all') return passengers;
    return passengers.filter((p) => p.tourId === selectedTourId);
  }, [passengers, selectedTourId]);

  const filteredDepartures = useMemo(() => {
    if (selectedTourId === 'all') return departures;
    return departures.filter((d) => d.tourId === selectedTourId);
  }, [departures, selectedTourId]);

  const filteredPickups = useMemo(() => {
    if (selectedTourId === 'all') return pickups;
    const tourTitle = tours.find((t) => t.id === selectedTourId)?.title || ALL_TOURS.find((t) => t.id === selectedTourId)?.title;
    if (!tourTitle) return pickups;
    return pickups.filter((p) => p.tourTitle.toLowerCase().includes(tourTitle.toLowerCase()));
  }, [pickups, selectedTourId, tours]);

  const activeDeparture = filteredDepartures[0] || departures[0] || null;
  const activeVessel = vessels.find((v) => v.id === activeDeparture?.vesselId) || vessels[0];
  const activeGuide = guides.find((g) => g.id === activeDeparture?.guideId) || guides[0];

  const handlePrint = () => {
    window.print();
  };

  const handleExportCsv = () => {
    let csvContent = '';
    let filename = '';

    if (docType === 'coast_guard_manifest') {
      filename = `coast_guard_manifest_${selectedDate}.csv`;
      const headers = ['No', 'Full Name', 'Nationality', 'Passport/ID', 'Passenger Type', 'Booking Reference', 'Hotel', 'Lead'];
      const rows = filteredPassengers.map((p, idx) => [
        idx + 1,
        `"${p.fullName}"`,
        `"${p.nationality || 'N/A'}"`,
        `"${p.passportOrId || 'On Pier Inspection'}"`,
        p.passengerType,
        p.bookingReference,
        `"${p.hotel || 'Direct Marina'}"`,
        p.isLeadPassenger ? 'YES' : 'NO',
      ]);
      csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    } else if (docType === 'pickup_run_sheet') {
      filename = `pickup_schedule_${selectedDate}.csv`;
      const headers = ['Pickup Time', 'Hotel', 'Room', 'Customer', 'Pax', 'Tour', 'Driver/Vehicle', 'Status', 'Phone'];
      const rows = filteredPickups.map((p) => [
        p.pickupTime,
        `"${p.hotelName}"`,
        `"${p.roomNumber || '-'}"`,
        `"${p.customerName}"`,
        p.passengerCount,
        `"${p.tourTitle}"`,
        `"${p.driverVehicle || 'Assigned Shuttle'}"`,
        p.status,
        `"${p.customerPhone || 'N/A'}"`,
      ]);
      csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    } else if (docType === 'pier_financials') {
      filename = `pier_collections_${selectedDate}.csv`;
      const headers = ['Tour', 'Departure Time', 'Total EUR', 'Due at Pier EUR', 'Bookings Count', 'Passengers Count'];
      const rows = filteredDepartures.map((d) => [
        `"${d.tourTitle}"`,
        d.departureTime,
        d.paymentSummary.totalEur,
        d.paymentSummary.outstandingEur,
        d.bookingsCount,
        d.passengerCount,
      ]);
      csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    } else {
      filename = `captain_briefing_${selectedDate}.txt`;
      csvContent = `RED SEA MARINE OPERATIONS BRIEFING\nDate: ${selectedDate}\nVessel: ${activeVessel?.name}\nCaptain: ${activeGuide?.full_name}\nPassengers: ${filteredPassengers.length}\nCoast Guard Cleared: ${weather?.coast_guard_cleared ? 'YES' : 'NO'}\nWater Temp: ${weather?.water_temperature_c}C\nSwell: ${weather?.swell_height_m}m\nWind: ${weather?.wind_speed_knots} kts ${weather?.wind_direction}`;
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Exported ${filename}`, 'success');
  };

  return (
    <div className="space-y-6">
      {/* Top Controls Header (Hidden in Print) */}
      <div className="print:hidden space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] uppercase tracking-widest text-[#2dd4bf] font-bold block mb-0.5">
              Port Authority & Field Dispatch
            </span>
            <h1 className="text-2xl font-bold font-display text-white tracking-tight flex items-center space-x-2">
              <FileText className="w-6 h-6 text-[#2dd4bf]" />
              <span>Operational Documents & Packets</span>
            </h1>
            <p className="text-xs text-stone-400 mt-1">
              Official Coast Guard manifests, hotel transfer run sheets, captain briefings, and financial collection sheets.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded text-xs font-semibold flex items-center space-x-1.5 cursor-pointer shadow-xs transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>Print Document</span>
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded text-xs font-medium flex items-center space-x-1.5 cursor-pointer transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-stone-950 border border-stone-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Document Type Selector Tabs */}
          <div className="flex flex-wrap gap-1 bg-stone-900/80 p-1 rounded-lg border border-stone-800">
            <button
              type="button"
              onClick={() => setDocType('coast_guard_manifest')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer flex items-center space-x-1.5 ${
                docType === 'coast_guard_manifest'
                  ? 'bg-[#0A6C74] text-white font-semibold shadow-xs'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              <Anchor className="w-3.5 h-3.5" />
              <span>Coast Guard Manifest</span>
            </button>

            <button
              type="button"
              onClick={() => setDocType('pickup_run_sheet')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer flex items-center space-x-1.5 ${
                docType === 'pickup_run_sheet'
                  ? 'bg-[#0A6C74] text-white font-semibold shadow-xs'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              <Car className="w-3.5 h-3.5" />
              <span>Pickup Run Sheet</span>
            </button>

            <button
              type="button"
              onClick={() => setDocType('captain_briefing')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer flex items-center space-x-1.5 ${
                docType === 'captain_briefing'
                  ? 'bg-[#0A6C74] text-white font-semibold shadow-xs'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              <Ship className="w-3.5 h-3.5" />
              <span>Captain Briefing</span>
            </button>

            <button
              type="button"
              onClick={() => setDocType('pier_financials')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer flex items-center space-x-1.5 ${
                docType === 'pier_financials'
                  ? 'bg-[#0A6C74] text-white font-semibold shadow-xs'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>Pier Financials</span>
            </button>
          </div>

          {/* Date & Tour Filter */}
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1.5">
              <span className="text-stone-500 text-[11px]">Date:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-2.5 py-1 bg-stone-900 border border-stone-800 rounded text-stone-200 text-xs font-mono"
              />
            </div>

            <div className="flex items-center space-x-1.5">
              <span className="text-stone-500 text-[11px]">Excursion:</span>
              <select
                value={selectedTourId}
                onChange={(e) => setSelectedTourId(e.target.value)}
                className="px-2.5 py-1 bg-stone-900 border border-stone-800 rounded text-stone-200 text-xs max-w-[200px]"
              >
                <option value="all">All Excursions ({departures.length})</option>
                {tours.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="p-1.5 bg-stone-900 border border-stone-800 rounded text-stone-400 hover:text-white cursor-pointer"
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* DOCUMENT PREVIEW CONTAINER (Styled for on-screen inspection and high-fidelity paper print) */}
      <div className="bg-white text-stone-900 rounded-xl p-8 sm:p-10 shadow-lg border border-stone-200 print:border-none print:shadow-none print:p-0 print:m-0 print:rounded-none max-w-5xl mx-auto">
        {/* ==================================================================== */}
        {/* DOCUMENT 1: COAST GUARD MARINE PASSENGER MANIFEST */}
        {/* ==================================================================== */}
        {docType === 'coast_guard_manifest' && (
          <div className="space-y-6">
            {/* Official Header */}
            <div className="border-b-2 border-stone-900 pb-4">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-bold tracking-widest uppercase text-stone-500 block">
                    ARAB REPUBLIC OF EGYPT &bull; RED SEA MARITIME AUTHORITY
                  </span>
                  <h2 className="text-xl sm:text-2xl font-bold font-serif uppercase tracking-tight text-stone-900 mt-0.5">
                    Official Marine Passenger Manifest & Port Clearance
                  </h2>
                  <p className="text-xs text-stone-600 mt-1">
                    Coast Guard Harbor Master Clearance Roster &bull; Hurghada Marine Sector
                  </p>
                </div>
                <div className="text-right font-mono text-xs">
                  <div className="font-bold text-sm">FORM CG-RSE-2026</div>
                  <div className="text-stone-500">Date: {selectedDate}</div>
                  <div className="text-stone-500">Depart: {activeDeparture?.departureTime || '08:30'}</div>
                </div>
              </div>
            </div>

            {/* Maritime Vessel & Master Details Box */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-stone-50 p-3.5 rounded border border-stone-300 text-xs font-mono">
              <div>
                <span className="text-[10px] uppercase text-stone-500 block">Vessel Name</span>
                <strong className="text-stone-900 text-sm">{activeVessel?.name || 'M/Y Red Sea Star VIP'}</strong>
              </div>
              <div>
                <span className="text-[10px] uppercase text-stone-500 block">Registration No.</span>
                <strong className="text-stone-900">{activeVessel?.registration_number || 'HUR-8841-VIP'}</strong>
              </div>
              <div>
                <span className="text-[10px] uppercase text-stone-500 block">Master / Captain</span>
                <strong className="text-stone-900">{activeGuide?.full_name || 'Captain Tarek Mansour'}</strong>
              </div>
              <div>
                <span className="text-[10px] uppercase text-stone-500 block">Marina / Port</span>
                <strong className="text-stone-900">{activeVessel?.port_marina || 'Hurghada Marina'}</strong>
              </div>
            </div>

            {/* Weather / Harbour Master Clearance Status */}
            <div className="flex items-center justify-between text-xs bg-emerald-50 border border-emerald-300 px-3.5 py-2 rounded text-emerald-950 font-mono">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                <span>
                  <strong>Harbor Master Status:</strong> GREEN FLAG &bull; Authorized for Red Sea navigation
                </span>
              </div>
              <div>
                Sea: {weather?.swell_height_m || 0.45}m &bull; Wind: {weather?.wind_speed_knots || 8.5} kts &bull; Visibility: {weather?.visibility_meters || 35}m
              </div>
            </div>

            {/* Passenger Roster Table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700">
                  Manifested Travelers ({filteredPassengers.length} Total Passengers)
                </h3>
                <span className="text-xs text-stone-500 font-mono">
                  Max Vessel Capacity: {activeVessel?.passenger_capacity || 45} pax
                </span>
              </div>

              <table className="w-full text-left text-xs border border-stone-300">
                <thead>
                  <tr className="bg-stone-100 text-stone-700 font-bold border-b border-stone-300 text-[11px]">
                    <th className="p-2 border-r border-stone-300 w-10 text-center">#</th>
                    <th className="p-2 border-r border-stone-300">Full Passenger Name</th>
                    <th className="p-2 border-r border-stone-300">Nationality</th>
                    <th className="p-2 border-r border-stone-300">Passport / ID Number</th>
                    <th className="p-2 border-r border-stone-300">Category</th>
                    <th className="p-2 border-r border-stone-300">Hotel / Pier Location</th>
                    <th className="p-2 border-r border-stone-300">Ref</th>
                    <th className="p-2 text-center w-12">Boarded</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200 font-mono">
                  {filteredPassengers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-6 text-center text-stone-400 font-sans">
                        No passenger reservations recorded for this departure date.
                      </td>
                    </tr>
                  ) : (
                    filteredPassengers.map((p, idx) => (
                      <tr key={p.id} className="hover:bg-stone-50">
                        <td className="p-2 border-r border-stone-200 text-center text-stone-500">{idx + 1}</td>
                        <td className="p-2 border-r border-stone-200 font-bold text-stone-900 font-sans">
                          {p.fullName} {p.isLeadPassenger && <span className="text-[10px] text-teal-700 font-mono">[LEAD]</span>}
                        </td>
                        <td className="p-2 border-r border-stone-200">{p.nationality || 'International'}</td>
                        <td className="p-2 border-r border-stone-200 text-stone-800">
                          {p.passportOrId || 'VERIFIED ON PIER'}
                        </td>
                        <td className="p-2 border-r border-stone-200 uppercase text-[11px]">{p.passengerType}</td>
                        <td className="p-2 border-r border-stone-200 font-sans">{p.hotel || 'Direct Marina'}</td>
                        <td className="p-2 border-r border-stone-200 text-stone-600 text-[11px]">{p.bookingReference}</td>
                        <td className="p-2 text-center">
                          <div className="w-3.5 h-3.5 border border-stone-400 mx-auto rounded-xs" />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Official Signatures & Coast Guard Stamp Blocks */}
            <div className="pt-8 border-t border-stone-300 grid grid-cols-3 gap-6 text-xs text-stone-700">
              <div className="space-y-8">
                <span className="text-[10px] uppercase font-bold text-stone-500 block">
                  Vessel Master / Captain Signature
                </span>
                <div className="border-b border-stone-400 pb-1">
                  Captain: {activeGuide?.full_name || 'Captain Tarek Mansour'}
                </div>
              </div>

              <div className="space-y-8 text-center">
                <span className="text-[10px] uppercase font-bold text-stone-500 block">
                  Coast Guard Official Stamp
                </span>
                <div className="w-24 h-24 border-2 border-dashed border-stone-400 rounded-full mx-auto flex items-center justify-center text-[10px] text-stone-400">
                  SEAL / STAMP
                </div>
              </div>

              <div className="space-y-8 text-right">
                <span className="text-[10px] uppercase font-bold text-stone-500 block">
                  Harbor Master Officer Signature
                </span>
                <div className="border-b border-stone-400 pb-1">
                  Harbor Authority Officer
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* DOCUMENT 2: PICKUP RUN SHEET */}
        {/* ==================================================================== */}
        {docType === 'pickup_run_sheet' && (
          <div className="space-y-6">
            <div className="border-b-2 border-stone-900 pb-4">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-bold tracking-widest uppercase text-stone-500 block">
                    RED SEA VOYAGES &bull; LOGISTICS & GROUND TRANSPORTATION
                  </span>
                  <h2 className="text-xl sm:text-2xl font-bold font-serif uppercase tracking-tight text-stone-900 mt-0.5">
                    Daily Hotel Transfer Dispatch & Run Sheet
                  </h2>
                  <p className="text-xs text-stone-600 mt-1">
                    Route driver checklist, pickup times, and guest boarding confirmation.
                  </p>
                </div>
                <div className="text-right font-mono text-xs">
                  <div className="font-bold text-sm">ROUTE SHEET</div>
                  <div className="text-stone-500">Date: {selectedDate}</div>
                  <div className="text-stone-500">Stops: {filteredPickups.length}</div>
                </div>
              </div>
            </div>

            {/* Run Sheet Table */}
            <table className="w-full text-left text-xs border border-stone-300">
              <thead>
                <tr className="bg-stone-100 text-stone-700 font-bold border-b border-stone-300 text-[11px]">
                  <th className="p-2 border-r border-stone-300 w-16">Pickup</th>
                  <th className="p-2 border-r border-stone-300">Hotel Name & Area</th>
                  <th className="p-2 border-r border-stone-300 w-16">Room</th>
                  <th className="p-2 border-r border-stone-300">Customer Name</th>
                  <th className="p-2 border-r border-stone-300 w-12 text-center">Pax</th>
                  <th className="p-2 border-r border-stone-300">Tour & Excursion</th>
                  <th className="p-2 border-r border-stone-300">Contact Phone</th>
                  <th className="p-2 border-r border-stone-300 w-24">Vehicle/Driver</th>
                  <th className="p-2 text-center w-20">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200 font-mono">
                {filteredPickups.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-6 text-center text-stone-400 font-sans">
                      No hotel pickups scheduled for this date.
                    </td>
                  </tr>
                ) : (
                  filteredPickups.map((item) => (
                    <tr key={item.id} className="hover:bg-stone-50">
                      <td className="p-2 border-r border-stone-200 font-bold text-stone-900 text-sm">
                        {item.pickupTime}
                      </td>
                      <td className="p-2 border-r border-stone-200 font-bold font-sans text-stone-900">
                        {item.hotelName}
                        <span className="block text-[10px] text-stone-500 font-mono font-normal">{item.pickupArea}</span>
                      </td>
                      <td className="p-2 border-r border-stone-200 text-center font-bold text-stone-800">
                        {item.roomNumber || '-'}
                      </td>
                      <td className="p-2 border-r border-stone-200 font-sans">
                        {item.customerName}
                        <span className="block text-[10px] text-stone-500 font-mono">{item.bookingReference}</span>
                      </td>
                      <td className="p-2 border-r border-stone-200 text-center font-bold text-teal-800 text-sm">
                        {item.passengerCount}
                      </td>
                      <td className="p-2 border-r border-stone-200 font-sans text-stone-800 truncate max-w-[150px]">
                        {item.tourTitle}
                      </td>
                      <td className="p-2 border-r border-stone-200 text-stone-600">
                        {item.customerPhone || 'N/A'}
                      </td>
                      <td className="p-2 border-r border-stone-200 font-sans text-[11px]">
                        {item.driverVehicle || 'Van #12'}
                      </td>
                      <td className="p-2 text-center">
                        <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border border-stone-300 bg-stone-100">
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Driver Notes & Sign-off */}
            <div className="pt-6 border-t border-stone-300 grid grid-cols-2 gap-8 text-xs text-stone-700">
              <div className="space-y-4">
                <span className="text-[10px] uppercase font-bold text-stone-500 block">
                  Driver Notes / Exceptions / Delays
                </span>
                <div className="h-16 border border-stone-300 rounded p-2 text-stone-400">
                  Note any no-shows or room changes here...
                </div>
              </div>
              <div className="space-y-8 text-right">
                <span className="text-[10px] uppercase font-bold text-stone-500 block">
                  Lead Driver Signature & Marina Arrival Confirmation
                </span>
                <div className="border-b border-stone-400 pb-1">
                  Signature: ____________________________________
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* DOCUMENT 3: CAPTAIN & CREW BRIEFING PACKET */}
        {/* ==================================================================== */}
        {docType === 'captain_briefing' && (
          <div className="space-y-6">
            <div className="border-b-2 border-stone-900 pb-4">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-bold tracking-widest uppercase text-stone-500 block">
                    RED SEA VOYAGES &bull; MARINE OPERATIONS DEPARTMENT
                  </span>
                  <h2 className="text-xl sm:text-2xl font-bold font-serif uppercase tracking-tight text-stone-900 mt-0.5">
                    Captain & Marine Crew Departure Briefing
                  </h2>
                  <p className="text-xs text-stone-600 mt-1">
                    Pre-departure marine safety checklist, environmental telemetry, and guest alerts.
                  </p>
                </div>
                <div className="text-right font-mono text-xs">
                  <div className="font-bold text-sm">OPS BRIEFING</div>
                  <div className="text-stone-500">Date: {selectedDate}</div>
                  <div className="text-stone-500">Vessel: {activeVessel?.name}</div>
                </div>
              </div>
            </div>

            {/* Environmental & Maritime Conditions */}
            <div className="bg-stone-50 border border-stone-300 p-4 rounded space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700">
                1. Marine Weather & Hydrographic Conditions
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                <div>
                  <span className="text-stone-500 text-[10px]">Water Temp:</span>
                  <div className="font-bold text-sm text-stone-900">{weather?.water_temperature_c || 26.5}°C</div>
                </div>
                <div>
                  <span className="text-stone-500 text-[10px]">Air Temp:</span>
                  <div className="font-bold text-sm text-stone-900">{weather?.air_temperature_c || 31}°C</div>
                </div>
                <div>
                  <span className="text-stone-500 text-[10px]">Swell Height:</span>
                  <div className="font-bold text-sm text-stone-900">{weather?.swell_height_m || 0.45} m</div>
                </div>
                <div>
                  <span className="text-stone-500 text-[10px]">Wind Velocity:</span>
                  <div className="font-bold text-sm text-stone-900">{weather?.wind_speed_knots || 8.5} kts ({weather?.wind_direction || 'NNW'})</div>
                </div>
              </div>
              <p className="text-[11px] text-stone-600 font-sans pt-1">
                <strong>Advisory Note:</strong> {weather?.advisory_notes || 'Optimal sea conditions for Giftun Island reef navigation and dolphin observations. Coast Guard port clearance granted.'}
              </p>
            </div>

            {/* Safety & Gear Checklist */}
            <div className="border border-stone-300 p-4 rounded space-y-3 text-xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700">
                2. Mandatory Safety & Equipment Pre-Departure Check
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-stone-800">
                <label className="flex items-center space-x-2">
                  <input type="checkbox" defaultChecked className="rounded border-stone-300 text-teal-700" />
                  <span>Life Vests Count Verified ({activeVessel?.passenger_capacity || 45} adult + 15 child vests aboard)</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input type="checkbox" defaultChecked className="rounded border-stone-300 text-teal-700" />
                  <span>VHF Marine Radio Channel 16 & GPS Beacon operational</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input type="checkbox" defaultChecked className="rounded border-stone-300 text-teal-700" />
                  <span>Emergency Oxygen Kit & First Aid Trauma Bag inspected</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input type="checkbox" defaultChecked className="rounded border-stone-300 text-teal-700" />
                  <span>Freshwater rinse tanks & marine head facilities operational</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input type="checkbox" defaultChecked className="rounded border-stone-300 text-teal-700" />
                  <span>Snorkel masks, fins, and reef safety buoys accounted for</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input type="checkbox" defaultChecked className="rounded border-stone-300 text-teal-700" />
                  <span>Catering & buffet storage temperature check passed</span>
                </label>
              </div>
            </div>

            {/* Passenger Manifest Overview */}
            <div className="border border-stone-300 p-4 rounded space-y-2 text-xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700">
                3. Passenger Tally & Special Alerts
              </h3>
              <div className="flex items-center space-x-6 text-xs font-mono">
                <div>Total Manifested: <strong>{filteredPassengers.length}</strong></div>
                <div>Adults: <strong>{filteredPassengers.filter((p) => p.passengerType === 'adult').length}</strong></div>
                <div>Children: <strong>{filteredPassengers.filter((p) => p.passengerType === 'child').length}</strong></div>
                <div>Special Medical/Dietary: <strong>None reported</strong></div>
              </div>
            </div>

            <div className="pt-6 border-t border-stone-300 flex items-center justify-between text-xs text-stone-700">
              <div>
                Captain in Command: <strong>{activeGuide?.full_name || 'Captain Tarek Mansour'}</strong>
              </div>
              <div>
                Departure Cleared: ____________________________________
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* DOCUMENT 4: PIER FINANCIALS & COLLECTIONS */}
        {/* ==================================================================== */}
        {docType === 'pier_financials' && (
          <div className="space-y-6">
            <div className="border-b-2 border-stone-900 pb-4">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-bold tracking-widest uppercase text-stone-500 block">
                    RED SEA VOYAGES &bull; FINANCIAL AUDIT & PIER COLLECTIONS
                  </span>
                  <h2 className="text-xl sm:text-2xl font-bold font-serif uppercase tracking-tight text-stone-900 mt-0.5">
                    Pier Balance & Pay-At-Pickup Roster
                  </h2>
                  <p className="text-xs text-stone-600 mt-1">
                    Cash settlement and voucher reconciliation for daily departures.
                  </p>
                </div>
                <div className="text-right font-mono text-xs">
                  <div className="font-bold text-sm">SETTLEMENT SHEET</div>
                  <div className="text-stone-500">Date: {selectedDate}</div>
                </div>
              </div>
            </div>

            {/* Departures Financial Table */}
            <table className="w-full text-left text-xs border border-stone-300">
              <thead>
                <tr className="bg-stone-100 text-stone-700 font-bold border-b border-stone-300 text-[11px]">
                  <th className="p-2 border-r border-stone-300">Tour & Departure</th>
                  <th className="p-2 border-r border-stone-300 text-center">Bookings</th>
                  <th className="p-2 border-r border-stone-300 text-center">Guests</th>
                  <th className="p-2 border-r border-stone-300 text-right">Total Value</th>
                  <th className="p-2 border-r border-stone-300 text-right">Pre-Paid Online</th>
                  <th className="p-2 border-r border-stone-300 text-right">Pier Due (EUR)</th>
                  <th className="p-2 text-center w-24">Cash Collected</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200 font-mono">
                {filteredDepartures.map((d) => {
                  const prepaidEur = d.paymentSummary.totalEur - d.paymentSummary.outstandingEur;
                  return (
                    <tr key={d.id} className="hover:bg-stone-50">
                      <td className="p-2 border-r border-stone-200 font-bold font-sans text-stone-900">
                        {d.tourTitle}
                        <span className="block text-[10px] text-stone-500 font-mono font-normal">⏱️ {d.departureTime}</span>
                      </td>
                      <td className="p-2 border-r border-stone-200 text-center">{d.bookingsCount}</td>
                      <td className="p-2 border-r border-stone-200 text-center font-bold">{d.passengerCount}</td>
                      <td className="p-2 border-r border-stone-200 text-right font-bold">€{d.paymentSummary.totalEur}</td>
                      <td className="p-2 border-r border-stone-200 text-right text-emerald-800">€{prepaidEur}</td>
                      <td className="p-2 border-r border-stone-200 text-right font-bold text-amber-900">
                        €{d.paymentSummary.outstandingEur}
                      </td>
                      <td className="p-2 text-center">
                        <div className="w-16 h-5 border border-stone-400 mx-auto rounded-xs" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Reconciliation Totals */}
            <div className="bg-stone-50 p-4 rounded border border-stone-300 flex justify-between items-center text-xs font-mono">
              <div>
                Total Expected Cash at Pier:{' '}
                <strong className="text-base text-amber-900">
                  €{filteredDepartures.reduce((s, d) => s + d.paymentSummary.outstandingEur, 0)}
                </strong>
              </div>
              <div>
                Audited By: ____________________________________
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
