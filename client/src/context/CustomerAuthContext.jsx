import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { customerAuthApi } from '../api';

const CustomerAuthContext = createContext(null);

export function CustomerAuthProvider({ children }) {
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { customer: c } = await customerAuthApi.me();
      setCustomer(c);
    } catch {
      setCustomer(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const value = useMemo(() => ({
    customer,
    loading,
    setCustomer,
    login: async (email, password) => {
      const { customer: c } = await customerAuthApi.login({ email, password });
      setCustomer(c);
      return c;
    },
    register: async (body) => {
      const { customer: c } = await customerAuthApi.register(body);
      setCustomer(c);
      return c;
    },
    logout: async () => {
      try { await customerAuthApi.logout(); } catch { /* ignore */ }
      setCustomer(null);
    },
  }), [customer, loading]);

  return <CustomerAuthContext.Provider value={value}>{children}</CustomerAuthContext.Provider>;
}

export const useCustomerAuth = () => useContext(CustomerAuthContext);
