import { useState } from 'react';
import { auditApi } from '../../api';
import { useAsync, useDebounced } from '../../utils/useAsync';
import { formatDateTime } from '../../utils/format';
import { Empty, ErrorState, Loading, Pagination } from '../../components/ui';
import { PageHead } from '../../layouts/StaffLayout';

const TONE = (a) => (/FAILED|LOCKED|BLOCKED|DEACTIVATED|DELETED|CANCELLED/.test(a) ? 'danger' : /LOGIN|LOGOUT|PASSWORD/.test(a) ? 'info' : /CREATED|PLACED|CONFIRMED|RECORDED/.test(a) ? 'success' : 'neutral');
const pretty = (a) => a.toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

// US06 - View access and audit records
export default function AuditLogs() {
  const [filters, setFilters] = useState({ category: '', action: '', actorType: '', from: '', to: '', search: '' });
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(null);
  const search = useDebounced(filters.search);
  const actions = useAsync(() => auditApi.actions(), []);
  const logs = useAsync(() => auditApi.list({ ...filters, search, page }), [filters.category, filters.action, filters.actorType, filters.from, filters.to, search, page]);
  const set = (k, v) => { setFilters((f) => ({ ...f, [k]: v })); setPage(1); };

  return (
    <>
      <PageHead title="Access & audit records" crumb="Administration" sub="Sign-ins, account changes and business actions, newest first." />
      <div className="card card-flush">
        <div className="toolbar" style={{ padding: '1rem 1rem 0' }}>
          <input className="input search" type="search" placeholder="Search user, record or details" value={filters.search} onChange={(e) => set('search', e.target.value)} aria-label="Search" />
          <select className="select" value={filters.category} onChange={(e) => set('category', e.target.value)} aria-label="Category">
            <option value="">All activity</option><option value="access">Access (logins & passwords)</option>
          </select>
          <select className="select" value={filters.action} onChange={(e) => set('action', e.target.value)} aria-label="Action">
            <option value="">All actions</option>
            {(actions.data?.data || []).map((a) => <option key={a} value={a}>{pretty(a)}</option>)}
          </select>
          <select className="select" value={filters.actorType} onChange={(e) => set('actorType', e.target.value)} aria-label="User type">
            <option value="">All users</option><option value="STAFF">Staff</option><option value="CUSTOMER">Customers</option><option value="SYSTEM">System</option>
          </select>
          <input className="input" type="date" value={filters.from} onChange={(e) => set('from', e.target.value)} aria-label="From date" />
          <input className="input" type="date" value={filters.to} onChange={(e) => set('to', e.target.value)} aria-label="To date" />
        </div>
        {logs.loading && !logs.data && <Loading />}
        {logs.error && <div style={{ padding: '1rem' }}><ErrorState error={logs.error} onRetry={logs.reload} /></div>}
        {logs.data && (logs.data.data.length === 0 ? <Empty icon="📜" title="No records match these filters" /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>When</th><th>User</th><th>Action</th><th>Record</th><th>IP address</th><th /></tr></thead>
              <tbody>
                {logs.data.data.map((l) => (
                  <tr key={l.id}>
                    <td className="nowrap text-sm">{formatDateTime(l.created_at)}</td>
                    <td><div className="cell-title">{l.actor_name || '—'}</div><div className="cell-sub">{l.actor_type.toLowerCase()}</div></td>
                    <td><span className={`badge badge-${TONE(l.action)}`}>{pretty(l.action)}</span></td>
                    <td className="text-sm">
                      {l.entity_type ? `${l.entity_type} #${l.entity_id}` : '—'}
                      {open === l.id && l.details && <pre className="json-details">{JSON.stringify(l.details, null, 2)}</pre>}
                    </td>
                    <td className="text-sm muted">{l.ip_address || '—'}</td>
                    <td className="actions">{l.details && <button className="btn btn-sm btn-ghost" onClick={() => setOpen(open === l.id ? null : l.id)}>{open === l.id ? 'Hide' : 'Details'}</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        <Pagination meta={logs.data?.meta} onPage={setPage} />
      </div>
    </>
  );
}
