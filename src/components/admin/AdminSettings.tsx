import React, { useState, useEffect } from 'react';
import {
  Database,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  Key,
  Server,
  Activity,
  ShieldAlert,
  Info,
  Building,
  FileCheck,
  Share2,
  Save,
  Globe,
  Clock,
  Phone,
  Mail,
  MapPin,
} from 'lucide-react';
import {
  isSupabaseConfigured,
  getSupabaseConfig,
  updateSupabaseCredentials,
  supabase,
  isSchemaMissingError,
  setSchemaMissing,
} from '../../services/supabaseClient';
import {
  getCompanySettings,
  saveCompanySettings,
  getBookingPolicies,
  saveBookingPolicies,
  getSocialLinks,
  saveSocialLinks,
  getFooterContent,
  saveFooterContent,
  CompanySettings,
  BookingPolicySettings,
  SocialLinksSettings,
  FooterContentSettings,
} from '../../services/siteSettingsService';
import completeSchemaSql from '../../../complete_schema.sql?raw';
import phase4Sql from '../../../supabase/migrations/20260922000000_phase4_schema.sql?raw';
import fixAdminAuthSql from '../../../supabase/migrations/20260928000000_fix_admin_auth_rls.sql?raw';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { SuperAdminMfaPanel } from './SuperAdminMfaPanel';

export interface TableHealthCheck {
  table: string;
  label: string;
  category: string;
  status: 'pending' | 'healthy' | 'missing' | 'restricted';
  count?: number;
  message?: string;
}

const CMS_TABLES_LIST: Omit<TableHealthCheck, 'status'>[] = [
  { table: 'tours', label: 'Tours & Excursions', category: 'Catalog' },
  { table: 'destinations', label: 'Destinations', category: 'Catalog' },
  { table: 'categories', label: 'Activity Categories', category: 'Catalog' },
  { table: 'pickup_locations', label: 'Hotel Transfer Zones', category: 'Logistics' },
  { table: 'tour_extras', label: 'Optional Add-ons & Extras', category: 'Catalog' },
  { table: 'coupons', label: 'Promo Coupons & Vouchers', category: 'Marketing' },
  { table: 'faqs', label: 'Frequently Asked Questions', category: 'Content' },
  { table: 'bookings', label: 'Reservations & Bookings', category: 'Operations' },
  { table: 'customers', label: 'Customer Directory', category: 'Operations' },
  { table: 'inquiries', label: 'Traveler Inquiries', category: 'Support' },
  { table: 'newsletter_subscriptions', label: 'Newsletter Subscribers', category: 'Marketing' },
  { table: 'reviews', label: 'Guest Reviews & Ratings', category: 'Content' },
  { table: 'tour_availability', label: 'Daily Tour Availability', category: 'Operations' },
  { table: 'seo_metadata', label: 'SEO & Social Tags', category: 'Marketing' },
  { table: 'site_settings', label: 'Global Site Settings', category: 'System' },
  { table: 'profiles', label: 'User Roles & Admin Profiles', category: 'Security' },
];

export const AdminSettings: React.FC = () => {
  const { showToast } = useToast();
  const { user } = useAuth();
  const isSuperAdmin = Boolean(user && (user.role === 'super_admin' || user.roles?.includes('super_admin')));
  const [activeTab, setActiveTab] = useState<'company' | 'policies' | 'social_footer' | 'supabase' | 'security'>('company');

  // Company Settings
  const [company, setCompany] = useState<CompanySettings>({
    companyName: 'Awesome Adventure Tours',
    email: 'reservations@awesomeadventure.tours',
    phone: '+20 151 5212741',
    whatsapp: '+20 151 5212741',
    whatsappUrl: 'https://wa.me/201515212741',
    address: 'Hurghada Marina Boulevard, Pier 4 Dispatch Office, Red Sea Governorate, Egypt',
    operatingHours: '06:00 - 23:00 EEST (Daily Pier Operations)',
    defaultCurrency: 'EUR',
    supportedCurrencies: ['EUR', 'USD', 'GBP', 'EGP'],
    defaultCountry: 'Egypt',
  });

  // Policies Settings
  const [policies, setPolicies] = useState<BookingPolicySettings>({
    bookingNoticeCutoffHours: 12,
    cancellationNoticeHours: 24,
    cancellationPolicyText: 'Free 100% cancellation up to 24 hours before trip departure time. Full automatic refund or free rescheduling in case of Coast Guard harbor weather closures.',
    depositRequired: false,
    depositPercent: 0,
    childAgeLimit: 11,
    infantAgeLimit: 2,
    coastGuardManifestRequired: true,
  });

  // Social & Footer
  const [social, setSocial] = useState<SocialLinksSettings>({
    facebook: 'https://facebook.com/AwesomeAdventureTours',
    instagram: 'https://instagram.com/awesomeadventuretours',
    youtube: 'https://youtube.com/@awesomeadventuretours',
    tripadvisor: 'https://tripadvisor.com/Attraction_Review-Hurghada-Red_Sea.html',
  });

  const [footer, setFooter] = useState<FooterContentSettings>({
    copyrightNotice: '© 2026 Awesome Adventure Tours SAE. Registered Tour Operator License #8421.',
    aboutSnippet: 'Awesome Adventure Tours - professional maritime tour operator based in Hurghada Marina. Certified vessels, private yacht charters, island transfers, and desert safaris.',
    badges: ['Egyptian Ministry of Tourism Certified', 'PADI Certified Dive Centers', 'Coast Guard Safety Compliant'],
    paymentIconsText: 'Cash on Pickup • Visa • MasterCard • Bank Transfer',
  });

  const [savingSettings, setSavingSettings] = useState(false);

  // Supabase State
  const currentConfig = getSupabaseConfig();
  const [supabaseUrl, setSupabaseUrl] = useState(currentConfig.url);
  const [supabaseAnonKey, setSupabaseAnonKey] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isAuditingTables, setIsAuditingTables] = useState(false);
  const [tablesHealth, setTablesHealth] = useState<TableHealthCheck[]>(
    CMS_TABLES_LIST.map((t) => ({ ...t, status: 'pending' }))
  );
  const [copiedMasterSql, setCopiedMasterSql] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [copiedFixSql, setCopiedFixSql] = useState(false);
  const [showMasterSqlPreview, setShowMasterSqlPreview] = useState(false);
  const [showSqlPreview, setShowSqlPreview] = useState(false);
  const [showFixSqlPreview, setShowFixSqlPreview] = useState(false);

  // Load all settings on mount
  useEffect(() => {
    async function loadAllSettings() {
      try {
        const [loadedCompany, loadedPolicies, loadedSocial, loadedFooter] = await Promise.all([
          getCompanySettings(),
          getBookingPolicies(),
          getSocialLinks(),
          getFooterContent(),
        ]);
        if (loadedCompany) setCompany(loadedCompany);
        if (loadedPolicies) setPolicies(loadedPolicies);
        if (loadedSocial) setSocial(loadedSocial);
        if (loadedFooter) setFooter(loadedFooter);
      } catch (err) {
        console.warn('Failed to load settings:', err);
      }
    }
    loadAllSettings();
  }, []);

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await saveCompanySettings(company);
      showToast('Company identity & contact settings saved successfully.', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to save company settings', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSavePolicies = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await saveBookingPolicies(policies);
      showToast('Booking & cancellation policies saved successfully.', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to save policies', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSaveSocialFooter = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await Promise.all([saveSocialLinks(social), saveFooterContent(footer)]);
      showToast('Social media links and footer content saved.', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to save social/footer settings', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleAuditTables = async () => {
    if (!isSupabaseConfigured()) {
      setTestResult({
        success: false,
        message: 'Please provide valid Supabase credentials above to run database table audit.',
      });
      return;
    }

    setIsAuditingTables(true);
    const updated: TableHealthCheck[] = [];

    for (const item of CMS_TABLES_LIST) {
      try {
        const { count, error } = await supabase
          .from(item.table)
          .select('*', { count: 'exact', head: true });

        if (error) {
          if (isSchemaMissingError(error)) {
            updated.push({
              ...item,
              status: 'missing',
              message: 'Table not created in PostgreSQL schema yet',
            });
          } else if (error.code === '42501' || error.message.includes('permission denied')) {
            updated.push({
              ...item,
              status: 'restricted',
              message: 'RLS active (sign in as admin to read all)',
            });
          } else {
            updated.push({
              ...item,
              status: 'missing',
              message: error.message,
            });
          }
        } else {
          updated.push({
            ...item,
            status: 'healthy',
            count: count ?? 0,
            message: 'Connected & Verified',
          });
        }
      } catch (err: any) {
        updated.push({
          ...item,
          status: 'missing',
          message: err?.message || 'Query failed',
        });
      }
    }

    setTablesHealth(updated);
    setIsAuditingTables(false);
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      if (supabaseUrl && supabaseAnonKey) {
        updateSupabaseCredentials(supabaseUrl, supabaseAnonKey);
      }

      if (!isSupabaseConfigured()) {
        setTestResult({
          success: false,
          message: 'Invalid credentials format. Supabase URL must be https://<project-ref>.supabase.co and Anon Key must be provided.',
        });
        setIsTesting(false);
        return;
      }

      const { error } = await supabase.from('destinations').select('id, name').limit(1);

      if (error) {
        if (isSchemaMissingError(error)) {
          setSchemaMissing(true);
          setTestResult({
            success: true,
            message: `Connection established to Supabase! However, the database tables have not been created yet in PostgreSQL. Copy and execute the Schema SQL below in your Supabase SQL Editor.`,
          });
        } else {
          setTestResult({
            success: false,
            message: `Database error: ${error.message} (Code: ${error.code})`,
          });
        }
      } else {
        setSchemaMissing(false);
        setTestResult({
          success: true,
          message: 'Supabase PostgreSQL & Auth connection verified! Database tables are healthy and responding.',
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Connection failed',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const copyMasterSql = () => {
    navigator.clipboard.writeText(completeSchemaSql);
    setCopiedMasterSql(true);
    setTimeout(() => setCopiedMasterSql(false), 3000);
    showToast('Consolidated schema SQL copied to clipboard', 'success');
  };

  const copyMigrationSql = () => {
    navigator.clipboard.writeText(phase4Sql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
    showToast('Phase 4 schema SQL copied to clipboard', 'success');
  };

  const copyFixSql = () => {
    navigator.clipboard.writeText(fixAdminAuthSql);
    setCopiedFixSql(true);
    setTimeout(() => setCopiedFixSql(false), 3000);
    showToast('Admin RLS migration SQL copied to clipboard', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold font-display text-white tracking-tight">
          Site Settings & Operational Configurations
        </h1>
        <p className="text-xs text-stone-400 mt-1">
          Manage brand details, business hours, cancellation rules, currency defaults, and Supabase database infrastructure.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center space-x-2 border-b border-stone-800 pb-2 text-xs">
        <button
          type="button"
          onClick={() => setActiveTab('company')}
          className={`flex items-center space-x-1.5 px-3 py-2 rounded-t-lg font-medium transition-colors border-b-2 cursor-pointer ${
            activeTab === 'company'
              ? 'bg-stone-800 text-white border-[#2dd4bf]'
              : 'text-stone-400 hover:text-white border-transparent hover:bg-stone-900'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>Company & Contact</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('policies')}
          className={`flex items-center space-x-1.5 px-3 py-2 rounded-t-lg font-medium transition-colors border-b-2 cursor-pointer ${
            activeTab === 'policies'
              ? 'bg-stone-800 text-white border-[#2dd4bf]'
              : 'text-stone-400 hover:text-white border-transparent hover:bg-stone-900'
          }`}
        >
          <FileCheck className="w-4 h-4" />
          <span>Booking & Cancellation Policies</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('social_footer')}
          className={`flex items-center space-x-1.5 px-3 py-2 rounded-t-lg font-medium transition-colors border-b-2 cursor-pointer ${
            activeTab === 'social_footer'
              ? 'bg-stone-800 text-white border-[#2dd4bf]'
              : 'text-stone-400 hover:text-white border-transparent hover:bg-stone-900'
          }`}
        >
          <Share2 className="w-4 h-4" />
          <span>Social Media & Footer</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('supabase')}
          className={`flex items-center space-x-1.5 px-3 py-2 rounded-t-lg font-medium transition-colors border-b-2 cursor-pointer ${
            activeTab === 'supabase'
              ? 'bg-stone-800 text-white border-[#2dd4bf]'
              : 'text-stone-400 hover:text-white border-transparent hover:bg-stone-900'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Database & Supabase Connection</span>
        </button>

        {isSuperAdmin && (
          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`flex items-center space-x-1.5 px-3 py-2 rounded-t-lg font-medium transition-colors border-b-2 cursor-pointer ${
              activeTab === 'security'
                ? 'bg-stone-800 text-white border-[#2dd4bf]'
                : 'text-stone-400 hover:text-white border-transparent hover:bg-stone-900'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Security & MFA</span>
          </button>
        )}
      </div>

      {/* Tab 1: Company & Contact */}
      {activeTab === 'company' && (
        <form onSubmit={handleSaveCompany} className="space-y-6">
          <div className="bg-stone-950 border border-stone-800 rounded-xl p-5 space-y-4 text-xs">
            <h2 className="text-sm font-bold text-white tracking-wide border-b border-stone-800 pb-3 flex items-center space-x-2">
              <Building className="w-4 h-4 text-[#2dd4bf]" />
              <span>Company Information & Pier Desk Identity</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-stone-300 font-semibold mb-1">Company Name *</label>
                <input
                  type="text"
                  required
                  value={company.companyName}
                  onChange={(e) => setCompany({ ...company, companyName: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded text-white focus:outline-none focus:border-[#0A6C74]"
                />
              </div>

              <div>
                <label className="block text-stone-300 font-semibold mb-1">Support Email *</label>
                <input
                  type="email"
                  required
                  value={company.email}
                  onChange={(e) => setCompany({ ...company, email: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded text-white focus:outline-none focus:border-[#0A6C74]"
                />
              </div>

              <div>
                <label className="block text-stone-300 font-semibold mb-1">Pier Hotline Phone *</label>
                <input
                  type="text"
                  required
                  value={company.phone}
                  onChange={(e) => setCompany({ ...company, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded text-white focus:outline-none focus:border-[#0A6C74]"
                />
              </div>

              <div>
                <label className="block text-stone-300 font-semibold mb-1">Official WhatsApp *</label>
                <input
                  type="text"
                  required
                  value={company.whatsapp}
                  onChange={(e) =>
                    setCompany({
                      ...company,
                      whatsapp: e.target.value,
                      whatsappUrl: `https://wa.me/${e.target.value.replace(/[^0-9]/g, '')}`,
                    })
                  }
                  className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded text-white focus:outline-none focus:border-[#0A6C74]"
                />
              </div>
            </div>

            <div>
              <label className="block text-stone-300 font-semibold mb-1">Physical Dispatch Address</label>
              <input
                type="text"
                value={company.address}
                onChange={(e) => setCompany({ ...company, address: e.target.value })}
                className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded text-white focus:outline-none focus:border-[#0A6C74]"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-stone-300 font-semibold mb-1">Business Hours</label>
                <input
                  type="text"
                  value={company.operatingHours}
                  onChange={(e) => setCompany({ ...company, operatingHours: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded text-white focus:outline-none focus:border-[#0A6C74]"
                />
              </div>

              <div>
                <label className="block text-stone-300 font-semibold mb-1">Default Currency</label>
                <select
                  value={company.defaultCurrency}
                  onChange={(e) => setCompany({ ...company, defaultCurrency: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded text-white focus:outline-none focus:border-[#0A6C74]"
                >
                  <option value="EUR">EUR (€ Euros)</option>
                  <option value="USD">USD ($ US Dollars)</option>
                  <option value="GBP">GBP (£ British Pounds)</option>
                  <option value="EGP">EGP (E£ Egyptian Pounds)</option>
                </select>
              </div>

              <div>
                <label className="block text-stone-300 font-semibold mb-1">Default Country</label>
                <input
                  type="text"
                  value={company.defaultCountry}
                  onChange={(e) => setCompany({ ...company, defaultCountry: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded text-white focus:outline-none focus:border-[#0A6C74]"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-stone-800 flex justify-end">
              <button
                type="submit"
                disabled={savingSettings}
                className="inline-flex items-center space-x-1.5 px-5 py-2 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded font-semibold disabled:opacity-50 cursor-pointer shadow"
              >
                <Save className="w-4 h-4" />
                <span>{savingSettings ? 'Saving...' : 'Save Company Details'}</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Tab 2: Policies */}
      {activeTab === 'policies' && (
        <form onSubmit={handleSavePolicies} className="space-y-6">
          <div className="bg-stone-950 border border-stone-800 rounded-xl p-5 space-y-4 text-xs">
            <h2 className="text-sm font-bold text-white tracking-wide border-b border-stone-800 pb-3 flex items-center space-x-2">
              <FileCheck className="w-4 h-4 text-[#2dd4bf]" />
              <span>Booking Rules, Cancellation, & Safety Cutoffs</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-stone-300 font-semibold mb-1">
                  Minimum Booking Notice Cutoff (Hours)
                </label>
                <input
                  type="number"
                  min="1"
                  max="72"
                  value={policies.bookingNoticeCutoffHours}
                  onChange={(e) =>
                    setPolicies({
                      ...policies,
                      bookingNoticeCutoffHours: parseInt(e.target.value, 10) || 12,
                    })
                  }
                  className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded text-white focus:outline-none focus:border-[#0A6C74]"
                />
                <p className="text-[11px] text-stone-500 mt-1">
                  Cutoff before departure when online bookings automatically close for manifest processing.
                </p>
              </div>

              <div>
                <label className="block text-stone-300 font-semibold mb-1">
                  Free Cancellation Window (Hours)
                </label>
                <input
                  type="number"
                  min="0"
                  max="168"
                  value={policies.cancellationNoticeHours}
                  onChange={(e) =>
                    setPolicies({
                      ...policies,
                      cancellationNoticeHours: parseInt(e.target.value, 10) || 24,
                    })
                  }
                  className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded text-white focus:outline-none focus:border-[#0A6C74]"
                />
                <p className="text-[11px] text-stone-500 mt-1">
                  Notice required for guests to cancel online and receive 100% full refund.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-stone-300 font-semibold mb-1">
                Standard Cancellation Policy Statement
              </label>
              <textarea
                rows={3}
                value={policies.cancellationPolicyText}
                onChange={(e) => setPolicies({ ...policies, cancellationPolicyText: e.target.value })}
                className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded text-white focus:outline-none focus:border-[#0A6C74]"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-stone-300 font-semibold mb-1">Child Age Maximum</label>
                <input
                  type="number"
                  min="2"
                  max="17"
                  value={policies.childAgeLimit}
                  onChange={(e) =>
                    setPolicies({ ...policies, childAgeLimit: parseInt(e.target.value, 10) || 11 })
                  }
                  className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded text-white focus:outline-none focus:border-[#0A6C74]"
                />
              </div>

              <div>
                <label className="block text-stone-300 font-semibold mb-1">Infant Age Maximum</label>
                <input
                  type="number"
                  min="0"
                  max="4"
                  value={policies.infantAgeLimit}
                  onChange={(e) =>
                    setPolicies({ ...policies, infantAgeLimit: parseInt(e.target.value, 10) || 2 })
                  }
                  className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded text-white focus:outline-none focus:border-[#0A6C74]"
                />
              </div>

              <div className="flex items-center pt-6">
                <label className="inline-flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={policies.coastGuardManifestRequired}
                    onChange={(e) =>
                      setPolicies({ ...policies, coastGuardManifestRequired: e.target.checked })
                    }
                    className="rounded bg-stone-950 border-stone-800 text-[#0A6C74] focus:ring-0"
                  />
                  <span className="text-stone-300 font-medium">Require Coast Guard Manifest</span>
                </label>
              </div>
            </div>

            <div className="pt-3 border-t border-stone-800 flex justify-end">
              <button
                type="submit"
                disabled={savingSettings}
                className="inline-flex items-center space-x-1.5 px-5 py-2 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded font-semibold disabled:opacity-50 cursor-pointer shadow"
              >
                <Save className="w-4 h-4" />
                <span>{savingSettings ? 'Saving...' : 'Save Policies'}</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Tab 3: Social Media & Footer */}
      {activeTab === 'social_footer' && (
        <form onSubmit={handleSaveSocialFooter} className="space-y-6">
          <div className="bg-stone-950 border border-stone-800 rounded-xl p-5 space-y-4 text-xs">
            <h2 className="text-sm font-bold text-white tracking-wide border-b border-stone-800 pb-3 flex items-center space-x-2">
              <Share2 className="w-4 h-4 text-[#2dd4bf]" />
              <span>Official Social Media Channels</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-stone-300 font-semibold mb-1">Facebook URL</label>
                <input
                  type="url"
                  value={social.facebook}
                  onChange={(e) => setSocial({ ...social, facebook: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded text-white focus:outline-none focus:border-[#0A6C74]"
                />
              </div>

              <div>
                <label className="block text-stone-300 font-semibold mb-1">Instagram URL</label>
                <input
                  type="url"
                  value={social.instagram}
                  onChange={(e) => setSocial({ ...social, instagram: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded text-white focus:outline-none focus:border-[#0A6C74]"
                />
              </div>

              <div>
                <label className="block text-stone-300 font-semibold mb-1">YouTube Channel URL</label>
                <input
                  type="url"
                  value={social.youtube}
                  onChange={(e) => setSocial({ ...social, youtube: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded text-white focus:outline-none focus:border-[#0A6C74]"
                />
              </div>

              <div>
                <label className="block text-stone-300 font-semibold mb-1">TripAdvisor Listing URL</label>
                <input
                  type="url"
                  value={social.tripadvisor}
                  onChange={(e) => setSocial({ ...social, tripadvisor: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded text-white focus:outline-none focus:border-[#0A6C74]"
                />
              </div>
            </div>
          </div>

          <div className="bg-stone-950 border border-stone-800 rounded-xl p-5 space-y-4 text-xs">
            <h2 className="text-sm font-bold text-white tracking-wide border-b border-stone-800 pb-3 flex items-center space-x-2">
              <Globe className="w-4 h-4 text-[#2dd4bf]" />
              <span>Website Footer Copy & Trust Badges</span>
            </h2>

            <div>
              <label className="block text-stone-300 font-semibold mb-1">Copyright Notice</label>
              <input
                type="text"
                value={footer.copyrightNotice}
                onChange={(e) => setFooter({ ...footer, copyrightNotice: e.target.value })}
                className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded text-white focus:outline-none focus:border-[#0A6C74]"
              />
            </div>

            <div>
              <label className="block text-stone-300 font-semibold mb-1">Footer About Snippet</label>
              <textarea
                rows={2}
                value={footer.aboutSnippet}
                onChange={(e) => setFooter({ ...footer, aboutSnippet: e.target.value })}
                className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded text-white focus:outline-none focus:border-[#0A6C74]"
              />
            </div>

            <div>
              <label className="block text-stone-300 font-semibold mb-1">Accepted Payment Text</label>
              <input
                type="text"
                value={footer.paymentIconsText}
                onChange={(e) => setFooter({ ...footer, paymentIconsText: e.target.value })}
                className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded text-white focus:outline-none focus:border-[#0A6C74]"
              />
            </div>

            <div className="pt-3 border-t border-stone-800 flex justify-end">
              <button
                type="submit"
                disabled={savingSettings}
                className="inline-flex items-center space-x-1.5 px-5 py-2 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded font-semibold disabled:opacity-50 cursor-pointer shadow"
              >
                <Save className="w-4 h-4" />
                <span>{savingSettings ? 'Saving...' : 'Save Social & Footer'}</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Tab 4: Database & Supabase */}
      {activeTab === 'supabase' && (
        <div className="space-y-6">
          {/* Connection Card */}
          <div className="bg-stone-950 border border-stone-800 rounded-xl p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <Database className="w-5 h-5 text-[#2dd4bf]" />
                <h2 className="text-sm font-bold text-white tracking-wide">
                  Supabase Cloud PostgreSQL & Auth
                </h2>
              </div>
              <span
                className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded text-[11px] font-semibold ${
                  isSupabaseConfigured()
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}
              >
                {isSupabaseConfigured() ? (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>Configured</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3 h-3 text-amber-400" />
                    <span>Local Mock Mode</span>
                  </>
                )}
              </span>
            </div>

            <p className="text-stone-300 leading-relaxed text-[11px]">
              Connect your production or staging Supabase project to synchronize tour itineraries, departure slots, live bookings, traveler CRM, and high-resolution photo uploads in real-time.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-stone-300 font-semibold mb-1">
                  Supabase Project URL (VITE_SUPABASE_URL)
                </label>
                <input
                  type="text"
                  value={supabaseUrl}
                  onChange={(e) => setSupabaseUrl(e.target.value)}
                  placeholder="https://xyzcompany.supabase.co"
                  className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded text-white font-mono text-xs focus:outline-none focus:border-[#0A6C74]"
                />
              </div>

              <div>
                <label className="block text-stone-300 font-semibold mb-1">
                  Supabase Public Anon / Publishable Key (VITE_SUPABASE_ANON_KEY)
                </label>
                <input
                  type="password"
                  value={supabaseAnonKey}
                  onChange={(e) => setSupabaseAnonKey(e.target.value)}
                  placeholder="sb_publishable_... or eyJhbGciOi..."
                  className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded text-white font-mono text-xs focus:outline-none focus:border-[#0A6C74]"
                />
                <p className="text-[10px] text-stone-500 mt-1">
                  Secret/service-role keys are strictly blocked from browser storage.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-stone-800">
              <span className="text-stone-500 text-[11px]">
                Strict secret isolation enforced. Private credentials reside solely on the Hostinger server runtime.
              </span>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleAuditTables}
                  disabled={isAuditingTables || !isSupabaseConfigured()}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-stone-200 rounded border border-stone-700 font-medium transition-colors cursor-pointer disabled:opacity-40"
                >
                  <Activity className={`w-3.5 h-3.5 ${isAuditingTables ? 'animate-spin' : ''}`} />
                  <span>Audit Database Tables</span>
                </button>

                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTesting}
                  className="inline-flex items-center space-x-1.5 px-4 py-1.5 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded font-semibold shadow transition-colors cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                  <span>{isTesting ? 'Testing...' : 'Save & Ping Connection'}</span>
                </button>
              </div>
            </div>

            {testResult && (
              <div
                className={`p-3 rounded border flex items-start space-x-2 text-xs ${
                  testResult.success
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-red-500/10 border-red-500/30 text-red-300'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                )}
                <span>{testResult.message}</span>
              </div>
            )}
          </div>

          {/* Database Tables Health Audit */}
          <div className="bg-stone-950 border border-stone-800 rounded-xl p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                  <Activity className="w-4 h-4 text-[#2dd4bf]" />
                  <span>PostgreSQL Table Schema & Verification Matrix</span>
                </h3>
                <p className="text-[11px] text-stone-400 mt-0.5">
                  16 normalized tables supporting tours, bookings, CRM, coupons, FAQs, and media storage.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAuditTables}
                disabled={isAuditingTables || !isSupabaseConfigured()}
                className="px-3 py-1 bg-stone-900 hover:bg-stone-800 text-stone-300 rounded border border-stone-700 transition-colors cursor-pointer disabled:opacity-40"
              >
                Re-Run Table Audit
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {tablesHealth.map((item) => (
                <div
                  key={item.table}
                  className="bg-stone-900/60 border border-stone-800 rounded-lg p-3 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-stone-200 font-bold text-[11px]">
                      {item.table}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                        item.status === 'healthy'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : item.status === 'restricted'
                          ? 'bg-sky-500/20 text-sky-300'
                          : item.status === 'missing'
                          ? 'bg-red-500/20 text-red-300'
                          : 'bg-stone-800 text-stone-400'
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>
                  <p className="text-[10px] text-stone-400">{item.label}</p>
                  {item.count !== undefined && (
                    <p className="text-[10px] text-emerald-400 font-mono font-semibold">
                      {item.count} records verified
                    </p>
                  )}
                  {item.message && (
                    <p className="text-[9px] text-stone-500 truncate" title={item.message}>
                      {item.message}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Master SQL Provisioning Box */}
          <div className="bg-stone-950 border border-stone-800 rounded-xl p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded bg-emerald-500/20 border border-emerald-500 flex items-center justify-center text-emerald-400">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                    <span>Master PostgreSQL Schema & Storage Provisioning</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase">
                      Complete
                    </span>
                  </h3>
                  <p className="text-[11px] text-stone-400">
                    Consolidated SQL script for tables, RLS policies, storage buckets (<code>tour-media</code>), and auth triggers.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-stone-800">
              <span className="text-stone-400 font-mono text-[11px]">
                File: <code className="text-emerald-300">/complete_schema.sql</code> (~3,500 lines)
              </span>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setShowMasterSqlPreview(!showMasterSqlPreview)}
                  className="px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-stone-300 rounded border border-stone-700 text-xs font-medium transition-colors cursor-pointer"
                >
                  {showMasterSqlPreview ? 'Hide Script' : 'Preview SQL Script'}
                </button>
                <button
                  type="button"
                  onClick={copyMasterSql}
                  className="flex items-center space-x-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold shadow transition-colors cursor-pointer"
                >
                  {copiedMasterSql ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedMasterSql ? 'Copied Master SQL!' : 'Copy Master Schema & Seed SQL'}</span>
                </button>
              </div>
            </div>

            {showMasterSqlPreview && (
              <div className="mt-4 p-4 bg-stone-900 rounded border border-stone-800 space-y-2">
                <pre className="max-h-64 overflow-y-auto p-3 bg-stone-950 rounded text-[11px] font-mono text-stone-300 leading-relaxed whitespace-pre select-all">
                  {completeSchemaSql}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
      {activeTab === 'security' && isSuperAdmin && (
        <SuperAdminMfaPanel />
      )}
    </div>
  );
};
