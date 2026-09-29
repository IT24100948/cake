/** Permission codes used by requirePermission() and seeded into the permissions table (US02). */
const PERMISSIONS = [
  { code: 'staff.manage', module: 'User & Access', description: 'Create, update, deactivate staff accounts and reset passwords' },
  { code: 'roles.manage', module: 'User & Access', description: 'Create roles and assign permissions' },
  { code: 'audit.view', module: 'User & Access', description: 'View access and audit records' },
  { code: 'products.view', module: 'Products & Inventory', description: 'View and search products' },
  { code: 'products.manage', module: 'Products & Inventory', description: 'Add and update products and categories' },
  { code: 'inventory.manage', module: 'Products & Inventory', description: 'Manage inventory quantities' },
  { code: 'customers.view', module: 'Customers & Orders', description: 'View customer details' },
  { code: 'orders.view', module: 'Customers & Orders', description: 'View orders' },
  { code: 'orders.update', module: 'Customers & Orders', description: 'Update order details and status' },
  { code: 'orders.confirm', module: 'Confirmation, Payment & Delivery', description: 'Confirm customer orders' },
  { code: 'payments.manage', module: 'Confirmation, Payment & Delivery', description: 'Record payments and update payment status' },
  { code: 'deliveries.manage', module: 'Confirmation, Payment & Delivery', description: 'Manage delivery or collection details' },
  { code: 'reports.view', module: 'Management & Reporting', description: 'View dashboard and management reports' },
];

const ORDER_STATUS = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  IN_PREPARATION: 'IN_PREPARATION',
  READY: 'READY',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  READY_FOR_COLLECTION: 'READY_FOR_COLLECTION',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  REJECTED: 'REJECTED',
};

/**
 * Allowed status transitions via PATCH /orders/:id/status (US17, US23).
 * PENDING -> CONFIRMED goes through the dedicated confirm endpoint (US19) so a quote can be set.
 */
const ORDER_TRANSITIONS = {
  PENDING: ['REJECTED', 'CANCELLED'],
  CONFIRMED: ['IN_PREPARATION', 'CANCELLED'],
  IN_PREPARATION: ['READY', 'CANCELLED'],
  READY: ['OUT_FOR_DELIVERY', 'READY_FOR_COLLECTION', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['COMPLETED', 'READY'],
  READY_FOR_COLLECTION: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
  REJECTED: [],
};

const PAYMENT_STATUS = ['UNPAID', 'PARTIALLY_PAID', 'PAID', 'REFUNDED'];
const PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER', 'CARD', 'ONLINE_TRANSFER'];
const FULFILLMENT_TYPES = ['DELIVERY', 'COLLECTION'];
const DELIVERY_STATUS = {
  DELIVERY: ['PENDING', 'SCHEDULED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED'],
  COLLECTION: ['PENDING', 'SCHEDULED', 'READY_FOR_COLLECTION', 'COLLECTED'],
};

/** Customer-friendly wording for notifications (US24). */
const STATUS_LABELS = {
  PENDING: 'Pending review',
  CONFIRMED: 'Confirmed',
  IN_PREPARATION: 'In preparation',
  READY: 'Ready',
  OUT_FOR_DELIVERY: 'Out for delivery',
  READY_FOR_COLLECTION: 'Ready for collection',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  REJECTED: 'Rejected',
  UNPAID: 'Unpaid',
  PARTIALLY_PAID: 'Partially paid',
  PAID: 'Paid',
  REFUNDED: 'Refunded',
  SCHEDULED: 'Scheduled',
  DELIVERED: 'Delivered',
  COLLECTED: 'Collected',
  FAILED: 'Delivery attempt failed',
};

const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCK_MINUTES = 15;

module.exports = {
  PERMISSIONS, ORDER_STATUS, ORDER_TRANSITIONS, PAYMENT_STATUS, PAYMENT_METHODS,
  FULFILLMENT_TYPES, DELIVERY_STATUS, STATUS_LABELS, LOGIN_MAX_ATTEMPTS, LOGIN_LOCK_MINUTES,
};
