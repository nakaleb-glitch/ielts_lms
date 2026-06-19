import ReactMarkdown from 'react-markdown'

interface PassagePaneProps {
  title: string
  body: string
}

export function PassagePane({ title, body }: PassagePaneProps) {
  return (
    <div className="flex h-full flex-col overflow-hidden bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 text-sm leading-relaxed text-slate-800">
        <ReactMarkdown>{body}</ReactMarkdown>
      </div>
    </div>
  )
}
