import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import api from '../utils/api';
import toast from 'react-hot-toast';
import TicketChat from '../components/TicketChat';
import { useNotifications } from '../hooks/useNotifications';

interface Ticket {
  _id: string;
  ticketNumber: string;
  subject: string;
  category: string;
  status: string;
  priority: string;
  messages: Array<{ content: string; createdAt: string }>;
  createdAt: string;
}

interface NewTicketForm {
  subject: string;
  category: string;
  message: string;
}

const CATEGORIES = ['Order Issue', 'Payment', 'Account', 'Technical', 'Other'];

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<NewTicketForm>();
  const { markRead } = useNotifications();

  useEffect(() => {
    fetchTickets();
  }, []);

  const handleSelectTicket = (id: string) => {
    setSelectedTicket(id);
    markRead('support');
  };

  const fetchTickets = async () => {
    try {
      const { data } = await api.get('/tickets/my');
      setTickets(data.tickets);
    } catch {
      toast.error('Failed to load tickets');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (data: NewTicketForm) => {
    try {
      await api.post('/tickets', data);
      toast.success('Ticket created');
      reset();
      setShowForm(false);
      fetchTickets();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create ticket');
    }
  };

  const statusColor: Record<string, string> = {
    open: 'bg-green-500/20 text-green-400',
    'in-progress': 'bg-yellow-500/20 text-yellow-400',
    closed: 'bg-gray-500/20 text-gray-400',
  };

  if (selectedTicket) {
    return (
      <div className="min-h-screen gradient-bg pt-20 pb-10">
        <div className="max-w-3xl mx-auto px-4 h-[calc(100vh-6rem)]">
          <div className="glass rounded-2xl border border-white/10 h-full flex flex-col overflow-hidden">
            <TicketChat ticketId={selectedTicket} onBack={() => { setSelectedTicket(null); fetchTickets(); }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-bg pt-20 pb-10">
      <div className="max-w-4xl mx-auto px-4">
        <motion.div
          className="flex items-center justify-between mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div>
            <h1 className="text-white font-bold text-2xl flex items-center gap-2">
              <i className="pi pi-ticket text-indigo-400" /> Support Tickets
            </h1>
            <p className="text-white/40 text-sm mt-1">Get help with your orders and account</p>
          </div>
          <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2">
            <i className={`pi ${showForm ? 'pi-times' : 'pi-plus'} text-sm`} />
            {showForm ? 'Cancel' : 'New Ticket'}
          </button>
        </motion.div>

        {/* New ticket form */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              className="glass rounded-2xl p-6 border border-white/10 mb-6"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <h3 className="text-white font-semibold mb-4">Create New Ticket</h3>
              <form onSubmit={handleSubmit(handleCreate)} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-white/70 text-sm block mb-2">Subject</label>
                    <input
                      {...register('subject', { required: 'Subject required' })}
                      placeholder="Brief description of your issue"
                      className="input-field"
                    />
                    {errors.subject && <p className="text-red-400 text-xs mt-1">{errors.subject.message}</p>}
                  </div>
                  <div>
                    <label className="text-white/70 text-sm block mb-2">Category</label>
                    <select {...register('category')} className="input-field">
                      {CATEGORIES.map((c) => <option key={c} value={c} className="bg-dark-800">{c}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-white/70 text-sm block mb-2">Message</label>
                  <textarea
                    {...register('message', { required: 'Message required' })}
                    rows={4}
                    placeholder="Describe your issue in detail..."
                    className="input-field resize-none"
                  />
                  {errors.message && <p className="text-red-400 text-xs mt-1">{errors.message.message}</p>}
                </div>
                <button type="submit" className="btn-primary py-2.5 px-6">
                  <i className="pi pi-send mr-2 text-sm" /> Submit Ticket
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tickets list */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="glass rounded-2xl h-20 animate-pulse" />)}
          </div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-20 text-white/30">
            <i className="pi pi-ticket text-5xl mb-4 block" />
            <p className="text-lg">No tickets yet</p>
            <p className="text-sm mt-1">Create a ticket if you need help</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tickets.map((ticket) => (
              <motion.div
                key={ticket._id}
                className="glass rounded-2xl p-5 border border-white/10 cursor-pointer hover:border-indigo-500/30 transition-all duration-200"
                onClick={() => handleSelectTicket(ticket._id)}
                whileHover={{ x: 4 }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white/40 text-xs font-mono">{ticket.ticketNumber}</span>
                      <span className={`status-badge ${statusColor[ticket.status]}`}>{ticket.status}</span>
                    </div>
                    <h4 className="text-white font-medium truncate">{ticket.subject}</h4>
                    <p className="text-white/40 text-sm mt-0.5 truncate">
                      {ticket.messages[ticket.messages.length - 1]?.content}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-white/30 text-xs">{new Date(ticket.createdAt).toLocaleDateString()}</p>
                    <p className="text-white/40 text-xs mt-1">{ticket.messages.length} messages</p>
                    <i className="pi pi-chevron-right text-white/20 text-xs mt-1 block" />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
