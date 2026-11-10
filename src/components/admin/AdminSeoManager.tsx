import React, { useState, useEffect } from 'react';
import {
  Globe,
  Save,
  CheckCircle2,
  AlertCircle,
  Search,
  ExternalLink,
  Code,
  Tag,
  Share2,
  Eye,
  RefreshCw,
  Compass,
  MapPin,
  Layers,
  FileText,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../services/supabaseClient';
import { adminListTours, getDestinations, getCategories } from '../../services/tourService';
import { DbTour, DbDestination, DbCategory } from '../../types/database';
import { useToast } from '../../contexts/ToastContext';

type SeoScopeType = 'homepage' | 'tours' | 'destinations' | 'categories' | 'pages';

interface StaticPageItem {
  id: string;
  name: string;
  path: string;
}

const STATIC_PAGES: StaticPageItem[] = [
  { id: 'about', name: 'About Us', path: '/about' },
  { id: 'why-us', name: 'Why Choose Red Sea Voyages', path: '/why-us' },
  { id: 'booking-conditions', name: 'Booking Conditions', path: '/booking-conditions' },
  { id: 'marine-safety', name: 'Marine Safety & Port Regulations', path: '/marine-safety' },
  { id: 'privacy', name: 'Privacy Policy', path: '/privacy' },
];

const LOCAL_SEO_PREFIX = 'rse_seo_cache_';

const getSeoEntityType = (scope: SeoScopeType): 'page' | 'tour' | 'destination' | 'category' => {
  if (scope === 'homepage' || scope === 'pages') return 'page';
  if (scope === 'tours') return 'tour';
  if (scope === 'destinations') return 'destination';
  return 'category';
};

const isPageSeoScope = (scope: SeoScopeType): boolean =>
  scope === 'homepage' || scope === 'pages';

export const AdminSeoManager: React.FC = () => {
  const { showToast } = useToast();
  const [scope, setScope] = useState<SeoScopeType>('homepage');

  // Loaded entities
  const [tours, setTours] = useState<DbTour[]>([]);
  const [destinations, setDestinations] = useState<DbDestination[]>([]);
  const [categories, setCategories] = useState<DbCategory[]>([]);

  // Selected Entity within scope
  const [selectedEntityId, setSelectedEntityId] = useState<string>('home');

  // Loading & Saving States
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Form Fields
  const [seoTitle, setSeoTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [canonicalUrl, setCanonicalUrl] = useState('');
  const [ogTitle, setOgTitle] = useState('');
  const [ogDescription, setOgDescription] = useState('');
  const [ogImage, setOgImage] = useState('');
  const [robotsIndex, setRobotsIndex] = useState(true);
  const [robotsFollow, setRobotsFollow] = useState(true);
  const [structuredDataJson, setStructuredDataJson] = useState('');
  const [structuredDataError, setStructuredDataError] = useState<string | null>(null);

  // Initial load
  useEffect(() => {
    async function loadEntities() {
      setLoading(true);
      try {
        const [loadedTours, loadedDests, loadedCats] = await Promise.all([
          adminListTours(),
          getDestinations(),
          getCategories(),
        ]);
        setTours(loadedTours);
        setDestinations(loadedDests);
        setCategories(loadedCats);

        // Load homepage defaults initially
        await loadEntitySeo('homepage', 'home', loadedTours, loadedDests, loadedCats);
      } catch (err) {
        console.error('Failed to load SEO entities:', err);
      } finally {
        setLoading(false);
      }
    }
    loadEntities();
  }, []);

  const loadEntitySeo = async (
    currentScope: SeoScopeType,
    entityId: string,
    currentTours = tours,
    currentDests = destinations,
    currentCats = categories
  ) => {
    // Generate default baseline
    let defaultTitle = 'Awesome Adventure Tours | Official Pier Desk';
    let defaultDesc = 'Awesome Adventure Tours - boat trips, island excursions, and desert safaris in Egypt. Free hotel pickup and 24h free cancellation.';
    let defaultCanonical = 'https://kemetspirit.com';
    let defaultOgImage = 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80';
    let defaultSchema: any = {
      '@context': 'https://schema.org',
      '@type': 'TravelAgency',
      name: 'Awesome Adventure Tours',
      url: 'https://kemetspirit.com',
      telephone: '+20 151 5212741',
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Hurghada',
        addressRegion: 'Red Sea Governorate',
        addressCountry: 'EG',
      },
    };

    if (currentScope === 'tours') {
      const tour = currentTours.find((t) => t.id === entityId || t.slug === entityId);
      if (tour) {
        defaultTitle = `${tour.title} | Awesome Adventure Tours`;
        defaultDesc = tour.short_description || tour.description?.slice(0, 155) || '';
        defaultCanonical = `https://kemetspirit.com/excursions/${tour.slug}`;
        defaultOgImage = (tour as any).primary_image || defaultOgImage;
        defaultSchema = {
          '@context': 'https://schema.org',
          '@type': 'TouristTrip',
          name: tour.title,
          description: tour.short_description,
          touristType: ['Family', 'Couples', 'Divers'],
          offers: {
            '@type': 'Offer',
            price: tour.price,
            priceCurrency: 'EUR',
            availability: 'https://schema.org/InStock',
          },
        };
      }
    } else if (currentScope === 'destinations') {
      const dest = currentDests.find((d) => d.id === entityId || d.slug === entityId);
      if (dest) {
        defaultTitle = `${dest.name} Excursions & Boat Trips | Red Sea Voyages`;
        defaultDesc = dest.description?.slice(0, 155) || `Discover premier boat trips, island cruises, and marine tours departing from ${dest.name}, Egypt.`;
        defaultCanonical = `https://kemetspirit.com/excursions?destination=${encodeURIComponent(dest.name)}`;
        defaultOgImage = dest.main_image || defaultOgImage;
        defaultSchema = {
          '@context': 'https://schema.org',
          '@type': 'TouristDestination',
          name: dest.name,
          description: dest.description,
        };
      }
    } else if (currentScope === 'categories') {
      const cat = currentCats.find((c) => c.id === entityId || c.slug === entityId);
      if (cat) {
        defaultTitle = `${cat.name} in Hurghada & Red Sea | Book Direct`;
        defaultDesc = cat.description?.slice(0, 155) || `Browse our official ${cat.name} trips across the Red Sea with verified captains and hotel transfers.`;
        defaultCanonical = `https://kemetspirit.com/excursions?category=${encodeURIComponent(cat.slug)}`;
        defaultOgImage = cat.image || defaultOgImage;
      }
    } else if (currentScope === 'pages') {
      const page = STATIC_PAGES.find((p) => p.id === entityId);
      if (page) {
        defaultTitle = `${page.name} | Red Sea Excursions & Voyages`;
        defaultDesc = `Official ${page.name} guidelines, maritime safety standards, and traveler support for Red Sea excursions.`;
        defaultCanonical = `https://kemetspirit.com${page.path}`;
      }
    }

    // Attempt to load from Supabase
    let loadedFromDb = false;
    if (isSupabaseConfigured()) {
      try {
        const entityType = getSeoEntityType(currentScope);
        let query = supabase
          .from('seo_metadata')
          .select('*')
          .eq('entity_type', entityType);

        query = isPageSeoScope(currentScope)
          ? query.eq('page_slug', entityId)
          : query.eq('entity_id', entityId);

        const { data, error } = await query.maybeSingle();

        if (!error && data) {
          setSeoTitle(data.seo_title || defaultTitle);
          setMetaDescription(data.meta_description || defaultDesc);
          setCanonicalUrl(data.canonical_url || defaultCanonical);
          setOgTitle(data.og_title || data.seo_title || defaultTitle);
          setOgDescription(data.og_description || data.meta_description || defaultDesc);
          setOgImage(data.og_image || defaultOgImage);
          setRobotsIndex(data.robots_index ?? true);
          setRobotsFollow(data.robots_follow ?? true);
          if (data.structured_data) {
            setStructuredDataJson(JSON.stringify(data.structured_data, null, 2));
          } else {
            setStructuredDataJson(JSON.stringify(defaultSchema, null, 2));
          }
          loadedFromDb = true;
        }
      } catch (err) {
        console.warn('Error reading seo_metadata from Supabase:', err);
      }
    }

    if (!loadedFromDb) {
      // Check local cache
      const cached = localStorage.getItem(`${LOCAL_SEO_PREFIX}${currentScope}_${entityId}`);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          setSeoTitle(parsed.seoTitle || defaultTitle);
          setMetaDescription(parsed.metaDescription || defaultDesc);
          setCanonicalUrl(parsed.canonicalUrl || defaultCanonical);
          setOgTitle(parsed.ogTitle || defaultTitle);
          setOgDescription(parsed.ogDescription || defaultDesc);
          setOgImage(parsed.ogImage || defaultOgImage);
          setRobotsIndex(parsed.robotsIndex ?? true);
          setRobotsFollow(parsed.robotsFollow ?? true);
          setStructuredDataJson(parsed.structuredDataJson || JSON.stringify(defaultSchema, null, 2));
          return;
        } catch {
          // ignore
        }
      }

      setSeoTitle(defaultTitle);
      setMetaDescription(defaultDesc);
      setCanonicalUrl(defaultCanonical);
      setOgTitle(defaultTitle);
      setOgDescription(defaultDesc);
      setOgImage(defaultOgImage);
      setRobotsIndex(true);
      setRobotsFollow(true);
      setStructuredDataJson(JSON.stringify(defaultSchema, null, 2));
    }
  };

  const handleScopeChange = (newScope: SeoScopeType) => {
    setScope(newScope);
    let newEntityId = 'home';
    if (newScope === 'tours' && tours.length > 0) newEntityId = tours[0].id;
    if (newScope === 'destinations' && destinations.length > 0) newEntityId = destinations[0].id;
    if (newScope === 'categories' && categories.length > 0) newEntityId = categories[0].id;
    if (newScope === 'pages' && STATIC_PAGES.length > 0) newEntityId = STATIC_PAGES[0].id;

    setSelectedEntityId(newEntityId);
    loadEntitySeo(newScope, newEntityId);
  };

  const handleEntityChange = (newEntityId: string) => {
    setSelectedEntityId(newEntityId);
    loadEntitySeo(scope, newEntityId);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    setStructuredDataError(null);

    let parsedSchema = null;
    if (structuredDataJson.trim()) {
      try {
        parsedSchema = JSON.parse(structuredDataJson);
      } catch (err: any) {
        setStructuredDataError('Invalid JSON in structured data field. Please correct syntax.');
        setSaving(false);
        return;
      }
    }

    const entityType = getSeoEntityType(scope);
    const isPageEntity = isPageSeoScope(scope);

    const payload = {
      entity_type: entityType,
      entity_id: isPageEntity ? null : selectedEntityId,
      page_slug: isPageEntity ? selectedEntityId : null,
      seo_title: seoTitle,
      meta_description: metaDescription,
      canonical_url: canonicalUrl,
      og_title: ogTitle || seoTitle,
      og_description: ogDescription || metaDescription,
      og_image: ogImage,
      robots_index: robotsIndex,
      robots_follow: robotsFollow,
      structured_data: parsedSchema,
      updated_at: new Date().toISOString(),
    };

    // Cache locally
    try {
      localStorage.setItem(
        `${LOCAL_SEO_PREFIX}${scope}_${selectedEntityId}`,
        JSON.stringify({
          seoTitle,
          metaDescription,
          canonicalUrl,
          ogTitle,
          ogDescription,
          ogImage,
          robotsIndex,
          robotsFollow,
          structuredDataJson,
        })
      );
    } catch {
      // ignore
    }

    if (isSupabaseConfigured()) {
      try {
        const conflictTarget = isPageEntity ? 'entity_type,page_slug' : 'entity_type,entity_id';
        const { error } = await supabase
          .from('seo_metadata')
          .upsert(payload, { onConflict: conflictTarget });
        if (error) throw error;
      } catch (err: any) {
        console.error('Supabase SEO save failed:', err);
        setSaving(false);
        showToast(err?.message || 'Could not save SEO metadata to the database.', 'error');
        return;
      }
    }

    setSaving(false);
    setSaveSuccess(true);
    showToast(
      isSupabaseConfigured()
        ? 'SEO & OpenGraph metadata saved to the database.'
        : 'SEO metadata saved in this browser only; it is not published to visitors.',
      isSupabaseConfigured() ? 'success' : 'info'
    );
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold font-display text-white tracking-tight flex items-center space-x-2">
          <Globe className="w-6 h-6 text-[#2dd4bf]" />
          <span>SEO, OpenGraph & Social Metadata</span>
        </h1>
        <p className="text-xs text-stone-400 mt-1">
          Manage Google search snippet titles, descriptions, canonical URLs, robots directives, and Schema.org rich results.
        </p>
      </div>

      {/* Scope Selector Bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-stone-800 pb-2 text-xs">
        <button
          type="button"
          onClick={() => handleScopeChange('homepage')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
            scope === 'homepage'
              ? 'bg-[#0A6C74] text-white'
              : 'text-stone-400 hover:text-white bg-stone-900 border border-stone-800'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          <span>Homepage</span>
        </button>

        <button
          type="button"
          onClick={() => handleScopeChange('tours')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
            scope === 'tours'
              ? 'bg-[#0A6C74] text-white'
              : 'text-stone-400 hover:text-white bg-stone-900 border border-stone-800'
          }`}
        >
          <Compass className="w-3.5 h-3.5" />
          <span>Tours ({tours.length})</span>
        </button>

        <button
          type="button"
          onClick={() => handleScopeChange('destinations')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
            scope === 'destinations'
              ? 'bg-[#0A6C74] text-white'
              : 'text-stone-400 hover:text-white bg-stone-900 border border-stone-800'
          }`}
        >
          <MapPin className="w-3.5 h-3.5" />
          <span>Destinations ({destinations.length})</span>
        </button>

        <button
          type="button"
          onClick={() => handleScopeChange('categories')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
            scope === 'categories'
              ? 'bg-[#0A6C74] text-white'
              : 'text-stone-400 hover:text-white bg-stone-900 border border-stone-800'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Categories ({categories.length})</span>
        </button>

        <button
          type="button"
          onClick={() => handleScopeChange('pages')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
            scope === 'pages'
              ? 'bg-[#0A6C74] text-white'
              : 'text-stone-400 hover:text-white bg-stone-900 border border-stone-800'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Static Pages ({STATIC_PAGES.length})</span>
        </button>
      </div>

      {/* Entity Selector (when not homepage) */}
      {scope !== 'homepage' && (
        <div className="bg-stone-950 border border-stone-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <label className="text-stone-300 font-semibold whitespace-nowrap">
            Select {scope === 'tours' ? 'Excursion' : scope === 'destinations' ? 'Destination' : scope === 'categories' ? 'Category' : 'Page'}:
          </label>
          <select
            value={selectedEntityId}
            onChange={(e) => handleEntityChange(e.target.value)}
            className="w-full sm:w-96 px-3 py-2 bg-stone-900 border border-stone-800 rounded text-white focus:outline-none focus:border-[#0A6C74]"
          >
            {scope === 'tours' &&
              tours.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} ({t.slug})
                </option>
              ))}
            {scope === 'destinations' &&
              destinations.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.slug})
                </option>
              ))}
            {scope === 'categories' &&
              categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.slug})
                </option>
              ))}
            {scope === 'pages' &&
              STATIC_PAGES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.path})
                </option>
              ))}
          </select>
        </div>
      )}

      {/* Main SEO Form */}
      <form onSubmit={handleSave} className="space-y-6">
        {/* Google Search Snippet Card */}
        <div className="bg-stone-950 border border-stone-800 rounded-xl p-5 space-y-4 text-xs">
          <div className="flex items-center justify-between border-b border-stone-800 pb-3">
            <h2 className="text-sm font-bold text-white tracking-wide flex items-center space-x-2">
              <Search className="w-4 h-4 text-[#2dd4bf]" />
              <span>Search Engine Optimization (Google SERP Snippet)</span>
            </h2>
            <span className="text-[11px] text-stone-500 font-mono">
              Live SERP Preview Available
            </span>
          </div>

          {/* Google Preview Simulator */}
          <div className="p-4 bg-stone-900/60 border border-stone-800 rounded-lg space-y-1">
            <span className="text-[10px] text-stone-500 uppercase tracking-widest font-bold block">
              Google Search Result Simulation
            </span>
            <div className="text-[11px] text-stone-400 font-mono truncate">
              {canonicalUrl || 'https://kemetspirit.com'}
            </div>
            <div className="text-base font-medium text-sky-400 hover:underline cursor-pointer truncate">
              {seoTitle || 'Awesome Adventure Tours'}
            </div>
            <p className="text-xs text-stone-300 line-clamp-2 leading-relaxed">
              {metaDescription || 'Book official Red Sea excursions with verified captains and free hotel pickup.'}
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-stone-300 font-semibold">SEO Meta Title *</label>
              <span
                className={`text-[10px] font-mono ${
                  seoTitle.length > 60 ? 'text-amber-400' : 'text-stone-400'
                }`}
              >
                {seoTitle.length} / 60 chars recommended
              </span>
            </div>
            <input
              type="text"
              required
              value={seoTitle}
              onChange={(e) => setSeoTitle(e.target.value)}
              className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded text-white focus:outline-none focus:border-[#0A6C74]"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-stone-300 font-semibold">Meta Description *</label>
              <span
                className={`text-[10px] font-mono ${
                  metaDescription.length > 160 ? 'text-amber-400' : 'text-stone-400'
                }`}
              >
                {metaDescription.length} / 160 chars recommended
              </span>
            </div>
            <textarea
              rows={3}
              required
              value={metaDescription}
              onChange={(e) => setMetaDescription(e.target.value)}
              className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded text-white focus:outline-none focus:border-[#0A6C74]"
            />
          </div>

          <div>
            <label className="block text-stone-300 font-semibold mb-1">Canonical URL</label>
            <input
              type="url"
              value={canonicalUrl}
              onChange={(e) => setCanonicalUrl(e.target.value)}
              className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded text-white font-mono text-xs focus:outline-none focus:border-[#0A6C74]"
            />
          </div>

          {/* Robots Directives */}
          <div className="pt-2 border-t border-stone-800/80 grid grid-cols-2 gap-4">
            <label className="inline-flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={robotsIndex}
                onChange={(e) => setRobotsIndex(e.target.checked)}
                className="rounded bg-stone-900 border-stone-800 text-[#0A6C74] focus:ring-0"
              />
              <span className="text-stone-300 font-medium">Index (Allow search engines)</span>
            </label>

            <label className="inline-flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={robotsFollow}
                onChange={(e) => setRobotsFollow(e.target.checked)}
                className="rounded bg-stone-900 border-stone-800 text-[#0A6C74] focus:ring-0"
              />
              <span className="text-stone-300 font-medium">Follow (Follow links on page)</span>
            </label>
          </div>
        </div>

        {/* OpenGraph & Social Cards */}
        <div className="bg-stone-950 border border-stone-800 rounded-xl p-5 space-y-4 text-xs">
          <h2 className="text-sm font-bold text-white tracking-wide border-b border-stone-800 pb-3 flex items-center space-x-2">
            <Share2 className="w-4 h-4 text-[#2dd4bf]" />
            <span>OpenGraph Social Share Card (WhatsApp, Facebook, Twitter/X)</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-stone-300 font-semibold mb-1">OG Share Title</label>
              <input
                type="text"
                value={ogTitle}
                onChange={(e) => setOgTitle(e.target.value)}
                placeholder="Leave blank to inherit SEO title"
                className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded text-white focus:outline-none focus:border-[#0A6C74]"
              />
            </div>

            <div>
              <label className="block text-stone-300 font-semibold mb-1">OG Image CDN URL</label>
              <input
                type="url"
                value={ogImage}
                onChange={(e) => setOgImage(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded text-white font-mono text-xs focus:outline-none focus:border-[#0A6C74]"
              />
            </div>
          </div>

          <div>
            <label className="block text-stone-300 font-semibold mb-1">OG Description</label>
            <textarea
              rows={2}
              value={ogDescription}
              onChange={(e) => setOgDescription(e.target.value)}
              placeholder="Leave blank to inherit Meta description"
              className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded text-white focus:outline-none focus:border-[#0A6C74]"
            />
          </div>

          {ogImage && (
            <div className="flex items-center space-x-3 p-3 bg-stone-900 rounded border border-stone-800">
              <img
                src={ogImage}
                alt="OG Preview"
                className="w-20 h-14 object-cover rounded shrink-0 border border-stone-700"
              />
              <div className="min-w-0">
                <span className="text-[10px] text-stone-400 font-bold uppercase block">
                  Image Preview
                </span>
                <span className="text-[11px] text-stone-200 truncate block font-mono">
                  {ogImage}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Schema.org Structured Data */}
        <div className="bg-stone-950 border border-stone-800 rounded-xl p-5 space-y-4 text-xs">
          <div className="flex items-center justify-between border-b border-stone-800 pb-3">
            <h2 className="text-sm font-bold text-white tracking-wide flex items-center space-x-2">
              <Code className="w-4 h-4 text-[#2dd4bf]" />
              <span>Schema.org JSON-LD Structured Data</span>
            </h2>
            <span className="text-[11px] text-stone-400">Rich Google Snippet Markup</span>
          </div>

          {structuredDataError && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-300 rounded text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{structuredDataError}</span>
            </div>
          )}

          <textarea
            rows={8}
            value={structuredDataJson}
            onChange={(e) => setStructuredDataJson(e.target.value)}
            className="w-full p-3 bg-stone-900 border border-stone-800 rounded font-mono text-xs text-emerald-300 leading-relaxed focus:outline-none focus:border-[#0A6C74]"
          />
        </div>

        {/* Save Bar */}
        <div className="flex items-center justify-between p-4 bg-stone-950 border border-stone-800 rounded-xl text-xs">
          <span className="text-stone-400">
            {saveSuccess ? (
              <span className="text-emerald-400 flex items-center space-x-1 font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                <span>SEO configurations synced successfully</span>
              </span>
            ) : (
              <span>Configures canonical tags, robots headers, and social previews</span>
            )}
          </span>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center space-x-1.5 px-5 py-2 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded font-semibold disabled:opacity-50 cursor-pointer shadow"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save SEO Metadata'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
