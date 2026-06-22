import type { QuestionBreakdownItem } from '../../types/assessment'

export function formatBreakdownValue(value: unknown): string {
  if (value == null || value === '') return '—'
  if (Array.isArray(value)) {
    const parts = value.map((v) => String(v).trim()).filter(Boolean)
    return parts.length ? parts.join(', ') : '—'
  }
  if (typeof value === 'object') {
    const parts = Object.values(value as Record<string, unknown>)
      .map((v) => String(v).trim())
      .filter(Boolean)
    return parts.length ? parts.join(', ') : '—'
  }
  return String(value)
}

interface QuestionBreakdownPanelProps {
  items: QuestionBreakdownItem[]
}

export function QuestionBreakdownPanel({ items }: QuestionBreakdownPanelProps) {
  const sorted = [...items].sort((a, b) => a.global_order - b.global_order)

  if (sorted.length === 0) {
    return <p className="text-sm text-slate-500">No question breakdown available.</p>
  }

  return (
    <div className="space-y-2">
      {sorted.map((item) => (
        <div
          key={item.question_id}
          className={`rounded-md border px-4 py-3 text-sm ${
            item.correct ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
          }`}
        >
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium text-slate-900">Question {item.global_order}</span>
            <span
              className={`rounded px-2 py-0.5 text-xs font-semibold ${
                item.correct ? 'bg-green-200 text-green-900' : 'bg-red-200 text-red-900'
              }`}
            >
              {item.correct ? 'Correct' : 'Incorrect'}
            </span>
          </div>
          <div className="grid gap-1 text-slate-700 sm:grid-cols-2">
            <p>
              <span className="text-slate-500">Student answer:</span>{' '}
              {formatBreakdownValue(item.student_value)}
            </p>
            <p>
              <span className="text-slate-500">Correct answer:</span>{' '}
              {formatBreakdownValue(item.correct_value)}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
