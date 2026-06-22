import type { Question, QuestionBreakdownItem, QuestionType, ResponseValue } from '../types/assessment'

const ACADEMIC_BAND_TABLE: Record<number, number> = {
  40: 9, 39: 9, 38: 8.5, 37: 8.5, 36: 8, 35: 8, 34: 7.5, 33: 7.5,
  32: 7, 31: 7, 30: 7, 29: 6.5, 28: 6.5, 27: 6.5, 26: 6, 25: 6, 24: 6,
  23: 5.5, 22: 5.5, 21: 5.5, 20: 5.5, 19: 5, 18: 5, 17: 5, 16: 5,
  15: 4.5, 14: 4.5, 13: 4.5, 12: 4, 11: 4, 10: 4, 9: 3.5, 8: 3.5,
  7: 3, 6: 3, 5: 2.5, 4: 2.5, 3: 2, 2: 2, 1: 1, 0: 0,
}

export function rawScoreToBand(rawScore: number, totalQuestions = 40): number {
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

function scoreGapFill(student: unknown, acceptable: unknown): boolean {
  const studentArr = Array.isArray(student) ? student : [student]
  const acceptableArr = Array.isArray(acceptable) ? acceptable : [acceptable]

  if (studentArr.length !== acceptableArr.length) return false

  return studentArr.every((ans, i) => {
    const options = acceptableArr[i]
    const opts = Array.isArray(options) ? options : [options]
    const studentVal = normalizeText(String(ans ?? ''))
    return opts.some((o) => normalizeText(String(o)) === studentVal)
  })
}

export function scoreQuestion(
  type: QuestionType,
  studentValue: ResponseValue | null | undefined,
  acceptableAnswers: unknown
): boolean {
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
    case 'matching_information':
    case 'matching_headings': {
      const expected = Array.isArray(acceptableAnswers) ? acceptableAnswers[0] : acceptableAnswers
      return normalizeText(String(studentValue)) === normalizeText(String(expected))
    }
    case 'gap_fill':
      return scoreGapFill(studentValue, acceptableAnswers)
    default:
      return false
  }
}

export function scoreSession(
  questions: (Question & { acceptable_answers: unknown })[],
  responses: Map<string, ResponseValue | null>
): { rawScore: number; breakdown: QuestionBreakdownItem[] } {
  let rawScore = 0
  const breakdown: QuestionBreakdownItem[] = []

  for (const q of questions) {
    const studentValue = responses.get(q.id) ?? null

    if (q.type === 'gap_fill') {
      const blankCount = q.config.blanks?.length ?? 1
      const acceptable = q.acceptable_answers
      const studentArr = Array.isArray(studentValue) ? studentValue : [studentValue]
      const acceptableArr = Array.isArray(acceptable) ? acceptable : [acceptable]
      let correctBlanks = 0
      for (let i = 0; i < blankCount; i++) {
        const opts = acceptableArr[i]
        const options = Array.isArray(opts) ? opts : [opts]
        const ans = normalizeText(String(studentArr[i] ?? ''))
        if (options.some((o) => normalizeText(String(o)) === ans)) correctBlanks++
      }
      rawScore += correctBlanks
      breakdown.push({
        question_id: q.id,
        global_order: q.global_order,
        correct: correctBlanks === blankCount,
        student_value: studentValue,
        correct_value: q.acceptable_answers,
      })
    } else {
      const correct = scoreQuestion(q.type, studentValue, q.acceptable_answers)
      if (correct) rawScore += 1
      breakdown.push({
        question_id: q.id,
        global_order: q.global_order,
        correct,
        student_value: studentValue,
        correct_value: q.acceptable_answers,
      })
    }
  }

  return { rawScore, breakdown }
}
