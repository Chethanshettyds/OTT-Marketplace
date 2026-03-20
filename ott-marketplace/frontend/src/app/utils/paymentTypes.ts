export const PAYMENT_TYPES = [
  { value: 'paytm',    label: 'Paytm',         icon: '💙', color: '#00BAF2', hint: 'UPI ID or QR' },
  { value: 'phonepe',  label: 'PhonePe',        icon: '💜', color: '#5F259F', hint: 'UPI ID or QR' },
  { value: 'gpay',     label: 'Google Pay',     icon: '🟢', color: '#34A853', hint: 'UPI ID or QR' },
  { value: 'bharatpe', label: 'BharatPe',       icon: '🟠', color: '#F26522', hint: 'UPI ID or QR' },
  { value: 'paytm_business', label: 'Paytm Business QR', icon: '🏪', color: '#00BAF2', hint: 'Paytm Business Merchant ID + QR' },
  { value: 'cashfree', label: 'Cashfree',        icon: '💚', color: '#00C853', hint: 'Pay via Cashfree (UPI, Cards, NetBanking)' },
  { value: 'bank',     label: 'Bank Transfer',  icon: '🏦', color: '#6366f1', hint: 'Account / IFSC details' },
  { value: 'other',    label: 'Other',          icon: '💳', color: '#8b5cf6', hint: 'Any payment method' },
];
