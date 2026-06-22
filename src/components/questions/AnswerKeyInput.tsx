import type { Question, QuestionType } from '../../types/assessment'
import { generateParagraphLabels, generateRomanNumerals } from './questionDefaults'

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

    case 'summary_completion': {
      const bank = config.wordBank || []
      const labels = generateParagraphLabels(bank.length)
      const selected = Array.isArray(value) ? String(value[0] ?? '') : String(value ?? '')
      return (
        <div className="space-y-1">
          <p className="text-xs font-medium text-slate-500">Correct letter</p>
          <div className="flex flex-wrap gap-2">
            {labels.map((label, i) => (
              <button
                key={label}
                type="button"
                onClick={() => onChange([label])}
                className={`rounded-md border px-3 py-1.5 text-sm ${toggleClass(selected === label)}`}
                title={bank[i]}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )
    }

    case 'matching_information': {
      const labels = config.paragraphLabels || ['A', 'B', 'C', 'D']
      const selected = Array.isArray(value) ? String(value[0] ?? '') : String(value ?? '')
      return (
        <div className="space-y-1">
          <p className="text-xs font-medium text-slate-500">Correct paragraph</p>
          <div className="flex flex-wrap gap-2">
            {labels.map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => onChange([label])}
                className={`rounded-md border px-3 py-1.5 text-sm ${toggleClass(selected === label)}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )
    }

    case 'matching_headings': {
      const headings = config.headings || []
      const numerals = generateRomanNumerals(headings.length)
      const selected = Array.isArray(value) ? String(value[0] ?? '') : String(value ?? '')
      return (
        <div className="space-y-1">
          <p className="text-xs font-medium text-slate-500">Correct heading</p>
          <div className="flex flex-wrap gap-2">
            {numerals.map((numeral, i) => (
              <button
                key={numeral}
                type="button"
                onClick={() => onChange([numeral])}
                className={`rounded-md border px-3 py-1.5 text-sm ${toggleClass(selected === numeral)}`}
                title={headings[i]}
              >
                {numeral}
              </button>
            ))}
          </div>
        </div>
      )
    }

    default:
      return null
  }
}
