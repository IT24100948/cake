import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { orderApi } from '../../api';
import { useAsync, useDebounced } from '../../utils/useAsync';
import { formatDate, formatDateTime, formatLKR, statusLabel } from '../../utils/format';
import { Empty, ErrorState, Loading, Pagination, StatusBadge } from '../../components/ui';
import { PageHead } from '../../layouts/StaffLayout';

const TABS = ['ACTIVE', 'PENDING', 'CONFIRMED', 'IN_PREPARATION', 'READY', 'OUT_FOR_DELIVERY', 'READY_FOR_COLLECTION', 'COMPLETED', 'CANCELLED', 'REJECTED', ''];

// US16 - View orders (queue by status)
export default function Orders() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? 'ACTIVE';
  const [f, setF] = useState({ search: '', paymentStatus: '', fulfillmentType: '', eventFrom: '', eventTo: '', sort: '' });
  const [page, setPage] = useState(1);
  const search = useDebounced(f.search);
  const list = useAsync(() => orderApi.list({ ...f, search, status, page }), [search, f.paymentStatus, f.fulfillmentType, f.eventFrom, f.eventTo, f.sort, status, page]);
  const counts = list.data?.statusCounts || {};
  const activeCount = Object.entries(counts).filter(([s]) => !['COMPLETED', 'CANCELLED', 'REJECTED'].includes(s)).reduce((a, [, n]) => a + n, 0);
  const set = (k, v) => { setF((x) => ({ ...x, [k]: v })); setPage(1); };

  return (
    <>
      <PageHead title="Orders" crumb="Orders" sub="Review, confirm and progress customer orders." />
      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t || 'all'} role="tab" aria-selected={status === t} onClick={() => { setParams(t === 'ACTIVE' ? {} : { status: t }); setPage(1); }}>
            {t === 'ACTIVE' ? 'Active' : t === '' ? 'All' : statusLabel(t)}
            {t === 'ACTIVE' && activeCount > 0 && <span className="count">{activeCount}</span>}
            {t && t !== 'ACTIVE' && counts[t] > 0 && <span className="count">{counts[t]}</span>}
          </button>
        ))}
      </div>
      <div className="card card-flush">
        <div className="toolbar" style={{ padding: '1rem 1rem 0' }}>
          <input className="input search" type="search" placeholder="Order number, customer name, phone or email" value={f.search} onChange={(e) => set('search', e.target.value)} aria-label="Search orders" />
          <select className="select" value={f.paymentStatus} onChange={(e) => set('paymentStatus', e.target.value)} aria-label="Payment status">
            <option value="">Any payment</option>
            {['UNPAID', 'PARTIALLY_PAID', 'PAID', 'REFUNDED'].map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
          </select>
          <select className="select" value={f.fulfillmentType} onChange={(e) => set('fulfillmentType', e.target.value)} aria-label="Fulfilment">
            <option value="">Delivery & collection</option><option value="DELIVERY">Delivery</option><option value="COLLECTION">Collection</option>
          </select>
          <label className="text-sm muted row" style={{ gap: '0.35rem' }}>Needed
            <input className="input" type="date" value={f.eventFrom} onChange={(e) => set('eventFrom', e.target.value)} aria-label="Needed from" />
            –
            <input className="input" type="date" value={f.eventTo} onChange={(e) => set('eventTo', e.target.value)} aria-label="Needed to" />
          </label>
          <select className="select" value={f.sort} onChange={(e) => set('sort', e.target.value)} aria-label="Sort">
            <option value="">Newest first</option><option value="event">Soonest needed</option>
          </select>
        </div>
        {list.loading && !list.data && <Loading />}
        {list.error && <div style={{ padding: '1rem' }}><ErrorState error={list.error} onRetry={list.reload} /></div>}
        {list.data && (list.data.data.length === 0 ? <Empty icon="📋" title="No orders here" /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Order</th><th>Customer</th><th>Needed</th><th>Status</th><th>Payment</th><th className="num">Total</th></tr></thead>
              <tbody>
                {list.data.data.map((o) => (
                  <tr key={o.id} className="clickable" onClick={() => navigate(`/staff/orders/${o.id}`)}>
                    <td>
                      <div className="cell-title nowrap">{o.order_number}</div>
                      <div className="cell-sub">{formatDateTime(o.created_at)} · {o.item_count} item(s){o.has_custom_cake ? ' + 🎂 custom cake' : ''}</div>
                    </td>
                    <td><div>{o.customer_name}</div><div className="cell-sub">{o.customer_phone}</div></td>
                    <td className="nowrap">{formatDate(o.event_date)}<div className="cell-sub">{o.fulfillment_type === 'DELIVERY' ? 'Delivery' : 'Collection'}</div></td>
                    <td><StatusBadge status={o.status} /></td>
                    <td><StatusBadge status={o.payment_status} />{o.amount_paid > 0 && o.payment_status !== 'PAID' && <div className="cell-sub">{formatLKR(o.amount_paid)} paid</div>}</td>
                    <td className="num">{o.status === 'PENDING' && o.has_custom_cake ? <span className="muted text-sm">Quote needed</span> : formatLKR(o.total_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        <Pagination meta={list.data?.meta} onPage={setPage} />
      </div>
    </>
  );
}
