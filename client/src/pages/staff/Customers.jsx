import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { customerApi } from '../../api';
import { useAsync, useDebounced } from '../../utils/useAsync';
import { formatDate, formatLKR } from '../../utils/format';
import { Empty, ErrorState, Loading, Pagination, StatusBadge } from '../../components/ui';
import { PageHead } from '../../layouts/StaffLayout';

// US16 - Staff view customer details
export default function Customers() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const q = useDebounced(search);
  const list = useAsync(() => customerApi.list({ search: q, page }), [q, page]);
  return (
    <>
      <PageHead title="Customers" crumb="Orders" sub="Registered customers and their order activity." />
      <div className="card card-flush">
        <div className="toolbar" style={{ padding: '1rem 1rem 0' }}>
          <input className="input search" type="search" placeholder="Search name, email, phone or city" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} aria-label="Search customers" />
        </div>
        {list.loading && !list.data && <Loading />}
        {list.error && <div style={{ padding: '1rem' }}><ErrorState error={list.error} onRetry={list.reload} /></div>}
        {list.data && (list.data.data.length === 0 ? <Empty icon="👥" title="No customers found" /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Customer</th><th>Phone</th><th>City</th><th className="num">Orders</th><th className="num">Total ordered</th><th>Last order</th><th>Joined</th></tr></thead>
              <tbody>
                {list.data.data.map((c) => (
                  <tr key={c.id} className="clickable" onClick={() => navigate(`/staff/customers/${c.id}`)}>
                    <td><div className="cell-title">{c.full_name}</div><div className="cell-sub">{c.email}</div></td>
                    <td>{c.phone}</td>
                    <td>{c.city || '—'}</td>
                    <td className="num">{c.order_count}</td>
                    <td className="num">{formatLKR(c.total_spent)}</td>
                    <td className="text-sm">{c.last_order_at ? formatDate(c.last_order_at) : '—'}</td>
                    <td className="text-sm">{formatDate(c.created_at)}</td>
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

export function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, loading, error, reload } = useAsync(() => customerApi.get(id), [id]);
  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  const { customer: c, orders } = data;
  const active = orders.filter((o) => !['COMPLETED', 'CANCELLED', 'REJECTED'].includes(o.status));
  const spent = orders.filter((o) => !['CANCELLED', 'REJECTED'].includes(o.status)).reduce((s, o) => s + o.total_amount, 0);
  return (
    <>
      <PageHead title={c.full_name} crumb={<Link to="/staff/customers">Customers</Link>} sub={`Customer since ${formatDate(c.created_at)}`} />
      <div className="detail-layout">
        <section className="card card-flush">
          <div className="card-header"><h2>Orders ({orders.length})</h2></div>
          {orders.length === 0 ? <Empty icon="📦" title="No orders yet" /> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Order</th><th>Needed</th><th>Status</th><th>Payment</th><th className="num">Total</th></tr></thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id} className="clickable" onClick={() => navigate(`/staff/orders/${o.id}`)}>
                      <td><div className="cell-title nowrap">{o.order_number}</div><div className="cell-sub">{formatDate(o.created_at)}</div></td>
                      <td>{formatDate(o.event_date)}<div className="cell-sub">{o.fulfillment_type === 'DELIVERY' ? 'Delivery' : 'Collection'}</div></td>
                      <td><StatusBadge status={o.status} /></td>
                      <td><StatusBadge status={o.payment_status} /></td>
                      <td className="num">{formatLKR(o.total_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <div className="stack">
          <section className="card">
            <h2>Contact details</h2>
            <dl className="kv">
              <dt>Email</dt><dd><a href={`mailto:${c.email}`}>{c.email}</a></dd>
              <dt>Phone</dt><dd><a href={`tel:${c.phone}`}>{c.phone}</a></dd>
              <dt>Address</dt><dd>{c.address ? `${c.address}${c.city ? `, ${c.city}` : ''}` : '—'}</dd>
              <dt>Account</dt><dd>{c.is_active ? 'Active' : 'Disabled'}</dd>
            </dl>
          </section>
          <div className="grid-2">
            <div className="stat"><div className="stat-label">Active orders</div><div className="stat-value">{active.length}</div></div>
            <div className="stat"><div className="stat-label">Total ordered</div><div className="stat-value" style={{ fontSize: '1.15rem' }}>{formatLKR(spent)}</div></div>
          </div>
        </div>
      </div>
    </>
  );
}
