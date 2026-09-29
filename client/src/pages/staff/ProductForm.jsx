import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { catalogApi, productApi } from '../../api';
import { useToast } from '../../context/ToastContext';
import { useAsync, useForm } from '../../utils/useAsync';
import { Alert, ErrorState, Field, Loading, SubmitButton } from '../../components/ui';
import ImageUpload from '../../components/ImageUpload';
import { PageHead } from '../../layouts/StaffLayout';

// US07 - Add products; US09 - Update product information
export default function ProductForm() {
  const { id } = useParams();
  const editing = !!id;
  const toast = useToast();
  const navigate = useNavigate();
  const cats = useAsync(() => catalogApi.categories(), []);
  const existing = useAsync(() => (editing ? productApi.get(id) : Promise.resolve(null)), [id]);
  const [image, setImage] = useState(null);
  const [removeImage, setRemoveImage] = useState(false);
  const f = useForm({ name: '', sku: '', description: '', price: '', productType: 'CAKE', categoryId: '', stockQuantity: 0, reorderLevel: 5, isAvailable: true });

  useEffect(() => {
    const p = existing.data?.product;
    if (p) {
      f.setValues({ name: p.name, sku: p.sku, description: p.description || '', price: p.price, productType: p.product_type, categoryId: p.category_id, stockQuantity: p.stock_quantity, reorderLevel: p.reorder_level, isAvailable: p.is_available });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing.data]);

  if (cats.loading || existing.loading) return <Loading />;
  if (cats.error || existing.error) return <ErrorState error={cats.error || existing.error} />;
  const categories = cats.data.data.filter((c) => c.type === f.values.productType);
  const current = existing.data?.product;

  const validate = (v) => ({
    name: v.name.trim().length >= 2 ? undefined : 'Product name must be at least 2 characters',
    sku: /^[A-Za-z0-9-]{3,40}$/.test(v.sku.trim()) ? undefined : 'SKU must be 3-40 letters, numbers or dashes',
    price: Number(v.price) > 0 ? undefined : 'Enter a valid price greater than 0',
    categoryId: v.categoryId ? undefined : 'Select a category',
    stockQuantity: editing || (Number.isInteger(Number(v.stockQuantity)) && Number(v.stockQuantity) >= 0) ? undefined : 'Opening stock must be 0 or more',
    reorderLevel: Number.isInteger(Number(v.reorderLevel)) && Number(v.reorderLevel) >= 0 ? undefined : 'Reorder level must be 0 or more',
  });

  const onSubmit = (e) => {
    e.preventDefault();
    f.submit(async (v) => {
      const body = {
        name: v.name.trim(), sku: v.sku.trim(), description: v.description.trim(), price: v.price, productType: v.productType,
        categoryId: v.categoryId, reorderLevel: v.reorderLevel, isAvailable: String(!!v.isAvailable),
        ...(editing ? { removeImage: String(removeImage && !image) } : { stockQuantity: v.stockQuantity }),
      };
      const res = editing ? await productApi.update(id, body, image) : await productApi.create(body, image);
      toast.success(res.message);
      navigate(`/staff/products/${res.product.id}`);
    }, validate);
  };

  return (
    <>
      <PageHead title={editing ? `Edit ${current.name}` : 'Add product'} crumb={<Link to="/staff/products">Products</Link>} />
      <form className="card stack" onSubmit={onSubmit} noValidate style={{ maxWidth: 900 }}>
        <Alert>{f.formError}</Alert>
        <div className="form-grid">
          <Field as="select" label="Product type" required {...f.bind('productType')} onChange={(e) => { f.set('productType', e.target.value); f.set('categoryId', ''); }}>
            <option value="CAKE">Cake</option><option value="DECORATION">Party decoration</option>
          </Field>
          <Field as="select" label="Category" required {...f.bind('categoryId')}>
            <option value="">Select a category</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Field>
          <Field className="full" label="Product name" required maxLength={120} {...f.bind('name')} />
          <Field label="SKU" required maxLength={40} hint="Unique code, e.g. CK-CHOC-1KG" {...f.bind('sku')} />
          <Field label="Price (LKR)" type="number" min="0.01" step="0.01" required {...f.bind('price')} />
          <Field className="full" as="textarea" label="Description" maxLength={2000} {...f.bind('description')} />
          {editing ? (
            <Field label="Current stock" value={current.stock_quantity} disabled hint={<>Change stock from the <Link to="/staff/inventory">Inventory</Link> page</>} />
          ) : (
            <Field label="Opening stock" type="number" min="0" step="1" required {...f.bind('stockQuantity')} />
          )}
          <Field label="Reorder level" type="number" min="0" step="1" required hint="Flag as low stock at or below this quantity" {...f.bind('reorderLevel')} />
          <div className="full">
            <ImageUpload label="Product image" file={image} onChange={(file) => { setImage(file); if (file) setRemoveImage(false); }}
              currentUrl={removeImage ? null : current?.image_url} onRemoveCurrent={() => setRemoveImage(true)} error={f.errors.image} />
          </div>
          <label className="checkbox full"><input type="checkbox" checked={!!f.values.isAvailable} onChange={(e) => f.set('isAvailable', e.target.checked)} /> Available for customers to order</label>
        </div>
        <div className="form-actions">
          <Link to={editing ? `/staff/products/${id}` : '/staff/products'} className="btn btn-secondary">Cancel</Link>
          <SubmitButton busy={f.submitting}>{editing ? 'Save changes' : 'Add product'}</SubmitButton>
        </div>
      </form>
    </>
  );
}
