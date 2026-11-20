import React from 'react';
import {
  LayoutDashboard,
  Activity,
  Compass,
  CalendarCheck,
  Users,
  MapPin,
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
  ChevronDown,
  Layers,
  Database,
  Plus,
  ShieldCheck,
  AlertTriangle,
  HelpCircle,
  Mail,
  Send,
  Tag,
  FileText,
  BookOpen,
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
  Moon,
  Sun,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { isSupabaseConfigured, isSchemaMissing, subscribeSchemaMissing } from '../../services/supabaseClient';
import { AdminSectionManual } from './AdminSectionManual';

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
  | 'tickets'
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
  | 'translations'
  | 'blog'
  | 'settings'
  | 'access_control'
  | 'technical'
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
  | 'comm_center'
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
  const { user, signOut, hasPermission } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const supabaseConnected = isSupabaseConfigured();
  const [schemaMissing, setSchemaMissingState] = React.useState(isSchemaMissing());
  const [collapsedSections, setCollapsedSections] = React.useState<Record<string, boolean>>({ header_core: false, header_ops: true, header_finance: true, header_comm: true, header_crm: true, header_cms: true, header_security: true });

  // Sidebar open/close state (default open on desktop, auto-closed on small screens)
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(() => typeof window === 'undefined' || window.innerWidth >= 1024);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && window.innerWidth < 1024) setIsSidebarOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  React.useEffect(() => {
    const handleResize = () => {
      if (typeof window === 'undefined') return;
      // Keep the navigation drawer closed on touch-sized viewports.
      if (window.innerWidth < 1024) setIsSidebarOpen(false);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  React.useEffect(() => {
    const activeIndex = navItems.findIndex((item) => item.id === activeTab || item.children?.some((child) => child.id === activeTab));
    if (activeIndex < 0) return;
    const section = navItems.slice(0, activeIndex + 1).reverse().find((item) => item.isHeader);
    if (section) setCollapsedSections((previous) => ({ ...previous, [section.id]: false }));
  }, [activeTab]);

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
    { id: 'header_core', label: 'OVERVIEW & SALES', isHeader: true },
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
    { id: 'tickets', label: 'Support Tickets', icon: MessageSquare },

    // OPERATIONS SECTION
    { id: 'header_ops', label: 'OPERATIONS', isHeader: true },
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
    { id: 'header_finance', label: 'FINANCE', isHeader: true },
    { id: 'fin_payments', label: 'Payments', icon: CreditCard },
    { id: 'fin_invoices', label: 'Invoices', icon: FileText },
    { id: 'fin_refunds', label: 'Refunds & Returns', icon: RotateCcw },
    { id: 'fin_balances', label: 'Outstanding Balances', icon: AlertCircle },
    { id: 'fin_revenue', label: 'Revenue Analysis', icon: DollarSign },
    { id: 'fin_reports', label: 'Financial Reports', icon: TrendingUp },

    // COMMUNICATIONS SECTION
    { id: 'header_comm', label: 'MESSAGES & COMMUNICATIONS', isHeader: true },
    { id: 'comm_center', label: 'Email Center', icon: Mail },
    { id: 'comm_email', label: 'Email Dispatcher', icon: Send },
    { id: 'comm_whatsapp', label: 'WhatsApp Console', icon: MessageSquare },
    { id: 'comm_templates', label: 'Message Templates', icon: FileText },
    { id: 'comm_notifications', label: 'Staff Notifications', icon: Bell },
    { id: 'comm_history', label: 'Communication History', icon: History },

    // CRM SECTION
    { id: 'header_crm', label: 'CUSTOMERS & CRM', isHeader: true },
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
    { id: 'header_cms', label: 'WEBSITE CONTENT', isHeader: true },
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
    { id: 'translations', label: 'Translations & Locales', icon: Globe },
    { id: 'blog', label: 'Blog & Journal', icon: BookOpen },
    { id: 'newsletter', label: 'Newsletter', icon: Mail },
    // SECURITY & ACCESS CONTROL
    { id: 'header_security', label: 'ADMINISTRATION & SECURITY', isHeader: true },
    { id: 'access_control', label: 'Users, Roles & Permissions', icon: ShieldCheck },
    { id: 'settings', label: 'Site Settings', icon: Settings },
    { id: 'technical', label: 'Technical Control Center', icon: Activity },
  ];

  const requiredPermission = (id: string): string | null => {
    if (id === 'blog') return 'content.manage';
    if (id === 'access_control') return 'users.manage';
    if (id === 'dashboard' || id === 'dash_sales') return 'analytics.read';
    if (id === 'dash_ops' || id.startsWith('ops_') || id === 'availability' || id === 'pickup') return 'operations.read';
    if (id === 'dash_customers') return 'customers.read';
    if (id === 'dash_finance' || id.startsWith('fin_')) return 'finance.read';
    if (id === 'dash_builder') return 'analytics.manage';
    if (id === 'tours') return 'tours.read';
    if (id === 'tour_new') return 'tours.create';
    if (id === 'tour_edit') return 'tours.update';
    if (id === 'bookings') return 'bookings.read';
    if (id === 'tickets') return 'tickets.read';
    if (id === 'customers') return 'customers.read';
    if (id.startsWith('crm_') || id === 'inquiries') return 'crm.read';
    if (id === 'comm_templates') return 'communications.manage';
    if (id.startsWith('comm_')) return 'communications.read';
    if (['destinations','categories','newsletter','extras','faqs','reviews','media','seo','pages','translations'].includes(id)) return 'content.read';
    if (id === 'coupons') return 'bookings.read';
    if (id === 'settings') return 'settings.manage';
    return null;
  };
  const canManageAccess = Boolean(user?.roles?.includes('admin') || user?.roles?.includes('super_admin') || user?.role === 'admin' || user?.role === 'super_admin');
  const isSuperAdmin = Boolean(user?.roles?.includes('super_admin') || user?.role === 'super_admin');
  const canSeeTab = (id: string) => id === 'technical' || id === 'settings'
    ? isSuperAdmin
    : id === 'translations'
      ? isSuperAdmin
      : id === 'access_control'
      ? canManageAccess
      : (() => { const required = requiredPermission(id); return !required || hasPermission(required); })();

  const visibleNavItems = navItems.flatMap((item, index) => {
    if (item.isHeader) {
      const laterItems = navItems.slice(index + 1);
      const nextSection = laterItems.slice(0, laterItems.findIndex((entry) => entry.isHeader) < 0 ? laterItems.length : laterItems.findIndex((entry) => entry.isHeader));
      return nextSection.some((entry) => canSeeTab(entry.id) || entry.children?.some((child) => canSeeTab(child.id))) ? [item] : [];
    }
    const children = item.children?.filter((child) => canSeeTab(child.id));
    return canSeeTab(item.id) || Boolean(children?.length) ? [{ ...item, children }] : [];
  });
  const activePermission = requiredPermission(activeTab);
  const canAccessActiveTab = activeTab === 'technical' || activeTab === 'settings'
    ? isSuperAdmin
    : activeTab === 'translations'
      ? isSuperAdmin
      : activeTab === 'access_control'
      ? canManageAccess
      : !activePermission || hasPermission(activePermission);

  let activeNavSection: string | null = null;

  return (
    <div className="admin-shell min-h-screen flex flex-col antialiased selection:bg-[#0A6C74] selection:text-white">
      {/* Clear operational warning; implementation details stay in the restricted technical area. */}
      {!supabaseConnected ? (
        <div role="status" className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 text-xs text-amber-800 dark:text-amber-200 flex items-center justify-between gap-3">
          <span>Live information is temporarily unavailable. Some changes may not be saved. Please contact your administrator.</span>
          {isSuperAdmin && (
            <button type="button" onClick={() => onSelectTab('technical')} className="shrink-0 underline font-semibold">
              View system status
            </button>
          )}
        </div>
      ) : schemaMissing ? (
        <div role="status" className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 text-xs text-amber-800 dark:text-amber-200 flex items-center justify-between gap-3">
          <span>Some system features are not ready yet. Please contact your administrator before making changes.</span>
          {isSuperAdmin && (
            <button type="button" onClick={() => onSelectTab('technical')} className="shrink-0 underline font-semibold">
              View system status
            </button>
          )}
        </div>
      ) : null}

      <div className="flex-1 flex overflow-hidden relative">
        {/* Mobile/Tablet Backdrop when sidebar is open */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs z-40 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Sidebar */}
        <aside
          className={`
            fixed inset-y-0 left-0 z-50 h-dvh w-72 max-w-[88vw] bg-white dark:bg-[#101B28] border-r border-[#E5EAF0] dark:border-[#243447] flex flex-col overflow-hidden shrink-0 transition-all duration-300 ease-in-out shadow-lg
            lg:static lg:z-10
            ${isSidebarOpen ? 'translate-x-0 lg:w-72' : '-translate-x-full lg:w-0 lg:overflow-hidden lg:border-r-0'}
          `}
        >
          <div className="flex min-h-0 flex-1 flex-col">
            {/* Brand Header with Close/Collapse Button */}
            <div className="p-4 border-b border-[#E8E3DA] dark:border-[#1F3854] flex items-center justify-between gap-2">
              <div className="flex items-center space-x-3 min-w-0">
                <img 
                  src="/logo.png" 
                  alt="Awesome Adventure Tours Logo" 
                  className="h-9 w-auto object-contain shrink-0 drop-shadow-xs"
                />
                <div className="min-w-0">
                  <span className="text-[10px] uppercase tracking-widest text-[#0A6C74] dark:text-[#2DD4BF] font-bold block">
                    Admin Portal
                  </span>
                  <h1 className="font-display font-bold text-sm text-[#0E1B2A] dark:text-white tracking-wide truncate">
                    Awesome Adventure Tours
                  </h1>
                </div>
              </div>

              {/* Close/Collapse Button */}
              <button
                type="button"
                onClick={() => setIsSidebarOpen(false)}
                className="p-1.5 text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-[#16283D] rounded-xl transition-colors cursor-pointer shrink-0"
                title="Close / Collapse Sidebar"
                aria-label="Close sidebar"
              >
                <ChevronLeft className="w-5 h-5 hidden lg:block" />
                <X className="w-5 h-5 lg:hidden" />
              </button>
            </div>

            {/* Quick Action: New Tour */}
            {hasPermission('tours.manage') && <div className="p-3">
              <button
                type="button"
                onClick={() => handleNavSelect('tour_new')}
                className="w-full flex items-center justify-center space-x-2 py-2.5 px-3 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create New Tour</span>
              </button>
            </div>}

            {/* Navigation links */}
            <nav aria-label="Admin navigation" className="admin-nav min-h-0 flex-1 overflow-y-auto overscroll-contain p-3.5 space-y-1.5 text-[13px] scrollbar-thin scrollbar-thumb-stone-200 dark:scrollbar-thumb-stone-800">
              {visibleNavItems.map((item) => {
                if (item.isHeader) {
                  activeNavSection = item.id;
                  const isCollapsed = Boolean(collapsedSections[item.id]);
                  return (
                    <button key={item.id} type="button" aria-expanded={!isCollapsed}
                      onClick={() => setCollapsedSections((previous) => ({ ...previous, [item.id]: !previous[item.id] }))}
                      className="w-full min-h-11 flex items-center justify-between text-left pt-3 pb-1 px-3 text-[10px] font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500 border-t border-[#E8E3DA]/80 dark:border-[#1F3854]/80 mt-2 first:mt-0 first:border-0 hover:text-[#0A6C74] dark:hover:text-[#2DD4BF]">
                      <span>{item.label}</span>
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                    </button>
                  );
                }
                if (activeNavSection && collapsedSections[activeNavSection]) return null;

                const Icon = item.icon || ChevronRight;
                const isCurrent = activeTab === item.id || (item.children && item.children.some((c) => c.id === activeTab));

                return (
                  <div key={item.id} className="space-y-0.5">
                    <button
                      type="button"
                      onClick={() => handleNavSelect((canSeeTab(item.id) ? item.id : (item.children?.[0]?.id || item.id)) as AdminTab)}
                      className={`w-full min-h-11 flex items-center justify-between px-3 py-2 rounded-xl transition-all cursor-pointer ${
                        isCurrent
                          ? 'bg-[#0A6C74] text-white font-semibold shadow-xs'
                          : 'text-stone-600 dark:text-stone-300 hover:text-[#0A6C74] dark:hover:text-white hover:bg-[#FAF8F5] dark:hover:bg-[#16283D]'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5">
                        <Icon className={`w-4 h-4 ${isCurrent ? 'text-white' : 'text-stone-400 dark:text-stone-400'}`} />
                        <span>{item.label}</span>
                      </div>
                      {isCurrent && <ChevronRight className="w-3.5 h-3.5 text-white/80" />}
                    </button>

                    {/* Sub-items */}
                    {item.children && isCurrent && (
                      <div className="ml-7 pl-2 border-l border-[#E8E3DA] dark:border-[#1F3854] space-y-0.5 py-1">
                        {item.children.map((sub) => (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => handleNavSelect(sub.id as AdminTab)}
                            className={`w-full min-h-10 text-left py-2 px-2.5 rounded-lg text-[11px] transition-colors cursor-pointer ${
                              activeTab === sub.id
                                ? 'text-[#0A6C74] dark:text-[#2DD4BF] font-semibold bg-[#E8F3F4] dark:bg-[#0A6C74]/20'
                                : 'text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-[#16283D]'
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
          <div className="shrink-0 p-3 border-t border-[#E8E3DA] dark:border-[#1F3854] space-y-2 bg-white dark:bg-[#101B28]">
            <div className="flex items-center space-x-2 px-2.5 py-2 rounded-xl bg-[#FAF8F5] dark:bg-[#111E2E] border border-[#E8E3DA] dark:border-[#1F3854]">
              <div className="w-8 h-8 rounded-full bg-[#0A6C74] text-white flex items-center justify-center font-bold text-xs shadow-xs">
                {user?.fullName?.charAt(0) || 'A'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-[#0E1B2A] dark:text-stone-200 truncate">{user?.fullName || 'Admin Officer'}</p>
                <p className="text-[10px] text-stone-500 dark:text-stone-400 truncate">{user?.email || 'Signed-in staff'}</p>
              </div>
              <span className="text-[9px] px-1.5 py-0.5 uppercase tracking-wide bg-[#E8F3F4] text-[#0A6C74] dark:bg-[#0A6C74]/20 dark:text-[#2DD4BF] rounded-md font-semibold">
                {user?.roles?.filter((role) => role !== 'customer').join(' · ') || user?.role || 'admin'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5 pt-1">
              <button
                type="button"
                onClick={onNavigateSite}
                className="flex items-center justify-center space-x-1 py-1.5 px-2 bg-white dark:bg-[#16283D] border border-[#E8E3DA] dark:border-[#1F3854] hover:border-[#0A6C74] text-stone-700 dark:text-stone-300 hover:text-[#0A6C74] rounded-xl text-[11px] font-medium transition-colors cursor-pointer shadow-2xs"
                title="View Live Website"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Live Site</span>
              </button>

              <button
                type="button"
                onClick={() => signOut()}
                className="flex items-center justify-center space-x-1 py-1.5 px-2 bg-white dark:bg-[#16283D] border border-[#E8E3DA] dark:border-[#1F3854] hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:border-rose-300 text-stone-700 dark:text-stone-300 hover:text-rose-600 rounded-xl text-[11px] font-medium transition-colors cursor-pointer shadow-2xs"
                title="Sign out of CMS"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="admin-main flex-1 overflow-y-auto flex flex-col min-w-0">
          {/* Top Admin Bar with Sidebar Open/Close Button & Device Controls */}
          <header className="admin-topbar sticky top-0 z-20 bg-white/95 dark:bg-[#101B28]/95 backdrop-blur-md border-b border-[#E5EAF0] dark:border-[#243447] px-4 sm:px-6 xl:px-8 py-3.5 flex flex-wrap items-center justify-between gap-3.5 shrink-0">
            {/* Left: Open/Close Sidebar button & Active Tab */}
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={() => setIsSidebarOpen((prev) => !prev)}
                className="flex min-h-10 items-center space-x-2 px-3 py-1.5 bg-[#FAF8F5] dark:bg-[#16283D] hover:bg-white dark:hover:bg-[#1F3854] text-stone-700 dark:text-stone-200 hover:text-[#0A6C74] dark:hover:text-[#2DD4BF] rounded-xl text-xs font-semibold border border-[#E8E3DA] dark:border-[#1F3854] transition-colors shadow-2xs cursor-pointer"
                title={isSidebarOpen ? 'Close sidebar' : 'Open sidebar'}
                aria-label={isSidebarOpen ? 'Close sidebar' : 'Open sidebar'}
              >
                {isSidebarOpen ? (
                  <>
                    <PanelLeftClose className="w-4 h-4 text-[#0A6C74] dark:text-[#2DD4BF]" />
                    <span className="hidden sm:inline">Close Sidebar</span>
                  </>
                ) : (
                  <>
                    <PanelLeftOpen className="w-4 h-4 text-[#0A6C74] dark:text-[#2DD4BF]" />
                    <span>Open Sidebar</span>
                  </>
                )}
              </button>

              <div className="hidden sm:flex items-center space-x-2 text-xs text-stone-500 dark:text-stone-400">
                <span className="font-semibold text-[#0A6C74] dark:text-[#2DD4BF]">Awesome Adventure Tours</span>
                <span>/</span>
                <span className="text-[#0E1B2A] dark:text-white font-semibold capitalize font-display">
                  {activeTab.replace(/^(dash_|crm_|ops_|fin_|comm_)/, '').replace(/_/g, ' ')}
                </span>
              </div>
            </div>

            {/* Right: Primary destination and appearance controls */}
            <div className="flex items-center flex-wrap gap-2 sm:gap-3">
              <AdminSectionManual activeTab={activeTab} />
              <button
                type="button"
                onClick={onNavigateSite}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#0A6C74] px-3.5 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-[#08565C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A6C74] focus-visible:ring-offset-2"
                title="Open the live public website"
                aria-label="Go to live website"
              >
                <ExternalLink className="h-4 w-4" />
                <span>Live Website</span>
              </button>
              <button
                type="button"
                onClick={toggleTheme}
                aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
                title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
                className="inline-flex items-center gap-2 rounded-xl border border-[#DCE3EC] dark:border-[#405A74] bg-white dark:bg-[#162638] px-3 py-2 text-xs font-semibold text-[#263449] dark:text-[#E2E8F0] hover:bg-[#F1F4F8] dark:hover:bg-[#1B3045] transition-colors"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-[#086B70] dark:text-[#42C9BE]" />}
                <span className="hidden sm:inline">{theme === 'dark' ? 'Light theme' : 'Dark theme'}</span>
              </button>


            </div>
          </header>

          {/* Main dashboard content */}
          <div className="admin-content flex-1 w-full min-w-0 p-4 sm:p-6 xl:p-8 overflow-x-auto flex justify-center">
            <div className="w-full max-w-[1600px]">
              {canAccessActiveTab ? children : (
                <div className="max-w-xl mx-auto my-12 rounded-2xl border border-amber-300/70 bg-amber-50 dark:bg-amber-950/20 p-6 text-center">
                  <ShieldCheck className="w-8 h-8 mx-auto text-amber-600 dark:text-amber-300 mb-3" />
                  <h2 className="font-bold text-lg">Access restricted</h2>
                  <p className="text-sm text-stone-600 dark:text-stone-300 mt-2">Your assigned roles do not grant permission to open this section. Contact a system administrator if you need access.</p>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

    </div>
  );
};
