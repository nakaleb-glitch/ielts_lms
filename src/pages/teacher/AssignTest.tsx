import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

interface StudentRow {
  id: string
  display_name: string
  email: string | null
}

export function AssignTest() {
  const { testId } = useParams<{ testId: string }>()
  const { profile } = useAuth()
  const [students, setStudents] = useState<StudentRow[]>([])
  const [assigned, setAssigned] = useState<Set<string>>(new Set())
  const [testTitle, setTestTitle] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [testId])

  const load = async () => {
    if (!testId) return
    setLoading(true)

    const { data: test } = await supabase.from('tests').select('title').eq('id', testId).single()
    setTestTitle(test?.title || '')

    const { data: studentList } = await supabase.rpc('list_students')
    setStudents(studentList || [])

    const { data: assignments } = await supabase
      .from('test_assignments')
      .select('student_id')
      .eq('test_id', testId)

    setAssigned(new Set((assignments || []).map((a) => a.student_id)))
    setLoading(false)
  }

  const toggleAssign = async (studentId: string) => {
    if (!testId || !profile) return

    if (assigned.has(studentId)) {
      await supabase
        .from('test_assignments')
        .delete()
        .eq('test_id', testId)
        .eq('student_id', studentId)
      setAssigned((s) => {
        const next = new Set(s)
        next.delete(studentId)
        return next
      })
    } else {
      await supabase.from('test_assignments').insert({
        test_id: testId,
        student_id: studentId,
        assigned_by: profile.id,
      })
      setAssigned((s) => new Set(s).add(studentId))
    }
  }

  if (loading) return <p>Loading...</p>

  return (
    <div>
      <Link to="/tests/reading" className="text-sm text-royal-blue hover:underline">← Back to tests</Link>
      <h1 className="mb-2 mt-4 text-2xl font-bold">Assign: {testTitle}</h1>
      <p className="mb-6 text-sm text-slate-600">Select students who should see this test in My Tests.</p>

      {students.length === 0 ? (
        <p className="text-slate-600">No student accounts found. Students must sign up first.</p>
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
                checked={assigned.has(s.id)}
                onChange={() => toggleAssign(s.id)}
              />
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
