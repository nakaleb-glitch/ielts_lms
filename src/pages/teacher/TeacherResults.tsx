import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

interface ResultRow {
  session_id: string
  student_profile_id: string
  student_name: string
  student_id: string | null
  raw_score: number
  total_questions: number
  band_score: number
  submitted_at: string | null
}

export function TeacherResults() {
  const { testId } = useParams<{ testId: string }>()
  const [searchParams] = useSearchParams()
  const classId = searchParams.get('classId')
  const [testTitle, setTestTitle] = useState('')
  const [className, setClassName] = useState('')
  const [rows, setRows] = useState<ResultRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [testId, classId])

  const load = async () => {
    if (!testId) return
    setLoading(true)

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

    const { data: assignments } = await supabase
      .from('test_assignments')
      .select(`
        id,
        student_id,
        student:profiles!test_assignments_student_id_fkey(display_name, student_id),
        session:test_sessions(id, submitted_at, status),
        result:session_results(raw_score, total_questions, band_score)
      `)
      .eq('test_id', testId)

    const mapped: ResultRow[] = (assignments || [])
      .filter((a) => !memberIds || memberIds.has(a.student_id))
      .map((a) => {
        const studentRaw = a.student as { display_name: string; student_id: string | null } | { display_name: string; student_id: string | null }[]
        const student = Array.isArray(studentRaw) ? studentRaw[0] : studentRaw
        const session = Array.isArray(a.session) ? a.session[0] : a.session
        const result = Array.isArray(a.result) ? a.result[0] : a.result
        return {
          session_id: session?.id || '',
          student_profile_id: a.student_id,
          student_name: student?.display_name || 'Unknown',
          student_id: student?.student_id || null,
          raw_score: result?.raw_score ?? 0,
          total_questions: result?.total_questions ?? 0,
          band_score: result?.band_score ?? 0,
          submitted_at: session?.submitted_at || null,
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
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
