import { useState } from 'react';
import { Link } from 'react-router-dom';
import { myApi } from '../../api';
import { useAsync } from '../../utils/useAsync';
import { formatDateTime } from '../../utils/format';
import { Empty, ErrorState, Loading, Pagination } from '../../components/ui';

// US24 - Receive order status information
export default function Notifications() {
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const { data, loading, error, reload, setData } = useAsync(() => myApi.notifications({ page, unread: unreadOnly ? 'true' : '' }), [page, unreadOnly]);

  const markAll = async () => { await myApi.markAllRead(); reload(); };
  const markOne = async (n) => {
    if (n.is_read) return;
    await myApi.markRead(n.id);
    setData((d) => ({ ...d, data: d.data.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)) }));
  };

  return (
    <div className="stack" style={{ maxWidth: 760, margin: '0 auto' }}>
      <div className="row-between">
        <h1 className="mb-0">Notifications</h1>
        <div className="row">
          <label className="checkbox"><input type="checkbox" checked={unreadOnly} onChange={(e) => { setUnreadOnly(e.target.checked); setPage(1); }} /> Unread only</label>
          <button type="button" className="btn btn-secondary btn-sm" onClick={markAll}>Mark all as read</button>
        </div>
      </div>
      {loading && <Loading />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && data.data.length === 0 && <Empty icon="🔔" title="You're all caught up">Order updates will appear here.</Empty>}
      {data && data.data.length > 0 && (
        <div className="card card-flush">
          {data.data.map((n) => (
            <Link key={n.id} to={n.order_id ? `/my/orders/${n.order_id}` : '#'} className={`notif-item${n.is_read ? '' : ' unread'}`} onClick={() => markOne(n)}>
              <div className="row-between"><span className="n-title">{n.title}</span><span className="n-time">{formatDateTime(n.created_at)}</span></div>
              <div>{n.message}</div>
            </Link>
          ))}
          <Pagination meta={data.meta} onPage={setPage} />
        </div>
      )}
    </div>
  );
}
