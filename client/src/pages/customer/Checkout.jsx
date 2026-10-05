import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { myApi } from '../../api';
import { useCart } from '../../context/CartContext';
import { useCustomerAuth } from '../../context/CustomerAuthContext';
import { useForm } from '../../utils/useAsync';
import { CUSTOM_CAKE_LEAD_DAYS, formatLKR, isoDate, TIME_SLOTS } from '../../utils/format';
import { isPhone } from '../../utils/validation';
import { Alert, Field, SubmitButton } from '../../components/ui';
import { CardFields, SandboxNotice, TestCards, cardErrors, cardPayload, emptyCard, validateCard } from '../../components/CardFields';
import { CakeSummary } from './Cart';

const CAKE_FIELDS = ['occasion', 'flavor', 'weightKg', 'shape', 'tiers', 'icingType', 'colors', 'theme', 'messageOnCake', 'dietaryNotes', 'additionalDetails'];

/** Only the API's cake-requirement fields; builder-only data (thumbnail, design, estimate) stays in the browser. */
function cakeRequirementPayload(cake) {
  if (!cake) return undefined;
  return Object.fromEntries(CAKE_FIELDS.filter((k) => cake[k] !== undefined && cake[k] !== '').map((k) => [k, cake[k]]));
}

// US15 - Submit an order
export default function Checkout() {
  const cart = useCart();
  const { customer } = useCustomerAuth();
  const navigate = useNavigate();
  // Custom cakes are pre-orders: they need notice and are paid online in advance.
  const isPreOrder = !!cart.customCake;
  const minDate = isoDate(isPreOrder ? CUSTOM_CAKE_LEAD_DAYS : 1);
  const f = useForm({
    fulfillmentType: 'DELIVERY', paymentOption: 'ONLINE',
    eventDate: cart.eventDate && cart.eventDate >= minDate ? cart.eventDate : minDate, notes: '',
    recipientName: customer.full_name, contactPhone: customer.phone, address: customer.address || '', city: customer.city || '',
    preferredTimeSlot: '', deliveryNotes: '',
    ...emptyCard(customer.full_name),
  });
  const isDelivery = f.values.fulfillmentType === 'DELIVERY';
  const payOnline = isPreOrder || f.values.paymentOption === 'ONLINE';
  // A card the gateway declined at checkout: shown next to the card fields (the order was not placed).
  const [cardDeclined, setCardDeclined] = useState('');
  const paymentRef = useRef(null);

  useEffect(() => { window.scrollTo(0, 0); }, [f.formError]);

  if (cart.items.length === 0 && !cart.customCake) return <Navigate to="/cart" replace />;

  const validate = (v) => ({
    eventDate: v.eventDate && v.eventDate >= minDate ? undefined
      : isPreOrder ? `Custom cakes are pre-orders: choose a date at least ${CUSTOM_CAKE_LEAD_DAYS} days from today` : 'Choose a date from tomorrow onwards',
    paymentOption: isPreOrder && v.paymentOption !== 'ONLINE' ? 'Custom cakes are paid online in advance' : undefined,
    recipientName: v.recipientName.trim().length >= 2 ? undefined : 'Recipient name is required',
    contactPhone: isPhone(v.contactPhone) ? undefined : 'Enter a valid phone number',
    address: !isDelivery || v.address.trim().length >= 5 ? undefined : 'Delivery address is required',
    city: !isDelivery || v.city.trim().length >= 2 ? undefined : 'City is required',
    // Paying online needs a card now: it is verified at checkout and charged when we confirm the final total.
    ...(payOnline ? validateCard(v) : {}),
  });

  const onSubmit = (e) => {
    e.preventDefault();
    setCardDeclined('');
    f.submit(async (v) => {
      const payload = {
        items: cart.items.map((i) => ({ productId: i.productId, quantity: i.quantity, notes: i.notes?.trim() || undefined })),
        cakeRequirement: cakeRequirementPayload(cart.customCake),
        fulfillmentType: v.fulfillmentType,
        paymentOption: payOnline ? 'ONLINE' : 'CASH_ON_DELIVERY',
        card: payOnline ? cardPayload(v) : undefined,
        eventDate: v.eventDate,
        notes: v.notes.trim() || undefined,
        delivery: {
          recipientName: v.recipientName.trim(), contactPhone: v.contactPhone.trim(),
          address: isDelivery ? v.address.trim() : undefined, city: isDelivery ? v.city.trim() : undefined,
          preferredTimeSlot: v.preferredTimeSlot || undefined, notes: v.deliveryNotes.trim() || undefined,
        },
      };
      let order;
      try {
        ({ order } = await myApi.placeOrder(payload, cart.cakeImage));
      } catch (err) {
        if (err.status === 402) {
          // The gateway declined the card: nothing was placed or charged. Let the customer try another card.
          setCardDeclined(err.message);
          paymentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
        throw { ...err, errors: cardErrors(err.errors) };
      }
      cart.clear();
      navigate(`/order-placed/${order.id}`, {
        replace: true,
        state: {
          orderNumber: order.order_number, paymentOption: payOnline ? 'ONLINE' : 'CASH_ON_DELIVERY', preOrder: isPreOrder,
          card: payOnline ? cardPayload(v).cardNumber.slice(-4) : null,
        },
      });
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
            <Field label="Required date" type="date" min={minDate} required {...f.bind('eventDate')}
              hint={isPreOrder ? `Custom cakes are made to order: pre-order at least ${CUSTOM_CAKE_LEAD_DAYS} days ahead.` : 'Orders can be placed for tomorrow onwards.'} />
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
          <section className="card stack" ref={paymentRef}>
            <h2>Payment</h2>
            <div className="choice-cards">
              <button type="button" className="choice-card" aria-pressed={payOnline} onClick={() => f.set('paymentOption', 'ONLINE')}>
                <strong>Pay online by card</strong>
                <span className="text-sm muted">
                  {isPreOrder
                    ? 'Add your card now. It’s charged when we confirm your cake’s price, and we start baking once it’s paid.'
                    : 'Add your card now. It’s charged when we confirm your order and final total.'}
                </span>
              </button>
              <button type="button" className="choice-card" aria-pressed={!isPreOrder && f.values.paymentOption === 'CASH_ON_DELIVERY'}
                disabled={isPreOrder} onClick={() => f.set('paymentOption', 'CASH_ON_DELIVERY')}>
                <strong>Cash on {isDelivery ? 'delivery' : 'collection'}</strong>
                <span className="text-sm muted">Pay in cash when you {isDelivery ? 'receive' : 'collect'} your order.</span>
                {isPreOrder && <span className="choice-note">Not available for custom cakes: they are pre-orders, paid online in advance.</span>}
              </button>
            </div>
            {f.errors.paymentOption && <span className="field-error">{f.errors.paymentOption}</span>}
            {payOnline && (
              <div className="stack">
                <h3 className="mb-0">Card details</h3>
                <p className="text-sm muted mb-0">
                  We verify your card now without taking any money. It is charged automatically
                  when we confirm your order{isPreOrder ? ' and the cake’s price' : ''}{isDelivery ? ' and delivery fee' : ''}.
                </p>
                <SandboxNotice />
                {cardDeclined && <Alert>{cardDeclined}</Alert>}
                <CardFields f={f} idPrefix="checkout-card" />
                <TestCards f={f} />
              </div>
            )}
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
          <SubmitButton busy={f.submitting} className="btn btn-primary btn-block btn-lg">{payOnline ? 'Verify card & place order' : 'Place order'}</SubmitButton>
          <p className="text-xs muted mb-0">
            {payOnline
              ? 'Your card is verified now; no money is taken until we confirm your order and final total.'
              : `No payment is taken now. You pay in cash on ${isDelivery ? 'delivery' : 'collection'}.`}
          </p>
        </aside>
      </div>
    </form>
  );
}
