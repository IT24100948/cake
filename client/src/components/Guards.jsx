import { Navigate, useLocation } from 'react-router-dom';
import { useStaffAuth } from '../context/StaffAuthContext';
import { useCustomerAuth } from '../context/CustomerAuthContext';
import { Loading, Empty } from './ui';

/** Requires a logged-in customer; otherwise redirects to login and returns afterwards. */
export function RequireCustomer({ children }) {
  const { customer, loading } = useCustomerAuth();
  const location = useLocation();
  if (loading) return <Loading />;
  if (!customer) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return children;
}

/** Requires a logged-in staff member, optionally with one of `perms`. */
export function RequireStaff({ children, perms }) {
  const { staff, loading, can } = useStaffAuth();
  const location = useLocation();
  if (loading) return <Loading />;
  if (!staff) return <Navigate to="/staff/login" replace state={{ from: location.pathname }} />;
  if (staff.must_change_password && location.pathname !== '/staff/change-password') {
    return <Navigate to="/staff/change-password" replace />;
  }
  if (perms && !can(...perms)) {
    return (
      <Empty icon="🔒" title="Access restricted">
        Your role does not include access to this page. Contact an administrator if you need it.
      </Empty>
    );
  }
  return children;
}

/** Renders children only when the staff member has one of the permissions (US02). */
export function Can({ perm, children, fallback = null }) {
  const { can } = useStaffAuth();
  return can(...[].concat(perm)) ? children : fallback;
}
