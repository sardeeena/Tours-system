import React, { useState, useEffect } from 'react';
import { Download, Smartphone, Share, PlusSquare, X, Check, ShieldCheck } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { useLanguage } from '../../contexts/LanguageContext';

export const PWAInstallButton: React.FC<{
  variant?: 'header' | 'mobile' | 'floating' | 'footer';
  className?: string;
}> = ({ variant = 'header', className = '' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSModal, setShowIOSModal] = useState(false);
  const { t } = useLanguage();

  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      await install();
    } else if (isIOS) {
      setShowIOSModal(true);
    } else {
      setShowIOSModal(true);
    }
  };

  if (variant === 'mobile') {
    return (
      <>
        <button
          type="button"
          onClick={handleInstallClick}
          className={`w-full py-2.5 px-3 bg-gradient-to-r from-[#0A6C74] to-[#0D838C] text-white rounded-lg text-xs font-bold flex items-center justify-between shadow-xs hover:brightness-105 transition-all ${className}`}
        >
          <div className="flex items-center space-x-2">
            <Smartphone className="w-4 h-4" />
            <span>{t('pwa.installOnPhone', 'Install App on Phone')}</span>
          </div>
          <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded uppercase font-semibold">
            {isIOS ? 'iOS / Safari' : 'Install'}
          </span>
        </button>

        {showIOSModal && <IOSInstallModal onClose={() => setShowIOSModal(false)} />}
      </>
    );
  }

  if (variant === 'footer') {
    return (
      <>
        <button
          type="button"
          onClick={handleInstallClick}
          className={`inline-flex items-center space-x-2 text-xs text-[#FAF8F5]/80 hover:text-white transition-colors cursor-pointer ${className}`}
        >
          <Download className="w-3.5 h-3.5 text-[#E2C992]" />
          <span>{t('pwa.installApp', 'Install Red Sea App')}</span>
        </button>

        {showIOSModal && <IOSInstallModal onClose={() => setShowIOSModal(false)} />}
      </>
    );
  }

  // Desktop / Header compact variant
  return (
    <>
      <button
        type="button"
        id="pwa-install-header-btn"
        onClick={handleInstallClick}
        title={t('pwa.installTooltip', 'Install Red Sea Tours on your device for instant access')}
        className={`inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl border border-[#0A6C74]/30 bg-[#E8F3F4] hover:bg-[#D5EBEF] text-[#0A6C74] text-xs font-semibold transition-all cursor-pointer shadow-2xs ${className}`}
      >
        <Download className="w-3.5 h-3.5 text-[#0A6C74] animate-bounce-subtle" />
        <span className="hidden md:inline">{t('pwa.install', 'Install App')}</span>
      </button>

      {showIOSModal && <IOSInstallModal onClose={() => setShowIOSModal(false)} />}
    </>
  );
};

/**
 * Mobile floating banner that prompts users on phones to install the application
 */
export const PWAInstallFloatingBanner: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [dismissed, setDismissed] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    try {
      const isDismissed = sessionStorage.getItem('rse_pwa_banner_dismissed');
      if (isDismissed) setDismissed(true);
    } catch {
      // Ignore
    }
  }, []);

  if (isInstalled || dismissed) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem('rse_pwa_banner_dismissed', 'true');
    } catch {
      // Ignore
    }
  };

  const handleTriggerInstall = async () => {
    if (isInstallable) {
      await install();
    } else {
      setShowIOSModal(true);
    }
  };

  return (
    <>
      <div className="fixed bottom-4 inset-x-3 z-40 sm:max-w-md sm:left-4 sm:right-auto animate-fade-in-up">
        <div className="bg-white/95 dark:bg-[#0E1B2A]/95 backdrop-blur-md text-stone-900 dark:text-white p-3.5 rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-700/60 flex items-center justify-between gap-3 transition-colors">
          <div className="flex items-center space-x-3 min-w-0">
            <img
              src="/pwa-192x192.png"
              alt="Red Sea Tours Icon"
              className="w-11 h-11 rounded-xl shadow-md border border-stone-200 dark:border-white/20 shrink-0 object-cover"
            />
            <div className="min-w-0">
              <p className="font-bold text-xs text-stone-900 dark:text-white truncate">
                Red Sea Excursions
              </p>
              <p className="text-[11px] text-stone-500 dark:text-stone-300 leading-tight line-clamp-1">
                {t('pwa.bannerSub', 'Save as an app on your phone for quick offline access')}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1.5 shrink-0">
            <button
              type="button"
              onClick={handleTriggerInstall}
              className="px-3 py-1.5 bg-[#0A6C74] hover:bg-[#08565C] text-white text-xs font-bold rounded-lg shadow-sm transition-transform active:scale-95 flex items-center space-x-1 cursor-pointer"
            >
              <Download className="w-3 h-3" />
              <span>{t('pwa.btnInstall', 'Install')}</span>
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Dismiss install banner"
              className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-white rounded-md transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {showIOSModal && <IOSInstallModal onClose={() => setShowIOSModal(false)} />}
    </>
  );
};

/**
 * High-clarity iOS Safari guide modal
 */
export const IOSInstallModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { t } = useLanguage();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-stone-200 text-[#111A24]">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-[#E8F3F4] text-[#0A6C74] flex items-center justify-center font-bold">
              <Smartphone className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-stone-900">
              {t('pwa.iosModalTitle', 'Install on iPhone / iPad')}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-stone-400 hover:text-stone-700 rounded-md"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="py-4 space-y-3.5 text-xs text-stone-600">
          <p className="text-stone-700">
            {t('pwa.iosInstructions', 'Save Red Sea Excursions to your Home Screen in 2 simple taps without downloading from the App Store:')}
          </p>

          <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-2.5">
            <div className="flex items-start space-x-2.5">
              <span className="w-5 h-5 rounded-full bg-[#0A6C74] text-white flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5">
                1
              </span>
              <p>
                {t('pwa.iosStep1', 'Tap the')} <strong className="text-stone-900 inline-flex items-center gap-1 mx-1"><Share className="w-3.5 h-3.5 text-blue-600" /> Share</strong> {t('pwa.iosStep1End', 'button in your Safari browser navigation bar.')}
              </p>
            </div>

            <div className="flex items-start space-x-2.5">
              <span className="w-5 h-5 rounded-full bg-[#0A6C74] text-white flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5">
                2
              </span>
              <p>
                {t('pwa.iosStep2', 'Scroll down and tap')} <strong className="text-stone-900 inline-flex items-center gap-1 mx-1"><PlusSquare className="w-3.5 h-3.5 text-stone-800" /> Add to Home Screen</strong>.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 text-[11px] text-emerald-700 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">
            <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{t('pwa.iosBenefit', 'Opens fullscreen like a native app with offline voucher access anytime.')}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
        >
          {t('pwa.gotIt', 'Got it!')}
        </button>
      </div>
    </div>
  );
};
