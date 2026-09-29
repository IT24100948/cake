import { Link } from 'react-router-dom';
import { img, INSTAGRAM } from '../../landing/data';
import { Wordmark, useSectionNav } from './SiteHeader';
import LineIcon from './LineIcon';

export default function SiteFooter() {
  const goSection = useSectionNav();
  return (
    <footer className="site-ftr" id="contact">
      <div className="ftr-inner">
        <div className="ftr-brand">
          <Wordmark light />
          <p className="ftr-lede">Custom cakes, beautiful treats and everything you need to make your celebration unforgettable.</p>
          <p className="ftr-place"><LineIcon name="pin" size={18} /> Baked fresh in Colombo · Island-wide delivery</p>
        </div>
        <div className="ftr-cols">
          <div>
            <h4>Shop</h4>
            <Link to="/shop?type=CAKE">Cakes</Link>
            <Link to="/shop?type=DECORATION">Party decorations</Link>
            <button type="button" onClick={() => goSection('build')}>Build your cake</button>
            <Link to="/custom-cake">Custom cake request</Link>
          </div>
          <div>
            <h4>Your orders</h4>
            <Link to="/my/orders">Track an order</Link>
            <Link to="/notifications">Order updates</Link>
            <Link to="/profile">My account</Link>
            <Link to="/staff/login">Staff portal</Link>
          </div>
        </div>
        <div className="ftr-insta">
          <h4><LineIcon name="instagram" size={18} /> From our kitchen</h4>
          <div className="ftr-insta-grid">
            {INSTAGRAM.map((id) => <img key={id} src={img(id, 220, 220)} alt="" loading="lazy" width="110" height="110" />)}
          </div>
        </div>
      </div>
      <div className="ftr-base">
        <span>© {new Date().getFullYear()} Cake n’ Party by Devma. Made with love in Sri Lanka.</span>
        <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>Back to top ↑</button>
      </div>
    </footer>
  );
}
