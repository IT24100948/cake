import { Link } from 'react-router-dom';
import { catalogApi } from '../../api';
import { useAsync } from '../../utils/useAsync';
import { Loading } from '../../components/ui';
import ProductCard from './ProductCard';

function HeroArt() {
  return (
    <svg viewBox="0 0 320 300" aria-hidden="true">
      <circle cx="80" cy="70" r="34" fill="#f5c2d1" /><path d="M80 104q-6 40 14 80" stroke="#c8466d" strokeWidth="2" fill="none" />
      <circle cx="250" cy="60" r="28" fill="#ffe0a3" /><path d="M250 88q8 36-10 70" stroke="#e0b04f" strokeWidth="2" fill="none" />
      <rect x="70" y="190" width="180" height="80" rx="14" fill="#fff" stroke="#eadcd1" strokeWidth="2" />
      <path d="M70 212q22 16 45 0t45 0 45 0 45 0" stroke="#c8466d" strokeWidth="7" fill="none" />
      <rect x="100" y="138" width="120" height="56" rx="12" fill="#fff" stroke="#eadcd1" strokeWidth="2" />
      <path d="M100 156q15 11 30 0t30 0 30 0 30 0" stroke="#f5c2d1" strokeWidth="6" fill="none" />
      {[130, 160, 190].map((x) => (
        <g key={x}><rect x={x - 4} y="108" width="8" height="30" rx="3" fill="#b83b5e" /><ellipse cx={x} cy="100" rx="6" ry="9" fill="#ffd166" /></g>
      ))}
    </svg>
  );
}

export default function Home() {
  const cakes = useAsync(() => catalogApi.products({ type: 'CAKE', limit: 4, sort: 'newest' }), []);
  const decor = useAsync(() => catalogApi.products({ type: 'DECORATION', limit: 4, sort: 'newest' }), []);
  return (
    <div className="stack" style={{ '--gap': '2rem' }}>
      <section className="hero">
        <div>
          <h1>Cakes & party decor for <em>every</em> celebration</h1>
          <p>Browse our cakes and party decorations, tell us about the cake of your dreams, and track your order from confirmation to delivery.</p>
          <div className="row mt-2">
            <Link to="/shop" className="btn btn-primary btn-lg">Shop now</Link>
            <Link to="/custom-cake" className="btn btn-secondary btn-lg">Request a custom cake</Link>
          </div>
        </div>
        <div className="hero-art"><HeroArt /></div>
      </section>

      <section className="feature-grid mt-3">
        <div className="feature"><div className="f-icon">🎂</div><h3>Custom cakes</h3><p className="muted mb-0">Share the flavour, size, theme and message — we’ll send you a quote.</p></div>
        <div className="feature"><div className="f-icon">🎈</div><h3>Party decorations</h3><p className="muted mb-0">Balloons, banners, backdrops and tableware in one order.</p></div>
        <div className="feature"><div className="f-icon">🚚</div><h3>Delivery or pick-up</h3><p className="muted mb-0">Choose home delivery or collect from our shop and follow every step online.</p></div>
      </section>

      <section className="mt-3">
        <div className="section-title"><h2>Popular cakes</h2><Link to="/shop?type=CAKE">View all cakes →</Link></div>
        {cakes.loading ? <Loading /> : <div className="product-grid">{cakes.data?.data.map((p) => <ProductCard key={p.id} product={p} />)}</div>}
      </section>
      <section className="mt-3">
        <div className="section-title"><h2>Party decorations</h2><Link to="/shop?type=DECORATION">View all decorations →</Link></div>
        {decor.loading ? <Loading /> : <div className="product-grid">{decor.data?.data.map((p) => <ProductCard key={p.id} product={p} />)}</div>}
      </section>
    </div>
  );
}
