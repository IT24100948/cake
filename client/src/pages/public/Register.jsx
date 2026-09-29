import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useCustomerAuth } from '../../context/CustomerAuthContext';
import { useToast } from '../../context/ToastContext';
import { useForm } from '../../utils/useAsync';
import { Alert, Field, SubmitButton } from '../../components/ui';
import { isEmail, isPhone, passwordError } from '../../utils/validation';

// US12 - Customer creates an account and provides their details
export default function Register() {
  const { register } = useCustomerAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const f = useForm({ fullName: '', email: '', phone: '', address: '', city: '', password: '', confirmPassword: '' });

  const validate = (v) => ({
    fullName: v.fullName.trim().length < 2 ? 'Full name must be at least 2 characters' : undefined,
    email: isEmail(v.email) ? undefined : 'Enter a valid email address',
    phone: isPhone(v.phone) ? undefined : 'Enter a valid phone number (e.g. 0771234567)',
    password: passwordError(v.password),
    confirmPassword: v.password === v.confirmPassword ? undefined : 'Passwords do not match',
  });

  const onSubmit = (e) => {
    e.preventDefault();
    f.submit(async (v) => {
      await register({ ...v, email: v.email.trim() });
      toast.success('Welcome to Devma! Your account is ready.');
      navigate(location.state?.from || '/shop', { replace: true });
    }, validate);
  };

  return (
    <div className="auth-wrap">
      <form className="card auth-card wide stack" onSubmit={onSubmit} noValidate>
        <div>
          <h1>Create your account</h1>
          <p className="muted mb-0">Your details are used to prepare and deliver your orders.</p>
        </div>
        <Alert>{f.formError}</Alert>
        <div className="form-grid">
          <Field className="full" label="Full name" required autoComplete="name" {...f.bind('fullName')} />
          <Field label="Email" type="email" required autoComplete="email" {...f.bind('email')} />
          <Field label="Mobile number" type="tel" required autoComplete="tel" placeholder="0771234567" {...f.bind('phone')} />
          <Field className="full" label="Address" autoComplete="street-address" hint="Used as your default delivery address" {...f.bind('address')} />
          <Field label="City" autoComplete="address-level2" {...f.bind('city')} />
          <div />
          <Field label="Password" type="password" required autoComplete="new-password" hint="At least 8 characters with a letter and a number" {...f.bind('password')} />
          <Field label="Confirm password" type="password" required autoComplete="new-password" {...f.bind('confirmPassword')} />
        </div>
        <SubmitButton busy={f.submitting} className="btn btn-primary btn-block btn-lg">Create account</SubmitButton>
        <p className="text-center text-sm mb-0">Already have an account? <Link to="/login" state={location.state}>Log in</Link></p>
      </form>
    </div>
  );
}
