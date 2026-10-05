export const formatLKR = (n) =>
  `LKR ${Number(n || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const formatNumber = (n) => Number(n || 0).toLocaleString('en-LK');

/** Parses MySQL "YYYY-MM-DD HH:MM:SS" / "YYYY-MM-DD" strings as local time. */
export function parseDate(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T00:00:00`);
  return new Date(s.replace(' ', 'T'));
}

export const formatDate = (v) => {
  const d = parseDate(v);
  return d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
};

export const formatDateTime = (v) => {
  const d = parseDate(v);
  return d
    ? `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}, ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
    : '—';
};

export function timeAgo(v) {
  const d = parseDate(v);
  if (!d) return '';
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)} d ago`;
  return formatDate(v);
}

/** YYYY-MM-DD for today + n days (local time). */
export function isoDate(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const STATUS_META = {
  // Order status
  PENDING: { label: 'Pending', tone: 'warning' },
  CONFIRMED: { label: 'Confirmed', tone: 'info' },
  IN_PREPARATION: { label: 'In preparation', tone: 'purple' },
  READY: { label: 'Ready', tone: 'primary' },
  OUT_FOR_DELIVERY: { label: 'Out for delivery', tone: 'info' },
  READY_FOR_COLLECTION: { label: 'Ready for collection', tone: 'primary' },
  COMPLETED: { label: 'Completed', tone: 'success' },
  CANCELLED: { label: 'Cancelled', tone: 'neutral' },
  REJECTED: { label: 'Rejected', tone: 'danger' },
  // Payment status
  UNPAID: { label: 'Unpaid', tone: 'danger' },
  PARTIALLY_PAID: { label: 'Partially paid', tone: 'warning' },
  PAID: { label: 'Paid', tone: 'success' },
  REFUNDED: { label: 'Refunded', tone: 'neutral' },
  // Delivery status
  SCHEDULED: { label: 'Scheduled', tone: 'info' },
  DELIVERED: { label: 'Delivered', tone: 'success' },
  COLLECTED: { label: 'Collected', tone: 'success' },
  FAILED: { label: 'Failed', tone: 'danger' },
};

export const statusLabel = (s) => STATUS_META[s]?.label || s;

export const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'BANK_TRANSFER', label: 'Bank transfer' },
  { value: 'CARD', label: 'Card' },
  { value: 'ONLINE_TRANSFER', label: 'Online transfer' },
];
export const methodLabel = (m) => PAYMENT_METHODS.find((x) => x.value === m)?.label || m;

export const ORDER_FLOW = {
  DELIVERY: ['PENDING', 'CONFIRMED', 'IN_PREPARATION', 'READY', 'OUT_FOR_DELIVERY', 'COMPLETED'],
  COLLECTION: ['PENDING', 'CONFIRMED', 'IN_PREPARATION', 'READY', 'READY_FOR_COLLECTION', 'COMPLETED'],
};

export const TIME_SLOTS = ['8am - 10am', '9am - 12pm', '12pm - 3pm', '3pm - 6pm', '6pm - 8pm'];

// Shown when a product has no image yet: a real photo for its type, never a placeholder graphic.
const FALLBACK_PHOTO = {
  CAKE: 'https://images.unsplash.com/photo-1558301211-0d8c8ddee6ec?auto=format&fit=crop&w=1200&h=900&q=80',
  DECORATION: 'https://images.unsplash.com/photo-1529244927325-b3ef2247b9fb?auto=format&fit=crop&w=1200&h=900&q=80',
};
export const imageUrl = (u, type = 'CAKE') => u || FALLBACK_PHOTO[type] || FALLBACK_PHOTO.CAKE;

/** Whole-rupee price for the storefront, e.g. "LKR 12,300". */
export const formatPrice = (n) => `LKR ${Math.round(Number(n || 0)).toLocaleString('en-LK')}`;
