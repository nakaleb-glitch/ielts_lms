import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import type { UserRole } from '../types/assessment'

export function ProtectedRoute({ roles }: { roles?: UserRole[] }) {
  const { user, profile, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-slate-600">Loading...</p>
      </div>
    )
  }

  if (!user || !profile) {
    return <Navigate to="/login" replace />
  }

  if (profile.must_change_password && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />
  }

  if (roles && !roles.includes(profile.role)) {
    const home = profile.role === 'student' ? '/my-tests/reading' : '/tests/reading'
    return <Navigate to={home} replace />
  }

  return <Outlet />
}

export function RoleRedirect() {
  const { profile, loading } = useAuth()

  if (loading) return null
  if (!profile) return <Navigate to="/login" replace />
  if (profile.must_change_password) return <Navigate to="/change-password" replace />
  if (profile.role === 'student') return <Navigate to="/my-tests/reading" replace />
  return <Navigate to="/tests/reading" replace />
}
