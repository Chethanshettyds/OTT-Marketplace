import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../utils/api';

// ── Types ─────────────────────────────────────────────────────────────────────
type ConversationState = 'idle' | 'awaiting_order_id';

interface OrderResult {
  orderNumber: string;
  status: 'pending' | 'processing' | 'delivered' | 'refunded' | 'cancelled';
  amount: number;
  productName: string;
  platform: string;
  duration: string;
  createdAt: string;
  isRefunded: boolean;
}

interface Message {
  id: string;
  role: 'user' | 'bot';
  content: string;
  ts: Date;
  intent?: string;
  orderCard?: OrderResult | null;
  // special: renders topic-picker buttons instead of text
  menuButtons?: Array<{ label: string; icon: string; action: string }>;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const TOPIC_MENU = [
  { label: 'Order Status',    icon: 'pi pi-box',          action: 'I want to check my order status' },
  { label: 'Wallet & Top-up', icon: 'pi pi-wallet',       action: 'How do I top up my wallet?' },
  { label: 'Subscriptions',   icon: 'pi pi-play-circle',  action: 'Show me my active subscriptions' },
  { label: 'Account Issues',  icon: 'pi pi-user',         action: 'I have an account issue' },
  { label: 'Get a Refund',    icon: 'pi pi-refresh',      action: 'I need a refund for my order' },
  { label: 'Talk to Human',   icon: 'pi pi-headphones',   action: 'I want to talk to a human agent' },
];

const STATUS_META: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  pending:    { label: 'Pending',    color: 'text-yellow-300', bg: 'bg-yellow-500/15 border-yellow-500/30', icon: '⏳' },
  processing: { label: 'Processing', color: 'text-blue-300',   bg: 'bg-blue-500/15 border-blue-500/30',    icon: '⚙️' },
  delivered:  { label: 'Delivered',  color: 'text-green-300',  bg: 'bg-green-500/15 border-green-500/30',  icon: '✅' },
  refunded:   { label: 'Refunded',   color: 'text-purple-300', bg: 'bg-purple-500/15 border-purple-500/30',icon: '↩️' },
  cancelled:  { label: 'Cancelled',  color: 'text-red-300',    bg: 'bg-red-500/15 border-red-500/30',      icon: '❌' },
};

const STORAGE_KEY = 'othub-chat-history';
const SESSION_TTL = 24 * 60 * 60 * 1000;

// ── Helpers ───────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2);

function loadHistory(): Message[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const { messages, savedAt } = JSON.parse(raw);
    if (Date.now() - savedAt > SESSION_TTL) return [];
    return messages.map((m: any) => ({ ...m, ts: new Date(m.ts) }));
  } catch { return []; }
}

function saveHistory(msgs: Message[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ messages: msgs, savedAt: Date.now() })); } catch {}
}

function looksLikeOrderId(text: string): boolean {
  return /^ORD-\d+-[A-Z0-9]+$/i.test(text.trim());
}

function extractOrderNumber(text: string): string | null {
  const m = text.match(/ORD-\d+-[A-Z0-9]+/i);
  return m ? m[0].toUpperCase() : null;
}

// ── renderContent ─────────────────────────────────────────────────────────────
function renderContent(content: string) {
  return content.split('\n').map((line, li, arr) => {
    const parts = line.split(/(\[[^\]]+\])/g);
    return (
      <span key={li}>
        {parts.map((part, pi) => {
          if (/^\[[^\]]+\]$/.test(part)) {
            const label = part.slice(1, -1);
            const href = getActionHref(label);
            return (
              <a key={pi} href={href}
                className="inline-flex items-center gap-1 mt-1 mr-1 px-3 py-1.5 rounded-full text-xs font-semibold
                           bg-purple-600/25 border border-purple-500/40 text-purple-200
                           hover:bg-purple-600/45 hover:border-purple-400 transition-all cursor-pointer no-underline">
                {label}
              </a>
            );
          }
          return part.split(/(\*\*[^*]+\*\*)/g).map((bp, bpi) =>
            /^\*\*[^*]+\*\*$/.test(bp)
              ? <strong key={bpi} className="text-white font-semibold">{bp.slice(2, -2)}</strong>
              : <span key={bpi}>{bp}</span>
          );
        })}
        {li < arr.length - 1 && <br />}
      </span>
    );
  });
}

function getActionHref(label: string): string {
  const l = label.toLowerCase();
  if (l.includes('order') || l.includes('detail') || l.includes('view') || l.includes('all')) return '/dashboard';
  if (l.includes('dashboard') || l.includes('subscription')) return '/dashboard';
  if (l.includes('shop') || l.includes('browse')) return '/shop';
  if (l.includes('ticket') || l.includes('support') || l.includes('report') || l.includes('connect')) return '/tickets';
  if (l.includes('top up') || l.includes('fund') || l.includes('wallet')) return '/dashboard';
  return '#';
}

// ── OrderCard ─────────────────────────────────────────────────────────────────
function OrderCard({ order, onNavigate }: { order: OrderResult; onNavigate: () => void }) {
  const meta = STATUS_META[order.status] || STATUS_META.pending;
  const date = new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="mt-2 rounded-xl border border-white/10 overflow-hidden w-full"
      style={{ background: 'linear-gradient(135deg, rgba(161,0,255,0.08) 0%, rgba(10,10,15,0.95) 100%)' }}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/8"
        style={{ background: 'rgba(161,0,255,0.12)' }}>
        <div className="flex items-center gap-2">
          <span className="text-sm">📦</span>
          <span className="text-xs font-mono text-purple-300 font-semibold tracking-wide">{order.orderNumber}</span>
        </div>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${meta.bg} ${meta.color}`}>
          {meta.icon} {meta.label}
        </span>
      </div>
      <div className="px-3 py-2.5 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-white leading-tight">{order.productName}</p>
            {order.platform && (
              <p className="text-xs text-white/40 mt-0.5">{order.platform}{order.duration ? ` · ${order.duration}` : ''}</p>
            )}
          </div>
          <p className="text-sm font-bold text-purple-300 flex-shrink-0">₹{order.amount}</p>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-white/35">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Ordered on {date}
        </div>
        <div className={`text-[11px] px-2.5 py-1.5 rounded-lg border ${meta.bg} ${meta.color} leading-snug`}>
          {order.status === 'pending'    && '⏳ Your order is queued and will be processed shortly.'}
          {order.status === 'processing' && "⚙️ We're preparing your subscription credentials."}
          {order.status === 'delivered'  && '✅ Delivered! Check your email or Dashboard for credentials.'}
          {order.status === 'refunded'   && '↩️ This order has been refunded to your wallet.'}
          {order.status === 'cancelled'  && '❌ This order was cancelled.'}
        </div>
      </div>
      <div className="px-3 pb-3">
        <button onClick={onNavigate}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold
                     bg-gradient-to-r from-[#A100FF] to-[#6600CC] text-white
                     hover:shadow-[0_0_16px_rgba(161,0,255,0.45)] transition-all active:scale-[0.98]">
          View Full Order Details
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── TopicMenu — rendered inside a bot bubble ──────────────────────────────────
function TopicMenu({ buttons, onSelect, disabled }: {
  buttons: Array<{ label: string; icon: string; action: string }>;
  onSelect: (action: string, label: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="mt-2 grid grid-cols-2 gap-2">
      {buttons.map((btn) => (
        <button
          key={btn.label}
          disabled={disabled}
          onClick={() => onSelect(btn.action, btn.label)}
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-xs font-semibold
                     border border-purple-500/25 text-white/80 transition-all group
                     hover:border-purple-400/60 hover:bg-purple-500/15 hover:text-white
                     active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: 'rgba(161,0,255,0.07)' }}
        >
          <i className={`${btn.icon} text-[15px] text-purple-400 group-hover:text-purple-300 transition-colors flex-shrink-0`} />
          <span className="leading-tight">{btn.label}</span>
        </button>
      ))}
    </div>
  );
}


// ── NewChatBanner — shown after a conversation completes ──────────────────────
function NewChatBanner({ onNewChat }: { onNewChat: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 py-3 px-4">
      <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <p className="text-[11px] text-white/30">Conversation ended</p>
      <button
        onClick={onNewChat}
        className="flex items-center gap-2 px-5 py-2 rounded-full text-xs font-semibold
                   border border-purple-500/40 text-purple-300
                   hover:bg-purple-500/15 hover:border-purple-400/70 hover:text-white
                   transition-all active:scale-95"
        style={{ background: 'rgba(161,0,255,0.08)' }}
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 4v16m8-8H4" />
        </svg>
        Start New Chat
      </button>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function AIChatbot() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => loadHistory());
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [pulse, setPulse] = useState(true);
  const [convState, setConvState] = useState<ConversationState>('idle');
  // true once a full exchange has completed — shows "New Chat" banner
  const [convDone, setConvDone] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => { if (open) setPulse(false); }, [open]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);
  useEffect(() => { if (messages.length) saveHistory(messages); }, [messages]);

  // Build welcome message with topic menu
  const buildWelcome = useCallback((): Message => ({
    id: uid(),
    role: 'bot',
    ts: new Date(),
    content: `👋 Hey${user?.name ? ` ${user.name.split(' ')[0]}` : ''}! I'm OTHub's AI assistant.\n\nWhat can I help you with today?`,
    menuButtons: TOPIC_MENU,
  }), [user]);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([buildWelcome()]);
    }
  }, [open]);

  // Voice
  const startVoice = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = 'en-US'; rec.interimResults = false;
    rec.onresult = (e: any) => { setInput(e.results[0][0].transcript); setListening(false); };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    rec.start(); setListening(true);
  }, []);
  const stopVoice = useCallback(() => { recognitionRef.current?.stop(); setListening(false); }, []);

  // New chat — wipe everything and show fresh welcome
  const startNewChat = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setConvDone(false);
    setConvState('idle');
    setInput('');
    const welcome = buildWelcome();
    setMessages([welcome]);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [buildWelcome]);

  // ── Order lookup ──────────────────────────────────────────────────────────
  const handleOrderLookup = useCallback(async (orderNumber: string) => {
    setLoading(true);
    try {
      const { data } = await api.post('/chatbot/order-status', { orderNumber });

      if (!data.found) {
        setMessages((prev) => [...prev, {
          id: uid(), role: 'bot', ts: new Date(),
          content: `🔍 ${data.message}\n\nWant to see all your orders? [View All Orders]`,
        }]);
      } else {
        const o: OrderResult = data.order;
        const meta = STATUS_META[o.status] || STATUS_META.pending;
        setMessages((prev) => [...prev,
          { id: uid(), role: 'bot', ts: new Date(), content: `🔍 Found your order! Here's the latest status:`, orderCard: o, intent: 'order_lookup' },
          {
            id: uid(), role: 'bot', ts: new Date(),
            content: `${meta.icon} Status is **${meta.label}**. ${
              o.status === 'delivered'  ? 'Your credentials have been sent to your email. Check your Dashboard for details.' :
              o.status === 'pending'    ? "We'll process it shortly — usually within 1–24 hours." :
              o.status === 'processing' ? "Almost there! We're preparing your subscription." :
              o.status === 'refunded'   ? 'The amount has been credited back to your wallet.' :
              'If you need help, open a support ticket.'
            }\n\nIs there anything else I can help you with?`,
          },
        ]);
      }
      setConvState('idle');
      setConvDone(true);
    } catch {
      setMessages((prev) => [...prev, {
        id: uid(), role: 'bot', ts: new Date(),
        content: `⚠️ Couldn't fetch that order right now. Please try again or [Open Support Ticket].`,
      }]);
      setConvState('idle');
      setConvDone(true);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, []);

  // ── Main send ─────────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;

    setConvDone(false);
    const userMsg: Message = { id: uid(), role: 'user', content, ts: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');

    // Awaiting order ID
    if (convState === 'awaiting_order_id') {
      const extracted = extractOrderNumber(content) || (looksLikeOrderId(content) ? content.trim().toUpperCase() : null);
      if (extracted) {
        await handleOrderLookup(extracted);
      } else {
        setLoading(true);
        await new Promise((r) => setTimeout(r, 400));
        setMessages((prev) => [...prev, {
          id: uid(), role: 'bot', ts: new Date(),
          content: `🤔 That doesn't look like a valid Order ID. They look like **ORD-1234567-ABCDE**.\n\nYou can find yours in **Dashboard → Orders**. Please try again:`,
        }]);
        setLoading(false);
      }
      return;
    }

    // Direct order number typed
    const directOrder = extractOrderNumber(content);
    if (directOrder) {
      await handleOrderLookup(directOrder);
      return;
    }

    // Order intent → ask for ID
    if (/order|status|track|where.*order|check.*order|my order/i.test(content)) {
      setLoading(true);
      await new Promise((r) => setTimeout(r, 500));
      setMessages((prev) => [...prev, {
        id: uid(), role: 'bot', ts: new Date(),
        content: `📦 Sure! Please type your **Order ID** to check the status.\n\nIt looks like **ORD-1234567-ABCDE** — you can find it in **Dashboard → Orders**.`,
      }]);
      setConvState('awaiting_order_id');
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
      return;
    }

    // GPT / fallback
    setLoading(true);
    const apiMessages = [...messages, userMsg].slice(-10).map((m) => ({
      role: m.role === 'bot' ? 'assistant' : 'user',
      content: m.content,
    }));

    try {
      const { data } = await api.post('/chatbot/chat', { messages: apiMessages, userId: user?._id });
      setMessages((prev) => [...prev, { id: uid(), role: 'bot', ts: new Date(), content: data.reply, intent: data.intent }]);
      setConvDone(true);
    } catch {
      setMessages((prev) => [...prev, {
        id: uid(), role: 'bot', ts: new Date(),
        content: `⚠️ I'm having a moment. Please try again or [Open Support Ticket].`,
      }]);
      setConvDone(true);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [input, messages, loading, user, convState, handleOrderLookup]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const copyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => { setCopied(id); setTimeout(() => setCopied(null), 2000); });
  };

  const hasSpeech = typeof window !== 'undefined' &&
    ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  const inputPlaceholder = convState === 'awaiting_order_id'
    ? 'Paste your Order ID here (e.g. ORD-1234567-ABCDE)...'
    : 'Type a message...';

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
        style={{ boxShadow: open ? 'none' : '0 0 20px rgba(161,0,255,0.6), 0 0 40px rgba(161,0,255,0.3)' }}
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
                    w-[calc(100vw-3rem)] max-w-[400px] sm:w-[400px]
                    max-sm:bottom-0 max-sm:right-0 max-sm:w-full max-sm:max-w-full`}
        style={{ height: 'min(640px, calc(100dvh - 7rem))' }}
      >
        <div
          className="flex flex-col h-full rounded-2xl max-sm:rounded-b-none overflow-hidden border border-white/10"
          style={{
            background: 'linear-gradient(180deg, #0f0a1a 0%, #0a0a0f 100%)',
            boxShadow: '0 0 40px rgba(161,0,255,0.2), 0 25px 50px rgba(0,0,0,0.8)',
          }}
        >
          {/* ── Header ── */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0"
            style={{ background: 'linear-gradient(90deg, rgba(161,0,255,0.15), rgba(102,0,204,0.08))' }}>
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#A100FF] to-[#6600CC] flex items-center justify-center text-lg">🤖</div>
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-[#0f0a1a]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">OTHub AI Support</p>
                <p className="text-xs text-green-400">Online · Instant replies</p>
              </div>
            </div>
            {/* New Chat button in header */}
            <button
              onClick={startNewChat}
              title="Start new chat"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                         text-white/50 hover:text-white border border-white/8 hover:border-purple-500/40
                         hover:bg-purple-500/10 transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Chat
            </button>
          </div>

          {/* ── Messages ── */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
            style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(161,0,255,0.3) transparent' }}>
            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                {/* Avatar */}
                {msg.role === 'bot' ? (
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#A100FF] to-[#6600CC] flex items-center justify-center text-sm flex-shrink-0 mt-1">🤖</div>
                ) : (
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0 mt-1">
                    {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                )}

                {/* Bubble */}
                <div className={`group max-w-[85%] flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`px-3 py-2.5 rounded-2xl text-sm leading-relaxed
                      ${msg.role === 'user'
                        ? 'bg-gradient-to-br from-[#A100FF] to-[#6600CC] text-white rounded-tr-sm'
                        : 'text-slate-200 rounded-tl-sm border border-white/10'}`}
                    style={msg.role === 'bot' ? { background: 'rgba(255,255,255,0.06)' } : {}}
                  >
                    {renderContent(msg.content)}

                    {/* Topic menu buttons — rendered inside the bubble */}
                    {msg.menuButtons && (
                      <TopicMenu
                        buttons={msg.menuButtons}
                        onSelect={(action) => sendMessage(action)}
                        disabled={loading}
                      />
                    )}
                  </div>

                  {/* Order card */}
                  {msg.orderCard && (
                    <div className="w-full mt-1">
                      <OrderCard order={msg.orderCard} onNavigate={() => { navigate(`/dashboard?tab=orders&search=${encodeURIComponent(msg.orderCard!.orderNumber)}`); setOpen(false); }} />
                    </div>
                  )}

                  <button onClick={() => copyText(msg.id, msg.content)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity mt-1 text-[10px] text-white/30 hover:text-white/60 flex items-center gap-1">
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
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#A100FF] to-[#6600CC] flex items-center justify-center text-sm flex-shrink-0">🤖</div>
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

            {/* New Chat banner — shown after conversation completes */}
            {convDone && !loading && <NewChatBanner onNewChat={startNewChat} />}

            <div ref={messagesEndRef} />
          </div>

          {/* Order ID hint bar */}
          {convState === 'awaiting_order_id' && !loading && (
            <div className="mx-3 mb-2 px-3 py-2 rounded-xl border border-purple-500/25 flex items-center gap-2 flex-shrink-0"
              style={{ background: 'rgba(161,0,255,0.08)' }}>
              <span className="text-sm">🔍</span>
              <p className="text-xs text-purple-300/80">
                Waiting for Order ID — format: <span className="font-mono font-semibold text-purple-200">ORD-XXXXXXX-XXXXX</span>
              </p>
            </div>
          )}

          {/* ── Input ── */}
          <div className="px-3 pb-3 pt-2 border-t border-white/10 flex-shrink-0">
            <div className={`flex items-end gap-2 border rounded-xl px-3 py-2 transition-all
                            ${convState === 'awaiting_order_id'
                              ? 'border-purple-500/50 shadow-[0_0_0_1px_rgba(161,0,255,0.2)]'
                              : 'border-white/10 focus-within:border-purple-500/50 focus-within:shadow-[0_0_0_1px_rgba(161,0,255,0.2)]'}`}
              style={{ background: convState === 'awaiting_order_id' ? 'rgba(161,0,255,0.06)' : 'rgba(255,255,255,0.04)' }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={inputPlaceholder}
                rows={1}
                className="flex-1 bg-transparent text-sm text-white placeholder-white/30 resize-none outline-none max-h-24 leading-relaxed"
                style={{ scrollbarWidth: 'none' }}
              />
              <div className="flex items-center gap-1 flex-shrink-0">
                {hasSpeech && (
                  <button onClick={listening ? stopVoice : startVoice}
                    title={listening ? 'Stop' : 'Voice input'}
                    className={`p-1.5 rounded-lg transition-all ${listening ? 'text-red-400 bg-red-400/10 animate-pulse' : 'text-white/40 hover:text-white/70 hover:bg-white/5'}`}>
                    <svg className="w-4 h-4" fill={listening ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  </button>
                )}
                <button onClick={() => sendMessage()} disabled={!input.trim() || loading}
                  className="p-1.5 rounded-lg bg-gradient-to-br from-[#A100FF] to-[#6600CC] text-white
                             disabled:opacity-40 disabled:cursor-not-allowed
                             hover:shadow-[0_0_12px_rgba(161,0,255,0.5)] transition-all active:scale-95">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
            </div>
            <p className="text-center text-[10px] text-white/20 mt-1.5">Powered by OTHub AI · Enter to send</p>
          </div>
        </div>
      </div>

      {/* Mobile backdrop */}
      {open && (
        <div className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm sm:hidden" onClick={() => setOpen(false)} />
      )}
    </>
  );
}
