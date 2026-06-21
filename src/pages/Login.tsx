import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { RoyalLogo } from '../components/BrandHeader'

export function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const result = await signIn(identifier, password)

    setLoading(false)
    if (result.error) {
      setError(result.error.message)
      return
    }
    navigate('/')
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-8">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/images/login-background.png')" }}
        aria-hidden
      />
      <div className="absolute inset-0 bg-slate-900/45" aria-hidden />

      <div className="relative z-10 w-full max-w-md rounded-xl border-t-4 border-royal-blue bg-white p-8 shadow-xl">
        <div className="mb-6 flex items-center gap-3 border-b border-slate-100 pb-6">
          <RoyalLogo />
          <div className="border-l border-slate-200 pl-3">
            <h1 className="text-lg font-semibold text-slate-800">IELTS Assessment Hub</h1>
          </div>
        </div>
        <p className="mb-6 text-sm text-slate-600">
          Sign in with your Student ID or Staff ID and password.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="Student ID or Staff ID"
            className="w-full rounded-md border border-slate-300 px-3 py-2"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
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
            {loading ? 'Please wait...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
