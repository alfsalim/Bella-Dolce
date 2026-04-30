import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { CartProvider } from './contexts/CartContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Production from './pages/Production';
import Inventory from './pages/Inventory';
import POS from './pages/POS';
import Customers from './pages/Customers';
import Users from './pages/Users';
import ProductManagement from './pages/ProductManagement';
import PublicStore from './pages/PublicStore';
import B2BStore from './pages/B2BStore';
import DeliveryManagement from './pages/DeliveryManagement';
import Settings from './pages/Settings';
import Reports from './pages/Reports';
import ProductEdit from './pages/ProductEdit';
import B2BRegistration from './pages/B2BRegistration';
import Checkout from './pages/Checkout';
import Orders from './pages/Orders';
import Finance from './pages/Finance';
import AIManager from './pages/AIManager';
import Suppliers from './pages/Suppliers';
import { seedDatabase } from './lib/seedData';

import PublicLayout from './components/PublicLayout';
import SystemAlerts from './components/SystemAlerts';

import { Toaster } from 'react-hot-toast';

const App: React.FC = () => {
  useEffect(() => {
    seedDatabase();
    
    // Initialize Dark Mode
    const isDark = localStorage.getItem('darkMode') === 'true';
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  return (
    <BrowserRouter>
      <Toaster position="top-right" />
      <AuthProvider>
        <SystemAlerts />
        <LanguageProvider>
          <CartProvider>
            <Routes>
              <Route path="/" element={<PublicLayout />}>
                <Route index element={<PublicStore />} />
                <Route path="checkout" element={<Checkout />} />
              </Route>

            <Route path="/login" element={<Login />} />
            <Route path="/b2b-register" element={<B2BRegistration />} />

            {/* Protected Management Routes */}
            <Route element={<Layout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/production" element={<Production />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/suppliers" element={<Suppliers />} />
              <Route path="/product-management" element={<ProductManagement />} />
              <Route path="/pos" element={<POS />} />
              <Route path="/b2b" element={<B2BStore />} />
              <Route path="/delivery" element={<DeliveryManagement />} />
              <Route path="/finance" element={<Finance />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/users" element={<Users />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/ai-manager" element={<AIManager />} />
              <Route path="/products/:id" element={<ProductEdit />} />
            </Route>

            {/* Redirects */}
            <Route path="/store" element={<Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </CartProvider>
      </LanguageProvider>
    </AuthProvider>
  </BrowserRouter>
  );
};

export default App;
