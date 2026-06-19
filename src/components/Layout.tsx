import { Link, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function Layout() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const isStudent = profile?.role === 'student'

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="text-lg font-semibold text-slate-900">
            IELTS Reading LMS
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            {isStudent ? (
              <Link to="/my-tests" className="text-slate-700 hover:text-slate-900">
                My Tests
              </Link>
            ) : (
              <>
                <Link to="/tests" className="text-slate-700 hover:text-slate-900">
                  Tests
                </Link>
              </>
            )}
            <span className="text-slate-500">{profile?.display_name}</span>
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-md bg-slate-100 px-3 py-1.5 text-slate-700 hover:bg-slate-200"
            >
              Sign out
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
