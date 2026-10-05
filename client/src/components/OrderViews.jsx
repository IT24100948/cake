import { ORDER_FLOW, formatDateTime, formatLKR, statusLabel, formatDate } from '../utils/format';

/** Visual progress through the order stages (US18, US24). */
export function OrderProgress({ order }) {
  if (['CANCELLED', 'REJECTED'].includes(order.status)) return null;
  const flow = ORDER_FLOW[order.fulfillment_type];
  const idx = flow.indexOf(order.status);
  return (
    <div className="stepper" aria-label="Order progress">
      {flow.map((s, i) => (
        <div key={s} className={`step${i < idx || order.status === 'COMPLETED' ? ' done' : ''}${i === idx && order.status !== 'COMPLETED' ? ' current' : ''}`}>
          <div className="dot">{i < idx || order.status === 'COMPLETED' ? '✓' : ''}</div>
          {statusLabel(s)}
        </div>
      ))}
    </div>
  );
}

/** Status history timeline. `showStaff` reveals which staff member made each change. */
export function OrderTimeline({ history, showStaff }) {
  const rows = [...history].reverse();
  return (
    <ol className="timeline">
      {rows.map((h, i) => {
        const same = h.from_status === h.to_status;
        const title = h.from_status === null ? 'Order submitted' : same ? 'Order details updated' : statusLabel(h.to_status);
        const who = h.changed_by_customer ? 'You' : showStaff ? h.staff_name || 'System' : 'Devma team';
        return (
          <li key={h.id} className={i === 0 ? 'current' : ''}>
            <div className="t-title">{title}</div>
            <div className="t-meta">{formatDateTime(h.created_at)} · {showStaff && h.changed_by_customer ? 'Customer' : who}</div>
            {h.note && !same && h.from_status !== null && <div className="t-note">{h.note}</div>}
            {h.note && h.from_status === null && showStaff && <div className="t-note">{h.note}</div>}
          </li>
        );
      })}
    </ol>
  );
}

export function CakeRequirementView({ cake }) {
  if (!cake) return null;
  const rows = [
    ['Occasion', cake.occasion], ['Flavour', cake.flavor], ['Weight', `${Number(cake.weight_kg)} kg`], ['Shape', cake.shape],
    ['Tiers', cake.tiers], ['Icing', cake.icing_type], ['Colours', cake.colors], ['Theme', cake.theme],
    ['Message on cake', cake.message_on_cake && `“${cake.message_on_cake}”`], ['Dietary notes', cake.dietary_notes],
    ['Other details', cake.additional_details],
    ['Quoted price', cake.quoted_price != null ? formatLKR(cake.quoted_price) : 'To be confirmed'],
  ].filter(([, v]) => v !== null && v !== undefined && v !== '');
  return (
    <div className="grid-2" style={{ alignItems: 'start' }}>
      <dl className="kv">{rows.map(([k, v]) => <FragmentKV key={k} k={k} v={v} />)}</dl>
      {cake.reference_image_url && (
        <a href={cake.reference_image_url} target="_blank" rel="noreferrer">
          <img src={cake.reference_image_url} alt="Cake reference" style={{ borderRadius: 10, maxHeight: 220, objectFit: 'cover', border: '1px solid var(--border)' }} />
          <span className="text-xs">Open reference image</span>
        </a>
      )}
    </div>
  );
}

function FragmentKV({ k, v }) {
  return (<><dt>{k}</dt><dd>{v}</dd></>);
}

export function OrderTotals({ order }) {
  return (
    <div>
      <div className="summary-line"><span>Items subtotal</span><span>{formatLKR(order.subtotal)}</span></div>
      {order.cakeRequirement && (
        <div className="summary-line"><span>Custom cake</span><span>{order.status === 'PENDING' ? 'Awaiting quote' : formatLKR(order.cake_quote_amount)}</span></div>
      )}
      {order.fulfillment_type === 'DELIVERY' && (
        <div className="summary-line"><span>Delivery fee</span><span>{order.status === 'PENDING' ? 'To be confirmed' : formatLKR(order.delivery_fee)}</span></div>
      )}
      <div className="summary-line total"><span>Total</span><span>{formatLKR(order.total_amount)}</span></div>
      <div className="summary-line"><span>Paid</span><span className="success-text">{formatLKR(order.amount_paid + (order.amount_refunded || 0))}</span></div>
      {order.amount_refunded > 0 && <div className="summary-line"><span>Refunded</span><span>− {formatLKR(order.amount_refunded)}</span></div>}
      {order.payment_status === 'REFUNDED'
        ? <div className="summary-line strong"><span>Balance</span><span>Refunded in full</span></div>
        : <div className="summary-line strong"><span>Balance due</span><span>{formatLKR(order.balance_due)}</span></div>}
    </div>
  );
}

export function DeliveryView({ delivery, eventDate }) {
  if (!delivery) return null;
  const isDelivery = delivery.type === 'DELIVERY';
  return (
    <dl className="kv">
      <dt>Method</dt><dd>{isDelivery ? 'Home delivery' : 'Collect from shop'}</dd>
      <dt>Required on</dt><dd>{formatDate(eventDate)}</dd>
      <dt>Recipient</dt><dd>{delivery.recipient_name} · {delivery.contact_phone}</dd>
      {isDelivery && <><dt>Address</dt><dd>{delivery.address}, {delivery.city}</dd></>}
      <dt>Scheduled</dt>
      <dd>{delivery.scheduled_date ? `${formatDate(delivery.scheduled_date)}${delivery.scheduled_time_slot ? ` · ${delivery.scheduled_time_slot}` : ''}` : delivery.scheduled_time_slot ? `Preferred: ${delivery.scheduled_time_slot}` : 'Not scheduled yet'}</dd>
      {delivery.assigned_staff_name && <><dt>Assigned to</dt><dd>{delivery.assigned_staff_name}</dd></>}
      {delivery.notes && <><dt>Notes</dt><dd>{delivery.notes}</dd></>}
    </dl>
  );
}
