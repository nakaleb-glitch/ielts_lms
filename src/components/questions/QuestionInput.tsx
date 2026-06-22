import type { McOptionCount, Question, ResponseValue } from '../../types/assessment'
import { generateParagraphLabels, generateRomanNumerals } from './questionDefaults'

interface QuestionInputProps {
  question: Question
  value: ResponseValue | null
  onChange: (value: ResponseValue) => void
  disabled?: boolean
}

export function QuestionInput({ question, value, onChange, disabled }: QuestionInputProps) {
  switch (question.type) {
    case 'multiple_choice': {
      const count = (question.config.optionCount ?? question.config.options?.length ?? 4) as McOptionCount
      const gridClass = count === 3 ? 'grid grid-cols-3 gap-2' : 'grid grid-cols-2 gap-2'
      return (
        <div className={gridClass}>
          {(question.config.options || []).map((opt, i) => (
            <label
              key={i}
              className="flex cursor-pointer items-start gap-2 rounded-md border border-slate-200 px-3 py-2 hover:bg-slate-50"
            >
              <input
                type="radio"
                name={question.id}
                checked={value === opt}
                disabled={disabled}
                onChange={() => onChange(opt)}
                className="mt-0.5 shrink-0"
              />
              <span className="text-[12pt] leading-snug">{opt}</span>
            </label>
          ))}
        </div>
      )
    }

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
              <span className="text-[12pt]">{opt}</span>
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
              <span className="text-[12pt]">{opt}</span>
            </label>
          ))}
        </div>
      )

    case 'summary_completion': {
      const bank = question.config.wordBank || []
      const labels = generateParagraphLabels(bank.length)
      const selected = typeof value === 'string' ? value : ''
      return (
        <div className="flex flex-wrap gap-1">
          {labels.map((label) => (
            <label
              key={label}
              className={`flex cursor-pointer items-center gap-1 rounded border px-2 py-1 text-[12pt] ${
                selected === label ? 'border-royal-blue bg-blue-50 font-medium' : 'border-slate-200 bg-white'
              }`}
            >
              <input
                type="radio"
                name={question.id}
                checked={selected === label}
                disabled={disabled}
                onChange={() => onChange(label)}
                className="sr-only"
              />
              {label}
            </label>
          ))}
        </div>
      )
    }

    case 'matching_information': {
      const labels = question.config.paragraphLabels || ['A', 'B', 'C', 'D']
      const selected = typeof value === 'string' ? value : ''
      return (
        <div className="flex flex-wrap gap-1">
          {labels.map((label) => (
            <label
              key={label}
              className={`flex cursor-pointer items-center gap-1 rounded border px-2 py-1 text-[12pt] ${
                selected === label ? 'border-royal-blue bg-blue-50 font-medium' : 'border-slate-200 bg-white'
              }`}
            >
              <input
                type="radio"
                name={question.id}
                checked={selected === label}
                disabled={disabled}
                onChange={() => onChange(label)}
                className="sr-only"
              />
              {label}
            </label>
          ))}
        </div>
      )
    }

    case 'matching_headings': {
      const headings = question.config.headings || []
      const numerals = generateRomanNumerals(headings.length)
      const selected = typeof value === 'string' ? value : ''
      return (
        <select
          className="rounded-md border border-slate-300 px-3 py-2 text-[12pt]"
          value={selected}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Select…</option>
          {headings.map((heading, i) => (
            <option key={i} value={numerals[i]}>
              {numerals[i]} — {heading}
            </option>
          ))}
        </select>
      )
    }

    case 'choose_a_title': {
      const options = question.config.options || []
      const labels = generateParagraphLabels(options.length)
      const selected = typeof value === 'string' ? value : ''
      return (
        <div className="space-y-2 pl-6">
          {options.map((title, i) => {
            const label = labels[i]
            return (
              <label
                key={label}
                className={`flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-[12pt] ${
                  selected === label ? 'bg-blue-50 font-medium text-slate-900' : 'text-slate-900 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name={question.id}
                  checked={selected === label}
                  disabled={disabled}
                  onChange={() => onChange(label)}
                  className="sr-only"
                />
                <span className="font-bold">{label}</span>
                <span>{title}</span>
              </label>
            )
          })}
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
