import { useCallback, useEffect, useState } from 'react';
import { listInquiryAssignees, InquiryAssignee } from '../services/inquiryService';

/**
 * Loads the live, permission-filtered staff directory used by CRM assignment
 * controls. Production UI never invents staff names or local demo assignees.
 */
export function useCrmAssignableStaff() {
  const [staffMembers, setStaffMembers] = useState<InquiryAssignee[]>([]);
  const [staffLoading, setStaffLoading] = useState(true);
  const [staffError, setStaffError] = useState<string | null>(null);

  const refreshStaff = useCallback(async () => {
    setStaffLoading(true);
    setStaffError(null);
    try {
      const rows = await listInquiryAssignees();
      setStaffMembers(rows);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load the staff directory.';
      setStaffError(message);
      setStaffMembers([]);
    } finally {
      setStaffLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshStaff();
  }, [refreshStaff]);

  return { staffMembers, staffLoading, staffError, refreshStaff };
}
