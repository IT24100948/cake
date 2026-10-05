import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useCustomerAuth } from '../../context/CustomerAuthContext';
import { useStaffAuth } from '../../context/StaffAuthContext';
import { fadeUp, reveal } from '../motion';

/**
 * Every page of the system, one click from the home page.
 * Staff pages send signed-out visitors to the staff login, which returns them to the page afterwards.
 */
const GROUPS = [
  {
    title: 'Shop',
    sub: 'Browse and order',
    links: [
      { to: '/shop', label: 'All products' },
      { to: '/shop?type=CAKE', label: 'Cakes' },
      { to: '/shop?type=DECORATION', label: 'Party decorations' },
      { to: '/#build', label: 'Build your cake' },
      { to: '/custom-cake', label: 'Custom cake request' },
      { to: '/cart', label: 'Cart' },
      { to: '/checkout', label: 'Checkout' },
    ],
  },
  {
    title: 'Customer account',
    sub: 'Sign up, log in and track orders',
    links: [
      { to: '/register', label: 'Create account', guest: true },
      { to: '/login', label: 'Customer login', guest: true },
      { to: '/my/orders', label: 'My orders' },
      { to: '/notifications', label: 'Notifications' },
      { to: '/profile', label: 'Profile & password' },
    ],
  },
  {
    title: 'Staff & admin portal',
    sub: 'Pages open according to your role',
    staff: true,
    links: [
      { to: '/staff/login', label: 'Staff login', guest: true, primary: true },
      { to: '/staff', label: 'Dashboard', primary: true },
      { to: '/staff/orders', label: 'Orders' },
      { to: '/staff/customers', label: 'Customers' },
      { to: '/staff/payments', label: 'Payments' },
      { to: '/staff/deliveries', label: 'Delivery & collection' },
      { to: '/staff/products', label: 'Products' },
      { to: '/staff/products/new', label: 'Add product' },
      { to: '/staff/inventory', label: 'Inventory' },
      { to: '/staff/users', label: 'Staff accounts' },
      { to: '/staff/roles', label: 'Roles & permissions' },
      { to: '/staff/audit', label: 'Audit records' },
      { to: '/staff/change-password', label: 'Change password' },
    ],
  },
];

export default function QuickLinks() {
  const { customer } = useCustomerAuth();
  const { staff } = useStaffAuth();

  return (
    <section className="quick" id="quick-links" aria-labelledby="quick-title">
      <div className="section-head">
        <p className="eyebrow">Quick links</p>
        <h2 id="quick-title">Everything, <em>one click away</em></h2>
      </div>
      <motion.div className="quick-grid" {...reveal}>
        {GROUPS.map((g, i) => {
          const signedIn = g.staff ? !!staff : !!customer;
          return (
            <motion.div key={g.title} className={`quick-card${g.staff ? ' is-staff' : ''}`} variants={fadeUp} custom={i}>
              <h3>{g.title}</h3>
              <p>{signedIn && g.staff ? `Signed in as ${staff.full_name} (${staff.role_name})` : g.sub}</p>
              <div className="quick-links">
                {g.links.filter((l) => !(l.guest && signedIn)).map((l) => (
                  <Link key={l.to} to={l.to} className={`pill pill-sm ${l.primary ? 'pill-primary' : 'pill-ghost'}`}>{l.label}</Link>
                ))}
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </section>
  );
}
