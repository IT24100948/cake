import { useState } from 'react';
import { Link } from 'react-router-dom';
import { deliveryApi } from '../../api';
import { useToast } from '../../context/ToastContext';
import { useAsync, useDebounced } from '../../utils/useAsync';
import { formatDate, isoDate, statusLabel } from '../../utils/format';
import { Empty, ErrorState, Field, Loading, Modal, Pagination, StatusBadge, SubmitButton } from '../../components/ui';
import { PageHead } from '../../layouts/StaffLayout';

/** Next delivery-board actions for a record, based on its type and the order status. */
function actionsFor(d) {
  if (['DELIVERED', 'COLLECTED'].includes(d.status)) return [];
  if (d.type === 'DELIVERY') {
    if (d.order_status === 'OUT_FOR_DELIVERY') return ['DELIVERED', 'FAILED'];
    if (d.order_status === 'READY') return ['OUT_FOR_DELIVERY'];
  } else {
    if (d.order_status === 'READY_FOR_COLLECTION') return ['COLLECTED'];
    if (d.order_status === 'READY') return ['READY_FOR_COLLECTION'];
  }
  return [];
}

const LABEL = { OUT_FOR_DELIVERY: 'Out for delivery', DELIVERED: 'Delivered', FAILED: 'Failed attempt', READY_FOR_COLLECTION: 'Ready for pickup', COLLECTED: 'Collected' };

// US22 / US23 - Delivery and collection board
export default function Deliveries() {
  const toast = useToast();
  const [f, setF] = useState({ search: '', type: '', status: 'OPEN', from: isoDate(-1), to: '' });
  const [page, setPage] = useState(1);
  const [action, setAction] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const search = useDebounced(f.search);
  const list = useAsync(() => deliveryApi.list({ ...f, search, page }), [search, f.type, f.status, f.from, f.to, page]);
  const set = (k, v) => { setF((x) => ({ ...x, [k]: v })); setPage(1); };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await deliveryApi.setStatus(action.d.id, { status: action.status, note: note.trim() || undefined });
      toast.success(`${action.d.order_number}: ${LABEL[action.status]}`);
      setAction(null);
      setNote('');
      list.reload();
    } catch (err) { toast.error(err); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHead title="Delivery & collection" crumb="Orders" sub="Schedule and track deliveries and shop collections for confirmed orders." />
      <div className="card card-flush">
        <div className="toolbar" style={{ padding: '1rem 1rem 0' }}>
          <input className="input search" type="search" placeholder="Order, recipient, phone or city" value={f.search} onChange={(e) => set('search', e.target.value)} aria-label="Search" />
          <select className="select" value={f.type} onChange={(e) => set('type', e.target.value)} aria-label="Type">
            <option value="">Delivery & collection</option><option value="DELIVERY">Deliveries</option><option value="COLLECTION">Collections</option>
          </select>
          <select className="select" value={f.status} onChange={(e) => set('status', e.target.value)} aria-label="Status">
            <option value="OPEN">Open</option><option value="">All</option>
            {['PENDING', 'SCHEDULED', 'OUT_FOR_DELIVERY', 'READY_FOR_COLLECTION', 'DELIVERED', 'COLLECTED', 'FAILED'].map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
          </select>
          <label className="text-sm muted row" style={{ gap: '0.35rem' }}>Date
            <input className="input" type="date" value={f.from} onChange={(e) => set('from', e.target.value)} aria-label="From" />–
            <input className="input" type="date" value={f.to} onChange={(e) => set('to', e.target.value)} aria-label="To" />
          </label>
          <button className="btn btn-sm btn-ghost" onClick={() => set('from', '')}>Show earlier</button>
        </div>
        {list.loading && !list.data && <Loading />}
        {list.error && <div style={{ padding: '1rem' }}><ErrorState error={list.error} onRetry={list.reload} /></div>}
        {list.data && (list.data.data.length === 0 ? <Empty icon="🚚" title="Nothing scheduled here">Confirmed orders appear on this board.</Empty> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Date</th><th>Order</th><th>Type</th><th>Recipient</th><th>Assigned</th><th>Status</th><th className="actions">Update</th></tr></thead>
              <tbody>
                {list.data.data.map((d) => (
                  <tr key={d.id}>
                    <td className="nowrap">
                      <div className="cell-title">{formatDate(d.scheduled_date || d.event_date)}</div>
                      <div className="cell-sub">{d.scheduled_date ? d.scheduled_time_slot || 'Any time' : 'Not scheduled'}</div>
                    </td>
                    <td><Link to={`/staff/orders/${d.order_id}`}>{d.order_number}</Link><div className="cell-sub"><StatusBadge status={d.order_status} /> <StatusBadge status={d.payment_status} /></div></td>
                    <td>{d.type === 'DELIVERY' ? 'Delivery' : 'Collection'}</td>
                    <td><div>{d.recipient_name} · {d.contact_phone}</div>{d.type === 'DELIVERY' && <div className="cell-sub">{d.address}, {d.city}</div>}</td>
                    <td className="text-sm">{d.assigned_staff_name || (d.type === 'DELIVERY' ? <span className="muted">Unassigned</span> : '—')}</td>
                    <td><StatusBadge status={d.status} /></td>
                    <td className="actions">
                      {actionsFor(d).map((s) => (
                        <button key={s} className={`btn btn-sm ${s === 'FAILED' ? 'btn-ghost' : 'btn-primary'}`} disabled={['DELIVERED', 'COLLECTED'].includes(s) && d.payment_status !== 'PAID'}
                          title={['DELIVERED', 'COLLECTED'].includes(s) && d.payment_status !== 'PAID' ? 'Order must be fully paid' : ''}
                          onClick={() => setAction({ d, status: s })}>{LABEL[s]}</button>
                      ))}
                      <Link className="btn btn-sm btn-ghost" to={`/staff/orders/${d.order_id}`}>Open</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        <Pagination meta={list.data?.meta} onPage={setPage} />
      </div>
      {action && (
        <Modal title={`${action.d.order_number}: ${LABEL[action.status]}`} onClose={() => setAction(null)}>
          <form className="stack" onSubmit={submit}>
            <p className="muted mb-0">
              {['DELIVERED', 'COLLECTED'].includes(action.status) ? 'This completes the order and notifies the customer.'
                : action.status === 'FAILED' ? 'The order returns to “Ready” so it can be sent out again.' : 'The customer will be notified.'}
            </p>
            <Field as="textarea" label="Note (optional)" maxLength={255} value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setAction(null)}>Cancel</button>
              <SubmitButton busy={busy}>Update</SubmitButton>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
