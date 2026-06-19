import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { SessionResult } from '../../types/assessment'

export function StudentResults() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const [result, setResult] = useState<SessionResult | null>(null)
  const [testTitle, setTestTitle] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [sessionId])

  const load = async () => {
    if (!sessionId) return
    setLoading(true)

    const { data: session } = await supabase
      .from('test_sessions')
      .select(`
        *,
        assignment:test_assignments(
          test:tests(title)
        )
      `)
      .eq('id', sessionId)
      .single()

    const assignment = session?.assignment as { test: { title: string } }
    setTestTitle(assignment?.test?.title || '')

    const { data: res } = await supabase
      .from('session_results')
      .select('*')
      .eq('session_id', sessionId)
      .single()

    setResult(res)
    setLoading(false)
  }

  if (loading) return <p>Loading results...</p>
  if (!result) return <p>No results found for this session.</p>

  return (
    <div>
      <Link to="/my-tests" className="text-sm text-royal-blue hover:underline">← Back to My Tests</Link>
      <h1 className="mb-2 mt-4 text-2xl font-bold">{testTitle}</h1>
      <p className="mb-6 text-slate-600">Your Reading test has been submitted and scored.</p>

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-center">
          <p className="text-sm text-slate-500">Raw score</p>
          <p className="text-3xl font-bold text-slate-900">
            {result.raw_score} / {result.total_questions}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-center">
          <p className="text-sm text-slate-500">IELTS band (approx.)</p>
          <p className="text-3xl font-bold text-royal-blue">{result.band_score}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-center">
          <p className="text-sm text-slate-500">Questions</p>
          <p className="text-3xl font-bold text-slate-900">{result.total_questions}</p>
        </div>
      </div>

      <h2 className="mb-3 font-semibold">Question breakdown</h2>
      <div className="space-y-2">
        {(result.question_breakdown || []).map((item) => (
          <div
            key={item.question_id}
            className={`rounded-md border px-4 py-2 text-sm ${
              item.correct ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
            }`}
          >
            Question {item.global_order}: {item.correct ? 'Correct' : 'Incorrect'}
          </div>
        ))}
      </div>
    </div>
  )
}
