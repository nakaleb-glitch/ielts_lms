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

export const DEFAULT_DIRECTIONS: Record<QuestionType, string> = {
  multiple_choice: 'Choose the correct letter, A, B, C or D.',
  true_false_not_given:
    'Choose TRUE if the statement agrees with the information given in the text, choose FALSE if the statement contradicts the information, or choose NOT GIVEN if there is no information on this.',
  yes_no_not_given:
    'Choose YES if the statement agrees with the views of the writer, choose NO if the statement contradicts the views of the writer, or choose NOT GIVEN if it is impossible to say what the writer thinks about this.',
  gap_fill: 'Complete the notes. Write ONE WORD ONLY from the text for each answer.',
  matching: 'Match each statement with the correct option.',
}

export function defaultPrompt(type: QuestionType, index: number): string {
  switch (type) {
    case 'true_false_not_given':
    case 'yes_no_not_given':
      return `Statement ${index}…`
    case 'gap_fill':
      return `When … ${index} …`
    case 'multiple_choice':
      return `Question ${index}`
    default:
      return `Item ${index}`
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
