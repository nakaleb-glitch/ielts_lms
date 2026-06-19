import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { BrandHeader } from '../components/BrandHeader'

type SignUpRole = 'teacher' | 'student'

export function Login() {
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [role, setRole] = useState<SignUpRole>('teacher')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const result = mode === 'login'
      ? await signIn(email, password)
      : await signUp(email, password, displayName, role)

    setLoading(false)
    if (result.error) {
      setError(result.error.message)
      return
    }
    navigate('/')
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-royal-grey px-4 py-8">
      <div className="mb-6">
        <BrandHeader />
      </div>
      <div className="w-full max-w-md rounded-xl border-t-4 border-royal-blue bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-xl font-bold text-slate-900">IELTS Reading LMS</h1>
        <p className="mb-6 text-sm text-slate-600">Sign in to create or take reading tests.</p>

        <div className="mb-4 flex gap-2">
          <button
            type="button"
            className={`flex-1 rounded-md py-2 text-sm ${mode === 'login' ? 'bg-royal-blue text-white' : 'bg-slate-100'}`}
            onClick={() => setMode('login')}
          >
            Sign in
          </button>
          <button
            type="button"
            className={`flex-1 rounded-md py-2 text-sm ${mode === 'signup' ? 'bg-royal-blue text-white' : 'bg-slate-100'}`}
            onClick={() => setMode('signup')}
          >
            Sign up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <>
              <input
                type="text"
                placeholder="Display name"
                className="w-full rounded-md border border-slate-300 px-3 py-2"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
              />
              <select
                className="w-full rounded-md border border-slate-300 px-3 py-2"
                value={role}
                onChange={(e) => setRole(e.target.value as SignUpRole)}
              >
                <option value="teacher">Teacher</option>
                <option value="student">Student</option>
              </select>
            </>
          )}
          <input
            type="email"
            placeholder="Email"
            className="w-full rounded-md border border-slate-300 px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            className="w-full rounded-md border border-slate-300 px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
          {error && <p className="text-sm text-royal-red">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-royal-blue py-2 font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  )
}
