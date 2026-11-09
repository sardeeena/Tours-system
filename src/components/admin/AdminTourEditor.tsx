import React, { useState, useEffect } from 'react';
import {
  Save,
  CheckCircle,
  Eye,
  ArrowLeft,
  AlertCircle,
  Plus,
  Trash2,
  MoveUp,
  MoveDown,
  Sparkles,
  HelpCircle,
  Compass,
  FileText,
  DollarSign,
  Calendar,
  Layers,
  MapPin,
  CheckSquare,
  XSquare,
  Globe,
  Settings as SettingsIcon,
  Car,
  Image as ImageIcon
} from 'lucide-react';
import {
  adminGetTourById,
  adminCreateTour,
  adminUpdateTour,
  getDestinations,
  getCategories,
  getPickupLocations,
  getTourExtras,
  getTourCustomExtraPrices,
  notifyCatalogueDataChanged
} from '../../services/tourService';
import {
  DbTour,
  DbDestination,
  DbCategory,
  DbPickupLocation,
  DbTourExtra,
  TourWithRelations
} from '../../types/database';
import { AdminMediaManager } from './AdminMediaManager';
import { AdminTab } from './AdminLayout';

interface AdminTourEditorProps {
  tourId?: string; // If undefined, we are creating a new tour
  onNavigateTab: (tab: AdminTab, param?: string) => void;
  onPreviewTour: (slug: string) => void;
}

type EditorTab =
  | 'general'
  | 'content'
  | 'pricing'
  | 'itinerary'
  | 'included'
  | 'excluded'
  | 'highlights'
  | 'faqs'
  | 'media'
  | 'pickup'
  | 'extras'
  | 'availability'
  | 'seo'
  | 'settings';

export const AdminTourEditor: React.FC<AdminTourEditorProps> = ({
  tourId,
  onNavigateTab,
  onPreviewTour,
}) => {
  const isEditing = Boolean(tourId);

  const [activeSubTab, setActiveSubTab] = useState<EditorTab>('general');
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Reference lookups from database
  const [destinations, setDestinations] = useState<DbDestination[]>([]);
  const [categories, setCategories] = useState<DbCategory[]>([]);
  const [pickupLocations, setPickupLocations] = useState<DbPickupLocation[]>([]);
  const [tourExtrasList, setTourExtrasList] = useState<DbTourExtra[]>([]);

  // Main Form State
  const [tourData, setTourData] = useState<Partial<DbTour>>({
    title: '',
    slug: '',
    short_description: '',
    description: '',
    destination_id: '',
    duration: 'Full Day (approx. 7 hours)',
    duration_type: 'Full Day',
    duration_hours: 7.0,
    tour_type: 'Shared',
    status: 'draft',
    featured: false,
    price: 35.0,
    child_price: 18.0,
    infant_price: 0.0,
    private_price: 250.0,
    currency: 'EUR',
    max_guests: 35,
    minimum_booking_notice_hours: 12,
    pickup_available: true,
    pickup_info: 'Complimentary lobby pickup and return across Hurghada included.',
    cancellation_policy: 'Free cancellation up to 24 hours before excursion start time.',
    departure_time: '08:30 AM',
    available_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    languages: ['English', 'German'],
    difficulty: 'Easy',
    age_restrictions: 'Suitable for all ages. Children under 2 join free.',
    badge: 'Popular',
    rating: 4.9,
    review_count: 24,
    sort_order: 1,
  });

  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [highlights, setHighlights] = useState<string[]>([]);
  const [inclusions, setInclusions] = useState<string[]>([]);
  const [exclusions, setExclusions] = useState<string[]>([]);
  const [itinerary, setItinerary] = useState<Array<{ time: string; title: string; description: string }>>([]);
  const [faqs, setFaqs] = useState<Array<{ question: string; answer: string }>>([]);
  const [images, setImages] = useState<any[]>([]);
  const [videos, setVideos] = useState<any[]>([]);
  const [selectedPickupIds, setSelectedPickupIds] = useState<string[]>([]);
  const [selectedExtraIds, setSelectedExtraIds] = useState<string[]>([]);
  const [extraPrices, setExtraPrices] = useState<Record<string, number>>({});

  // SEO Form State
  const [seo, setSeo] = useState({
    seo_title: '',
    meta_description: '',
    seo_keywords: [] as string[],
    canonical_url: '',
    og_title: '',
    og_description: '',
    og_image: '',
    robots_index: true,
    robots_follow: true,
  });
  const [newKeywordInput, setNewKeywordInput] = useState('');

  // Availability Form State
  const [availabilityMaxCapacity, setAvailabilityMaxCapacity] = useState(35);

  // Load existing tour if editing
  useEffect(() => {
    async function init() {
      try {
        const [dests, cats, pickups, extras] = await Promise.all([
          getDestinations(),
          getCategories(),
          getPickupLocations(),
          getTourExtras(),
        ]);
        setDestinations(dests);
        setCategories(cats);
        setPickupLocations(pickups);
        setTourExtrasList(extras);

        if (isEditing && tourId) {
          const fullTour = await adminGetTourById(tourId);
          if (fullTour) {
            setTourData(fullTour);
            setSelectedCategoryIds(fullTour.categories?.map((c) => c.id) || []);
            setHighlights(fullTour.highlights?.map((h) => h.item) || []);
            setInclusions(fullTour.inclusions?.map((i) => i.item) || []);
            setExclusions(fullTour.exclusions?.map((e) => e.item) || []);
            setItinerary(
              fullTour.itinerary?.map((it) => ({
                time: it.time,
                title: it.title,
                description: it.description || '',
              })) || []
            );
            setFaqs(
              fullTour.faqs?.map((f) => ({
                question: f.question,
                answer: f.answer,
              })) || []
            );
            setImages(fullTour.images || []);
            setVideos(fullTour.videos || []);
            setSelectedPickupIds(fullTour.pickup_locations?.map((p) => p.id) || []);
            setSelectedExtraIds(fullTour.extras?.map((e) => e.id) || []);
            const customPrices = getTourCustomExtraPrices(tourId);
            setExtraPrices(customPrices || {});
            if (fullTour.seo) {
              setSeo({
                seo_title: fullTour.seo.seo_title || '',
                meta_description: fullTour.seo.meta_description || '',
                seo_keywords: fullTour.seo.seo_keywords || [],
                canonical_url: fullTour.seo.canonical_url || '',
                og_title: fullTour.seo.og_title || '',
                og_description: fullTour.seo.og_description || '',
                og_image: fullTour.seo.og_image || '',
                robots_index: fullTour.seo.robots_index ?? true,
                robots_follow: fullTour.seo.robots_follow ?? true,
              });
            }
          }
        } else {
          // Defaults for new tour
          if (dests.length > 0) {
            setTourData((prev) => ({ ...prev, destination_id: dests[0].id }));
          }
          if (cats.length > 0) {
            setSelectedCategoryIds([cats[0].id]);
          }
          setHighlights([
            '2 hours on pristine beach with shaded loungers & shallow turquoise lagoon',
            'Two 45-minute guided snorkeling stops at vibrant offshore reefs',
            'Fresh open buffet lunch served onboard with soft drinks & bottled water',
            'Complimentary snorkeling equipment and flotation jackets provided',
            'Hotel lobby pickup and return transfer across Hurghada included',
          ]);
          setInclusions([
            'Hotel pickup and return transfer in air-conditioned vehicle',
            'Full-day boat cruise on passenger yacht with sun decks',
            'Snorkeling equipment (mask, snorkel, fins)',
            'Buffet lunch prepared fresh onboard',
            'Unlimited soft drinks, mineral water, tea & coffee',
          ]);
          setExclusions([
            'Personal expenses & souvenir shopping on island',
            'Underwater photography package (available as optional extra)',
            'Gratuities for yacht crew & dive masters',
          ]);
          setItinerary([
            { time: '08:00', title: 'Hotel pickup', description: 'Air-conditioned transfer from your resort lobby to Hurghada Marina.' },
            { time: '09:00', title: 'Departure from marina', description: 'Safety briefing and scenic sail across the Red Sea.' },
            { time: '10:00', title: 'First snorkeling stop', description: 'Guided reef snorkeling session observing parrotfish, rays, and corals.' },
            { time: '12:30', title: 'Lunch onboard', description: 'Warm buffet lunch with fish, chicken, rice, salads, and fruits.' },
            { time: '14:00', title: 'Island beach time', description: 'Disembark at beach for relaxation, photography, and shallow swimming.' },
            { time: '16:30', title: 'Return to marina', description: 'Leisurely cruise back as afternoon sun reflects on coastal mountains.' },
            { time: '17:00', title: 'Hotel drop-off', description: 'Return transfer back to your hotel lobby.' },
          ]);
          setFaqs([
            { question: 'Is snorkeling equipment provided or should I bring my own?', answer: 'Sanitized masks, snorkels, and fins in adult and child sizes are provided onboard free of charge.' },
            { question: 'Can non-swimmers participate safely?', answer: 'Yes! Coast Guard approved flotation vests are provided and certified dive masters accompany guests in the water.' },
          ]);
          setImages([
            {
              id: 'seed-img-1',
              image_url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
              alt_text: 'Orange Bay beach',
              is_primary: true,
              sort_order: 1,
            },
          ]);
        }
      } catch (err) {
        console.error('Failed to initialize editor data:', err);
      } finally {
        setLoading(false);
      }
    }

    init();
  }, [tourId, isEditing]);

  // Track edits
  const handleFieldChange = (field: keyof DbTour, val: any) => {
    setTourData((prev) => ({ ...prev, [field]: val }));
    setHasUnsavedChanges(true);

    // Auto-generate slug from title if user is creating a new tour and hasn't manually edited slug yet
    if (!isEditing && field === 'title') {
      const generatedSlug = String(val)
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-');
      setTourData((prev) => ({ ...prev, slug: generatedSlug }));
    }
  };

  // Save handler (draft or published)
  const handleSave = async (overrideStatus?: 'draft' | 'published') => {
    setSaving(true);
    setSaveError(null);
    setSaveSuccessMsg(null);

    try {
      const statusToSave = overrideStatus || tourData.status || 'draft';

      const payload = {
        tour: {
          ...tourData,
          status: statusToSave,
          price: Number(tourData.price) || 0,
          child_price: Number(tourData.child_price) || 0,
          infant_price: Number(tourData.infant_price) || 0,
          private_price: Number(tourData.private_price) || 0,
          duration_hours: Number(tourData.duration_hours) || 7,
          max_guests: Number(tourData.max_guests) || 35,
          minimum_booking_notice_hours: Number(tourData.minimum_booking_notice_hours) || 12,
        },
        categoryIds: selectedCategoryIds,
        highlights,
        inclusions,
        exclusions,
        itinerary,
        faqs,
        images,
        videos,
        pickupLocationIds: selectedPickupIds,
        extraIds: selectedExtraIds,
        extraPrices,
        seo: {
          ...seo,
          seo_title: seo.seo_title || tourData.title,
          meta_description: seo.meta_description || tourData.short_description,
        },
      };

      if (isEditing && tourId) {
        await adminUpdateTour(tourId, payload);
        setSaveSuccessMsg(`Tour successfully updated as ${statusToSave.toUpperCase()}.`);
      } else {
        const result = await adminCreateTour(payload);
        setSaveSuccessMsg(`New tour created successfully as ${statusToSave.toUpperCase()}.`);
        setTimeout(() => {
          onNavigateTab('tour_edit', result.id);
        }, 800);
      }

      setHasUnsavedChanges(false);
      setTourData((prev) => ({ ...prev, status: statusToSave }));
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save tour.');
    } finally {
      setSaving(false);
    }
  };

  // Keyword tags handling
  const addKeyword = () => {
    if (!newKeywordInput.trim()) return;
    const clean = newKeywordInput.trim().toLowerCase();
    if (!seo.seo_keywords.includes(clean)) {
      setSeo((prev) => ({ ...prev, seo_keywords: [...prev.seo_keywords, clean] }));
      setHasUnsavedChanges(true);
    }
    setNewKeywordInput('');
  };

  const removeKeyword = (kw: string) => {
    setSeo((prev) => ({
      ...prev,
      seo_keywords: prev.seo_keywords.filter((item) => item !== kw),
    }));
    setHasUnsavedChanges(true);
  };

  if (loading) {
    return (
      <div className="p-16 text-center text-xs text-stone-400 space-y-3">
        <div className="w-8 h-8 border-2 border-[#0A6C74] border-t-transparent rounded-full animate-spin mx-auto" />
        <p>Loading tour CMS details from Supabase...</p>
      </div>
    );
  }

  // Tabs navigation config
  const tabsList: Array<{ id: EditorTab; label: string; icon: any }> = [
    { id: 'general', label: 'General', icon: Compass },
    { id: 'content', label: 'Content', icon: FileText },
    { id: 'pricing', label: 'Pricing', icon: DollarSign },
    { id: 'itinerary', label: 'Itinerary', icon: Calendar },
    { id: 'included', label: 'Included', icon: CheckSquare },
    { id: 'excluded', label: 'Excluded', icon: XSquare },
    { id: 'highlights', label: 'Highlights', icon: Sparkles },
    { id: 'faqs', label: 'FAQs', icon: HelpCircle },
    { id: 'media', label: 'Media & Storage', icon: ImageIcon },
    { id: 'pickup', label: 'Pickup Points', icon: Car },
    { id: 'extras', label: 'Extras', icon: Sparkles },
    { id: 'availability', label: 'Availability', icon: Layers },
    { id: 'seo', label: 'SEO & Meta', icon: Globe },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header & Actions Bar */}
      <div className="bg-stone-950 p-4 rounded-lg border border-stone-800 flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 z-30 shadow-md">
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => onNavigateTab('tours')}
            className="p-2 bg-stone-900 hover:bg-stone-800 text-stone-300 hover:text-white rounded transition-colors"
            title="Back to All Tours"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-bold text-white tracking-tight">
                {isEditing ? `Edit: ${tourData.title || 'Untitled Tour'}` : 'Create New Tour'}
              </h2>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                  tourData.status === 'published'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}
              >
                {tourData.status}
              </span>
            </div>
            <p className="text-[11px] text-stone-400">
              {hasUnsavedChanges ? (
                <span className="text-amber-400 font-medium">● Unsaved modifications present</span>
              ) : (
                <span className="text-emerald-400 font-medium">✓ All changes synchronized</span>
              )}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2 shrink-0">
          {/* Live Preview Button */}
          {tourData.slug && (
            <button
              type="button"
              onClick={() => onPreviewTour(tourData.slug!)}
              className="flex items-center space-x-1.5 px-3 py-2 bg-stone-900 hover:bg-stone-800 text-stone-200 rounded text-xs font-semibold border border-stone-700 transition-colors"
              title="Preview on public site"
            >
              <Eye className="w-4 h-4" />
              <span>Preview</span>
            </button>
          )}

          {/* Save Draft */}
          <button
            type="button"
            onClick={() => handleSave('draft')}
            disabled={saving}
            className="px-3 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded text-xs font-semibold transition-colors disabled:opacity-50"
          >
            Save Draft
          </button>

          {/* Publish / Save Changes */}
          <button
            type="button"
            onClick={() => handleSave(tourData.status === 'published' ? 'published' : 'published')}
            disabled={saving}
            className="flex items-center space-x-1.5 px-4 py-2 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded text-xs font-semibold shadow transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : tourData.status === 'published' ? 'Save Changes' : 'Publish Tour'}</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {saveSuccessMsg && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-800 text-emerald-300 rounded text-xs flex items-center space-x-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {saveError && (
        <div className="p-3 bg-red-950/60 border border-red-800 text-red-300 rounded text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      {/* Tab Navigation Strip */}
      <div className="flex items-center space-x-1 border-b border-stone-800 overflow-x-auto pb-1 text-xs">
        {tabsList.map((tab) => {
          const Icon = tab.icon;
          const isCurrent = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSubTab(tab.id)}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-t-md font-medium whitespace-nowrap transition-colors ${
                isCurrent
                  ? 'bg-stone-950 text-[#2dd4bf] border-t-2 border-t-[#0A6C74] border-x border-stone-800 font-semibold'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900/60'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: GENERAL */}
      {activeSubTab === 'general' && (
        <div className="bg-stone-950 p-6 rounded-lg border border-stone-800 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-xs font-semibold text-stone-300 block mb-1">
                Tour Title <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={tourData.title || ''}
                onChange={(e) => handleFieldChange('title', e.target.value)}
                placeholder="e.g. Orange Bay Island & Snorkeling Cruise"
                className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded text-xs text-white focus:outline-none focus:border-[#0A6C74]"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-300 block mb-1">
                URL Slug <span className="text-red-400">*</span>
              </label>
              <div className="flex items-center">
                <span className="px-3 py-2 bg-stone-900 border border-r-0 border-stone-800 text-stone-500 text-xs rounded-l">
                  /excursions/
                </span>
                <input
                  type="text"
                  value={tourData.slug || ''}
                  onChange={(e) => handleFieldChange('slug', e.target.value)}
                  placeholder="orange-bay-island-snorkeling"
                  className="flex-1 px-3 py-2 bg-stone-900 border border-stone-800 rounded-r text-xs text-white focus:outline-none focus:border-[#0A6C74]"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-300 block mb-1">
                Destination Coastal Region
              </label>
              <select
                value={tourData.destination_id || ''}
                onChange={(e) => handleFieldChange('destination_id', e.target.value)}
                className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded text-xs text-white focus:outline-none focus:border-[#0A6C74]"
              >
                {destinations.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-300 block mb-1">
                Experience Type
              </label>
              <select
                value={tourData.tour_type || 'Shared'}
                onChange={(e) => handleFieldChange('tour_type', e.target.value as any)}
                className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded text-xs text-white focus:outline-none focus:border-[#0A6C74]"
              >
                <option value="Shared">Shared Group Excursion</option>
                <option value="Private">Private Exclusive Charter</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-300 block mb-1">
                Duration Display Label
              </label>
              <input
                type="text"
                value={tourData.duration || ''}
                onChange={(e) => handleFieldChange('duration', e.target.value)}
                placeholder="Full Day (approx. 7 hours)"
                className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded text-xs text-white focus:outline-none focus:border-[#0A6C74]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-stone-300 block mb-1">
                  Duration Category
                </label>
                <select
                  value={tourData.duration_type || 'Full Day'}
                  onChange={(e) => handleFieldChange('duration_type', e.target.value as any)}
                  className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded text-xs text-white focus:outline-none focus:border-[#0A6C74]"
                >
                  <option value="Half Day">Half Day</option>
                  <option value="Full Day">Full Day</option>
                  <option value="Multi Day">Multi Day</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-300 block mb-1">
                  Hours (Numeric)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={tourData.duration_hours || 7}
                  onChange={(e) => handleFieldChange('duration_hours', parseFloat(e.target.value))}
                  className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded text-xs text-white focus:outline-none focus:border-[#0A6C74]"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-300 block mb-1">
                Departure Time
              </label>
              <input
                type="text"
                value={tourData.departure_time || '08:30 AM'}
                onChange={(e) => handleFieldChange('departure_time', e.target.value)}
                placeholder="08:30 AM"
                className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded text-xs text-white focus:outline-none focus:border-[#0A6C74]"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-300 block mb-1">
                Marketing Badge (e.g. Popular, Deluxe, Top Pick)
              </label>
              <input
                type="text"
                value={tourData.badge || ''}
                onChange={(e) => handleFieldChange('badge', e.target.value)}
                placeholder="Popular"
                className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded text-xs text-white focus:outline-none focus:border-[#0A6C74]"
              />
            </div>
          </div>

          {/* Categories Selector */}
          <div className="pt-4 border-t border-stone-800">
            <label className="text-xs font-semibold text-stone-300 block mb-2">
              Assigned Categories (Multi-select)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {categories.map((cat) => {
                const checked = selectedCategoryIds.includes(cat.id);
                return (
                  <label
                    key={cat.id}
                    className={`flex items-center space-x-2 p-2 rounded border cursor-pointer text-xs transition-colors ${
                      checked
                        ? 'bg-[#0A6C74]/20 border-[#0A6C74] text-white'
                        : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedCategoryIds([...selectedCategoryIds, cat.id]);
                        } else {
                          setSelectedCategoryIds(selectedCategoryIds.filter((id) => id !== cat.id));
                        }
                        setHasUnsavedChanges(true);
                      }}
                      className="rounded text-[#0A6C74] focus:ring-0"
                    />
                    <span>{cat.name}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CONTENT */}
      {activeSubTab === 'content' && (
        <div className="bg-stone-950 p-6 rounded-lg border border-stone-800 space-y-6">
          <div>
            <label className="text-xs font-semibold text-stone-300 block mb-1">
              Short Description (Card Summary & Meta Fallback)
            </label>
            <textarea
              rows={3}
              value={tourData.short_description || ''}
              onChange={(e) => handleFieldChange('short_description', e.target.value)}
              placeholder="Provide a concise 2-sentence summary of this excursion..."
              className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded text-xs text-white focus:outline-none focus:border-[#0A6C74]"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-stone-300 block mb-1">
              Full Detailed Description
            </label>
            <textarea
              rows={8}
              value={tourData.description || ''}
              onChange={(e) => handleFieldChange('description', e.target.value)}
              placeholder="Describe the entire experience, maritime sights, coral gardens, and onboard amenities..."
              className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded text-xs text-white focus:outline-none focus:border-[#0A6C74]"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-stone-300 block mb-1">
                Hotel Pickup Information
              </label>
              <textarea
                rows={2}
                value={tourData.pickup_info || ''}
                onChange={(e) => handleFieldChange('pickup_info', e.target.value)}
                className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded text-xs text-white focus:outline-none focus:border-[#0A6C74]"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-300 block mb-1">
                Cancellation Policy Text
              </label>
              <textarea
                rows={2}
                value={tourData.cancellation_policy || ''}
                onChange={(e) => handleFieldChange('cancellation_policy', e.target.value)}
                className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded text-xs text-white focus:outline-none focus:border-[#0A6C74]"
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PRICING */}
      {activeSubTab === 'pricing' && (
        <div className="bg-stone-950 p-6 rounded-lg border border-stone-800 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-semibold text-stone-300 block mb-1">
                Adult Price (€) <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-stone-500 text-xs">€</span>
                <input
                  type="number"
                  step="1"
                  value={tourData.price ?? 35}
                  onChange={(e) => handleFieldChange('price', parseFloat(e.target.value))}
                  className="w-full pl-7 pr-3 py-2 bg-stone-900 border border-stone-800 rounded text-xs text-white focus:outline-none focus:border-[#0A6C74]"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-300 block mb-1">
                Child Price (€)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-stone-500 text-xs">€</span>
                <input
                  type="number"
                  step="1"
                  value={tourData.child_price ?? 18}
                  onChange={(e) => handleFieldChange('child_price', parseFloat(e.target.value))}
                  className="w-full pl-7 pr-3 py-2 bg-stone-900 border border-stone-800 rounded text-xs text-white focus:outline-none focus:border-[#0A6C74]"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-300 block mb-1">
                Infant Price (€)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-stone-500 text-xs">€</span>
                <input
                  type="number"
                  step="1"
                  value={tourData.infant_price ?? 0}
                  onChange={(e) => handleFieldChange('infant_price', parseFloat(e.target.value))}
                  className="w-full pl-7 pr-3 py-2 bg-stone-900 border border-stone-800 rounded text-xs text-white focus:outline-none focus:border-[#0A6C74]"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-300 block mb-1">
                Private Charter Base (€)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-stone-500 text-xs">€</span>
                <input
                  type="number"
                  step="10"
                  value={tourData.private_price ?? 250}
                  onChange={(e) => handleFieldChange('private_price', parseFloat(e.target.value))}
                  className="w-full pl-7 pr-3 py-2 bg-stone-900 border border-stone-800 rounded text-xs text-white focus:outline-none focus:border-[#0A6C74]"
                />
              </div>
            </div>
          </div>

          <div className="p-4 bg-stone-900/60 rounded border border-stone-800 text-xs text-stone-400">
            <h4 className="text-white font-semibold mb-1">Dynamic Currency Conversion</h4>
            <p>
              Prices in the database are stored in base <strong>EUR</strong>. The public booking engine automatically converts rates to USD, GBP, and EGP in real-time according to active currency selections.
            </p>
          </div>
        </div>
      )}

      {/* TAB 4: ITINERARY */}
      {activeSubTab === 'itinerary' && (
        <div className="bg-stone-950 p-6 rounded-lg border border-stone-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Daily Itinerary Timeline ({itinerary.length} stops)</h3>
              <p className="text-xs text-stone-400">Add, edit, delete, and reorder each milestone of the excursion.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setItinerary([
                  ...itinerary,
                  { time: '11:00', title: 'New Stop', description: 'Brief description of activity' },
                ]);
                setHasUnsavedChanges(true);
              }}
              className="flex items-center space-x-1 px-3 py-1.5 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Stop</span>
            </button>
          </div>

          <div className="space-y-3">
            {itinerary.map((item, idx) => (
              <div
                key={idx}
                className="p-3 bg-stone-900/60 border border-stone-800 rounded flex flex-col md:flex-row md:items-center gap-3 text-xs"
              >
                <div className="w-24 shrink-0">
                  <label className="text-[10px] text-stone-400 block uppercase font-semibold">Time</label>
                  <input
                    type="text"
                    value={item.time}
                    onChange={(e) => {
                      const updated = [...itinerary];
                      updated[idx].time = e.target.value;
                      setItinerary(updated);
                      setHasUnsavedChanges(true);
                    }}
                    className="w-full px-2 py-1 bg-stone-950 border border-stone-800 rounded text-xs text-white"
                  />
                </div>

                <div className="flex-1">
                  <label className="text-[10px] text-stone-400 block uppercase font-semibold">Title</label>
                  <input
                    type="text"
                    value={item.title}
                    onChange={(e) => {
                      const updated = [...itinerary];
                      updated[idx].title = e.target.value;
                      setItinerary(updated);
                      setHasUnsavedChanges(true);
                    }}
                    className="w-full px-2 py-1 bg-stone-950 border border-stone-800 rounded text-xs text-white"
                  />
                </div>

                <div className="flex-1">
                  <label className="text-[10px] text-stone-400 block uppercase font-semibold">Description</label>
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) => {
                      const updated = [...itinerary];
                      updated[idx].description = e.target.value;
                      setItinerary(updated);
                      setHasUnsavedChanges(true);
                    }}
                    className="w-full px-2 py-1 bg-stone-950 border border-stone-800 rounded text-xs text-white"
                  />
                </div>

                <div className="flex items-center space-x-1 shrink-0 pt-3 md:pt-0">
                  {idx > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const copy = [...itinerary];
                        const t = copy[idx];
                        copy[idx] = copy[idx - 1];
                        copy[idx - 1] = t;
                        setItinerary(copy);
                        setHasUnsavedChanges(true);
                      }}
                      className="p-1 text-stone-400 hover:text-white"
                    >
                      <MoveUp className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {idx < itinerary.length - 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const copy = [...itinerary];
                        const t = copy[idx];
                        copy[idx] = copy[idx + 1];
                        copy[idx + 1] = t;
                        setItinerary(copy);
                        setHasUnsavedChanges(true);
                      }}
                      className="p-1 text-stone-400 hover:text-white"
                    >
                      <MoveDown className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setItinerary(itinerary.filter((_, i) => i !== idx));
                      setHasUnsavedChanges(true);
                    }}
                    className="p-1 text-stone-400 hover:text-red-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: INCLUDED */}
      {activeSubTab === 'included' && (
        <div className="bg-stone-950 p-6 rounded-lg border border-stone-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">What's Included ({inclusions.length})</h3>
            <button
              type="button"
              onClick={() => {
                setInclusions([...inclusions, '']);
                setHasUnsavedChanges(true);
              }}
              className="flex items-center space-x-1 px-3 py-1.5 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Included Item</span>
            </button>
          </div>

          <div className="space-y-2">
            {inclusions.map((item, idx) => (
              <div key={idx} className="flex items-center space-x-2 text-xs">
                <input
                  type="text"
                  value={item}
                  onChange={(e) => {
                    const copy = [...inclusions];
                    copy[idx] = e.target.value;
                    setInclusions(copy);
                    setHasUnsavedChanges(true);
                  }}
                  className="flex-1 px-3 py-1.5 bg-stone-900 border border-stone-800 rounded text-xs text-white"
                />
                <button
                  type="button"
                  onClick={() => {
                    setInclusions(inclusions.filter((_, i) => i !== idx));
                    setHasUnsavedChanges(true);
                  }}
                  className="p-1.5 text-stone-400 hover:text-red-400"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 6: EXCLUDED */}
      {activeSubTab === 'excluded' && (
        <div className="bg-stone-950 p-6 rounded-lg border border-stone-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">What's Not Included ({exclusions.length})</h3>
            <button
              type="button"
              onClick={() => {
                setExclusions([...exclusions, '']);
                setHasUnsavedChanges(true);
              }}
              className="flex items-center space-x-1 px-3 py-1.5 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Excluded Item</span>
            </button>
          </div>

          <div className="space-y-2">
            {exclusions.map((item, idx) => (
              <div key={idx} className="flex items-center space-x-2 text-xs">
                <input
                  type="text"
                  value={item}
                  onChange={(e) => {
                    const copy = [...exclusions];
                    copy[idx] = e.target.value;
                    setExclusions(copy);
                    setHasUnsavedChanges(true);
                  }}
                  className="flex-1 px-3 py-1.5 bg-stone-900 border border-stone-800 rounded text-xs text-white"
                />
                <button
                  type="button"
                  onClick={() => {
                    setExclusions(exclusions.filter((_, i) => i !== idx));
                    setHasUnsavedChanges(true);
                  }}
                  className="p-1.5 text-stone-400 hover:text-red-400"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 7: HIGHLIGHTS */}
      {activeSubTab === 'highlights' && (
        <div className="bg-stone-950 p-6 rounded-lg border border-stone-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Tour Highlights ({highlights.length})</h3>
            <button
              type="button"
              onClick={() => {
                setHighlights([...highlights, '']);
                setHasUnsavedChanges(true);
              }}
              className="flex items-center space-x-1 px-3 py-1.5 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Highlight</span>
            </button>
          </div>

          <div className="space-y-2">
            {highlights.map((item, idx) => (
              <div key={idx} className="flex items-center space-x-2 text-xs">
                <input
                  type="text"
                  value={item}
                  onChange={(e) => {
                    const copy = [...highlights];
                    copy[idx] = e.target.value;
                    setHighlights(copy);
                    setHasUnsavedChanges(true);
                  }}
                  className="flex-1 px-3 py-1.5 bg-stone-900 border border-stone-800 rounded text-xs text-white"
                />
                <button
                  type="button"
                  onClick={() => {
                    setHighlights(highlights.filter((_, i) => i !== idx));
                    setHasUnsavedChanges(true);
                  }}
                  className="p-1.5 text-stone-400 hover:text-red-400"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 8: FAQS */}
      {activeSubTab === 'faqs' && (
        <div className="bg-stone-950 p-6 rounded-lg border border-stone-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Tour FAQs ({faqs.length})</h3>
            <button
              type="button"
              onClick={() => {
                setFaqs([...faqs, { question: '', answer: '' }]);
                setHasUnsavedChanges(true);
              }}
              className="flex items-center space-x-1 px-3 py-1.5 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add FAQ</span>
            </button>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, idx) => (
              <div key={idx} className="p-3 bg-stone-900/60 border border-stone-800 rounded space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <input
                    type="text"
                    value={faq.question}
                    onChange={(e) => {
                      const copy = [...faqs];
                      copy[idx].question = e.target.value;
                      setFaqs(copy);
                      setHasUnsavedChanges(true);
                    }}
                    placeholder="Question (e.g. Can non-swimmers participate?)"
                    className="flex-1 px-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-xs text-white font-semibold"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setFaqs(faqs.filter((_, i) => i !== idx));
                      setHasUnsavedChanges(true);
                    }}
                    className="ml-2 p-1.5 text-stone-400 hover:text-red-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <textarea
                  rows={2}
                  value={faq.answer}
                  onChange={(e) => {
                    const copy = [...faqs];
                    copy[idx].answer = e.target.value;
                    setFaqs(copy);
                    setHasUnsavedChanges(true);
                  }}
                  placeholder="Answer explanation..."
                  className="w-full px-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-xs text-stone-300"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 9: MEDIA & STORAGE */}
      {activeSubTab === 'media' && (
        <div className="bg-stone-950 p-6 rounded-lg border border-stone-800">
          <AdminMediaManager
            images={images}
            videos={videos}
            onImagesChange={(imgs) => {
              setImages(imgs);
              setHasUnsavedChanges(true);
            }}
            onVideosChange={(vids) => {
              setVideos(vids);
              setHasUnsavedChanges(true);
            }}
          />
        </div>
      )}

      {/* TAB 10: PICKUP POINTS */}
      {activeSubTab === 'pickup' && (
        <div className="bg-stone-950 p-6 rounded-lg border border-stone-800 space-y-4">
          <h3 className="text-sm font-bold text-white">Supported Pickup Locations & Transfer Fees</h3>
          <p className="text-xs text-stone-400">
            Pickups enabled for this excursion will appear in the customer multi-step booking wizard with their regional surcharges.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {pickupLocations.map((loc) => {
              const checked = selectedPickupIds.includes(loc.id);
              return (
                <label
                  key={loc.id}
                  className={`p-3 rounded border cursor-pointer text-xs transition-colors flex items-start space-x-3 ${
                    checked
                      ? 'bg-[#0A6C74]/20 border-[#0A6C74] text-white'
                      : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-stone-200'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedPickupIds([...selectedPickupIds, loc.id]);
                      } else {
                        setSelectedPickupIds(selectedPickupIds.filter((id) => id !== loc.id));
                      }
                      setHasUnsavedChanges(true);
                    }}
                    className="mt-0.5 rounded text-[#0A6C74] focus:ring-0"
                  />
                  <div>
                    <span className="font-semibold block text-stone-200">{loc.name}</span>
                    <span className="text-[11px] text-stone-400 block">{loc.area}</span>
                    <span className="text-[11px] text-[#2dd4bf] font-medium block mt-1">
                      {loc.fee_eur_per_person === 0 ? 'Complimentary Transfer' : `+€${loc.fee_eur_per_person}/guest`}
                    </span>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 11: EXTRAS */}
      {activeSubTab === 'extras' && (
        <div className="bg-stone-950 p-6 rounded-lg border border-stone-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-[#2dd4bf]" />
                <span>Assigned Optional Tour Extras & Tour-Specific Pricing</span>
              </h3>
              <p className="text-xs text-stone-400 mt-0.5">
                Enable extras for this excursion and customize individual prices specifically for this tour instead of default catalogue prices.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('extras')}
              className="text-xs text-[#2dd4bf] hover:underline self-start sm:self-auto font-medium cursor-pointer"
            >
              Manage Global Extras catalogue →
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
            {tourExtrasList.map((extra) => {
              const checked = selectedExtraIds.includes(extra.id);
              const customPrice = extraPrices[extra.id];
              const effectivePrice = customPrice !== undefined && customPrice !== null ? customPrice : extra.price_eur;
              const isOverridden = customPrice !== undefined && customPrice !== null && customPrice !== extra.price_eur;

              return (
                <div
                  key={extra.id}
                  className={`p-3.5 rounded-lg border text-xs transition-colors flex flex-col justify-between space-y-3 ${
                    checked
                      ? 'bg-[#0A6C74]/15 border-[#0A6C74] text-white shadow-xs'
                      : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-stone-300'
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <input
                      type="checkbox"
                      id={`extra-checkbox-${extra.id}`}
                      checked={checked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedExtraIds([...selectedExtraIds, extra.id]);
                        } else {
                          setSelectedExtraIds(selectedExtraIds.filter((id) => id !== extra.id));
                        }
                        setHasUnsavedChanges(true);
                      }}
                      className="mt-1 rounded text-[#0A6C74] focus:ring-0 cursor-pointer"
                    />
                    <label htmlFor={`extra-checkbox-${extra.id}`} className="flex-1 cursor-pointer select-none">
                      <span className="font-semibold block text-stone-200 text-xs sm:text-sm">{extra.name}</span>
                      <span className="text-[11px] text-stone-400 block mt-0.5 leading-relaxed">{extra.description}</span>
                      <div className="flex items-center space-x-2 mt-1.5 text-[10px] text-stone-400">
                        <span className="uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-stone-800 text-stone-300">
                          {extra.pricing_type.replace('_', ' ')}
                        </span>
                        <span>Catalogue standard: €{extra.price_eur}</span>
                      </div>
                    </label>
                  </div>

                  {/* Tour-Specific Price Override Input */}
                  {checked && (
                    <div className="pt-2.5 border-t border-stone-800/80 flex items-center justify-between gap-3 bg-stone-950/60 -mx-3.5 -mb-3.5 p-3 rounded-b-lg">
                      <div className="flex-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-1">
                          Price for this Tour (€)
                        </label>
                        <div className="flex items-center space-x-2">
                          <div className="relative flex-1">
                            <span className="absolute left-2.5 top-1.5 text-stone-500 font-bold">€</span>
                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              value={effectivePrice}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setExtraPrices((prev) => ({
                                  ...prev,
                                  [extra.id]: val,
                                }));
                                setHasUnsavedChanges(true);
                              }}
                              className="w-full pl-6 pr-3 py-1 bg-stone-900 border border-stone-700 rounded text-xs text-white font-bold focus:border-[#2dd4bf] focus:outline-hidden"
                            />
                          </div>
                          {isOverridden && (
                            <button
                              type="button"
                              onClick={() => {
                                const copy = { ...extraPrices };
                                delete copy[extra.id];
                                setExtraPrices(copy);
                                setHasUnsavedChanges(true);
                              }}
                              className="text-[10px] text-amber-400 hover:text-amber-300 underline shrink-0 cursor-pointer"
                              title="Reset to default catalogue price"
                            >
                              Reset
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[10px] text-stone-400 block">Applied at Booking:</span>
                        <span className="text-xs font-bold text-[#2dd4bf]">
                          €{effectivePrice} {extra.pricing_type === 'per_person' ? '/ guest' : 'flat'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 12: AVAILABILITY */}
      {activeSubTab === 'availability' && (
        <div className="bg-stone-950 p-6 rounded-lg border border-stone-800 space-y-6">
          <h3 className="text-sm font-bold text-white">Capacity & Operational Schedule</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-stone-300 block mb-1">
                Maximum Guest Capacity Per Departure
              </label>
              <input
                type="number"
                value={tourData.max_guests ?? 35}
                onChange={(e) => handleFieldChange('max_guests', parseInt(e.target.value) || 35)}
                className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded text-xs text-white"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-300 block mb-1">
                Minimum Booking Notice (Hours in advance)
              </label>
              <input
                type="number"
                value={tourData.minimum_booking_notice_hours ?? 12}
                onChange={(e) => handleFieldChange('minimum_booking_notice_hours', parseInt(e.target.value) || 12)}
                className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded text-xs text-white"
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 13: SEO & META */}
      {activeSubTab === 'seo' && (
        <div className="bg-stone-950 p-6 rounded-lg border border-stone-800 space-y-6">
          <div>
            <h3 className="text-sm font-bold text-white">Search Engine Optimization (SEO) & Social Graph</h3>
            <p className="text-xs text-stone-400">
              Customize title tags, meta descriptions, and keywords. Includes real-time character counters.
            </p>
          </div>

          {/* SEO Title with Counter */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-stone-300">
                SEO Title Tag
              </label>
              <span
                className={`text-[11px] font-mono ${
                  seo.seo_title.length > 60 ? 'text-amber-400' : 'text-stone-400'
                }`}
              >
                {seo.seo_title.length} / 60 characters
              </span>
            </div>
            <input
              type="text"
              value={seo.seo_title}
              onChange={(e) => {
                setSeo((prev) => ({ ...prev, seo_title: e.target.value }));
                setHasUnsavedChanges(true);
              }}
              placeholder={tourData.title ? `${tourData.title} | Red Sea Voyages` : 'SEO Title'}
              className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded text-xs text-white focus:outline-none focus:border-[#0A6C74]"
            />
          </div>

          {/* Meta Description with Counter */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-stone-300">
                Meta Description
              </label>
              <span
                className={`text-[11px] font-mono ${
                  seo.meta_description.length > 160 ? 'text-amber-400' : 'text-stone-400'
                }`}
              >
                {seo.meta_description.length} / 160 characters
              </span>
            </div>
            <textarea
              rows={3}
              value={seo.meta_description}
              onChange={(e) => {
                setSeo((prev) => ({ ...prev, meta_description: e.target.value }));
                setHasUnsavedChanges(true);
              }}
              placeholder="Concise summary for Google search result snippets..."
              className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded text-xs text-white focus:outline-none focus:border-[#0A6C74]"
            />
          </div>

          {/* SEO Keywords Tag Manager */}
          <div>
            <label className="text-xs font-semibold text-stone-300 block mb-1">
              SEO Keywords ({seo.seo_keywords.length})
            </label>
            <div className="flex items-center space-x-2 mb-2">
              <input
                type="text"
                value={newKeywordInput}
                onChange={(e) => setNewKeywordInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addKeyword();
                  }
                }}
                placeholder="Type keyword and press Add (e.g. orange bay tour)..."
                className="flex-1 px-3 py-1.5 bg-stone-900 border border-stone-800 rounded text-xs text-white"
              />
              <button
                type="button"
                onClick={addKeyword}
                className="px-3 py-1.5 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded text-xs font-semibold"
              >
                Add Keyword
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {seo.seo_keywords.map((kw) => (
                <span
                  key={kw}
                  className="px-2.5 py-1 bg-stone-900 border border-stone-800 text-stone-300 text-xs rounded-full flex items-center space-x-1.5"
                >
                  <span>{kw}</span>
                  <button
                    type="button"
                    onClick={() => removeKeyword(kw)}
                    className="hover:text-red-400 text-stone-500"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Canonical & OpenGraph */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-stone-800">
            <div>
              <label className="text-xs font-semibold text-stone-300 block mb-1">
                Canonical URL
              </label>
              <input
                type="text"
                value={seo.canonical_url}
                onChange={(e) => {
                  setSeo((prev) => ({ ...prev, canonical_url: e.target.value }));
                  setHasUnsavedChanges(true);
                }}
                placeholder="https://redseavoyages.com/excursions/..."
                className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded text-xs text-white"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-300 block mb-1">
                OpenGraph Social Share Image URL
              </label>
              <input
                type="text"
                value={seo.og_image}
                onChange={(e) => {
                  setSeo((prev) => ({ ...prev, og_image: e.target.value }));
                  setHasUnsavedChanges(true);
                }}
                placeholder="https://..."
                className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded text-xs text-white"
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 14: SETTINGS */}
      {activeSubTab === 'settings' && (
        <div className="bg-stone-950 p-6 rounded-lg border border-stone-800 space-y-6">
          <h3 className="text-sm font-bold text-white">Publishing & Catalog Settings</h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-stone-300 block mb-1">
                Publication Status
              </label>
              <select
                value={tourData.status || 'draft'}
                onChange={(e) => handleFieldChange('status', e.target.value as any)}
                className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded text-xs text-white focus:outline-none focus:border-[#0A6C74]"
              >
                <option value="draft">Draft (Private in CMS)</option>
                <option value="published">Published (Visible on Website)</option>
                <option value="archived">Archived (Delisted from Catalog)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-300 block mb-1">
                Featured Tour
              </label>
              <select
                value={tourData.featured ? 'true' : 'false'}
                onChange={(e) => handleFieldChange('featured', e.target.value === 'true')}
                className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded text-xs text-white focus:outline-none focus:border-[#0A6C74]"
              >
                <option value="false">Standard Tour</option>
                <option value="true">Featured on Homepage</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-300 block mb-1">
                Catalog Display Sort Order
              </label>
              <input
                type="number"
                value={tourData.sort_order ?? 1}
                onChange={(e) => handleFieldChange('sort_order', parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded text-xs text-white"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
