import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { staffAuthApi } from '../api';

const StaffAuthContext = createContext(null);

export function StaffAuthProvider({ children }) {
  const [staff, setStaff] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { staff: s } = await staffAuthApi.me();
      setStaff(s);
      return s;
    } catch {
      setStaff(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const value = useMemo(() => ({
    staff,
    loading,
    refresh,
    setStaff,
    can: (...codes) => !!staff && codes.some((c) => staff.permissions.includes(c)),
    login: async (email, password) => {
      const { staff: s } = await staffAuthApi.login({ email, password });
      setStaff(s);
      return s;
    },
    logout: async () => {
      try { await staffAuthApi.logout(); } catch { /* already logged out */ }
      setStaff(null);
    },
  }), [staff, loading, refresh]);

  return <StaffAuthContext.Provider value={value}>{children}</StaffAuthContext.Provider>;
}

export const useStaffAuth = () => useContext(StaffAuthContext);
