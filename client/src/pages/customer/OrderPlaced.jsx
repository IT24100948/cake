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
      {state?.paymentOption === 'ONLINE' && (
        <p className="muted">
          {state.preOrder
            ? `Your custom cake is a pre-order. Your card${state.card ? ` ending ${state.card}` : ''} is verified and will be charged when we confirm its price; we start baking once it’s paid.`
            : `Your card${state.card ? ` ending ${state.card}` : ''} is verified and will be charged when we confirm your order and final total.`}
        </p>
      )}
      {state?.paymentOption === 'CASH_ON_DELIVERY' && <p className="muted">You’ll pay in cash when your order is delivered or collected.</p>}
      <div className="row mt-2" style={{ justifyContent: 'center' }}>
        <Link to={`/my/orders/${id}`} className="btn btn-primary">Track this order</Link>
        <Link to="/shop" className="btn btn-secondary">Continue shopping</Link>
      </div>
    </div>
  );
}
