import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { myApi } from '../../api';
import { useAsync } from '../../utils/useAsync';
import { useToast } from '../../context/ToastContext';
import { formatDate, formatDateTime, formatLKR, imageUrl, paymentLabel, statusLabel } from '../../utils/format';
import { ConfirmDialog, Empty, Field, Loading, StatusBadge } from '../../components/ui';
import { CakeRequirementView, DeliveryView, OrderProgress, OrderTimeline, OrderTotals } from '../../components/OrderViews';
import PayOnline from '../../components/PayOnline';

// US18 / US24 - Order status, progress and history for the customer
export default function MyOrderDetail() {
  const { id } = useParams();
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(() => myApi.order(id), [id]);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [paying, setPaying] = useState(false);

  if (loading && !data) return <Loading />;
  if (error) return <Empty icon="📦" title="Order not found"><Link to="/my/orders">Back to my orders</Link></Empty>;
  const o = data.order;

  const cancel = async () => {
    setBusy(true);
    try {
      await myApi.cancelOrder(o.id, reason.trim() || undefined);
      toast.success('Your order was cancelled');
      setCancelling(false);
      reload();
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <Link to="/my/orders" className="text-sm">← My orders</Link>
      <div className="row-between">
        <div>
          <h1 className="mb-0">Order {o.order_number}</h1>
          <div className="muted text-sm">Placed {formatDateTime(o.created_at)}</div>
        </div>
        <div className="row"><StatusBadge status={o.status} /><StatusBadge status={o.payment_status} /></div>
      </div>

      <div className="card">
        {['CANCELLED', 'REJECTED'].includes(o.status) ? (
          <div className="alert alert-error">This order was {statusLabel(o.status).toLowerCase()}.{o.cancel_reason ? ` Reason: ${o.cancel_reason}` : ''}</div>
        ) : (
          <>
            <OrderProgress order={o} />
            {o.status === 'PENDING' && (
              <div className="alert alert-info mt-2">
                We’re reviewing your order. {o.cakeRequirement ? 'We will confirm the custom cake price shortly. ' : ''}
                {o.card_on_file ? `Your ${o.card_on_file.card_brand} card ending ${o.card_on_file.card_last4} will be charged when we confirm the final total. ` : ''}
                You can cancel it until it is confirmed.
              </div>
            )}
            {o.awaiting_prepayment && (
              <div className="alert alert-warning mt-2 pay-callout">
                <span>
                  <strong>Payment needed to secure your {o.is_custom_cake ? 'cake' : 'order'}.</strong>{' '}
                  {o.is_custom_cake ? 'Custom cakes are pre-orders: we start baking once it is paid.' : 'We start preparing it once it is paid.'}
                  {o.last_payment_error && <span className="text-sm" style={{ display: 'block' }}>We couldn’t charge your {o.last_payment_error}</span>}
                </span>
                <button type="button" className="btn btn-primary" onClick={() => setPaying(true)}>Pay {formatLKR(o.balance_due)} now</button>
              </div>
            )}
          </>
        )}
      </div>

      <div className="detail-layout">
        <div className="stack">
          {o.items.length > 0 && (
            <section className="card card-flush">
              <div className="card-header"><h2>Items</h2></div>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Product</th><th className="num">Price</th><th className="num">Qty</th><th className="num">Total</th></tr></thead>
                  <tbody>
                    {o.items.map((i) => (
                      <tr key={i.id}>
                        <td>
                          <div className="row" style={{ flexWrap: 'nowrap' }}>
                            <img src={imageUrl(i.image_url, i.product_type)} alt="" className="table-thumb" />
                            <div><div className="cell-title">{i.product_name}</div>{i.notes && <div className="cell-sub">“{i.notes}”</div>}</div>
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
            </section>
          )}
          {o.cakeRequirement && (
            <section className="card"><h2>Custom cake</h2><CakeRequirementView cake={o.cakeRequirement} /></section>
          )}
          <section className="card"><h2>{o.fulfillment_type === 'DELIVERY' ? 'Delivery' : 'Collection'}</h2><DeliveryView delivery={o.delivery} eventDate={o.event_date} /></section>
          {o.customer_notes && <section className="card"><h2>Your notes</h2><p className="mb-0">{o.customer_notes}</p></section>}
        </div>
        <div className="stack">
          <section className="card">
            <h2>Payment</h2>
            <p className="text-sm muted">
              {o.payment_option === 'ONLINE'
                ? (o.is_custom_cake ? 'Pre-order · paid online in advance' : 'Paid online by card')
                : `Cash on ${o.fulfillment_type === 'DELIVERY' ? 'delivery' : 'collection'}`}
              {o.card_on_file && ` · ${o.card_on_file.card_brand} •••• ${o.card_on_file.card_last4}`}
            </p>
            <OrderTotals order={o} />
            {o.can_pay_online && (
              <button type="button" className={`btn btn-block mt-2 ${o.payment_option === 'ONLINE' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setPaying(true)}>
                {o.payment_option === 'ONLINE' ? `Pay ${formatLKR(o.balance_due)} online` : `Pay ${formatLKR(o.balance_due)} online instead`}
              </button>
            )}
            {o.payments.length > 0 && (
              <>
                <hr />
                <h3>Payments{o.amount_refunded > 0 ? ' and refunds' : ''}</h3>
                {o.payments.map((p) => (
                  <div className="summary-line text-sm" key={p.id}>
                    <span>{formatDate(p.paid_at)} · {p.kind === 'REFUND' ? 'Refund' : paymentLabel(p)}{p.kind === 'REFUND' && p.card_last4 ? ` to •••• ${p.card_last4}` : ''}</span>
                    <span>{p.kind === 'REFUND' ? `− ${formatLKR(p.amount)}` : formatLKR(p.amount)}</span>
                  </div>
                ))}
              </>
            )}
          </section>
          <section className="card">
            <h2>Order updates</h2>
            <OrderTimeline history={o.history} />
          </section>
          {o.status === 'PENDING' && (
            <button type="button" className="btn btn-secondary btn-block" onClick={() => setCancelling(true)}>Cancel this order</button>
          )}
        </div>
      </div>

      {paying && (
        <PayOnline order={o} onClose={() => setPaying(false)} onStale={reload}
          onPaid={() => { setPaying(false); toast.success('Payment received. Thank you!'); reload(); }} />
      )}
      {cancelling && (
        <ConfirmDialog title="Cancel order?" message={`Order ${o.order_number} will be cancelled. This cannot be undone.`}
          confirmLabel="Cancel order" danger busy={busy} onConfirm={cancel} onClose={() => setCancelling(false)}>
          <Field className="mt-2" label="Reason (optional)" value={reason} maxLength={255} onChange={(e) => setReason(e.target.value)} />
        </ConfirmDialog>
      )}
    </div>
  );
}
