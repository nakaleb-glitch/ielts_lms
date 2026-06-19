import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type QuestionType =
  | 'multiple_choice'
  | 'true_false_not_given'
  | 'yes_no_not_given'
  | 'gap_fill'
  | 'matching'

const ACADEMIC_BAND_TABLE: Record<number, number> = {
  40: 9, 39: 9, 38: 8.5, 37: 8.5, 36: 8, 35: 8, 34: 7.5, 33: 7.5,
  32: 7, 31: 7, 30: 7, 29: 6.5, 28: 6.5, 27: 6.5, 26: 6, 25: 6, 24: 6,
  23: 5.5, 22: 5.5, 21: 5.5, 20: 5.5, 19: 5, 18: 5, 17: 5, 16: 5,
  15: 4.5, 14: 4.5, 13: 4.5, 12: 4, 11: 4, 10: 4, 9: 3.5, 8: 3.5,
  7: 3, 6: 3, 5: 2.5, 4: 2.5, 3: 2, 2: 2, 1: 1, 0: 0,
}

function rawScoreToBand(rawScore: number, totalQuestions: number): number {
  const ratio = totalQuestions === 40 ? rawScore : Math.round((rawScore / totalQuestions) * 40)
  const clamped = Math.max(0, Math.min(40, ratio))
  return ACADEMIC_BAND_TABLE[clamped] ?? 0
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase()
}

function normalizeTfng(value: string): string {
  const v = normalizeText(value)
  if (['t', 'true'].includes(v)) return 'TRUE'
  if (['f', 'false'].includes(v)) return 'FALSE'
  if (['ng', 'not given', 'notgiven'].includes(v)) return 'NOT GIVEN'
  return v.toUpperCase()
}

function normalizeYnng(value: string): string {
  const v = normalizeText(value)
  if (['y', 'yes'].includes(v)) return 'YES'
  if (['n', 'no'].includes(v)) return 'NO'
  if (['ng', 'not given', 'notgiven'].includes(v)) return 'NOT GIVEN'
  return v.toUpperCase()
}

function scoreQuestion(type: QuestionType, studentValue: unknown, acceptableAnswers: unknown): boolean {
  if (studentValue == null || studentValue === '') return false
  switch (type) {
    case 'multiple_choice': {
      const expected = Array.isArray(acceptableAnswers) ? acceptableAnswers[0] : acceptableAnswers
      return normalizeText(String(studentValue)) === normalizeText(String(expected))
    }
    case 'true_false_not_given': {
      const expected = Array.isArray(acceptableAnswers) ? acceptableAnswers[0] : acceptableAnswers
      return normalizeTfng(String(studentValue)) === normalizeTfng(String(expected))
    }
    case 'yes_no_not_given': {
      const expected = Array.isArray(acceptableAnswers) ? acceptableAnswers[0] : acceptableAnswers
      return normalizeYnng(String(studentValue)) === normalizeYnng(String(expected))
    }
    case 'gap_fill': {
      const studentArr = Array.isArray(studentValue) ? studentValue : [studentValue]
      const acceptableArr = Array.isArray(acceptableAnswers) ? acceptableAnswers : [acceptableAnswers]
      if (studentArr.length !== acceptableArr.length) return false
      return studentArr.every((ans, i) => {
        const options = acceptableArr[i]
        const opts = Array.isArray(options) ? options : [options]
        return opts.some((o) => normalizeText(String(o)) === normalizeText(String(ans ?? '')))
      })
    }
    case 'matching': {
      const studentObj = (studentValue && typeof studentValue === 'object' ? studentValue : {}) as Record<string, string>
      const acceptableObj = (acceptableAnswers && typeof acceptableAnswers === 'object' ? acceptableAnswers : {}) as Record<string, string>
      const keys = Object.keys(acceptableObj)
      if (keys.length === 0) return false
      return keys.every((k) => normalizeText(String(studentObj[k] ?? '')) === normalizeText(String(acceptableObj[k])))
    }
    default:
      return false
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const adminClient = createClient(supabaseUrl, serviceKey)

    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { session_id: sessionId } = await req.json()
    if (!sessionId) {
      return new Response(JSON.stringify({ error: 'session_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: session, error: sessionError } = await userClient
      .from('test_sessions')
      .select(`
        *,
        assignment:test_assignments(
          student_id,
          test:tests(id, duration_minutes, created_by)
        )
      `)
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const assignment = session.assignment as {
      student_id: string
      test: { id: string; duration_minutes: number; created_by: string }
    }

    if (assignment.student_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (session.status === 'submitted') {
      const { data: existing } = await userClient
        .from('session_results')
        .select('*')
        .eq('session_id', sessionId)
        .single()
      return new Response(JSON.stringify({ result: existing }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const startedAt = new Date(session.started_at).getTime()
    const durationMs = assignment.test.duration_minutes * 60 * 1000
    if (Date.now() > startedAt + durationMs + 60000) {
      await adminClient
        .from('test_sessions')
        .update({ status: 'expired', submitted_at: new Date().toISOString() })
        .eq('id', sessionId)
    }

    const { data: passages } = await userClient
      .from('passages')
      .select(`
        id,
        questions(
          id, global_order, type, config,
          question_answers(acceptable_answers)
        )
      `)
      .eq('test_id', assignment.test.id)
      .order('order_index')

    const questions = (passages || [])
      .flatMap((p) => p.questions || [])
      .sort((a, b) => a.global_order - b.global_order)
      .map((q) => {
        const answers = q.question_answers as { acceptable_answers: unknown }[] | { acceptable_answers: unknown } | null
        const acceptable = Array.isArray(answers) ? answers[0]?.acceptable_answers : answers?.acceptable_answers
        return {
          id: q.id,
          global_order: q.global_order,
          type: q.type as QuestionType,
          config: q.config,
          acceptable_answers: acceptable,
        }
      })

    const { data: responses } = await userClient
      .from('responses')
      .select('question_id, value')
      .eq('session_id', sessionId)

    const responseMap = new Map((responses || []).map((r) => [r.question_id, r.value]))

    let rawScore = 0
    const breakdown = questions.map((q) => {
      const studentValue = responseMap.get(q.id) ?? null
      let correct = false

      if (q.type === 'matching') {
        correct = scoreQuestion(q.type, studentValue, q.acceptable_answers)
        const acceptableObj = q.acceptable_answers as Record<string, string>
        const studentObj = (studentValue || {}) as Record<string, string>
        const keys = Object.keys(acceptableObj || {})
        const partial = keys.filter(
          (k) => normalizeText(String(studentObj[k] ?? '')) === normalizeText(String(acceptableObj[k]))
        ).length
        rawScore += partial
      } else if (q.type === 'gap_fill') {
        const blankCount = (q.config as { blanks?: string[] }).blanks?.length ?? 1
        const studentArr = Array.isArray(studentValue) ? studentValue : [studentValue]
        const acceptableArr = Array.isArray(q.acceptable_answers) ? q.acceptable_answers : [q.acceptable_answers]
        let correctBlanks = 0
        for (let i = 0; i < blankCount; i++) {
          const opts = acceptableArr[i]
          const options = Array.isArray(opts) ? opts : [opts]
          const ans = normalizeText(String(studentArr[i] ?? ''))
          if (options.some((o) => normalizeText(String(o)) === ans)) correctBlanks++
        }
        rawScore += correctBlanks
        correct = correctBlanks === blankCount
      } else {
        correct = scoreQuestion(q.type, studentValue, q.acceptable_answers)
        if (correct) rawScore += 1
      }

      return {
        question_id: q.id,
        global_order: q.global_order,
        correct,
        student_value: studentValue,
        correct_value: q.acceptable_answers,
      }
    })

    const totalQuestions = questions.length
    const bandScore = rawScoreToBand(rawScore, totalQuestions)

    await adminClient
      .from('test_sessions')
      .update({ status: 'submitted', submitted_at: new Date().toISOString() })
      .eq('id', sessionId)

    const { data: result, error: resultError } = await adminClient
      .from('session_results')
      .insert({
        session_id: sessionId,
        raw_score: rawScore,
        total_questions: totalQuestions,
        band_score: bandScore,
        question_breakdown: breakdown,
      })
      .select()
      .single()

    if (resultError) {
      return new Response(JSON.stringify({ error: resultError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
