import { useState, useCallback } from 'react';
import { CurrencyCode, CURRENCIES, getSavedCurrency, saveCurrency, formatPrice, convertPrice } from '../utils/currency';

// Module-level state so all components share the same currency
let _currency: CurrencyCode = getSavedCurrency();
const _listeners = new Set<() => void>();

function setCurrencyGlobal(code: CurrencyCode) {
  _currency = code;
  saveCurrency(code);
  _listeners.forEach((fn) => fn());
}

export function useCurrency() {
  const [, rerender] = useState(0);

  // Subscribe to global changes
  const subscribe = useCallback(() => {
    const fn = () => rerender((n) => n + 1);
    _listeners.add(fn);
    return () => _listeners.delete(fn);
  }, []);

  // Auto-subscribe on first render
  useState(() => { subscribe(); });

  const currency = _currency;
  const config = CURRENCIES.find((c) => c.code === currency)!;

  return {
    currency,
    config,
    currencies: CURRENCIES,
    setCurrency: setCurrencyGlobal,
    format: (inrAmount: number) => formatPrice(inrAmount, currency),
    convert: (inrAmount: number) => convertPrice(inrAmount, currency),
    // Show both: ₹850 ($8.95) — only when not INR
    formatBoth: (inrAmount: number) => {
      if (currency === 'INR') return formatPrice(inrAmount, 'INR');
      return `${formatPrice(inrAmount, 'INR')} (${formatPrice(inrAmount, currency)})`;
    },
  };
}
