import { Link } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../context/ToastContext';
import { formatLKR, imageUrl } from '../../utils/format';

export function StockNote({ product }) {
  if (product.stock_quantity <= 0) return <span className="stock-note out">Out of stock</span>;
  if (product.stock_quantity <= 5) return <span className="stock-note low">Only {product.stock_quantity} left</span>;
  return <span className="stock-note muted">In stock</span>;
}

export default function ProductCard({ product }) {
  const cart = useCart();
  const toast = useToast();
  const inCart = cart.items.filter((i) => i.productId === product.id).reduce((s, i) => s + i.quantity, 0);
  const soldOut = product.stock_quantity <= 0 || inCart >= product.stock_quantity;
  return (
    <article className="product-card">
      <Link to={`/shop/${product.id}`} className="thumb" aria-hidden="true" tabIndex={-1}>
        <img src={imageUrl(product.image_url)} alt="" loading="lazy" />
      </Link>
      <div className="body">
        <span className="cat">{product.category_name}</span>
        <Link to={`/shop/${product.id}`} className="name">{product.name}</Link>
        <StockNote product={product} />
        <div className="foot">
          <span className="price">{formatLKR(product.price)}</span>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={soldOut}
            onClick={() => { cart.add(product, 1); toast.success(`${product.name} added to cart`); }}
          >
            {product.stock_quantity <= 0 ? 'Sold out' : inCart >= product.stock_quantity ? 'Max in cart' : 'Add to cart'}
          </button>
        </div>
      </div>
    </article>
  );
}
