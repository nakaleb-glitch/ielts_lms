import { useParams } from 'react-router-dom'
import type { TestModule } from '../../types/assessment'

const MODULE_LABELS: Record<TestModule, string> = {
  reading: 'Reading',
  writing: 'Writing',
  listening: 'Listening',
}

export function ComingSoon() {
  const { module } = useParams<{ module: string }>()
  const label = MODULE_LABELS[(module as TestModule) || 'writing'] || 'This module'

  return (
    <div className="rounded-xl border border-slate-200 border-t-4 border-t-royal-yellow bg-white p-12 text-center">
      <h1 className="mb-2 text-2xl font-bold text-slate-900">{label}</h1>
      <p className="mb-1 text-lg text-royal-blue">Coming soon</p>
      <p className="text-sm text-slate-600">
        IELTS {label.toLowerCase()} tests will be available here in a future update.
      </p>
    </div>
  )
}
