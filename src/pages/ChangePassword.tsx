import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { DEFAULT_STUDENT_PASSWORD } from '../lib/studentAuth'

export function ChangePassword() {
  const { profile, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (password === DEFAULT_STUDENT_PASSWORD) {
      setError('Please choose a different password from the default.')
      return
    }

    setLoading(true)

    const { error: authError } = await supabase.auth.updateUser({ password })
    if (authError) {
      setLoading(false)
      setError(authError.message)
      return
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ must_change_password: false })
      .eq('id', profile!.id)

    setLoading(false)

    if (profileError) {
      setError(profileError.message)
      return
    }

    await refreshProfile()
    const home = profile?.role === 'student' ? '/my-tests/reading' : '/tests/reading'
    navigate(home, { replace: true })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-royal-grey px-4">
      <div className="w-full max-w-md rounded-xl border-t-4 border-royal-blue bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-xl font-bold text-slate-900">Change your password</h1>
        <p className="mb-6 text-sm text-slate-600">
          You must set a new password before continuing.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            placeholder="New password"
            className="w-full rounded-md border border-slate-300 px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
          <input
            type="password"
            placeholder="Confirm new password"
            className="w-full rounded-md border border-slate-300 px-3 py-2"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={6}
          />
          {error && <p className="text-sm text-royal-red">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-royal-blue py-2 font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save password'}
          </button>
        </form>
      </div>
    </div>
  )
}
