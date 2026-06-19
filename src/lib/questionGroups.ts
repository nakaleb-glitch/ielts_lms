import type { Passage, Question, QuestionType } from '../types/assessment'

export interface QuestionWithAnswer extends Question {
  answer?: { acceptable_answers: unknown }
}

export interface QuestionGroup {
  groupId: string | null
  type: QuestionType
  directions: string
  noteHeading?: string
  questions: QuestionWithAnswer[]
  rangeStart: number
  rangeEnd: number
}

export interface PassageStructure {
  passage: Passage
  groups: QuestionGroup[]
  rangeStart: number
  rangeEnd: number
}

function groupKey(q: QuestionWithAnswer): string {
  return q.config.groupId || `solo-${q.id}`
}

export function groupQuestionsInPassage(questions: QuestionWithAnswer[]): QuestionGroup[] {
  const sorted = [...questions].sort((a, b) => a.global_order - b.global_order)
  const groups: QuestionGroup[] = []

  for (const q of sorted) {
    const key = groupKey(q)
    const last = groups[groups.length - 1]
    const lastKey = last ? (last.groupId || `solo-${last.questions[0]?.id}`) : null

    if (last && lastKey === key) {
      last.questions.push(q)
      last.rangeEnd = q.global_order
    } else {
      groups.push({
        groupId: q.config.groupId || null,
        type: q.type,
        directions: q.config.directions || '',
        noteHeading: q.config.noteHeading,
        questions: [q],
        rangeStart: q.global_order,
        rangeEnd: q.global_order,
      })
    }
  }

  return groups
}

export function buildPassageStructure(passage: Passage, questions: QuestionWithAnswer[]): PassageStructure {
  const groups = groupQuestionsInPassage(questions)
  const sorted = [...questions].sort((a, b) => a.global_order - b.global_order)
  return {
    passage,
    groups,
    rangeStart: sorted[0]?.global_order ?? 0,
    rangeEnd: sorted[sorted.length - 1]?.global_order ?? 0,
  }
}

export function formatQuestionRange(start: number, end: number): string {
  if (start === 0 && end === 0) return '—'
  if (start === end) return String(start)
  return `${start}–${end}`
}

export type PassageSection =
  | {
      kind: 'group'
      groupId: string
      type: QuestionType
      directions: string
      noteHeading?: string
      questions: QuestionWithAnswer[]
    }
  | { kind: 'solo'; question: QuestionWithAnswer }

export function organizePassageSections(questions: QuestionWithAnswer[]): PassageSection[] {
  const sorted = [...questions].sort((a, b) => a.global_order - b.global_order)
  const sections: PassageSection[] = []

  for (const q of sorted) {
    const gid = q.config.groupId
    if (gid) {
      const last = sections[sections.length - 1]
      if (last?.kind === 'group' && last.groupId === gid) {
        last.questions.push(q)
      } else {
        sections.push({
          kind: 'group',
          groupId: gid,
          type: q.type,
          directions: q.config.directions || '',
          noteHeading: q.config.noteHeading,
          questions: [q],
        })
      }
    } else {
      sections.push({ kind: 'solo', question: q })
    }
  }

  return sections
}
