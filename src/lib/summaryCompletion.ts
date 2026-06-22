export type SummarySegment =
  | { kind: 'text'; value: string }
  | { kind: 'blank'; index: number }

const BLANK_PATTERN = /\{\{(\d+)\}\}/g

export function countSummaryBlanks(text: string): number {
  const matches = text.match(BLANK_PATTERN)
  if (!matches) return 0
  const indices = new Set(matches.map((m) => Number(m.replace(/\D/g, ''))))
  return indices.size
}

export function parseSummaryTemplate(text: string): SummarySegment[] {
  const segments: SummarySegment[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  const pattern = new RegExp(BLANK_PATTERN.source, 'g')
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ kind: 'text', value: text.slice(lastIndex, match.index) })
    }
    segments.push({ kind: 'blank', index: Number(match[1]) })
    lastIndex = pattern.lastIndex
  }

  if (lastIndex < text.length) {
    segments.push({ kind: 'text', value: text.slice(lastIndex) })
  }

  return segments
}
