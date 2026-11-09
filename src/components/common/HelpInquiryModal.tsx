import React, { useState } from 'react';
import {
  X,
  Send,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  MessageCircle,
  Phone,
  Mail,
  User,
  Compass,
} from 'lucide-react';
import { createCustomerInquiry } from '../../services/inquiryService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Tour } from '../../types';

interface HelpInquiryModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTour?: Tour | null;
  tours?: Tour[];
}

export const HelpInquiryModal: React.FC<HelpInquiryModalProps> = ({
  isOpen,
  onClose,
  selectedTour,
  tours = [],
}) => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [name, setName] = useState(user?.fullName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phoneNumber || '');
  const [tourId, setTourId] = useState(selectedTour?.id || '');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [websiteUrlHp, setWebsiteUrlHp] = useState(''); // Anti-bot honeypot
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync auth state if user changes
  React.useEffect(() => {
    if (user) {
      if (!name) setName(user.fullName);
      if (!email) setEmail(user.email);
      if (!phone && user.phoneNumber) setPhone(user.phoneNumber);
    }
  }, [user]);

  React.useEffect(() => {
    if (selectedTour) {
      setTourId(selectedTour.id);
      setSubject(`Inquiry regarding: ${selectedTour.title}`);
    }
  }, [selectedTour]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!name.trim() || !email.trim() || !message.trim()) {
      setErrorMsg('Please fill in your name, email address, and message.');
      return;
    }

    setLoading(true);

    const chosenTour = tours.find((t) => t.id === tourId) || selectedTour;

    const res = await createCustomerInquiry({
      customer_name: name.trim(),
      email: email.trim(),
      phone: phone.trim() || null,
      whatsapp: phone.trim() || null,
      tour_id: chosenTour?.id || null,
      tour_title: chosenTour?.title || null,
      subject: subject.trim() || 'General Excursion Assistance & Help Request',
      message: message.trim(),
      source: 'web',
      website_url_hp: websiteUrlHp,
    });

    setLoading(false);

    if (res.success) {
      setSubmitted(true);
      showToast('Your help request has been sent directly to our pier concierge team.', 'success');
    } else {
      setErrorMsg(res.error || 'Failed to submit inquiry. Please try again or message WhatsApp.');
    }
  };

  const handleReset = () => {
    setSubmitted(false);
    setMessage('');
    setErrorMsg(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-lg bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl shadow-2xl overflow-hidden text-stone-900 dark:text-stone-100 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-stone-50 dark:bg-stone-950 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-full bg-[#0A6C74]/15 dark:bg-[#0A6C74]/20 border border-[#0A6C74] flex items-center justify-center text-[#0A6C74] dark:text-[#2dd4bf]">
              <HelpCircle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900 dark:text-white tracking-wide">
                Require Help & Concierge Support
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Direct pier desk assistance & custom excursion arrangements
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-white rounded-lg hover:bg-stone-200/60 dark:hover:bg-stone-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto">
          {submitted ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-14 h-14 rounded-full bg-emerald-500/15 dark:bg-emerald-500/20 border border-emerald-500/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h4 className="text-lg font-bold text-stone-900 dark:text-white">Help Request Transmitted</h4>
                <p className="text-xs text-stone-600 dark:text-stone-300 max-w-sm mx-auto">
                  Thank you, <strong className="text-stone-900 dark:text-white">{name}</strong>. Your inquiry has been sent to our Hurghada Marina dispatch desk and recorded in our live system.
                </p>
              </div>

              <div className="bg-stone-50 dark:bg-stone-950/70 border border-stone-200 dark:border-stone-800 rounded-lg p-3 text-xs text-stone-600 dark:text-stone-400 text-left space-y-1">
                <p className="flex justify-between">
                  <span>Target Response:</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Under 15 minutes</span>
                </p>
                <p className="flex justify-between">
                  <span>Confirmation Sent To:</span>
                  <span className="text-stone-800 dark:text-stone-200 font-mono">{email}</span>
                </p>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-2">
                <a
                  href={`https://wa.me/201515212741?text=${encodeURIComponent(
                    `Hello Awesome Adventure Tours Concierge, I just submitted help request regarding: "${subject || 'Support'}" from ${name}.`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center space-x-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Immediate Pier WhatsApp</span>
                </a>
                <button
                  type="button"
                  onClick={handleReset}
                  className="flex-1 px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 dark:bg-stone-800 dark:hover:bg-stone-700 dark:text-stone-200 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                >
                  Close Window
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Invisible anti-bot honeypot field */}
              <div className="opacity-0 absolute -left-[9999px] h-0 w-0 overflow-hidden pointer-events-none" aria-hidden="true" tabIndex={-1}>
                <label htmlFor="website_url_hp">Website URL</label>
                <input
                  id="website_url_hp"
                  type="text"
                  name="website_url_hp"
                  value={websiteUrlHp}
                  onChange={(e) => setWebsiteUrlHp(e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                />
              </div>

              {errorMsg && (
                <div className="p-3 bg-red-50 dark:bg-red-950/80 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 text-xs rounded-lg flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Full Name */}
                <div>
                  <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                    Your Full Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Markus Weber"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-lg pl-9 pr-3 py-2 text-xs text-stone-900 dark:text-white placeholder-stone-400 dark:placeholder-stone-500 focus:outline-none focus:border-[#0A6C74]"
                    />
                  </div>
                </div>

                {/* Email Address */}
                <div>
                  <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                    <input
                      type="email"
                      required
                      placeholder="e.g. markus@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-lg pl-9 pr-3 py-2 text-xs text-stone-900 dark:text-white placeholder-stone-400 dark:placeholder-stone-500 focus:outline-none focus:border-[#0A6C74]"
                    />
                  </div>
                </div>
              </div>

              {/* Phone / WhatsApp */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                    Phone / WhatsApp Number
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                    <input
                      type="tel"
                      placeholder="e.g. +49 170 1234567"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-lg pl-9 pr-3 py-2 text-xs text-stone-900 dark:text-white placeholder-stone-400 dark:placeholder-stone-500 focus:outline-none focus:border-[#0A6C74]"
                    />
                  </div>
                </div>

                {/* Excursion Reference (Optional) */}
                <div>
                  <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                    Related Excursion
                  </label>
                  <div className="relative">
                    <Compass className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                    <select
                      value={tourId}
                      onChange={(e) => {
                        setTourId(e.target.value);
                        const match = tours.find((t) => t.id === e.target.value);
                        if (match && !subject) {
                          setSubject(`Inquiry regarding: ${match.title}`);
                        }
                      }}
                      className="w-full bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-lg pl-9 pr-3 py-2 text-xs text-stone-900 dark:text-white focus:outline-none focus:border-[#0A6C74]"
                    >
                      <option value="">General inquiry (no tour selected)</option>
                      {tours.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Inquiry Topic / Subject
                </label>
                <input
                  type="text"
                  placeholder="e.g. Custom private yacht charter, dietary assistance, pickup verification"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-lg px-3 py-2 text-xs text-stone-900 dark:text-white placeholder-stone-400 dark:placeholder-stone-500 focus:outline-none focus:border-[#0A6C74]"
                />
              </div>

              {/* Message */}
              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  How can our team help you? <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Please specify hotel name, dates, group size, special requirements, or any questions..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-lg p-3 text-xs text-stone-900 dark:text-white placeholder-stone-400 dark:placeholder-stone-500 focus:outline-none focus:border-[#0A6C74] resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-stone-200 dark:border-stone-800">
                <span className="text-[11px] text-stone-500 dark:text-stone-400">
                  Data securely saved to database & dispatched to marina desk.
                </span>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center space-x-1.5 px-4 py-2 bg-[#0A6C74] hover:bg-[#08545a] text-white rounded-lg text-xs font-semibold shadow-md transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <Send className={`w-3.5 h-3.5 ${loading ? 'animate-pulse' : ''}`} />
                    <span>{loading ? 'Transmitting...' : 'Send Help Request'}</span>
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
