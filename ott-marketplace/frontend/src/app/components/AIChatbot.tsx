import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import api from '../utils/api';

// ── Types ────────────────────────────────────────────────────────────────────
interface Message {
  id: string;
  role: 'user' | 'bot';
  content: string;
  ts: Date;
  intent?: string;
}

interface QuickReply {
  label: string;
  text: string;
  icon: string;
}

// ── Constants ────────────────────────────────────────────────────────────────
const QUICK_REPLIES: QuickReply[] = [
  { label: 'Order Status', text: 'Where is my latest order?', icon: '📦' },
  { label: 'Wallet', text: 'How do I top up my wallet?', icon: '💳' },
  { label: 'Subscriptions', text: 'Show me my active subscriptions', icon: '📺' },
  { label: 'Refund', text: 'I need a refund for my order', icon: '💰' },
];

const STORAGE_KEY = 'othub-chat-history';
const SESSION_TTL = 24 * 60 * 60 * 1000; // 24 hours

// ── Helpers ──────────────────────────────────────────────────────────────────
function uid() {
  return Math.random().toString(36).slice(2);
}

function loadHistory(): Message[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const { messages, savedAt } = JSON.parse(raw);
    if (Date.now() - savedAt > SESSION_TTL) return [];
    return messages.map((m: any) => ({ ...m, ts: new Date(m.ts) }));
  } catch {
    return [];
  }
}

function saveHistory(messages: Message[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ messages, savedAt: Date.now() }));
  } catch {}
}

// Parse **bold** and [Button Text] action links in bot messages
function renderContent(content: string) {
  const lines = content.split('\n');
  return lines.map((line, li) => {
    // Split on [Label] patterns for action buttons
    const parts = line.split(/(\[[^\]]+\])/g);
    return (
      <span key={li}>
        {parts.map((part, pi) => {
          if (/^\[[^\]]+\]$/.test(part)) {
            const label = part.slice(1, -1);
            const href = getActionHref(label);
            return (
              <a
                key={pi}
                href={href}
                className="inline-flex items-center gap-1 mt-1 mr-1 px-3 py-1 rounded-full text-xs font-semibold
                           bg-purple-600/30 border border-purple-500/50 text-purple-200
                           hover:bg-purple-600/50 hover:border-purple-400 transition-all cursor-pointer"
                onClick={href === '#' ? (e) => e.preventDefault() : undefined}
              >
                {label}
              </a>
            );
          }
          // Bold **text**
          const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
          return boldParts.map((bp, bpi) =>
            /^\*\*[^*]+\*\*$/.test(bp) ? (
              <strong key={bpi} className="text-white font-semibold">
                {bp.slice(2, -2)}
              </strong>
            ) : (
              <span key={bpi}>{bp}</span>
            )
          );
        })}
        {li < lines.length - 1 && <br />}
      </span>
    );
  });
}

function getActionHref(label: string): string {
  const l = label.toLowerCase();
  if (l.includes('dashboard') || l.includes('subscription')) return '/dashboard';
  if (l.includes('shop') || l.includes('browse')) return '/shop';
  if (l.includes('ticket') || l.includes('support') || l.includes('report') || l.includes('connect'))
    return '/tickets';
  if (l.includes('top up') || l.includes('fund') || l.includes('wallet')) return '/dashboard';
  return '#';
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function AIChatbot() {
  const { user } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => loadHistory());
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [pulse, setPulse] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  // Stop orb pulse after first open
  useEffect(() => {
    if (open) setPulse(false);
  }, [open]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Persist history
  useEffect(() => {
    if (messages.length) saveHistory(messages);
  }, [messages]);

  // Welcome message on first open
  useEffect(() => {
    if (open && messages.length === 0) {
      const welcome: Message = {
        id: uid(),
        role: 'bot',
        content: `👋 Hey${user?.name ? ` ${user.name.split(' ')[0]}` : ''}! I'm OTHub's AI assistant.\n\nI can help with orders, wallet top-ups, subscriptions, and more. What's on your mind?`,
        ts: new Date(),
      };
      setMessages([welcome]);
    }
  }, [open]);

  // Voice input
  const startVoice = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const rec = new SpeechRecognition();
    rec.lang = 'en-US';
    rec.interimResults = false;
    rec.onresult = (e: any) => {
      setInput(e.results[0][0].transcript);
      setListening(false);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  }, []);

  const stopVoice = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const sendMessage = useCallback(
    async (text?: string) => {
      const content = (text ?? input).trim();
      if (!content || loading) return;

      const userMsg: Message = { id: uid(), role: 'user', content, ts: new Date() };
      const newMessages = [...messages, userMsg];
      setMessages(newMessages);
      setInput('');
      setLoading(true);

      // Build API payload (last 10 messages for context window)
      const apiMessages = newMessages.slice(-10).map((m) => ({
        role: m.role === 'bot' ? 'assistant' : 'user',
        content: m.content,
      }));

      try {
        const { data } = await api.post('/chatbot/chat', {
          messages: apiMessages,
          userId: user?._id,
        });

        const botMsg: Message = {
          id: uid(),
          role: 'bot',
          content: data.reply,
          ts: new Date(),
          intent: data.intent,
        };
        setMessages((prev) => [...prev, botMsg]);
      } catch {
        const errMsg: Message = {
          id: uid(),
          role: 'bot',
          content: "⚠️ I'm having a moment. Please try again or [Open Support Ticket].",
          ts: new Date(),
        };
        setMessages((prev) => [...prev, errMsg]);
      } finally {
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    },
    [input, messages, loading, user]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const copyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const clearHistory = () => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  const hasSpeech =
    typeof window !== 'undefined' &&
    ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  return (
    <>
      {/* ── Floating Orb ─────────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Open AI Support Chat"
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center
                    shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95
                    bg-gradient-to-br from-[#A100FF] to-[#6600CC]
                    ${pulse ? 'animate-pulse' : ''}
                    ${open ? 'rotate-45 scale-90' : ''}`}
        style={{
          boxShadow: open
            ? '0 0 0 0 transparent'
            : '0 0 20px rgba(161,0,255,0.6), 0 0 40px rgba(161,0,255,0.3)',
        }}
      >
        {open ? (
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        )}
      </button>

      {/* ── Chat Panel ───────────────────────────────────────────────────── */}
      <div
        className={`fixed z-40 transition-all duration-500 ease-out
                    ${open ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-8 pointer-events-none'}
                    bottom-24 right-6
                    w-[calc(100vw-3rem)] max-w-[400px]
                    sm:w-[400px]
                    max-sm:bottom-0 max-sm:right-0 max-sm:w-full max-sm:max-w-full max-sm:rounded-b-none`}
        style={{ height: 'min(600px, calc(100dvh - 7rem))' }}
      >
        <div
          className="flex flex-col h-full rounded-2xl max-sm:rounded-b-none overflow-hidden border border-white/10"
          style={{
            background: 'linear-gradient(180deg, #0f0a1a 0%, #0a0a0f 100%)',
            boxShadow: '0 0 40px rgba(161,0,255,0.2), 0 25px 50px rgba(0,0,0,0.8)',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0"
            style={{ background: 'linear-gradient(90deg, rgba(161,0,255,0.15), rgba(102,0,204,0.1))' }}
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#A100FF] to-[#6600CC] flex items-center justify-center text-lg">
                  🤖
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-[#0f0a1a]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">OTHub AI Support</p>
                <p className="text-xs text-green-400">Online · Instant replies</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={clearHistory}
                title="Clear chat"
                className="p-1.5 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/5 transition-all"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/5 transition-all"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-thin">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {/* Avatar */}
                {msg.role === 'bot' ? (
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#A100FF] to-[#6600CC] flex items-center justify-center text-sm flex-shrink-0 mt-1">
                    🤖
                  </div>
                ) : (
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0 mt-1">
                    {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                )}

                {/* Bubble */}
                <div className={`group relative max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
                  <div
                    className={`px-3 py-2 rounded-2xl text-sm leading-relaxed
                      ${msg.role === 'user'
                        ? 'bg-gradient-to-br from-[#A100FF] to-[#6600CC] text-white rounded-tr-sm'
                        : 'bg-white/8 border border-white/10 text-slate-200 rounded-tl-sm'
                      }`}
                    style={msg.role === 'bot' ? { background: 'rgba(255,255,255,0.06)' } : {}}
                  >
                    {renderContent(msg.content)}
                  </div>

                  {/* Copy button */}
                  <button
                    onClick={() => copyText(msg.id, msg.content)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity mt-1 text-xs text-white/30 hover:text-white/60 flex items-center gap-1"
                  >
                    {copied === msg.id ? '✓ Copied' : '⎘ Copy'}
                  </button>

                  <span className="text-[10px] text-white/20 mt-0.5 px-1">
                    {msg.ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {loading && (
              <div className="flex gap-2 items-center">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#A100FF] to-[#6600CC] flex items-center justify-center text-sm flex-shrink-0">
                  🤖
                </div>
                <div className="px-4 py-3 rounded-2xl rounded-tl-sm border border-white/10" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <div className="flex gap-1 items-center">
                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    <span className="ml-2 text-xs text-white/40">Bot is thinking...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Replies — show only when no messages or after welcome */}
          {messages.length <= 1 && !loading && (
            <div className="px-4 pb-2 flex gap-2 flex-wrap flex-shrink-0">
              {QUICK_REPLIES.map((qr) => (
                <button
                  key={qr.label}
                  onClick={() => sendMessage(qr.text)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium
                             border border-purple-500/30 text-purple-300 bg-purple-500/10
                             hover:bg-purple-500/20 hover:border-purple-400/50 transition-all"
                >
                  <span>{qr.icon}</span>
                  {qr.label}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="px-3 pb-3 pt-2 border-t border-white/10 flex-shrink-0">
            <div className="flex items-end gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2
                            focus-within:border-purple-500/50 focus-within:shadow-[0_0_0_1px_rgba(161,0,255,0.2)] transition-all">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask me anything..."
                rows={1}
                className="flex-1 bg-transparent text-sm text-white placeholder-white/30 resize-none outline-none
                           max-h-24 leading-relaxed"
                style={{ scrollbarWidth: 'none' }}
              />
              <div className="flex items-center gap-1 flex-shrink-0">
                {hasSpeech && (
                  <button
                    onClick={listening ? stopVoice : startVoice}
                    title={listening ? 'Stop listening' : 'Voice input'}
                    className={`p-1.5 rounded-lg transition-all ${
                      listening
                        ? 'text-red-400 bg-red-400/10 animate-pulse'
                        : 'text-white/40 hover:text-white/70 hover:bg-white/5'
                    }`}
                  >
                    <svg className="w-4 h-4" fill={listening ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  </button>
                )}
                <button
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || loading}
                  className="p-1.5 rounded-lg bg-gradient-to-br from-[#A100FF] to-[#6600CC]
                             text-white disabled:opacity-40 disabled:cursor-not-allowed
                             hover:shadow-[0_0_12px_rgba(161,0,255,0.5)] transition-all active:scale-95"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
            </div>
            <p className="text-center text-[10px] text-white/20 mt-1.5">
              Powered by OTHub AI · Press Enter to send
            </p>
          </div>
        </div>
      </div>

      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm sm:hidden"
          onClick={() => setOpen(false)}
        />
      )}
    </>
  );
}
