import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { orderApi, productApi, staffApi } from '../../api';
import { useStaffAuth } from '../../context/StaffAuthContext';
import { useToast } from '../../context/ToastContext';
import { useAsync, useForm } from '../../utils/useAsync';
import { formatDate, formatDateTime, formatLKR, imageUrl, isoDate, methodLabel, PAYMENT_METHODS, statusLabel, TIME_SLOTS } from '../../utils/format';
import { isPhone } from '../../utils/validation';
import { Alert, ErrorState, Field, Loading, Modal, StatusBadge, SubmitButton } from '../../components/ui';
import { Can } from '../../components/Guards';
import { CakeRequirementView, DeliveryView, OrderProgress, OrderTimeline, OrderTotals } from '../../components/OrderViews';
import { PageHead } from '../../layouts/StaffLayout';

// ---------- US19 Confirm order ----------
function ConfirmModal({ order, onClose, onDone }) {
  const toast = useToast();
  const f = useForm({ cakeQuote: order.cakeRequirement?.quoted_price ?? '', deliveryFee: order.fulfillment_type === 'DELIVERY' ? '' : 0, note: '' });
  const quote = Number(f.values.cakeQuote) || 0;
  const fee = order.fulfillment_type === 'DELIVERY' ? Number(f.values.deliveryFee) || 0 : 0;
  const onSubmit = (e) => {
    e.preventDefault();
    f.submit(async (v) => {
      const res = await orderApi.confirm(order.id, {
        cakeQuote: order.cakeRequirement ? Number(v.cakeQuote) : undefined,
        deliveryFee: order.fulfillment_type === 'DELIVERY' ? Number(v.deliveryFee || 0) : undefined,
        note: v.note.trim() || undefined,
      });
      toast.success(`${order.order_number} confirmed`);
      onDone(res.order);
    }, (v) => ({
      cakeQuote: !order.cakeRequirement || Number(v.cakeQuote) > 0 ? undefined : 'Enter the price for the custom cake',
      deliveryFee: order.fulfillment_type !== 'DELIVERY' || v.deliveryFee === '' || Number(v.deliveryFee) >= 0 ? undefined : 'Enter a valid fee',
    }));
  };
  return (
    <Modal title={`Confirm order ${order.order_number}`} onClose={onClose}>
      <form className="stack" onSubmit={onSubmit} noValidate>
        <Alert>{f.formError}</Alert>
        <p className="muted mb-0">Confirming reserves stock for the items and notifies the customer with the final total.</p>
        <div className="form-grid">
          {order.cakeRequirement && <Field label="Custom cake price (LKR)" type="number" min="1" step="0.01" required {...f.bind('cakeQuote')} />}
          {order.fulfillment_type === 'DELIVERY' && <Field label="Delivery fee (LKR)" type="number" min="0" step="0.01" {...f.bind('deliveryFee')} />}
          <Field className="full" as="textarea" label="Note to customer (optional)" maxLength={500} {...f.bind('note')} />
        </div>
        <div className="card" style={{ background: 'var(--bg-muted)', padding: '0.75rem 1rem' }}>
          <div className="summary-line"><span>Items</span><span>{formatLKR(order.subtotal)}</span></div>
          {order.cakeRequirement && <div className="summary-line"><span>Custom cake</span><span>{formatLKR(quote)}</span></div>}
          {order.fulfillment_type === 'DELIVERY' && <div className="summary-line"><span>Delivery</span><span>{formatLKR(fee)}</span></div>}
          <div className="summary-line total"><span>Order total</span><span>{formatLKR(order.subtotal + quote + fee)}</span></div>
        </div>
        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <SubmitButton busy={f.submitting} className="btn btn-success">Confirm order</SubmitButton>
        </div>
      </form>
    </Modal>
  );
}

// ---------- US17 / US23 Status change ----------
function StatusModal({ order, target, onClose, onDone }) {
  const toast = useToast();
  const needsReason = ['CANCELLED', 'REJECTED'].includes(target);
  const f = useForm({ note: '' });
  const onSubmit = (e) => {
    e.preventDefault();
    f.submit(async (v) => {
      const res = await orderApi.setStatus(order.id, { status: target, note: v.note.trim() || undefined });
      toast.success(`Status changed to ${statusLabel(target)}`);
      onDone(res.order);
    }, (v) => ({ note: needsReason && !v.note.trim() ? 'Please provide a reason' : undefined }));
  };
  return (
    <Modal title={`Mark as ${statusLabel(target)}`} onClose={onClose}>
      <form className="stack" onSubmit={onSubmit} noValidate>
        <Alert>{f.formError}</Alert>
        {target === 'CANCELLED' && order.stock_deducted && <Alert type="info">Reserved stock will be returned to inventory.</Alert>}
        {target === 'CANCELLED' && order.amount_paid > 0 && <Alert type="warning">{formatLKR(order.amount_paid)} has been paid. Remember to mark the payment as refunded if you return it.</Alert>}
        {target === 'COMPLETED' && <Alert type="info">The {order.fulfillment_type === 'DELIVERY' ? 'delivery' : 'collection'} will be marked as {order.fulfillment_type === 'DELIVERY' ? 'delivered' : 'collected'}.</Alert>}
        <Field as="textarea" label={needsReason ? 'Reason (shared with the customer)' : 'Note to customer (optional)'} required={needsReason} maxLength={500} {...f.bind('note')} />
        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Back</button>
          <SubmitButton busy={f.submitting} className={`btn ${needsReason ? 'btn-danger' : 'btn-primary'}`}>Mark as {statusLabel(target)}</SubmitButton>
        </div>
      </form>
    </Modal>
  );
}

// ---------- US17 Edit order details ----------
function EditOrderModal({ order, onClose, onDone }) {
  const toast = useToast();
  const products = useAsync(() => productApi.list({ limit: 100, availability: 'available', sort: 'name' }), []);
  const pending = order.status === 'PENDING';
  const c = order.cakeRequirement;
  const [items, setItems] = useState(order.items.map((i) => ({ productId: i.product_id, quantity: i.quantity, notes: i.notes || '' })));
  const f = useForm({
    eventDate: order.event_date, staffNotes: order.staff_notes || '',
    cakeQuote: order.cake_quote_amount || '', deliveryFee: order.delivery_fee || 0,
    occasion: c?.occasion || '', flavor: c?.flavor || '', weightKg: c?.weight_kg || '', shape: c?.shape || '', tiers: c?.tiers || 1,
    icingType: c?.icing_type || '', colors: c?.colors || '', theme: c?.theme || '', messageOnCake: c?.message_on_cake || '',
    dietaryNotes: c?.dietary_notes || '', additionalDetails: c?.additional_details || '',
  });

  const onSubmit = (e) => {
    e.preventDefault();
    f.submit(async (v) => {
      const body = { eventDate: v.eventDate, staffNotes: v.staffNotes.trim() };
      if (pending) body.items = items.filter((i) => i.productId).map((i) => ({ ...i, productId: Number(i.productId), quantity: Number(i.quantity), notes: i.notes || undefined }));
      if (c) {
        body.cakeRequirement = {
          occasion: v.occasion, flavor: v.flavor, weightKg: Number(v.weightKg), shape: v.shape, tiers: Number(v.tiers),
          icingType: v.icingType, colors: v.colors, theme: v.theme, messageOnCake: v.messageOnCake, dietaryNotes: v.dietaryNotes, additionalDetails: v.additionalDetails,
        };
      }
      if (!pending) {
        if (c) body.cakeQuote = Number(v.cakeQuote);
        if (order.fulfillment_type === 'DELIVERY') body.deliveryFee = Number(v.deliveryFee);
      }
      const res = await orderApi.update(order.id, body);
      toast.success('Order updated');
      onDone(res.order);
    }, (v) => ({
      eventDate: v.eventDate ? undefined : 'Required',
      weightKg: !c || (Number(v.weightKg) >= 0.5 && Number(v.weightKg) <= 20) ? undefined : '0.5 – 20 kg',
      cakeQuote: pending || !c || Number(v.cakeQuote) > 0 ? undefined : 'Must be greater than 0',
    }));
  };

  const productList = products.data?.data || [];
  return (
    <Modal title={`Edit order ${order.order_number}`} onClose={onClose} size="lg">
      <form className="stack" onSubmit={onSubmit} noValidate>
        <Alert>{f.formError}</Alert>
        {Object.entries(f.errors).filter(([k]) => k.startsWith('items')).map(([k, m]) => <Alert key={k}>{m}</Alert>)}
        <div className="form-grid">
          <Field label="Required date" type="date" {...f.bind('eventDate')} />
          {!pending && c && <Field label="Custom cake price (LKR)" type="number" min="1" step="0.01" {...f.bind('cakeQuote')} />}
          {!pending && order.fulfillment_type === 'DELIVERY' && <Field label="Delivery fee (LKR)" type="number" min="0" step="0.01" {...f.bind('deliveryFee')} />}
        </div>
        <div>
          <h3>Items</h3>
          {!pending && <p className="text-sm muted">Items can only be changed before the order is confirmed (stock has already been reserved).</p>}
          {pending && (products.loading ? <Loading /> : (
            <>
              {items.map((it, idx) => (
                <div className="item-editor" key={idx}>
                  <select className="select" value={it.productId} onChange={(e) => setItems(items.map((x, i) => (i === idx ? { ...x, productId: e.target.value } : x)))} aria-label="Product">
                    <option value="">Select product</option>
                    {productList.map((p) => <option key={p.id} value={p.id}>{p.name} — {formatLKR(p.price)} ({p.stock_quantity} in stock)</option>)}
                    {!productList.some((p) => p.id === Number(it.productId)) && it.productId && (
                      <option value={it.productId}>{order.items.find((x) => x.product_id === Number(it.productId))?.product_name}</option>
                    )}
                  </select>
                  <input className="input" type="number" min="1" max="100" value={it.quantity} aria-label="Quantity"
                    onChange={(e) => setItems(items.map((x, i) => (i === idx ? { ...x, quantity: e.target.value } : x)))} />
                  <button type="button" className="btn btn-ghost btn-icon" aria-label="Remove item" onClick={() => setItems(items.filter((_, i) => i !== idx))}>×</button>
                </div>
              ))}
              <button type="button" className="btn btn-sm btn-secondary" onClick={() => setItems([...items, { productId: '', quantity: 1, notes: '' }])}>+ Add item</button>
            </>
          ))}
        </div>
        {c && (
          <div>
            <h3>Custom cake requirements</h3>
            <div className="form-grid">
              <Field label="Occasion" {...f.bind('occasion')} />
              <Field label="Flavour" {...f.bind('flavor')} />
              <Field label="Weight (kg)" type="number" step="0.5" {...f.bind('weightKg')} />
              <Field label="Shape" {...f.bind('shape')} />
              <Field label="Tiers" type="number" min="1" max="5" {...f.bind('tiers')} />
              <Field label="Icing" {...f.bind('icingType')} />
              <Field label="Colours" {...f.bind('colors')} />
              <Field label="Theme" {...f.bind('theme')} />
              <Field className="full" label="Message on cake" maxLength={120} {...f.bind('messageOnCake')} />
              <Field className="full" label="Dietary notes" {...f.bind('dietaryNotes')} />
              <Field className="full" as="textarea" label="Other details" {...f.bind('additionalDetails')} />
            </div>
          </div>
        )}
        <Field as="textarea" label="Internal staff notes (not shown to customer)" maxLength={500} {...f.bind('staffNotes')} />
        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <SubmitButton busy={f.submitting}>Save changes</SubmitButton>
        </div>
      </form>
    </Modal>
  );
}

// ---------- US20 Record payment ----------
function PaymentModal({ order, onClose, onDone }) {
  const toast = useToast();
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const f = useForm({ amount: order.balance_due, method: 'CASH', referenceNo: '', paidAt: local, notes: '' });
  const needsRef = f.values.method !== 'CASH';
  const onSubmit = (e) => {
    e.preventDefault();
    f.submit(async (v) => {
      const res = await orderApi.recordPayment(order.id, {
        amount: Number(v.amount), method: v.method, referenceNo: v.referenceNo.trim() || undefined,
        paidAt: new Date(v.paidAt).toISOString(), notes: v.notes.trim() || undefined,
      });
      toast.success(`Payment of ${formatLKR(v.amount)} recorded`);
      onDone(res.order);
    }, (v) => ({
      amount: Number(v.amount) > 0 && Number(v.amount) <= order.balance_due + 0.001 ? undefined : `Enter an amount between 0 and ${formatLKR(order.balance_due)}`,
      referenceNo: !needsRef || v.referenceNo.trim().length >= 2 ? undefined : 'Reference number is required for this method',
      paidAt: v.paidAt && new Date(v.paidAt) <= new Date(Date.now() + 60000) ? undefined : 'Payment date cannot be in the future',
    }));
  };
  return (
    <Modal title="Record payment" onClose={onClose}>
      <form className="stack" onSubmit={onSubmit} noValidate>
        <Alert>{f.formError}</Alert>
        <div className="row-between"><span className="muted">Balance due</span><strong>{formatLKR(order.balance_due)}</strong></div>
        <div className="form-grid">
          <Field label="Amount (LKR)" type="number" min="0.01" step="0.01" required {...f.bind('amount')} />
          <Field as="select" label="Method" required {...f.bind('method')}>{PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</Field>
          <Field label="Reference no." required={needsRef} placeholder={needsRef ? 'Bank / transaction ref' : 'Optional'} {...f.bind('referenceNo')} />
          <Field label="Paid at" type="datetime-local" max={local} required {...f.bind('paidAt')} />
          <Field className="full" label="Notes" maxLength={255} placeholder="e.g. Advance payment" {...f.bind('notes')} />
        </div>
        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <SubmitButton busy={f.submitting}>Record payment</SubmitButton>
        </div>
      </form>
    </Modal>
  );
}

// ---------- US21 Payment status ----------
function PaymentStatusModal({ order, onClose, onDone }) {
  const toast = useToast();
  const f = useForm({ paymentStatus: order.payment_status === 'REFUNDED' ? 'PAID' : 'REFUNDED', note: '' });
  const onSubmit = (e) => {
    e.preventDefault();
    f.submit(async (v) => {
      const res = await orderApi.setPaymentStatus(order.id, { paymentStatus: v.paymentStatus, note: v.note.trim() || undefined });
      toast.success('Payment status updated');
      onDone(res.order);
    });
  };
  return (
    <Modal title="Update payment status" onClose={onClose}>
      <form className="stack" onSubmit={onSubmit} noValidate>
        <Alert>{f.formError}</Alert>
        <p className="muted mb-0">Payment status is updated automatically when payments are recorded. Use this to correct it or mark a refund.</p>
        <Field as="select" label="Payment status" {...f.bind('paymentStatus')}>
          {['UNPAID', 'PARTIALLY_PAID', 'PAID', 'REFUNDED'].filter((s) => s !== order.payment_status).map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
        </Field>
        <Field as="textarea" label="Note (shared with customer)" maxLength={255} {...f.bind('note')} />
        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <SubmitButton busy={f.submitting}>Update status</SubmitButton>
        </div>
      </form>
    </Modal>
  );
}

// ---------- US22 Delivery / collection ----------
function DeliveryModal({ order, onClose, onDone }) {
  const toast = useToast();
  const staff = useAsync(() => staffApi.options(), []);
  const d = order.delivery;
  const f = useForm({
    type: d.type, recipientName: d.recipient_name, contactPhone: d.contact_phone, address: d.address || order.customer_address || '',
    city: d.city || order.customer_city || '', scheduledDate: d.scheduled_date || order.event_date, scheduledTimeSlot: d.scheduled_time_slot || '',
    assignedStaffId: d.assigned_staff_id || '', notes: d.notes || '',
  });
  const isDelivery = f.values.type === 'DELIVERY';
  const locked = ['OUT_FOR_DELIVERY', 'READY_FOR_COLLECTION'].includes(order.status);
  const onSubmit = (e) => {
    e.preventDefault();
    f.submit(async (v) => {
      const res = await orderApi.updateDelivery(order.id, { ...v, assignedStaffId: v.assignedStaffId ? Number(v.assignedStaffId) : undefined });
      toast.success('Delivery details saved');
      onDone(res.order);
    }, (v) => ({
      recipientName: v.recipientName.trim().length >= 2 ? undefined : 'Required',
      contactPhone: isPhone(v.contactPhone) ? undefined : 'Enter a valid phone number',
      address: !isDelivery || v.address.trim().length >= 5 ? undefined : 'Delivery address is required',
      city: !isDelivery || v.city.trim().length >= 2 ? undefined : 'City is required',
    }));
  };
  return (
    <Modal title="Delivery / collection details" onClose={onClose} size="lg">
      <form className="stack" onSubmit={onSubmit} noValidate>
        <Alert>{f.formError}</Alert>
        <div className="segmented" role="group" aria-label="Method">
          {[['DELIVERY', 'Home delivery'], ['COLLECTION', 'Collect from shop']].map(([v, l]) => (
            <button type="button" key={v} aria-pressed={f.values.type === v} disabled={locked && v !== order.fulfillment_type} onClick={() => f.set('type', v)}>{l}</button>
          ))}
        </div>
        {f.values.type !== order.fulfillment_type && f.values.type === 'COLLECTION' && order.delivery_fee > 0 && (
          <Alert type="info">Switching to collection removes the delivery fee of {formatLKR(order.delivery_fee)} from the total.</Alert>
        )}
        <div className="form-grid">
          <Field label={isDelivery ? 'Recipient name' : 'Collected by'} required {...f.bind('recipientName')} />
          <Field label="Contact phone" type="tel" required {...f.bind('contactPhone')} />
          {isDelivery && <Field className="full" label="Address" required {...f.bind('address')} />}
          {isDelivery && <Field label="City" required {...f.bind('city')} />}
          <Field label={isDelivery ? 'Delivery date' : 'Collection date'} type="date" min={isoDate(0)} {...f.bind('scheduledDate')} hint={`Customer needs it on ${formatDate(order.event_date)}`} />
          <Field as="select" label="Time slot" {...f.bind('scheduledTimeSlot')}>
            <option value="">Not set</option>
            {[...new Set([...TIME_SLOTS, d.scheduled_time_slot].filter(Boolean))].map((t) => <option key={t}>{t}</option>)}
          </Field>
          {isDelivery && (
            <Field as="select" label="Assigned staff" {...f.bind('assignedStaffId')}>
              <option value="">Unassigned</option>
              {(staff.data?.data || []).map((s) => <option key={s.id} value={s.id}>{s.full_name} ({s.role_name})</option>)}
            </Field>
          )}
          <Field className="full" label="Notes" maxLength={255} {...f.bind('notes')} />
        </div>
        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <SubmitButton busy={f.submitting}>Save details</SubmitButton>
        </div>
      </form>
    </Modal>
  );
}

const NEXT_LABEL = {
  IN_PREPARATION: 'Start preparation', READY: 'Mark as ready', OUT_FOR_DELIVERY: 'Send out for delivery',
  READY_FOR_COLLECTION: 'Ready for collection', COMPLETED: 'Complete order', CANCELLED: 'Cancel order', REJECTED: 'Reject order',
};

// US16, US17, US19–US23 - Staff order management
export default function OrderDetail() {
  const { id } = useParams();
  const { can } = useStaffAuth();
  const { data, loading, error, reload, setData } = useAsync(() => orderApi.get(id), [id]);
  const [modal, setModal] = useState(null);

  if (loading && !data) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  const o = data.order;
  const done = (order) => { setModal(null); setData({ order }); };
  const forward = o.allowed_next_statuses.filter((s) => !['CANCELLED', 'REJECTED'].includes(s) && !(o.status === 'OUT_FOR_DELIVERY' && s === 'READY'));
  const backward = o.allowed_next_statuses.filter((s) => ['CANCELLED', 'REJECTED'].includes(s));
  const closed = ['COMPLETED', 'CANCELLED', 'REJECTED'].includes(o.status);
  const editable = ['PENDING', 'CONFIRMED', 'IN_PREPARATION'].includes(o.status);
  const completeBlocked = forward.includes('COMPLETED') && o.payment_status !== 'PAID';

  return (
    <>
      <PageHead title={`Order ${o.order_number}`} crumb={<Link to="/staff/orders">Orders</Link>}
        sub={`Placed ${formatDateTime(o.created_at)} · Needed ${formatDate(o.event_date)} · ${o.fulfillment_type === 'DELIVERY' ? 'Delivery' : 'Collection'}`}>
        <StatusBadge status={o.status} /><StatusBadge status={o.payment_status} />
      </PageHead>

      <div className="card mb-2">
        {['CANCELLED', 'REJECTED'].includes(o.status)
          ? <Alert>Order {statusLabel(o.status).toLowerCase()}{o.cancel_reason ? `: ${o.cancel_reason}` : ''}</Alert>
          : <OrderProgress order={o} />}
        {!closed && (
          <div className="row mt-2">
            {o.status === 'PENDING' && (
              <Can perm="orders.confirm"><button className="btn btn-success" onClick={() => setModal({ type: 'confirm' })}>Confirm order</button></Can>
            )}
            <Can perm="orders.update">
              {forward.map((s) => (
                <button key={s} className="btn btn-primary" disabled={s === 'COMPLETED' && completeBlocked}
                  title={s === 'COMPLETED' && completeBlocked ? 'The order must be fully paid first' : ''} onClick={() => setModal({ type: 'status', target: s })}>
                  {NEXT_LABEL[s]}
                </button>
              ))}
              {editable && <button className="btn btn-secondary" onClick={() => setModal({ type: 'edit' })}>Edit details</button>}
              {backward.map((s) => <button key={s} className="btn btn-ghost danger-text" onClick={() => setModal({ type: 'status', target: s })}>{NEXT_LABEL[s]}</button>)}
            </Can>
            {completeBlocked && <span className="text-sm muted">Record the remaining payment to complete this order.</span>}
          </div>
        )}
      </div>

      <div className="detail-layout">
        <div className="stack">
          <section className="card card-flush">
            <div className="card-header"><h2>Items</h2></div>
            {o.items.length === 0 ? <p className="muted" style={{ padding: '0 1.25rem 1rem' }}>No catalogue items — custom cake only.</p> : (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Product</th><th className="num">Price</th><th className="num">Qty</th><th className="num">Total</th></tr></thead>
                  <tbody>
                    {o.items.map((i) => (
                      <tr key={i.id}>
                        <td>
                          <div className="row" style={{ flexWrap: 'nowrap' }}>
                            <img src={imageUrl(i.image_url, i.product_type)} alt="" className="table-thumb" />
                            <div><div className="cell-title">{i.product_name}</div><div className="cell-sub">{i.product_type === 'CAKE' ? 'Cake' : 'Decoration'}{i.notes ? ` · “${i.notes}”` : ''}</div></div>
                          </div>
                        </td>
                        <td className="num">{formatLKR(i.unit_price)}</td>
                        <td className="num">{i.quantity}</td>
                        <td className="num">{formatLKR(i.line_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {o.stock_deducted && <p className="text-xs muted" style={{ padding: '0 1.25rem 1rem', margin: 0 }}>✓ Stock reserved for these items</p>}
          </section>

          {o.cakeRequirement && <section className="card"><h2>Custom cake requirements</h2><CakeRequirementView cake={o.cakeRequirement} /></section>}

          <section className="card">
            <div className="card-header">
              <h2>{o.fulfillment_type === 'DELIVERY' ? 'Delivery' : 'Collection'}</h2>
              <div className="row">
                {o.delivery && <StatusBadge status={o.delivery.status} />}
                {!closed && can('deliveries.manage') && <button className="btn btn-sm btn-secondary" onClick={() => setModal({ type: 'delivery' })}>Edit / schedule</button>}
              </div>
            </div>
            <DeliveryView delivery={o.delivery} eventDate={o.event_date} />
          </section>

          <section className="card">
            <div className="card-header">
              <h2>Payments</h2>
              <Can perm="payments.manage">
                <div className="row">
                  {o.status !== 'PENDING' && (o.amount_paid > 0 || o.payment_status !== 'UNPAID') && <button className="btn btn-sm btn-ghost" onClick={() => setModal({ type: 'paymentStatus' })}>Change status</button>}
                  {!['PENDING', 'CANCELLED', 'REJECTED'].includes(o.status) && o.balance_due > 0 && o.payment_status !== 'REFUNDED' && (
                    <button className="btn btn-sm btn-primary" onClick={() => setModal({ type: 'payment' })}>Record payment</button>
                  )}
                </div>
              </Can>
            </div>
            {o.status === 'PENDING' && <p className="text-sm muted">Payments can be recorded once the order is confirmed and the total is final.</p>}
            {o.payments.length === 0 ? <p className="muted mb-0">No payments recorded.</p> : (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Date</th><th>Method</th><th>Reference</th><th>Recorded by</th><th className="num">Amount</th></tr></thead>
                  <tbody>
                    {o.payments.map((p) => (
                      <tr key={p.id}>
                        <td className="text-sm">{formatDateTime(p.paid_at)}</td>
                        <td>{methodLabel(p.method)}{p.notes && <div className="cell-sub">{p.notes}</div>}</td>
                        <td className="text-sm">{p.reference_no || '—'}</td>
                        <td className="text-sm">{p.recorded_by_name || '—'}</td>
                        <td className="num strong">{formatLKR(p.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <div className="stack">
          <section className="card">
            <h2>Customer</h2>
            <dl className="kv">
              <dt>Name</dt><dd>{can('customers.view') ? <Link to={`/staff/customers/${o.customer_id}`}>{o.customer_name}</Link> : o.customer_name}</dd>
              <dt>Phone</dt><dd><a href={`tel:${o.customer_phone}`}>{o.customer_phone}</a></dd>
              <dt>Email</dt><dd>{o.customer_email}</dd>
              {o.customer_address && <><dt>Address</dt><dd>{o.customer_address}{o.customer_city ? `, ${o.customer_city}` : ''}</dd></>}
            </dl>
            {o.customer_notes && <><hr /><h3>Customer notes</h3><p className="mb-0">{o.customer_notes}</p></>}
            {o.staff_notes && <><hr /><h3>Staff notes</h3><p className="mb-0">{o.staff_notes}</p></>}
          </section>
          <section className="card"><h2>Totals</h2><OrderTotals order={o} />
            {o.confirmed_by_name && <p className="text-xs muted mt-1 mb-0">Confirmed by {o.confirmed_by_name} on {formatDateTime(o.confirmed_at)}</p>}
          </section>
          <section className="card"><h2>History</h2><OrderTimeline history={o.history} showStaff /></section>
        </div>
      </div>

      {modal?.type === 'confirm' && <ConfirmModal order={o} onClose={() => setModal(null)} onDone={done} />}
      {modal?.type === 'status' && <StatusModal order={o} target={modal.target} onClose={() => setModal(null)} onDone={done} />}
      {modal?.type === 'edit' && <EditOrderModal order={o} onClose={() => setModal(null)} onDone={done} />}
      {modal?.type === 'payment' && <PaymentModal order={o} onClose={() => setModal(null)} onDone={done} />}
      {modal?.type === 'paymentStatus' && <PaymentStatusModal order={o} onClose={() => setModal(null)} onDone={done} />}
      {modal?.type === 'delivery' && <DeliveryModal order={o} onClose={() => setModal(null)} onDone={done} />}
    </>
  );
}
