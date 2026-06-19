import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { Test, TestAssignment, TestSession } from '../../types/assessment'

interface AssignmentRow extends TestAssignment {
  test: Test
  session: TestSession | null
}

export function MyTests() {
  const { profile } = useAuth()
  const [assignments, setAssignments] = useState<AssignmentRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (profile?.id) load()
  }, [profile?.id])

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('test_assignments')
      .select(`
        *,
        test:tests(*),
        session:test_sessions(*)
      `)
      .eq('student_id', profile!.id)
      .order('created_at', { ascending: false })

    const mapped = (data || []).map((a) => ({
      ...a,
      session: Array.isArray(a.session) ? a.session[0] : a.session,
    }))
    setAssignments(mapped)
    setLoading(false)
  }

  const startTest = async (assignment: AssignmentRow) => {
    if (assignment.session?.status === 'submitted') {
      window.location.href = `/results/${assignment.session.id}`
      return
    }

    if (assignment.session?.id) {
      window.location.href = `/player/${assignment.session.id}`
      return
    }

    const { data: session, error } = await supabase
      .from('test_sessions')
      .insert({ assignment_id: assignment.id })
      .select()
      .single()

    if (!error && session) {
      window.location.href = `/player/${session.id}`
    }
  }

  const getStatus = (a: AssignmentRow) => {
    if (!a.session) return 'Not started'
    if (a.session.status === 'submitted') return 'Submitted'
    if (a.session.status === 'expired') return 'Expired'
    return 'In progress'
  }

  if (loading) return <p>Loading your tests...</p>

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-slate-900">My Tests</h1>

      {assignments.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">
          No tests assigned yet. Your teacher will assign reading tests here.
        </div>
      ) : (
        <div className="space-y-3">
          {assignments.map((a) => (
            <div key={a.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4">
              <div>
                <h2 className="font-semibold text-slate-900">{a.test.title}</h2>
                <p className="text-sm text-slate-500">
                  {a.test.duration_minutes} minutes · {getStatus(a)}
                </p>
              </div>
              <div className="flex gap-2">
                {a.session?.status === 'submitted' ? (
                  <Link
                    to={`/results/${a.session.id}`}
                    className="rounded-md bg-slate-100 px-4 py-2 text-sm hover:bg-slate-200"
                  >
                    View results
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => startTest(a)}
                    className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    {a.session ? 'Continue' : 'Start test'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
