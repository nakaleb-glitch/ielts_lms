import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useExamLock } from '../../hooks/useExamLock'
import { buildPassageStructure, formatQuestionRange } from '../../lib/questionGroups'
import type { PassageStructure } from '../../lib/questionGroups'
import type { Passage, Question, ResponseValue, Test } from '../../types/assessment'
import { PassagePane } from './components/PassagePane'
import { QuestionGroupPane } from './components/QuestionGroupPane'
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
  const [currentPartIndex, setCurrentPartIndex] = useState(0)
  const [currentQuestionId, setCurrentQuestionId] = useState<string | null>(null)
  const [responses, setResponses] = useState<Map<string, ResponseValue | null>>(new Map())
  const [flags, setFlags] = useState<Map<string, boolean>>(new Map())
  const [startedAt, setStartedAt] = useState<string>('')
  const [sessionStatus, setSessionStatus] = useState<string>('in_progress')
  const [overviewOpen, setOverviewOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
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
          test:tests(id, title, instructions, duration_minutes, status, module)
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
        flat.push({
          ...q,
          passage: {
            id: p.id,
            test_id: p.test_id,
            order_index: p.order_index,
            title: p.title,
            body: p.body,
          },
        })
      }
    }
    flat.sort((a, b) => a.global_order - b.global_order)
    setQuestions(flat)
    if (flat.length) setCurrentQuestionId(flat[0].id)

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

  const isLocked = sessionStatus === 'in_progress'
  useExamLock(isLocked)

  const parts: PassageStructure[] = useMemo(() => {
    const seen = new Set<string>()
    const orderedPassages: Passage[] = []
    for (const q of questions) {
      if (!seen.has(q.passage.id)) {
        seen.add(q.passage.id)
        orderedPassages.push(q.passage)
      }
    }
    return orderedPassages.map((passage) => {
      const qs = questions.filter((q) => q.passage.id === passage.id)
      return buildPassageStructure(passage, qs)
    })
  }, [questions])

  const partNav = useMemo(
    () =>
      parts.map((p) => ({
        partNumber: p.passage.order_index,
        passageId: p.passage.id,
        questions: p.groups.flatMap((g) =>
          g.questions.map((q) => ({ id: q.id, globalOrder: q.global_order }))
        ),
        rangeStart: p.rangeStart,
        rangeEnd: p.rangeEnd,
      })),
    [parts]
  )

  const questionIds = useMemo(() => questions.map((q) => q.id), [questions])
  const currentPart = parts[currentPartIndex]

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

  const handleChange = (questionId: string, value: ResponseValue) => {
    setResponses((prev) => {
      const next = new Map(prev)
      next.set(questionId, value)
      return next
    })
    debouncedSave(questionId, value)
  }

  const handleToggleFlag = async (questionId: string) => {
    const nextFlag = !flags.get(questionId)
    setFlags((prev) => {
      const next = new Map(prev)
      next.set(questionId, nextFlag)
      return next
    })
    await persistResponse(questionId, responses.get(questionId) ?? null, nextFlag)
  }

  const handleSelectPart = (index: number) => {
    setCurrentPartIndex(index)
    const firstQ = partNav[index]?.questions[0]
    if (firstQ) setCurrentQuestionId(firstQ.id)
  }

  const handleSelectQuestion = (questionId: string) => {
    const partIdx = parts.findIndex((p) =>
      p.groups.some((g) => g.questions.some((q) => q.id === questionId))
    )
    if (partIdx >= 0) setCurrentPartIndex(partIdx)
    setCurrentQuestionId(questionId)
  }

  const submitTest = async () => {
    if (!sessionId) return
    setSubmitting(true)
    setSubmitError('')

    try {
      const { data, error } = await supabase.functions.invoke('score-session', {
        body: { session_id: sessionId },
      })

      if (error) {
        setSubmitError(error.message || 'Failed to submit test')
        return
      }

      if (data?.error) {
        setSubmitError(data.error)
        return
      }

      setSessionStatus('submitted')
      setOverviewOpen(false)
      navigate(`/results/${sessionId}`, { replace: true })
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to submit test')
    } finally {
      setSubmitting(false)
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

  if (loading || !test || !currentPart) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <p>Loading test...</p>
      </div>
    )
  }

  const rangeLabel = formatQuestionRange(currentPart.rangeStart, currentPart.rangeEnd)

  return (
    <div className="flex h-screen flex-col bg-slate-200">
      <header className="border-b-4 border-royal-blue bg-white px-4 py-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h1 className="text-sm font-semibold text-slate-900">{test.title}</h1>
            <p className="text-xs text-slate-500">IELTS Academic Reading</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-slate-900">Part {currentPart.passage.order_index}</p>
            <p className="text-xs text-slate-600">
              Read the text and answer questions {rangeLabel}.
            </p>
          </div>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-2">
        <PassagePane title={currentPart.passage.title} body={currentPart.passage.body} />
        <QuestionGroupPane
          groups={currentPart.groups}
          responses={responses}
          flags={flags}
          activeQuestionId={currentQuestionId}
          onChange={handleChange}
          onToggleFlag={handleToggleFlag}
        />
      </div>

      <QuestionNavBar
        parts={partNav}
        currentPartIndex={currentPartIndex}
        currentQuestionId={currentQuestionId}
        responses={responses}
        flags={flags}
        onSelectPart={handleSelectPart}
        onSelectQuestion={handleSelectQuestion}
        onOverview={() => {
          setSubmitError('')
          setOverviewOpen(true)
        }}
        timerLabel={timerLabel}
      />

      <OverviewModal
        open={overviewOpen}
        total={questions.length}
        questionIds={questionIds}
        responses={responses}
        flags={flags}
        onClose={() => {
          setSubmitError('')
          setOverviewOpen(false)
        }}
        onSubmit={submitTest}
        submitting={submitting}
        submitError={submitError}
      />
    </div>
  )
}
