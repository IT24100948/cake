import { useState } from 'react';
import { Link } from 'react-router-dom';
import { inventoryApi } from '../../api';
import { useToast } from '../../context/ToastContext';
import { useAsync, useDebounced, useForm } from '../../utils/useAsync';
import { formatDateTime, imageUrl } from '../../utils/format';
import { Alert, Empty, ErrorState, Field, Loading, Modal, Pagination, SubmitButton } from '../../components/ui';
import { PageHead } from '../../layouts/StaffLayout';

const TYPE_LABEL = { INITIAL: 'Opening stock', RESTOCK: 'Restock', ADJUSTMENT: 'Adjustment', ORDER_DEDUCT: 'Order confirmed', ORDER_RESTORE: 'Order cancelled' };

function AdjustModal({ product, onClose, onDone }) {
  const toast = useToast();
  const f = useForm({ type: 'RESTOCK', mode: 'SET', quantity: '', reason: '' });
  const q = Number(f.values.quantity);
  const preview = f.values.quantity === '' ? null
    : f.values.type === 'RESTOCK' ? product.stock_quantity + q
      : f.values.mode === 'SET' ? q : product.stock_quantity - q;

  const onSubmit = (e) => {
    e.preventDefault();
    f.submit(async (v) => {
      const res = await inventoryApi.adjust(product.id, { ...v, quantity: Number(v.quantity), mode: v.type === 'ADJUSTMENT' ? v.mode : undefined });
      toast.success(`${product.name}: ${res.message}`);
      onDone();
    }, (v) => ({
      quantity: v.quantity === '' || !Number.isInteger(Number(v.quantity)) || Number(v.quantity) < (v.type === 'ADJUSTMENT' && v.mode === 'SET' ? 0 : 1)
        ? 'Enter a whole number' : preview < 0 ? `Only ${product.stock_quantity} in stock` : undefined,
      reason: v.reason.trim().length >= 3 ? undefined : 'Please give a reason',
    }));
  };

  return (
    <Modal title={`Update stock — ${product.name}`} onClose={onClose}>
      <form className="stack" onSubmit={onSubmit} noValidate>
        <Alert>{f.formError}</Alert>
        <div className="row-between"><span className="muted">Current stock</span><strong style={{ fontSize: '1.3rem' }}>{product.stock_quantity}</strong></div>
        <div className="segmented" role="group" aria-label="Update type">
          <button type="button" aria-pressed={f.values.type === 'RESTOCK'} onClick={() => f.set('type', 'RESTOCK')}>Restock</button>
          <button type="button" aria-pressed={f.values.type === 'ADJUSTMENT'} onClick={() => f.set('type', 'ADJUSTMENT')}>Adjust</button>
        </div>
        {f.values.type === 'ADJUSTMENT' && (
          <Field as="select" label="Adjustment" {...f.bind('mode')}>
            <option value="SET">Set counted quantity (stock take)</option>
            <option value="REMOVE">Remove damaged / expired / used stock</option>
          </Field>
        )}
        <Field label={f.values.type === 'RESTOCK' ? 'Quantity received' : f.values.mode === 'SET' ? 'Counted quantity' : 'Quantity to remove'}
          type="number" min="0" step="1" required {...f.bind('quantity')} />
        <Field label="Reason" required maxLength={255} placeholder={f.values.type === 'RESTOCK' ? 'e.g. Supplier delivery' : 'e.g. Monthly stock take'} {...f.bind('reason')} />
        {preview !== null && Number.isFinite(preview) && (
          <div className={`alert ${preview < 0 ? 'alert-error' : 'alert-info'}`}>New stock level: <strong>{preview}</strong>{preview <= product.reorder_level && preview >= 0 ? ' (low stock)' : ''}</div>
        )}
        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <SubmitButton busy={f.submitting}>Update stock</SubmitButton>
        </div>
      </form>
    </Modal>
  );
}

function HistoryModal({ product, onClose }) {
  const [page, setPage] = useState(1);
  const { data, loading } = useAsync(() => inventoryApi.history(product.id, { page }), [page]);
  return (
    <Modal title={`Stock history — ${product.name}`} onClose={onClose} size="lg">
      {loading && !data ? <Loading /> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Date</th><th>Type</th><th className="num">Change</th><th className="num">Balance</th><th>Reason / order</th><th>By</th></tr></thead>
            <tbody>
              {data.data.map((h) => (
                <tr key={h.id}>
                  <td className="text-sm nowrap">{formatDateTime(h.created_at)}</td>
                  <td>{TYPE_LABEL[h.type]}</td>
                  <td className={`num strong ${h.change_qty > 0 ? 'success-text' : 'danger-text'}`}>{h.change_qty > 0 ? '+' : ''}{h.change_qty}</td>
                  <td className="num">{h.balance_after}</td>
                  <td className="text-sm">{h.order_id ? <Link to={`/staff/orders/${h.order_id}`}>{h.order_number}</Link> : h.reason}</td>
                  <td className="text-sm">{h.staff_name || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination meta={data.meta} onPage={setPage} />
        </div>
      )}
    </Modal>
  );
}

// US10 - Manage inventory quantities
export default function Inventory() {
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [adjust, setAdjust] = useState(null);
  const [history, setHistory] = useState(null);
  const q = useDebounced(search);
  const list = useAsync(() => inventoryApi.list({ search: q, type, status, page }), [q, type, status, page]);
  const s = list.data?.summary;

  return (
    <>
      <PageHead title="Inventory" crumb="Catalogue" sub="Current stock levels. Stock is deducted automatically when an order is confirmed." />
      {s && (
        <div className="grid-4 mb-2">
          <button className="stat text-left" style={{ cursor: 'pointer', font: 'inherit' }} onClick={() => setStatus('')}><div className="stat-label">Products</div><div className="stat-value">{s.total_products}</div></button>
          <div className="stat"><div className="stat-label">Units in stock</div><div className="stat-value">{s.total_units}</div></div>
          <button className="stat stat-warn text-left" style={{ cursor: 'pointer', font: 'inherit' }} onClick={() => setStatus('low')}><div className="stat-label">Low stock</div><div className="stat-value">{s.low_stock}</div></button>
          <button className="stat text-left" style={{ cursor: 'pointer', font: 'inherit' }} onClick={() => setStatus('out')}><div className="stat-label">Out of stock</div><div className="stat-value danger-text">{s.out_of_stock}</div></button>
        </div>
      )}
      <div className="card card-flush">
        <div className="toolbar" style={{ padding: '1rem 1rem 0' }}>
          <input className="input search" type="search" placeholder="Search name or SKU" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} aria-label="Search" />
          <select className="select" value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} aria-label="Type">
            <option value="">All types</option><option value="CAKE">Cakes</option><option value="DECORATION">Decorations</option>
          </select>
          <select className="select" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Stock status">
            <option value="">All stock levels</option><option value="ok">In stock</option><option value="low">Low stock</option><option value="out">Out of stock</option>
          </select>
        </div>
        {list.loading && !list.data && <Loading />}
        {list.error && <div style={{ padding: '1rem' }}><ErrorState error={list.error} onRetry={list.reload} /></div>}
        {list.data && (list.data.data.length === 0 ? <Empty icon="📦" title="No products match" /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Product</th><th className="num">In stock</th><th className="num">Reorder at</th><th>Status</th><th>Last movement</th><th className="actions" /></tr></thead>
              <tbody>
                {list.data.data.map((p) => (
                  <tr key={p.id} className={p.is_low_stock ? 'row-warn' : ''}>
                    <td>
                      <div className="row" style={{ flexWrap: 'nowrap' }}>
                        <img src={imageUrl(p.image_url)} alt="" className="table-thumb" />
                        <div><div className="cell-title">{p.name}</div><div className="cell-sub">{p.sku} · {p.category_name}</div></div>
                      </div>
                    </td>
                    <td className="num strong" style={{ fontSize: '1.05rem' }}>{p.stock_quantity}</td>
                    <td className="num">{p.reorder_level}</td>
                    <td>{p.stock_quantity === 0 ? <span className="badge badge-danger">Out of stock</span> : p.is_low_stock ? <span className="badge badge-warning">Low stock</span> : <span className="badge badge-success">OK</span>}</td>
                    <td className="text-sm">{p.last_movement_at ? formatDateTime(p.last_movement_at) : '—'}</td>
                    <td className="actions">
                      <button className="btn btn-sm btn-ghost" onClick={() => setHistory(p)}>History</button>
                      <button className="btn btn-sm btn-primary" onClick={() => setAdjust(p)}>Update stock</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        <Pagination meta={list.data?.meta} onPage={setPage} />
      </div>
      {adjust && <AdjustModal product={adjust} onClose={() => setAdjust(null)} onDone={() => { setAdjust(null); list.reload(); }} />}
      {history && <HistoryModal product={history} onClose={() => setHistory(null)} />}
    </>
  );
}
