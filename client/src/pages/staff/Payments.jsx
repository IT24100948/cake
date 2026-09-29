import { useState } from 'react';
import { Link } from 'react-router-dom';
import { paymentApi } from '../../api';
import { useAsync, useDebounced } from '../../utils/useAsync';
import { formatDateTime, formatLKR, methodLabel, PAYMENT_METHODS } from '../../utils/format';
import { Empty, ErrorState, Loading, Pagination, StatusBadge } from '../../components/ui';
import { PageHead } from '../../layouts/StaffLayout';

// US20 / US21 - Payment records
export default function Payments() {
  const [f, setF] = useState({ search: '', method: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const search = useDebounced(f.search);
  const list = useAsync(() => paymentApi.list({ ...f, search, page }), [search, f.method, f.from, f.to, page]);
  const set = (k, v) => { setF((x) => ({ ...x, [k]: v })); setPage(1); };
  return (
    <>
      <PageHead title="Payments" crumb="Orders" sub="All payments recorded against orders. Record new payments from the order page." />
      <div className="card card-flush">
        <div className="toolbar" style={{ padding: '1rem 1rem 0' }}>
          <input className="input search" type="search" placeholder="Order number, customer or reference" value={f.search} onChange={(e) => set('search', e.target.value)} aria-label="Search payments" />
          <select className="select" value={f.method} onChange={(e) => set('method', e.target.value)} aria-label="Method">
            <option value="">All methods</option>{PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <input className="input" type="date" value={f.from} onChange={(e) => set('from', e.target.value)} aria-label="From" />
          <input className="input" type="date" value={f.to} onChange={(e) => set('to', e.target.value)} aria-label="To" />
          {list.data && <span className="strong" style={{ marginLeft: 'auto' }}>Total: {formatLKR(list.data.totalAmount)}</span>}
        </div>
        {list.loading && !list.data && <Loading />}
        {list.error && <div style={{ padding: '1rem' }}><ErrorState error={list.error} onRetry={list.reload} /></div>}
        {list.data && (list.data.data.length === 0 ? <Empty icon="💳" title="No payments found" /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Date</th><th>Order</th><th>Customer</th><th>Method</th><th>Reference</th><th>Recorded by</th><th>Order payment</th><th className="num">Amount</th></tr></thead>
              <tbody>
                {list.data.data.map((p) => (
                  <tr key={p.id}>
                    <td className="text-sm nowrap">{formatDateTime(p.paid_at)}</td>
                    <td><Link to={`/staff/orders/${p.order_id}`}>{p.order_number}</Link></td>
                    <td>{p.customer_name}</td>
                    <td>{methodLabel(p.method)}{p.notes && <div className="cell-sub">{p.notes}</div>}</td>
                    <td className="text-sm">{p.reference_no || '—'}</td>
                    <td className="text-sm">{p.recorded_by_name || '—'}</td>
                    <td><StatusBadge status={p.payment_status} /></td>
                    <td className="num strong">{formatLKR(p.amount)}</td>
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
