import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { AdminUserRow, UserRole } from '../../types/assessment'

interface CsvRow {
  student_id: string
  class: string
  name?: string
}

interface ImportResult {
  created_students: number
  created_classes: number
  assigned: number
  errors: string[]
}

const CSV_TEMPLATE = `student_id,class,name
S2024001,Year 10A,Jane Doe
S2024002,Year 10A,John Smith
S2024003,Year 10B,Maria Garcia
`

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

function downloadCsvTemplate() {
  const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'student-import-template.csv'
  link.click()
  URL.revokeObjectURL(url)
}

function schoolIdForUser(user: AdminUserRow): string {
  if (user.role === 'student') return user.student_id || '—'
  return user.staff_id || '—'
}

export function UserManagement() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [importing, setImporting] = useState(false)
  const [resettingId, setResettingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [showAddUser, setShowAddUser] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [csvPreview, setCsvPreview] = useState<CsvRow[]>([])
  const [importResult, setImportResult] = useState<ImportResult | null>(null)

  const [displayName, setDisplayName] = useState('')
  const [schoolId, setSchoolId] = useState('')
  const [role, setRole] = useState<UserRole>('student')

  const loadUsers = async () => {
    setLoading(true)
    const { data, error: loadError } = await supabase.rpc('list_users_for_admin')
    if (loadError) {
      setError(loadError.message)
      setUsers([])
    } else {
      setUsers(data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    loadUsers()
  }, [])

  const resetAddForm = () => {
    setDisplayName('')
    setSchoolId('')
    setRole('student')
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setCreating(true)

    const body = role === 'student'
      ? { role, student_id: schoolId, display_name: displayName || schoolId }
      : { role, staff_id: schoolId, display_name: displayName || schoolId }

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

    setSuccess(`Created ${role} account for ${schoolId}`)
    resetAddForm()
    setShowAddUser(false)
    loadUsers()
  }

  const handleResetPassword = async (user: AdminUserRow) => {
    const label = schoolIdForUser(user)
    if (!confirm(`Reset password for ${user.display_name} (${label}) to the default? They will be required to change it on next login.`)) {
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

    setSuccess(`Password reset for ${user.display_name}`)
  }

  const handleCsvFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    setCsvPreview(parseCsv(text))
    setImportResult(null)
    setShowImportModal(true)
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
    setShowImportModal(false)
    loadUsers()
  }

  if (loading) return <p>Loading users...</p>

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-slate-900">User Management</h1>

      <div className="mb-6 flex flex-wrap items-start gap-4">
        <div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-md bg-royal-blue px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Import CSV
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleCsvFile}
            className="hidden"
          />
          <button
            type="button"
            onClick={downloadCsvTemplate}
            className="mt-1 block text-xs text-royal-blue hover:underline"
          >
            download template
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowAddUser(true)
            setError('')
            setSuccess('')
          }}
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
        >
          Add user
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-royal-red/30 bg-red-50 px-4 py-3 text-sm text-royal-red">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}

      {showAddUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Add user</h2>
              <button
                type="button"
                onClick={() => {
                  setShowAddUser(false)
                  resetAddForm()
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <select
                className="w-full rounded-md border border-slate-300 px-3 py-2"
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
              >
                <option value="student">Student</option>
                <option value="teacher">Teacher</option>
              </select>
              <input
                type="text"
                placeholder={role === 'student' ? 'Student ID' : 'Staff ID'}
                className="w-full rounded-md border border-slate-300 px-3 py-2"
                value={schoolId}
                onChange={(e) => setSchoolId(e.target.value)}
                required
              />
              <input
                type="text"
                placeholder="Name (optional)"
                className="w-full rounded-md border border-slate-300 px-3 py-2"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
              <p className="text-xs text-slate-500">
                Default password is royal@123. User must change it on first login.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddUser(false)
                    resetAddForm()
                  }}
                  className="rounded-md px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-md bg-royal-blue px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Import CSV</h2>
              <button
                type="button"
                onClick={() => {
                  setShowImportModal(false)
                  setCsvPreview([])
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
            <p className="mb-4 text-sm text-slate-600">
              {csvPreview.length} row{csvPreview.length === 1 ? '' : 's'} ready to import.
            </p>
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
            {importResult && importResult.errors.length > 0 && (
              <div className="mb-4 rounded-md border border-royal-red/30 bg-red-50 px-4 py-3 text-sm text-royal-red">
                <p className="font-medium">Import warnings:</p>
                <ul className="mt-1 list-inside list-disc">
                  {importResult.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowImportModal(false)
                  setCsvPreview([])
                }}
                className="rounded-md px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={importing}
                className="rounded-md bg-royal-blue px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {importing ? 'Importing...' : 'Import'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="px-4 py-3 font-semibold text-slate-700">Name</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Student/Staff ID</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Role</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Class</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  No users yet. Import a CSV or add a user to get started.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-slate-900">{u.display_name}</td>
                  <td className="px-4 py-3 text-slate-600">{schoolIdForUser(u)}</td>
                  <td className="px-4 py-3 capitalize text-slate-600">{u.role}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {u.role === 'student' && u.classes ? u.classes : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => handleResetPassword(u)}
                      disabled={resettingId === u.id}
                      className="rounded-md bg-slate-100 px-3 py-1.5 text-xs hover:bg-slate-200 disabled:opacity-50"
                    >
                      {resettingId === u.id ? 'Resetting...' : 'Reset password'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
