import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { SchoolClass } from '../../types/assessment'

interface StudentRow {
  id: string
  display_name: string
  email: string | null
}

export function ClassManagement() {
  const { profile } = useAuth()
  const [classes, setClasses] = useState<SchoolClass[]>([])
  const [students, setStudents] = useState<StudentRow[]>([])
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null)
  const [members, setMembers] = useState<Set<string>>(new Set())
  const [newClassName, setNewClassName] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const loadClasses = async () => {
    const { data } = await supabase.rpc('list_classes')
    setClasses(data || [])
  }

  const loadStudents = async () => {
    const { data } = await supabase.rpc('list_students')
    setStudents(data || [])
  }

  const loadMembers = async (classId: string) => {
    const { data } = await supabase.rpc('list_class_members', { p_class_id: classId })
    setMembers(new Set((data || []).map((m: StudentRow) => m.id)))
  }

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await Promise.all([loadClasses(), loadStudents()])
      setLoading(false)
    }
    init()
  }, [])

  useEffect(() => {
    if (selectedClassId) loadMembers(selectedClassId)
    else setMembers(new Set())
  }, [selectedClassId])

  const createClass = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile || !newClassName.trim()) return
    setError('')
    setCreating(true)

    const { data, error: insertError } = await supabase
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
    await loadClasses()
    if (data) setSelectedClassId(data.id)
  }

  const deleteClass = async (classId: string) => {
    if (!confirm('Delete this class? Students will not be removed from the system.')) return
    await supabase.from('classes').delete().eq('id', classId)
    if (selectedClassId === classId) setSelectedClassId(null)
    loadClasses()
  }

  const toggleMember = async (studentId: string) => {
    if (!selectedClassId) return

    if (members.has(studentId)) {
      await supabase
        .from('class_members')
        .delete()
        .eq('class_id', selectedClassId)
        .eq('student_id', studentId)
      setMembers((s) => {
        const next = new Set(s)
        next.delete(studentId)
        return next
      })
    } else {
      await supabase.from('class_members').insert({
        class_id: selectedClassId,
        student_id: studentId,
      })
      setMembers((s) => new Set(s).add(studentId))
    }
    loadClasses()
  }

  if (loading) return <p>Loading classes...</p>

  const selectedClass = classes.find((c) => c.id === selectedClassId)

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-slate-900">Class Management</h1>
      <p className="mb-6 text-sm text-slate-600">Organize students into classes for bulk test assignment.</p>

      <form onSubmit={createClass} className="mb-6 flex gap-3">
        <input
          type="text"
          placeholder="New class name"
          className="flex-1 rounded-md border border-slate-300 px-3 py-2"
          value={newClassName}
          onChange={(e) => setNewClassName(e.target.value)}
          required
        />
        <button
          type="submit"
          disabled={creating}
          className="rounded-md bg-royal-blue px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {creating ? 'Creating...' : 'Create class'}
        </button>
      </form>

      {error && <p className="mb-4 text-sm text-royal-red">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-2">
          <h2 className="font-semibold text-slate-900">Classes</h2>
          {classes.length === 0 ? (
            <p className="text-sm text-slate-600">No classes yet.</p>
          ) : (
            classes.map((c) => (
              <div
                key={c.id}
                className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
                  selectedClassId === c.id
                    ? 'border-royal-blue bg-blue-50'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setSelectedClassId(c.id)}
                  className="flex-1 text-left"
                >
                  <p className="font-medium text-slate-900">{c.name}</p>
                  <p className="text-sm text-slate-500">{c.member_count ?? 0} students</p>
                </button>
                <button
                  type="button"
                  onClick={() => deleteClass(c.id)}
                  className="ml-2 rounded-md bg-red-50 px-2 py-1 text-xs text-royal-red hover:bg-red-100"
                >
                  Delete
                </button>
              </div>
            ))
          )}
        </div>

        <div>
          <h2 className="mb-2 font-semibold text-slate-900">
            {selectedClass ? `Members — ${selectedClass.name}` : 'Select a class'}
          </h2>
          {!selectedClassId ? (
            <p className="text-sm text-slate-600">Choose a class to add or remove students.</p>
          ) : students.length === 0 ? (
            <p className="text-sm text-slate-600">No students found. Create student accounts first.</p>
          ) : (
            <div className="max-h-96 space-y-2 overflow-y-auto">
              {students.map((s) => (
                <label
                  key={s.id}
                  className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3"
                >
                  <div>
                    <p className="font-medium">{s.display_name}</p>
                    <p className="text-sm text-slate-500">{s.email}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={members.has(s.id)}
                    onChange={() => toggleMember(s.id)}
                  />
                </label>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
