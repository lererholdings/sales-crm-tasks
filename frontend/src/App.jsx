import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthenticateWithRedirectCallback } from '@clerk/clerk-react'
import Navbar from './components/layout/Navbar.jsx'
import ProtectedRoute from './components/auth/ProtectedRoute.jsx'
import TasksPage from './pages/TasksPage.jsx'
import AccountsPage from './pages/AccountsPage.jsx'
import AdminPage from './pages/AdminPage.jsx'

function Layout({ children }) {
  return (
    <div className="flex h-screen flex-col bg-bg-page">
      <Navbar />
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/sso-callback" element={<AuthenticateWithRedirectCallback />} />
      <Route path="/" element={<Navigate to="/tasks" replace />} />
      <Route
        path="/tasks"
        element={
          <ProtectedRoute>
            <Layout>
              <TasksPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/accounts"
        element={
          <ProtectedRoute>
            <Layout>
              <AccountsPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <Layout>
              <AdminPage />
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}
