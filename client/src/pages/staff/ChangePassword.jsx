import { useNavigate } from 'react-router-dom';
import { staffAuthApi } from '../../api';
import { useStaffAuth } from '../../context/StaffAuthContext';
import { useToast } from '../../context/ToastContext';
import { useForm } from '../../utils/useAsync';
import { passwordError } from '../../utils/validation';
import { Alert, Field, SubmitButton } from '../../components/ui';
import { PageHead, firstAllowedPath } from '../../layouts/StaffLayout';

// US04 - Staff manage their password
export default function ChangePassword() {
  const { staff, setStaff, logout } = useStaffAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const forced = staff.must_change_password;
  const f = useForm({ currentPassword: '', newPassword: '', confirmPassword: '' });

  const onSubmit = (e) => {
    e.preventDefault();
    f.submit(async (v) => {
      const res = await staffAuthApi.changePassword(v);
      setStaff(res.staff);
      toast.success('Password updated');
      f.setValues({ currentPassword: '', newPassword: '', confirmPassword: '' });
      if (forced) navigate(firstAllowedPath(res.staff), { replace: true });
    }, (v) => ({
      currentPassword: v.currentPassword ? undefined : 'Current password is required',
      newPassword: passwordError(v.newPassword) || (v.newPassword === v.currentPassword ? 'New password must be different' : undefined),
      confirmPassword: v.newPassword === v.confirmPassword ? undefined : 'Passwords do not match',
    }));
  };

  const form = (
    <form className="card stack" onSubmit={onSubmit} noValidate style={{ maxWidth: 520 }}>
      {forced && <Alert type="warning">For security, please replace the temporary password set by your administrator before continuing.</Alert>}
      <Alert>{f.formError}</Alert>
      <Field label={forced ? 'Temporary password' : 'Current password'} type="password" autoComplete="current-password" required {...f.bind('currentPassword')} />
      <Field label="New password" type="password" autoComplete="new-password" required hint="At least 8 characters with a letter and a number" {...f.bind('newPassword')} />
      <Field label="Confirm new password" type="password" autoComplete="new-password" required {...f.bind('confirmPassword')} />
      <div className="form-actions">
        {forced && <button type="button" className="btn btn-ghost" onClick={async () => { await logout(); navigate('/staff/login'); }}>Log out</button>}
        <SubmitButton busy={f.submitting}>Update password</SubmitButton>
      </div>
    </form>
  );

  if (forced) {
    return (
      <div className="staff-login" style={{ gridTemplateColumns: '1fr' }}>
        <div className="panel" style={{ flexDirection: 'column', gap: '1rem' }}>
          <h1>Set a new password</h1>
          <p className="muted">Signed in as {staff.email}</p>
          {form}
        </div>
      </div>
    );
  }
  return (
    <>
      <PageHead title="Change password" crumb="Account" sub={`Signed in as ${staff.email}`} />
      {form}
    </>
  );
}
