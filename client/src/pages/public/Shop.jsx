import { useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { catalogApi } from '../../api';
import { useAsync, useDebounced } from '../../utils/useAsync';
import { Empty, ErrorState, Loading, Pagination } from '../../components/ui';
import ProductCard from './ProductCard';

const TYPES = [{ v: '', l: 'All products' }, { v: 'CAKE', l: 'Cakes' }, { v: 'DECORATION', l: 'Party decorations' }];
const SORTS = [{ v: 'newest', l: 'Newest' }, { v: 'name', l: 'Name (A–Z)' }, { v: 'price_asc', l: 'Price: low to high' }, { v: 'price_desc', l: 'Price: high to low' }];

// US11 - Browse available cakes and party decoration products
export default function Shop() {
  const [params, setParams] = useSearchParams();
  const type = params.get('type') || '';
  const categoryId = params.get('category') || '';
  const sort = params.get('sort') || 'newest';
  const page = Number(params.get('page')) || 1;
  const [search, setSearch] = useState(params.get('q') || '');
  const debounced = useDebounced(search);

  const setParam = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (!('page' in patch)) next.delete('page');
    setParams(next, { replace: true });
  };

  useEffect(() => {
    if ((params.get('q') || '') !== debounced) setParam({ q: debounced });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const categories = useAsync(() => catalogApi.categories(), []);
  const products = useAsync(
    () => catalogApi.products({ type, categoryId, sort, page, search: params.get('q') || '', limit: 12 }),
    [type, categoryId, sort, page, params.get('q')]
  );
  const visibleCats = (categories.data?.data || []).filter((c) => !type || c.type === type);
  const title = type === 'CAKE' ? 'Cakes' : type === 'DECORATION' ? 'Party decorations' : 'All products';

  return (
    <div className="catalog-layout">
      <aside className="filters card">
        <h3>Browse</h3>
        <ul className="filter-list">
          {TYPES.map((t) => (
            <li key={t.v}><button type="button" aria-pressed={type === t.v} onClick={() => setParam({ type: t.v, category: '' })}>{t.l}</button></li>
          ))}
        </ul>
        <h3>Categories</h3>
        <ul className="filter-list">
          <li><button type="button" aria-pressed={!categoryId} onClick={() => setParam({ category: '' })}>All categories</button></li>
          {visibleCats.map((c) => (
            <li key={c.id}>
              <button type="button" aria-pressed={String(c.id) === categoryId} onClick={() => setParam({ category: String(c.id) })}>{c.name}</button>
            </li>
          ))}
        </ul>
      </aside>
      <section>
        <div className="section-title">
          <div>
            <h1>{title}</h1>
            {products.data && <div className="page-sub text-sm">{products.data.meta.total} product(s)</div>}
          </div>
        </div>
        <div className="toolbar">
          <input className="input search" type="search" placeholder="Search cakes, balloons, banners…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search products" />
          <select className="select" value={sort} onChange={(e) => setParam({ sort: e.target.value })} aria-label="Sort by">
            {SORTS.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
          </select>
        </div>
        {products.loading && <Loading />}
        {products.error && <ErrorState error={products.error} onRetry={products.reload} />}
        {products.data && (products.data.data.length === 0 ? (
          <Empty icon="🔍" title="No products found">Try a different search or category.</Empty>
        ) : (
          <>
            <div className="product-grid">{products.data.data.map((p) => <ProductCard key={p.id} product={p} />)}</div>
            {products.data.meta.totalPages > 1 && <Pagination meta={products.data.meta} onPage={(p) => setParam({ page: String(p) })} />}
          </>
        ))}
      </section>
    </div>
  );
}
