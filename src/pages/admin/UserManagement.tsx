import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Profile, UserRole } from '../../types/assessment'

interface CsvRow {
  student_id: string
  class: string
  name?: string
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean)
  if (lines.length === 0) return []

  const header = lines[0].split(',').map((h) => h.trim().toLowerCase())
  const studentIdx = header.indexOf('student_id')
  const classIdx = header.indexOf('class')
  const nameIdx = header.indexOf('name')

  const startRow = studentIdx >= 0 && classIdx >= 0 ? 1 : 0
  const sIdx = studentIdx >= 0 ? studentIdx : 0
  const cIdx = classIdx >= 0 ? classIdx : 1
  const nIdx = nameIdx >= 0 ? nameIdx : -1

  return lines.slice(startRow).map((line) => {
    const cols = line.split(',').map((c) => c.trim())
    return {
      student_id: cols[sIdx] || '',
      class: cols[cIdx] || '',
      name: nIdx >= 0 ? cols[nIdx] : undefined,
    }
  })
}

const CSV_TEMPLATE = `student_id,class,name
S2024001,Year 10A,Jane Doe
S2024002,Year 10A,John Smith
S2024003,Year 10B,Maria Garcia
`

function downloadCsvTemplate() {
  const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'student-import-template.csv'
  link.click()
  URL.revokeObjectURL(url)
}

interface ImportResult {
  created_students: number
  created_classes: number
  assigned: number
  errors: string[]
}

export function UserManagement() {
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [importing, setImporting] = useState(false)
  const [resettingId, setResettingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [displayName, setDisplayName] = useState('')
  const [studentId, setStudentId] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>('student')

  const [csvPreview, setCsvPreview] = useState<CsvRow[]>([])
  const [importResult, setImportResult] = useState<ImportResult | null>(null)

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

    const body = role === 'student'
      ? { role, student_id: studentId, display_name: displayName || studentId }
      : { role, email, display_name: displayName, password: password || undefined }

    const { data, error: fnError } = await supabase.functions.invoke('create-user', { body })

    setCreating(false)

    if (fnError) {
      setError(fnError.message)
      return
    }

    if (data?.error) {
      setError(data.error)
      return
    }

    const label = role === 'student' ? studentId : email
    setSuccess(`Created ${role} account for ${label}`)
    setDisplayName('')
    setStudentId('')
    setEmail('')
    setPassword('')
    setRole('student')
    loadUsers()
  }

  const handleResetPassword = async (user: Profile) => {
    const label = user.student_id || user.email || user.display_name
    if (!confirm(`Reset password for ${label} to the default? They will be required to change it on next login.`)) {
      return
    }

    setResettingId(user.id)
    setError('')
    setSuccess('')

    const { data, error: fnError } = await supabase.functions.invoke('reset-password', {
      body: { user_id: user.id },
    })

    setResettingId(null)

    if (fnError) {
      setError(fnError.message)
      return
    }

    if (data?.error) {
      setError(data.error)
      return
    }

    setSuccess(`Password reset for ${label}`)
  }

  const handleCsvFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    setCsvPreview(parseCsv(text))
    setImportResult(null)
    e.target.value = ''
  }

  const handleImport = async () => {
    if (csvPreview.length === 0) return
    setImporting(true)
    setError('')
    setSuccess('')
    setImportResult(null)

    const { data, error: fnError } = await supabase.functions.invoke('import-students-csv', {
      body: { rows: csvPreview },
    })

    setImporting(false)

    if (fnError) {
      setError(fnError.message)
      return
    }

    if (data?.error) {
      setError(data.error)
      return
    }

    setImportResult(data as ImportResult)
    setSuccess(`Import complete: ${data.created_students} students created, ${data.created_classes} classes created, ${data.assigned} assignments.`)
    setCsvPreview([])
    loadUsers()
  }

  if (loading) return <p>Loading users...</p>

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-slate-900">User Management</h1>
      <p className="mb-6 text-sm text-slate-600">
        Create student and teacher accounts. Students sign in with their Student ID and default password{' '}
        <code className="rounded bg-slate-100 px-1">royal@123</code>.
      </p>

      <form onSubmit={handleCreate} className="mb-8 rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="mb-4 font-semibold text-slate-900">Create account</h2>
        <div className="mb-4">
          <select
            className="rounded-md border border-slate-300 px-3 py-2"
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
          >
            <option value="student">Student</option>
            <option value="teacher">Teacher</option>
          </select>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {role === 'student' ? (
            <>
              <input
                type="text"
                placeholder="Student ID"
                className="rounded-md border border-slate-300 px-3 py-2"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                required
              />
              <input
                type="text"
                placeholder="Display name (optional)"
                className="rounded-md border border-slate-300 px-3 py-2"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </>
          ) : (
            <>
              <input
                type="text"
                placeholder="Display name"
                className="rounded-md border border-slate-300 px-3 py-2"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
              />
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
                placeholder="Password (optional, min 6 characters)"
                className="rounded-md border border-slate-300 px-3 py-2"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
              />
            </>
          )}
        </div>
        {role === 'student' && (
          <p className="mt-3 text-xs text-slate-500">
            Default password is royal@123. Student must change it on first login.
          </p>
        )}
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

      <div className="mb-8 rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="mb-2 font-semibold text-slate-900">Import students from CSV</h2>
        <p className="mb-4 text-sm text-slate-600">
          CSV columns: <code className="rounded bg-slate-100 px-1">student_id,class</code> or{' '}
          <code className="rounded bg-slate-100 px-1">student_id,class,name</code>. Creates students and classes as needed.
        </p>
        <button
          type="button"
          onClick={downloadCsvTemplate}
          className="mb-4 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50"
        >
          Download CSV template
        </button>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={handleCsvFile}
          className="mb-4 block text-sm"
        />
        {csvPreview.length > 0 && (
          <>
            <p className="mb-2 text-sm text-slate-600">{csvPreview.length} rows ready to import</p>
            <div className="mb-4 max-h-48 overflow-y-auto rounded border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2">Student ID</th>
                    <th className="px-3 py-2">Class</th>
                    <th className="px-3 py-2">Name</th>
                  </tr>
                </thead>
                <tbody>
                  {csvPreview.slice(0, 10).map((row, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="px-3 py-2">{row.student_id}</td>
                      <td className="px-3 py-2">{row.class}</td>
                      <td className="px-3 py-2">{row.name || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {csvPreview.length > 10 && (
                <p className="px-3 py-2 text-xs text-slate-500">…and {csvPreview.length - 10} more</p>
              )}
            </div>
            <button
              type="button"
              onClick={handleImport}
              disabled={importing}
              className="rounded-md bg-royal-blue px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {importing ? 'Importing...' : 'Import CSV'}
            </button>
          </>
        )}
        {importResult && importResult.errors.length > 0 && (
          <div className="mt-4 rounded-md border border-royal-red/30 bg-red-50 px-4 py-3 text-sm text-royal-red">
            <p className="font-medium">Import warnings:</p>
            <ul className="mt-1 list-inside list-disc">
              {importResult.errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="space-y-2">
        {users.map((u) => (
          <div
            key={u.id}
            className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3"
          >
            <div>
              <p className="font-medium text-slate-900">{u.display_name}</p>
              <p className="text-sm text-slate-500">
                {u.role === 'student' ? `ID: ${u.student_id || '—'}` : u.email}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium capitalize text-slate-700">
                {u.role}
              </span>
              <button
                type="button"
                onClick={() => handleResetPassword(u)}
                disabled={resettingId === u.id}
                className="rounded-md bg-slate-100 px-3 py-1.5 text-xs hover:bg-slate-200 disabled:opacity-50"
              >
                {resettingId === u.id ? 'Resetting...' : 'Reset password'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
