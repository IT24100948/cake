import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import SiteHeader, { useSectionNav } from '../components/site/SiteHeader';
import SiteFooter from '../components/site/SiteFooter';
import CartDrawer from '../components/site/CartDrawer';
import '../styles/site.css';

export function Brand({ to = '/', sub = "Cake n' Party" }) {
  return (
    <Link to={to} className="brand">
      <img src="/favicon.svg" alt="" />
      <span>Devma<small>{sub}</small></span>
    </Link>
  );
}

const NO_ORDER_BAR = ['/cart', '/checkout', '/login', '/register', '/order-placed', '/custom-cake'];

/** Storefront shell: sticky header, cart drawer, footer and the mobile "Order Cake" bar. */
export default function PublicLayout() {
  const location = useLocation();
  const goSection = useSectionNav();
  const isHome = location.pathname === '/';
  const [inBuilder, setInBuilder] = useState(false);
  const orderBar = !NO_ORDER_BAR.some((p) => location.pathname.startsWith(p)) && !inBuilder;

  // The builder has its own Add button, so the sticky "Order a Cake" bar steps aside there.
  useEffect(() => {
    setInBuilder(false);
    if (!isHome || typeof IntersectionObserver === 'undefined') return undefined;
    let io;
    const t = setTimeout(() => {
      const el = document.getElementById('build');
      if (!el) return;
      io = new IntersectionObserver(([e]) => setInBuilder(e.isIntersecting), { threshold: 0.05 });
      io.observe(el);
    }, 300);
    return () => { clearTimeout(t); io?.disconnect(); };
  }, [isHome]);

  useEffect(() => { if (!location.hash) window.scrollTo(0, 0); }, [location.pathname, location.hash]);

  return (
    <div className={`store${orderBar ? ' has-order-bar' : ''}`}>
      <a href="#main" className="skip-link">Skip to content</a>
      <SiteHeader />
      <main id="main" className={`store-main${isHome ? ' is-home' : ''}`}>
        {isHome ? <Outlet /> : <div className="container"><Outlet /></div>}
      </main>
      <SiteFooter />
      <CartDrawer />
      {orderBar && (
        <div className="order-bar">
          <button type="button" className="pill pill-primary pill-lg" onClick={() => goSection('build')}>Order a Cake</button>
        </div>
      )}
    </div>
  );
}
