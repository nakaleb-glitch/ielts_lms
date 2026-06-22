import type { McOptionCount, QuestionType } from '../../types/assessment'

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  multiple_choice: 'Multiple Choice',
  true_false_not_given: 'True / False / Not Given',
  yes_no_not_given: 'Yes / No / Not Given',
  summary_completion: 'Summary Completion',
  matching_information: 'Matching Information',
  matching_headings: 'Matching Headings',
  choose_a_title: 'Choose a Title',
}

const ROMAN_NUMERALS = [
  'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
  'XI', 'XII', 'XIII', 'XIV', 'XV',
]

export function generateParagraphLabels(count: number): string[] {
  const n = Math.max(1, Math.min(26, count))
  return Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i))
}

export function formatParagraphLabelRange(labels: string[]): string {
  if (labels.length === 0) return ''
  if (labels.length === 1) return labels[0]
  return `${labels[0]}–${labels[labels.length - 1]}`
}

export function generateRomanNumerals(count: number): string[] {
  const n = Math.max(1, Math.min(ROMAN_NUMERALS.length, count))
  return ROMAN_NUMERALS.slice(0, n)
}

export function formatRomanRange(labels: string[]): string {
  if (labels.length === 0) return ''
  if (labels.length === 1) return labels[0]
  return `${labels[0]}–${labels[labels.length - 1]}`
}

export function headingWithNumeral(index: number, text: string): string {
  const numeral = ROMAN_NUMERALS[index] ?? String(index + 1)
  return `${numeral}  ${text}`
}

export function defaultHeadings(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `Heading ${i + 1}`)
}

export function emptyWordBank(count: number): string[] {
  return Array.from({ length: Math.max(0, count) }, () => '')
}

export const SUMMARY_TEXT_PLACEHOLDER =
  'Write the summary here. Insert blanks using {{1}}, {{2}}, {{3}}, etc. — one numbered placeholder per blank, matching the questions in this group (e.g. {{1}} … {{6}} for 6 blanks).'

const MC_OPTION_LABELS = ['Option A', 'Option B', 'Option C', 'Option D']

export function defaultMcOptions(count: McOptionCount): string[] {
  return MC_OPTION_LABELS.slice(0, count)
}

export function resizeMcOptions(options: string[], count: McOptionCount): string[] {
  const resized = options.slice(0, count)
  while (resized.length < count) {
    resized.push(MC_OPTION_LABELS[resized.length] ?? `Option ${String.fromCharCode(65 + resized.length)}`)
  }
  return resized
}

export function mcDirections(count: McOptionCount): string {
  return count === 3
    ? 'Choose the correct letter, A, B or C.'
    : 'Choose the correct letter, A, B, C or D.'
}

export function defaultTitleOptions(): string[] {
  return [
    'Coffee: A Popular Drink',
    'Coffee: The Main Consumers',
    'Coffee: The Main Producers',
  ]
}

export const CHOOSE_TITLE_PROMPT = 'What is the best title for the reading passage above?'

export function defaultConfig(type: QuestionType, mcOptionCount: McOptionCount = 4) {
  switch (type) {
    case 'multiple_choice':
      return { options: defaultMcOptions(mcOptionCount), optionCount: mcOptionCount }
    case 'summary_completion':
      return { wordBank: emptyWordBank(10), summaryText: '' }
    case 'matching_information':
      return { paragraphLabels: generateParagraphLabels(8), allowReuse: true }
    case 'matching_headings':
      return {
        paragraphLabels: generateParagraphLabels(4),
        headings: defaultHeadings(9),
      }
    case 'choose_a_title':
      return { options: defaultTitleOptions() }
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
  summary_completion:
    'Complete the summary below by selecting the right word from the list below. Write the correct letter for your answer.',
  matching_information:
    'Reading Passage has eight paragraphs labelled A–H.\n\nWhich paragraph contains the following information?\n\nWrite the correct letter, A–H, in boxes on your answer sheet.',
  matching_headings:
    'Choose the correct heading (I–IX) for paragraphs A, B, C and D in the passage below.',
  choose_a_title: 'Choose the correct letter, A, B or C.',
}

export function defaultPrompt(
  type: QuestionType,
  index: number,
  paragraphLabel?: string
): string {
  switch (type) {
    case 'true_false_not_given':
    case 'yes_no_not_given':
    case 'matching_information':
      return `Statement ${index}…`
    case 'matching_headings':
      return paragraphLabel ? `Paragraph ${paragraphLabel}` : `Paragraph ${index}`
    case 'summary_completion':
      return `Blank ${index}`
    case 'multiple_choice':
      return `Question ${index}`
    case 'choose_a_title':
      return CHOOSE_TITLE_PROMPT
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
    case 'summary_completion':
      return ['A']
    case 'matching_information':
    case 'matching_headings':
      return ['I']
    case 'choose_a_title':
      return ['A']
    default:
      return []
  }
}
