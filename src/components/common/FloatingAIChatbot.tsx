import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Compass, 
  X, 
  Send, 
  Sparkles, 
  RotateCcw, 
  Star, 
  Clock, 
  MapPin, 
  ChevronRight,
  Bot,
  User,
  MessageSquare
} from 'lucide-react';
import { Tour, CurrencyConfig } from '../../types';
import { formatPrice } from '../../data/toursData';
import { sendChatMessage, ChatMessage } from '../../services/aiChatService';

interface FloatingAIChatbotProps {
  currency: CurrencyConfig;
  onViewTour: (tour: Tour) => void;
  onBookTour?: (tour: Tour) => void;
  currentPath?: string;
}

const QUICK_PROMPTS = [
  { label: '🐬 Wild Dolphins', prompt: 'Where is the best place to see wild dolphins in their natural habitat?' },
  { label: '🏖️ Best Island', prompt: 'What is the best island beach trip for relaxing on white sandbars?' },
  { label: '👨‍👩‍👧 For Kids', prompt: 'Which excursion is best suited for families with young children?' },
  { label: '🏎️ Desert Safari', prompt: 'Tell me about the quad bike and desert safari with Bedouin dinner.' },
  { label: '🤿 Scuba Diving', prompt: 'I have never dived before. Can I do a beginner scuba dive?' },
  { label: '📅 How to Book', prompt: 'How does excursion booking work? Can I pay cash upon hotel pickup?' },
];

export const FloatingAIChatbot: React.FC<FloatingAIChatbotProps> = ({
  currency,
  onViewTour,
  onBookTour,
  currentPath = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-msg',
      role: 'assistant',
      content: `Ahlan wa sahlan! I'm **Captain Farouk**, your Red Sea AI Concierge.

Tell me who you're traveling with, your resort area (Hurghada, El Gouna, Makadi Bay), or what adventures you're looking for, and I will handpick the ideal excursions from our fleet!`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isLoading]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 250);
    }
  }, [isOpen]);

  const handleSendMessage = async (customPrompt?: string) => {
    const promptToSend = (customPrompt || input).trim();
    if (!promptToSend || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: promptToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const history = messages
        .filter((m) => m.id !== 'welcome-msg')
        .concat(userMsg)
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await sendChatMessage(history, promptToSend);

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: res.content,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        recommendedTours: res.recommendedTours,
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: 'I had a brief communication interruption with the marina base. Please try asking again!',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetChat = () => {
    setMessages([
      {
        id: 'welcome-msg',
        role: 'assistant',
        content: `Ahlan! Conversation refreshed. What Red Sea adventures can I help you discover today?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  // Adjust bottom clearance for mobile views where bottom booking bar is present
  const isTourOrBooking = currentPath.includes('/tour/') || currentPath.startsWith('/booking');
  const bottomPositionClass = isTourOrBooking
    ? 'bottom-20 sm:bottom-6'
    : 'bottom-5 sm:bottom-6';

  return (
    <div className={`fixed left-4 sm:left-6 ${bottomPositionClass} z-40 select-none print:hidden`}>
      {/* Floating Trigger Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.94 }}
        type="button"
        id="floating-ai-chatbot-btn"
        onClick={() => {
          setIsOpen(!isOpen);
        }}
        aria-expanded={isOpen}
        aria-label="Open AI Concierge Chatbot"
        className={`group relative flex items-center shadow-xl transition-all duration-300 cursor-pointer ${
          isOpen
            ? 'p-3.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-white border border-stone-300 dark:border-stone-700'
            : 'px-3.5 sm:px-4 py-3 sm:py-3.5 rounded-full bg-[#0A6C74] hover:bg-[#08565C] dark:bg-gradient-to-r dark:from-[#0E1B2A] dark:to-[#16283D] text-white border border-[#0A6C74]/50 hover:border-[#60C3CC]'
        }`}
      >
        {/* Pulsing Aura Effect when closed */}
        {!isOpen && (
          <span className="absolute -inset-1 rounded-full bg-[#0A6C74]/30 animate-pulse pointer-events-none" />
        )}

        {isOpen ? (
          <X className="w-6 h-6 text-stone-800 dark:text-white" />
        ) : (
          <div className="flex items-center space-x-2">
            <div className="relative">
              <div className="w-8 h-8 rounded-full bg-white/20 dark:bg-gradient-to-tr dark:from-[#0A6C74] dark:to-[#60C3CC] flex items-center justify-center text-white shadow-xs">
                <Compass className="w-4 h-4 text-white group-hover:rotate-45 transition-transform duration-300" />
              </div>
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 border-2 border-[#0A6C74] dark:border-[#0E1B2A] rounded-full animate-ping" />
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 border-2 border-[#0A6C74] dark:border-[#0E1B2A] rounded-full" />
            </div>

            <div className="hidden sm:flex flex-col text-left">
              <span className="text-xs font-bold tracking-wide flex items-center gap-1 text-white">
                Ask Captain Farouk
                <Sparkles className="w-3 h-3 text-amber-300 dark:text-[#60C3CC]" />
              </span>
              <span className="text-[10px] text-teal-100 dark:text-slate-300">AI Tour Concierge</span>
            </div>
          </div>
        )}
      </motion.button>

      {/* Floating Chat Modal Dialog */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.95 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="absolute bottom-16 sm:bottom-18 left-0 w-[calc(100vw-2rem)] sm:w-[410px] h-[560px] max-h-[82vh] bg-white rounded-3xl shadow-2xl border border-stone-200/90 flex flex-col overflow-hidden z-50 origin-bottom-left"
          >
            {/* Header */}
            <div className="bg-[#0A6C74] text-white p-4 relative border-b border-[#08565C]">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center text-white border border-white/20">
                      <Compass className="w-5 h-5 text-white" />
                    </div>
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 border-2 border-[#0A6C74] rounded-full" />
                  </div>
                  <div>
                    <h3 className="font-display font-semibold text-sm text-white flex items-center space-x-1.5">
                      <span>Captain Farouk</span>
                      <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-white/20 text-white border border-white/30">
                        AI Guide
                      </span>
                    </h3>
                    <p className="text-[11px] text-white/85">
                      Red Sea Tour Concierge · Hurghada Marina
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-1">
                  <button
                    type="button"
                    onClick={handleResetChat}
                    title="Clear and restart conversation"
                    className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Suggestion Chips */}
            <div className="bg-stone-50 border-b border-stone-200 px-3 py-2 flex items-center space-x-1.5 overflow-x-auto no-scrollbar text-[11px]">
              {QUICK_PROMPTS.map((qp, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendMessage(qp.prompt)}
                  className="shrink-0 px-2.5 py-1 rounded-full bg-white hover:bg-[#E8F3F4] text-stone-700 hover:text-[#0A6C74] border border-stone-200 transition-colors cursor-pointer shadow-2xs font-medium"
                >
                  {qp.label}
                </button>
              ))}
            </div>

            {/* Chat Messages Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#FAF8F5]/80 text-xs">
              {messages.map((msg) => {
                const isAssistant = msg.role === 'assistant';

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isAssistant ? 'items-start' : 'items-end'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl p-3.5 leading-relaxed shadow-2xs ${
                        isAssistant
                          ? 'bg-white text-stone-800 border border-stone-200/80 rounded-tl-sm'
                          : 'bg-[#0A6C74] text-white rounded-tr-sm'
                      }`}
                    >
                      {/* Markdown-friendly rendering */}
                      <div className="space-y-1.5 whitespace-pre-line">
                        {msg.content.split('\n').map((line, lIdx) => {
                          // Format bold asterisks
                          const formattedLine = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                          return (
                            <p 
                              key={lIdx} 
                              dangerouslySetInnerHTML={{ __html: formattedLine }} 
                              className={line.startsWith('•') || line.startsWith('1.') || line.startsWith('2.') ? 'pl-1' : ''}
                            />
                          );
                        })}
                      </div>

                      <span
                        className={`text-[9px] block mt-1.5 ${
                          isAssistant ? 'text-stone-400' : 'text-teal-200'
                        }`}
                      >
                        {msg.timestamp}
                      </span>
                    </div>

                    {/* Embedded Tour Recommendation Cards */}
                    {isAssistant && msg.recommendedTours && msg.recommendedTours.length > 0 && (
                      <div className="w-full mt-2.5 space-y-2">
                        <span className="text-[10px] uppercase font-bold text-stone-500 tracking-wider block">
                          Recommended Excursions from Catalog:
                        </span>

                        {msg.recommendedTours.map((tour) => (
                          <div
                            key={tour.id}
                            className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-xs hover:border-[#0A6C74] transition-all p-2.5 flex items-center space-x-3 group"
                          >
                            <img
                              src={tour.primaryImage}
                              alt={tour.title}
                              className="w-16 h-16 rounded-lg object-cover shrink-0"
                            />

                            <div className="flex-1 min-w-0">
                              <h4 className="font-display font-bold text-xs text-stone-900 truncate group-hover:text-[#0A6C74] transition-colors">
                                {tour.title}
                              </h4>

                              <div className="flex items-center space-x-2 text-[10px] text-stone-500 mt-0.5">
                                <span className="flex items-center text-[#0A6C74] font-medium">
                                  <MapPin className="w-2.5 h-2.5 mr-0.5 shrink-0" />
                                  {tour.destination}
                                </span>
                                <span>•</span>
                                <span className="flex items-center">
                                  <Clock className="w-2.5 h-2.5 mr-0.5 shrink-0" />
                                  {tour.durationHours}h
                                </span>
                              </div>

                              <div className="flex items-center justify-between mt-1.5">
                                <span className="font-bold text-stone-900 text-xs">
                                  {formatPrice(tour.priceEur, currency)}
                                </span>

                                <div className="flex items-center space-x-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onViewTour(tour);
                                      setIsOpen(false);
                                    }}
                                    className="px-2 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 text-[10px] font-semibold rounded cursor-pointer"
                                  >
                                    Details
                                  </button>
                                  {onBookTour && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        onBookTour(tour);
                                        setIsOpen(false);
                                      }}
                                      className="px-2.5 py-1 bg-[#0A6C74] hover:bg-[#08565C] text-white text-[10px] font-semibold rounded flex items-center space-x-0.5 cursor-pointer"
                                    >
                                      <span>Book</span>
                                      <ChevronRight className="w-2.5 h-2.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Typing indicator */}
              {isLoading && (
                <div className="flex items-center space-x-2 text-stone-500 p-2">
                  <div className="w-6 h-6 rounded-full bg-[#E8F3F4] text-[#0A6C74] flex items-center justify-center text-[10px]">
                    ⚓
                  </div>
                  <div className="flex items-center space-x-1 bg-white px-3 py-2 rounded-2xl border border-stone-200">
                    <span className="w-1.5 h-1.5 bg-[#0A6C74] rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1.5 h-1.5 bg-[#0A6C74] rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1.5 h-1.5 bg-[#0A6C74] rounded-full animate-bounce" />
                    <span className="text-[10px] text-stone-400 pl-1.5">Consulting fleet schedule...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <div className="p-3 bg-white border-t border-stone-200">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-center space-x-2"
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about dolphin trips, island sandbars, kids..."
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#0A6C74] bg-stone-50/60 focus:bg-white transition-all"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="p-2.5 rounded-xl bg-[#0A6C74] hover:bg-[#08565C] disabled:opacity-40 text-white transition-colors cursor-pointer shadow-xs"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
              <div className="flex items-center justify-between text-[10px] text-stone-400 pt-1.5 px-1">
                <span>Powered by Gemini 3.8 Flash</span>
                <span>Live Excursion Recommendations</span>
              </div>
            </div>

          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};
