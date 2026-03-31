import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

// Pages
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Wabas from './pages/Wabas'
import Templates from './pages/Templates'
import DisparosNovo from './pages/Disparos/Novo'
import DisparosHistorico from './pages/Disparos/Historico'
import Configuracoes from './pages/Configuracoes'

// Layout
import Layout from './components/Layout/Layout'

// Simple guard: redirects to /login if no token in localStorage.
// Full auth state management lives in useAuth — this is just a route-level check.
function PrivateRoute({ children }) {
  const token = localStorage.getItem('token')
  return token ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes — /login serves both login (#) and cadastro (#cadastro) tabs */}
        <Route path="/login"    element={<Login />} />
        <Route path="/cadastro" element={<Login />} />

        {/* Private routes */}
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard"           element={<Dashboard />} />
          <Route path="wabas"               element={<Wabas />} />
          <Route path="templates"           element={<Templates />} />
          <Route path="disparos/novo"       element={<DisparosNovo />} />
          <Route path="disparos/historico"  element={<DisparosHistorico />} />
          <Route path="configuracoes"       element={<Configuracoes />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
