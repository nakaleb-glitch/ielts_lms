import { isAnswered } from '../../../components/questions/QuestionInput'
import type { ResponseValue } from '../../../types/assessment'

interface QuestionNavBarProps {
  total: number
  currentIndex: number
  responses: Map<string, ResponseValue | null>
  flags: Map<string, boolean>
  questionIds: string[]
  onSelect: (index: number) => void
  onPrev: () => void
  onNext: () => void
  onOverview: () => void
  timerLabel: string
}

export function QuestionNavBar({
  total,
  currentIndex,
  responses,
  flags,
  questionIds,
  onSelect,
  onPrev,
  onNext,
  onOverview,
  timerLabel,
}: QuestionNavBarProps) {
  return (
    <div className="flex items-center gap-2 border-t border-slate-300 bg-white px-3 py-2">
      <button
        type="button"
        onClick={onPrev}
        disabled={currentIndex === 0}
        className="rounded border border-slate-300 px-2 py-1 text-sm disabled:opacity-40"
      >
        ←
      </button>

      <div className="flex flex-1 flex-wrap gap-1 overflow-x-auto py-1">
        {Array.from({ length: total }, (_, i) => {
          const qId = questionIds[i]
          const answered = isAnswered(responses.get(qId) ?? null)
          const flagged = flags.get(qId)
          const active = i === currentIndex
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelect(i)}
              className={`relative min-w-[2rem] rounded border px-2 py-1 text-xs ${
                active ? 'border-blue-600 bg-blue-50 font-semibold' : 'border-slate-300 bg-white'
              } ${flagged ? 'ring-1 ring-amber-400' : ''}`}
            >
              {i + 1}
              {answered && (
                <span className="absolute left-0 right-0 top-0 h-0.5 rounded-t bg-blue-500" />
              )}
            </button>
          )
        })}
      </div>

      <button
        type="button"
        onClick={onNext}
        disabled={currentIndex >= total - 1}
        className="rounded border border-slate-300 px-2 py-1 text-sm disabled:opacity-40"
      >
        →
      </button>

      <span className="whitespace-nowrap rounded bg-slate-800 px-3 py-1 font-mono text-sm text-white">
        {timerLabel}
      </span>

      <button
        type="button"
        onClick={onOverview}
        className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
      >
        Overview
      </button>
    </div>
  )
}
