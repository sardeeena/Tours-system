import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'info' | 'error';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const DEFAULT_DURATIONS: Record<ToastType, number> = {
  success: 4500,
  info: 5000,
  error: 7000,
};

const ToastMessage: React.FC<{ toast: ToastItem; onDismiss: (id: string) => void }> = ({ toast, onDismiss }) => {
  useEffect(() => {
    if (toast.duration <= 0) return;
    const timeout = window.setTimeout(() => onDismiss(toast.id), toast.duration);
    return () => window.clearTimeout(timeout);
  }, [toast.id, toast.duration, onDismiss]);

  const isError = toast.type === 'error';
  const isSuccess = toast.type === 'success';

  return (
    <motion.div
      layout
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      aria-atomic="true"
      initial={{ opacity: 0, y: -12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ duration: 0.18 }}
      className={`pointer-events-auto flex w-full items-start gap-3 rounded-xl border p-4 text-sm font-medium shadow-2xl ring-1 ring-black/5 ${ 
        isSuccess
          ? 'border-emerald-300 bg-white text-emerald-950 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-50'
          : isError
          ? 'border-rose-400 bg-white text-rose-950 dark:border-rose-600 dark:bg-rose-950 dark:text-rose-50'
          : 'border-sky-300 bg-white text-slate-900 dark:border-sky-700 dark:bg-slate-900 dark:text-slate-50'
      }`}
    >
      {isSuccess ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" /> : null}
      {isError ? <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" /> : null}
      {!isSuccess && !isError ? <Info className="mt-0.5 h-5 w-5 shrink-0 text-sky-600 dark:text-sky-400" /> : null}
      <span className="min-w-0 flex-1 break-words leading-snug">{toast.message}</span>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="ml-1 shrink-0 rounded-md p-1 text-current/60 transition hover:bg-black/5 hover:text-current focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:hover:bg-white/10"
      >
        <X className="h-4 w-4" />
      </button>
    </motion.div>
  );
};

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'success', duration?: number) => {
    const cleanMessage = message.trim();
    if (!cleanMessage) return;

    const toastType = type || 'success';
    const resolvedDuration = duration ?? DEFAULT_DURATIONS[toastType];
    setToasts((current) => {
      if (current.some((toast) => toast.message === cleanMessage && toast.type === toastType)) return current;
      return [...current.slice(-3), {
        id: `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        message: cleanMessage,
        type: toastType,
        duration: resolvedDuration,
      }];
    });
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, removeToast }}>
      {children}
      <div
        aria-label="Notifications"
        className="pointer-events-none fixed left-1/2 top-[max(0.75rem,env(safe-area-inset-top))] z-[10000] -translate-x-1/2 flex w-[min(72vw,24rem)] max-w-sm flex-col gap-2 sm:left-6 sm:right-auto sm:top-6 sm:translate-x-0 sm:w-[min(24rem,calc(100vw-3rem))]"
      >
        <AnimatePresence initial={false} mode="popLayout">
          {toasts.map((toast) => (
            <ToastMessage key={toast.id} toast={toast} onDismiss={removeToast} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
