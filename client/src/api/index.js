import api from './client';

const data = (p) => p.then((r) => r.data);

/** Builds a query string, dropping empty values. */
export const qs = (params = {}) => {
  const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v !== null && v !== undefined)).toString();
  return s ? `?${s}` : '';
};

export const staffAuthApi = {
  login: (body) => data(api.post('/auth/staff/login', body)),
  logout: () => data(api.post('/auth/staff/logout')),
  me: () => data(api.get('/auth/staff/me')),
  changePassword: (body) => data(api.put('/auth/staff/password', body)),
};

export const customerAuthApi = {
  register: (body) => data(api.post('/auth/customer/register', body)),
  login: (body) => data(api.post('/auth/customer/login', body)),
  logout: () => data(api.post('/auth/customer/logout')),
  me: () => data(api.get('/auth/customer/me')),
  updateProfile: (body) => data(api.put('/customer/profile', body)),
  changePassword: (body) => data(api.put('/customer/password', body)),
};

export const catalogApi = {
  products: (params) => data(api.get(`/catalog/products${qs(params)}`)),
  product: (id) => data(api.get(`/catalog/products/${id}`)),
  categories: (params) => data(api.get(`/categories${qs(params)}`)),
};

export const myApi = {
  placeOrder: (payload, referenceImage) => {
    if (referenceImage) {
      const fd = new FormData();
      fd.append('payload', JSON.stringify(payload));
      fd.append('referenceImage', referenceImage);
      return data(api.post('/orders', fd));
    }
    return data(api.post('/orders', payload));
  },
  orders: (params) => data(api.get(`/my/orders${qs(params)}`)),
  order: (id) => data(api.get(`/my/orders/${id}`)),
  cancelOrder: (id, reason) => data(api.patch(`/my/orders/${id}/cancel`, { reason })),
  notifications: (params) => data(api.get(`/my/notifications${qs(params)}`)),
  unreadCount: () => data(api.get('/my/notifications/unread-count')),
  markRead: (id) => data(api.patch(`/my/notifications/${id}/read`)),
  markAllRead: () => data(api.patch('/my/notifications/read-all')),
  pay: (id, body) => data(api.post(`/my/orders/${id}/pay`, body)),
  testCards: () => data(api.get('/my/payments/test-cards')),
};

export const staffApi = {
  list: (params) => data(api.get(`/staff${qs(params)}`)),
  options: () => data(api.get('/staff/options')),
  create: (body) => data(api.post('/staff', body)),
  update: (id, body) => data(api.put(`/staff/${id}`, body)),
  setRole: (id, roleId) => data(api.patch(`/staff/${id}/role`, { roleId })),
  setStatus: (id, isActive, reason) => data(api.patch(`/staff/${id}/status`, { isActive, reason })),
  resetPassword: (id, password) => data(api.post(`/staff/${id}/reset-password`, { password })),
};

export const roleApi = {
  list: () => data(api.get('/roles')),
  permissions: () => data(api.get('/permissions')),
  create: (body) => data(api.post('/roles', body)),
  update: (id, body) => data(api.put(`/roles/${id}`, body)),
  remove: (id) => data(api.delete(`/roles/${id}`)),
};

export const auditApi = {
  list: (params) => data(api.get(`/audit-logs${qs(params)}`)),
  actions: () => data(api.get('/audit-logs/actions')),
};

const toFormData = (obj, file) => {
  const fd = new FormData();
  Object.entries(obj).forEach(([k, v]) => v !== undefined && v !== null && fd.append(k, v));
  if (file) fd.append('image', file);
  return fd;
};

export const productApi = {
  list: (params) => data(api.get(`/products${qs(params)}`)),
  get: (id) => data(api.get(`/products/${id}`)),
  create: (body, file) => data(api.post('/products', toFormData(body, file))),
  update: (id, body, file) => data(api.put(`/products/${id}`, toFormData(body, file))),
  setAvailability: (id, isAvailable) => data(api.patch(`/products/${id}/availability`, { isAvailable })),
  createCategory: (body) => data(api.post('/categories', body)),
  updateCategory: (id, body) => data(api.put(`/categories/${id}`, body)),
  deleteCategory: (id) => data(api.delete(`/categories/${id}`)),
};

export const inventoryApi = {
  list: (params) => data(api.get(`/inventory${qs(params)}`)),
  adjust: (productId, body) => data(api.post(`/inventory/${productId}/adjust`, body)),
  history: (productId, params) => data(api.get(`/inventory/${productId}/history${qs(params)}`)),
};

export const customerApi = {
  list: (params) => data(api.get(`/customers${qs(params)}`)),
  get: (id) => data(api.get(`/customers/${id}`)),
};

export const orderApi = {
  list: (params) => data(api.get(`/orders${qs(params)}`)),
  get: (id) => data(api.get(`/orders/${id}`)),
  update: (id, body) => data(api.put(`/orders/${id}`, body)),
  confirm: (id, body) => data(api.patch(`/orders/${id}/confirm`, body)),
  setStatus: (id, body) => data(api.patch(`/orders/${id}/status`, body)),
  recordPayment: (id, body) => data(api.post(`/orders/${id}/payments`, body)),
  setPaymentStatus: (id, body) => data(api.patch(`/orders/${id}/payment-status`, body)),
  updateDelivery: (id, body) => data(api.put(`/orders/${id}/delivery`, body)),
};

export const paymentApi = { list: (params) => data(api.get(`/payments${qs(params)}`)) };

export const deliveryApi = {
  list: (params) => data(api.get(`/deliveries${qs(params)}`)),
  setStatus: (id, body) => data(api.patch(`/deliveries/${id}/status`, body)),
};

export const reportApi = {
  summary: () => data(api.get('/reports/summary')),
  ordersByStatus: () => data(api.get('/reports/orders-by-status')),
  sales: (params) => data(api.get(`/reports/sales${qs(params)}`)),
  topProducts: (params) => data(api.get(`/reports/top-products${qs(params)}`)),
  lowStock: () => data(api.get('/reports/low-stock')),
  upcoming: () => data(api.get('/reports/upcoming')),
};
