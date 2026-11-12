import React from 'react';
import {
  LayoutDashboard,
  Activity,
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
  Monitor,
  Tablet,
  Smartphone,
  Moon,
  Sun,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
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
  const [isIntegrationModalOpen, setIsIntegrationModalOpen] = React.useState(false);

  // Sidebar open/close state (default open on desktop, auto-closed on small screens)
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(() => typeof window === 'undefined' || window.innerWidth >= 1024);

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
      // Keep the navigation drawer closed on touch-sized viewports.
      if (w < 1024) setIsSidebarOpen(false);
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
    { id: 'tickets', label: 'Support Tickets', icon: MessageSquare },

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
    { id: 'comm_center', label: 'Email Center', icon: Mail },
    { id: 'comm_email', label: 'Email Dispatcher', icon: Send },
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
    { id: 'blog', label: 'Blog & Journal', icon: BookOpen },
    { id: 'newsletter', label: 'Newsletter', icon: Mail },
    { id: 'settings', label: 'Site Settings', icon: Settings },

    // SECURITY & ACCESS CONTROL
    { id: 'header_security', label: 'SECURITY & ACCESS', isHeader: true },
    { id: 'access_control', label: 'Users, Roles & Permissions', icon: ShieldCheck },
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
    if (['destinations','categories','newsletter','extras','faqs','reviews','media','seo','pages'].includes(id)) return 'content.read';
    if (id === 'coupons') return 'bookings.read';
    if (id === 'settings') return 'settings.manage';
    return null;
  };
  const canManageAccess = Boolean(user?.roles?.includes('admin') || user?.roles?.includes('super_admin') || user?.role === 'admin' || user?.role === 'super_admin');
  const isSuperAdmin = Boolean(user?.roles?.includes('super_admin') || user?.role === 'super_admin');
  const canSeeTab = (id: string) => id === 'technical'
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
  const canAccessActiveTab = activeTab === 'technical'
    ? isSuperAdmin
    : activeTab === 'access_control'
      ? canManageAccess
      : !activePermission || hasPermission(activePermission);

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

      {/* Platform Integration Simulation Suite Modal */}
      <PlatformIntegrationModal
        isOpen={isIntegrationModalOpen}
        onClose={() => setIsIntegrationModalOpen(false)}
      />
    </div>
  );
};
