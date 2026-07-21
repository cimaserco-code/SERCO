import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import { PermissionsProvider } from '@/lib/PermissionsContext';
import Layout from '@/components/Layout';
import Home from '@/pages/Home';
import Empleados from '@/pages/Empleados';
import Asistencias from '@/pages/Asistencias';
import Servicios from '@/pages/Servicios';
import Cobros from '@/pages/Cobros';
import Inventario from '@/pages/Inventario';
import Documentos from '@/pages/Documentos';
import Turnos from '@/pages/Turno';
import Administracion from '@/pages/Administracion';
import AdminUsuarios from '@/pages/admin/Usuarios';
import AdminRoles from '@/pages/admin/Roles';
import AdminSedes from '@/pages/admin/Sede';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <PermissionsProvider>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/empleados" element={<Empleados />} />
          <Route path="/asistencias" element={<Asistencias />} />
          <Route path="/servicios" element={<Servicios />} />
          <Route path="/cobros" element={<Cobros />} />
          <Route path="/servicios/turnos" element={<Turnos />} />
          <Route path="/administracion" element={<Administracion />} />
          <Route path="/administracion/usuarios" element={<AdminUsuarios />} />
          <Route path="/administracion/roles" element={<AdminRoles />} />
          <Route path="/administracion/sedes" element={<AdminSedes />} />
          <Route path="/inventario" element={<Inventario />} />
          <Route path="/documentos" element={<Documentos />} />
        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
    </PermissionsProvider>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
