import type { Question, ResponseValue } from '../../../types/assessment'
import { QuestionInput } from '../../../components/questions/QuestionInput'

interface QuestionPaneProps {
  question: Question
  questionNumber: number
  value: ResponseValue | null
  flagged: boolean
  onChange: (value: ResponseValue) => void
  onToggleFlag: () => void
  readOnly?: boolean
}

export function QuestionPane({
  question,
  questionNumber,
  value,
  flagged,
  onChange,
  onToggleFlag,
  readOnly,
}: QuestionPaneProps) {
  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-50">
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <span className="text-sm font-semibold text-slate-800">Question {questionNumber}</span>
        {!readOnly && (
          <button
            type="button"
            onClick={onToggleFlag}
            className={`rounded-md px-2 py-1 text-xs ${
              flagged ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {flagged ? 'Flagged' : 'Flag for review'}
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <p className="mb-4 text-sm font-medium text-slate-900">{question.prompt}</p>
        <QuestionInput
          question={question}
          value={value}
          onChange={onChange}
          disabled={readOnly}
        />
      </div>
    </div>
  )
}
