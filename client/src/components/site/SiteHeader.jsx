import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useCart } from '../../context/CartContext';
import { useCartUI } from '../../context/CartUIContext';
import { useCustomerAuth } from '../../context/CustomerAuthContext';
import NotificationBell from '../NotificationBell';
import LineIcon, { LogoMark } from './LineIcon';

const NAV = [
  { id: 'home', label: 'Home', to: '/' },
  { id: 'cakes', label: 'Cakes', to: '/shop?type=CAKE' },
  { id: 'parties', label: 'Parties', to: '/shop?type=DECORATION' },
  { id: 'gallery', label: 'Gallery', to: '/#gallery', section: 'gallery' },
  { id: 'about', label: 'About', to: '/#story', section: 'story' },
  { id: 'contact', label: 'Contact', to: '/#contact', section: 'contact' },
];

export function Wordmark({ light = false }) {
  return (
    <Link to="/" className={`wordmark${light ? ' is-light' : ''}`} aria-label="Cake n’ Party — home">
      <LogoMark size={42} />
      <span>
        <span className="wm-name">Cake n’ Party</span>
        <span className="wm-tag">Cakes • Treats • Celebrations</span>
      </span>
    </Link>
  );
}

/** Scrolls to a landing section, navigating home first when needed. */
export function useSectionNav() {
  const navigate = useNavigate();
  const location = useLocation();
  return (section) => {
    if (location.pathname === '/') {
      document.getElementById(section)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.history.replaceState(null, '', `/#${section}`);
    } else {
      navigate(`/#${section}`);
    }
  };
}

function useActiveNav() {
  const location = useLocation();
  const [section, setSection] = useState('home');
  useEffect(() => {
    if (location.pathname !== '/') return undefined;
    const ids = ['story', 'gallery', 'contact']; // in page order
    const onScroll = () => {
      let current = 'home';
      ids.forEach((id) => {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top < window.innerHeight * 0.4) current = id;
      });
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      setSection(atBottom ? 'contact' : current);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [location.pathname]);

  if (location.pathname === '/') return { story: 'about' }[section] || section;
  if (location.pathname.startsWith('/shop')) {
    const type = new URLSearchParams(location.search).get('type');
    return type === 'DECORATION' ? 'parties' : 'cakes';
  }
  return null;
}

function AccountButton() {
  const { customer, logout } = useCustomerAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  if (!customer) {
    return <Link to="/login" className="hdr-icon" aria-label="Log in to your account"><LineIcon name="user" /></Link>;
  }
  return (
    <div className="hdr-menu" ref={ref}>
      <button type="button" className="hdr-icon" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Account menu">
        <LineIcon name="user" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div className="hdr-dropdown" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
            <div className="hdr-dropdown-head">
              <strong>{customer.full_name}</strong>
              <span>{customer.email}</span>
            </div>
            <Link to="/my/orders">My orders</Link>
            <Link to="/notifications">Notifications</Link>
            <Link to="/profile">Profile & password</Link>
            <button type="button" onClick={async () => { await logout(); navigate('/'); }}>Log out</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SearchOverlay({ onClose }) {
  const [q, setQ] = useState('');
  const navigate = useNavigate();
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);
  return (
    <motion.div className="search-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <motion.form
        className="search-panel"
        initial={{ y: -24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -16, opacity: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        onSubmit={(e) => { e.preventDefault(); onClose(); navigate(`/shop${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`); }}
        role="search"
      >
        <LineIcon name="search" size={26} />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search cakes, cupcakes, balloons…" aria-label="Search the shop" />
        <button type="button" className="hdr-icon" onClick={onClose} aria-label="Close search"><LineIcon name="close" /></button>
        <div className="search-hints">
          {['Drip cake', 'Wedding', 'Cupcakes', 'Balloons', 'Candles'].map((h) => (
            <button type="button" key={h} onClick={() => { onClose(); navigate(`/shop?q=${encodeURIComponent(h.split(' ')[0])}`); }}>{h}</button>
          ))}
        </div>
      </motion.form>
    </motion.div>
  );
}

export default function SiteHeader() {
  const { count } = useCart();
  const { customer } = useCustomerAuth();
  const { openDrawer, bump, cartIconRef } = useCartUI();
  const active = useActiveNav();
  const goSection = useSectionNav();
  const location = useLocation();
  const [compact, setCompact] = useState(false);
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);

  useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > 48);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => setMenu(false), [location.pathname, location.hash]);
  useEffect(() => {
    document.body.style.overflow = menu ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menu]);

  const navClick = (item) => (e) => {
    if (item.section) { e.preventDefault(); setMenu(false); goSection(item.section); }
    else if (item.id === 'home' && location.pathname === '/') { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  };

  return (
    <>
      <header className={`site-hdr${compact ? ' is-compact' : ''}${location.pathname === '/' ? ' on-home' : ''}`}>
        <div className="hdr-inner">
          <button type="button" className="hdr-icon hdr-burger" onClick={() => setMenu(true)} aria-label="Open menu"><LineIcon name="menu" /></button>
          <Wordmark />
          <nav className="hdr-nav" aria-label="Main">
            {NAV.map((item) => (
              <Link key={item.id} to={item.to} onClick={navClick(item)} className={active === item.id ? 'is-active' : ''} aria-current={active === item.id ? 'page' : undefined}>
                {item.label}
                {active === item.id && <motion.span layoutId="nav-underline" className="nav-underline" transition={{ type: 'spring', stiffness: 380, damping: 32 }} />}
              </Link>
            ))}
          </nav>
          <div className="hdr-actions">
            <button type="button" className="hdr-icon" onClick={() => setSearch(true)} aria-label="Search"><LineIcon name="search" /></button>
            <AccountButton />
            {customer && <div className="hdr-bell"><NotificationBell /></div>}
            <button type="button" ref={cartIconRef} className="hdr-icon hdr-cart" onClick={openDrawer} aria-label={`Open your order, ${count} item${count === 1 ? '' : 's'}`}>
              <motion.span key={bump} animate={bump ? { scale: [1, 1.22, 0.94, 1] } : {}} transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }} style={{ display: 'inline-flex' }}>
                <LineIcon name="bag" />
              </motion.span>
              <AnimatePresence>
                {count > 0 && (
                  <motion.span key={count} className="hdr-badge" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 520, damping: 18 }}>
                    {count}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
            <Link to="/staff" className="pill pill-ghost pill-sm hdr-login">Staff / Admin</Link>
            {!customer && <Link to="/login" className="pill pill-primary pill-sm hdr-login">Login</Link>}
          </div>
        </div>
      </header>

      <AnimatePresence>{search && <SearchOverlay onClose={() => setSearch(false)} />}</AnimatePresence>

      <AnimatePresence>
        {menu && (
          <motion.div className="mobile-menu" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            <div className="mobile-menu-top">
              <Wordmark />
              <button type="button" className="hdr-icon" onClick={() => setMenu(false)} aria-label="Close menu"><LineIcon name="close" /></button>
            </div>
            <nav aria-label="Mobile">
              {NAV.map((item, i) => (
                <motion.div key={item.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 + i * 0.04, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
                  <Link to={item.to} onClick={navClick(item)} className={active === item.id ? 'is-active' : ''}>{item.label}</Link>
                </motion.div>
              ))}
            </nav>
            <div className="mobile-menu-foot">
              {customer ? (
                <>
                  <Link to="/my/orders">My orders</Link>
                  <Link to="/profile">Profile</Link>
                </>
              ) : (
                <>
                  <Link to="/login" className="pill pill-primary">Login</Link>
                  <Link to="/register" className="pill pill-ghost">Create account</Link>
                </>
              )}
              <Link to="/#quick-links" className="pill pill-ghost">All links</Link>
              <Link to="/staff" className="pill pill-ghost">Staff / Admin</Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
