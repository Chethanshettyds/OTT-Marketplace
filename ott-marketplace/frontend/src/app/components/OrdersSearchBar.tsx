import { useState, useEffect, useRef } from 'react';
import { Search, X, ChevronDown } from 'lucide-react';

export type FilterField = 'orderId' | 'product' | 'duration' | 'user' | 'email';

interface FilterOption { value: FilterField; label: string; }

interface OrdersSearchBarProps {
  filters: FilterField[];
  totalCount: number;
  filteredCount: number;
  onSearch: (term: string, field: FilterField) => void;
  onClear: () => void;
  initialValue?: string;
  initialField?: FilterField;
}

const FILTER_LABELS: Record<FilterField, string> = {
  orderId:  'Order ID',
  product:  'Product Name',
  duration: 'Duration',
  user:     'User',
  email:    'Email',
};

export default function OrdersSearchBar({
  filters, totalCount, filteredCount, onSearch, onClear, initialValue = '', initialField,
}: OrdersSearchBarProps) {
  const [term, setTerm] = useState(initialValue);
  const [field, setField] = useState<FilterField>(initialField ?? filters[0]);
  const [dropOpen, setDropOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  // Sync if parent pushes a new initialValue (e.g. from chatbot navigation)
  useEffect(() => {
    if (initialValue && initialValue !== term) {
      setTerm(initialValue);
      setField(initialField ?? 'orderId');
    }
  }, [initialValue]);

  // close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setDropOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onSearch(term, field), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [term, field]);

  function handleClear() {
    setTerm('');
    setField(filters[0]);
    onClear();
  }

  const isFiltered = term.trim().length > 0;

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
      {/* Search row */}
      <div className="flex flex-1 w-full gap-2">
        {/* Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <input
            type="text"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder={`Search by ${FILTER_LABELS[field]}…`}
            className="w-full pl-9 pr-9 py-2 rounded-xl bg-slate-900/60 border border-slate-700/60 text-white text-sm placeholder-slate-500
              focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all"
          />
          {term && (
            <button
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter dropdown */}
        <div className="relative" ref={dropRef}>
          <button
            onClick={() => setDropOpen((o) => !o)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900/60 border border-slate-700/60 text-slate-300 text-sm
              hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all whitespace-nowrap"
          >
            {FILTER_LABELS[field]}
            <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform ${dropOpen ? 'rotate-180' : ''}`} />
          </button>

          {dropOpen && (
            <div className="absolute right-0 top-full mt-1.5 z-50 min-w-[140px] rounded-xl bg-slate-900 border border-slate-700/60 shadow-xl shadow-black/40 overflow-hidden">
              {filters.map((f) => (
                <button
                  key={f}
                  onClick={() => { setField(f); setDropOpen(false); }}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                    field === f
                      ? 'bg-violet-500/20 text-violet-300'
                      : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                  }`}
                >
                  {FILTER_LABELS[f]}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Clear all button */}
        {isFiltered && (
          <button
            onClick={handleClear}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm
              hover:bg-rose-500/20 transition-all whitespace-nowrap"
          >
            <X className="w-3.5 h-3.5" /> Clear
          </button>
        )}
      </div>

      {/* Filter count badge */}
      <div className="text-xs text-slate-500 whitespace-nowrap shrink-0">
        {isFiltered ? (
          <span className="text-violet-400 font-medium">
            {filteredCount} of {totalCount} orders
          </span>
        ) : (
          <span>{totalCount} orders</span>
        )}
      </div>
    </div>
  );
}
