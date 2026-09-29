import { useState } from 'react';
import { Link } from 'react-router-dom';
import { reportApi } from '../../api';
import { useAsync } from '../../utils/useAsync';
import { formatDate, formatLKR, formatNumber, isoDate, methodLabel, statusLabel } from '../../utils/format';
import { ErrorState, Loading, StatusBadge } from '../../components/ui';
import { PageHead } from '../../layouts/StaffLayout';

function SalesChart({ series }) {
  const max = Math.max(1, ...series.map((s) => s.revenue));
  return (
    <>
      <div className="bar-chart" role="img" aria-label="Revenue per day">
        {series.map((s) => (
          <div className="bar-col" key={s.day}>
            <div className="bar" style={{ height: `${(s.revenue / max) * 100}%` }} />
            <div className="tip">{formatDate(s.day)}<br />{formatLKR(s.revenue)} · {s.orders} order(s)</div>
          </div>
        ))}
      </div>
      <div className="chart-axis"><span>{formatDate(series[0]?.day)}</span><span>{formatDate(series[series.length - 1]?.day)}</span></div>
    </>
  );
}

function HBars({ rows, format = formatNumber }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return rows.map((r) => (
    <div className="hbar" key={r.label}>
      <span className="text-sm" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.label}>{r.label}</span>
      <div className="track"><div className="fill" style={{ width: `${(r.value / max) * 100}%` }} /></div>
      <span className="val">{format(r.value)}</span>
    </div>
  ));
}

// Management & Reporting
export default function Dashboard() {
  const [range, setRange] = useState({ from: isoDate(-29), to: isoDate(0) });
  const summary = useAsync(() => reportApi.summary(), []);
  const byStatus = useAsync(() => reportApi.ordersByStatus(), []);
  const sales = useAsync(() => reportApi.sales(range), [range.from, range.to]);
  const top = useAsync(() => reportApi.topProducts({ limit: 6 }), []);
  const low = useAsync(() => reportApi.lowStock(), []);
  const upcoming = useAsync(() => reportApi.upcoming(), []);

  if (summary.loading) return <Loading />;
  if (summary.error) return <ErrorState error={summary.error} onRetry={summary.reload} />;
  const k = summary.data;

  return (
    <>
      <PageHead title="Dashboard" crumb="Overview" sub={new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} />
      <div className="grid-4">
        <Link to="/staff/orders?status=PENDING" className="stat" style={{ color: 'inherit', textDecoration: 'none' }}>
          <div className="stat-label">Awaiting confirmation</div><div className="stat-value">{k.pending_orders}</div><div className="stat-sub">{k.orders_today} new today</div>
        </Link>
        <Link to="/staff/orders" className="stat" style={{ color: 'inherit', textDecoration: 'none' }}>
          <div className="stat-label">In progress</div><div className="stat-value">{k.in_progress_orders}</div><div className="stat-sub">{k.due_today} due today</div>
        </Link>
        <div className="stat"><div className="stat-label">Revenue this month</div><div className="stat-value">{formatLKR(k.revenue_month)}</div><div className="stat-sub">{formatLKR(k.revenue_today)} today</div></div>
        <div className="stat"><div className="stat-label">Outstanding balances</div><div className="stat-value">{formatLKR(k.outstanding_balance)}</div><div className="stat-sub">Confirmed orders not fully paid</div></div>
        <Link to="/staff/inventory" className={`stat${k.low_stock_products ? ' stat-warn' : ''}`} style={{ color: 'inherit', textDecoration: 'none' }}>
          <div className="stat-label">Low-stock products</div><div className="stat-value">{k.low_stock_products}</div><div className="stat-sub">At or below reorder level</div>
        </Link>
        <Link to="/staff/customers" className="stat" style={{ color: 'inherit', textDecoration: 'none' }}>
          <div className="stat-label">Customers</div><div className="stat-value">{k.total_customers}</div><div className="stat-sub">{k.new_customers_month} joined this month</div>
        </Link>
      </div>

      <div className="detail-layout mt-3">
        <section className="card">
          <div className="card-header">
            <h2>Sales report</h2>
            <div className="row text-sm">
              <input className="input" type="date" value={range.from} max={range.to} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} aria-label="From" />
              –
              <input className="input" type="date" value={range.to} min={range.from} max={isoDate(0)} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} aria-label="To" />
            </div>
          </div>
          {sales.loading && !sales.data ? <Loading /> : sales.error ? <ErrorState error={sales.error} /> : (
            <>
              <div className="grid-3 mb-2">
                <div><div className="stat-label">Payments received</div><div className="strong" style={{ fontSize: '1.3rem' }}>{formatLKR(sales.data.totals.revenue)}</div></div>
                <div><div className="stat-label">Orders placed</div><div className="strong" style={{ fontSize: '1.3rem' }}>{sales.data.totals.orders}</div></div>
                <div><div className="stat-label">Custom cakes</div><div className="strong" style={{ fontSize: '1.3rem' }}>{sales.data.customCakes.count} · {formatLKR(sales.data.customCakes.amount)}</div></div>
              </div>
              <SalesChart series={sales.data.series} />
              <div className="grid-2 mt-3">
                <div>
                  <h3>By payment method</h3>
                  {sales.data.byMethod.length ? <HBars rows={sales.data.byMethod.map((m) => ({ label: methodLabel(m.method), value: m.amount }))} format={(v) => formatNumber(Math.round(v))} /> : <p className="muted text-sm">No payments in this period.</p>}
                </div>
                <div>
                  <h3>Catalogue sales by type</h3>
                  {sales.data.byType.length ? <HBars rows={sales.data.byType.map((t) => ({ label: t.product_type === 'CAKE' ? 'Cakes' : 'Decorations', value: t.amount }))} format={(v) => formatNumber(Math.round(v))} /> : <p className="muted text-sm">No orders in this period.</p>}
                </div>
              </div>
            </>
          )}
        </section>
        <section className="card">
          <h2>Orders by status</h2>
          {byStatus.data && <HBars rows={byStatus.data.data.map((s) => ({ label: statusLabel(s.status), value: s.count }))} />}
          <hr />
          <h2>Top products</h2>
          {top.data && (top.data.data.length ? <HBars rows={top.data.data.map((p) => ({ label: p.product_name, value: p.quantity }))} /> : <p className="muted">No sales yet.</p>)}
        </section>
      </div>

      <div className="grid-2 mt-3">
        <section className="card card-flush">
          <div className="card-header"><h2>Due in the next 7 days</h2><Link to="/staff/orders?status=ACTIVE" className="text-sm">All orders →</Link></div>
          {upcoming.data && (upcoming.data.data.length === 0 ? <p className="muted" style={{ padding: '0 1.25rem 1rem' }}>Nothing due this week.</p> : (
            <div className="table-wrap">
              <table className="table">
                <tbody>
                  {upcoming.data.data.map((o) => (
                    <tr key={o.id}>
                      <td className="nowrap"><strong>{formatDate(o.event_date)}</strong><div className="cell-sub">{o.fulfillment_type === 'DELIVERY' ? 'Delivery' : 'Collection'}</div></td>
                      <td><Link to={`/staff/orders/${o.id}`}>{o.order_number}</Link><div className="cell-sub">{o.customer_name}</div></td>
                      <td><StatusBadge status={o.status} /></td>
                      <td><StatusBadge status={o.payment_status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </section>
        <section className="card card-flush">
          <div className="card-header"><h2>Low stock</h2><Link to="/staff/inventory" className="text-sm">Inventory →</Link></div>
          {low.data && (low.data.data.length === 0 ? <p className="muted" style={{ padding: '0 1.25rem 1rem' }}>All products are above their reorder level.</p> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Product</th><th className="num">Stock</th><th className="num">Reorder at</th></tr></thead>
                <tbody>
                  {low.data.data.map((p) => (
                    <tr key={p.id}>
                      <td><div className="cell-title">{p.name}</div><div className="cell-sub">{p.sku}</div></td>
                      <td className={`num strong ${p.stock_quantity === 0 ? 'danger-text' : ''}`}>{p.stock_quantity}</td>
                      <td className="num">{p.reorder_level}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </section>
      </div>
    </>
  );
}
