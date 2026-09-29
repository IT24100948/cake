import { Navigate, Route, Routes } from 'react-router-dom';
import { useStaffAuth } from './context/StaffAuthContext';
import { RequireCustomer, RequireStaff } from './components/Guards';
import { Empty } from './components/ui';
import PublicLayout from './layouts/PublicLayout';
import StaffLayout, { firstAllowedPath } from './layouts/StaffLayout';

import Home from './pages/public/Home';
import Shop from './pages/public/Shop';
import ProductDetail from './pages/public/ProductDetail';
import Login from './pages/public/Login';
import Register from './pages/public/Register';
import Cart from './pages/customer/Cart';
import CustomCake from './pages/customer/CustomCake';
import Checkout from './pages/customer/Checkout';
import OrderPlaced from './pages/customer/OrderPlaced';
import MyOrders from './pages/customer/MyOrders';
import MyOrderDetail from './pages/customer/MyOrderDetail';
import Profile from './pages/customer/Profile';
import Notifications from './pages/customer/Notifications';

import StaffLogin from './pages/staff/StaffLogin';
import ChangePassword from './pages/staff/ChangePassword';
import Dashboard from './pages/staff/Dashboard';
import StaffUsers from './pages/staff/StaffUsers';
import Roles from './pages/staff/Roles';
import AuditLogs from './pages/staff/AuditLogs';
import Products from './pages/staff/Products';
import ProductView from './pages/staff/ProductView';
import ProductForm from './pages/staff/ProductForm';
import Inventory from './pages/staff/Inventory';
import Customers, { CustomerDetail } from './pages/staff/Customers';
import Orders from './pages/staff/Orders';
import OrderDetail from './pages/staff/OrderDetail';
import Payments from './pages/staff/Payments';
import Deliveries from './pages/staff/Deliveries';

/** Staff land on the dashboard if allowed, otherwise on their first permitted page. */
function StaffHome() {
  const { staff, can } = useStaffAuth();
  return can('reports.view') ? <Dashboard /> : <Navigate to={firstAllowedPath(staff)} replace />;
}

const customer = (el) => <RequireCustomer>{el}</RequireCustomer>;
const staffOnly = (el, perms) => <RequireStaff perms={perms}>{el}</RequireStaff>;

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<Home />} />
        <Route path="shop" element={<Shop />} />
        <Route path="shop/:id" element={<ProductDetail />} />
        <Route path="custom-cake" element={<CustomCake />} />
        <Route path="cart" element={<Cart />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="checkout" element={customer(<Checkout />)} />
        <Route path="order-placed/:id" element={customer(<OrderPlaced />)} />
        <Route path="my/orders" element={customer(<MyOrders />)} />
        <Route path="my/orders/:id" element={customer(<MyOrderDetail />)} />
        <Route path="notifications" element={customer(<Notifications />)} />
        <Route path="profile" element={customer(<Profile />)} />
        <Route path="*" element={<Empty icon="🍰" title="Page not found"><a href="/">Back to home</a></Empty>} />
      </Route>

      <Route path="staff/login" element={<StaffLogin />} />
      <Route path="staff" element={staffOnly(<StaffLayout />)}>
        <Route index element={<StaffHome />} />
        <Route path="account" element={<Empty icon="👋" title="Welcome">Your role does not include any management pages yet. Contact an administrator.</Empty>} />
        <Route path="change-password" element={<ChangePassword />} />
        <Route path="orders" element={staffOnly(<Orders />, ['orders.view'])} />
        <Route path="orders/:id" element={staffOnly(<OrderDetail />, ['orders.view'])} />
        <Route path="customers" element={staffOnly(<Customers />, ['customers.view'])} />
        <Route path="customers/:id" element={staffOnly(<CustomerDetail />, ['customers.view'])} />
        <Route path="payments" element={staffOnly(<Payments />, ['payments.manage'])} />
        <Route path="deliveries" element={staffOnly(<Deliveries />, ['deliveries.manage'])} />
        <Route path="products" element={staffOnly(<Products />, ['products.view', 'products.manage'])} />
        <Route path="products/new" element={staffOnly(<ProductForm />, ['products.manage'])} />
        <Route path="products/:id" element={staffOnly(<ProductView />, ['products.view', 'products.manage'])} />
        <Route path="products/:id/edit" element={staffOnly(<ProductForm />, ['products.manage'])} />
        <Route path="inventory" element={staffOnly(<Inventory />, ['inventory.manage'])} />
        <Route path="users" element={staffOnly(<StaffUsers />, ['staff.manage'])} />
        <Route path="roles" element={staffOnly(<Roles />, ['roles.manage'])} />
        <Route path="audit" element={staffOnly(<AuditLogs />, ['audit.view'])} />
        <Route path="*" element={<Empty icon="🧭" title="Page not found" />} />
      </Route>
    </Routes>
  );
}
