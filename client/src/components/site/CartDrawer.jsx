import { useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useCart } from '../../context/CartContext';
import { useCartUI } from '../../context/CartUIContext';
import { formatPrice as formatLKR, imageUrl, isoDate } from '../../utils/format';
import { getSize } from '../../landing/cakeOptions';
import LineIcon from './LineIcon';

/** Slide-in order summary (US14/US15): real cart, real checkout. */
export default function CartDrawer() {
  const cart = useCart();
  const { open, closeDrawer } = useCartUI();
  const navigate = useNavigate();
  const panel = useRef(null);
  const cake = cart.customCake;
  const empty = cart.items.length === 0 && !cake;
  const estimate = cake?.estimate || 0;
  const minDate = isoDate(cake ? 3 : 1);

  useEffect(() => {
    if (!open) return undefined;
    const esc = (e) => e.key === 'Escape' && closeDrawer();
    document.addEventListener('keydown', esc);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    setTimeout(() => panel.current?.querySelector('button, a, input')?.focus(), 50);
    return () => { document.removeEventListener('keydown', esc); document.body.style.overflow = prev; };
  }, [open, closeDrawer]);

  const go = (to) => { closeDrawer(); navigate(to); };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="drawer-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeDrawer} />
          <motion.aside
            ref={panel}
            className="drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Your order"
            initial={{ x: '104%' }}
            animate={{ x: 0 }}
            exit={{ x: '104%' }}
            transition={{ type: 'spring', stiffness: 260, damping: 32 }}
          >
            <div className="drawer-head">
              <div>
                <span className="eyebrow">Your celebration</span>
                <h2>Your order</h2>
              </div>
              <button type="button" className="hdr-icon" onClick={closeDrawer} aria-label="Close"><LineIcon name="close" /></button>
            </div>

            {empty ? (
              <div className="drawer-empty">
                <div className="drawer-empty-art" aria-hidden="true"><LineIcon name="cake" size={40} stroke={1.1} /></div>
                <h3>Nothing sweet here yet</h3>
                <p>Design a cake of your own or pick from our favourites.</p>
                <button type="button" className="pill pill-primary" onClick={() => go('/#build')}>Build your cake</button>
                <button type="button" className="pill pill-ghost" onClick={() => go('/shop?type=CAKE')}>Browse cakes</button>
              </div>
            ) : (
              <>
                <div className="drawer-body">
                  {cake && (
                    <div className="drawer-line is-cake">
                      <div className="drawer-thumb">{cake.thumbnail ? <img src={cake.thumbnail} alt="" /> : <LineIcon name="cake" size={30} stroke={1.2} />}</div>
                      <div className="drawer-info">
                        <strong>Custom {cake.flavor} cake</strong>
                        <span>{cake.design ? getSize(cake.design.size).label : `${cake.weightKg} kg`} · {cake.icingType}</span>
                        <span>{cake.theme?.split(' — ')[0]}</span>
                        <div className="drawer-line-actions">
                          <button type="button" className="text-link" onClick={() => go(cake.design ? '/#build' : '/custom-cake')}>Edit design</button>
                          <button type="button" className="text-link" onClick={() => go('/custom-cake')}>Add a message</button>
                          <button type="button" className="text-link muted-link" onClick={cart.removeCustomCake}>Remove</button>
                        </div>
                      </div>
                      <div className="drawer-price">
                        {estimate ? <><span className="est">est.</span>{formatLKR(estimate)}</> : <span className="est">Quoted</span>}
                      </div>
                    </div>
                  )}
                  {cart.items.map((i) => (
                    <div className="drawer-line" key={i.key}>
                      <div className="drawer-thumb"><img src={imageUrl(i.image)} alt="" /></div>
                      <div className="drawer-info">
                        <strong>{i.name}</strong>
                        <span>{formatLKR(i.price)} each{i.notes ? ` · “${i.notes}”` : ''}</span>
                        <div className="qty-pill" role="group" aria-label={`Quantity of ${i.name}`}>
                          <button type="button" aria-label="Decrease" onClick={() => (i.quantity > 1 ? cart.update(i.key, { quantity: i.quantity - 1 }) : cart.remove(i.key))}><LineIcon name="minus" size={16} /></button>
                          <span aria-live="polite">{i.quantity}</span>
                          <button type="button" aria-label="Increase" disabled={i.quantity >= i.stock} onClick={() => cart.update(i.key, { quantity: i.quantity + 1 })}><LineIcon name="plus" size={16} /></button>
                        </div>
                      </div>
                      <div className="drawer-price">{formatLKR(i.price * i.quantity)}</div>
                    </div>
                  ))}
                </div>

                <div className="drawer-foot">
                  <label className="drawer-date">
                    <span><LineIcon name="calendar" size={18} /> Celebration date</span>
                    <input type="date" min={minDate} value={cart.eventDate} onChange={(e) => cart.setEventDate(e.target.value)} />
                  </label>
                  {cake && <p className="drawer-note">Custom cakes need at least 3 days. Your cake’s final price is confirmed by our team before we bake.</p>}
                  <div className="drawer-total">
                    <span>{cake ? 'Estimated total' : 'Subtotal'}</span>
                    <strong>{formatLKR(cart.subtotal + estimate)}</strong>
                  </div>
                  <button type="button" className="pill pill-primary pill-lg pill-block" onClick={() => go('/checkout')}>
                    Continue to checkout <LineIcon name="arrow" size={18} />
                  </button>
                  <Link to="/cart" className="drawer-secondary" onClick={closeDrawer}>View full cart</Link>
                </div>
              </>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
