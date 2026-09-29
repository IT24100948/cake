import { useState } from 'react';
import { roleApi, staffApi } from '../../api';
import { useStaffAuth } from '../../context/StaffAuthContext';
import { useToast } from '../../context/ToastContext';
import { useAsync, useDebounced, useForm } from '../../utils/useAsync';
import { formatDateTime } from '../../utils/format';
import { isEmail, isPhone, passwordError } from '../../utils/validation';
import { Alert, ConfirmDialog, Empty, ErrorState, Field, Loading, Modal, Pagination, SubmitButton } from '../../components/ui';
import { Can } from '../../components/Guards';
import { PageHead } from '../../layouts/StaffLayout';
import Icon from '../../components/Icons';

function tempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
  let s = '';
  const buf = new Uint32Array(8);
  crypto.getRandomValues(buf);
  buf.forEach((n) => { s += chars[n % chars.length]; });
  return `${s}${(buf[0] % 90) + 10}`;
}

function StaffForm({ roles, initial, onClose, onSaved }) {
  const toast = useToast();
  const editing = !!initial;
  const f = useForm(initial
    ? { fullName: initial.full_name, email: initial.email, phone: initial.phone || '' }
    : { fullName: '', email: '', phone: '', roleId: roles.find((r) => r.name === 'Shop Staff')?.id || roles[0]?.id || '', password: tempPassword() });

  const validate = (v) => ({
    fullName: v.fullName.trim().length >= 2 ? undefined : 'Full name must be at least 2 characters',
    email: isEmail(v.email) ? undefined : 'Enter a valid email address',
    phone: !v.phone || isPhone(v.phone) ? undefined : 'Enter a valid phone number',
    ...(editing ? {} : { roleId: v.roleId ? undefined : 'Select a role', password: passwordError(v.password) }),
  });

  const onSubmit = (e) => {
    e.preventDefault();
    f.submit(async (v) => {
      const body = { ...v, roleId: v.roleId ? Number(v.roleId) : undefined, email: v.email.trim() };
      const res = editing ? await staffApi.update(initial.id, body) : await staffApi.create(body);
      toast.success(res.message);
      onSaved(res.staff, editing ? null : v.password);
    }, validate);
  };

  return (
    <Modal title={editing ? 'Edit staff details' : 'Add staff account'} onClose={onClose}>
      <form className="stack" onSubmit={onSubmit} noValidate>
        <Alert>{f.formError}</Alert>
        <div className="form-grid">
          <Field className="full" label="Full name" required {...f.bind('fullName')} />
          <Field label="Email" type="email" required {...f.bind('email')} />
          <Field label="Phone" type="tel" {...f.bind('phone')} />
          {!editing && (
            <>
              <Field as="select" label="Role" required {...f.bind('roleId')}>
                {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </Field>
              <Field label="Temporary password" required hint="Share this securely. The staff member must change it at first login." {...f.bind('password')} />
            </>
          )}
        </div>
        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <SubmitButton busy={f.submitting}>{editing ? 'Save changes' : 'Create account'}</SubmitButton>
        </div>
      </form>
    </Modal>
  );
}

function ResetPassword({ member, onClose }) {
  const toast = useToast();
  const f = useForm({ password: tempPassword() });
  const onSubmit = (e) => {
    e.preventDefault();
    f.submit(async (v) => {
      await staffApi.resetPassword(member.id, v.password);
      toast.success(`Temporary password set for ${member.full_name}`);
      onClose();
    }, (v) => ({ password: passwordError(v.password) }));
  };
  return (
    <Modal title={`Reset password — ${member.full_name}`} onClose={onClose}>
      <form className="stack" onSubmit={onSubmit} noValidate>
        <Alert>{f.formError}</Alert>
        <p className="muted mb-0">The account will be unlocked and the staff member must set a new password at next login.</p>
        <Field label="Temporary password" required {...f.bind('password')} />
        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <SubmitButton busy={f.submitting}>Set temporary password</SubmitButton>
        </div>
      </form>
    </Modal>
  );
}

// US01, US02, US04, US05 - Staff account management
export default function StaffUsers() {
  const { staff: me } = useStaffAuth();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const q = useDebounced(search);
  const list = useAsync(() => staffApi.list({ search: q, status, page }), [q, status, page]);
  const roles = useAsync(() => roleApi.list(), []);
  const [modal, setModal] = useState(null);
  const [created, setCreated] = useState(null);
  const [busy, setBusy] = useState(false);

  const changeRole = async (m, roleId) => {
    try {
      const res = await staffApi.setRole(m.id, Number(roleId));
      toast.success(`${m.full_name}: ${res.message}`);
      list.reload();
    } catch (e) { toast.error(e); }
  };

  const toggleStatus = async () => {
    const m = modal.member;
    setBusy(true);
    try {
      const res = await staffApi.setStatus(m.id, !m.is_active, modal.reason);
      toast.success(`${m.full_name}: ${res.message}`);
      setModal(null);
      list.reload();
    } catch (e) { toast.error(e); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHead title="Staff accounts" crumb="Administration" sub="Create accounts, assign roles and control access.">
        <button className="btn btn-primary" onClick={() => setModal({ type: 'create' })} disabled={!roles.data}><Icon name="plus" size={18} /> Add staff</button>
      </PageHead>
      {created && (
        <Alert type="success">
          Account created for <strong>{created.staff.full_name}</strong> ({created.staff.email}). Temporary password: <code>{created.password}</code> — share it securely; it must be changed at first login.
          {' '}<button className="link-btn" onClick={() => setCreated(null)}>Dismiss</button>
        </Alert>
      )}
      <div className="card card-flush mt-2">
        <div className="toolbar" style={{ padding: '1rem 1rem 0' }}>
          <input className="input search" type="search" placeholder="Search name, email or phone" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} aria-label="Search staff" />
          <select className="select" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Status">
            <option value="">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option>
          </select>
        </div>
        {list.loading && !list.data && <Loading />}
        {list.error && <div style={{ padding: '1rem' }}><ErrorState error={list.error} onRetry={list.reload} /></div>}
        {list.data && (list.data.data.length === 0 ? <Empty icon="👤" title="No staff found" /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Name</th><th>Role</th><th>Status</th><th>Last login</th><th className="actions">Actions</th></tr></thead>
              <tbody>
                {list.data.data.map((m) => (
                  <tr key={m.id} className={m.is_active ? '' : 'row-muted'}>
                    <td>
                      <div className="cell-title">{m.full_name}{m.id === me.id && <span className="muted text-xs"> (you)</span>}</div>
                      <div className="cell-sub">{m.email}{m.phone ? ` · ${m.phone}` : ''}</div>
                    </td>
                    <td>
                      <Can perm="roles.manage" fallback={m.role_name}>
                        <select className="select" style={{ minHeight: 34, width: 'auto' }} value={m.role_id} onChange={(e) => changeRole(m, e.target.value)} aria-label={`Role for ${m.full_name}`}>
                          {(roles.data?.data || []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                      </Can>
                    </td>
                    <td>
                      {m.is_active ? <span className="badge badge-success">Active</span> : <span className="badge badge-neutral">Inactive</span>}
                      {m.must_change_password ? <div className="cell-sub">Must change password</div> : null}
                      {m.locked_until && new Date(m.locked_until.replace(' ', 'T')) > new Date() ? <div className="cell-sub danger-text">Locked (failed logins)</div> : null}
                    </td>
                    <td className="text-sm">{m.last_login_at ? formatDateTime(m.last_login_at) : <span className="muted">Never</span>}</td>
                    <td className="actions">
                      <button className="btn btn-sm btn-ghost" onClick={() => setModal({ type: 'edit', member: m })}>Edit</button>
                      <button className="btn btn-sm btn-ghost" onClick={() => setModal({ type: 'reset', member: m })}>Reset password</button>
                      {m.id !== me.id && (
                        <button className={`btn btn-sm ${m.is_active ? 'btn-secondary' : 'btn-success'}`} onClick={() => setModal({ type: 'status', member: m, reason: '' })}>
                          {m.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        <Pagination meta={list.data?.meta} onPage={setPage} />
      </div>

      {modal?.type === 'create' && (
        <StaffForm roles={roles.data.data} onClose={() => setModal(null)}
          onSaved={(s, password) => { setModal(null); setCreated({ staff: s, password }); list.reload(); }} />
      )}
      {modal?.type === 'edit' && (
        <StaffForm roles={roles.data?.data || []} initial={modal.member} onClose={() => setModal(null)} onSaved={() => { setModal(null); list.reload(); }} />
      )}
      {modal?.type === 'reset' && <ResetPassword member={modal.member} onClose={() => { setModal(null); list.reload(); }} />}
      {modal?.type === 'status' && (
        <ConfirmDialog
          title={modal.member.is_active ? 'Deactivate account?' : 'Activate account?'}
          message={modal.member.is_active
            ? `${modal.member.full_name} will be signed out immediately and will not be able to access the system.`
            : `${modal.member.full_name} will be able to sign in again.`}
          confirmLabel={modal.member.is_active ? 'Deactivate' : 'Activate'}
          danger={modal.member.is_active} busy={busy} onConfirm={toggleStatus} onClose={() => setModal(null)}
        >
          {modal.member.is_active && (
            <Field className="mt-2" label="Reason (optional)" value={modal.reason} maxLength={255} onChange={(e) => setModal({ ...modal, reason: e.target.value })} />
          )}
        </ConfirmDialog>
      )}
    </>
  );
}
