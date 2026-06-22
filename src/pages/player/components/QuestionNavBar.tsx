import { isAnswered } from '../../../components/questions/QuestionInput'
import type { ResponseValue } from '../../../types/assessment'

export type SaveState = 'saved' | 'unsaved' | 'saving' | 'error'

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
  saveState: SaveState
  lastSavedAt: string | null
  saveError: string | null
}

function formatSavedLabel(lastSavedAt: string): string {
  const savedAt = new Date(lastSavedAt)
  const secondsAgo = (Date.now() - savedAt.getTime()) / 1000
  if (secondsAgo < 15) return 'Saved just now'
  return `Saved at ${savedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
}

function SaveStatusBadge({
  saveState,
  lastSavedAt,
  saveError,
}: {
  saveState: SaveState
  lastSavedAt: string | null
  saveError: string | null
}) {
  if (saveState === 'unsaved') {
    return (
      <span className="whitespace-nowrap rounded bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-900">
        Unsaved changes
      </span>
    )
  }

  if (saveState === 'saving') {
    return (
      <span className="whitespace-nowrap rounded bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
        Saving…
      </span>
    )
  }

  if (saveState === 'error') {
    return (
      <span
        className="max-w-[12rem] truncate whitespace-nowrap rounded bg-red-100 px-2.5 py-1 text-xs font-medium text-red-800"
        title={saveError || 'Save failed'}
      >
        Save failed
      </span>
    )
  }

  return (
    <span className="whitespace-nowrap rounded bg-green-100 px-2.5 py-1 text-xs font-medium text-green-800">
      {lastSavedAt ? formatSavedLabel(lastSavedAt) : 'Saved'}
    </span>
  )
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
  saveState,
  lastSavedAt,
  saveError,
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

      <SaveStatusBadge saveState={saveState} lastSavedAt={lastSavedAt} saveError={saveError} />

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
