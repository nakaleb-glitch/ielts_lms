import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import type { UserRole } from '../types/assessment'

export function ProtectedRoute({ roles }: { roles?: UserRole[] }) {
  const { user, profile, loading } = useAuth()

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
  if (profile.role === 'student') return <Navigate to="/my-tests/reading" replace />
  return <Navigate to="/tests/reading" replace />
}
