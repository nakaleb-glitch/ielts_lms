import { isAnswered } from '../../../components/questions/QuestionInput'
import type { ResponseValue } from '../../../types/assessment'

interface OverviewModalProps {
  open: boolean
  total: number
  questionIds: string[]
  responses: Map<string, ResponseValue | null>
  flags: Map<string, boolean>
  onClose: () => void
  onSubmit: () => void
  submitting: boolean
}

export function OverviewModal({
  open,
  total,
  questionIds,
  responses,
  flags,
  onClose,
  onSubmit,
  submitting,
}: OverviewModalProps) {
  if (!open) return null

  const unanswered = questionIds.filter((id) => !isAnswered(responses.get(id) ?? null)).length
  const flagged = questionIds.filter((id) => flags.get(id)).length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-bold">Submit test?</h2>
        <ul className="mb-4 space-y-1 text-sm text-slate-700">
          <li>Total questions: {total}</li>
          <li>Unanswered: {unanswered}</li>
          <li>Flagged for review: {flagged}</li>
        </ul>
        {unanswered > 0 && (
          <p className="mb-4 text-sm text-amber-700">
            You have unanswered questions. You can still submit, but they will be marked incorrect.
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm"
          >
            Continue test
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Submit test'}
          </button>
        </div>
      </div>
    </div>
  )
}
