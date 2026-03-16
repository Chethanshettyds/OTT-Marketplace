import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { io, Socket } from 'socket.io-client';
import api from '../utils/api';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';

interface Attachment {
  filename: string;
  mimetype: string;
  size: number;
  data: string; // base64
}

interface Message {
  sender: string;
  senderName: string;
  senderRole: 'user' | 'admin';
  content: string;
  attachments?: Attachment[];
  createdAt: string;
}

interface Ticket {
  _id: string;
  subject: string;
  status: string;
  ticketNumber: string;
  messages: Message[];
}

interface TicketChatProps {
  ticketId: string;
  onBack: () => void;
}

const MAX_FILES = 3;
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

let socket: Socket | null = null;

export default function TicketChat({ ticketId, onBack }: TicketChatProps) {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();

  useEffect(() => {
    fetchTicket();
    socket = io(import.meta.env.VITE_API_URL || '/', { path: '/socket.io', transports: ['websocket'] });
    socket.emit('join_ticket', { ticketId, userId: user?._id });

    socket.on('receive_message', (data) => {
      if (data.ticketId === ticketId) {
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
  }, [ticketId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ticket?.messages]);

  const fetchTicket = async () => {
    try {
      const { data } = await api.get(`/tickets/${ticketId}`);
      setTicket(data.ticket);
    } catch {
      toast.error('Failed to load ticket');
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

  const sendMessage = async () => {
    if (!message.trim() || loading) return;
    setLoading(true);
    try {
      await api.post(`/tickets/${ticketId}/reply`, { message, attachments });
      setMessage('');
      setAttachments([]);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to send');
    } finally {
      setLoading(false);
    }
  };

  const handleTyping = () => socket?.emit('typing', { ticketId, userId: user?._id });

  if (!ticket) return (
    <div className="flex items-center justify-center h-64">
      <i className="pi pi-spin pi-spinner text-indigo-400 text-2xl" />
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-white/10">
        <button onClick={onBack} className="p-2 text-white/50 hover:text-white transition-colors">
          <i className="pi pi-arrow-left" />
        </button>
        <div className="flex-1">
          <h3 className="text-white font-semibold text-sm">{ticket.subject}</h3>
          <p className="text-white/40 text-xs">{ticket.ticketNumber}</p>
        </div>
        <span className={`status-badge ${
          ticket.status === 'open' ? 'bg-green-500/20 text-green-400' :
          ticket.status === 'in-progress' ? 'bg-yellow-500/20 text-yellow-400' :
          'bg-gray-500/20 text-gray-400'
        }`}>{ticket.status}</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {ticket.messages.map((msg, i) => {
          const isMe = msg.senderRole === user?.role && msg.senderName === user?.name;
          return (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-xs lg:max-w-md flex flex-col gap-1 ${isMe ? 'items-end' : 'items-start'}`}>
                <span className="text-white/30 text-xs px-1">
                  {msg.senderName} {msg.senderRole === 'admin' && '(Support)'}
                </span>
                <div className={`px-4 py-2.5 rounded-2xl text-sm ${
                  isMe
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-br-sm'
                    : 'glass text-white/90 rounded-bl-sm'
                }`}>
                  {msg.content}
                  {/* Attachments in bubble */}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {msg.attachments.map((att, ai) =>
                        att.mimetype.startsWith('image/') ? (
                          <img
                            key={ai}
                            src={att.data}
                            alt={att.filename}
                            className="max-w-[200px] rounded-lg cursor-pointer hover:opacity-90 transition-opacity border border-white/10"
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
                            <span className="truncate max-w-[140px]">{att.filename}</span>
                            <span className="text-white/40 shrink-0">{formatBytes(att.size)}</span>
                          </a>
                        )
                      )}
                    </div>
                  )}
                </div>
                <span className="text-white/20 text-xs px-1">
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
            Support is typing...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      {ticket.status !== 'closed' && (
        <div className="p-4 border-t border-white/10">
          {/* Attachment previews */}
          <AnimatePresence>
            {attachments.length > 0 && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }} className="flex flex-wrap gap-2 mb-2">
                {attachments.map((att, i) => (
                  <div key={i} className="flex items-center gap-1.5 bg-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white/80">
                    <i className={`pi ${att.mimetype.startsWith('image/') ? 'pi-image' : 'pi-file'} text-indigo-400`} />
                    <span className="max-w-[100px] truncate">{att.filename}</span>
                    <span className="text-white/40">{formatBytes(att.size)}</span>
                    <button onClick={() => removeAttachment(i)} className="text-white/40 hover:text-red-400 ml-1">
                      <i className="pi pi-times text-xs" />
                    </button>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex gap-2 items-end">
            <input ref={fileInputRef} type="file" multiple accept="*/*" className="hidden" onChange={handleFileChange} />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={attachments.length >= MAX_FILES}
              className="p-2.5 text-white/40 hover:text-indigo-400 transition-colors disabled:opacity-30 shrink-0"
              title="Attach files (max 3, 5MB each)"
            >
              <i className="pi pi-paperclip text-lg" />
            </button>
            <input
              value={message}
              onChange={(e) => { setMessage(e.target.value); handleTyping(); }}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder="Type a message..."
              className="input-field flex-1 py-2.5"
            />
            <button
              onClick={sendMessage}
              disabled={!message.trim() || loading}
              className="btn-primary px-4 disabled:opacity-50"
            >
              <i className={`pi ${loading ? 'pi-spin pi-spinner' : 'pi-send'}`} />
            </button>
          </div>
          {attachments.length > 0 && (
            <p className="text-white/20 text-xs mt-1.5">{attachments.length}/{MAX_FILES} files attached</p>
          )}
        </div>
      )}

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
