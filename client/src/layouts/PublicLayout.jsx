import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useCustomerAuth } from '../context/CustomerAuthContext';
import NotificationBell from '../components/NotificationBell';
import Icon from '../components/Icons';

export function Brand({ to = '/', sub = "Cake n' Party" }) {
  return (
    <Link to={to} className="brand">
      <img src="/favicon.svg" alt="" />
      <span>Devma<small>{sub}</small></span>
    </Link>
  );
}

function AccountMenu() {
  const { customer, logout } = useCustomerAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  if (!customer) {
    return (
      <>
        <Link to="/login" className="btn btn-ghost btn-sm">Log in</Link>
        <Link to="/register" className="btn btn-primary btn-sm">Sign up</Link>
      </>
    );
  }
  return (
    <div className="dropdown" ref={ref}>
      <button type="button" className="icon-btn" onClick={() => setOpen((o) => !o)} aria-label="Account menu" aria-expanded={open}>
        <Icon name="user" />
      </button>
      {open && (
        <div className="dropdown-menu">
          <div className="menu-head">
            <div className="strong">{customer.full_name}</div>
            <div className="text-xs muted">{customer.email}</div>
          </div>
          <Link to="/my/orders">My orders</Link>
          <Link to="/notifications">Notifications</Link>
          <Link to="/profile">Profile & password</Link>
          <button type="button" onClick={async () => { await logout(); navigate('/'); }}>Log out</button>
        </div>
      )}
    </div>
  );
}

export default function PublicLayout() {
  const { count } = useCart();
  const { customer } = useCustomerAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  useEffect(() => { setMenuOpen(false); window.scrollTo(0, 0); }, [location.pathname]);
  const shopType = location.pathname.startsWith('/shop') ? new URLSearchParams(location.search).get('type') : null;

  return (
    <>
      <header className="site-header">
        <div className="container">
          <button type="button" className="icon-btn menu-toggle" onClick={() => setMenuOpen((o) => !o)} aria-label="Menu" aria-expanded={menuOpen}>
            <Icon name={menuOpen ? 'x' : 'menu'} />
          </button>
          <Brand />
          <nav className={`main-nav${menuOpen ? ' open' : ''}`} aria-label="Main">
            <Link to="/shop?type=CAKE" className={shopType === 'CAKE' ? 'active' : ''}>Cakes</Link>
            <Link to="/shop?type=DECORATION" className={shopType === 'DECORATION' ? 'active' : ''}>Party Decorations</Link>
            <NavLink to="/custom-cake">Custom Cake</NavLink>
            {customer && <NavLink to="/my/orders">My Orders</NavLink>}
          </nav>
          <div className="header-actions">
            <Link to="/cart" className="icon-btn" aria-label={`Cart, ${count} item(s)`}>
              <Icon name="cart" />
              {count > 0 && <span className="dot-count">{count}</span>}
            </Link>
            {customer && <NotificationBell />}
            <AccountMenu />
          </div>
        </div>
      </header>
      <main className="site-main">
        <div className="container"><Outlet /></div>
      </main>
      <footer className="site-footer">
        <div className="container">
          <div className="footer-grid">
            <div>
              <h4>Devma Cake n' Party</h4>
              <p>Fresh cakes and everything you need for your celebration — order online and we’ll take care of the rest.</p>
            </div>
            <div>
              <h4>Shop</h4>
              <ul>
                <li><Link to="/shop?type=CAKE">Cakes</Link></li>
                <li><Link to="/shop?type=DECORATION">Party decorations</Link></li>
                <li><Link to="/custom-cake">Request a custom cake</Link></li>
              </ul>
            </div>
            <div>
              <h4>Account</h4>
              <ul>
                <li><Link to="/my/orders">Track my orders</Link></li>
                <li><Link to="/profile">My profile</Link></li>
                <li><Link to="/staff/login">Staff portal</Link></li>
              </ul>
            </div>
          </div>
          <div className="copy">© {new Date().getFullYear()} Devma Cake n' Party. All rights reserved.</div>
        </div>
      </footer>
    </>
  );
}
