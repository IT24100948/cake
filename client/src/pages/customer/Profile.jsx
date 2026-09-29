import { customerAuthApi } from '../../api';
import { useCustomerAuth } from '../../context/CustomerAuthContext';
import { useToast } from '../../context/ToastContext';
import { useForm } from '../../utils/useAsync';
import { isPhone, passwordError } from '../../utils/validation';
import { Alert, Field, SubmitButton } from '../../components/ui';

// US12 - Manage customer details
export default function Profile() {
  const { customer, setCustomer } = useCustomerAuth();
  const toast = useToast();
  const p = useForm({ fullName: customer.full_name, phone: customer.phone, address: customer.address || '', city: customer.city || '' });
  const pw = useForm({ currentPassword: '', newPassword: '', confirmPassword: '' });

  const saveProfile = (e) => {
    e.preventDefault();
    p.submit(async (v) => {
      const res = await customerAuthApi.updateProfile(v);
      setCustomer(res.customer);
      toast.success('Profile updated');
    }, (v) => ({
      fullName: v.fullName.trim().length >= 2 ? undefined : 'Full name must be at least 2 characters',
      phone: isPhone(v.phone) ? undefined : 'Enter a valid phone number',
    }));
  };

  const savePassword = (e) => {
    e.preventDefault();
    pw.submit(async (v) => {
      await customerAuthApi.changePassword(v);
      pw.setValues({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast.success('Password changed');
    }, (v) => ({
      currentPassword: v.currentPassword ? undefined : 'Current password is required',
      newPassword: passwordError(v.newPassword),
      confirmPassword: v.newPassword === v.confirmPassword ? undefined : 'Passwords do not match',
    }));
  };

  return (
    <div className="stack" style={{ maxWidth: 760, margin: '0 auto' }}>
      <h1>My profile</h1>
      <form className="card stack" onSubmit={saveProfile} noValidate>
        <h2>Personal details</h2>
        <Alert>{p.formError}</Alert>
        <div className="form-grid">
          <Field className="full" label="Full name" required {...p.bind('fullName')} />
          <Field label="Email" value={customer.email} disabled hint="Contact us to change your email" />
          <Field label="Mobile number" type="tel" required {...p.bind('phone')} />
          <Field className="full" label="Address" {...p.bind('address')} />
          <Field label="City" {...p.bind('city')} />
        </div>
        <div className="form-actions"><SubmitButton busy={p.submitting}>Save changes</SubmitButton></div>
      </form>
      <form className="card stack" onSubmit={savePassword} noValidate>
        <h2>Change password</h2>
        <Alert>{pw.formError}</Alert>
        <div className="form-grid">
          <Field className="full" label="Current password" type="password" autoComplete="current-password" {...pw.bind('currentPassword')} />
          <Field label="New password" type="password" autoComplete="new-password" {...pw.bind('newPassword')} />
          <Field label="Confirm new password" type="password" autoComplete="new-password" {...pw.bind('confirmPassword')} />
        </div>
        <div className="form-actions"><SubmitButton busy={pw.submitting}>Update password</SubmitButton></div>
      </form>
    </div>
  );
}
