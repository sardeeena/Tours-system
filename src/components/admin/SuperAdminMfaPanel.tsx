import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Copy, Loader2, QrCode, ShieldCheck } from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

interface SuperAdminMfaPanelProps {
  compact?: boolean;
}

export const SuperAdminMfaPanel: React.FC<SuperAdminMfaPanelProps> = ({ compact = false }) => {
  const { refreshUser } = useAuth();
  const { showToast } = useToast();
  const [factorId, setFactorId] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFactors = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (factorsError) throw factorsError;
      // listFactors includes factors that may still be unverified; only a
      // verified TOTP factor satisfies the super-admin MFA requirement.
      const verifiedTotp = data.totp.find((factor) => factor.status === 'verified');
      setVerified(Boolean(verifiedTotp));
      setFactorId(verifiedTotp?.id || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load authenticator factors.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFactors();
  }, [loadFactors]);

  const startEnrollment = async () => {
    setWorking(true);
    setError(null);
    try {
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Kemet Spirit Super Admin',
      });
      if (enrollError) throw enrollError;

      setFactorId(data.id);
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
      setCode('');
      showToast('Scan the QR code with your authenticator app, then verify a code.', 'info');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start TOTP enrollment.');
    } finally {
      setWorking(false);
    }
  };

  const verifyEnrollment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!factorId || !/^\d{6}$/.test(code)) {
      setError('Enter the current 6-digit code from your authenticator app.');
      return;
    }

    setWorking(true);
    setError(null);
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code,
      });
      if (verifyError) throw verifyError;

      setQrCode('');
      setSecret('');
      setCode('');
      setVerified(true);
      await refreshUser();
      showToast('Authenticator MFA is now enabled for this super administrator.', 'success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The authenticator code could not be verified.');
    } finally {
      setWorking(false);
    }
  };

  const copySecret = async () => {
    try {
      await navigator.clipboard.writeText(secret);
      showToast('Authenticator secret copied. Store it securely.', 'success');
    } catch {
      showToast('Could not copy the secret. Select and copy it manually.', 'error');
    }
  };

  if (loading) {
    return <div className="rounded-xl border border-slate-700 bg-slate-900 p-5 text-sm text-slate-300">Checking MFA status…</div>;
  }

  return (
    <section className={compact ? 'rounded-2xl border border-[#1F3854] bg-[#111E2E] p-5 space-y-4 text-white' : 'rounded-2xl border border-stone-800 bg-stone-950 p-6 space-y-5 text-white'}>
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-emerald-500/15 p-3">
          <ShieldCheck className="h-6 w-6 text-emerald-300" />
        </div>
        <div className="flex-1">
          <h2 className="text-base font-bold">Super Admin authenticator security</h2>
          <p className="mt-1 text-xs text-slate-400">
            Set up a time-based one-time password (TOTP) in an authenticator app. Supabase TOTP MFA is available on the Free plan.
          </p>
        </div>
        <span className={verified ? 'rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-bold text-emerald-300' : 'rounded-full bg-amber-500/15 px-2.5 py-1 text-[10px] font-bold text-amber-300'}>
          {verified ? 'Enabled' : 'Setup required'}
        </span>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose-800 bg-rose-950/50 p-3 text-xs text-rose-200">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {verified ? (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-700/60 bg-emerald-950/30 p-4 text-xs text-emerald-200">
          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">A verified TOTP factor is enrolled.</p>
            <p className="mt-1 text-emerald-200/80">New sign-ins to the super-admin account will require an authenticator code before admin access is granted.</p>
          </div>
        </div>
      ) : qrCode ? (
        <div className="grid gap-5 md:grid-cols-[auto_1fr]">
          <div className="rounded-xl bg-white p-3">
            <img src={`data:image/svg+xml;utf8,${encodeURIComponent(qrCode)}`} alt="Scan this QR code with an authenticator app" className="h-48 w-48" />
          </div>
          <div className="space-y-3 text-xs text-slate-300">
            <div>
              <p className="font-semibold text-white">1. Scan the QR code</p>
              <p className="mt-1">Use Google Authenticator, Microsoft Authenticator, 1Password, or another TOTP-compatible app.</p>
            </div>
            <div>
              <p className="font-semibold text-white">2. Or enter this setup key manually</p>
              <div className="mt-1 flex items-center gap-2 rounded-lg border border-slate-700 bg-[#0A1118] p-2">
                <code className="min-w-0 flex-1 break-all text-emerald-200">{secret}</code>
                <button type="button" onClick={copySecret} className="rounded p-1.5 text-slate-300 hover:bg-slate-700" aria-label="Copy authenticator setup key">
                  <Copy className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-1 text-[10px] text-amber-300">Keep this key private. Anyone with it can generate your codes.</p>
            </div>
            <form onSubmit={verifyEnrollment} className="space-y-2">
              <label htmlFor="mfa-enroll-code" className="block font-semibold text-white">3. Verify a 6-digit code</label>
              <input
                id="mfa-enroll-code"
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="000000"
                className="w-full rounded-lg border border-slate-700 bg-[#0A1118] px-3 py-2 text-center font-mono text-lg tracking-[0.3em] text-white outline-none focus:border-emerald-400"
              />
              <button type="submit" disabled={working || code.length !== 6} className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">
                {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                Enable TOTP MFA
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <button type="button" onClick={startEnrollment} disabled={working} className="inline-flex items-center gap-2 rounded-lg bg-[#0A6C74] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#08565C] disabled:opacity-50">
            {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
            Set up authenticator MFA
          </button>
        </div>
      )}
    </section>
  );
};
