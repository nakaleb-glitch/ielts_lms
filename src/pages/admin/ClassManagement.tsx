import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { SchoolClass } from '../../types/assessment'

interface StudentRow {
  id: string
  student_id: string | null
  display_name: string
  class_names: string
}

interface TestOption {
  id: string
  title: string
}

function sortClassesNaturally(classes: SchoolClass[]): SchoolClass[] {
  return [...classes].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }),
  )
}

export function ClassManagement() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [classes, setClasses] = useState<SchoolClass[]>([])
  const [students, setStudents] = useState<StudentRow[]>([])
  const [assignedStudentIds, setAssignedStudentIds] = useState<Set<string>>(new Set())
  const [newClassName, setNewClassName] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const [showCreateClass, setShowCreateClass] = useState(false)
  const [addStudentsClass, setAddStudentsClass] = useState<SchoolClass | null>(null)
  const [seeResultsClass, setSeeResultsClass] = useState<SchoolClass | null>(null)
  const [classTests, setClassTests] = useState<TestOption[]>([])
  const [selectedTestId, setSelectedTestId] = useState('')
  const [loadingTests, setLoadingTests] = useState(false)

  const sortedClasses = useMemo(() => sortClassesNaturally(classes), [classes])

  const unassignedStudents = useMemo(
    () => students.filter((s) => !assignedStudentIds.has(s.id)),
    [students, assignedStudentIds],
  )

  const loadClasses = async () => {
    const { data } = await supabase.rpc('list_classes')
    setClasses(data || [])
  }

  const loadStudents = async () => {
    const { data } = await supabase.rpc('list_students')
    setStudents(data || [])
  }

  const openAddStudents = async (classItem: SchoolClass) => {
    setError('')
    setAddStudentsClass(classItem)

    const { data } = await supabase.from('class_members').select('student_id')
    setAssignedStudentIds(new Set((data || []).map((r) => r.student_id)))
  }

  const addStudent = async (studentId: string) => {
    if (!addStudentsClass) return

    const { error: insertError } = await supabase.from('class_members').insert({
      class_id: addStudentsClass.id,
      student_id: studentId,
    })
    if (insertError) {
      setError(insertError.message)
      return
    }

    setAssignedStudentIds((s) => new Set(s).add(studentId))
    loadClasses()
  }

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await Promise.all([loadClasses(), loadStudents()])
      setLoading(false)
    }
    init()
  }, [])

  const createClass = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile || !newClassName.trim()) return
    setError('')
    setCreating(true)

    const { error: insertError } = await supabase
      .from('classes')
      .insert({ name: newClassName.trim(), created_by: profile.id })
      .select()
      .single()

    setCreating(false)
    if (insertError) {
      setError(insertError.message)
      return
    }

    setNewClassName('')
    setShowCreateClass(false)
    await loadClasses()
  }

  const deleteClass = async (classItem: SchoolClass) => {
    if (!confirm(`Delete class "${classItem.name}"? Students will not be removed from the system.`)) return
    setError('')
    const { error: deleteError } = await supabase.from('classes').delete().eq('id', classItem.id)
    if (deleteError) {
      setError(deleteError.message)
      return
    }
    if (addStudentsClass?.id === classItem.id) setAddStudentsClass(null)
    if (seeResultsClass?.id === classItem.id) setSeeResultsClass(null)
    loadClasses()
  }

  const openSeeResults = async (classItem: SchoolClass) => {
    setError('')
    setSeeResultsClass(classItem)
    setSelectedTestId('')
    setLoadingTests(true)

    const { data: assigned } = await supabase
      .from('class_test_assignments')
      .select('test_id, tests(id, title)')
      .eq('class_id', classItem.id)

    let tests: TestOption[] = (assigned || [])
      .map((row) => {
        const testRaw = row.tests as { id: string; title: string } | { id: string; title: string }[] | null
        const test = Array.isArray(testRaw) ? testRaw[0] : testRaw
        return test ? { id: test.id, title: test.title } : null
      })
      .filter((t): t is TestOption => t !== null)

    if (tests.length === 0) {
      const { data: published } = await supabase
        .from('tests')
        .select('id, title')
        .eq('status', 'published')
        .eq('module', 'reading')
        .order('title')

      tests = published || []
    }

    setClassTests(tests)
    if (tests.length > 0) setSelectedTestId(tests[0].id)
    setLoadingTests(false)
  }

  const viewResults = () => {
    if (!seeResultsClass || !selectedTestId) return
    navigate(`/tests/${selectedTestId}/results?classId=${seeResultsClass.id}`)
  }

  if (loading) return <p>Loading classes...</p>

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900">Class Management</h1>
        <button
          type="button"
          onClick={() => {
            setShowCreateClass(true)
            setError('')
          }}
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
        >
          Create Class
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-royal-red/30 bg-red-50 px-4 py-3 text-sm text-royal-red">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="w-12 px-4 py-3 font-semibold text-slate-700">#</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Class Name</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Students</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedClasses.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                  No classes yet. Create a class or import students via CSV.
                </td>
              </tr>
            ) : (
              sortedClasses.map((c, index) => (
                <tr key={c.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 text-slate-500">{index + 1}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{c.name}</td>
                  <td className="px-4 py-3 text-slate-600">{c.member_count ?? 0}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openAddStudents(c)}
                        className="rounded-md bg-slate-100 px-3 py-1.5 text-xs hover:bg-slate-200"
                      >
                        Add Students
                      </button>
                      <button
                        type="button"
                        onClick={() => openSeeResults(c)}
                        className="rounded-md bg-slate-100 px-3 py-1.5 text-xs hover:bg-slate-200"
                      >
                        See Results
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteClass(c)}
                        className="rounded-md bg-red-50 px-3 py-1.5 text-xs text-royal-red hover:bg-red-100"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showCreateClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Create Class</h2>
              <button
                type="button"
                onClick={() => {
                  setShowCreateClass(false)
                  setNewClassName('')
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
            <form onSubmit={createClass} className="space-y-4">
              <input
                type="text"
                placeholder="Class name"
                className="w-full rounded-md border border-slate-300 px-3 py-2"
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                required
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateClass(false)
                    setNewClassName('')
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

      {addStudentsClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                Add Students — {addStudentsClass.name}
              </h2>
              <button
                type="button"
                onClick={() => setAddStudentsClass(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
            {students.length === 0 ? (
              <p className="text-sm text-slate-600">No students found. Create student accounts first.</p>
            ) : unassignedStudents.length === 0 ? (
              <p className="text-sm text-slate-600">No unassigned students available.</p>
            ) : (
              <div className="max-h-96 space-y-2 overflow-y-auto">
                {unassignedStudents.map((s) => (
                  <label
                    key={s.id}
                    className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3"
                  >
                    <div>
                      <p className="font-medium">{s.display_name}</p>
                      <p className="text-sm text-slate-500">{s.student_id || '—'}</p>
                      <p className="text-sm text-slate-500">{s.class_names || 'No class'}</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={false}
                      onChange={() => addStudent(s.id)}
                    />
                  </label>
                ))}
              </div>
            )}
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setAddStudentsClass(null)}
                className="rounded-md px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {seeResultsClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                See Results — {seeResultsClass.name}
              </h2>
              <button
                type="button"
                onClick={() => setSeeResultsClass(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
            {loadingTests ? (
              <p className="text-sm text-slate-600">Loading tests...</p>
            ) : classTests.length === 0 ? (
              <p className="text-sm text-slate-600">No published tests available.</p>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Test</label>
                  <select
                    className="w-full rounded-md border border-slate-300 px-3 py-2"
                    value={selectedTestId}
                    onChange={(e) => setSelectedTestId(e.target.value)}
                  >
                    {classTests.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setSeeResultsClass(null)}
                    className="rounded-md px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={viewResults}
                    disabled={!selectedTestId}
                    className="rounded-md bg-royal-blue px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                  >
                    View Results
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
