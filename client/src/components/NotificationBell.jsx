import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { myApi } from '../api';
import { timeAgo } from '../utils/format';
import Icon from './Icons';

/** Customer notification bell (US24). Polls the unread count every 30 seconds. */
export default function NotificationBell() {
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(null);
  const ref = useRef(null);
  const location = useLocation();

  const refreshCount = useCallback(() => myApi.unreadCount().then((r) => setCount(r.count)).catch(() => {}), []);

  useEffect(() => {
    refreshCount();
    const t = setInterval(refreshCount, 30000);
    return () => clearInterval(t);
  }, [refreshCount, location.pathname]);

  useEffect(() => {
    if (!open) return undefined;
    myApi.notifications({ limit: 8 }).then((r) => setItems(r.data)).catch(() => setItems([]));
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  useEffect(() => setOpen(false), [location.pathname]);

  const markAll = async () => {
    await myApi.markAllRead();
    setItems((cur) => cur?.map((n) => ({ ...n, is_read: true })));
    setCount(0);
  };

  const openItem = (n) => {
    if (!n.is_read) myApi.markRead(n.id).then(refreshCount).catch(() => {});
  };

  return (
    <div className="dropdown" ref={ref}>
      <button type="button" className="icon-btn" onClick={() => setOpen((o) => !o)} aria-label={`Notifications${count ? `, ${count} unread` : ''}`} aria-expanded={open}>
        <Icon name="bell" />
        {count > 0 && <span className="dot-count">{count > 9 ? '9+' : count}</span>}
      </button>
      {open && (
        <div className="dropdown-menu notif-panel">
          <div className="head">
            <strong>Notifications</strong>
            {count > 0 && <button type="button" className="link-btn text-sm" onClick={markAll}>Mark all read</button>}
          </div>
          <div className="notif-list">
            {items === null && <div className="empty text-sm">Loading…</div>}
            {items?.length === 0 && <div className="empty text-sm">No notifications yet</div>}
            {items?.map((n) => (
              <Link key={n.id} to={n.order_id ? `/my/orders/${n.order_id}` : '/notifications'} className={`notif-item${n.is_read ? '' : ' unread'}`} onClick={() => openItem(n)}>
                <div className="n-title">{n.title}</div>
                <div>{n.message}</div>
                <div className="n-time">{timeAgo(n.created_at)}</div>
              </Link>
            ))}
          </div>
          <Link to="/notifications" className="notif-item text-center strong">View all notifications</Link>
        </div>
      )}
    </div>
  );
}
