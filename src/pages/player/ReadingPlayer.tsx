import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Passage, Question, ResponseValue, Test } from '../../types/assessment'
import { PassagePane } from './components/PassagePane'
import { QuestionPane } from './components/QuestionPane'
import { QuestionNavBar } from './components/QuestionNavBar'
import { OverviewModal } from './components/OverviewModal'
import { useTimer } from './components/Timer'

interface FlatQuestion extends Question {
  passage: Passage
}

export function ReadingPlayer() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const [test, setTest] = useState<Test | null>(null)
  const [questions, setQuestions] = useState<FlatQuestion[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [responses, setResponses] = useState<Map<string, ResponseValue | null>>(new Map())
  const [flags, setFlags] = useState<Map<string, boolean>>(new Map())
  const [startedAt, setStartedAt] = useState<string>('')
  const [sessionStatus, setSessionStatus] = useState<string>('in_progress')
  const [overviewOpen, setOverviewOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const load = useCallback(async () => {
    if (!sessionId) return
    setLoading(true)

    const { data: session } = await supabase
      .from('test_sessions')
      .select(`
        *,
        assignment:test_assignments(
          test:tests(*)
        )
      `)
      .eq('id', sessionId)
      .single()

    if (!session) {
      setLoading(false)
      return
    }

    if (session.status === 'submitted') {
      navigate(`/results/${sessionId}`, { replace: true })
      return
    }

    setStartedAt(session.started_at)
    setSessionStatus(session.status)

    const assignment = session.assignment as { test: Test }
    setTest(assignment.test)

    const { data: passages } = await supabase
      .from('passages')
      .select(`*, questions(*)`)
      .eq('test_id', assignment.test.id)
      .order('order_index')

    const flat: FlatQuestion[] = []
    for (const p of passages || []) {
      const qs = (p.questions || []).sort((a: Question, b: Question) => a.global_order - b.global_order)
      for (const q of qs) {
        flat.push({ ...q, passage: { id: p.id, test_id: p.test_id, order_index: p.order_index, title: p.title, body: p.body } })
      }
    }
    flat.sort((a, b) => a.global_order - b.global_order)
    setQuestions(flat)

    const { data: existingResponses } = await supabase
      .from('responses')
      .select('*')
      .eq('session_id', sessionId)

    const respMap = new Map<string, ResponseValue | null>()
    const flagMap = new Map<string, boolean>()
    for (const r of existingResponses || []) {
      respMap.set(r.question_id, r.value as ResponseValue)
      flagMap.set(r.question_id, r.flagged)
    }
    setResponses(respMap)
    setFlags(flagMap)
    setLoading(false)
  }, [sessionId, navigate])

  useEffect(() => {
    load()
  }, [load])

  const questionIds = useMemo(() => questions.map((q) => q.id), [questions])
  const current = questions[currentIndex]

  const persistResponse = useCallback(
    async (questionId: string, value: ResponseValue | null, flagged?: boolean) => {
      if (!sessionId || sessionStatus !== 'in_progress') return
      await supabase.from('responses').upsert(
        {
          session_id: sessionId,
          question_id: questionId,
          value,
          flagged: flagged ?? flags.get(questionId) ?? false,
          saved_at: new Date().toISOString(),
        },
        { onConflict: 'session_id,question_id' }
      )
    },
    [sessionId, sessionStatus, flags]
  )

  const debouncedSave = (questionId: string, value: ResponseValue | null) => {
    const existing = saveTimers.current.get(questionId)
    if (existing) clearTimeout(existing)
    saveTimers.current.set(
      questionId,
      setTimeout(() => persistResponse(questionId, value), 500)
    )
  }

  const handleChange = (value: ResponseValue) => {
    if (!current) return
    setResponses((prev) => {
      const next = new Map(prev)
      next.set(current.id, value)
      return next
    })
    debouncedSave(current.id, value)
  }

  const handleToggleFlag = async () => {
    if (!current) return
    const nextFlag = !flags.get(current.id)
    setFlags((prev) => {
      const next = new Map(prev)
      next.set(current.id, nextFlag)
      return next
    })
    await persistResponse(current.id, responses.get(current.id) ?? null, nextFlag)
  }

  const submitTest = async () => {
    if (!sessionId) return
    setSubmitting(true)

    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token

    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/score-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ session_id: sessionId }),
    })

    setSubmitting(false)
    setOverviewOpen(false)

    if (res.ok) {
      navigate(`/results/${sessionId}`, { replace: true })
    } else {
      const err = await res.json()
      alert(err.error || 'Failed to submit test')
    }
  }

  const handleExpire = useCallback(() => {
    if (sessionStatus === 'in_progress') submitTest()
  }, [sessionStatus])

  const timerLabel = useTimer({
    startedAt: startedAt || new Date().toISOString(),
    durationMinutes: test?.duration_minutes || 60,
    onExpire: handleExpire,
  })

  if (loading || !test || !current) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <p>Loading test...</p>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col bg-slate-200">
      <header className="flex items-center justify-between border-b-4 border-royal-blue bg-white px-4 py-2">
        <div>
          <h1 className="text-sm font-semibold text-slate-900">{test.title}</h1>
          <p className="text-xs text-slate-500">IELTS Academic Reading</p>
        </div>
        <p className="text-xs text-slate-500">
          Question {currentIndex + 1} of {questions.length}
        </p>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-2">
        <PassagePane title={current.passage.title} body={current.passage.body} />
        <QuestionPane
          question={current}
          questionNumber={current.global_order}
          value={responses.get(current.id) ?? null}
          flagged={flags.get(current.id) ?? false}
          onChange={handleChange}
          onToggleFlag={handleToggleFlag}
        />
      </div>

      <QuestionNavBar
        total={questions.length}
        currentIndex={currentIndex}
        responses={responses}
        flags={flags}
        questionIds={questionIds}
        onSelect={setCurrentIndex}
        onPrev={() => setCurrentIndex((i) => Math.max(0, i - 1))}
        onNext={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
        onOverview={() => setOverviewOpen(true)}
        timerLabel={timerLabel}
      />

      <OverviewModal
        open={overviewOpen}
        total={questions.length}
        questionIds={questionIds}
        responses={responses}
        flags={flags}
        onClose={() => setOverviewOpen(false)}
        onSubmit={submitTest}
        submitting={submitting}
      />
    </div>
  )
}
