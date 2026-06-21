import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { SchoolClass } from '../../types/assessment'

interface StudentRow {
  id: string
  student_id: string | null
  display_name: string
  class_names: string
}

type AssignTab = 'students' | 'classes'

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false
  for (const id of a) if (!b.has(id)) return false
  return true
}

function addedIds(from: Set<string>, to: Set<string>): string[] {
  return [...to].filter((id) => !from.has(id))
}

function removedIds(from: Set<string>, to: Set<string>): string[] {
  return [...from].filter((id) => !to.has(id))
}

export function AssignTest() {
  const { testId } = useParams<{ testId: string }>()
  const { profile } = useAuth()
  const [tab, setTab] = useState<AssignTab>('students')
  const [students, setStudents] = useState<StudentRow[]>([])
  const [classes, setClasses] = useState<SchoolClass[]>([])
  const [savedStudents, setSavedStudents] = useState<Set<string>>(new Set())
  const [savedClasses, setSavedClasses] = useState<Set<string>>(new Set())
  const [pendingStudents, setPendingStudents] = useState<Set<string>>(new Set())
  const [pendingClasses, setPendingClasses] = useState<Set<string>>(new Set())
  const [testTitle, setTestTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)

  useEffect(() => {
    load()
  }, [testId])

  const load = async () => {
    if (!testId) return
    setLoading(true)
    setError('')

    const { data: test } = await supabase.from('tests').select('title').eq('id', testId).single()
    setTestTitle(test?.title || '')

    const [{ data: studentList }, { data: classList }, { data: assignments }, { data: classAssignments }] =
      await Promise.all([
        supabase.rpc('list_students'),
        supabase.rpc('list_classes'),
        supabase.from('test_assignments').select('student_id').eq('test_id', testId),
        supabase.from('class_test_assignments').select('class_id').eq('test_id', testId),
      ])

    const studentIds = new Set((assignments || []).map((a) => a.student_id))
    const classIds = new Set((classAssignments || []).map((a) => a.class_id))

    setStudents(studentList || [])
    setClasses(classList || [])
    setSavedStudents(studentIds)
    setSavedClasses(classIds)
    setPendingStudents(new Set(studentIds))
    setPendingClasses(new Set(classIds))
    setLoading(false)
  }

  const hasChanges = useMemo(
    () => !setsEqual(pendingStudents, savedStudents) || !setsEqual(pendingClasses, savedClasses),
    [pendingStudents, savedStudents, pendingClasses, savedClasses]
  )

  const changeSummary = useMemo(() => {
    const studentMap = new Map(students.map((s) => [s.id, s]))
    const classMap = new Map(classes.map((c) => [c.id, c]))

    return {
      addClasses: addedIds(savedClasses, pendingClasses).map((id) => classMap.get(id)?.name || 'Class'),
      removeClasses: removedIds(savedClasses, pendingClasses).map((id) => classMap.get(id)?.name || 'Class'),
      addStudents: addedIds(savedStudents, pendingStudents).map(
        (id) => studentMap.get(id)?.display_name || 'Student'
      ),
      removeStudents: removedIds(savedStudents, pendingStudents).map(
        (id) => studentMap.get(id)?.display_name || 'Student'
      ),
    }
  }, [savedClasses, pendingClasses, savedStudents, pendingStudents, students, classes])

  const togglePendingStudent = (studentId: string) => {
    setSuccess('')
    setPendingStudents((prev) => {
      const next = new Set(prev)
      if (next.has(studentId)) next.delete(studentId)
      else next.add(studentId)
      return next
    })
  }

  const togglePendingClass = (classId: string) => {
    setSuccess('')
    setPendingClasses((prev) => {
      const next = new Set(prev)
      if (next.has(classId)) next.delete(classId)
      else next.add(classId)
      return next
    })
  }

  const resetPending = () => {
    setError('')
    setSuccess('')
    setPendingStudents(new Set(savedStudents))
    setPendingClasses(new Set(savedClasses))
  }

  const applyChanges = async () => {
    if (!testId || !profile || !hasChanges) return
    setSaving(true)
    setError('')
    setSuccess('')

    const classesToRemove = removedIds(savedClasses, pendingClasses)
    const classesToAdd = addedIds(savedClasses, pendingClasses)
    const studentsToAdd = addedIds(savedStudents, pendingStudents)
    const studentsToRemove = removedIds(savedStudents, pendingStudents)

    for (const classId of classesToRemove) {
      const { error: rpcError } = await supabase.rpc('unassign_test_from_class', {
        p_test_id: testId,
        p_class_id: classId,
      })
      if (rpcError) {
        setSaving(false)
        setConfirmOpen(false)
        setError(rpcError.message)
        return
      }
    }

    for (const classId of classesToAdd) {
      const { error: rpcError } = await supabase.rpc('assign_test_to_class', {
        p_test_id: testId,
        p_class_id: classId,
      })
      if (rpcError) {
        setSaving(false)
        setConfirmOpen(false)
        setError(rpcError.message)
        return
      }
    }

    for (const studentId of studentsToAdd) {
      const { error: upsertError } = await supabase.from('test_assignments').upsert(
        {
          test_id: testId,
          student_id: studentId,
          assigned_by: profile.id,
        },
        { onConflict: 'test_id,student_id' }
      )
      if (upsertError) {
        setSaving(false)
        setConfirmOpen(false)
        setError(upsertError.message)
        return
      }
    }

    for (const studentId of studentsToRemove) {
      const { error: deleteError } = await supabase
        .from('test_assignments')
        .delete()
        .eq('test_id', testId)
        .eq('student_id', studentId)
      if (deleteError) {
        setSaving(false)
        setConfirmOpen(false)
        setError(deleteError.message)
        return
      }
    }

    setConfirmOpen(false)
    setSaving(false)
    setSuccess('Assignments saved.')
    await load()
  }

  if (loading) return <p>Loading...</p>

  const pendingChangeCount =
    changeSummary.addClasses.length +
    changeSummary.removeClasses.length +
    changeSummary.addStudents.length +
    changeSummary.removeStudents.length

  return (
    <div className="pb-28">
      <Link to="/tests/reading" className="text-sm text-royal-blue hover:underline">← Back to tests</Link>
      <h1 className="mb-2 mt-4 text-2xl font-bold">Assign: {testTitle}</h1>
      <p className="mb-4 text-sm text-slate-600">
        Select students or classes below, then click <strong>Confirm assignments</strong> to save.
      </p>

      <div className="mb-6 flex gap-2">
        <button
          type="button"
          onClick={() => setTab('students')}
          className={`rounded-md px-4 py-2 text-sm ${tab === 'students' ? 'bg-royal-blue text-white' : 'bg-slate-100'}`}
        >
          Students
        </button>
        <button
          type="button"
          onClick={() => setTab('classes')}
          className={`rounded-md px-4 py-2 text-sm ${tab === 'classes' ? 'bg-royal-blue text-white' : 'bg-slate-100'}`}
        >
          Classes
        </button>
      </div>

      {error && <p className="mb-4 text-sm text-royal-red">{error}</p>}
      {success && <p className="mb-4 text-sm text-green-700">{success}</p>}

      {tab === 'students' && (
        students.length === 0 ? (
          <p className="text-slate-600">No students found. Ask an admin to create student accounts.</p>
        ) : (
          <div className="space-y-2">
            {students.map((s) => (
              <label
                key={s.id}
                className={`flex cursor-pointer items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 ${
                  saving ? 'pointer-events-none opacity-60' : ''
                }`}
              >
                <div>
                  <p className="font-medium">{s.display_name}</p>
                  <p className="text-sm text-slate-500">{s.student_id || '—'}</p>
                  <p className="text-sm text-slate-500">{s.class_names || 'No class'}</p>
                </div>
                <input
                  type="checkbox"
                  checked={pendingStudents.has(s.id)}
                  disabled={saving}
                  onChange={() => togglePendingStudent(s.id)}
                />
              </label>
            ))}
          </div>
        )
      )}

      {tab === 'classes' && (
        classes.length === 0 ? (
          <p className="text-slate-600">No classes found. Ask an admin to create classes.</p>
        ) : (
          <div className="space-y-2">
            {classes.map((c) => (
              <label
                key={c.id}
                className={`flex cursor-pointer items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 ${
                  saving ? 'pointer-events-none opacity-60' : ''
                }`}
              >
                <div>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-sm text-slate-500">{c.member_count ?? 0} students</p>
                </div>
                <input
                  type="checkbox"
                  checked={pendingClasses.has(c.id)}
                  disabled={saving}
                  onChange={() => togglePendingClass(c.id)}
                />
              </label>
            ))}
          </div>
        )
      )}

      <div className="fixed bottom-0 left-0 right-0 border-t border-slate-200 bg-white px-4 py-4 shadow-lg">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            {pendingClasses.size} class{pendingClasses.size === 1 ? '' : 'es'},{' '}
            {pendingStudents.size} student{pendingStudents.size === 1 ? '' : 's'} selected
            {hasChanges && (
              <span className="ml-2 font-medium text-royal-blue">
                ({pendingChangeCount} change{pendingChangeCount === 1 ? '' : 's'} pending)
              </span>
            )}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={resetPending}
              disabled={!hasChanges || saving}
              className="rounded-md border border-slate-200 px-4 py-2 text-sm disabled:opacity-40"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={!hasChanges || saving}
              className="rounded-md bg-royal-blue px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
            >
              Confirm assignments
            </button>
          </div>
        </div>
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-2 text-lg font-semibold">Confirm assignments</h3>
            <p className="mb-4 text-sm text-slate-600">
              Save changes for <strong>{testTitle}</strong>?
            </p>

            <div className="mb-4 space-y-3 text-sm">
              {changeSummary.addClasses.length > 0 && (
                <div>
                  <p className="font-medium text-slate-800">Add classes</p>
                  <ul className="mt-1 list-inside list-disc text-slate-600">
                    {changeSummary.addClasses.map((name) => (
                      <li key={`add-class-${name}`}>{name}</li>
                    ))}
                  </ul>
                </div>
              )}
              {changeSummary.removeClasses.length > 0 && (
                <div>
                  <p className="font-medium text-slate-800">Remove classes</p>
                  <ul className="mt-1 list-inside list-disc text-slate-600">
                    {changeSummary.removeClasses.map((name) => (
                      <li key={`remove-class-${name}`}>{name}</li>
                    ))}
                  </ul>
                </div>
              )}
              {changeSummary.addStudents.length > 0 && (
                <div>
                  <p className="font-medium text-slate-800">Add students</p>
                  <ul className="mt-1 list-inside list-disc text-slate-600">
                    {changeSummary.addStudents.map((name) => (
                      <li key={`add-student-${name}`}>{name}</li>
                    ))}
                  </ul>
                </div>
              )}
              {changeSummary.removeStudents.length > 0 && (
                <div>
                  <p className="font-medium text-slate-800">Remove students</p>
                  <ul className="mt-1 list-inside list-disc text-slate-600">
                    {changeSummary.removeStudents.map((name) => (
                      <li key={`remove-student-${name}`}>{name}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={saving}
                className="rounded-md border border-slate-200 px-4 py-2 text-sm disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={applyChanges}
                disabled={saving}
                className="rounded-md bg-royal-blue px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-40"
              >
                {saving ? 'Saving…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
