import type { Question, ResponseValue } from '../../types/assessment'

interface QuestionInputProps {
  question: Question
  value: ResponseValue | null
  onChange: (value: ResponseValue) => void
  disabled?: boolean
}

export function QuestionInput({ question, value, onChange, disabled }: QuestionInputProps) {
  switch (question.type) {
    case 'multiple_choice':
      return (
        <div className="space-y-2">
          {(question.config.options || []).map((opt, i) => (
            <label key={i} className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 px-3 py-2 hover:bg-slate-50">
              <input
                type="radio"
                name={question.id}
                checked={value === opt}
                disabled={disabled}
                onChange={() => onChange(opt)}
              />
              <span>{opt}</span>
            </label>
          ))}
        </div>
      )

    case 'true_false_not_given':
      return (
        <div className="flex flex-wrap gap-2">
          {['TRUE', 'FALSE', 'NOT GIVEN'].map((opt) => (
            <label key={opt} className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 px-3 py-2">
              <input
                type="radio"
                name={question.id}
                checked={value === opt}
                disabled={disabled}
                onChange={() => onChange(opt)}
              />
              <span>{opt}</span>
            </label>
          ))}
        </div>
      )

    case 'yes_no_not_given':
      return (
        <div className="flex flex-wrap gap-2">
          {['YES', 'NO', 'NOT GIVEN'].map((opt) => (
            <label key={opt} className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 px-3 py-2">
              <input
                type="radio"
                name={question.id}
                checked={value === opt}
                disabled={disabled}
                onChange={() => onChange(opt)}
              />
              <span>{opt}</span>
            </label>
          ))}
        </div>
      )

    case 'gap_fill': {
      const blanks = question.config.blanks || ['answer']
      const arr = Array.isArray(value) ? value : blanks.map(() => '')
      return (
        <div className="space-y-3">
          {blanks.map((label, i) => (
            <div key={i}>
              <label className="mb-1 block text-sm text-slate-600">{label || `Blank ${i + 1}`}</label>
              <input
                type="text"
                className="w-full rounded-md border border-slate-300 px-3 py-2"
                value={arr[i] || ''}
                disabled={disabled}
                onChange={(e) => {
                  const next = [...arr]
                  next[i] = e.target.value
                  onChange(next)
                }}
              />
            </div>
          ))}
        </div>
      )
    }

    case 'matching': {
      const items = question.config.items || []
      const options = question.config.matchOptions || []
      const obj = (value && typeof value === 'object' && !Array.isArray(value) ? value : {}) as Record<string, string>
      return (
        <div className="space-y-3">
          {items.map((item, i) => (
            <div key={i} className="flex flex-wrap items-center gap-3">
              <span className="min-w-[140px] text-sm font-medium">{item}</span>
              <select
                className="rounded-md border border-slate-300 px-3 py-2"
                value={obj[String(i)] || ''}
                disabled={disabled}
                onChange={(e) => onChange({ ...obj, [String(i)]: e.target.value })}
              >
                <option value="">Select...</option>
                {options.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )
    }

    default:
      return null
  }
}

export function isAnswered(value: ResponseValue | null | undefined): boolean {
  if (value == null) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.some((v) => String(v).trim().length > 0)
  if (typeof value === 'object') return Object.values(value).some((v) => String(v).trim().length > 0)
  return false
}
