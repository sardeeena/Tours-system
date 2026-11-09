import React from 'react';
import {
  LayoutDashboard,
  Compass,
  CalendarCheck,
  Users,
  MapPin,
  Layers,
  Calendar,
  Sparkles,
  Car,
  Star,
  Image,
  Globe,
  Settings,
  LogOut,
  ExternalLink,
  ChevronRight,
  Database,
  Plus,
  ShieldCheck,
  AlertTriangle,
  HelpCircle,
  Mail,
  Tag,
  FileText,
  Ship,
  Anchor,
  CloudSun,
  Printer,
  CreditCard,
  RotateCcw,
  DollarSign,
  TrendingUp,
  AlertCircle,
  MessageSquare,
  Bell,
  History,
  Menu,
  X,
  ChevronLeft,
  PanelLeftClose,
  PanelLeftOpen,
  Monitor,
  Tablet,
  Smartphone,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { isSupabaseConfigured, isSchemaMissing, subscribeSchemaMissing } from '../../services/supabaseClient';
import { PlatformIntegrationModal } from './PlatformIntegrationModal';

export type AdminTab =
  | 'dashboard'
  | 'dash_sales'
  | 'dash_ops'
  | 'dash_customers'
  | 'dash_finance'
  | 'dash_builder'
  | 'tours'
  | 'tour_new'
  | 'tour_edit'
  | 'bookings'
  | 'inquiries'
  | 'customers'
  | 'newsletter'
  | 'destinations'
  | 'categories'
  | 'availability'
  | 'extras'
  | 'pickup'
  | 'coupons'
  | 'faqs'
  | 'reviews'
  | 'media'
  | 'seo'
  | 'pages'
  | 'settings'
  | 'crm_dashboard'
  | 'crm_leads'
  | 'crm_customers'
  | 'crm_inquiries'
  | 'crm_tasks'
  | 'crm_followups'
  | 'crm_conversations'
  | 'crm_segments'
  | 'crm_timeline'
  | 'ops_departures'
  | 'ops_calendar'
  | 'ops_availability'
  | 'ops_manifests'
  | 'ops_pickups'
  | 'ops_vessels'
  | 'ops_guides'
  | 'ops_assignments'
  | 'ops_weather'
  | 'ops_documents'
  | 'fin_payments'
  | 'fin_invoices'
  | 'fin_refunds'
  | 'fin_balances'
  | 'fin_revenue'
  | 'fin_reports'
  | 'comm_email'
  | 'comm_whatsapp'
  | 'comm_templates'
  | 'comm_notifications'
  | 'comm_history';

interface AdminLayoutProps {
  activeTab: AdminTab;
  onSelectTab: (tabTab: AdminTab, param?: string) => void;
  onNavigateSite: () => void;
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  activeTab,
  onSelectTab,
  onNavigateSite,
  children,
}) => {
  const { user, signOut } = useAuth();
  const supabaseConnected = isSupabaseConfigured();
  const [schemaMissing, setSchemaMissingState] = React.useState(isSchemaMissing());
  const [isIntegrationModalOpen, setIsIntegrationModalOpen] = React.useState(false);

  // Sidebar open/close state (default open on desktop, auto-closed on small screens)
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);

  // Device mode & screen viewport detection (PC, Tablet, Phone)
  type DeviceMode = 'auto' | 'pc' | 'tablet' | 'phone';
  const [deviceMode, setDeviceMode] = React.useState<DeviceMode>('auto');
  const [screenDevice, setScreenDevice] = React.useState<'pc' | 'tablet' | 'phone'>('pc');

  React.useEffect(() => {
    const handleResize = () => {
      if (typeof window === 'undefined') return;
      const w = window.innerWidth;
      if (w < 768) {
        setScreenDevice('phone');
      } else if (w < 1024) {
        setScreenDevice('tablet');
      } else {
        setScreenDevice('pc');
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleNavSelect = (tabId: AdminTab) => {
    onSelectTab(tabId);
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  };

  React.useEffect(() => {
    return subscribeSchemaMissing((missing) => {
      setSchemaMissingState(missing);
    });
  }, []);

  const navItems: Array<{
    id: string;
    label: string;
    icon?: React.ComponentType<{ className?: string }>;
    isHeader?: boolean;
    children?: Array<{ id: string; label: string }>;
  }> = [
    {
      id: 'dashboard',
      label: 'Executive Dashboard',
      icon: LayoutDashboard,
      children: [
        { id: 'dashboard', label: '1. Executive Overview' },
        { id: 'dash_sales', label: '2. Sales Dashboard' },
        { id: 'dash_ops', label: '3. Operations Dashboard' },
        { id: 'dash_customers', label: '4. Customer Dashboard' },
        { id: 'dash_finance', label: '5. Finance Dashboard' },
        { id: 'dash_builder', label: '6. Report Builder' },
      ],
    },
    {
      id: 'tours',
      label: 'Tours & Excursions',
      icon: Compass,
      children: [
        { id: 'tours', label: 'All Tours' },
        { id: 'tour_new', label: 'Add New Tour' },
      ],
    },
    { id: 'bookings', label: 'Reservations & Bookings', icon: CalendarCheck },

    // OPERATIONS SECTION
    { id: 'header_ops', label: 'OPERATIONS & DISPATCH', isHeader: true },
    { id: 'ops_departures', label: "Today's Departures", icon: Anchor },
    { id: 'ops_calendar', label: 'Operations Calendar', icon: Calendar },
    { id: 'ops_availability', label: 'Availability & Capacity', icon: CalendarCheck },
    { id: 'ops_manifests', label: 'Passenger Manifests', icon: FileText },
    { id: 'ops_pickups', label: 'Pickup Schedule', icon: Car },
    { id: 'ops_vessels', label: 'Fleet & Vessels', icon: Ship },
    { id: 'ops_guides', label: 'Guides & Captains', icon: Users },
    { id: 'ops_assignments', label: 'Tour Assignments', icon: ShieldCheck },
    { id: 'ops_weather', label: 'Weather Bulletins', icon: CloudSun },
    { id: 'ops_documents', label: 'Operational Documents', icon: Printer },

    // FINANCE SECTION
    { id: 'header_finance', label: 'FINANCE & ACCOUNTING', isHeader: true },
    { id: 'fin_payments', label: 'Payments', icon: CreditCard },
    { id: 'fin_invoices', label: 'Invoices', icon: FileText },
    { id: 'fin_refunds', label: 'Refunds & Returns', icon: RotateCcw },
    { id: 'fin_balances', label: 'Outstanding Balances', icon: AlertCircle },
    { id: 'fin_revenue', label: 'Revenue Analysis', icon: DollarSign },
    { id: 'fin_reports', label: 'Financial Reports', icon: TrendingUp },

    // COMMUNICATIONS SECTION
    { id: 'header_comm', label: 'COMMUNICATIONS & DISPATCH', isHeader: true },
    { id: 'comm_email', label: 'Email Dispatcher', icon: Mail },
    { id: 'comm_whatsapp', label: 'WhatsApp Console', icon: MessageSquare },
    { id: 'comm_templates', label: 'Message Templates', icon: FileText },
    { id: 'comm_notifications', label: 'Staff Notifications', icon: Bell },
    { id: 'comm_history', label: 'Communication History', icon: History },

    // CRM SECTION
    { id: 'header_crm', label: 'CRM & TRAVELERS', isHeader: true },
    { id: 'crm_dashboard', label: 'CRM Dashboard', icon: LayoutDashboard },
    { id: 'crm_leads', label: 'Leads Pipeline', icon: Users },
    { id: 'customers', label: 'Customers Directory', icon: Users },
    { id: 'inquiries', label: 'Help Inquiries', icon: HelpCircle },
    { id: 'crm_tasks', label: 'Staff Tasks', icon: Calendar },
    { id: 'crm_followups', label: 'Follow-ups', icon: CalendarCheck },
    { id: 'crm_conversations', label: 'Conversations Log', icon: Mail },
    { id: 'crm_segments', label: 'Customer Segments', icon: Tag },
    { id: 'crm_timeline', label: 'Activity Timeline', icon: Sparkles },

    // CMS & SITE SETTINGS
    { id: 'header_cms', label: 'CATALOG & CMS', isHeader: true },
    { id: 'destinations', label: 'Destinations', icon: MapPin },
    { id: 'categories', label: 'Categories', icon: Layers },
    { id: 'media', label: 'Media Library', icon: Image },
    { id: 'pickup', label: 'Pickup Locations', icon: Car },
    { id: 'extras', label: 'Tour Extras', icon: Sparkles },
    { id: 'coupons', label: 'Coupons & Vouchers', icon: Tag },
    { id: 'faqs', label: 'FAQs Management', icon: HelpCircle },
    { id: 'reviews', label: 'Traveler Reviews', icon: Star },
    { id: 'seo', label: 'SEO & Meta Tags', icon: Globe },
    { id: 'pages', label: 'Pages & Content', icon: FileText },
    { id: 'newsletter', label: 'Newsletter', icon: Mail },
    { id: 'settings', label: 'Site Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-stone-900 text-stone-100 flex flex-col antialiased selection:bg-[#0A6C74] selection:text-white">
      {/* Top Warning Banner if Supabase is in local fallback mode */}
      {!supabaseConnected ? (
        <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 text-xs text-amber-300 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Supabase Connection:</strong> Currently utilizing local storage fallback. Connect your live Supabase project in{' '}
              <button
                type="button"
                onClick={() => onSelectTab('settings')}
                className="underline font-semibold hover:text-white"
              >
                Settings &gt; Supabase
              </button>{' '}
              to sync tours, bookings, and media with your cloud PostgreSQL database.
            </span>
          </div>
          <button
            type="button"
            onClick={() => onSelectTab('settings')}
            className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 rounded font-medium text-[11px] transition-colors"
          >
            Configure Keys
          </button>
        </div>
      ) : schemaMissing ? (
        <div className="bg-sky-500/10 border-b border-sky-500/30 px-4 py-2 text-xs text-sky-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Database className="w-4 h-4 text-sky-400 shrink-0" />
            <span>
              <strong>Supabase Connected (Migration Pending):</strong> Tables not yet detected in database schema. Run the Phase 4 SQL migration script in your Supabase SQL Editor to enable full table synchronization.
            </span>
          </div>
          <button
            type="button"
            onClick={() => onSelectTab('settings')}
            className="px-2.5 py-1 bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 rounded font-medium text-[11px] transition-colors"
          >
            View SQL Migration
          </button>
        </div>
      ) : null}

      <div className="flex-1 flex overflow-hidden relative">
        {/* Mobile/Tablet Backdrop when sidebar is open */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs z-40 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Sidebar */}
        <aside
          className={`
            fixed inset-y-0 left-0 z-50 w-64 max-w-[85vw] bg-stone-950 border-r border-stone-800 flex flex-col justify-between shrink-0 transition-all duration-300 ease-in-out
            lg:static lg:z-10
            ${isSidebarOpen ? 'translate-x-0 lg:w-64' : '-translate-x-full lg:w-0 lg:overflow-hidden lg:border-r-0'}
          `}
        >
          <div>
            {/* Brand Header with Close/Collapse Button */}
            <div className="p-4 border-b border-stone-800 flex items-center justify-between gap-2">
              <div className="flex items-center space-x-3 min-w-0">
                <img 
                  src="/logo.png" 
                  alt="Awesome Adventure Tours Logo" 
                  className="h-10 w-auto object-contain shrink-0 drop-shadow-xs"
                />
                <div className="min-w-0">
                  <span className="text-[9px] uppercase tracking-widest text-[#0A6C74] font-bold block">
                    Admin Portal
                  </span>
                  <h1 className="font-display font-bold text-sm text-white tracking-wide truncate">
                    Awesome Adventure Tours
                  </h1>
                </div>
              </div>

              {/* Close/Collapse Button */}
              <button
                type="button"
                onClick={() => setIsSidebarOpen(false)}
                className="p-1.5 text-stone-400 hover:text-white hover:bg-stone-800 rounded-lg transition-colors cursor-pointer shrink-0"
                title="Close / Collapse Sidebar"
                aria-label="Close sidebar"
              >
                <ChevronLeft className="w-5 h-5 hidden lg:block" />
                <X className="w-5 h-5 lg:hidden" />
              </button>
            </div>

            {/* Quick Action: New Tour */}
            <div className="p-3">
              <button
                type="button"
                onClick={() => handleNavSelect('tour_new')}
                className="w-full flex items-center justify-center space-x-2 py-2 px-3 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded-md text-xs font-semibold shadow transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create New Tour</span>
              </button>
            </div>

            {/* Navigation links */}
            <nav className="p-3 space-y-1 text-xs overflow-y-auto max-h-[calc(100vh-190px)] scrollbar-thin scrollbar-thumb-stone-800">
              {navItems.map((item) => {
                if (item.isHeader) {
                  return (
                    <div
                      key={item.id}
                      className="pt-3 pb-1 px-3 text-[9px] font-bold uppercase tracking-wider text-stone-500 border-t border-stone-800/80 mt-2 first:mt-0 first:border-0"
                    >
                      {item.label}
                    </div>
                  );
                }

                const Icon = item.icon || ChevronRight;
                const isCurrent = activeTab === item.id || (item.children && item.children.some((c) => c.id === activeTab));

                return (
                  <div key={item.id} className="space-y-0.5">
                    <button
                      type="button"
                      onClick={() => handleNavSelect(item.id as AdminTab)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-md transition-colors cursor-pointer ${
                        isCurrent
                          ? 'bg-stone-800/90 text-white font-semibold'
                          : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5">
                        <Icon className={`w-4 h-4 ${isCurrent ? 'text-[#2dd4bf]' : 'text-stone-400'}`} />
                        <span>{item.label}</span>
                      </div>
                      {isCurrent && <ChevronRight className="w-3.5 h-3.5 text-stone-500" />}
                    </button>

                    {/* Sub-items */}
                    {item.children && isCurrent && (
                      <div className="ml-7 pl-2 border-l border-stone-800 space-y-0.5 py-1">
                        {item.children.map((sub) => (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => handleNavSelect(sub.id as AdminTab)}
                            className={`w-full text-left py-1 px-2 rounded text-[11px] transition-colors cursor-pointer ${
                              activeTab === sub.id
                                ? 'text-[#2dd4bf] font-medium bg-stone-800/40'
                                : 'text-stone-400 hover:text-stone-200'
                            }`}
                          >
                            {sub.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          </div>

          {/* User Profile & Footer */}
          <div className="p-3 border-t border-stone-800 space-y-2">
            <div className="flex items-center space-x-2 px-2 py-1.5 rounded bg-stone-900/60">
              <div className="w-7 h-7 rounded-full bg-[#0A6C74] text-white flex items-center justify-center font-bold text-xs">
                {user?.fullName?.charAt(0) || 'A'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-stone-200 truncate">{user?.fullName || 'Admin Officer'}</p>
                <p className="text-[10px] text-stone-400 truncate">{user?.email || 'admin@awesomeadventuretours.com'}</p>
              </div>
              <span className="text-[9px] px-1.5 py-0.5 uppercase tracking-wide bg-stone-800 text-stone-300 rounded font-semibold">
                {user?.role || 'admin'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsIntegrationModalOpen(true)}
              className="w-full flex items-center justify-center space-x-1.5 py-1.5 px-2 bg-[#0A6C74]/20 hover:bg-[#0A6C74]/30 text-[#2dd4bf] border border-[#0A6C74]/40 rounded text-[11px] font-semibold transition-colors cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Integration Simulation Suite</span>
            </button>

            <div className="grid grid-cols-2 gap-1 pt-1">
              <button
                type="button"
                onClick={onNavigateSite}
                className="flex items-center justify-center space-x-1 py-1.5 px-2 bg-stone-900 hover:bg-stone-800 text-stone-300 hover:text-white rounded text-[11px] transition-colors cursor-pointer"
                title="View Live Website"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Live Site</span>
              </button>

              <button
                type="button"
                onClick={() => signOut()}
                className="flex items-center justify-center space-x-1 py-1.5 px-2 bg-stone-900 hover:bg-red-950/40 text-stone-400 hover:text-red-300 rounded text-[11px] transition-colors cursor-pointer"
                title="Sign out of CMS"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto bg-stone-900 flex flex-col min-w-0">
          {/* Top Admin Bar with Sidebar Open/Close Button & Device Controls */}
          <header className="sticky top-0 z-20 bg-stone-950/95 backdrop-blur-md border-b border-stone-800 px-3 sm:px-5 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
            {/* Left: Open/Close Sidebar button & Active Tab */}
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={() => setIsSidebarOpen((prev) => !prev)}
                className="flex items-center space-x-2 px-2.5 py-1.5 bg-stone-900 hover:bg-stone-800 text-stone-200 hover:text-white rounded-lg text-xs font-medium border border-stone-700/80 transition-colors shadow-2xs cursor-pointer"
                title={isSidebarOpen ? 'Close sidebar' : 'Open sidebar'}
                aria-label={isSidebarOpen ? 'Close sidebar' : 'Open sidebar'}
              >
                {isSidebarOpen ? (
                  <>
                    <PanelLeftClose className="w-4 h-4 text-[#2dd4bf]" />
                    <span className="hidden sm:inline">Close Sidebar</span>
                  </>
                ) : (
                  <>
                    <PanelLeftOpen className="w-4 h-4 text-[#2dd4bf]" />
                    <span>Open Sidebar</span>
                  </>
                )}
              </button>

              <div className="hidden sm:flex items-center space-x-1.5 text-xs text-stone-400">
                <span className="text-stone-500">Awesome Adventure Tours</span>
                <span>/</span>
                <span className="text-white font-medium capitalize">
                  {activeTab.replace(/^(dash_|crm_|ops_|fin_|comm_)/, '').replace(/_/g, ' ')}
                </span>
              </div>
            </div>

            {/* Right: Device Detection & Viewport Switcher */}
            <div className="flex items-center space-x-2 sm:space-x-3">
              {/* Current Device Live Indicator */}
              <div 
                className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-stone-900 border border-stone-800 text-xs shadow-2xs"
                title={`Active detected device: ${screenDevice.toUpperCase()}`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-stone-400 text-[11px] hidden md:inline">Current Device:</span>
                <span className="text-stone-200 font-semibold text-[11px] uppercase flex items-center gap-1">
                  {screenDevice === 'phone' ? (
                    <>
                      <Smartphone className="w-3.5 h-3.5 text-sky-400" />
                      Phone
                    </>
                  ) : screenDevice === 'tablet' ? (
                    <>
                      <Tablet className="w-3.5 h-3.5 text-amber-400" />
                      Tablet
                    </>
                  ) : (
                    <>
                      <Monitor className="w-3.5 h-3.5 text-emerald-400" />
                      PC
                    </>
                  )}
                </span>
              </div>

              {/* Device Viewport Mode Switcher (PC, Tablet, Phone) */}
              <div className="flex items-center bg-stone-900 rounded-lg p-0.5 border border-stone-800 text-xs shadow-2xs">
                <button
                  type="button"
                  onClick={() => setDeviceMode('auto')}
                  className={`px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                    deviceMode === 'auto'
                      ? 'bg-[#0A6C74] text-white shadow-xs'
                      : 'text-stone-400 hover:text-stone-200'
                  }`}
                  title="Auto responsive mode based on browser window"
                >
                  Auto
                </button>
                <button
                  type="button"
                  onClick={() => setDeviceMode('pc')}
                  className={`flex items-center space-x-1 px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                    deviceMode === 'pc'
                      ? 'bg-[#0A6C74] text-white shadow-xs'
                      : 'text-stone-400 hover:text-stone-200'
                  }`}
                  title="Desktop PC mode (Full Width)"
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">PC</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDeviceMode('tablet')}
                  className={`flex items-center space-x-1 px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                    deviceMode === 'tablet'
                      ? 'bg-[#0A6C74] text-white shadow-xs'
                      : 'text-stone-400 hover:text-stone-200'
                  }`}
                  title="Tablet mode (768px layout)"
                >
                  <Tablet className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Tablet</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDeviceMode('phone')}
                  className={`flex items-center space-x-1 px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                    deviceMode === 'phone'
                      ? 'bg-[#0A6C74] text-white shadow-xs'
                      : 'text-stone-400 hover:text-stone-200'
                  }`}
                  title="Phone mode (390px mobile layout)"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Phone</span>
                </button>
              </div>
            </div>
          </header>

          {/* Active Device Mode Banner when simulated */}
          {deviceMode !== 'auto' && (
            <div className="bg-[#0A6C74]/15 border-b border-[#0A6C74]/30 px-4 py-1.5 text-xs text-teal-200 flex items-center justify-between">
              <span className="flex items-center space-x-1.5">
                <span className="font-semibold uppercase tracking-wider text-[10px] bg-[#0A6C74] text-white px-1.5 py-0.5 rounded">
                  {deviceMode.toUpperCase()} VIEWPORT MODE
                </span>
                <span>Inspecting and fixing admin dashboard layout in {deviceMode} viewport.</span>
              </span>
              <button
                type="button"
                onClick={() => setDeviceMode('auto')}
                className="text-[11px] underline hover:text-white cursor-pointer"
              >
                Reset to Auto
              </button>
            </div>
          )}

          {/* Main View Container with device container sizing */}
          <div className="flex-1 p-3 sm:p-5 md:p-8 overflow-x-auto flex justify-center">
            <div
              className={`w-full transition-all duration-300 ${
                deviceMode === 'phone'
                  ? 'max-w-[390px] bg-stone-950/80 rounded-3xl border-4 border-stone-700 shadow-2xl p-3 sm:p-4 my-2'
                  : deviceMode === 'tablet'
                  ? 'max-w-[768px] bg-stone-950/80 rounded-2xl border-4 border-stone-700 shadow-2xl p-4 sm:p-6 my-2'
                  : 'max-w-7xl'
              }`}
            >
              {children}
            </div>
          </div>
        </main>
      </div>

      {/* Platform Integration Simulation Suite Modal */}
      <PlatformIntegrationModal
        isOpen={isIntegrationModalOpen}
        onClose={() => setIsIntegrationModalOpen(false)}
      />
    </div>
  );
};
