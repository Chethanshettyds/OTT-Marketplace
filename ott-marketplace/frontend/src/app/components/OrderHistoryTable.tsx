import { useState, useMemo, useEffect } from 'react';
import { useCurrency } from '../hooks/useCurrency';
import OrdersSearchBar, { FilterField } from './OrdersSearchBar';

interface Order {
  _id: string;
  orderNumber: string;
  productSnapshot: { name: string; platform: string; logo: string; duration: string };
  amount: number;
  status: string;
  createdAt: string;
}

interface OrderHistoryTableProps {
  orders: Order[];
  loading?: boolean;
  initialSearch?: string;
}

function formatOrderDateTime(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: true });
  return `${date}, ${time}`;
}

const STATUS_STYLES: Record<string, string> = {
  delivered:  'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  processing: 'bg-blue-500/15    text-blue-300    border-blue-500/40',
  pending:    'bg-amber-500/15   text-amber-300   border-amber-500/40',
  refunded:   'bg-rose-500/15    text-rose-300    border-rose-500/40',
  cancelled:  'bg-rose-500/15    text-rose-300    border-rose-500/40',
};

const PAGE_SIZES = [5, 10, 25] as const;
type PageSize = typeof PAGE_SIZES[number];

const USER_FILTERS: FilterField[] = ['orderId', 'product', 'duration'];

export default function OrderHistoryTable({ orders, loading, initialSearch = '' }: OrderHistoryTableProps) {
  const { format } = useCurrency();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(10);
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [filterField, setFilterField] = useState<FilterField>(initialSearch ? 'orderId' : 'orderId');

  // When initialSearch changes (e.g. navigated from chatbot), apply it
  useEffect(() => {
    if (initialSearch) {
      setSearchTerm(initialSearch);
      setFilterField('orderId');
      setPage(1);
    }
  }, [initialSearch]);

  const filtered = useMemo(() => {
    const t = searchTerm.trim().toLowerCase();
    if (!t) return orders;
    return orders.filter((o) => {
      if (filterField === 'orderId')  return o.orderNumber.toLowerCase().includes(t);
      if (filterField === 'product')  return o.productSnapshot?.name?.toLowerCase().includes(t);
      if (filterField === 'duration') return o.productSnapshot?.duration?.toLowerCase().includes(t);
      return false;
    });
  }, [orders, searchTerm, filterField]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  function handleSearch(term: string, field: FilterField) {
    setSearchTerm(term);
    setFilterField(field);
    setPage(1);
  }

  function handleClear() {
    setSearchTerm('');
    setFilterField('orderId');
    setPage(1);
  }

  function handlePageSizeChange(size: PageSize) {
    setPageSize(size);
    setPage(1);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-white/30">
        <i className="pi pi-spin pi-spinner text-2xl mr-3" />
        Loading orders…
      </div>
    );
  }

  if (!orders.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-white/30">
        <i className="pi pi-inbox text-4xl mb-3" />
        <p>No orders yet.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <OrdersSearchBar
        filters={USER_FILTERS}
        totalCount={orders.length}
        filteredCount={filtered.length}
        onSearch={handleSearch}
        onClear={handleClear}
        initialValue={initialSearch}
        initialField="orderId"
      />

      {/* Scrollable table */}
      <div className="overflow-x-auto rounded-xl border border-slate-700/50 relative">
        <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-slate-900/80 to-transparent sm:hidden" />
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="border-b border-slate-700/60 text-slate-400 text-xs uppercase tracking-wider">
              <th className="px-4 py-3 text-left font-medium">Order #</th>
              <th className="px-4 py-3 text-left font-medium">Product</th>
              <th className="px-4 py-3 text-left font-medium">Duration</th>
              <th className="px-4 py-3 text-right font-medium">Amount</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Date & Time</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-slate-500 text-sm">
                  No orders match your search.
                </td>
              </tr>
            ) : paginated.map((order) => (
              <tr
                key={order._id}
                className={`border-b border-slate-800/70 last:border-none transition-colors
                  ${initialSearch && order.orderNumber.toLowerCase() === initialSearch.toLowerCase()
                    ? 'bg-violet-500/10 border-l-2 border-l-violet-500 hover:bg-violet-500/15'
                    : 'hover:bg-slate-900/60'
                  }`}
              >
                <td className="px-4 py-3.5 text-slate-400 font-mono text-xs whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    {order.orderNumber}
                    {initialSearch && order.orderNumber.toLowerCase() === initialSearch.toLowerCase() && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-violet-500/20 text-violet-300 border border-violet-500/30">
                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        Found
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3.5 text-white font-medium whitespace-nowrap">
                  {order.productSnapshot?.name}
                </td>
                <td className="px-4 py-3.5 text-slate-300 whitespace-nowrap">
                  {order.productSnapshot?.duration}
                </td>
                <td className="px-4 py-3.5 text-right font-semibold text-violet-200 whitespace-nowrap">
                  {format(order.amount)}
                </td>
                <td className="px-4 py-3.5">
                  <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold border capitalize
                    ${STATUS_STYLES[order.status] ?? 'bg-slate-500/15 text-slate-300 border-slate-500/40'}`}>
                    {order.status}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-right text-slate-300 text-xs whitespace-nowrap">
                  {formatOrderDateTime(order.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span>Rows per page</span>
          <div className="inline-flex bg-slate-900/60 border border-slate-700/60 rounded-full p-1 shadow-inner">
            {PAGE_SIZES.map((size) => (
              <button
                key={size}
                onClick={() => handlePageSizeChange(size)}
                className={`px-3 py-1 rounded-full transition-all text-xs ${
                  pageSize === size
                    ? 'bg-violet-500 text-white shadow-lg shadow-violet-500/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1 text-xs text-slate-400">
          <button onClick={() => setPage(1)} disabled={page === 1}
            className="px-2 py-1.5 rounded-lg hover:bg-slate-800/80 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">«</button>
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
            className="px-2 py-1.5 rounded-lg hover:bg-slate-800/80 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">‹</button>
          <span className="px-3 py-1 rounded-lg bg-slate-800/60 text-slate-200 font-medium min-w-[60px] text-center">
            {page} / {totalPages}
          </span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="px-2 py-1.5 rounded-lg hover:bg-slate-800/80 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">›</button>
          <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
            className="px-2 py-1.5 rounded-lg hover:bg-slate-800/80 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">»</button>
        </div>
      </div>
    </div>
  );
}
