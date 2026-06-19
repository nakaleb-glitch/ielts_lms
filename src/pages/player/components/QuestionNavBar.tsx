import { isAnswered } from '../../../components/questions/QuestionInput'
import type { ResponseValue } from '../../../types/assessment'

export interface PartNav {
  partNumber: number
  passageId: string
  questions: { id: string; globalOrder: number }[]
  rangeStart: number
  rangeEnd: number
}

interface QuestionNavBarProps {
  parts: PartNav[]
  currentPartIndex: number
  currentQuestionId: string | null
  responses: Map<string, ResponseValue | null>
  flags: Map<string, boolean>
  onSelectPart: (index: number) => void
  onSelectQuestion: (questionId: string) => void
  onOverview: () => void
  timerLabel: string
}

export function QuestionNavBar({
  parts,
  currentPartIndex,
  currentQuestionId,
  responses,
  flags,
  onSelectPart,
  onSelectQuestion,
  onOverview,
  timerLabel,
}: QuestionNavBarProps) {
  return (
    <div className="flex items-center gap-3 border-t border-slate-300 bg-white px-3 py-2">
      <div className="flex flex-1 flex-wrap items-center gap-3 overflow-x-auto py-1">
        {parts.map((part, partIdx) => {
          const isActivePart = partIdx === currentPartIndex
          const answeredCount = part.questions.filter((q) =>
            isAnswered(responses.get(q.id) ?? null)
          ).length

          return (
            <div key={part.passageId} className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={() => onSelectPart(partIdx)}
                className={`rounded px-2 py-1 text-xs font-semibold ${
                  isActivePart
                    ? 'bg-royal-blue text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Part {part.partNumber}
                {!isActivePart && part.questions.length > 0 && (
                  <span className="ml-1 font-normal opacity-80">
                    ({answeredCount} of {part.questions.length})
                  </span>
                )}
              </button>

              {isActivePart &&
                part.questions.map((q) => {
                  const answered = isAnswered(responses.get(q.id) ?? null)
                  const flagged = flags.get(q.id)
                  const active = q.id === currentQuestionId
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => onSelectQuestion(q.id)}
                      className={`relative min-w-[2rem] rounded border px-2 py-1 text-xs ${
                        active
                          ? 'border-royal-blue bg-blue-50 font-semibold'
                          : 'border-slate-300 bg-white hover:bg-slate-50'
                      } ${flagged ? 'ring-1 ring-amber-400' : ''}`}
                    >
                      {q.globalOrder}
                      {answered && (
                        <span className="absolute left-0 right-0 top-0 h-0.5 rounded-t bg-royal-blue" />
                      )}
                    </button>
                  )
                })}
            </div>
          )
        })}
      </div>

      <span className="whitespace-nowrap rounded bg-slate-800 px-3 py-1 font-mono text-sm text-white">
        {timerLabel}
      </span>

      <button
        type="button"
        onClick={onOverview}
        className="rounded-md bg-royal-blue px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
      >
        Overview
      </button>
    </div>
  )
}
