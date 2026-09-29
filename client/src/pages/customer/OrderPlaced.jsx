import { Link, useLocation, useParams } from 'react-router-dom';

export default function OrderPlaced() {
  const { id } = useParams();
  const { state } = useLocation();
  return (
    <div className="card success-hero" style={{ maxWidth: 620, margin: '0 auto' }}>
      <div className="check" aria-hidden="true">✓</div>
      <h1>Thank you! Your order has been submitted.</h1>
      {state?.orderNumber && <p className="strong">Order number: {state.orderNumber}</p>}
      <p className="muted">Our team will review your order and confirm it shortly. You’ll receive a notification at every step.</p>
      <div className="row mt-2" style={{ justifyContent: 'center' }}>
        <Link to={`/my/orders/${id}`} className="btn btn-primary">Track this order</Link>
        <Link to="/shop" className="btn btn-secondary">Continue shopping</Link>
      </div>
    </div>
  );
}
