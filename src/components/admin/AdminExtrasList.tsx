import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Sparkles, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Compass, 
  AlertTriangle, 
  RotateCcw, 
  Tag, 
  DollarSign, 
  Check, 
  Image as ImageIcon,
  Upload,
  X,
  Eye,
  ArrowUp,
  ArrowDown,
  Layers,
  FolderOpen,
  HelpCircle,
  CheckCircle2,
  Filter,
  CheckSquare,
  Square
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { DbTourExtra, DbTour } from '../../types/database';
import { 
  adminListTourExtras, 
  adminListTours, 
  notifyCatalogueDataChanged, 
  formatSupabaseError,
  fetchTourCustomExtraPricesFromDb,
  persistTourCustomExtraPriceToDb
} from '../../services/tourService';
import { 
  uploadTourMedia, 
  validateMediaFile, 
  listStorageMedia, 
  StorageFileItem 
} from '../../services/storageService';
import { useToast } from '../../contexts/ToastContext';
import { AdminTab } from './AdminLayout';

interface AdminExtrasListProps {
  onNavigateTab?: (tab: AdminTab, param?: string) => void;
}

export const AdminExtrasList: React.FC<AdminExtrasListProps> = ({ onNavigateTab }) => {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Data states
  const [extras, setExtras] = useState<DbTourExtra[]>([]);
  const [tours, setTours] = useState<DbTour[]>([]);
  const [selectedTourId, setSelectedTourId] = useState<string>('all');
  const [tourCustomPrices, setTourCustomPrices] = useState<Record<string, number>>({});
  const [assignedToursMap, setAssignedToursMap] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);

  // Form / Modal states
  const [editingExtra, setEditingExtra] = useState<Partial<DbTourExtra> | null>(null);
  const [assignedTourIds, setAssignedTourIds] = useState<string[]>([]);
  const [assignedTourPrices, setAssignedTourPrices] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [extraToDelete, setExtraToDelete] = useState<DbTourExtra | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Image Upload & Media Library states
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [mediaAssets, setMediaAssets] = useState<StorageFileItem[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);

  // Filtering & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [filterPricingType, setFilterPricingType] = useState<string>('all');
  const [showPublicPreview, setShowPublicPreview] = useState(true);

  // Load all extras, tours, and assignments from database
  const loadData = async () => {
    setLoading(true);
    try {
      const [extrasData, toursData] = await Promise.all([
        adminListTourExtras(),
        adminListTours(),
      ]);
      setExtras(extrasData);
      setTours(toursData);

      // Load all tour assignments to compute assignment counts per extra
      if (isSupabaseConfigured()) {
        const { data: assignments } = await supabase
          .from('tour_assigned_extras')
          .select('tour_id, extra_id, custom_price_eur');
        if (assignments) {
          const mapping: Record<string, string[]> = {};
          assignments.forEach((r: any) => {
            if (!mapping[r.extra_id]) mapping[r.extra_id] = [];
            mapping[r.extra_id].push(r.tour_id);
          });
          setAssignedToursMap(mapping);
        }
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Failed to load tour extras from database', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // When a specific tour is selected, authoritatively load its custom extra prices from Supabase
  useEffect(() => {
    if (selectedTourId && selectedTourId !== 'all') {
      fetchTourCustomExtraPricesFromDb(selectedTourId).then((prices) => {
        setTourCustomPrices(prices);
      });
    } else {
      setTourCustomPrices({});
    }
  }, [selectedTourId]);

  // Open edit modal for an add-on
  const handleOpenEdit = async (extra: Partial<DbTourExtra> | null) => {
    if (!extra) {
      setEditingExtra(null);
      setAssignedTourIds([]);
      setAssignedTourPrices({});
      return;
    }

    setEditingExtra({
      currency: 'EUR',
      price_eur: 20,
      pricing_type: 'per_person',
      min_quantity: 1,
      max_quantity: 10,
      sort_order: extras.length + 1,
      is_active: true,
      ...extra,
    });

    if (extra.id && isSupabaseConfigured()) {
      try {
        const { data } = await supabase
          .from('tour_assigned_extras')
          .select('tour_id, custom_price_eur')
          .eq('extra_id', extra.id);
        if (data) {
          setAssignedTourIds(data.map((r: any) => r.tour_id));
          const prices: Record<string, number> = {};
          data.forEach((r: any) => {
            if (r.custom_price_eur !== null && r.custom_price_eur !== undefined) {
              prices[r.tour_id] = Number(r.custom_price_eur);
            }
          });
          setAssignedTourPrices(prices);
        } else {
          setAssignedTourIds([]);
          setAssignedTourPrices({});
        }
      } catch {
        setAssignedTourIds([]);
        setAssignedTourPrices({});
      }
    } else {
      // Default new extra to all published tours
      setAssignedTourIds(tours.map((t) => t.id));
      setAssignedTourPrices({});
    }
  };

  // Toggle active/inactive status inline from the table
  const handleToggleActiveInline = async (extra: DbTourExtra) => {
    const updatedStatus = !extra.is_active;
    // Optimistic UI update
    setExtras(extras.map((e) => (e.id === extra.id ? { ...e, is_active: updatedStatus } : e)));

    if (isSupabaseConfigured() && !extra.id.startsWith('extra-')) {
      try {
        const { error } = await supabase
          .from('tour_extras')
          .update({ is_active: updatedStatus, updated_at: new Date().toISOString() })
          .eq('id', extra.id);
        if (error) throw error;
        notifyCatalogueDataChanged('extras');
        showToast(`"${extra.name}" is now ${updatedStatus ? 'Active' : 'Inactive'}.`, 'success');
      } catch (err: any) {
        // Rollback
        setExtras(extras.map((e) => (e.id === extra.id ? { ...e, is_active: !updatedStatus } : e)));
        showToast(formatSupabaseError(err), 'error');
      }
    } else {
      notifyCatalogueDataChanged('extras');
      showToast(`"${extra.name}" is now ${updatedStatus ? 'Active' : 'Inactive'} (local).`, 'info');
    }
  };

  // Reorder extra (sort_order)
  const handleMoveSortOrder = async (extra: DbTourExtra, direction: 'up' | 'down') => {
    const currentIndex = extras.findIndex((e) => e.id === extra.id);
    if (currentIndex === -1) return;
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= extras.length) return;

    const targetExtra = extras[targetIndex];
    const newExtras = [...extras];
    // Swap sort orders
    const currentSort = extra.sort_order;
    const targetSort = targetExtra.sort_order;

    newExtras[currentIndex] = { ...extra, sort_order: targetSort };
    newExtras[targetIndex] = { ...targetExtra, sort_order: currentSort };
    newExtras.sort((a, b) => a.sort_order - b.sort_order);
    setExtras(newExtras);

    if (isSupabaseConfigured()) {
      try {
        await Promise.all([
          supabase.from('tour_extras').update({ sort_order: targetSort }).eq('id', extra.id),
          supabase.from('tour_extras').update({ sort_order: currentSort }).eq('id', targetExtra.id),
        ]);
        notifyCatalogueDataChanged('extras');
      } catch (err) {
        console.warn('Failed to persist reorder in Supabase:', err);
      }
    }
  };

  // Tour custom price update (persisted directly to Supabase tour_assigned_extras)
  const handleUpdateTourPrice = async (extraId: string, newPrice: number) => {
    if (selectedTourId === 'all') return;
    const updated = { ...tourCustomPrices, [extraId]: newPrice };
    setTourCustomPrices(updated);

    const res = await persistTourCustomExtraPriceToDb(selectedTourId, extraId, newPrice);
    if (res.success) {
      showToast(`Custom price set for excursion: €${newPrice.toFixed(2)}`, 'success');
    } else {
      showToast(res.error || 'Failed to save custom price', 'error');
    }
  };

  // Reset custom price to catalogue default
  const handleResetTourPrice = async (extraId: string) => {
    if (selectedTourId === 'all') return;
    const updated = { ...tourCustomPrices };
    delete updated[extraId];
    setTourCustomPrices(updated);

    const res = await persistTourCustomExtraPriceToDb(selectedTourId, extraId, null);
    if (res.success) {
      showToast('Reset to catalogue default price.', 'info');
    } else {
      showToast(res.error || 'Failed to reset custom price', 'error');
    }
  };

  // Handle image upload from device
  const handleImageFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingExtra) return;

    const validation = validateMediaFile(file, 'image');
    if (!validation.valid) {
      showToast(validation.error || 'Invalid image file.', 'error');
      return;
    }

    setIsUploadingImage(true);
    try {
      const res = await uploadTourMedia(file, 'extras', {
        title: editingExtra.name || 'Tour Add-on',
      });
      if (res.error) {
        throw new Error(res.error);
      }
      setEditingExtra((prev) => prev ? ({ ...prev, image_url: res.url }) : null);
      showToast('Image uploaded and optimized successfully.', 'success');
    } catch (err: any) {
      console.error('Image upload failed:', err);
      showToast(err.message || 'Image upload failed. You may still save the add-on or provide an image URL.', 'error');
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Open Media Library picker
  const handleOpenMediaPicker = async () => {
    setShowMediaPicker(true);
    setLoadingMedia(true);
    try {
      const [extrasFolder, toursFolder] = await Promise.all([
        listStorageMedia('extras'),
        listStorageMedia('tours'),
      ]);
      const combined = [...extrasFolder, ...toursFolder.filter((t) => !extrasFolder.some((e) => e.url === t.url))];
      setMediaAssets(combined);
    } catch (err) {
      console.warn('Failed to load media assets:', err);
    } finally {
      setLoadingMedia(false);
    }
  };

  // Save add-on (Create or Update)
  const handleSave = async () => {
    if (!editingExtra || !editingExtra.name?.trim()) {
      showToast('Please provide a name for the add-on.', 'error');
      return;
    }

    setSaving(true);
    const priceEur = Math.max(0, Number(editingExtra.price_eur) || 0);
    const pricingType = editingExtra.pricing_type || 'per_booking';
    const currency = editingExtra.currency || 'EUR';
    const minQty = Math.max(1, Number(editingExtra.min_quantity) || 1);
    const maxQty = Math.max(minQty, Number(editingExtra.max_quantity) || 10);
    const sortOrder = Number(editingExtra.sort_order) || (extras.length + 1);
    const isActive = editingExtra.is_active ?? true;

    if (!isSupabaseConfigured()) {
      let savedId = editingExtra.id;
      if (editingExtra.id) {
        setExtras(extras.map((e) => (e.id === editingExtra.id ? ({ ...e, ...editingExtra, price_eur: priceEur, pricing_type: pricingType } as DbTourExtra) : e)));
      } else {
        savedId = `extra-${Date.now()}`;
        const newE: DbTourExtra = {
          id: savedId,
          name: editingExtra.name.trim(),
          description: editingExtra.description || '',
          price_eur: priceEur,
          currency,
          pricing_type: pricingType,
          is_active: isActive,
          sort_order: sortOrder,
          image_url: editingExtra.image_url || undefined,
          min_quantity: minQty,
          max_quantity: maxQty,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setExtras([...extras, newE]);
      }
      setSaving(false);
      setEditingExtra(null);
      notifyCatalogueDataChanged('extras');
      showToast('Add-on saved successfully (local state).', 'success');
      return;
    }

    try {
      let savedExtraId = editingExtra.id;

      if (editingExtra.id && !editingExtra.id.startsWith('extra-')) {
        const { error: updateErr } = await supabase
          .from('tour_extras')
          .update({
            name: editingExtra.name.trim(),
            description: editingExtra.description?.trim() || null,
            price_eur: priceEur,
            pricing_type: pricingType,
            currency,
            is_active: isActive,
            sort_order: sortOrder,
            image_url: editingExtra.image_url?.trim() || null,
            min_quantity: minQty,
            max_quantity: maxQty,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingExtra.id);
        if (updateErr) throw updateErr;
      } else {
        const { data: inserted, error: insertErr } = await supabase
          .from('tour_extras')
          .insert({
            name: editingExtra.name.trim(),
            description: editingExtra.description?.trim() || null,
            price_eur: priceEur,
            pricing_type: pricingType,
            currency,
            is_active: isActive,
            sort_order: sortOrder,
            image_url: editingExtra.image_url?.trim() || null,
            min_quantity: minQty,
            max_quantity: maxQty,
          })
          .select('id')
          .single();

        if (insertErr) throw insertErr;
        savedExtraId = inserted?.id;
      }

      // Authoritative atomic tour assignments persistence in tour_assigned_extras
      if (savedExtraId) {
        const payload = assignedTourIds.map((tid) => ({
          tour_id: tid,
          custom_price_eur: assignedTourPrices[tid] !== undefined && assignedTourPrices[tid] !== null ? Number(assignedTourPrices[tid]) : null,
          is_active: true,
        }));

        const { error: rpcErr } = await supabase.rpc('replace_extra_tour_assignments_atomic', {
          p_extra_id: savedExtraId,
          p_assignments: payload,
        });

        if (rpcErr) {
          console.error('replace_extra_tour_assignments_atomic RPC error:', rpcErr);
          throw new Error(`Failed to update excursion assignments atomically: ${rpcErr.message || 'Database error'}. Existing assignments have been preserved.`);
        }
      }

      await loadData();
      showToast(`Add-on "${editingExtra.name}" saved with ${assignedTourIds.length} excursion assignment(s).`, 'success');
      setEditingExtra(null);
      notifyCatalogueDataChanged('extras');
    } catch (err: any) {
      showToast(formatSupabaseError(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  // Delete add-on confirmation
  const confirmDeleteExtra = async () => {
    if (!extraToDelete) return;
    setIsDeleting(true);

    if (!isSupabaseConfigured()) {
      setExtras(extras.filter((e) => e.id !== extraToDelete.id));
      showToast(`Add-on "${extraToDelete.name}" removed from local state.`, 'info');
      setExtraToDelete(null);
      setIsDeleting(false);
      notifyCatalogueDataChanged('extras');
      return;
    }

    try {
      await supabase.from('tour_assigned_extras').delete().eq('extra_id', extraToDelete.id);
      const { error } = await supabase.from('tour_extras').delete().eq('id', extraToDelete.id);
      if (error) throw error;
      showToast(`Add-on "${extraToDelete.name}" deleted successfully.`, 'success');
      await loadData();
      setExtraToDelete(null);
      notifyCatalogueDataChanged('extras');
    } catch (err: any) {
      showToast(formatSupabaseError(err), 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered extras for display
  const filteredExtras = useMemo(() => {
    return extras.filter((extra) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || extra.name.toLowerCase().includes(q) || (extra.description || '').toLowerCase().includes(q);
      const matchesStatus = filterStatus === 'all' || (filterStatus === 'active' ? extra.is_active : !extra.is_active);
      const matchesPricing = filterPricingType === 'all' || extra.pricing_type === filterPricingType;

      if (selectedTourId !== 'all') {
        const assignedTours = assignedToursMap[extra.id] || [];
        const isAssigned = assignedTours.includes(selectedTourId);
        return matchesSearch && matchesStatus && matchesPricing && isAssigned;
      }

      return matchesSearch && matchesStatus && matchesPricing;
    });
  }, [extras, searchQuery, filterStatus, filterPricingType, selectedTourId, assignedToursMap]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-stone-900 border border-stone-800 rounded-lg p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center">
            <Sparkles className="w-4 h-4 mr-2 text-[#0A6C74]" />
            Dynamic Tour Extras & Add-on Management
          </h2>
          <p className="text-xs text-stone-400 mt-1">
            Manage excursion add-ons, pricing models (per guest, per vehicle, per item, flat), media images, and tour assignments.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => handleOpenEdit({
              name: '',
              description: '',
              price_eur: 25,
              pricing_type: 'per_person',
              currency: 'EUR',
              min_quantity: 1,
              max_quantity: 10,
              is_active: true,
            })}
            className="px-3.5 py-2 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded font-semibold text-xs flex items-center space-x-1.5 transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Add-on</span>
          </button>
        </div>
      </div>

      {/* Excursion Context Selector */}
      <div className="bg-stone-900/60 border border-stone-800/80 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-2">
          <Compass className="w-4 h-4 text-[#0A6C74]" />
          <span className="font-semibold text-stone-200">Excursion Price Customization Mode:</span>
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <select
            value={selectedTourId}
            onChange={(e) => setSelectedTourId(e.target.value)}
            className="w-full sm:w-72 px-3 py-1.5 bg-stone-950 border border-stone-700 rounded text-stone-200 text-xs focus:outline-none focus:ring-1 focus:ring-[#0A6C74]"
          >
            <option value="all">Global Catalogue Defaults (All Excursions)</option>
            {tours.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-stone-900 border border-stone-800 rounded-lg overflow-hidden shadow-xs">
        {/* Filters and Search Bar */}
        <div className="p-4 border-b border-stone-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              {selectedTourId === 'all'
                ? `Global Catalogue Add-ons (${filteredExtras.length})`
                : `Excursion Assigned Add-ons (${filteredExtras.length})`}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filter by Active Status */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="px-2.5 py-1.5 bg-stone-950 border border-stone-800 rounded text-xs text-stone-300 focus:outline-none focus:ring-1 focus:ring-[#0A6C74]"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>

            {/* Filter by Pricing Method */}
            <select
              value={filterPricingType}
              onChange={(e) => setFilterPricingType(e.target.value)}
              className="px-2.5 py-1.5 bg-stone-950 border border-stone-800 rounded text-xs text-stone-300 focus:outline-none focus:ring-1 focus:ring-[#0A6C74]"
            >
              <option value="all">All Pricing Models</option>
              <option value="per_person">Per Guest / Person</option>
              <option value="per_vehicle">Per Vehicle</option>
              <option value="per_item">Per Item</option>
              <option value="per_booking">Flat Per Booking</option>
              <option value="per_adult">Per Adult</option>
              <option value="per_child">Per Child</option>
            </select>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-stone-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search title, description..."
                className="pl-8 pr-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-xs text-white placeholder-stone-500 focus:outline-none focus:ring-1 focus:ring-[#0A6C74] w-48 sm:w-56"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-stone-400">Loading tour extras from database...</div>
        ) : filteredExtras.length === 0 ? (
          <div className="p-8 text-center text-xs text-stone-500">
            {searchQuery || filterStatus !== 'all' || filterPricingType !== 'all'
              ? 'No add-ons match the specified filter criteria.'
              : selectedTourId !== 'all'
              ? 'No add-ons currently assigned to this excursion. Click "Global Catalogue" to assign.'
              : 'No tour extras available.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-stone-300">
              <thead className="bg-stone-950/60 text-[11px] uppercase tracking-wider text-stone-400 border-b border-stone-800">
                <tr>
                  <th className="p-3.5 w-12 text-center">Order</th>
                  <th className="p-3.5">Image & Add-on Details</th>
                  <th className="p-3.5">Pricing Method</th>
                  <th className="p-3.5">Catalogue Price</th>
                  {selectedTourId !== 'all' ? (
                    <>
                      <th className="p-3.5">Excursion Custom Price</th>
                      <th className="p-3.5 text-right">Reset Default</th>
                    </>
                  ) : (
                    <>
                      <th className="p-3.5">Assigned Tours</th>
                      <th className="p-3.5 text-center">Status</th>
                      <th className="p-3.5 text-right">Actions</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800/60">
                {filteredExtras.map((extra, index) => {
                  const customPrice = tourCustomPrices[extra.id];
                  const hasCustom = customPrice !== undefined && customPrice !== null && !isNaN(customPrice);
                  const effectivePrice = hasCustom ? customPrice : extra.price_eur;
                  const assignedTours = assignedToursMap[extra.id] || [];

                  return (
                    <tr key={extra.id} className="hover:bg-stone-900/40 transition-colors">
                      {/* Sort Order Controls */}
                      <td className="p-3.5 text-center">
                        <div className="flex flex-col items-center justify-center space-y-0.5">
                          <button
                            type="button"
                            onClick={() => handleMoveSortOrder(extra, 'up')}
                            disabled={index === 0}
                            className="p-0.5 text-stone-500 hover:text-white disabled:opacity-20 cursor-pointer"
                            title="Move up in display order"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <span className="font-mono text-[10px] text-stone-400">{extra.sort_order ?? index + 1}</span>
                          <button
                            type="button"
                            onClick={() => handleMoveSortOrder(extra, 'down')}
                            disabled={index === filteredExtras.length - 1}
                            className="p-0.5 text-stone-500 hover:text-white disabled:opacity-20 cursor-pointer"
                            title="Move down in display order"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                        </div>
                      </td>

                      {/* Image Thumbnail & Details */}
                      <td className="p-3.5 max-w-sm">
                        <div className="flex items-start space-x-3">
                          <div className="w-12 h-12 rounded bg-stone-950 border border-stone-800 shrink-0 overflow-hidden flex items-center justify-center">
                            {extra.image_url ? (
                              <img
                                src={extra.image_url}
                                alt={extra.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?auto=format&fit=crop&w=200&q=70';
                                }}
                              />
                            ) : (
                              <ImageIcon className="w-5 h-5 text-stone-600" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-semibold text-white">{extra.name}</span>
                            </div>
                            <span className="text-stone-400 text-[11px] line-clamp-1 block mt-0.5">
                              {extra.description || '—'}
                            </span>
                            <div className="flex items-center space-x-2 mt-1 text-[10px] text-stone-500">
                              <span>Qty: {extra.min_quantity || 1}–{extra.max_quantity || 10}</span>
                              <span>•</span>
                              <span>{extra.currency || 'EUR'}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Pricing Method Badge */}
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-stone-800 text-stone-300">
                          {extra.pricing_type === 'per_person' ? 'Per Guest' :
                           extra.pricing_type === 'per_vehicle' ? 'Per Vehicle' :
                           extra.pricing_type === 'per_item' ? 'Per Item' :
                           extra.pricing_type === 'per_adult' ? 'Per Adult' :
                           extra.pricing_type === 'per_child' ? 'Per Child' : 'Flat Per Booking'}
                        </span>
                      </td>

                      {/* Catalogue Default Price */}
                      <td className="p-3.5 font-mono font-semibold text-stone-200">
                        €{extra.price_eur.toFixed(2)}
                      </td>

                      {selectedTourId === 'all' ? (
                        <>
                          {/* Tour Assignment Count */}
                          <td className="p-3.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(extra)}
                              className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-stone-950 border border-stone-800 text-stone-300 hover:border-[#0A6C74] hover:text-white transition-colors cursor-pointer"
                              title="Click to view or edit tour assignments"
                            >
                              <Layers className="w-3 h-3 text-[#0A6C74]" />
                              <span>{assignedTours.length} excursion(s)</span>
                            </button>
                          </td>

                          {/* Active Status Inline Toggle */}
                          <td className="p-3.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleActiveInline(extra)}
                              className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider border cursor-pointer transition-colors ${
                                extra.is_active
                                  ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300 hover:bg-emerald-900/60'
                                  : 'bg-stone-950 border-stone-800 text-stone-500 hover:text-stone-300'
                              }`}
                              title="Click to toggle active state in catalogue"
                            >
                              {extra.is_active ? 'Active' : 'Inactive'}
                            </button>
                          </td>

                          {/* Action Buttons */}
                          <td className="p-3.5 text-right space-x-1.5 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(extra)}
                              className="px-2.5 py-1 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded text-xs transition-colors cursor-pointer"
                              title="Edit add-on details, pricing, and excursion assignments"
                            >
                              <Edit className="w-3.5 h-3.5 inline mr-1" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setExtraToDelete(extra)}
                              className="px-2 py-1 bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-900/60 rounded text-xs transition-colors cursor-pointer"
                              title="Delete add-on from catalogue"
                            >
                              <Trash2 className="w-3.5 h-3.5 inline" />
                            </button>
                          </td>
                        </>
                      ) : (
                        <>
                          {/* Tour Custom Price Input */}
                          <td className="p-3.5">
                            <div className="flex items-center space-x-2">
                              <span className="text-stone-400 text-xs">€</span>
                              <input
                                type="number"
                                step="1"
                                min="0"
                                value={effectivePrice}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  if (!isNaN(val) && val >= 0) {
                                    handleUpdateTourPrice(extra.id, val);
                                  }
                                }}
                                className={`w-20 px-2 py-1 rounded text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-[#0A6C74] ${
                                  hasCustom
                                    ? 'bg-[#0A6C74]/20 border border-[#0A6C74] text-white'
                                    : 'bg-stone-950 border border-stone-800 text-stone-300'
                                }`}
                              />
                              {hasCustom && (
                                <span className="text-[10px] text-emerald-400 uppercase font-bold tracking-wider">
                                  Custom
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Reset to Default Price */}
                          <td className="p-3.5 text-right">
                            {hasCustom && (
                              <button
                                type="button"
                                onClick={() => handleResetTourPrice(extra.id)}
                                className="px-2 py-1 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded text-xs transition-colors flex items-center space-x-1 ml-auto cursor-pointer"
                                title="Reset to standard catalogue default price"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>Reset Default</span>
                              </button>
                            )}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Add-on Modal with Live Public Preview & Device Upload */}
      {editingExtra && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-stone-900 border border-stone-800 rounded-lg max-w-2xl w-full p-6 space-y-4 shadow-xl text-xs my-8">
            <div className="flex items-center justify-between pb-2 border-b border-stone-800">
              <h3 className="text-base font-bold text-white flex items-center">
                <Sparkles className="w-4 h-4 mr-2 text-[#0A6C74]" />
                {editingExtra.id ? 'Edit Add-on & Excursion Assignments' : 'Create Dynamic Tour Add-on'}
              </h3>
              <button
                type="button"
                onClick={() => setEditingExtra(null)}
                className="text-stone-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              {/* Add-on Name */}
              <div>
                <label className="text-stone-300 block mb-1 font-semibold">Add-on Title *</label>
                <input
                  type="text"
                  value={editingExtra.name || ''}
                  onChange={(e) => setEditingExtra({ ...editingExtra, name: e.target.value })}
                  placeholder="e.g. Single Quad Bike, Dune Buggy Safari, VIP Van Transfer"
                  className="w-full px-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-white focus:outline-none focus:ring-1 focus:ring-[#0A6C74]"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-stone-300 block mb-1 font-semibold">Description</label>
                <textarea
                  rows={2}
                  value={editingExtra.description || ''}
                  onChange={(e) => setEditingExtra({ ...editingExtra, description: e.target.value })}
                  placeholder="Gear included, safety instructions, duration, passenger restrictions..."
                  className="w-full px-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-white focus:outline-none focus:ring-1 focus:ring-[#0A6C74]"
                />
              </div>

              {/* Image Upload & Management Section */}
              <div className="p-3 bg-stone-950 border border-stone-800 rounded space-y-2">
                <label className="text-stone-300 block font-semibold flex items-center justify-between">
                  <span>Add-on Image (Supabase Storage)</span>
                  {editingExtra.image_url && (
                    <button
                      type="button"
                      onClick={() => setEditingExtra({ ...editingExtra, image_url: null })}
                      className="text-[11px] text-red-400 hover:text-red-300 cursor-pointer flex items-center space-x-1"
                    >
                      <X className="w-3 h-3" />
                      <span>Remove Image</span>
                    </button>
                  )}
                </label>

                <div className="flex flex-col sm:flex-row items-center gap-3">
                  {/* Image Preview Thumbnail */}
                  <div className="w-20 h-20 rounded bg-stone-900 border border-stone-800 shrink-0 overflow-hidden flex items-center justify-center relative">
                    {editingExtra.image_url ? (
                      <img
                        src={editingExtra.image_url}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-stone-700" />
                    )}
                  </div>

                  {/* Upload Controls */}
                  <div className="flex-1 space-y-2 w-full">
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleImageFileSelected}
                        accept="image/jpeg,image/png,image/webp,image/avif"
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingImage}
                        className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded font-medium flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <Upload className="w-3.5 h-3.5 text-[#0A6C74]" />
                        <span>{isUploadingImage ? 'Uploading...' : 'Upload Device Image'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleOpenMediaPicker}
                        className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded font-medium flex items-center space-x-1.5 cursor-pointer"
                      >
                        <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                        <span>Media Library</span>
                      </button>
                    </div>

                    <input
                      type="text"
                      value={editingExtra.image_url || ''}
                      onChange={(e) => setEditingExtra({ ...editingExtra, image_url: e.target.value })}
                      placeholder="Or paste external image URL (https://...)"
                      className="w-full px-2.5 py-1 bg-stone-900 border border-stone-800 rounded text-[11px] text-stone-300 placeholder-stone-600 focus:outline-none focus:ring-1 focus:ring-[#0A6C74]"
                    />
                  </div>
                </div>
              </div>

              {/* Pricing Method & Base Price */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-stone-300 block mb-1 font-semibold">Pricing Method *</label>
                  <select
                    value={editingExtra.pricing_type || 'per_person'}
                    onChange={(e) => setEditingExtra({ ...editingExtra, pricing_type: e.target.value as any })}
                    className="w-full px-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-white focus:outline-none focus:ring-1 focus:ring-[#0A6C74]"
                  >
                    <option value="per_person">Per Guest / Person (Guests × Qty)</option>
                    <option value="per_vehicle">Per Vehicle (Direct Qty, Quad/Buggy)</option>
                    <option value="per_item">Per Item (Direct Qty, Snorkel/Towel)</option>
                    <option value="per_booking">Flat Per Booking (Order-level add-on)</option>
                    <option value="per_adult">Per Adult (Adults × Qty)</option>
                    <option value="per_child">Per Child (Children × Qty)</option>
                  </select>
                </div>

                <div>
                  <label className="text-stone-300 block mb-1 font-semibold">Catalogue Default Price (€) *</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={editingExtra.price_eur ?? 20}
                    onChange={(e) => setEditingExtra({ ...editingExtra, price_eur: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-white focus:outline-none focus:ring-1 focus:ring-[#0A6C74]"
                  />
                </div>
              </div>

              {/* Quantities & Display Order */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-stone-300 block mb-1 font-semibold">Min Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={editingExtra.min_quantity ?? 1}
                    onChange={(e) => setEditingExtra({ ...editingExtra, min_quantity: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-white"
                  />
                </div>

                <div>
                  <label className="text-stone-300 block mb-1 font-semibold">Max Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={editingExtra.max_quantity ?? 10}
                    onChange={(e) => setEditingExtra({ ...editingExtra, max_quantity: parseInt(e.target.value) || 10 })}
                    className="w-full px-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-white"
                  />
                </div>

                <div>
                  <label className="text-stone-300 block mb-1 font-semibold">Display Order</label>
                  <input
                    type="number"
                    min="0"
                    value={editingExtra.sort_order ?? 1}
                    onChange={(e) => setEditingExtra({ ...editingExtra, sort_order: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-white"
                  />
                </div>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="extra-active-toggle"
                  checked={editingExtra.is_active ?? true}
                  onChange={(e) => setEditingExtra({ ...editingExtra, is_active: e.target.checked })}
                  className="rounded border-stone-700 bg-stone-900 text-[#0A6C74] focus:ring-0 cursor-pointer"
                />
                <label htmlFor="extra-active-toggle" className="text-stone-300 text-xs font-semibold cursor-pointer">
                  Active in Catalogue (Visible to Customers)
                </label>
              </div>

              {/* Excursion Assignments Multi-Select & Custom Tour Pricing */}
              <div className="pt-3 border-t border-stone-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-stone-300 font-semibold flex items-center">
                    <Layers className="w-3.5 h-3.5 mr-1.5 text-[#0A6C74]" />
                    Assign to Excursions ({assignedTourIds.length}/{tours.length} selected)
                  </label>
                  <div className="flex items-center space-x-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setAssignedTourIds(tours.map((t) => t.id))}
                      className="text-[#0A6C74] hover:underline cursor-pointer"
                    >
                      Select All
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() => setAssignedTourIds([])}
                      className="text-stone-400 hover:underline cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <p className="text-[11px] text-stone-500">
                  Only checked excursions will display this add-on to customers. You may configure an optional tour-specific custom price (€) per excursion.
                </p>

                <div className="max-h-48 overflow-y-auto divide-y divide-stone-900 bg-stone-950 p-2.5 rounded border border-stone-800">
                  {tours.map((tour) => {
                    const isChecked = assignedTourIds.includes(tour.id);
                    const customPrice = assignedTourPrices[tour.id];

                    return (
                      <div key={tour.id} className="py-1.5 flex items-center justify-between gap-2">
                        <label className="flex items-center space-x-2 text-stone-300 hover:text-white cursor-pointer select-none flex-1 truncate">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setAssignedTourIds([...assignedTourIds, tour.id]);
                              } else {
                                setAssignedTourIds(assignedTourIds.filter((id) => id !== tour.id));
                              }
                            }}
                            className="rounded border-stone-700 bg-stone-900 text-[#0A6C74] focus:ring-0"
                          />
                          <span className="text-xs truncate">{tour.title}</span>
                        </label>

                        {isChecked && (
                          <div className="flex items-center space-x-1 shrink-0">
                            <span className="text-[10px] text-stone-500">Custom €</span>
                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              placeholder={`Default (${editingExtra.price_eur ?? 20})`}
                              value={customPrice ?? ''}
                              onChange={(e) => {
                                const val = e.target.value === '' ? undefined : parseFloat(e.target.value);
                                const updated = { ...assignedTourPrices };
                                if (val === undefined || isNaN(val)) {
                                  delete updated[tour.id];
                                } else {
                                  updated[tour.id] = val;
                                }
                                setAssignedTourPrices(updated);
                              }}
                              className="w-24 px-1.5 py-0.5 bg-stone-900 border border-stone-800 rounded text-[11px] font-mono text-white placeholder-stone-600 focus:outline-none focus:ring-1 focus:ring-[#0A6C74]"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Public Booking Presentation Preview Card */}
              <div className="pt-3 border-t border-stone-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-stone-300 font-semibold flex items-center">
                    <Eye className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
                    Customer Booking Presentation Preview
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowPublicPreview(!showPublicPreview)}
                    className="text-[11px] text-stone-400 hover:text-white cursor-pointer"
                  >
                    {showPublicPreview ? 'Hide Preview' : 'Show Preview'}
                  </button>
                </div>

                {showPublicPreview && (
                  <div className="p-3 bg-stone-950 border border-stone-800 rounded-lg">
                    <div className="bg-white text-stone-900 p-4 rounded border border-stone-300 shadow-xs flex flex-col sm:flex-row gap-3">
                      {editingExtra.image_url && (
                        <div className="w-20 h-20 rounded overflow-hidden shrink-0 bg-stone-100">
                          <img
                            src={editingExtra.image_url}
                            alt={editingExtra.name || 'Preview'}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-xs sm:text-sm text-[#0E1B2A]">
                            {editingExtra.name || 'Add-on Title'}
                          </h4>
                          <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-stone-100 text-[#0A6C74] border border-stone-200">
                            {editingExtra.pricing_type === 'per_person' ? 'Per Guest' :
                             editingExtra.pricing_type === 'per_vehicle' ? 'Per Vehicle' :
                             editingExtra.pricing_type === 'per_item' ? 'Per Item' :
                             editingExtra.pricing_type === 'per_adult' ? 'Per Adult' :
                             editingExtra.pricing_type === 'per_child' ? 'Per Child' : 'Flat Per Booking'}
                          </span>
                        </div>
                        <p className="text-[11px] text-stone-600 line-clamp-2">
                          {editingExtra.description || 'Description details displayed here.'}
                        </p>
                        <div className="flex items-center justify-between pt-2 mt-2 border-t border-stone-200">
                          <span className="font-bold text-[#0A6C74] text-xs sm:text-sm">
                            +€{(Number(editingExtra.price_eur) || 20).toFixed(2)}
                          </span>
                          <span className="text-[10px] text-stone-500">
                            Allowed Qty: {editingExtra.min_quantity || 1}–{editingExtra.max_quantity || 10}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-stone-800">
              <button
                type="button"
                onClick={() => setEditingExtra(null)}
                className="px-3.5 py-1.5 bg-stone-800 text-stone-300 hover:bg-stone-700 rounded font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-1.5 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded font-semibold disabled:opacity-50 cursor-pointer shadow-xs flex items-center space-x-1"
              >
                {saving && <Sparkles className="w-3.5 h-3.5 animate-spin" />}
                <span>{saving ? 'Saving...' : 'Save Add-on'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Media Library Picker Modal */}
      {showMediaPicker && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-xl max-w-xl w-full p-5 space-y-3 shadow-2xl text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-stone-800">
              <h3 className="text-sm font-bold text-white flex items-center">
                <FolderOpen className="w-4 h-4 mr-2 text-amber-400" />
                Select Image from Media Assets
              </h3>
              <button
                type="button"
                onClick={() => setShowMediaPicker(false)}
                className="text-stone-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {loadingMedia ? (
              <div className="p-8 text-center text-stone-400">Loading media assets...</div>
            ) : mediaAssets.length === 0 ? (
              <div className="p-8 text-center text-stone-500">No media assets found in storage.</div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 max-h-64 overflow-y-auto p-1">
                {mediaAssets.map((asset) => (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => {
                      if (editingExtra) {
                        setEditingExtra({ ...editingExtra, image_url: asset.url });
                      }
                      setShowMediaPicker(false);
                      showToast('Media image selected.', 'info');
                    }}
                    className="group relative aspect-square rounded overflow-hidden border border-stone-800 hover:border-[#0A6C74] cursor-pointer"
                  >
                    <img
                      src={asset.url}
                      alt={asset.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-black/70 p-1 text-[9px] text-stone-300 truncate">
                      {asset.name}
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-stone-800">
              <button
                type="button"
                onClick={() => setShowMediaPicker(false)}
                className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded font-medium cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Add-on Confirmation Modal */}
      {extraToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-xl max-w-sm w-full p-6 space-y-4 shadow-2xl text-xs">
            <div className="flex items-center space-x-2.5 text-amber-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-bold text-white">Delete Tour Extra</h3>
            </div>
            <p className="text-stone-300 leading-relaxed">
              Are you sure you want to delete optional extra <strong className="text-white">"{extraToDelete.name}"</strong> (€{extraToDelete.price_eur.toFixed(2)})?
            </p>
            <p className="text-[11px] text-stone-500">
              This will remove the add-on from all excursions. Existing confirmed bookings will preserve their historical line items and descriptions.
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-stone-800">
              <button
                type="button"
                onClick={() => setExtraToDelete(null)}
                disabled={isDeleting}
                className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteExtra}
                disabled={isDeleting}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded font-semibold cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
