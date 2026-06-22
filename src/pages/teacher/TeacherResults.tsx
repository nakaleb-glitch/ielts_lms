import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { QuestionBreakdownPanel } from '../../components/results/QuestionBreakdownPanel'
import { supabase } from '../../lib/supabase'
import type { QuestionBreakdownItem } from '../../types/assessment'

interface ResultRow {
  session_id: string
  student_profile_id: string
  student_name: string
  student_id: string | null
  raw_score: number
  total_questions: number
  band_score: number
  submitted_at: string | null
  question_breakdown: QuestionBreakdownItem[]
}

interface SessionResultData {
  raw_score: number
  total_questions: number
  band_score: number
  question_breakdown?: QuestionBreakdownItem[]
}

interface SessionWithResult {
  id: string
  submitted_at: string | null
  status: string
  result?: SessionResultData | SessionResultData[] | null
}

export function TeacherResults() {
  const { testId } = useParams<{ testId: string }>()
  const [searchParams] = useSearchParams()
  const classId = searchParams.get('classId')
  const [testTitle, setTestTitle] = useState('')
  const [className, setClassName] = useState('')
  const [rows, setRows] = useState<ResultRow[]>([])
  const [selectedRow, setSelectedRow] = useState<ResultRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    load()
  }, [testId, classId])

  const load = async () => {
    if (!testId) return
    setLoading(true)
    setError('')

    const [{ data: test }, classResult, membersResult] = await Promise.all([
      supabase.from('tests').select('title').eq('id', testId).single(),
      classId
        ? supabase.from('classes').select('name').eq('id', classId).single()
        : Promise.resolve({ data: null }),
      classId
        ? supabase.rpc('list_class_members', { p_class_id: classId })
        : Promise.resolve({ data: null }),
    ])

    setTestTitle(test?.title || '')
    setClassName(classResult.data?.name || '')

    const memberIds = classId
      ? new Set((membersResult.data || []).map((m: { id: string }) => m.id))
      : null

    const { data: assignments, error: assignmentsError } = await supabase
      .from('test_assignments')
      .select(`
        id,
        student_id,
        student:profiles!test_assignments_student_id_fkey(display_name, student_id),
        session:test_sessions(
          id,
          submitted_at,
          status,
          result:session_results(raw_score, total_questions, band_score, question_breakdown)
        )
      `)
      .eq('test_id', testId)

    if (assignmentsError) {
      setError(assignmentsError.message)
      setRows([])
      setLoading(false)
      return
    }

    const mapped: ResultRow[] = (assignments || [])
      .filter((a) => !memberIds || memberIds.has(a.student_id))
      .map((a) => {
        const studentRaw = a.student as { display_name: string; student_id: string | null } | { display_name: string; student_id: string | null }[]
        const student = Array.isArray(studentRaw) ? studentRaw[0] : studentRaw
        const sessionRaw = a.session as SessionWithResult | SessionWithResult[] | null
        const session = Array.isArray(sessionRaw) ? sessionRaw[0] : sessionRaw
        const resultRaw = session?.result
        const result = Array.isArray(resultRaw) ? resultRaw[0] : resultRaw
        return {
          session_id: session?.id || '',
          student_profile_id: a.student_id,
          student_name: student?.display_name || 'Unknown',
          student_id: student?.student_id || null,
          raw_score: result?.raw_score ?? 0,
          total_questions: result?.total_questions ?? 0,
          band_score: result?.band_score ?? 0,
          submitted_at: session?.submitted_at || null,
          question_breakdown: result?.question_breakdown ?? [],
        }
      })

    setRows(mapped)
    setLoading(false)
  }

  if (loading) return <p>Loading results...</p>

  const titleSuffix = className ? ` — ${className}` : ''

  return (
    <div>
      <Link
        to={classId ? '/admin/classes' : '/tests/reading'}
        className="text-sm text-royal-blue hover:underline"
      >
        {classId ? '← Back to classes' : '← Back to tests'}
      </Link>
      <h1 className="mb-6 mt-4 text-2xl font-bold">
        Results: {testTitle}{titleSuffix}
      </h1>

      {error && (
        <div className="mb-4 rounded-md border border-royal-red/30 bg-red-50 px-4 py-3 text-sm text-royal-red">
          {error}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-slate-600">
          {classId ? 'No results for students in this class.' : 'No assignments yet.'}
        </p>
      ) : (
        <table className="w-full rounded-lg border border-slate-200 bg-white text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-3">Student</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3">Band</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.session_id || r.student_profile_id} className="border-b border-slate-100">
                <td className="px-4 py-3">
                  <p className="font-medium">{r.student_name}</p>
                  <p className="text-slate-500">{r.student_id || '—'}</p>
                </td>
                <td className="px-4 py-3">
                  {r.submitted_at ? (
                    <span className="text-green-600">Submitted</span>
                  ) : (
                    <span className="text-amber-600">Not submitted</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {r.submitted_at ? `${r.raw_score} / ${r.total_questions}` : '—'}
                </td>
                <td className="px-4 py-3 font-semibold">
                  {r.submitted_at ? r.band_score : '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  {r.submitted_at && (
                    <button
                      type="button"
                      onClick={() => setSelectedRow(r)}
                      className="text-royal-blue hover:underline"
                    >
                      View breakdown
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {selectedRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-lg bg-white shadow-xl">
            <div className="border-b border-slate-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-slate-900">{selectedRow.student_name}</h3>
              <p className="text-sm text-slate-500">{selectedRow.student_id || '—'}</p>
              <p className="mt-2 text-sm text-slate-700">
                Score: {selectedRow.raw_score} / {selectedRow.total_questions} · Band: {selectedRow.band_score}
              </p>
            </div>
            <div className="overflow-y-auto px-6 py-4">
              <QuestionBreakdownPanel items={selectedRow.question_breakdown} />
            </div>
            <div className="flex justify-end border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                onClick={() => setSelectedRow(null)}
                className="rounded-md border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
