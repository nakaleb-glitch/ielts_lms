import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { SchoolClass } from '../../types/assessment'

interface StudentRow {
  id: string
  display_name: string
  email: string | null
}

type AssignTab = 'students' | 'classes'

export function AssignTest() {
  const { testId } = useParams<{ testId: string }>()
  const { profile } = useAuth()
  const [tab, setTab] = useState<AssignTab>('students')
  const [students, setStudents] = useState<StudentRow[]>([])
  const [classes, setClasses] = useState<SchoolClass[]>([])
  const [assignedStudents, setAssignedStudents] = useState<Set<string>>(new Set())
  const [assignedClasses, setAssignedClasses] = useState<Set<string>>(new Set())
  const [testTitle, setTestTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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

    setStudents(studentList || [])
    setClasses(classList || [])
    setAssignedStudents(new Set((assignments || []).map((a) => a.student_id)))
    setAssignedClasses(new Set((classAssignments || []).map((a) => a.class_id)))
    setLoading(false)
  }

  const toggleStudent = async (studentId: string) => {
    if (!testId || !profile) return
    setError('')

    if (assignedStudents.has(studentId)) {
      const { error: deleteError } = await supabase
        .from('test_assignments')
        .delete()
        .eq('test_id', testId)
        .eq('student_id', studentId)

      if (deleteError) {
        setError(deleteError.message)
        return
      }

      setAssignedStudents((s) => {
        const next = new Set(s)
        next.delete(studentId)
        return next
      })
    } else {
      const { error: insertError } = await supabase.from('test_assignments').insert({
        test_id: testId,
        student_id: studentId,
        assigned_by: profile.id,
      })

      if (insertError) {
        setError(insertError.message)
        return
      }

      setAssignedStudents((s) => new Set(s).add(studentId))
    }
  }

  const toggleClass = async (classId: string) => {
    if (!testId) return
    setError('')

    if (assignedClasses.has(classId)) {
      const { error: rpcError } = await supabase.rpc('unassign_test_from_class', {
        p_test_id: testId,
        p_class_id: classId,
      })
      if (rpcError) {
        setError(rpcError.message)
        return
      }
      setAssignedClasses((s) => {
        const next = new Set(s)
        next.delete(classId)
        return next
      })
      await load()
    } else {
      const { error: rpcError } = await supabase.rpc('assign_test_to_class', {
        p_test_id: testId,
        p_class_id: classId,
      })
      if (rpcError) {
        setError(rpcError.message)
        return
      }
      setAssignedClasses((s) => new Set(s).add(classId))
      await load()
    }
  }

  if (loading) return <p>Loading...</p>

  return (
    <div>
      <Link to="/tests/reading" className="text-sm text-royal-blue hover:underline">← Back to tests</Link>
      <h1 className="mb-2 mt-4 text-2xl font-bold">Assign: {testTitle}</h1>
      <p className="mb-4 text-sm text-slate-600">
        Assign this test to individual students or entire classes.
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

      {tab === 'students' && (
        students.length === 0 ? (
          <p className="text-slate-600">No students found. Ask an admin to create student accounts.</p>
        ) : (
          <div className="space-y-2">
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
                  checked={assignedStudents.has(s.id)}
                  onChange={() => toggleStudent(s.id)}
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
                className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3"
              >
                <div>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-sm text-slate-500">{c.member_count ?? 0} students</p>
                </div>
                <input
                  type="checkbox"
                  checked={assignedClasses.has(c.id)}
                  onChange={() => toggleClass(c.id)}
                />
              </label>
            ))}
          </div>
        )
      )}
    </div>
  )
}
