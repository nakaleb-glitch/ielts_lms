import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export function useActiveExamSession(studentId: string | undefined) {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(Boolean(studentId))

  useEffect(() => {
    if (!studentId) {
      setSessionId(null)
      setLoading(false)
      return
    }

    let cancelled = false

    const load = async () => {
      setLoading(true)
      const { data } = await supabase
        .from('test_sessions')
        .select('id, assignment:test_assignments!inner(student_id)')
        .eq('status', 'in_progress')
        .eq('assignment.student_id', studentId)
        .limit(1)
        .maybeSingle()

      if (cancelled) return
      setSessionId(data?.id ?? null)
      setLoading(false)
    }

    load()

    return () => {
      cancelled = true
    }
  }, [studentId])

  return { sessionId, loading }
}
