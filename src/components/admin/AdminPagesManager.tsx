import React, { useState, useEffect } from 'react';
import {
  FileText,
  Save,
  Plus,
  Trash2,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  MoveUp,
  MoveDown,
  RefreshCw,
  Eye,
  Globe,
} from 'lucide-react';
import {
  getStaticPages,
  saveStaticPages,
  StaticPageContent,
} from '../../services/siteSettingsService';
import { useToast } from '../../contexts/ToastContext';

export const AdminPagesManager: React.FC = () => {
  const { showToast } = useToast();
  const [pages, setPages] = useState<StaticPageContent[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string>('about');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Active Page Form State
  const [activePage, setActivePage] = useState<StaticPageContent | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getStaticPages();
      setPages(data);
      const current = data.find((p) => p.id === selectedPageId) || data[0];
      if (current) {
        setSelectedPageId(current.id);
        setActivePage(JSON.parse(JSON.stringify(current)));
      }
    } catch (err) {
      console.error('Error loading static pages:', err);
      showToast('Failed to load static pages', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSelectPage = (pageId: string) => {
    if (hasUnsavedChanges) {
      if (!window.confirm('You have unsaved changes on this page. Discard and switch?')) {
        return;
      }
    }
    setSelectedPageId(pageId);
    const target = pages.find((p) => p.id === pageId);
    if (target) {
      setActivePage(JSON.parse(JSON.stringify(target)));
      setHasUnsavedChanges(false);
    }
  };

  const handleFieldChange = (field: keyof StaticPageContent, value: any) => {
    if (!activePage) return;
    setActivePage({ ...activePage, [field]: value });
    setHasUnsavedChanges(true);
  };

  const handleSectionChange = (index: number, field: 'title' | 'content', value: string) => {
    if (!activePage) return;
    const updatedSections = [...activePage.sections];
    updatedSections[index] = { ...updatedSections[index], [field]: value };
    setActivePage({ ...activePage, sections: updatedSections });
    setHasUnsavedChanges(true);
  };

  const handleAddSection = () => {
    if (!activePage) return;
    setActivePage({
      ...activePage,
      sections: [
        ...activePage.sections,
        { title: 'New Content Section', content: 'Enter authoritative details here...' },
      ],
    });
    setHasUnsavedChanges(true);
  };

  const handleRemoveSection = (index: number) => {
    if (!activePage) return;
    const updated = activePage.sections.filter((_, i) => i !== index);
    setActivePage({ ...activePage, sections: updated });
    setHasUnsavedChanges(true);
  };

  const handleMoveSection = (index: number, direction: 'up' | 'down') => {
    if (!activePage) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= activePage.sections.length) return;

    const updated = [...activePage.sections];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    setActivePage({ ...activePage, sections: updated });
    setHasUnsavedChanges(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePage) return;

    setSaving(true);
    try {
      const now = new Date().toISOString().split('T')[0];
      const updatedPage = { ...activePage, lastUpdated: now };

      const allUpdated = pages.map((p) => (p.id === activePage.id ? updatedPage : p));
      await saveStaticPages(allUpdated);

      setPages(allUpdated);
      setActivePage(updatedPage);
      setHasUnsavedChanges(false);
      showToast(`Page "${activePage.title}" saved successfully.`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to save page', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display text-white tracking-tight flex items-center space-x-2">
            <FileText className="w-6 h-6 text-[#2dd4bf]" />
            <span>Static Pages & Content CMS</span>
          </h1>
          <p className="text-xs text-stone-400 mt-1">
            Manage long-form editorial copy, legal policies, safety compliance statements, and trust badges.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="p-2 bg-stone-900 border border-stone-800 text-stone-300 hover:text-white rounded text-xs transition-colors cursor-pointer"
            title="Refresh pages"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !hasUnsavedChanges}
            className="inline-flex items-center space-x-1.5 px-4 py-2 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded text-xs font-semibold shadow transition-colors cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Page Content'}</span>
          </button>
        </div>
      </div>

      {/* Pages Selector Tabs */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-2 border-b border-stone-800 text-xs">
        {pages.map((p) => {
          const isSelected = p.id === selectedPageId;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => handleSelectPage(p.id)}
              className={`px-3 py-2 rounded-t-lg font-medium whitespace-nowrap transition-colors border-b-2 flex items-center space-x-1.5 cursor-pointer ${
                isSelected
                  ? 'bg-stone-800/80 text-white border-[#2dd4bf]'
                  : 'text-stone-400 hover:text-stone-200 border-transparent hover:bg-stone-900'
              }`}
            >
              <span>{p.title}</span>
              {isSelected && hasUnsavedChanges && (
                <span className="w-2 h-2 rounded-full bg-amber-400" title="Unsaved changes" />
              )}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="p-12 text-center text-stone-400">
          <div className="w-8 h-8 border-2 border-[#0A6C74] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs">Loading page content...</p>
        </div>
      ) : activePage ? (
        <form onSubmit={handleSave} className="space-y-6">
          {/* General Metadata Card */}
          <div className="bg-stone-950 border border-stone-800 rounded-xl p-5 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <h2 className="text-sm font-bold text-white tracking-wide">
                Page Header & Hero Presentation
              </h2>
              <span className="text-[11px] text-stone-500 font-mono">
                Last updated: {activePage.lastUpdated}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-stone-300 font-semibold mb-1">Page Title *</label>
                <input
                  type="text"
                  required
                  value={activePage.title}
                  onChange={(e) => handleFieldChange('title', e.target.value)}
                  className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded text-white focus:outline-none focus:border-[#0A6C74]"
                />
              </div>

              <div>
                <label className="block text-stone-300 font-semibold mb-1">URL Path</label>
                <div className="flex items-center space-x-2">
                  <span className="text-stone-500 font-mono">/{activePage.slug}</span>
                  <a
                    href={`/${activePage.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#2dd4bf] hover:underline flex items-center space-x-1"
                  >
                    <span>View Public Page</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-stone-300 font-semibold mb-1">
                Hero Headline (Prominent Header)
              </label>
              <input
                type="text"
                value={activePage.heroHeadline}
                onChange={(e) => handleFieldChange('heroHeadline', e.target.value)}
                className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded text-white focus:outline-none focus:border-[#0A6C74]"
              />
            </div>

            <div>
              <label className="block text-stone-300 font-semibold mb-1">Hero Subtitle</label>
              <textarea
                rows={2}
                value={activePage.heroSubtitle}
                onChange={(e) => handleFieldChange('heroSubtitle', e.target.value)}
                className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded text-white focus:outline-none focus:border-[#0A6C74]"
              />
            </div>
          </div>

          {/* Sections List */}
          <div className="bg-stone-950 border border-stone-800 rounded-xl p-5 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <div>
                <h2 className="text-sm font-bold text-white tracking-wide">
                  Structured Content Sections
                </h2>
                <p className="text-[11px] text-stone-500 mt-0.5">
                  Organize information with section headings, paragraphs, and compliance guidelines.
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddSection}
                className="inline-flex items-center space-x-1 px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-stone-200 rounded border border-stone-700 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Section</span>
              </button>
            </div>

            <div className="space-y-4">
              {activePage.sections.map((section, idx) => (
                <div
                  key={idx}
                  className="bg-stone-900/60 border border-stone-800 rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] uppercase font-bold text-stone-400 bg-stone-800 px-2 py-0.5 rounded">
                      Section #{idx + 1}
                    </span>

                    <div className="flex items-center space-x-1">
                      <button
                        type="button"
                        onClick={() => handleMoveSection(idx, 'up')}
                        disabled={idx === 0}
                        className="p-1 text-stone-400 hover:text-white disabled:opacity-30 cursor-pointer"
                        title="Move Up"
                      >
                        <MoveUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveSection(idx, 'down')}
                        disabled={idx === activePage.sections.length - 1}
                        className="p-1 text-stone-400 hover:text-white disabled:opacity-30 cursor-pointer"
                        title="Move Down"
                      >
                        <MoveDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveSection(idx)}
                        className="p-1 text-stone-400 hover:text-red-400 cursor-pointer"
                        title="Delete Section"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-stone-400 font-medium mb-1 text-[11px]">
                      Section Heading
                    </label>
                    <input
                      type="text"
                      value={section.title}
                      onChange={(e) => handleSectionChange(idx, 'title', e.target.value)}
                      placeholder="e.g. Passenger Manifest Protocols"
                      className="w-full px-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-white focus:outline-none focus:border-[#0A6C74]"
                    />
                  </div>

                  <div>
                    <label className="block text-stone-400 font-medium mb-1 text-[11px]">
                      Section Body Content
                    </label>
                    <textarea
                      rows={4}
                      value={section.content}
                      onChange={(e) => handleSectionChange(idx, 'content', e.target.value)}
                      placeholder="Enter detailed content, legal terms, or guidelines..."
                      className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded text-white leading-relaxed focus:outline-none focus:border-[#0A6C74]"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Action Bar */}
          <div className="flex items-center justify-between p-4 bg-stone-950 border border-stone-800 rounded-xl text-xs">
            <span className="text-stone-400">
              {hasUnsavedChanges ? (
                <span className="text-amber-400 font-semibold flex items-center space-x-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Unsaved changes on this page</span>
                </span>
              ) : (
                <span className="text-emerald-400 flex items-center space-x-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>All content is up to date</span>
                </span>
              )}
            </span>

            <button
              type="submit"
              disabled={saving || !hasUnsavedChanges}
              className="inline-flex items-center space-x-1.5 px-5 py-2 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded font-semibold disabled:opacity-50 cursor-pointer shadow"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save Page Content'}</span>
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
};
