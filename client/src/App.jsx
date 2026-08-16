import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import FaceLogin from './pages/FaceLogin.jsx';
import Register from './pages/Register.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import RiderHome from './pages/RiderHome.jsx';
import DriverHome from './pages/DriverHome.jsx';
import RideHistory from './pages/RideHistory.jsx';
import Profile from './pages/Profile.jsx';
import RiderTerms from './pages/RiderTerms.jsx';
import DriverTerms from './pages/DriverTerms.jsx';
import AdminLayout from './layouts/AdminLayout.jsx';
import AdminOverview from './pages/admin/AdminOverview.jsx';
import AdminDrivers from './pages/admin/AdminDrivers.jsx';
import AdminRiders from './pages/admin/AdminRiders.jsx';
import AdminRides from './pages/admin/AdminRides.jsx';
import AdminReports from './pages/admin/AdminReports.jsx';
import AdminSettings from './pages/admin/AdminSettings.jsx';

function Protected({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-loader">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={user.role === 'driver' ? '/driver' : user.role === 'admin' ? '/admin' : '/'} replace />;
  }
  // Terms gate: non-admin users must accept T&C before accessing main features.
  if (user.role !== 'admin' && !user.termsAcceptedAt) {
    const termsPath = user.role === 'driver' ? '/terms/driver' : '/terms/rider';
    // Already on the terms page? Allow it.
    if (typeof window !== 'undefined' && window.location.pathname === termsPath) return children;
    return <Navigate to={termsPath} replace />;
  }
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/face-login" element={<FaceLogin />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/register" element={<Register />} />

      <Route
        path="/terms/rider"
        element={
          <Protected roles={['rider']}>
            <RiderTerms />
          </Protected>
        }
      />
      <Route
        path="/terms/driver"
        element={
          <Protected roles={['driver']}>
            <DriverTerms />
          </Protected>
        }
      />
      <Route
        path="/ride"
        element={
          <Protected roles={['rider']}>
            <RiderHome />
          </Protected>
        }
      />
      <Route
        path="/history"
        element={
          <Protected roles={['rider', 'driver']}>
            <RideHistory />
          </Protected>
        }
      />
      <Route
        path="/driver"
        element={
          <Protected roles={['driver']}>
            <DriverHome />
          </Protected>
        }
      />
      <Route
        path="/admin"
        element={
          <Protected roles={['admin']}>
            <AdminLayout />
          </Protected>
        }
      >
        <Route index element={<AdminOverview />} />
        <Route path="drivers" element={<AdminDrivers />} />
        <Route path="riders" element={<AdminRiders />} />
        <Route path="rides" element={<AdminRides />} />
        <Route path="reports" element={<AdminReports />} />
        <Route path="settings" element={<AdminSettings />} />
      </Route>
      <Route
        path="/profile"
        element={
          <Protected roles={['rider', 'driver', 'admin']}>
            <Profile />
          </Protected>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
