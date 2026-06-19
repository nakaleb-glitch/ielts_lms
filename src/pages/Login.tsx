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
    <div className="flex min-h-screen flex-col items-center justify-center bg-royal-grey px-4 py-8">
      <div className="mb-6">
        <RoyalLogo showSubtitle />
      </div>
      <div className="w-full max-w-md rounded-xl border-t-4 border-royal-blue bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-xl font-bold text-slate-900">IELTS Assessment Hub</h1>
        <p className="mb-6 text-sm text-slate-600">
          Students: sign in with your Student ID. Teachers and admins: sign in with your email.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="Student ID or email"
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
