import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { catalogApi } from '../../api';
import { useAsync } from '../../utils/useAsync';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../context/ToastContext';
import { formatLKR, imageUrl } from '../../utils/format';
import { Empty, Field, Loading, QtyInput } from '../../components/ui';
import { StockNote } from './ProductCard';

export default function ProductDetail() {
  const { id } = useParams();
  const { data, loading, error } = useAsync(() => catalogApi.product(id), [id]);
  const cart = useCart();
  const toast = useToast();
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState('');

  if (loading) return <Loading />;
  if (error) return <Empty icon="🍰" title="Product not available">This product may have been removed. <Link to="/shop">Back to shop</Link></Empty>;
  const p = data.product;
  const inCart = cart.items.filter((i) => i.productId === p.id).reduce((s, i) => s + i.quantity, 0);
  const maxQty = Math.max(0, p.stock_quantity - inCart);

  return (
    <div className="stack">
      <Link to={`/shop?type=${p.product_type}`} className="text-sm">← Back to {p.product_type === 'CAKE' ? 'cakes' : 'decorations'}</Link>
      <div className="product-detail">
        <div className="image"><img src={imageUrl(p.image_url, p.product_type)} alt={p.name} /></div>
        <div>
          <span className="badge badge-primary badge-plain">{p.category_name}</span>
          <h1 className="mt-1">{p.name}</h1>
          <div className="price">{formatLKR(p.price)}</div>
          <p className="muted">{p.description}</p>
          <StockNote product={p} />
          {maxQty > 0 ? (
            <div className="stack mt-2">
              <Field label={p.product_type === 'CAKE' ? 'Message on cake / note (optional)' : 'Note (optional)'} value={notes}
                maxLength={150} onChange={(e) => setNotes(e.target.value)}
                placeholder={p.product_type === 'CAKE' ? 'e.g. Happy Birthday Nimal' : 'e.g. Number 5'} hint={`${notes.length}/150`} />
              <div className="row">
                <QtyInput value={Math.min(qty, maxQty)} onChange={setQty} max={maxQty} />
                <button type="button" className="btn btn-primary btn-lg"
                  onClick={() => { cart.add(p, Math.min(qty, maxQty), notes.trim()); toast.success('Added to cart'); setQty(1); setNotes(''); }}>
                  Add to cart
                </button>
              </div>
            </div>
          ) : (
            <div className="alert alert-warning mt-2">
              {p.stock_quantity <= 0 ? 'This product is currently out of stock.' : 'You already have all available stock of this product in your cart.'}
            </div>
          )}
          <hr />
          <p className="text-sm muted mb-0">Want something unique? <Link to="/custom-cake">Request a custom cake</Link> with your own flavour, design and message.</p>
        </div>
      </div>
    </div>
  );
}
