import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useCustomerAuth } from '../../context/CustomerAuthContext';
import { useForm } from '../../utils/useAsync';
import { Alert, Field, SubmitButton } from '../../components/ui';
import { isEmail } from '../../utils/validation';

export default function Login() {
  const { login } = useCustomerAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/my/orders';
  const f = useForm({ email: '', password: '' });

  const onSubmit = (e) => {
    e.preventDefault();
    f.submit(async (v) => {
      await login(v.email.trim(), v.password);
      navigate(from, { replace: true });
    }, (v) => ({ email: isEmail(v.email) ? undefined : 'Enter a valid email address', password: v.password ? undefined : 'Password is required' }));
  };

  return (
    <div className="auth-wrap">
      <form className="card auth-card stack" onSubmit={onSubmit} noValidate>
        <div>
          <h1>Welcome back</h1>
          <p className="muted mb-0">Log in to place orders and track them.</p>
        </div>
        <Alert>{f.formError}</Alert>
        <Field label="Email" type="email" autoComplete="email" required {...f.bind('email')} />
        <Field label="Password" type="password" autoComplete="current-password" required {...f.bind('password')} />
        <SubmitButton busy={f.submitting} className="btn btn-primary btn-block btn-lg">Log in</SubmitButton>
        <p className="text-center text-sm mb-0">New to Devma? <Link to="/register" state={location.state}>Create an account</Link></p>
      </form>
    </div>
  );
}
