import { Navigate, useParams } from 'react-router-dom'
import { TestList } from './TestList'
import type { TestModule } from '../../types/assessment'

const VALID: TestModule[] = ['reading', 'writing', 'listening']

export function ModuleTestList() {
  const { module } = useParams<{ module: string }>()

  if (!module || !VALID.includes(module as TestModule)) {
    return <Navigate to="/tests/reading" replace />
  }

  return <TestList module={module as TestModule} />
}
