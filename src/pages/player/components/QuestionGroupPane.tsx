import { useEffect, useRef } from 'react'
import type { QuestionGroup, QuestionWithAnswer } from '../../../lib/questionGroups'
import { formatQuestionRange } from '../../../lib/questionGroups'
import { QUESTION_TYPE_LABELS } from '../../../components/questions/questionDefaults'
import { QuestionInput } from '../../../components/questions/QuestionInput'
import type { ResponseValue } from '../../../types/assessment'

interface QuestionGroupPaneProps {
  groups: QuestionGroup[]
  responses: Map<string, ResponseValue | null>
  flags?: Map<string, boolean>
  activeQuestionId?: string | null
  onChange: (questionId: string, value: ResponseValue) => void
  onToggleFlag?: (questionId: string) => void
  readOnly?: boolean
}

function tfngOptions(type: QuestionWithAnswer['type']) {
  return type === 'yes_no_not_given' ? ['YES', 'NO', 'NOT GIVEN'] : ['TRUE', 'FALSE', 'NOT GIVEN']
}

function GroupBlock({
  group,
  responses,
  flags,
  activeQuestionId,
  onChange,
  onToggleFlag,
  readOnly,
}: {
  group: QuestionGroup
  responses: Map<string, ResponseValue | null>
  flags?: Map<string, boolean>
  activeQuestionId?: string | null
  onChange: (questionId: string, value: ResponseValue) => void
  onToggleFlag?: (questionId: string) => void
  readOnly?: boolean
}) {
  const range = formatQuestionRange(group.rangeStart, group.rangeEnd)
  const isTfng = group.type === 'true_false_not_given' || group.type === 'yes_no_not_given'
  const isGapFill = group.type === 'gap_fill'
  const options = tfngOptions(group.type)

  return (
    <section className="mb-6 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-2 text-sm font-semibold text-slate-900">
        Questions {range}
        <span className="ml-2 font-normal text-slate-500">({QUESTION_TYPE_LABELS[group.type]})</span>
      </h3>
      {group.directions && (
        <p className="mb-3 text-sm leading-relaxed text-slate-700">{group.directions}</p>
      )}
      {group.noteHeading && (
        <p className="mb-3 text-sm font-semibold text-slate-800">{group.noteHeading}</p>
      )}

      {isTfng && (
        <div className="space-y-1">
          {group.questions.map((q) => {
            const active = q.id === activeQuestionId
            const value = responses.get(q.id) ?? null
            return (
              <div
                key={q.id}
                id={`question-${q.id}`}
                className={`flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-slate-100 py-3 last:border-0 ${
                  active ? 'bg-blue-50/60 -mx-2 px-2 rounded' : ''
                }`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center text-xs font-bold ${
                    active ? 'bg-royal-blue text-white' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {q.global_order}
                </span>
                <p className="min-w-[140px] flex-1 text-sm text-slate-900">{q.prompt}</p>
                <div className="flex flex-wrap gap-1">
                  {options.map((opt) => (
                    <label
                      key={opt}
                      className={`flex cursor-pointer items-center gap-1 rounded border px-2 py-1 text-xs ${
                        value === opt ? 'border-royal-blue bg-blue-50 font-medium' : 'border-slate-200 bg-white'
                      }`}
                    >
                      <input
                        type="radio"
                        name={q.id}
                        checked={value === opt}
                        disabled={readOnly}
                        onChange={() => onChange(q.id, opt)}
                        className="sr-only"
                      />
                      {opt}
                    </label>
                  ))}
                </div>
                {!readOnly && onToggleFlag && (
                  <button
                    type="button"
                    onClick={() => onToggleFlag(q.id)}
                    className={`rounded px-1.5 py-0.5 text-[10px] ${
                      flags?.get(q.id) ? 'bg-amber-100 text-amber-800' : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    {flags?.get(q.id) ? '★' : '☆'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {isGapFill && (
        <ul className="list-none space-y-2 pl-0">
          {group.questions.map((q) => {
            const active = q.id === activeQuestionId
            const value = responses.get(q.id) ?? null
            const arr = Array.isArray(value) ? value : [value ?? '']
            const text = String(arr[0] ?? '')
            return (
              <li
                key={q.id}
                id={`question-${q.id}`}
                className={`flex flex-wrap items-center gap-2 text-sm leading-relaxed ${
                  active ? 'bg-blue-50/60 -mx-2 px-2 py-1 rounded' : ''
                }`}
              >
                <span className="text-slate-600">•</span>
                <span className="text-slate-900">{q.prompt}</span>
                <input
                  type="text"
                  disabled={readOnly}
                  value={text}
                  onChange={(e) => onChange(q.id, [e.target.value])}
                  className={`inline-block w-14 border-b-2 border-slate-800 bg-transparent text-center text-sm outline-none focus:border-royal-blue ${
                    active ? 'bg-white' : ''
                  }`}
                  aria-label={`Answer for question ${q.global_order}`}
                  placeholder={String(q.global_order)}
                />
              </li>
            )
          })}
        </ul>
      )}

      {group.type === 'multiple_choice' && (
        <div className="space-y-4">
          {group.questions.map((q) => {
            const active = q.id === activeQuestionId
            return (
              <div
                key={q.id}
                id={`question-${q.id}`}
                className={`rounded border border-slate-100 p-3 ${active ? 'border-royal-blue bg-blue-50/40' : ''}`}
              >
                <p className="mb-2 text-sm font-medium text-slate-900">
                  <span className="mr-2 inline-flex h-6 w-6 items-center justify-center bg-slate-200 text-xs font-bold">
                    {q.global_order}
                  </span>
                  {q.prompt}
                </p>
                <QuestionInput
                  question={q}
                  value={responses.get(q.id) ?? null}
                  onChange={(v) => onChange(q.id, v)}
                  disabled={readOnly}
                />
              </div>
            )
          })}
        </div>
      )}

      {group.type === 'matching' && (
        <div className="space-y-4">
          {group.questions.map((q) => (
            <div key={q.id} id={`question-${q.id}`} className="rounded border border-slate-100 p-3">
              <p className="mb-2 text-sm font-medium">
                <span className="mr-2 font-bold">Q{q.global_order}</span>
                {q.prompt}
              </p>
              <QuestionInput
                question={q}
                value={responses.get(q.id) ?? null}
                onChange={(v) => onChange(q.id, v)}
                disabled={readOnly}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function SoloQuestion({
  question,
  responses,
  activeQuestionId,
  onChange,
  onToggleFlag,
  flags,
  readOnly,
}: {
  question: QuestionWithAnswer
  responses: Map<string, ResponseValue | null>
  activeQuestionId?: string | null
  onChange: (questionId: string, value: ResponseValue) => void
  onToggleFlag?: (questionId: string) => void
  flags?: Map<string, boolean>
  readOnly?: boolean
}) {
  const active = question.id === activeQuestionId
  return (
    <section
      id={`question-${question.id}`}
      className={`mb-4 rounded-md border border-slate-200 bg-white p-4 ${active ? 'border-royal-blue' : ''}`}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-800">Question {question.global_order}</span>
        {!readOnly && onToggleFlag && (
          <button
            type="button"
            onClick={() => onToggleFlag(question.id)}
            className={`rounded px-2 py-0.5 text-xs ${
              flags?.get(question.id) ? 'bg-amber-100 text-amber-800' : 'text-slate-400'
            }`}
          >
            {flags?.get(question.id) ? 'Flagged' : 'Flag'}
          </button>
        )}
      </div>
      <p className="mb-3 text-sm font-medium text-slate-900">{question.prompt}</p>
      <QuestionInput
        question={question}
        value={responses.get(question.id) ?? null}
        onChange={(v) => onChange(question.id, v)}
        disabled={readOnly}
      />
    </section>
  )
}

export function QuestionGroupPane({
  groups,
  responses,
  flags,
  activeQuestionId,
  onChange,
  onToggleFlag,
  readOnly,
}: QuestionGroupPaneProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const prevActive = useRef<string | null>(null)

  useEffect(() => {
    if (!activeQuestionId || activeQuestionId === prevActive.current) return
    prevActive.current = activeQuestionId
    const el = document.getElementById(`question-${activeQuestionId}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [activeQuestionId])

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto bg-slate-50 px-4 py-4">
      {groups.map((group, i) => {
        if (group.groupId === null && group.questions.length === 1) {
          return (
            <SoloQuestion
              key={group.questions[0].id}
              question={group.questions[0]}
              responses={responses}
              activeQuestionId={activeQuestionId}
              onChange={onChange}
              onToggleFlag={onToggleFlag}
              flags={flags}
              readOnly={readOnly}
            />
          )
        }
        return (
          <GroupBlock
            key={group.groupId || `group-${i}`}
            group={group}
            responses={responses}
            flags={flags}
            activeQuestionId={activeQuestionId}
            onChange={onChange}
            onToggleFlag={onToggleFlag}
            readOnly={readOnly}
          />
        )
      })}
      {groups.length === 0 && (
        <p className="text-sm text-slate-500">No questions in this part.</p>
      )}
    </div>
  )
}
