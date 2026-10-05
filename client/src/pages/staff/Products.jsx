import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { catalogApi, productApi } from '../../api';
import { useToast } from '../../context/ToastContext';
import { useAsync, useDebounced, useForm } from '../../utils/useAsync';
import { formatLKR, imageUrl } from '../../utils/format';
import { Alert, ConfirmDialog, Empty, ErrorState, Field, Loading, Modal, Pagination, SubmitButton } from '../../components/ui';
import { Can } from '../../components/Guards';
import { PageHead } from '../../layouts/StaffLayout';
import Icon from '../../components/Icons';

function Categories({ onClose }) {
  const toast = useToast();
  const cats = useAsync(() => catalogApi.categories(), []);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const f = useForm({ name: '', type: 'CAKE', description: '' });

  const startEdit = (c) => { setEditing(c); f.setValues({ name: c.name, type: c.type, description: c.description || '' }); };
  const reset = () => { setEditing(null); f.setValues({ name: '', type: 'CAKE', description: '' }); f.setErrors({}); };

  const onSubmit = (e) => {
    e.preventDefault();
    f.submit(async (v) => {
      const res = editing ? await productApi.updateCategory(editing.id, v) : await productApi.createCategory(v);
      toast.success(res.message);
      reset();
      cats.reload();
    }, (v) => ({ name: v.name.trim().length >= 2 ? undefined : 'Category name must be at least 2 characters' }));
  };

  const remove = async () => {
    try {
      await productApi.deleteCategory(deleting.id);
      toast.success('Category deleted');
      cats.reload();
    } catch (e) { toast.error(e); }
    setDeleting(null);
  };

  return (
    <Modal title="Product categories" onClose={onClose} size="lg">
      <form className="row" onSubmit={onSubmit} noValidate style={{ alignItems: 'flex-start' }}>
        <Field className="grow" label={editing ? 'Rename category' : 'New category'} {...f.bind('name')} />
        <Field as="select" label="Type" disabled={!!editing} {...f.bind('type')}><option value="CAKE">Cake</option><option value="DECORATION">Decoration</option></Field>
        <div className="field"><span className="field-label">&nbsp;</span>
          <div className="row">
            <SubmitButton busy={f.submitting}>{editing ? 'Save' : 'Add'}</SubmitButton>
            {editing && <button type="button" className="btn btn-ghost" onClick={reset}>Cancel</button>}
          </div>
        </div>
      </form>
      <Alert>{f.formError}</Alert>
      {cats.loading ? <Loading /> : (
        <div className="table-wrap mt-2">
          <table className="table">
            <thead><tr><th>Name</th><th>Type</th><th className="num">Products</th><th /></tr></thead>
            <tbody>
              {cats.data.data.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.type === 'CAKE' ? 'Cake' : 'Decoration'}</td>
                  <td className="num">{c.product_count}</td>
                  <td className="actions">
                    <button className="btn btn-sm btn-ghost" onClick={() => startEdit(c)}>Rename</button>
                    <button className="btn btn-sm btn-ghost" disabled={c.product_count > 0} title={c.product_count > 0 ? 'Category has products' : ''} onClick={() => setDeleting(c)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {deleting && <ConfirmDialog title="Delete category?" message={`“${deleting.name}” will be deleted.`} danger confirmLabel="Delete" onConfirm={remove} onClose={() => setDeleting(null)} />}
    </Modal>
  );
}

// US08 - View and search products; US09 - availability toggle
export default function Products() {
  const toast = useToast();
  const navigate = useNavigate();
  const [f, setF] = useState({ search: '', type: '', categoryId: '', availability: '', lowStock: '', sort: 'name' });
  const [page, setPage] = useState(1);
  const [showCats, setShowCats] = useState(false);
  const search = useDebounced(f.search);
  const cats = useAsync(() => catalogApi.categories(), []);
  const list = useAsync(() => productApi.list({ ...f, search, page }), [search, f.type, f.categoryId, f.availability, f.lowStock, f.sort, page]);
  const set = (k, v) => { setF((x) => ({ ...x, [k]: v, ...(k === 'type' ? { categoryId: '' } : {}) })); setPage(1); };

  const toggle = async (p) => {
    try {
      const res = await productApi.setAvailability(p.id, !p.is_available);
      toast.success(res.message);
      list.setData((d) => ({ ...d, data: d.data.map((x) => (x.id === p.id ? res.product : x)) }));
    } catch (e) { toast.error(e); }
  };

  return (
    <>
      <PageHead title="Products" crumb="Catalogue" sub="Cakes and party decorations offered to customers.">
        <Can perm="products.manage">
          <button className="btn btn-secondary" onClick={() => setShowCats(true)}>Categories</button>
          <Link to="/staff/products/new" className="btn btn-primary"><Icon name="plus" size={18} /> Add product</Link>
        </Can>
      </PageHead>
      <div className="card card-flush">
        <div className="toolbar" style={{ padding: '1rem 1rem 0' }}>
          <input className="input search" type="search" placeholder="Search by name, SKU, description or category" value={f.search} onChange={(e) => set('search', e.target.value)} aria-label="Search products" />
          <select className="select" value={f.type} onChange={(e) => set('type', e.target.value)} aria-label="Type">
            <option value="">All types</option><option value="CAKE">Cakes</option><option value="DECORATION">Decorations</option>
          </select>
          <select className="select" value={f.categoryId} onChange={(e) => set('categoryId', e.target.value)} aria-label="Category">
            <option value="">All categories</option>
            {(cats.data?.data || []).filter((c) => !f.type || c.type === f.type).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="select" value={f.availability} onChange={(e) => set('availability', e.target.value)} aria-label="Availability">
            <option value="">Any availability</option><option value="available">Available</option><option value="unavailable">Unavailable</option>
          </select>
          <label className="checkbox"><input type="checkbox" checked={f.lowStock === 'true'} onChange={(e) => set('lowStock', e.target.checked ? 'true' : '')} /> Low stock only</label>
          <select className="select" value={f.sort} onChange={(e) => set('sort', e.target.value)} aria-label="Sort">
            <option value="name">Name</option><option value="newest">Newest</option><option value="price_asc">Price ↑</option><option value="price_desc">Price ↓</option><option value="stock_asc">Stock ↑</option>
          </select>
        </div>
        {list.loading && !list.data && <Loading />}
        {list.error && <div style={{ padding: '1rem' }}><ErrorState error={list.error} onRetry={list.reload} /></div>}
        {list.data && (list.data.data.length === 0 ? <Empty icon="📦" title="No products found" /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Product</th><th>Category</th><th className="num">Price</th><th className="num">Stock</th><th>Availability</th><th className="actions" /></tr></thead>
              <tbody>
                {list.data.data.map((p) => (
                  <tr key={p.id} className={`clickable${p.is_available ? '' : ' row-muted'}`} onClick={() => navigate(`/staff/products/${p.id}`)}>
                    <td>
                      <div className="row" style={{ flexWrap: 'nowrap' }}>
                        <img src={imageUrl(p.image_url, p.product_type)} alt="" className="table-thumb" />
                        <div><div className="cell-title">{p.name}</div><div className="cell-sub">{p.sku}</div></div>
                      </div>
                    </td>
                    <td className="text-sm">{p.category_name}<div className="cell-sub">{p.product_type === 'CAKE' ? 'Cake' : 'Decoration'}</div></td>
                    <td className="num">{formatLKR(p.price)}</td>
                    <td className="num">
                      <span className={p.stock_quantity === 0 ? 'danger-text strong' : p.is_low_stock ? 'strong' : ''} style={p.is_low_stock && p.stock_quantity > 0 ? { color: 'var(--warning)' } : undefined}>{p.stock_quantity}</span>
                      {p.is_low_stock && <div className="cell-sub">{p.stock_quantity === 0 ? 'Out of stock' : 'Low stock'}</div>}
                    </td>
                    <td>{p.is_available ? <span className="badge badge-success">Available</span> : <span className="badge">Unavailable</span>}</td>
                    <td className="actions" onClick={(e) => e.stopPropagation()}>
                      <Can perm="products.manage">
                        <button className="btn btn-sm btn-ghost" onClick={() => toggle(p)}>{p.is_available ? 'Hide' : 'Show'}</button>
                        <Link className="btn btn-sm btn-secondary" to={`/staff/products/${p.id}/edit`}>Edit</Link>
                      </Can>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        <Pagination meta={list.data?.meta} onPage={setPage} />
      </div>
      {showCats && <Categories onClose={() => { setShowCats(false); cats.reload(); }} />}
    </>
  );
}
