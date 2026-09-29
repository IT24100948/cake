import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ToastProvider } from './context/ToastContext';
import { StaffAuthProvider } from './context/StaffAuthContext';
import { CustomerAuthProvider } from './context/CustomerAuthContext';
import { CartProvider } from './context/CartContext';
import { CartUIProvider } from './context/CartUIContext';
import './styles/variables.css';
import './styles/base.css';
import './styles/components.css';
import './styles/public.css';
import './styles/staff.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <StaffAuthProvider>
          <CustomerAuthProvider>
            <CartProvider>
              <CartUIProvider>
                <App />
              </CartUIProvider>
            </CartProvider>
          </CustomerAuthProvider>
        </StaffAuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>
);
