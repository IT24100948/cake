import { useState } from 'react';
import { Link } from 'react-router-dom';
import { myApi } from '../../api';
import { useAsync } from '../../utils/useAsync';
import { formatDate, formatLKR } from '../../utils/format';
import { Empty, ErrorState, Loading, Pagination, StatusBadge } from '../../components/ui';

// US18 - View order status and order history
export default function MyOrders() {
  const [tab, setTab] = useState('active');
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useAsync(() => myApi.orders({ status: tab, page }), [tab, page]);

  return (
    <div className="stack">
      <div className="row-between"><h1 className="mb-0">My orders</h1><Link to="/shop" className="btn btn-primary">New order</Link></div>
      <div className="tabs" role="tablist">
        {[['active', 'Current orders'], ['past', 'Order history'], ['', 'All']].map(([v, l]) => (
          <button key={v} role="tab" aria-selected={tab === v} onClick={() => { setTab(v); setPage(1); }}>{l}</button>
        ))}
      </div>
      {loading && <Loading />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && data.data.length === 0 && (
        <Empty icon="📦" title={tab === 'active' ? 'No current orders' : 'No orders yet'}>
          <Link to="/shop">Start shopping</Link>
        </Empty>
      )}
      {data && data.data.length > 0 && (
        <div className="stack-sm">
          {data.data.map((o) => (
            <Link key={o.id} to={`/my/orders/${o.id}`} className="card order-card">
              <div className="row-between">
                <div>
                  <div className="strong">{o.order_number}</div>
                  <div className="text-sm muted">
                    Placed {formatDate(o.created_at)} · Needed {formatDate(o.event_date)} · {o.fulfillment_type === 'DELIVERY' ? 'Delivery' : 'Collection'}
                    {' · '}{o.item_count} item(s){o.has_custom_cake ? ' + custom cake' : ''}
                  </div>
                </div>
                <div className="row">
                  <StatusBadge status={o.status} />
                  <StatusBadge status={o.payment_status} />
                  <strong>{o.status === 'PENDING' && o.has_custom_cake ? 'Awaiting quote' : formatLKR(o.total_amount)}</strong>
                </div>
              </div>
            </Link>
          ))}
          <Pagination meta={data.meta} onPage={setPage} />
        </div>
      )}
    </div>
  );
}
