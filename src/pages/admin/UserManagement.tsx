import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { AdminUserRow, SchoolClass, UserRole } from '../../types/assessment'

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
  const [showEditUser, setShowEditUser] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [csvPreview, setCsvPreview] = useState<CsvRow[]>([])
  const [importResult, setImportResult] = useState<ImportResult | null>(null)

  const [displayName, setDisplayName] = useState('')
  const [schoolId, setSchoolId] = useState('')
  const [role, setRole] = useState<UserRole>('student')

  const [editingUser, setEditingUser] = useState<AdminUserRow | null>(null)
  const [editDisplayName, setEditDisplayName] = useState('')
  const [editSchoolId, setEditSchoolId] = useState('')
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([])
  const [originalClassIds, setOriginalClassIds] = useState<Set<string>>(new Set())
  const [allClasses, setAllClasses] = useState<SchoolClass[]>([])
  const [saving, setSaving] = useState(false)

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

  const resetEditForm = () => {
    setEditingUser(null)
    setEditDisplayName('')
    setEditSchoolId('')
    setSelectedClassIds([])
    setOriginalClassIds(new Set())
  }

  const loadClasses = async () => {
    const { data } = await supabase.rpc('list_classes')
    setAllClasses(data || [])
  }

  const openEditUser = async (user: AdminUserRow) => {
    setError('')
    setSuccess('')
    setEditingUser(user)
    setEditDisplayName(user.display_name)
    setEditSchoolId(user.role === 'student' ? (user.student_id || '') : (user.staff_id || ''))
    setShowEditUser(true)

    if (allClasses.length === 0) {
      await loadClasses()
    }

    if (user.role === 'student') {
      const { data: memberships } = await supabase
        .from('class_members')
        .select('class_id')
        .eq('student_id', user.id)
      const ids = (memberships || []).map((m) => m.class_id)
      setSelectedClassIds(ids)
      setOriginalClassIds(new Set(ids))
    } else {
      setSelectedClassIds([])
      setOriginalClassIds(new Set())
    }
  }

  const toggleEditClass = (classId: string) => {
    setSelectedClassIds((prev) =>
      prev.includes(classId) ? prev.filter((id) => id !== classId) : [...prev, classId],
    )
  }

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUser) return

    setError('')
    setSuccess('')
    setSaving(true)

    const body = editingUser.role === 'student'
      ? {
          user_id: editingUser.id,
          display_name: editDisplayName || editSchoolId,
          student_id: editSchoolId,
        }
      : {
          user_id: editingUser.id,
          display_name: editDisplayName || editSchoolId,
          staff_id: editSchoolId,
        }

    const { data, error: fnError } = await supabase.functions.invoke('update-user', { body })

    if (fnError) {
      setSaving(false)
      setError(fnError.message)
      return
    }

    if (data?.error) {
      setSaving(false)
      setError(data.error)
      return
    }

    if (editingUser.role === 'student') {
      const selectedSet = new Set(selectedClassIds)
      const toRemove = [...originalClassIds].filter((id) => !selectedSet.has(id))
      const toAdd = selectedClassIds.filter((id) => !originalClassIds.has(id))

      for (const classId of toRemove) {
        const { error: deleteError } = await supabase
          .from('class_members')
          .delete()
          .eq('class_id', classId)
          .eq('student_id', editingUser.id)
        if (deleteError) {
          setSaving(false)
          setError(deleteError.message)
          return
        }
      }

      for (const classId of toAdd) {
        const { error: insertError } = await supabase.from('class_members').insert({
          class_id: classId,
          student_id: editingUser.id,
        })
        if (insertError) {
          setSaving(false)
          setError(insertError.message)
          return
        }
      }
    }

    setSaving(false)
    setSuccess(`Updated ${editingUser.display_name}`)
    setShowEditUser(false)
    resetEditForm()
    loadUsers()
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
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900">User Management</h1>
        <div className="flex flex-wrap items-center gap-4">
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
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
          >
            Download CSV
          </button>
          <button
            type="button"
            onClick={() => {
              setShowAddUser(true)
              setError('')
              setSuccess('')
            }}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
          >
            Add User
          </button>
        </div>
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
              <h2 className="text-lg font-semibold text-slate-900">Add User</h2>
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

      {showEditUser && editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Edit User</h2>
              <button
                type="button"
                onClick={() => {
                  setShowEditUser(false)
                  resetEditForm()
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Role</label>
                <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 capitalize text-slate-600">
                  {editingUser.role}
                </p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  {editingUser.role === 'student' ? 'Student ID' : 'Staff ID'}
                </label>
                <input
                  type="text"
                  className="w-full rounded-md border border-slate-300 px-3 py-2"
                  value={editSchoolId}
                  onChange={(e) => setEditSchoolId(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
                <input
                  type="text"
                  className="w-full rounded-md border border-slate-300 px-3 py-2"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                />
              </div>
              {editingUser.role === 'student' && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Class</label>
                  {allClasses.length === 0 ? (
                    <p className="text-sm text-slate-500">No classes available.</p>
                  ) : (
                    <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border border-slate-200 p-3">
                      {allClasses.map((c) => (
                        <label
                          key={c.id}
                          className="flex cursor-pointer items-center gap-2 text-sm text-slate-700"
                        >
                          <input
                            type="checkbox"
                            checked={selectedClassIds.includes(c.id)}
                            onChange={() => toggleEditClass(c.id)}
                          />
                          {c.name}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditUser(false)
                    resetEditForm()
                  }}
                  className="rounded-md px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-md bg-royal-blue px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save'}
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
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => openEditUser(u)}
                        className="rounded-md bg-slate-100 px-3 py-1.5 text-xs hover:bg-slate-200"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleResetPassword(u)}
                        disabled={resettingId === u.id}
                        className="rounded-md bg-slate-100 px-3 py-1.5 text-xs hover:bg-slate-200 disabled:opacity-50"
                      >
                        {resettingId === u.id ? 'Resetting...' : 'Reset Password'}
                      </button>
                    </div>
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
