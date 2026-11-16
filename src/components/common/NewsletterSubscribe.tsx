import React, { useState } from 'react';
import { Mail, CheckCircle2, Copy, Check, AlertCircle, ShieldCheck } from 'lucide-react';
import { subscribeToNewsletter } from '../../services/newsletterService';
import { useToast } from '../../contexts/ToastContext';

interface NewsletterSubscribeProps {
  className?: string;
  source?: string;
}

export const NewsletterSubscribe: React.FC<NewsletterSubscribeProps> = ({
  className = '',
  source = 'footer'
}) => {
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [websiteUrlHp, setWebsiteUrlHp] = useState('');
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{
    discountCode: string;
    message: string;
    alreadySubscribed?: boolean;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!email.trim()) {
      setErrorMsg('Please enter your email address.');
      return;
    }
    if (!consentAccepted) {
      setErrorMsg('Please confirm your consent to receive newsletter emails.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await subscribeToNewsletter(email, source, websiteUrlHp, consentAccepted);
      if (res.success) {
        setSuccessData({
          discountCode: res.discountCode,
          message: res.message,
          alreadySubscribed: res.alreadySubscribed,
        });
        showToast(
          res.alreadySubscribed ? 'Voucher code ready: REDSEA15' : res.message,
          res.emailStatus === 'failed' ? 'info' : 'success',
          5000
        );
      } else {
        setErrorMsg(res.message || 'Could not subscribe at this time. Please try again.');
      }
    } catch {
      setErrorMsg('A connection error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyCode = async () => {
    if (!successData?.discountCode) return;
    try {
      await navigator.clipboard.writeText(successData.discountCode);
      setCopied(true);
      showToast(`Copied voucher code ${successData.discountCode} to clipboard!`, 'info');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard access may be unavailable in some browsers.
    }
  };

  const handleReset = () => {
    setEmail('');
    setConsentAccepted(false);
    setSuccessData(null);
    setErrorMsg(null);
    setCopied(false);
  };

  return (
    <section className={`rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 sm:p-6 transition-colors ${className}`}>
      {!successData ? (
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#0A6C74] dark:text-[#60C3CC] mb-1">Travel updates</p>
            <h2 className="font-display text-lg sm:text-xl font-bold text-stone-900 dark:text-white">Get 15% off your next trip</h2>
            <p className="text-xs sm:text-sm text-stone-600 dark:text-slate-300 mt-1">Occasional Red Sea travel news and member offers. Unsubscribe anytime.</p>
          </div>

          <form onSubmit={handleSubmit} className="w-full lg:max-w-xl space-y-2.5">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="sr-only" aria-hidden="true">
                <label htmlFor="newsletter_url_hp">Website URL</label>
                <input id="newsletter_url_hp" type="text" name="newsletter_url_hp" value={websiteUrlHp} onChange={(e) => setWebsiteUrlHp(e.target.value)} tabIndex={-1} autoComplete="off" />
              </div>
              <label htmlFor="newsletter-email" className="sr-only">Email address</label>
              <div className="relative flex-1">
                <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
                <input
                  id="newsletter-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); if (errorMsg) setErrorMsg(null); }}
                  placeholder="Your email address"
                  className="w-full pl-10 pr-3.5 py-3 text-sm rounded-lg bg-white dark:bg-slate-950 border border-stone-300 dark:border-slate-700 text-stone-900 dark:text-white placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#0A6C74] focus:border-[#0A6C74]"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-[#0A6C74] hover:bg-[#08565C] text-white text-sm font-semibold transition-colors disabled:opacity-60"
              >
                {isSubmitting ? 'Subscribing…' : 'Get 15% off'}
              </button>
            </div>
            <label className="flex items-start gap-2 text-[11px] leading-relaxed text-stone-600 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={consentAccepted}
                onChange={(e) => { setConsentAccepted(e.target.checked); if (errorMsg) setErrorMsg(null); }}
                className="mt-0.5 h-4 w-4 rounded border-stone-300 text-[#0A6C74] focus:ring-[#0A6C74]"
              />
              <span>I agree to receive occasional travel updates and promotional emails from Awesome Adventure Tours.</span>
            </label>
            {errorMsg && (
              <div role="alert" className="flex items-start gap-1.5 text-red-600 dark:text-red-400 text-xs">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}
            <p className="flex items-center gap-1.5 text-[10px] text-stone-400 dark:text-slate-500">
              <ShieldCheck className="w-3 h-3" /> Your email stays private. Unsubscribe anytime.
            </p>
          </form>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-display font-bold text-base text-stone-900 dark:text-white">
                {successData.alreadySubscribed ? 'Welcome back!' : 'You’re subscribed!'}
              </h3>
              <p className="text-xs text-stone-600 dark:text-slate-300 mt-0.5">{successData.message}</p>
              <p className="text-xs text-stone-500 dark:text-slate-400 mt-1">Your 15% code: <strong className="font-mono text-[#0A6C74] dark:text-[#60C3CC]">{successData.discountCode}</strong></p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={handleCopyCode} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#0A6C74] text-white text-xs font-semibold">
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy code'}
            </button>
            <button type="button" onClick={handleReset} className="px-3 py-2.5 rounded-lg border border-stone-200 dark:border-slate-700 text-xs font-semibold text-stone-600 dark:text-slate-300">Another email</button>
          </div>
        </div>
      )}
    </section>
  );
};
