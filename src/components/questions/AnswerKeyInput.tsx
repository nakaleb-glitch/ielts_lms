import type { Question, QuestionType } from '../../types/assessment'

interface AnswerKeyInputProps {
  type: QuestionType
  config: Question['config']
  value: unknown
  onChange: (value: unknown) => void
}

function toggleClass(selected: boolean) {
  return selected
    ? 'border-royal-blue bg-royal-blue text-white'
    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
}

export function AnswerKeyInput({ type, config, value, onChange }: AnswerKeyInputProps) {
  switch (type) {
    case 'multiple_choice': {
      const options = config.options || []
      const selected = Array.isArray(value) ? String(value[0] ?? '') : String(value ?? '')
      return (
        <div className="space-y-1">
          <p className="text-xs font-medium text-slate-500">Correct answer</p>
          <div className="flex flex-wrap gap-2">
            {options.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => onChange([opt])}
                className={`rounded-md border px-3 py-1.5 text-sm ${toggleClass(selected === opt)}`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )
    }

    case 'true_false_not_given': {
      const selected = Array.isArray(value) ? String(value[0] ?? '') : String(value ?? '')
      return (
        <div className="space-y-1">
          <p className="text-xs font-medium text-slate-500">Correct answer</p>
          <div className="flex flex-wrap gap-2">
            {['TRUE', 'FALSE', 'NOT GIVEN'].map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => onChange([opt])}
                className={`rounded-md border px-3 py-1.5 text-sm ${toggleClass(selected === opt)}`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )
    }

    case 'yes_no_not_given': {
      const selected = Array.isArray(value) ? String(value[0] ?? '') : String(value ?? '')
      return (
        <div className="space-y-1">
          <p className="text-xs font-medium text-slate-500">Correct answer</p>
          <div className="flex flex-wrap gap-2">
            {['YES', 'NO', 'NOT GIVEN'].map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => onChange([opt])}
                className={`rounded-md border px-3 py-1.5 text-sm ${toggleClass(selected === opt)}`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )
    }

    case 'gap_fill': {
      const blanks = config.blanks?.length ? config.blanks : ['answer']
      const arr = Array.isArray(value) ? value : [value]
      return (
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-500">Acceptable answers</p>
          {blanks.map((label, i) => {
            const opts = arr[i]
            const text = Array.isArray(opts) ? opts.join(', ') : String(opts ?? '')
            return (
              <div key={i}>
                <label className="mb-1 block text-xs text-slate-600">{label || `Blank ${i + 1}`}</label>
                <input
                  type="text"
                  className="w-full rounded-md border border-slate-200 px-2 py-1 text-sm"
                  value={text}
                  onChange={(e) => {
                    const next = [...arr]
                    next[i] = e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                    onChange(next)
                  }}
                  placeholder="answer1, answer2"
                />
              </div>
            )
          })}
        </div>
      )
    }

    case 'matching': {
      const items = config.items || []
      const options = config.matchOptions || []
      const obj = (value && typeof value === 'object' && !Array.isArray(value) ? value : {}) as Record<string, string>
      return (
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-500">Correct matches</p>
          {items.map((item, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="min-w-[120px] font-medium">{item}</span>
              <select
                className="rounded-md border border-slate-200 px-2 py-1 text-sm"
                value={obj[String(i)] || ''}
                onChange={(e) => onChange({ ...obj, [String(i)]: e.target.value })}
              >
                <option value="">Select…</option>
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
