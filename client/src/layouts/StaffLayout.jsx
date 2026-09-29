import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useStaffAuth } from '../context/StaffAuthContext';
import { Brand } from './PublicLayout';
import Icon from '../components/Icons';
import ChangePassword from '../pages/staff/ChangePassword';

/** Sidebar items; each is shown only if the staff member's role grants one of `perms` (US02). */
const NAV = [
  { group: 'Overview', items: [{ to: '/staff', label: 'Dashboard', icon: 'dashboard', perms: ['reports.view'], end: true }] },
  {
    group: 'Orders',
    items: [
      { to: '/staff/orders', label: 'Orders', icon: 'orders', perms: ['orders.view'] },
      { to: '/staff/customers', label: 'Customers', icon: 'customers', perms: ['customers.view'] },
      { to: '/staff/payments', label: 'Payments', icon: 'card', perms: ['payments.manage'] },
      { to: '/staff/deliveries', label: 'Delivery & Collection', icon: 'truck', perms: ['deliveries.manage'] },
    ],
  },
  {
    group: 'Catalogue',
    items: [
      { to: '/staff/products', label: 'Products', icon: 'box', perms: ['products.view', 'products.manage'] },
      { to: '/staff/inventory', label: 'Inventory', icon: 'layers', perms: ['inventory.manage'] },
    ],
  },
  {
    group: 'Administration',
    items: [
      { to: '/staff/users', label: 'Staff Accounts', icon: 'staff', perms: ['staff.manage'] },
      { to: '/staff/roles', label: 'Roles & Permissions', icon: 'shield', perms: ['roles.manage'] },
      { to: '/staff/audit', label: 'Audit Records', icon: 'log', perms: ['audit.view'] },
    ],
  },
];

export function firstAllowedPath(staff) {
  for (const g of NAV) for (const i of g.items) if (i.perms.some((p) => staff.permissions.includes(p))) return i.to;
  return '/staff/account';
}

export default function StaffLayout() {
  const { staff, logout, can } = useStaffAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);

  // US04 - staff with a temporary password must set their own before using the portal.
  if (staff.must_change_password) return <ChangePassword />;

  return (
    <div className="staff-shell">
      <aside className={`sidebar${open ? ' open' : ''}`} aria-label="Staff navigation">
        <Brand to="/staff" sub="Staff portal" />
        {NAV.map((g) => {
          const items = g.items.filter((i) => can(...i.perms));
          if (!items.length) return null;
          return (
            <div className="nav-group" key={g.group}>
              <div className="nav-group-title">{g.group}</div>
              {items.map((i) => (
                <NavLink key={i.to} to={i.to} end={i.end} className="side-link">
                  <Icon name={i.icon} /> {i.label}
                </NavLink>
              ))}
            </div>
          );
        })}
        <div className="nav-group">
          <div className="nav-group-title">Account</div>
          <NavLink to="/staff/change-password" className="side-link"><Icon name="key" /> Change password</NavLink>
          <a href="/" target="_blank" rel="noreferrer" className="side-link"><Icon name="external" /> View shop</a>
        </div>
        <div className="sidebar-foot">
          <div className="who">{staff.full_name}</div>
          <div className="role">{staff.role_name} · {staff.email}</div>
          <button type="button" className="side-link mt-1" style={{ background: 'none', border: 0, width: '100%', cursor: 'pointer', font: 'inherit' }}
            onClick={async () => { await logout(); navigate('/staff/login'); }}>
            <Icon name="logout" /> Log out
          </button>
        </div>
      </aside>
      <div className={`sidebar-backdrop${open ? ' open' : ''}`} onClick={() => setOpen(false)} />
      <div>
        <div className="staff-topbar">
          <button type="button" className="icon-btn menu-btn" onClick={() => setOpen(true)} aria-label="Open menu"><Icon name="menu" /></button>
          <span className="muted text-sm">Devma Cake n' Party Management System</span>
          <span className="badge badge-primary badge-plain" style={{ marginLeft: 'auto' }}>{staff.role_name}</span>
        </div>
        <main className="staff-content"><Outlet /></main>
      </div>
    </div>
  );
}

export function PageHead({ title, crumb, children, sub }) {
  return (
    <div className="staff-page-head">
      <div>
        {crumb && <div className="breadcrumb">{crumb}</div>}
        <h1>{title}</h1>
        {sub && <div className="page-sub text-sm">{sub}</div>}
      </div>
      {children && <div className="row">{children}</div>}
    </div>
  );
}
