import { Fragment, useState } from 'react';
import { roleApi } from '../../api';
import { useStaffAuth } from '../../context/StaffAuthContext';
import { useToast } from '../../context/ToastContext';
import { useAsync, useForm } from '../../utils/useAsync';
import { Alert, ConfirmDialog, ErrorState, Field, Loading, Modal, SubmitButton } from '../../components/ui';
import { PageHead } from '../../layouts/StaffLayout';
import Icon from '../../components/Icons';

function RoleEditor({ role, permissions, onClose, onSaved }) {
  const toast = useToast();
  const { staff } = useStaffAuth();
  const f = useForm({ name: role?.name || '', description: role?.description || '', permissions: role?.permissions || [] });
  const modules = [...new Set(permissions.map((p) => p.module))];
  const toggle = (code) => f.set('permissions', f.values.permissions.includes(code) ? f.values.permissions.filter((c) => c !== code) : [...f.values.permissions, code]);
  const ownRole = role && role.id === staff.role_id;

  const onSubmit = (e) => {
    e.preventDefault();
    f.submit(async (v) => {
      const res = role ? await roleApi.update(role.id, v) : await roleApi.create(v);
      toast.success(res.message);
      onSaved();
    }, (v) => ({ name: v.name.trim().length >= 2 ? undefined : 'Role name must be at least 2 characters' }));
  };

  return (
    <Modal title={role ? `Edit role — ${role.name}` : 'Create role'} onClose={onClose} size="lg">
      <form className="stack" onSubmit={onSubmit} noValidate>
        <Alert>{f.formError || f.errors.permissions}</Alert>
        {ownRole && <Alert type="warning">This is your own role. You cannot remove the “Create roles and assign permissions” permission from it.</Alert>}
        <div className="form-grid">
          <Field label="Role name" required disabled={role?.is_system} hint={role?.is_system ? 'System role names cannot be changed' : undefined} {...f.bind('name')} />
          <Field label="Description" maxLength={255} {...f.bind('description')} />
        </div>
        <div className="table-wrap">
          <table className="perm-matrix">
            <thead><tr><th>Permission</th><th style={{ width: 90 }}>Allowed</th></tr></thead>
            <tbody>
              {modules.map((m) => (
                <Fragment key={m}>
                  <tr className="module-row"><td colSpan={2}>{m}</td></tr>
                  {permissions.filter((p) => p.module === m).map((p) => (
                    <tr key={p.code}>
                      <td><label htmlFor={`perm-${p.code}`}>{p.description}</label><div className="text-xs muted">{p.code}</div></td>
                      <td><input id={`perm-${p.code}`} type="checkbox" checked={f.values.permissions.includes(p.code)} onChange={() => toggle(p.code)}
                        disabled={ownRole && p.code === 'roles.manage'} /></td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <div className="form-actions">
          <span className="muted text-sm" style={{ marginRight: 'auto' }}>{f.values.permissions.length} of {permissions.length} permissions selected</span>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <SubmitButton busy={f.submitting}>{role ? 'Save role' : 'Create role'}</SubmitButton>
        </div>
      </form>
    </Modal>
  );
}

// US02 - Assign roles and permissions
export default function Roles() {
  const toast = useToast();
  const { refresh } = useStaffAuth();
  const roles = useAsync(() => roleApi.list(), []);
  const perms = useAsync(() => roleApi.permissions(), []);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  if (roles.loading || perms.loading) return <Loading />;
  if (roles.error || perms.error) return <ErrorState error={roles.error || perms.error} onRetry={() => { roles.reload(); perms.reload(); }} />;
  const permList = perms.data.data;
  const describe = (code) => permList.find((p) => p.code === code)?.description || code;

  const remove = async () => {
    setBusy(true);
    try {
      await roleApi.remove(deleting.id);
      toast.success('Role deleted');
      setDeleting(null);
      roles.reload();
    } catch (e) { toast.error(e); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHead title="Roles & permissions" crumb="Administration" sub="Each staff member can only use the functions allowed by their role.">
        <button className="btn btn-primary" onClick={() => setEditing({})}><Icon name="plus" size={18} /> New role</button>
      </PageHead>
      <div className="grid-3">
        {roles.data.data.map((r) => (
          <div className="card stack-sm" key={r.id}>
            <div className="row-between">
              <h3 className="mb-0">{r.name}</h3>
              {r.is_system && <span className="badge badge-plain">System</span>}
            </div>
            <p className="muted text-sm mb-0">{r.description || 'No description'}</p>
            <div className="text-sm"><strong>{r.staff_count}</strong> staff · <strong>{r.permissions.length}</strong> permissions</div>
            <ul className="text-sm" style={{ paddingLeft: '1.1rem', margin: '0.25rem 0' }}>
              {r.permissions.slice(0, 5).map((c) => <li key={c}>{describe(c)}</li>)}
              {r.permissions.length > 5 && <li className="muted">+ {r.permissions.length - 5} more</li>}
              {r.permissions.length === 0 && <li className="muted">No permissions</li>}
            </ul>
            <div className="row mt-1">
              {r.name === 'Admin'
                ? <span className="text-xs muted">The Admin role always has full access.</span>
                : <button className="btn btn-sm btn-secondary" onClick={() => setEditing(r)}><Icon name="edit" size={16} /> Edit permissions</button>}
              {!r.is_system && <button className="btn btn-sm btn-ghost" onClick={() => setDeleting(r)} disabled={r.staff_count > 0} title={r.staff_count > 0 ? 'Reassign staff first' : ''}>Delete</button>}
            </div>
          </div>
        ))}
      </div>
      {editing && (
        <RoleEditor role={editing.id ? editing : null} permissions={permList} onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); roles.reload(); refresh(); }} />
      )}
      {deleting && (
        <ConfirmDialog title="Delete role?" message={`The role “${deleting.name}” will be permanently deleted.`} confirmLabel="Delete role"
          danger busy={busy} onConfirm={remove} onClose={() => setDeleting(null)} />
      )}
    </>
  );
}
