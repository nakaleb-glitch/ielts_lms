import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { Test, TestAssignment, TestSession } from '../../types/assessment'

interface AssignmentRow extends TestAssignment {
  test: Pick<Test, 'id' | 'title' | 'duration_minutes' | 'module' | 'status' | 'instructions'>
  session: TestSession | null
}

const STUDENT_TEST_FIELDS = 'id, title, duration_minutes, module, status, instructions'

export function MyTests() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [assignments, setAssignments] = useState<AssignmentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [passwordModal, setPasswordModal] = useState<AssignmentRow | null>(null)
  const [examPassword, setExamPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')

  useEffect(() => {
    if (profile?.id) load()
  }, [profile?.id])

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('test_assignments')
      .select(`
        *,
        test:tests(${STUDENT_TEST_FIELDS}),
        session:test_sessions(*)
      `)
      .eq('student_id', profile!.id)
      .order('created_at', { ascending: false })

    const mapped = (data || [])
      .map((a) => ({
        ...a,
        session: Array.isArray(a.session) ? a.session[0] : a.session,
      }))
      .filter((a) => a.test?.module === 'reading' || !a.test?.module)

    setAssignments(mapped)
    setLoading(false)
  }

  const beginSession = async (assignmentId: string, password: string) => {
    setStarting(true)
    setPasswordError('')

    const { data: sessionId, error } = await supabase.rpc('start_test_session', {
      p_assignment_id: assignmentId,
      p_password: password,
    })

    setStarting(false)

    if (error) {
      setPasswordError(error.message)
      return
    }

    setPasswordModal(null)
    setExamPassword('')
    navigate(`/player/${sessionId}`)
  }

  const startTest = async (assignment: AssignmentRow) => {
    if (assignment.session?.status === 'submitted') {
      navigate(`/results/${assignment.session.id}`)
      return
    }

    if (assignment.session?.id) {
      navigate(`/player/${assignment.session.id}`)
      return
    }

    const { data: requiresPassword, error: checkError } = await supabase.rpc(
      'assignment_requires_password',
      { p_assignment_id: assignment.id }
    )

    if (checkError) {
      setPasswordError(checkError.message)
      return
    }

    if (requiresPassword) {
      setPasswordError('')
      setExamPassword('')
      setPasswordModal(assignment)
      return
    }

    await beginSession(assignment.id, '')
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
      <h1 className="mb-6 text-2xl font-bold text-slate-900">My Reading Tests</h1>

      {assignments.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">
          No reading tests assigned yet. Your teacher will assign tests here.
        </div>
      ) : (
        <div className="space-y-3">
          {assignments.map((a) => (
            <div key={a.id} className="flex items-center justify-between rounded-lg border border-slate-200 border-t-4 border-t-royal-blue bg-white p-4">
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
                    className="rounded-md bg-royal-blue px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                  >
                    {a.session ? 'Continue' : 'Start test'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {passwordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
            <h2 className="mb-1 text-lg font-semibold text-slate-900">Enter exam password</h2>
            <p className="mb-4 text-sm text-slate-600">
              Your teacher will give you the password on test day to begin{' '}
              <strong>{passwordModal.test.title}</strong>.
            </p>
            <input
              type="password"
              placeholder="Exam password"
              className="mb-2 w-full rounded-md border border-slate-300 px-3 py-2"
              value={examPassword}
              onChange={(e) => setExamPassword(e.target.value)}
              autoFocus
            />
            {passwordError && <p className="mb-2 text-sm text-royal-red">{passwordError}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setPasswordModal(null)
                  setExamPassword('')
                  setPasswordError('')
                }}
                disabled={starting}
                className="rounded-md px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => beginSession(passwordModal.id, examPassword)}
                disabled={starting || !examPassword.trim()}
                className="rounded-md bg-royal-blue px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {starting ? 'Starting…' : 'Begin exam'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
