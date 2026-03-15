// Supported currencies
export type CurrencyCode = 'INR' | 'USD' | 'EUR';

export interface CurrencyConfig {
  code: CurrencyCode;
  symbol: string;
  flag: string;
  label: string;
  // Rate: how many units of this currency = 1 INR
  rate: number;
}

export const CURRENCIES: CurrencyConfig[] = [
  { code: 'INR', symbol: '₹', flag: '🇮🇳', label: 'Indian Rupee', rate: 1 },
  { code: 'USD', symbol: '$', flag: '🇺🇸', label: 'US Dollar',    rate: 0.012 }, // 1 INR ≈ 0.012 USD
  { code: 'EUR', symbol: '€', flag: '🇪🇺', label: 'Euro',         rate: 0.011 },
];

const STORAGE_KEY = 'ott_currency';

export function getSavedCurrency(): CurrencyCode {
  try {
    const v = localStorage.getItem(STORAGE_KEY) as CurrencyCode | null;
    if (v && CURRENCIES.find((c) => c.code === v)) return v;
  } catch { /* ignore */ }
  return 'INR';
}

export function saveCurrency(code: CurrencyCode) {
  try { localStorage.setItem(STORAGE_KEY, code); } catch { /* ignore */ }
}

export function convertPrice(inrAmount: number, toCurrency: CurrencyCode): number {
  const cfg = CURRENCIES.find((c) => c.code === toCurrency);
  if (!cfg || toCurrency === 'INR') return inrAmount;
  return parseFloat((inrAmount * cfg.rate).toFixed(2));
}

export function formatPrice(inrAmount: number, currency: CurrencyCode): string {
  const cfg = CURRENCIES.find((c) => c.code === currency)!;
  const converted = convertPrice(inrAmount, currency);
  if (currency === 'INR') {
    // Indian locale formatting: 1,23,456
    return `${cfg.symbol}${converted.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }
  return `${cfg.symbol}${converted.toFixed(2)}`;
}
