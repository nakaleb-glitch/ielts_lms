import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Profile, UserRole } from '../../types/assessment'

export function UserManagement() {
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>('student')

  const loadUsers = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .in('role', ['student', 'teacher'])
      .order('display_name')
    setUsers(data || [])
    setLoading(false)
  }

  useEffect(() => {
    loadUsers()
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setCreating(true)

    const { data, error: fnError } = await supabase.functions.invoke('create-user', {
      body: { email, password, display_name: displayName, role },
    })

    setCreating(false)

    if (fnError) {
      setError(fnError.message)
      return
    }

    if (data?.error) {
      setError(data.error)
      return
    }

    setSuccess(`Created ${role} account for ${email}`)
    setDisplayName('')
    setEmail('')
    setPassword('')
    setRole('student')
    loadUsers()
  }

  if (loading) return <p>Loading users...</p>

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-slate-900">User Management</h1>
      <p className="mb-6 text-sm text-slate-600">Create student and teacher accounts.</p>

      <form onSubmit={handleCreate} className="mb-8 rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="mb-4 font-semibold text-slate-900">Create account</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <input
            type="text"
            placeholder="Display name"
            className="rounded-md border border-slate-300 px-3 py-2"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />
          <select
            className="rounded-md border border-slate-300 px-3 py-2"
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
          >
            <option value="student">Student</option>
            <option value="teacher">Teacher</option>
          </select>
          <input
            type="email"
            placeholder="Email"
            className="rounded-md border border-slate-300 px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password (min 6 characters)"
            className="rounded-md border border-slate-300 px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
        </div>
        {error && <p className="mt-3 text-sm text-royal-red">{error}</p>}
        {success && <p className="mt-3 text-sm text-green-600">{success}</p>}
        <button
          type="submit"
          disabled={creating}
          className="mt-4 rounded-md bg-royal-blue px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {creating ? 'Creating...' : 'Create account'}
        </button>
      </form>

      <div className="space-y-2">
        {users.map((u) => (
          <div
            key={u.id}
            className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3"
          >
            <div>
              <p className="font-medium text-slate-900">{u.display_name}</p>
              <p className="text-sm text-slate-500">{u.email}</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium capitalize text-slate-700">
              {u.role}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
