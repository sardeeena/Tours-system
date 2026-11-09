import React from 'react';
import { ManagementReportingDashboard } from './reporting/ManagementReportingDashboard';
import { DashboardViewMode } from '../../types/reporting';
import { AdminTab } from './AdminLayout';

interface AdminDashboardProps {
  onNavigateTab: (tab: AdminTab, param?: string) => void;
  onPreviewTour: (slug: string) => void;
  initialViewMode?: DashboardViewMode;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onNavigateTab,
  onPreviewTour,
  initialViewMode = 'executive',
}) => {
  return (
    <ManagementReportingDashboard
      onNavigateTab={onNavigateTab}
      onPreviewTour={onPreviewTour}
      initialViewMode={initialViewMode}
    />
  );
};
