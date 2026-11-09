import React, { useState } from 'react';
import { 
  Mail, 
  Send, 
  Sparkles, 
  CheckCircle2, 
  Copy, 
  Check, 
  AlertCircle,
  Tag,
  ShieldCheck,
  Compass
} from 'lucide-react';
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
  const [websiteUrlHp, setWebsiteUrlHp] = useState(''); // Anti-bot honeypot
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

    setIsSubmitting(true);
    try {
      const res = await subscribeToNewsletter(email, source, websiteUrlHp);
      if (res.success) {
        setSuccessData({
          discountCode: res.discountCode,
          message: res.message,
          alreadySubscribed: res.alreadySubscribed,
        });
        showToast(
          res.alreadySubscribed 
            ? 'Voucher code ready: REDSEA15' 
            : 'Subscribed successfully! Use promo code REDSEA15.',
          'success',
          4000
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
      // fallback
    }
  };

  const handleReset = () => {
    setEmail('');
    setSuccessData(null);
    setErrorMsg(null);
    setCopied(false);
  };

  return (
    <div className={`relative overflow-hidden bg-gradient-to-br from-[#E2F1F3] via-[#EFF8F8] to-[#FAF8F5] dark:from-[#122236] dark:to-[#0A1726] border border-[#BDE0E2] dark:border-slate-700/80 rounded-2xl p-6 sm:p-8 shadow-md dark:shadow-xl transition-colors duration-300 ${className}`}>
      {/* Decorative ambient background accents */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-[#60C3CC]/20 dark:bg-[#0A6C74]/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-10 -left-10 w-60 h-60 bg-[#0A6C74]/10 dark:bg-[#60C3CC]/10 rounded-full blur-2xl pointer-events-none" />

      <div className="relative z-10">
        {!successData ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            
            {/* Left Column: Heading & Value Proposition */}
            <div className="lg:col-span-7 space-y-3">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#0A6C74]/10 dark:bg-[#0A6C74]/25 border border-[#0A6C74]/25 dark:border-[#0A6C74]/40 text-[#0A6C74] dark:text-[#60C3CC] text-[11px] font-semibold tracking-wide uppercase">
                <Sparkles className="w-3.5 h-3.5 text-[#0A6C74] dark:text-[#60C3CC]" />
                <span>Exclusive Member Perks</span>
              </div>

              <h2 className="font-display text-xl sm:text-2xl font-bold text-stone-900 dark:text-white tracking-tight">
                Get 15% Off Your Next Red Sea Excursion
              </h2>

              <p className="text-xs sm:text-sm text-stone-600 dark:text-slate-300 leading-relaxed max-w-xl">
                Subscribe to our newsletter for seasonal reef water clarity forecasts, wild dolphin pod sightings, and subscriber-only promotional vouchers.
              </p>

              {/* Bullet perks */}
              <div className="flex flex-wrap gap-y-1.5 gap-x-4 pt-1 text-xs text-stone-700 dark:text-slate-300">
                <div className="flex items-center space-x-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Instant 15% promo code</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Seasonal reef condition alerts</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Early bird boat charter access</span>
                </div>
              </div>
            </div>

            {/* Right Column: Interactive Subscription Form */}
            <div className="lg:col-span-5">
              <form onSubmit={handleSubmit} className="space-y-2.5">
                {/* Invisible anti-bot honeypot field */}
                <div className="opacity-0 absolute -left-[9999px] h-0 w-0 overflow-hidden pointer-events-none" aria-hidden="true" tabIndex={-1}>
                  <label htmlFor="newsletter_url_hp">Website URL</label>
                  <input
                    id="newsletter_url_hp"
                    type="text"
                    name="newsletter_url_hp"
                    value={websiteUrlHp}
                    onChange={(e) => setWebsiteUrlHp(e.target.value)}
                    tabIndex={-1}
                    autoComplete="off"
                  />
                </div>

                <div className="relative">
                  <label htmlFor="newsletter-email" className="sr-only">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-stone-400 dark:text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      id="newsletter-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (errorMsg) setErrorMsg(null);
                      }}
                      placeholder="Enter your email address..."
                      className="w-full pl-10 pr-3.5 py-3 text-xs sm:text-sm rounded-xl bg-white dark:bg-slate-900/90 border border-stone-300 dark:border-slate-700 text-stone-900 dark:text-white placeholder-stone-400 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0A6C74] focus:border-[#0A6C74] transition-all shadow-inner"
                    />
                  </div>
                </div>

                {errorMsg && (
                  <div className="flex items-start space-x-1.5 text-red-500 dark:text-red-400 text-xs py-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 px-5 rounded-xl bg-[#0A6C74] hover:bg-[#08565C] active:scale-[0.99] text-white text-xs sm:text-sm font-semibold transition-all shadow-md flex items-center justify-center space-x-2 disabled:opacity-60 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Subscribing...</span>
                    </>
                  ) : (
                    <>
                      <span>Claim 15% Discount Voucher</span>
                      <Send className="w-4 h-4" />
                    </>
                  )}
                </button>

                <div className="flex items-center justify-between text-[11px] text-stone-500 dark:text-slate-400 px-1 pt-0.5">
                  <span className="flex items-center space-x-1">
                    <ShieldCheck className="w-3 h-3 text-stone-400 dark:text-slate-500" />
                    <span>Strictly zero spam. Unsubscribe anytime.</span>
                  </span>
                  <span className="text-stone-400 dark:text-slate-500">Synced to Supabase</span>
                </div>
              </form>
            </div>

          </div>
        ) : (
          /* Success Card View with Voucher Code */
          <div className="bg-white dark:bg-slate-900/80 border border-emerald-500/40 rounded-xl p-5 sm:p-6 text-center space-y-4 max-w-2xl mx-auto shadow-md dark:shadow-none animate-fade-in">
            <div className="w-12 h-12 rounded-full bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>

            <div className="space-y-1">
              <h3 className="font-display text-lg sm:text-xl font-bold text-stone-900 dark:text-white">
                {successData.alreadySubscribed ? 'Welcome Back!' : "You're On The VIP List!"}
              </h3>
              <p className="text-xs text-stone-600 dark:text-slate-300 max-w-md mx-auto">
                {successData.message}
              </p>
            </div>

            {/* Voucher Box */}
            <div className="bg-stone-50 dark:bg-[#16283D] border border-[#0A6C74]/40 dark:border-[#0A6C74]/50 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 max-w-md mx-auto">
              <div className="text-left">
                <span className="text-[10px] text-stone-500 dark:text-slate-400 uppercase tracking-wider block font-semibold">
                  Promotional Promo Voucher
                </span>
                <span className="font-mono text-base font-bold text-[#0A6C74] dark:text-[#60C3CC] tracking-wider">
                  {successData.discountCode}
                </span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block font-medium">
                  15% off any excursion at checkout
                </span>
              </div>

              <button
                type="button"
                onClick={handleCopyCode}
                className="w-full sm:w-auto px-4 py-2 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-300" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Voucher</span>
                  </>
                )}
              </button>
            </div>

            <div className="pt-1">
              <button
                type="button"
                onClick={handleReset}
                className="text-[11px] text-slate-400 hover:text-white underline underline-offset-2 transition-colors cursor-pointer"
              >
                Subscribe another email address
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
