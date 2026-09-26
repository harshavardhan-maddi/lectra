import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import PrivateRoute from './components/PrivateRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ManageClassrooms from './pages/ManageClassrooms';
import ManageUsers from './pages/ManageUsers';
import ManageFaculty from './pages/ManageFaculty';
import Reports from './pages/Reports';
import CRDashboard from './pages/CRDashboard';
import FingerprintSettings from './pages/FingerprintSettings';
import AbsentControllerDashboard from './pages/AbsentControllerDashboard';
import PrintReport from './pages/PrintReport';
import FacultyDashboard from './pages/FacultyDashboard';
import WatchmanDashboard from './pages/WatchmanDashboard';

// Custom router resolver to send authenticated users to their correct home dashboard
const HomeRedirect = () => {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (user.role === 'CR') {
    return <Navigate to="/cr-dashboard" replace />;
  }
  if (user.role === 'ABSENT_CONTROLLER') {
    return <Navigate to="/absent-controller" replace />;
  }
  if (user.role === 'FACULTY') {
    return <Navigate to="/faculty-dashboard" replace />;
  }
  if (user.role === 'WATCHMAN' || user.role === 'SECURITY_HEAD') {
    return <Navigate to="/watchman-dashboard" replace />;
  }
  if (user.role === 'HOD' || user.role === 'SUB_ADMIN' || user.role === 'SUPER_ADMIN') {
    return <Navigate to="/dashboard" replace />;
  }
  return <Navigate to="/login" replace />;
};

const AppRoutes = () => {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<Login />} />

      {/* Protected Security Head / Watchman Routes */}
      <Route
        path="/watchman-dashboard"
        element={
          <PrivateRoute allowedRoles={['WATCHMAN', 'SECURITY_HEAD', 'HOD', 'SUB_ADMIN', 'SUPER_ADMIN']}>
            <Layout>
              <WatchmanDashboard />
            </Layout>
          </PrivateRoute>
        }
      />

      {/* Protected CR Routes */}
      <Route
        path="/cr-dashboard"
        element={
          <PrivateRoute allowedRoles={['CR']}>
            <Layout>
              <CRDashboard />
            </Layout>
          </PrivateRoute>
        }
      />

      {/* Protected Absent Controller Routes */}
      <Route
        path="/absent-controller"
        element={
          <PrivateRoute allowedRoles={['ABSENT_CONTROLLER']}>
            <Layout>
              <AbsentControllerDashboard />
            </Layout>
          </PrivateRoute>
        }
      />

      {/* Protected Faculty Routes */}
      <Route
        path="/faculty-dashboard"
        element={
          <PrivateRoute allowedRoles={['FACULTY']}>
            <Layout>
              <FacultyDashboard />
            </Layout>
          </PrivateRoute>
        }
      />

      {/* Protected Admin/Sub Admin Routes */}
      <Route
        path="/dashboard"
        element={
          <PrivateRoute allowedRoles={['HOD', 'SUB_ADMIN']}>
            <Layout>
              <Dashboard />
            </Layout>
          </PrivateRoute>
        }
      />

      <Route
        path="/students"
        element={
          <PrivateRoute allowedRoles={['HOD', 'SUB_ADMIN']}>
            <Layout>
              <Dashboard initialTab="students" />
            </Layout>
          </PrivateRoute>
        }
      />

      <Route
        path="/absentees"
        element={
          <PrivateRoute allowedRoles={['HOD', 'SUB_ADMIN']}>
            <Layout>
              <Dashboard initialTab="absentees" />
            </Layout>
          </PrivateRoute>
        }
      />

      <Route
        path="/outpasses"
        element={
          <PrivateRoute allowedRoles={['HOD', 'SUB_ADMIN']}>
            <Layout>
              <Dashboard initialTab="outpassApprovals" />
            </Layout>
          </PrivateRoute>
        }
      />

      <Route
        path="/backup"
        element={
          <PrivateRoute allowedRoles={['HOD', 'SUB_ADMIN']}>
            <Layout>
              <Dashboard initialTab="dataBackup" />
            </Layout>
          </PrivateRoute>
        }
      />

      <Route
        path="/classrooms"
        element={
          <PrivateRoute allowedRoles={['HOD', 'SUB_ADMIN']}>
            <Layout>
              <ManageClassrooms />
            </Layout>
          </PrivateRoute>
        }
      />

      <Route
        path="/faculty"
        element={
          <PrivateRoute allowedRoles={['HOD', 'SUB_ADMIN']}>
            <Layout>
              <ManageFaculty />
            </Layout>
          </PrivateRoute>
        }
      />

      <Route
        path="/reports"
        element={
          <PrivateRoute allowedRoles={['HOD', 'SUB_ADMIN', 'ABSENT_CONTROLLER']}>
            <Layout>
              <Reports />
            </Layout>
          </PrivateRoute>
        }
      />

      <Route
        path="/print-report"
        element={
          <PrivateRoute allowedRoles={['HOD', 'SUB_ADMIN', 'ABSENT_CONTROLLER']}>
            <PrintReport />
          </PrivateRoute>
        }
      />

      <Route
        path="/settings"
        element={
          <PrivateRoute allowedRoles={['HOD', 'SUB_ADMIN', 'ABSENT_CONTROLLER']}>
            <Layout>
              <FingerprintSettings />
            </Layout>
          </PrivateRoute>
        }
      />

      {/* Protected User Management Routes */}
      <Route
        path="/users"
        element={
          <PrivateRoute allowedRoles={['HOD', 'SUPER_ADMIN']}>
            <Layout>
              <ManageUsers />
            </Layout>
          </PrivateRoute>
        }
      />

      {/* Wildcard redirects */}
      <Route path="/" element={<HomeRedirect />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <SocketProvider>
          <AppRoutes />
        </SocketProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
