/**
 * Security & Validation Types
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export interface RateLimitState {
  attempts: number;
  maxAttempts: number;
  isLocked: boolean;
  lockExpiresAt: number | null;
  remainingSeconds: number;
}

export interface SanitizedCustomerInput {
  fullName: string;
  email: string;
  phone: string;
  hotelName: string;
  roomNumber?: string;
  specialRequests?: string;
}

export interface SecurityAuditEntry {
  timestamp: string;
  action: string;
  status: 'allowed' | 'blocked' | 'warning';
  ipOrClient: string;
  details?: Record<string, unknown>;
}
