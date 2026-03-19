import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Navbar from './app/components/Navbar';
import ProtectedRoute from './app/components/ProtectedRoute';
import LandingPage from './app/pages/LandingPage';
import Home3DShop from './app/pages/Home3DShop';
import AuthLogin from './app/pages/AuthLogin';
import AuthSignup from './app/pages/AuthSignup';
import ForgotPassword from './app/pages/ForgotPassword';
import ResetPassword from './app/pages/ResetPassword';
import UserDashboard from './app/pages/UserDashboard';
import AdminPanel from './app/pages/AdminPanel';
import TicketsPage from './app/pages/TicketsPage';
import SettingsPage from './app/pages/SettingsPage';
import AdminTicketView from './app/pages/AdminTicketView';
import BroadcastsPage from './app/pages/BroadcastsPage';
import CheckoutPage from './app/pages/CheckoutPage';
import { useAuth } from './app/hooks/useAuth';
import { useUserActivity } from './app/hooks/useUserActivity';
import AIChatbot from './app/components/AIChatbot';

function AppRoutes() {
  const { isAuthenticated, isAdmin } = useAuth();
  useUserActivity(); // tracks heartbeat for non-admin users

  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/shop" element={<Home3DShop />} />
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to={isAdmin ? '/admin' : '/shop'} replace /> : <AuthLogin />}
        />
        <Route
          path="/signup"
          element={isAuthenticated ? <Navigate to="/shop" replace /> : <AuthSignup />}
        />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <UserDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tickets"
          element={
            <ProtectedRoute>
              <TicketsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/broadcasts"
          element={
            <ProtectedRoute>
              <BroadcastsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute adminOnly>
              <AdminPanel />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/tickets/:id"
          element={
            <ProtectedRoute adminOnly>
              <AdminTicketView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/checkout"
          element={
            <ProtectedRoute>
              <CheckoutPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {/* AI Chatbot — shown to authenticated users only */}
      {isAuthenticated && <AIChatbot />}
    </>
  );
}

export default function App() {
  return (
    <>
      <AppRoutes />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'rgba(15, 15, 26, 0.95)',
            color: '#f1f5f9',
            border: '1px solid rgba(255,255,255,0.1)',
            backdropFilter: 'blur(12px)',
            borderRadius: '12px',
          },
          success: { iconTheme: { primary: '#6366f1', secondary: '#fff' } },
          error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
        }}
      />
    </>
  );
}
