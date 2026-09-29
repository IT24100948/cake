import { useEffect } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { myApi } from '../../api';
import { useCart } from '../../context/CartContext';
import { useCustomerAuth } from '../../context/CustomerAuthContext';
import { useForm } from '../../utils/useAsync';
import { formatLKR, isoDate, TIME_SLOTS } from '../../utils/format';
import { isPhone } from '../../utils/validation';
import { Alert, Field, SubmitButton } from '../../components/ui';
import { CakeSummary } from './Cart';

// US15 - Submit an order
export default function Checkout() {
  const cart = useCart();
  const { customer } = useCustomerAuth();
  const navigate = useNavigate();
  const f = useForm({
    fulfillmentType: 'DELIVERY', eventDate: isoDate(cart.customCake ? 3 : 1), notes: '',
    recipientName: customer.full_name, contactPhone: customer.phone, address: customer.address || '', city: customer.city || '',
    preferredTimeSlot: '', deliveryNotes: '',
  });
  const isDelivery = f.values.fulfillmentType === 'DELIVERY';

  useEffect(() => { window.scrollTo(0, 0); }, [f.formError]);

  if (cart.items.length === 0 && !cart.customCake) return <Navigate to="/cart" replace />;

  const validate = (v) => ({
    eventDate: v.eventDate && v.eventDate >= isoDate(1) ? undefined : 'Choose a date from tomorrow onwards',
    recipientName: v.recipientName.trim().length >= 2 ? undefined : 'Recipient name is required',
    contactPhone: isPhone(v.contactPhone) ? undefined : 'Enter a valid phone number',
    address: !isDelivery || v.address.trim().length >= 5 ? undefined : 'Delivery address is required',
    city: !isDelivery || v.city.trim().length >= 2 ? undefined : 'City is required',
  });

  const onSubmit = (e) => {
    e.preventDefault();
    f.submit(async (v) => {
      const payload = {
        items: cart.items.map((i) => ({ productId: i.productId, quantity: i.quantity, notes: i.notes?.trim() || undefined })),
        cakeRequirement: cart.customCake || undefined,
        fulfillmentType: v.fulfillmentType,
        eventDate: v.eventDate,
        notes: v.notes.trim() || undefined,
        delivery: {
          recipientName: v.recipientName.trim(), contactPhone: v.contactPhone.trim(),
          address: isDelivery ? v.address.trim() : undefined, city: isDelivery ? v.city.trim() : undefined,
          preferredTimeSlot: v.preferredTimeSlot || undefined, notes: v.deliveryNotes.trim() || undefined,
        },
      };
      const { order } = await myApi.placeOrder(payload, cart.cakeImage);
      cart.clear();
      navigate(`/order-placed/${order.id}`, { replace: true, state: { orderNumber: order.order_number } });
    }, validate);
  };

  const itemErrors = Object.entries(f.errors).filter(([k]) => k.startsWith('items['));

  return (
    <form className="stack" onSubmit={onSubmit} noValidate>
      <div className="row-between"><h1 className="mb-0">Checkout</h1><Link to="/cart">← Back to cart</Link></div>
      <Alert>{f.formError}</Alert>
      {itemErrors.length > 0 && (
        <Alert>
          {itemErrors.map(([k, msg]) => {
            const idx = Number(k.match(/\d+/)[0]);
            return <div key={k}>{cart.items[idx]?.name}: {msg}</div>;
          })}
          <Link to="/cart">Update your cart</Link>
        </Alert>
      )}
      <div className="checkout-layout">
        <div className="stack">
          <section className="card stack">
            <h2>When do you need it?</h2>
            <Field label="Required date" type="date" min={isoDate(1)} required {...f.bind('eventDate')}
              hint={cart.customCake ? 'Custom cakes need time — at least 3 days’ notice is recommended.' : 'Orders can be placed for tomorrow onwards.'} />
          </section>
          <section className="card stack">
            <h2>Delivery or collection</h2>
            <div className="choice-cards">
              {[['DELIVERY', 'Home delivery', 'We deliver to your address. Delivery fee is confirmed with your order.'],
                ['COLLECTION', 'Collect from shop', 'Pick up your order from Devma Cake n’ Party.']].map(([v, t, d]) => (
                <button type="button" key={v} className="choice-card" aria-pressed={f.values.fulfillmentType === v} onClick={() => f.set('fulfillmentType', v)}>
                  <strong>{t}</strong><span className="text-sm muted">{d}</span>
                </button>
              ))}
            </div>
            <div className="form-grid">
              <Field label={isDelivery ? 'Recipient name' : 'Collected by'} required {...f.bind('recipientName')} />
              <Field label="Contact phone" type="tel" required {...f.bind('contactPhone')} />
              {isDelivery && <Field className="full" label="Delivery address" required {...f.bind('address')} />}
              {isDelivery && <Field label="City" required {...f.bind('city')} />}
              <Field as="select" label={isDelivery ? 'Preferred delivery time' : 'Preferred collection time'} {...f.bind('preferredTimeSlot')}>
                <option value="">Any time</option>
                {TIME_SLOTS.map((t) => <option key={t}>{t}</option>)}
              </Field>
              <Field className="full" label={isDelivery ? 'Delivery instructions' : 'Collection notes'} maxLength={255} {...f.bind('deliveryNotes')} />
            </div>
          </section>
          <section className="card stack">
            <h2>Order notes</h2>
            <Field as="textarea" label="Anything else?" maxLength={500} placeholder="Optional notes for our team" {...f.bind('notes')} />
          </section>
        </div>
        <aside className="card summary-card stack">
          <h2>Your order</h2>
          {cart.customCake && <CakeSummary cake={cart.customCake} image={cart.cakeImage} />}
          {cart.items.map((i) => (
            <div className="summary-line" key={i.key}>
              <span>{i.quantity} × {i.name}{i.notes ? <span className="text-xs muted"><br />“{i.notes}”</span> : null}</span>
              <span className="nowrap">{formatLKR(i.price * i.quantity)}</span>
            </div>
          ))}
          <div>
            <div className="summary-line total"><span>Items subtotal</span><span>{formatLKR(cart.subtotal)}</span></div>
            {(cart.customCake || isDelivery) && (
              <p className="text-xs muted mt-1 mb-0">
                {cart.customCake && 'The custom cake price'}{cart.customCake && isDelivery && ' and '}{isDelivery && 'delivery fee'} will be added when our team confirms your order. You’ll be notified of the final total.
              </p>
            )}
          </div>
          <SubmitButton busy={f.submitting} className="btn btn-primary btn-block btn-lg">Place order</SubmitButton>
          <p className="text-xs muted mb-0">No payment is taken now. Payment is arranged with our team after confirmation.</p>
        </aside>
      </div>
    </form>
  );
}
