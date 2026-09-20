import type { PropsWithChildren } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth'
import {
  AuditPage,
  DashboardPage,
  JobDetailPage,
  JobsPage,
  LoginPage,
  MaintenancePage,
  MatchesPage,
  ReviewsPage,
  UserDetailPage,
  UsersPage,
  VerificationDetailPage,
  VerificationsPage,
} from './Pages'
import { AccessDenied, AppShell } from './Shell'
import type { Role } from './types'

function Protected({ children }: PropsWithChildren) {
  const { admin, loading } = useAuth()
  if (loading) return <div className="full-state"><span className="spinner" />Loading Kerjo Admin…</div>
  if (!admin) return <Navigate to="/login" replace />
  return children
}

function Roles({ allowed, children }: PropsWithChildren<{ allowed: Role[] }>) {
  const { can } = useAuth()
  return can(...allowed) ? children : <AccessDenied />
}

export default function App() {
  const staff: Role[] = ['superadmin', 'moderator']
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<Protected><AppShell /></Protected>}>
        <Route index element={<DashboardPage />} />
        <Route path="verifications" element={<VerificationsPage />} />
        <Route path="verifications/:id" element={<VerificationDetailPage />} />
        <Route path="users" element={<Roles allowed={staff}><UsersPage /></Roles>} />
        <Route path="users/:id" element={<Roles allowed={staff}><UserDetailPage /></Roles>} />
        <Route path="jobs" element={<Roles allowed={staff}><JobsPage /></Roles>} />
        <Route path="jobs/:id" element={<Roles allowed={staff}><JobDetailPage /></Roles>} />
        <Route path="matches" element={<Roles allowed={staff}><MatchesPage /></Roles>} />
        <Route path="messages" element={<Roles allowed={staff}><MatchesPage messages /></Roles>} />
        <Route path="reviews" element={<Roles allowed={staff}><ReviewsPage /></Roles>} />
        <Route path="audit-logs" element={<Roles allowed={staff}><AuditPage /></Roles>} />
        <Route path="maintenance" element={<Roles allowed={['superadmin']}><MaintenancePage /></Roles>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
