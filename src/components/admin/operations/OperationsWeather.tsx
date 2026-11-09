import React, { useState, useEffect } from 'react';
import {
  CloudSun,
  Wind,
  Droplets,
  Eye,
  AlertTriangle,
  CheckCircle2,
  Plus,
  RefreshCw,
  Anchor,
  ShieldCheck,
  Calendar,
  Ship,
  Compass,
  AlertCircle,
} from 'lucide-react';
import {
  getMaritimeWeather,
  listWeatherBulletins,
  createWeatherBulletin,
  getTodayDepartures,
} from '../../../services/operationsService';
import { WeatherInfo, OperationalDeparture } from '../../../types/operations';
import { DbWeatherBulletin } from '../../../types/database';
import { useToast } from '../../../contexts/ToastContext';

export const OperationsWeather: React.FC = () => {
  const { showToast } = useToast();
  const [selectedDate, setSelectedDate] = useState<string>(
    () => new Date().toISOString().split('T')[0]
  );
  const [weatherInfo, setWeatherInfo] = useState<WeatherInfo | null>(null);
  const [bulletins, setBulletins] = useState<DbWeatherBulletin[]>([]);
  const [departures, setDepartures] = useState<OperationalDeparture[]>([]);
  const [loading, setLoading] = useState(true);

  // New bulletin modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<DbWeatherBulletin>>({
    harbor_location: 'Hurghada Marina',
    water_temperature_c: 26.5,
    air_temperature_c: 31.0,
    swell_height_m: 0.45,
    wind_speed_knots: 8.5,
    wind_direction: 'NNW (Gentle Marine Breeze)',
    visibility_meters: 35,
    coast_guard_cleared: true,
    advisory_notes: 'Optimal marine conditions for Giftun Island crossings and coral reef snorkeling. Coast Guard green flag active.',
    bulletin_date: new Date().toISOString().split('T')[0],
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [wInfo, bList, deps] = await Promise.all([
        getMaritimeWeather(selectedDate),
        listWeatherBulletins(),
        getTodayDepartures(selectedDate),
      ]);
      setWeatherInfo(wInfo);
      setBulletins(bList);
      setDepartures(deps);
    } catch (err) {
      console.warn('Failed to load weather data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedDate]);

  const handleCreateBulletin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createWeatherBulletin({
        ...formData,
        bulletin_date: selectedDate,
      });
      showToast('Maritime weather bulletin published.', 'success');
      setIsModalOpen(false);
      await loadData();
    } catch {
      showToast('Error publishing weather bulletin', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] uppercase tracking-widest text-[#2dd4bf] font-bold block mb-0.5">
            Maritime Telemetry & Pier Safety
          </span>
          <h1 className="text-2xl font-bold font-display text-white tracking-tight flex items-center space-x-2">
            <CloudSun className="w-6 h-6 text-[#2dd4bf]" />
            <span>Maritime Weather & Harbor Clearance</span>
          </h1>
          <p className="text-xs text-stone-400 mt-1">
            Real-time Red Sea marine telemetry, swell dynamics, wind velocity, and official Coast Guard port clearance.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-1.5 bg-stone-900 border border-stone-800 rounded text-white text-xs font-mono"
          />

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="p-2 bg-stone-900 border border-stone-800 text-stone-300 hover:text-white rounded text-xs transition-colors cursor-pointer"
            title="Refresh Telemetry"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded text-xs font-semibold shadow transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Publish Harbor Log</span>
          </button>
        </div>
      </div>

      {/* Linked Departures Overview Banner */}
      <div className="bg-stone-950 border border-stone-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-3">
          <Ship className="w-5 h-5 text-[#2dd4bf]" />
          <div>
            <div className="text-white font-bold">
              Departures Linked to Weather on {selectedDate}: {departures.length} Tours
            </div>
            <div className="text-[11px] text-stone-400">
              {departures.length > 0
                ? departures.map((d) => `${d.tourTitle} (${d.departureTime})`).join(' • ')
                : 'No departures scheduled for this date.'}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-stone-400 font-mono text-[11px]">Provider:</span>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-stone-900 text-stone-300 border border-stone-800">
            {weatherInfo?.connected ? weatherInfo.provider : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Main Telemetry Panel: Handle Weather Unavailable vs Connected */}
      {!weatherInfo?.isAvailable ? (
        <div className="bg-stone-950 border border-stone-800 rounded-2xl p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-stone-900 border border-stone-800 flex items-center justify-center mx-auto text-stone-400">
            <AlertCircle className="w-6 h-6 text-stone-500" />
          </div>
          <h2 className="text-lg font-bold text-white">Weather unavailable</h2>
          <p className="text-xs text-stone-400 max-w-md mx-auto">
            {weatherInfo?.message ||
              'A live marine telemetry provider is not currently connected for this harbor, and no official port bulletin has been logged.'}
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="px-3 py-1.5 bg-stone-900 hover:bg-stone-800 border border-stone-800 text-stone-300 rounded text-xs cursor-pointer inline-flex items-center space-x-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log Manual Port Authority Clearance</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Clearance Status Card */}
          <div
            className={`border rounded-2xl p-6 relative overflow-hidden ${
              weatherInfo.coastGuardCleared
                ? 'bg-emerald-950/20 border-emerald-500/30'
                : 'bg-red-950/20 border-red-500/30'
            }`}
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <span
                    className={`w-3 h-3 rounded-full ${
                      weatherInfo.coastGuardCleared
                        ? 'bg-emerald-400 animate-pulse'
                        : 'bg-red-400'
                    }`}
                  />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
                    Official Port Authority Clearance
                  </span>
                </div>
                <h2 className="text-2xl font-bold font-display text-white">
                  {weatherInfo.coastGuardCleared
                    ? 'GREEN FLAG — PORT CLEARED FOR ALL MARITIME TRIPS'
                    : 'RED FLAG — ADVISORY SWELL / WIND WARNING'}
                </h2>
                <p className="text-xs text-stone-300 max-w-2xl">
                  {weatherInfo.advisoryNotes}
                </p>
              </div>

              <div className="shrink-0 p-4 bg-stone-900/60 rounded-xl border border-stone-800 text-right space-y-1">
                <span className="text-[10px] text-stone-400 font-mono block">Station Location</span>
                <strong className="text-white text-xs block">{weatherInfo.harborLocation}</strong>
                <span className="text-[10px] text-[#2dd4bf] font-mono block">
                  Date: {weatherInfo.bulletinDate}
                </span>
              </div>
            </div>
          </div>

          {/* Telemetry Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Air Temperature */}
            <div className="bg-stone-950 border border-stone-800 rounded-xl p-4 space-y-1">
              <div className="flex items-center justify-between text-stone-400 text-xs">
                <span>Air Temperature</span>
                <CloudSun className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-bold font-mono text-white">
                {weatherInfo.airTemperatureC !== null ? `${weatherInfo.airTemperatureC}°C` : '—'}
              </div>
              <p className="text-[10px] text-stone-500">Hurghada Coastal Sensor</p>
            </div>

            {/* Water Temperature */}
            <div className="bg-stone-950 border border-stone-800 rounded-xl p-4 space-y-1">
              <div className="flex items-center justify-between text-stone-400 text-xs">
                <span>Water Temperature</span>
                <Droplets className="w-4 h-4 text-sky-400" />
              </div>
              <div className="text-2xl font-bold font-mono text-white">
                {weatherInfo.waterTemperatureC !== null ? `${weatherInfo.waterTemperatureC}°C` : '—'}
              </div>
              <p className="text-[10px] text-stone-500">Surface Reef Depth (1m)</p>
            </div>

            {/* Wind Velocity */}
            <div className="bg-stone-950 border border-stone-800 rounded-xl p-4 space-y-1">
              <div className="flex items-center justify-between text-stone-400 text-xs">
                <span>Wind Velocity</span>
                <Wind className="w-4 h-4 text-teal-400" />
              </div>
              <div className="text-2xl font-bold font-mono text-white">
                {weatherInfo.windSpeedKnots !== null ? `${weatherInfo.windSpeedKnots} kts` : '—'}
              </div>
              <p className="text-[10px] text-stone-500">
                Direction: {weatherInfo.windDirection || 'NNW'}
              </p>
            </div>

            {/* Swell Height */}
            <div className="bg-stone-950 border border-stone-800 rounded-xl p-4 space-y-1">
              <div className="flex items-center justify-between text-stone-400 text-xs">
                <span>Swell Wave Height</span>
                <Compass className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-2xl font-bold font-mono text-white">
                {weatherInfo.swellHeightM !== null ? `${weatherInfo.swellHeightM} m` : '—'}
              </div>
              <p className="text-[10px] text-stone-500">
                {weatherInfo.swellHeightM && weatherInfo.swellHeightM < 1.0 ? 'Calm (Optimal)' : 'Moderate'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Historical Port Authority Log Entries */}
      <div className="bg-stone-950 border border-stone-800 rounded-xl p-5 space-y-3">
        <h3 className="font-bold text-white text-sm flex items-center space-x-2">
          <Anchor className="w-4 h-4 text-[#2dd4bf]" />
          <span>Official Coast Guard Log Archives ({bulletins.length})</span>
        </h3>

        {bulletins.length === 0 ? (
          <p className="text-xs text-stone-500 italic py-4">No manual log overrides registered.</p>
        ) : (
          <div className="divide-y divide-stone-800/80">
            {bulletins.map((b) => (
              <div key={b.id} className="py-3 flex items-start justify-between gap-3 text-xs">
                <div>
                  <div className="flex items-center space-x-2 font-semibold text-white">
                    <span className="font-mono text-stone-400">{b.bulletin_date}</span>
                    <span>&bull;</span>
                    <span>{b.harbor_location}</span>
                    <span
                      className={`px-2 py-0.2 rounded text-[10px] font-bold ${
                        b.coast_guard_cleared
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-red-500/20 text-red-300'
                      }`}
                    >
                      {b.coast_guard_cleared ? 'CLEARED' : 'WARNING'}
                    </span>
                  </div>
                  <p className="text-stone-400 text-[11px] mt-1">{b.advisory_notes}</p>
                </div>
                <div className="text-right text-[11px] font-mono text-stone-400 shrink-0">
                  {b.wind_speed_knots} kts &bull; {b.swell_height_m}m wave
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal: Publish Harbor Bulletin */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-xl p-6 w-full max-w-lg space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <h3 className="font-bold text-white text-base">Publish Official Harbor Weather Log</h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-stone-400 hover:text-white cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateBulletin} className="space-y-4 text-xs">
              <div>
                <label className="block text-stone-300 font-semibold mb-1">Harbor Station</label>
                <input
                  type="text"
                  value={formData.harbor_location || ''}
                  onChange={(e) => setFormData({ ...formData, harbor_location: e.target.value })}
                  placeholder="e.g. Hurghada Marina Terminal"
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded text-stone-200"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-300 font-semibold mb-1">Air Temp (°C)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.air_temperature_c || 30.0}
                    onChange={(e) =>
                      setFormData({ ...formData, air_temperature_c: parseFloat(e.target.value) || 30.0 })
                    }
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded text-stone-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-stone-300 font-semibold mb-1">Water Temp (°C)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.water_temperature_c || 26.0}
                    onChange={(e) =>
                      setFormData({ ...formData, water_temperature_c: parseFloat(e.target.value) || 26.0 })
                    }
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded text-stone-200 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-300 font-semibold mb-1">Wind Speed (Knots)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.wind_speed_knots || 8.0}
                    onChange={(e) =>
                      setFormData({ ...formData, wind_speed_knots: parseFloat(e.target.value) || 8.0 })
                    }
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded text-stone-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-stone-300 font-semibold mb-1">Swell Height (Meters)</label>
                  <input
                    type="number"
                    step="0.05"
                    value={formData.swell_height_m || 0.4}
                    onChange={(e) =>
                      setFormData({ ...formData, swell_height_m: parseFloat(e.target.value) || 0.4 })
                    }
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded text-stone-200 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-stone-300 font-semibold mb-1">Coast Guard Clearance</label>
                <select
                  value={formData.coast_guard_cleared ? 'true' : 'false'}
                  onChange={(e) =>
                    setFormData({ ...formData, coast_guard_cleared: e.target.value === 'true' })
                  }
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded text-stone-200"
                >
                  <option value="true">GREEN FLAG (Cleared for all excursions)</option>
                  <option value="false">RED FLAG / WARNING (Harbor advisory active)</option>
                </select>
              </div>

              <div>
                <label className="block text-stone-300 font-semibold mb-1">Official Advisory Notes</label>
                <textarea
                  value={formData.advisory_notes || ''}
                  onChange={(e) => setFormData({ ...formData, advisory_notes: e.target.value })}
                  placeholder="Coast Guard instructions, marine reserve wind notices..."
                  rows={3}
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded text-stone-200"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 bg-stone-800 text-stone-300 rounded hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded font-semibold cursor-pointer"
                >
                  Publish Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
