import type { QuestionType } from '../../types/assessment'

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  multiple_choice: 'Multiple Choice',
  true_false_not_given: 'True / False / Not Given',
  yes_no_not_given: 'Yes / No / Not Given',
  gap_fill: 'Gap Fill',
  matching: 'Matching',
}

export function defaultConfig(type: QuestionType) {
  switch (type) {
    case 'multiple_choice':
      return { options: ['Option A', 'Option B', 'Option C', 'Option D'] }
    case 'gap_fill':
      return { blanks: ['blank 1'] }
    case 'matching':
      return { items: ['Item 1', 'Item 2'], matchOptions: ['Option A', 'Option B'] }
    default:
      return {}
  }
}

export function defaultAnswer(type: QuestionType): unknown {
  switch (type) {
    case 'multiple_choice':
      return ['Option A']
    case 'true_false_not_given':
      return ['TRUE']
    case 'yes_no_not_given':
      return ['NOT GIVEN']
    case 'gap_fill':
      return [['answer']]
    case 'matching':
      return { '0': 'Option A', '1': 'Option B' }
    default:
      return []
  }
}
