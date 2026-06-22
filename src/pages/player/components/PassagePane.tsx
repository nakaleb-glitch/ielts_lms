import ReactMarkdown from 'react-markdown'
import { parseLabeledPassage } from '../../../lib/labeledPassage'

interface PassagePaneProps {
  title: string
  body: string
}

export function PassageBody({ body }: { body: string }) {
  const labeled = parseLabeledPassage(body)

  if (labeled) {
    return (
      <div className="space-y-4">
        {labeled.map((para) => (
          <div key={para.label} className="flex gap-3">
            <span className="w-5 shrink-0 text-sm font-bold text-slate-900">{para.label}</span>
            <div className="min-w-0 flex-1 text-[12pt] leading-relaxed text-slate-800">
              <ReactMarkdown>{para.text}</ReactMarkdown>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="text-[12pt] leading-relaxed text-slate-800">
      <ReactMarkdown>{body}</ReactMarkdown>
    </div>
  )
}

export function PassagePane({ title, body }: PassagePaneProps) {
  return (
    <div className="flex h-full flex-col overflow-hidden bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <PassageBody body={body} />
      </div>
    </div>
  )
}
