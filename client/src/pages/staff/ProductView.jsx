import { Link, useParams } from 'react-router-dom';
import { inventoryApi, productApi } from '../../api';
import { useStaffAuth } from '../../context/StaffAuthContext';
import { useAsync } from '../../utils/useAsync';
import { formatDateTime, formatLKR, imageUrl } from '../../utils/format';
import { ErrorState, Loading } from '../../components/ui';
import { Can } from '../../components/Guards';
import { PageHead } from '../../layouts/StaffLayout';

// US08 - Product detail for staff
export default function ProductView() {
  const { id } = useParams();
  const { can } = useStaffAuth();
  const { data, loading, error, reload } = useAsync(() => productApi.get(id), [id]);
  const hist = useAsync(() => (can('inventory.manage') ? inventoryApi.history(id, { limit: 8 }) : Promise.resolve(null)), [id]);
  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  const p = data.product;
  return (
    <>
      <PageHead title={p.name} crumb={<Link to="/staff/products">Products</Link>}>
        <Can perm="products.manage"><Link to={`/staff/products/${p.id}/edit`} className="btn btn-primary">Edit product</Link></Can>
      </PageHead>
      <div className="detail-layout">
        <div className="card">
          <div className="grid-2">
            <img src={imageUrl(p.image_url)} alt={p.name} style={{ borderRadius: 12, border: '1px solid var(--border)' }} />
            <dl className="kv">
              <dt>SKU</dt><dd>{p.sku}</dd>
              <dt>Type</dt><dd>{p.product_type === 'CAKE' ? 'Cake' : 'Party decoration'}</dd>
              <dt>Category</dt><dd>{p.category_name}</dd>
              <dt>Price</dt><dd>{formatLKR(p.price)}</dd>
              <dt>Stock</dt><dd>{p.stock_quantity} {p.is_low_stock && <span className="badge badge-warning">Low stock</span>}</dd>
              <dt>Reorder level</dt><dd>{p.reorder_level}</dd>
              <dt>Availability</dt><dd>{p.is_available ? <span className="badge badge-success">Available</span> : <span className="badge">Unavailable</span>}</dd>
              <dt>Last updated</dt><dd>{formatDateTime(p.updated_at)}</dd>
            </dl>
          </div>
          <hr />
          <h3>Description</h3>
          <p className="mb-0">{p.description || <span className="muted">No description</span>}</p>
        </div>
        {hist.data && (
          <div className="card">
            <div className="card-header"><h3>Recent stock movements</h3><Link to="/staff/inventory" className="text-sm">Inventory →</Link></div>
            {hist.data.data.length === 0 ? <p className="muted">No stock movements yet.</p> : (
              <ul className="timeline">
                {hist.data.data.map((h) => (
                  <li key={h.id}>
                    <div className="t-title">{h.change_qty > 0 ? '+' : ''}{h.change_qty} → {h.balance_after}</div>
                    <div className="t-meta">{formatDateTime(h.created_at)} · {h.type.replace('_', ' ').toLowerCase()}{h.staff_name ? ` · ${h.staff_name}` : ''}</div>
                    {(h.reason || h.order_number) && <div className="t-note">{h.reason}</div>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </>
  );
}
