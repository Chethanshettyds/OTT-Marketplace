import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import api from '../utils/api';

// ── Types ─────────────────────────────────────────────────────────────────────
type GroupBy = 'day' | 'month' | 'year';
type ReportTab = 'Payments' | 'Orders' | 'Tickets';

interface PaymentItem {
  _id: string; dateTime: string; user: { name: string; email: string };
  orderNumber?: string; amount: number; currency: string;
  status: string; method: string; type: string; note?: string;
}
interface PaymentSummary {
  totalAmount: number; currency: string; totalCount: number;
  successCount: number; failedCount: number; refundedAmount: number;
}
interface OrderItem {
  _id: string; createdAt: string; user: { name: string; email: string };
  planName: string; platform: string; orderStatus: string;
  paymentStatus: string; amount: number; currency: string;
  orderNumber: string; paymentMethod: string;
}
interface OrderSummary {
  totalOrders: number; completed: number; pending: number;
  cancelled: number; totalRevenue: number; currency: string;
}
interface TicketItem {
  _id: string; createdAt: string; updatedAt: string;
  user: { name: string; email: string }; subject: string;
  priority: string; status: string; ticketNumber: string;
}
interface TicketSummary {
  totalTickets: number; open: number; inProgress: number; closed: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (d: string) =>
  new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const YEARS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const PAYMENT_STATUS_STYLE: Record<string, string> = {
  completed: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  refunded:  'bg-amber-500/15 text-amber-400 border-amber-500/30',
  failed:    'bg-red-500/15 text-red-400 border-red-500/30',
  pending:   'bg-blue-500/15 text-blue-400 border-blue-500/30',
};
const ORDER_STATUS_STYLE: Record<string, string> = {
  delivered:  'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  processing: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  pending:    'bg-amber-500/15 text-amber-400 border-amber-500/30',
  cancelled:  'bg-rose-500/15 text-rose-400 border-rose-500/30',
  refunded:   'bg-amber-500/15 text-amber-400 border-amber-500/30',
};
const TICKET_STATUS_STYLE: Record<string, string> = {
  open:        'bg-blue-500/15 text-blue-400 border-blue-500/30',
  'in-progress':'bg-amber-500/15 text-amber-400 border-amber-500/30',
  closed:      'bg-slate-500/15 text-slate-400 border-slate-500/30',
};
const PRIORITY_STYLE: Record<string, string> = {
  high:   'bg-red-500/15 text-red-400 border-red-500/30',
  medium: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  low:    'bg-sky-500/15 text-sky-400 border-sky-500/30',
};

const PAGE_SIZES = [10, 25, 50];

function usePagination<T>(items: T[], pageSize: number) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const paged = items.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => { setPage(1); }, [items.length, pageSize]);
  return { page, setPage, totalPages, paged };
}

function Pagination({ page, totalPages, setPage }: { page: number; totalPages: number; setPage: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-end gap-1 mt-4 text-xs text-slate-400">
      <button onClick={() => setPage(1)} disabled={page === 1} className="px-2 py-1.5 rounded-lg hover:bg-slate-800/80 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">«</button>
      <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="px-2 py-1.5 rounded-lg hover:bg-slate-800/80 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">‹</button>
      <span className="px-3 py-1 rounded-lg bg-slate-800/60 text-slate-200 font-medium min-w-[60px] text-center">{page} / {totalPages}</span>
      <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="px-2 py-1.5 rounded-lg hover:bg-slate-800/80 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">›</button>
      <button onClick={() => setPage(totalPages)} disabled={page === totalPages} className="px-2 py-1.5 rounded-lg hover:bg-slate-800/80 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">»</button>
    </div>
  );
}

function Badge({ label, style }: { label: string; style: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border capitalize ${style}`}>
      {label}
    </span>
  );
}

function UserCell({ name, email }: { name?: string; email?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
        <span className="text-white text-xs font-bold">{name?.[0]?.toUpperCase() || '?'}</span>
      </div>
      <div className="min-w-0">
        <p className="text-white text-sm font-medium leading-tight">{name || '—'}</p>
        <p className="text-slate-500 text-xs truncate">{email || '—'}</p>
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-2 py-4">
      {[1,2,3,4,5].map(i => (
        <div key={i} className="h-12 rounded-xl bg-white/5 animate-pulse" style={{ opacity: 1 - i * 0.15 }} />
      ))}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="text-center py-16 text-white/30">
      <i className="pi pi-inbox text-4xl mb-3 block" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

// ── Filter Bar ────────────────────────────────────────────────────────────────
interface FilterBarProps {
  groupBy: GroupBy; setGroupBy: (g: GroupBy) => void;
  date: string; setDate: (d: string) => void;
  month: number; setMonth: (m: number) => void;
  year: number; setYear: (y: number) => void;
  status: string; setStatus: (s: string) => void;
  statusOptions: { value: string; label: string }[];
}

function FilterBar({ groupBy, setGroupBy, date, setDate, month, setMonth, year, setYear, status, setStatus, statusOptions }: FilterBarProps) {
  const today = new Date().toISOString().split('T')[0];
  return (
    <div className="flex flex-wrap items-center gap-3 mb-5 p-4 rounded-xl bg-white/5 border border-white/10">
      {/* Period selector */}
      <div className="flex rounded-lg overflow-hidden border border-white/10 flex-shrink-0">
        {(['day','month','year'] as GroupBy[]).map(g => (
          <button key={g} onClick={() => setGroupBy(g)}
            className={`px-3 py-1.5 text-xs font-medium capitalize transition-all ${groupBy === g ? 'bg-indigo-500 text-white' : 'text-white/50 hover:text-white hover:bg-white/5'}`}>
            {g === 'day' ? 'Daily' : g === 'month' ? 'Monthly' : 'Yearly'}
          </button>
        ))}
      </div>

      {/* Date pickers */}
      {groupBy === 'day' && (
        <input type="date" value={date} max={today} onChange={e => setDate(e.target.value)}
          className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-500/60 transition-all" />
      )}
      {groupBy === 'month' && (
        <>
          <select value={month} onChange={e => setMonth(Number(e.target.value))}
            className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-500/60 transition-all">
            {MONTHS.map((m, i) => <option key={i} value={i + 1} className="bg-slate-900">{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-500/60 transition-all">
            {YEARS.map(y => <option key={y} value={y} className="bg-slate-900">{y}</option>)}
          </select>
        </>
      )}
      {groupBy === 'year' && (
        <select value={year} onChange={e => setYear(Number(e.target.value))}
          className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-500/60 transition-all">
          {YEARS.map(y => <option key={y} value={y} className="bg-slate-900">{y}</option>)}
        </select>
      )}

      {/* Status filter */}
      <div className="ml-auto flex-shrink-0">
        <select value={status} onChange={e => setStatus(e.target.value)}
          className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-500/60 transition-all">
          {statusOptions.map(o => <option key={o.value} value={o.value} className="bg-slate-900">{o.label}</option>)}
        </select>
      </div>
    </div>
  );
}

// ── Payments Report ───────────────────────────────────────────────────────────
function PaymentsReport() {
  const now = new Date();
  const [groupBy, setGroupBy] = useState<GroupBy>('month');
  const [date, setDate] = useState(now.toISOString().split('T')[0]);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [status, setStatus] = useState('all');
  const [items, setItems] = useState<PaymentItem[]>([]);
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [pageSize, setPageSize] = useState(10);
  const { page, setPage, totalPages, paged } = usePagination(items, pageSize);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { groupBy, status };
      if (groupBy === 'day') params.date = date;
      else if (groupBy === 'month') { params.month = String(month); params.year = String(year); }
      else params.year = String(year);
      const { data } = await api.get('/admin/reports/payments', { params });
      setItems(data.items);
      setSummary(data.summary);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [groupBy, date, month, year, status]);

  useEffect(() => { fetch(); }, [fetch]);

  const statusOptions = [
    { value: 'all', label: 'All Statuses' },
    { value: 'completed', label: 'Completed' },
    { value: 'failed', label: 'Failed' },
    { value: 'refunded', label: 'Refunded' },
    { value: 'pending', label: 'Pending' },
  ];

  return (
    <div>
      <FilterBar groupBy={groupBy} setGroupBy={setGroupBy} date={date} setDate={setDate}
        month={month} setMonth={setMonth} year={year} setYear={setYear}
        status={status} setStatus={setStatus} statusOptions={statusOptions} />

      {/* Summary chips */}
      {summary && (
        <div className="flex flex-wrap gap-3 mb-5">
          {[
            { label: 'Total', value: summary.totalCount, color: 'text-white' },
            { label: 'Successful', value: summary.successCount, color: 'text-emerald-400' },
            { label: 'Failed', value: summary.failedCount, color: 'text-red-400' },
            { label: 'Total Amount', value: `₹${summary.totalAmount.toFixed(2)}`, color: 'text-indigo-400' },
            { label: 'Refunded', value: `₹${summary.refundedAmount.toFixed(2)}`, color: 'text-amber-400' },
          ].map(c => (
            <div key={c.label} className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs">
              <span className="text-white/40">{c.label}: </span>
              <span className={`font-bold ${c.color}`}>{c.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      {loading ? <Skeleton /> : items.length === 0 ? (
        <EmptyState label="No payments found for this period." />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-700/50">
            <table className="w-full text-sm min-w-[860px]">
              <thead>
                <tr className="border-b border-slate-700/60 text-slate-400 text-xs uppercase tracking-wider">
                  <th className="px-4 py-3 text-left font-medium">Date & Time</th>
                  <th className="px-4 py-3 text-left font-medium">User</th>
                  <th className="px-4 py-3 text-left font-medium">Order #</th>
                  <th className="px-4 py-3 text-left font-medium">Method</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {paged.map(r => (
                  <tr key={r._id} className="border-b border-slate-800/70 last:border-none hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3.5 text-slate-400 text-xs whitespace-nowrap">{fmt(r.dateTime)}</td>
                    <td className="px-4 py-3.5"><UserCell name={r.user?.name} email={r.user?.email} /></td>
                    <td className="px-4 py-3.5 font-mono text-xs text-slate-400">{r.orderNumber || '—'}</td>
                    <td className="px-4 py-3.5">
                      <span className="text-white/60 text-xs capitalize px-2 py-0.5 rounded-lg bg-white/5 border border-white/10">{r.method}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge label={r.status} style={PAYMENT_STATUS_STYLE[r.status] ?? PAYMENT_STATUS_STYLE.completed} />
                    </td>
                    <td className="px-4 py-3.5 text-right font-bold tabular-nums text-indigo-300">₹{r.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              {summary && (
                <tfoot>
                  <tr className="border-t-2 border-indigo-500/30 bg-indigo-500/5">
                    <td colSpan={5} className="px-4 py-3 text-white/60 text-xs font-semibold uppercase tracking-wider">
                      Total ({summary.totalCount} payments)
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-indigo-400 text-sm">₹{summary.totalAmount.toFixed(2)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>Rows:</span>
              {PAGE_SIZES.map(s => (
                <button key={s} onClick={() => setPageSize(s)}
                  className={`px-2.5 py-1 rounded-lg transition-colors ${pageSize === s ? 'bg-indigo-500 text-white' : 'bg-white/5 hover:bg-white/10'}`}>{s}</button>
              ))}
            </div>
            <Pagination page={page} totalPages={totalPages} setPage={setPage} />
          </div>
        </>
      )}

      {/* Bottom summary */}
      {summary && items.length > 0 && (
        <div className="mt-5 p-4 rounded-xl bg-white/5 border border-white/10 text-xs text-white/50 flex flex-wrap gap-x-6 gap-y-1">
          <span>Total payments: <span className="text-white font-semibold">{summary.totalCount}</span></span>
          <span>Successful: <span className="text-emerald-400 font-semibold">{summary.successCount}</span></span>
          <span>Failed: <span className="text-red-400 font-semibold">{summary.failedCount}</span></span>
          <span>Refunded: <span className="text-amber-400 font-semibold">₹{summary.refundedAmount.toFixed(2)}</span></span>
          <span>Total amount: <span className="text-indigo-400 font-semibold">₹{summary.totalAmount.toFixed(2)}</span></span>
        </div>
      )}
    </div>
  );
}

// ── Orders Report ─────────────────────────────────────────────────────────────
function OrdersReport() {
  const now = new Date();
  const [groupBy, setGroupBy] = useState<GroupBy>('month');
  const [date, setDate] = useState(now.toISOString().split('T')[0]);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [status, setStatus] = useState('all');
  const [items, setItems] = useState<OrderItem[]>([]);
  const [summary, setSummary] = useState<OrderSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [pageSize, setPageSize] = useState(10);
  const { page, setPage, totalPages, paged } = usePagination(items, pageSize);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { groupBy, status };
      if (groupBy === 'day') params.date = date;
      else if (groupBy === 'month') { params.month = String(month); params.year = String(year); }
      else params.year = String(year);
      const { data } = await api.get('/admin/reports/orders', { params });
      setItems(data.items);
      setSummary(data.summary);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [groupBy, date, month, year, status]);

  useEffect(() => { fetch(); }, [fetch]);

  const statusOptions = [
    { value: 'all', label: 'All Statuses' },
    { value: 'delivered', label: 'Completed' },
    { value: 'pending', label: 'Pending' },
    { value: 'processing', label: 'Processing' },
    { value: 'cancelled', label: 'Cancelled' },
  ];

  return (
    <div>
      <FilterBar groupBy={groupBy} setGroupBy={setGroupBy} date={date} setDate={setDate}
        month={month} setMonth={setMonth} year={year} setYear={setYear}
        status={status} setStatus={setStatus} statusOptions={statusOptions} />

      {summary && (
        <div className="flex flex-wrap gap-3 mb-5">
          {[
            { label: 'Total Orders', value: summary.totalOrders, color: 'text-white' },
            { label: 'Completed', value: summary.completed, color: 'text-emerald-400' },
            { label: 'Pending', value: summary.pending, color: 'text-amber-400' },
            { label: 'Cancelled', value: summary.cancelled, color: 'text-rose-400' },
            { label: 'Revenue', value: `₹${summary.totalRevenue.toFixed(2)}`, color: 'text-indigo-400' },
          ].map(c => (
            <div key={c.label} className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs">
              <span className="text-white/40">{c.label}: </span>
              <span className={`font-bold ${c.color}`}>{c.value}</span>
            </div>
          ))}
        </div>
      )}

      {loading ? <Skeleton /> : items.length === 0 ? (
        <EmptyState label="No orders found for this period." />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-700/50">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="border-b border-slate-700/60 text-slate-400 text-xs uppercase tracking-wider">
                  <th className="px-4 py-3 text-left font-medium">Date & Time</th>
                  <th className="px-4 py-3 text-left font-medium">User</th>
                  <th className="px-4 py-3 text-left font-medium">Plan / Package</th>
                  <th className="px-4 py-3 text-left font-medium">Order Status</th>
                  <th className="px-4 py-3 text-left font-medium">Payment</th>
                  <th className="px-4 py-3 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {paged.map(r => (
                  <tr key={r._id} className="border-b border-slate-800/70 last:border-none hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3.5 text-slate-400 text-xs whitespace-nowrap">{fmt(r.createdAt)}</td>
                    <td className="px-4 py-3.5"><UserCell name={r.user?.name} email={r.user?.email} /></td>
                    <td className="px-4 py-3.5">
                      <p className="text-white text-sm font-medium">{r.planName}</p>
                      <p className="text-slate-500 text-xs">{r.platform}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge label={r.orderStatus} style={ORDER_STATUS_STYLE[r.orderStatus] ?? ORDER_STATUS_STYLE.pending} />
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-white/60 text-xs capitalize px-2 py-0.5 rounded-lg bg-white/5 border border-white/10">{r.paymentMethod}</span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-bold tabular-nums text-indigo-300">₹{r.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              {summary && (
                <tfoot>
                  <tr className="border-t-2 border-indigo-500/30 bg-indigo-500/5">
                    <td colSpan={5} className="px-4 py-3 text-white/60 text-xs font-semibold uppercase tracking-wider">
                      Total ({summary.totalOrders} orders)
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-indigo-400 text-sm">₹{summary.totalRevenue.toFixed(2)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>Rows:</span>
              {PAGE_SIZES.map(s => (
                <button key={s} onClick={() => setPageSize(s)}
                  className={`px-2.5 py-1 rounded-lg transition-colors ${pageSize === s ? 'bg-indigo-500 text-white' : 'bg-white/5 hover:bg-white/10'}`}>{s}</button>
              ))}
            </div>
            <Pagination page={page} totalPages={totalPages} setPage={setPage} />
          </div>
        </>
      )}

      {summary && items.length > 0 && (
        <div className="mt-5 p-4 rounded-xl bg-white/5 border border-white/10 text-xs text-white/50 flex flex-wrap gap-x-6 gap-y-1">
          <span>Total orders: <span className="text-white font-semibold">{summary.totalOrders}</span></span>
          <span>Completed: <span className="text-emerald-400 font-semibold">{summary.completed}</span></span>
          <span>Pending: <span className="text-amber-400 font-semibold">{summary.pending}</span></span>
          <span>Cancelled: <span className="text-rose-400 font-semibold">{summary.cancelled}</span></span>
          <span>Total revenue: <span className="text-indigo-400 font-semibold">₹{summary.totalRevenue.toFixed(2)}</span></span>
        </div>
      )}
    </div>
  );
}

// ── Tickets Report ────────────────────────────────────────────────────────────
function TicketsReport() {
  const now = new Date();
  const [groupBy, setGroupBy] = useState<GroupBy>('month');
  const [date, setDate] = useState(now.toISOString().split('T')[0]);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [status, setStatus] = useState('all');
  const [items, setItems] = useState<TicketItem[]>([]);
  const [summary, setSummary] = useState<TicketSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [pageSize, setPageSize] = useState(10);
  const { page, setPage, totalPages, paged } = usePagination(items, pageSize);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { groupBy, status };
      if (groupBy === 'day') params.date = date;
      else if (groupBy === 'month') { params.month = String(month); params.year = String(year); }
      else params.year = String(year);
      const { data } = await api.get('/admin/reports/tickets', { params });
      setItems(data.items);
      setSummary(data.summary);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [groupBy, date, month, year, status]);

  useEffect(() => { fetch(); }, [fetch]);

  const statusOptions = [
    { value: 'all', label: 'All Statuses' },
    { value: 'open', label: 'Open' },
    { value: 'in-progress', label: 'In Progress' },
    { value: 'closed', label: 'Closed' },
  ];

  return (
    <div>
      <FilterBar groupBy={groupBy} setGroupBy={setGroupBy} date={date} setDate={setDate}
        month={month} setMonth={setMonth} year={year} setYear={setYear}
        status={status} setStatus={setStatus} statusOptions={statusOptions} />

      {summary && (
        <div className="flex flex-wrap gap-3 mb-5">
          {[
            { label: 'Total', value: summary.totalTickets, color: 'text-white' },
            { label: 'Open', value: summary.open, color: 'text-blue-400' },
            { label: 'In Progress', value: summary.inProgress, color: 'text-amber-400' },
            { label: 'Closed', value: summary.closed, color: 'text-slate-400' },
          ].map(c => (
            <div key={c.label} className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs">
              <span className="text-white/40">{c.label}: </span>
              <span className={`font-bold ${c.color}`}>{c.value}</span>
            </div>
          ))}
        </div>
      )}

      {loading ? <Skeleton /> : items.length === 0 ? (
        <EmptyState label="No tickets found for this period." />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-700/50">
            <table className="w-full text-sm min-w-[860px]">
              <thead>
                <tr className="border-b border-slate-700/60 text-slate-400 text-xs uppercase tracking-wider">
                  <th className="px-4 py-3 text-left font-medium">Created</th>
                  <th className="px-4 py-3 text-left font-medium">User</th>
                  <th className="px-4 py-3 text-left font-medium">Subject</th>
                  <th className="px-4 py-3 text-left font-medium">Priority</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {paged.map(r => (
                  <tr key={r._id} className="border-b border-slate-800/70 last:border-none hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3.5 text-slate-400 text-xs whitespace-nowrap">{fmtDate(r.createdAt)}</td>
                    <td className="px-4 py-3.5"><UserCell name={r.user?.name} email={r.user?.email} /></td>
                    <td className="px-4 py-3.5 max-w-[220px]">
                      <p className="text-white text-sm truncate" title={r.subject}>{r.subject}</p>
                      <p className="text-slate-500 text-xs font-mono">{r.ticketNumber}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge label={r.priority} style={PRIORITY_STYLE[r.priority] ?? PRIORITY_STYLE.medium} />
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge label={r.status} style={TICKET_STATUS_STYLE[r.status] ?? TICKET_STATUS_STYLE.open} />
                    </td>
                    <td className="px-4 py-3.5 text-slate-400 text-xs whitespace-nowrap">{fmtDate(r.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>Rows:</span>
              {PAGE_SIZES.map(s => (
                <button key={s} onClick={() => setPageSize(s)}
                  className={`px-2.5 py-1 rounded-lg transition-colors ${pageSize === s ? 'bg-indigo-500 text-white' : 'bg-white/5 hover:bg-white/10'}`}>{s}</button>
              ))}
            </div>
            <Pagination page={page} totalPages={totalPages} setPage={setPage} />
          </div>
        </>
      )}

      {summary && items.length > 0 && (
        <div className="mt-5 p-4 rounded-xl bg-white/5 border border-white/10 text-xs text-white/50 flex flex-wrap gap-x-6 gap-y-1">
          <span>Total tickets: <span className="text-white font-semibold">{summary.totalTickets}</span></span>
          <span>Open: <span className="text-blue-400 font-semibold">{summary.open}</span></span>
          <span>In progress: <span className="text-amber-400 font-semibold">{summary.inProgress}</span></span>
          <span>Closed: <span className="text-slate-400 font-semibold">{summary.closed}</span></span>
        </div>
      )}
    </div>
  );
}

// ── Main AdminReports Component ───────────────────────────────────────────────
const REPORT_TABS: ReportTab[] = ['Payments', 'Orders', 'Tickets'];

const TAB_ICONS: Record<ReportTab, string> = {
  Payments: 'pi-credit-card',
  Orders:   'pi-shopping-bag',
  Tickets:  'pi-ticket',
};

export default function AdminReports() {
  const [activeTab, setActiveTab] = useState<ReportTab>('Payments');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-white font-bold text-xl flex items-center gap-2">
          <i className="pi pi-chart-bar text-indigo-400" /> Reports
        </h2>
        <p className="text-white/40 text-sm mt-0.5">
          Monitor payments, orders and support performance across days, months and years.
        </p>
      </div>

      {/* Tab selector */}
      <div className="flex gap-1 glass rounded-xl p-1 w-fit">
        {REPORT_TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200 ${
              activeTab === tab ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25' : 'text-white/50 hover:text-white'
            }`}>
            <i className={`pi ${TAB_ICONS[tab]} text-xs`} />
            {tab}
          </button>
        ))}
      </div>

      {/* Content card */}
      <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl p-6 border border-white/10">
        {activeTab === 'Payments' && <PaymentsReport />}
        {activeTab === 'Orders'   && <OrdersReport />}
        {activeTab === 'Tickets'  && <TicketsReport />}
      </motion.div>
    </div>
  );
}
