import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface AdminLoadErrorProps {
  message: string;
  onRetry: () => void | Promise<void>;
}

export const AdminLoadError: React.FC<AdminLoadErrorProps> = ({ message, onRetry }) => (
  <div role="alert" aria-live="polite" className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-950/20 px-4 py-3">
    <div className="flex items-start gap-3 min-w-0">
      <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-red-200">Live records could not be loaded</p>
        <p className="text-xs text-red-200/80 mt-1 break-words">{message}</p>
      </div>
    </div>
    <button type="button" onClick={() => { void onRetry(); }} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-[#0A6C74] px-3 py-2 text-xs font-semibold text-white hover:bg-[#08565C]">
      <RefreshCw className="w-3.5 h-3.5" /> Retry
    </button>
  </div>
);
