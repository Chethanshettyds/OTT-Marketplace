import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { io, Socket } from 'socket.io-client';
import api from '../utils/api';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import { useNotifications } from '../hooks/useNotifications';

interface Attachment {
  filename: string;
  mimetype: string;
  size: number;
  data: string;
}

interface Message {
  _id?: string;
  sender: string;
  senderName: string;
  senderRole: 'user' | 'admin';
  content: string;
  attachments?: Attachment[];
  createdAt: string;
}

interface Ticket {
  _id: string;
  ticketNumber: string;
  subject: string;
  category: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
  user: { _id: string; name: string; email: string };
}

const STATUS_OPTIONS = ['open', 'in-progress', 'closed'];
const MAX_FILES = 3;
const MAX_SIZE = 5 * 1024 * 1024;

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

const priorityStyle: Record<string, string> = {
  low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  high: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const statusStyle: Record<string, string> = {
  open: 'bg-green-500/20 text-green-400',
  'in-progress': 'bg-yellow-500/20 text-yellow-400',
  closed: 'bg-gray-500/20 text-gray-400',
};

let socket: Socket | null = null;

export default function AdminTicketView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { markRead } = useNotifications();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [sending, setSending] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!id) return;
    fetchTicket();
    markRead('support', id); // clear this ticket's unread notification immediately

    socket = io(import.meta.env.VITE_API_URL || '/', { path: '/socket.io', transports: ['websocket'] });
    socket.emit('join_ticket', { ticketId: id, userId: user?._id });

    socket.on('receive_message', (data) => {
      if (data.ticketId === id) {
        setTicket((prev) =>
          prev ? { ...prev, messages: [...prev.messages, data.message] } : prev
        );
      }
    });

    socket.on('user_typing', () => {
      setIsTyping(true);
      setTimeout(() => setIsTyping(false), 2000);
    });

    return () => { socket?.disconnect(); };
  }, [id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ticket?.messages]);

  const fetchTicket = async () => {
    try {
      const { data } = await api.get(`/tickets/${id}`);
      setTicket(data.ticket);
    } catch {
      toast.error('Failed to load ticket');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (attachments.length + files.length > MAX_FILES) {
      toast.error(`Max ${MAX_FILES} files per message`);
      return;
    }
    files.forEach((file) => {
      if (file.size > MAX_SIZE) { toast.error(`${file.name} exceeds 5MB`); return; }
      const reader = new FileReader();
      reader.onload = (ev) => {
        setAttachments((prev) => [
          ...prev,
          { filename: file.name, mimetype: file.type, size: file.size, data: ev.target?.result as string },
        ]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const removeAttachment = (i: number) =>
    setAttachments((prev) => prev.filter((_, idx) => idx !== i));

  const handleReply = async () => {
    if (!reply.trim() || sending) return;
    setSending(true);
    try {
      await api.post(`/tickets/${id}/reply`, { message: reply, attachments });
      setReply('');
      setAttachments([]);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to send reply');
    } finally {
      setSending(false);
    }
  };

  const handleStatusChange = async (status: string) => {
    if (!ticket || updatingStatus) return;
    setUpdatingStatus(true);
    try {
      const { data } = await api.put(`/tickets/${id}/status`, { status });
      setTicket((prev) => prev ? { ...prev, status: data.ticket.status } : prev);
      toast.success(`Status updated to ${status}`);
    } catch {
      toast.error('Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Permanently delete this ticket?')) return;
    try {
      await api.delete(`/tickets/${id}`);
      toast.success('Ticket deleted');
      navigate('/admin?tab=Tickets');
    } catch {
      toast.error('Failed to delete ticket');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen gradient-bg pt-20 flex items-center justify-center">
        <i className="pi pi-spin pi-spinner text-indigo-400 text-3xl" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="min-h-screen gradient-bg pt-20 flex items-center justify-center text-white/40">
        Ticket not found.
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-bg pt-20 pb-10">
      <div className="max-w-3xl mx-auto px-4">

        {/* Back + header */}
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <button
            onClick={() => navigate('/admin?tab=Tickets')}
            className="flex items-center gap-2 text-white/50 hover:text-white text-sm mb-4 transition-colors"
          >
            <i className="pi pi-arrow-left text-xs" /> Back to Tickets
          </button>

          <div className="glass rounded-2xl border border-white/10 p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="text-white/40 text-xs font-mono mb-1">{ticket.ticketNumber}</p>
                <h1 className="text-white font-bold text-xl">{ticket.subject}</h1>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="text-white/50 text-sm">
                    <i className="pi pi-user text-xs mr-1" />{ticket.user?.name}
                  </span>
                  <span className="text-white/30 text-xs">{ticket.user?.email}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${priorityStyle[ticket.priority]}`}>
                    {ticket.priority}
                  </span>
                  <span className="text-white/30 text-xs">
                    {ticket.category} · {new Date(ticket.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={ticket.status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  disabled={updatingStatus}
                  className={`text-xs px-3 py-1.5 rounded-lg border bg-transparent cursor-pointer transition-all ${statusStyle[ticket.status]} border-white/20 focus:outline-none`}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s} className="bg-[#0f0f1a] text-white capitalize">{s}</option>
                  ))}
                </select>
                <button
                  onClick={handleDelete}
                  className="p-1.5 text-white/30 hover:text-red-400 transition-colors rounded-lg hover:bg-red-500/10"
                  title="Delete ticket"
                >
                  <i className="pi pi-trash text-sm" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Thread */}
        <div className="glass rounded-2xl border border-white/10 overflow-hidden flex flex-col" style={{ minHeight: '480px' }}>
          <div className="flex-1 overflow-y-auto p-5 space-y-4 max-h-[520px]">
            {ticket.messages.map((msg, i) => {
              const isAdmin = msg.senderRole === 'admin';
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-sm lg:max-w-lg flex flex-col gap-1 ${isAdmin ? 'items-end' : 'items-start'}`}>
                    <span className="text-white/30 text-xs px-1">
                      {isAdmin ? `${msg.senderName} (Admin)` : msg.senderName}
                    </span>
                    <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                      isAdmin
                        ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-br-sm'
                        : 'bg-indigo-500/20 border border-indigo-500/30 text-white/90 rounded-bl-sm'
                    }`}>
                      {msg.content}
                      {/* Attachments */}
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="mt-2 space-y-1.5">
                          {msg.attachments.map((att, ai) =>
                            att.mimetype.startsWith('image/') ? (
                              <img
                                key={ai}
                                src={att.data}
                                alt={att.filename}
                                className="max-w-[220px] rounded-lg cursor-pointer hover:opacity-90 transition-opacity border border-white/10"
                                onClick={() => setLightbox(att.data)}
                              />
                            ) : (
                              <a
                                key={ai}
                                href={att.data}
                                download={att.filename}
                                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 transition-colors rounded-lg px-3 py-2 text-xs"
                              >
                                <i className="pi pi-file text-white/60" />
                                <span className="truncate max-w-[160px]">{att.filename}</span>
                                <span className="text-white/40 shrink-0">{formatBytes(att.size)}</span>
                                <i className="pi pi-download text-white/40 ml-auto" />
                              </a>
                            )
                          )}
                        </div>
                      )}
                    </div>
                    <span className="text-white/20 text-xs px-1">
                      {new Date(msg.createdAt).toLocaleString([], {
                        month: 'short', day: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                  </div>
                </motion.div>
              );
            })}

            {isTyping && (
              <div className="flex items-center gap-2 text-white/40 text-sm">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <motion.div key={i} className="w-1.5 h-1.5 bg-white/40 rounded-full"
                      animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.1 }} />
                  ))}
                </div>
                User is typing...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Reply box */}
          {ticket.status !== 'closed' ? (
            <div className="border-t border-white/10 p-4">
              {/* Attachment previews */}
              <AnimatePresence>
                {attachments.length > 0 && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }} className="flex flex-wrap gap-2 mb-2">
                    {attachments.map((att, i) => (
                      <div key={i} className="flex items-center gap-1.5 bg-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white/80">
                        <i className={`pi ${att.mimetype.startsWith('image/') ? 'pi-image' : 'pi-file'} text-orange-400`} />
                        <span className="max-w-[120px] truncate">{att.filename}</span>
                        <span className="text-white/40">{formatBytes(att.size)}</span>
                        <button onClick={() => removeAttachment(i)} className="text-white/40 hover:text-red-400 ml-1">
                          <i className="pi pi-times text-xs" />
                        </button>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              <input ref={fileInputRef} type="file" multiple accept="*/*" className="hidden" onChange={handleFileChange} />

              <div className="flex gap-2 items-end">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={attachments.length >= MAX_FILES}
                  className="p-2.5 text-white/40 hover:text-orange-400 transition-colors disabled:opacity-30 shrink-0"
                  title="Attach files (max 3, 5MB each)"
                >
                  <i className="pi pi-paperclip text-lg" />
                </button>
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply(); }
                  }}
                  placeholder="Type your reply... (Enter to send, Shift+Enter for new line)"
                  rows={3}
                  className="input-field flex-1 resize-none text-sm py-2.5"
                />
                <button
                  onClick={handleReply}
                  disabled={!reply.trim() || sending}
                  className="btn-primary px-4 py-2.5 disabled:opacity-50 flex items-center gap-2 self-end"
                >
                  {sending
                    ? <i className="pi pi-spin pi-spinner" />
                    : <><i className="pi pi-send text-xs" /> Reply</>
                  }
                </button>
              </div>
              <div className="flex items-center justify-between mt-2">
                <p className="text-white/20 text-xs">Replying as Admin · status will update to "in-progress"</p>
                {attachments.length > 0 && (
                  <p className="text-white/20 text-xs">{attachments.length}/{MAX_FILES} files attached</p>
                )}
              </div>
            </div>
          ) : (
            <div className="border-t border-white/10 p-4 text-center text-white/30 text-sm">
              <i className="pi pi-lock mr-2" />This ticket is closed. Reopen it to reply.
            </div>
          )}
        </div>
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
            onClick={() => setLightbox(null)}
          >
            <img src={lightbox} alt="Preview" className="max-w-full max-h-full rounded-xl shadow-2xl" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
