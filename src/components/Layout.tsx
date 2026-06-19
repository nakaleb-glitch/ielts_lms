import { Link, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { RoyalLogo, CambridgeLogo } from './BrandHeader'
import { ModuleNavDropdown } from './ModuleNavDropdown'

export function Layout() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const isStudent = profile?.role === 'student'

  return (
    <div className="min-h-screen bg-royal-grey">
      <header className="border-b-4 border-royal-blue bg-white shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/">
            <RoyalLogo showSubtitle compact />
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <ModuleNavDropdown
              label={isStudent ? 'My Tests' : 'Tests'}
              basePath={isStudent ? '/my-tests' : '/tests'}
            />
            <span className="text-slate-500">{profile?.display_name}</span>
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-md bg-royal-red px-3 py-1.5 text-white hover:opacity-90"
            >
              Sign out
            </button>
            <CambridgeLogo compact />
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
