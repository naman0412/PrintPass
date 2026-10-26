import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Navbar } from './components/common/Navbar';
import { HomePage } from './pages/student/HomePage';
import { OrdersPage } from './pages/student/OrdersPage';
import { OrderTrackPage } from './pages/student/OrderTrackPage';
import { ShopDashboardPage } from './pages/shop/ShopDashboardPage';
import { ShopEarningsPage } from './pages/shop/ShopEarningsPage';
import { ShopSettingsPage } from './pages/shop/ShopSettingsPage';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { useAuth } from './context/AuthContext';

// Protected Route for Shop Staff (Operator/Owner)
const ShopRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user || (user.role !== 'operator' && user.role !== 'owner')) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

// Protected Route for Logged in Users
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

export const App = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Navbar />
      <main className="flex-1">
        <Routes>
          {/* Student Flow */}
          <Route path="/" element={<HomePage />} />
          <Route
            path="/orders"
            element={
              <ProtectedRoute>
                <OrdersPage />
              </ProtectedRoute>
            }
          />
          <Route path="/orders/:id" element={<OrderTrackPage />} />

          {/* Shopkeeper Flow */}
          <Route
            path="/shop"
            element={
              <ShopRoute>
                <ShopDashboardPage />
              </ShopRoute>
            }
          />
          <Route
            path="/shop/earnings"
            element={
              <ShopRoute>
                <ShopEarningsPage />
              </ShopRoute>
            }
          />
          <Route
            path="/shop/settings"
            element={
              <ShopRoute>
                <ShopSettingsPage />
              </ShopRoute>
            }
          />

          {/* Auth */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* Footer */}
      <footer className="py-6 border-t border-slate-200 bg-white text-center text-xs text-slate-400">
        <p>PrintPass • Skip the queue. Print on time. • Monorepo Campus Cloud Printing</p>
      </footer>
    </div>
  );
};

export default App;
