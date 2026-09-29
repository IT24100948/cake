import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { formatLKR, imageUrl } from '../../utils/format';
import { Empty, QtyInput } from '../../components/ui';

export function CakeSummary({ cake, image, actions }) {
  return (
    <div className="cake-summary">
      <div className="row-between">
        <strong>🎂 Custom cake request</strong>
        {actions}
      </div>
      <p className="text-sm mb-0 mt-1">
        {cake.occasion} · {cake.flavor} · {cake.weightKg} kg · {cake.shape}{cake.tiers > 1 ? ` · ${cake.tiers} tiers` : ''}
        {cake.messageOnCake ? ` · “${cake.messageOnCake}”` : ''}
      </p>
      <p className="text-xs muted mb-0 mt-1">
        Price will be quoted by our team when your order is confirmed.{image ? ` Reference image: ${image.name}` : ''}
      </p>
    </div>
  );
}

// US14 - Select party decoration products (and other catalog items)
export default function Cart() {
  const cart = useCart();
  const navigate = useNavigate();
  const empty = cart.items.length === 0 && !cart.customCake;

  if (empty) {
    return (
      <Empty icon="🛒" title="Your cart is empty">
        <p>Add cakes and party decorations, or request a custom cake.</p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <Link to="/shop" className="btn btn-primary">Browse products</Link>
          <Link to="/custom-cake" className="btn btn-secondary">Request a custom cake</Link>
        </div>
      </Empty>
    );
  }

  return (
    <div className="stack">
      <h1>Your cart</h1>
      <div className="checkout-layout">
        <div className="stack">
          {cart.customCake && (
            <CakeSummary cake={cart.customCake} image={cart.cakeImage} actions={(
              <div className="row">
                <Link to="/custom-cake" className="btn btn-sm btn-secondary">Edit</Link>
                <button type="button" className="btn btn-sm btn-ghost" onClick={cart.removeCustomCake}>Remove</button>
              </div>
            )} />
          )}
          {cart.items.length > 0 && (
            <div className="card">
              {cart.items.map((i) => (
                <div className="cart-item" key={i.key}>
                  <img src={imageUrl(i.image)} alt="" />
                  <div>
                    <Link to={`/shop/${i.productId}`} className="strong">{i.name}</Link>
                    <div className="text-sm muted">{formatLKR(i.price)} each · {i.type === 'CAKE' ? 'Cake' : 'Decoration'}</div>
                    <input className="input mt-1" style={{ minHeight: 34, fontSize: '0.85rem' }} maxLength={150} placeholder="Add a note (optional)"
                      value={i.notes || ''} onChange={(e) => cart.update(i.key, { notes: e.target.value })} aria-label={`Note for ${i.name}`} />
                  </div>
                  <div className="controls">
                    <strong>{formatLKR(i.price * i.quantity)}</strong>
                    <QtyInput value={i.quantity} max={Math.max(1, i.stock)} onChange={(q) => cart.update(i.key, { quantity: q })} />
                    <button type="button" className="link-btn text-sm" onClick={() => cart.remove(i.key)}>Remove</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="row">
            <Link to="/shop?type=DECORATION" className="btn btn-secondary">+ Add party decorations</Link>
            {!cart.customCake && <Link to="/custom-cake" className="btn btn-secondary">+ Add a custom cake</Link>}
          </div>
        </div>
        <aside className="card summary-card">
          <h2>Summary</h2>
          <div className="summary-line"><span>Items</span><span>{formatLKR(cart.subtotal)}</span></div>
          {cart.customCake && <div className="summary-line"><span>Custom cake</span><span className="muted">Quoted later</span></div>}
          <div className="summary-line"><span>Delivery</span><span className="muted">Confirmed later</span></div>
          <div className="summary-line total"><span>Estimated total</span><span>{formatLKR(cart.subtotal)}</span></div>
          <button type="button" className="btn btn-primary btn-block btn-lg mt-2" onClick={() => navigate('/checkout')}>Continue to checkout</button>
          <p className="text-xs muted mt-1 mb-0">Stock is reserved when our team confirms your order.</p>
        </aside>
      </div>
    </div>
  );
}
