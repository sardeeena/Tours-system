import React, { useState } from 'react';
import { ShieldCheck, AlertCircle, Loader2, LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface MfaChallengeProps {
  factorId: string;
  onCancel: () => void;
}

export const MfaChallenge: React.FC<MfaChallengeProps> = ({ factorId, onCancel }) => {
  const { verifyMfa } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleanCode = code.replace(/\s/g, '');
    if (!/^\d{6}$/.test(cleanCode)) {
      setError('Enter the current 6-digit code from your authenticator app.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await verifyMfa(factorId, cleanCode);
      if (!result.success) {
        setError(result.error || 'The authenticator code could not be verified. Try the current code again.');
      }
    } catch {
      setError('Could not verify the authenticator code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-xl border border-[#E8E3DA] dark:border-[#1F3854] bg-[#FAF8F5] dark:bg-[#111E2E] p-4 sm:p-5 space-y-4 text-[#0E1B2A] dark:text-white">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-[#0A6C74]/10 p-2">
          <ShieldCheck className="h-5 w-5 text-[#0A6C74] dark:text-emerald-300" />
        </div>
        <div>
          <h2 className="text-base font-bold">Verify your sign-in</h2>
          <p className="text-xs text-slate-400">Enter your 6-digit authenticator code.</p>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 p-3 text-xs text-rose-700 dark:text-rose-200">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block text-xs font-semibold text-stone-700 dark:text-slate-200" htmlFor="administrator-totp-code">
          Authenticator code
        </label>
        <input
          id="administrator-totp-code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
          className="w-full rounded-xl border border-[#E8E3DA] dark:border-slate-700 bg-white dark:bg-[#0A1118] px-4 py-3 text-center font-mono text-2xl tracking-[0.35em] text-[#0E1B2A] dark:text-white outline-none focus:border-[#0A6C74]"
          placeholder="000000"
          required
        />
        <button
          type="submit"
          disabled={loading || code.length !== 6}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0A6C74] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#08565C] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          Verify and continue
        </button>
      </form>

      <button type="button" onClick={onCancel} className="flex w-full items-center justify-center gap-2 text-xs text-stone-500 dark:text-slate-400 hover:text-[#0A6C74] dark:hover:text-white">
        <LogOut className="h-3.5 w-3.5" />
        Sign out and use another account
      </button>
    </section>
  );
};
