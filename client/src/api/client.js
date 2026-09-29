import axios from 'axios';

const api = axios.create({ baseURL: '/api', withCredentials: true });

/** Normalises server errors to { status, message, errors, code }. */
export function toApiError(err) {
  if (err?.response) {
    const { status, data } = err.response;
    return {
      status,
      message: data?.message || 'Request failed',
      errors: data?.errors || {},
      code: data?.code,
    };
  }
  return { status: 0, message: 'Cannot reach the server. Check your connection and try again.', errors: {} };
}

// Staff whose password must be changed are redirected to the change-password page.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const e = toApiError(err);
    if (e.code === 'PASSWORD_CHANGE_REQUIRED' && !window.location.pathname.startsWith('/staff/change-password')) {
      window.location.assign('/staff/change-password');
    }
    return Promise.reject(e);
  }
);

export default api;
