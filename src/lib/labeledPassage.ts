export interface LabeledParagraph {
  label: string
  text: string
}

export function parseLabeledPassage(body: string): LabeledParagraph[] | null {
  const trimmed = body.trim()
  if (!trimmed) return null

  const parts = trimmed.split(/(?=^\*\*[A-Z]\*\*\s*$)/m)
  const paragraphs: LabeledParagraph[] = []

  for (const part of parts) {
    const match = part.match(/^\*\*([A-Z])\*\*\s*\n?([\s\S]*)$/)
    if (match) {
      paragraphs.push({ label: match[1], text: match[2].trim() })
    }
  }

  return paragraphs.length >= 2 ? paragraphs : null
}

export function labeledPassagePlaceholder(): string {
  return `**A**

First paragraph text…

**B**

Second paragraph text…`
}
