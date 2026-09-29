import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useStaffAuth } from '../../context/StaffAuthContext';
import { useForm } from '../../utils/useAsync';
import { isEmail } from '../../utils/validation';
import { Alert, Field, Loading, SubmitButton } from '../../components/ui';
import { Brand } from '../../layouts/PublicLayout';
import { firstAllowedPath } from '../../layouts/StaffLayout';

// US03 - Staff securely log in
export default function StaffLogin() {
  const { staff, loading, login } = useStaffAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const f = useForm({ email: '', password: '' });

  if (loading) return <Loading />;
  if (staff) return <Navigate to={staff.must_change_password ? '/staff/change-password' : firstAllowedPath(staff)} replace />;

  const onSubmit = (e) => {
    e.preventDefault();
    f.submit(async (v) => {
      const s = await login(v.email.trim(), v.password);
      if (s.must_change_password) navigate('/staff/change-password', { replace: true });
      else navigate(location.state?.from || firstAllowedPath(s), { replace: true });
    }, (v) => ({ email: isEmail(v.email) ? undefined : 'Enter a valid email address', password: v.password ? undefined : 'Password is required' }));
  };

  return (
    <div className="staff-login">
      <div className="art">
        <Brand sub="Staff portal" />
        <div>
          <h2>Everything for today’s orders, in one place.</h2>
          <p>Manage products and inventory, confirm customer orders, record payments and arrange deliveries.</p>
        </div>
        <small style={{ color: '#bba69d' }}>Authorised staff only. All access is recorded.</small>
      </div>
      <div className="panel">
        <form className="card auth-card stack" onSubmit={onSubmit} noValidate>
          <div>
            <h1>Staff sign in</h1>
            <p className="muted mb-0">Use the account created for you by the administrator.</p>
          </div>
          <Alert>{f.formError}</Alert>
          <Field label="Email" type="email" autoComplete="username" required {...f.bind('email')} />
          <Field label="Password" type="password" autoComplete="current-password" required {...f.bind('password')} />
          <SubmitButton busy={f.submitting} className="btn btn-primary btn-block btn-lg">Sign in</SubmitButton>
          <a href="/" className="text-sm text-center">← Back to the shop</a>
        </form>
      </div>
    </div>
  );
}
