import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

interface ResultRow {
  session_id: string
  student_name: string
  student_email: string | null
  raw_score: number
  total_questions: number
  band_score: number
  submitted_at: string | null
}

export function TeacherResults() {
  const { testId } = useParams<{ testId: string }>()
  const [testTitle, setTestTitle] = useState('')
  const [rows, setRows] = useState<ResultRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [testId])

  const load = async () => {
    if (!testId) return
    setLoading(true)

    const { data: test } = await supabase.from('tests').select('title').eq('id', testId).single()
    setTestTitle(test?.title || '')

    const { data: assignments } = await supabase
      .from('test_assignments')
      .select(`
        id,
        student:profiles!test_assignments_student_id_fkey(display_name, email),
        session:test_sessions(id, submitted_at, status),
        result:session_results(raw_score, total_questions, band_score)
      `)
      .eq('test_id', testId)

    const mapped: ResultRow[] = (assignments || []).map((a) => {
      const studentRaw = a.student as { display_name: string; email: string | null } | { display_name: string; email: string | null }[]
      const student = Array.isArray(studentRaw) ? studentRaw[0] : studentRaw
      const session = Array.isArray(a.session) ? a.session[0] : a.session
      const result = Array.isArray(a.result) ? a.result[0] : a.result
      return {
        session_id: session?.id || '',
        student_name: student?.display_name || 'Unknown',
        student_email: student?.email || null,
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

  return (
    <div>
      <Link to="/tests" className="text-sm text-royal-blue hover:underline">← Back to tests</Link>
      <h1 className="mb-6 mt-4 text-2xl font-bold">Results: {testTitle}</h1>

      {rows.length === 0 ? (
        <p className="text-slate-600">No assignments yet.</p>
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
              <tr key={r.session_id || r.student_name} className="border-b border-slate-100">
                <td className="px-4 py-3">
                  <p className="font-medium">{r.student_name}</p>
                  <p className="text-slate-500">{r.student_email}</p>
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
