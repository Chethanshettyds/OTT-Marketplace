export const PAYMENT_TYPES = [
  { value: 'paytm',    label: 'Paytm',         icon: '💙', color: '#00BAF2', hint: 'UPI ID or QR' },
  { value: 'phonepe',  label: 'PhonePe',        icon: '💜', color: '#5F259F', hint: 'UPI ID or QR' },
  { value: 'gpay',     label: 'Google Pay',     icon: '🟢', color: '#34A853', hint: 'UPI ID or QR' },
  { value: 'bharatpe', label: 'BharatPe',       icon: '🟠', color: '#F26522', hint: 'UPI ID or QR' },
  { value: 'upi',      label: 'UPI (Generic)',  icon: '🇮🇳', color: '#FF6B00', hint: 'Any UPI ID' },
  { value: 'binance',  label: 'Binance Pay',    icon: '🟡', color: '#F0B90B', hint: 'Binance Pay ID or QR' },
  { value: 'bank',     label: 'Bank Transfer',  icon: '🏦', color: '#6366f1', hint: 'Account / IFSC details' },
  { value: 'other',    label: 'Other',          icon: '💳', color: '#8b5cf6', hint: 'Any payment method' },
];
