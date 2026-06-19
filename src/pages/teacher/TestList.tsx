import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { Test } from '../../types/assessment'

export function TestList() {
  const { profile, user } = useAuth()
  const navigate = useNavigate()
  const [tests, setTests] = useState<Test[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadTests()
  }, [profile?.id])

  const loadTests = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('tests')
      .select('*')
      .order('updated_at', { ascending: false })
    setTests(data || [])
    setLoading(false)
  }

  const createTest = async () => {
    setError('')
    const userId = user?.id ?? profile?.id
    if (!userId) {
      setError('You must be signed in to create a test.')
      return
    }

    setCreating(true)

    const { data, error: testError } = await supabase
      .from('tests')
      .insert({
        title: 'Untitled Reading Test',
        instructions: 'Read each passage carefully and answer all questions.',
        duration_minutes: 60,
        created_by: userId,
      })
      .select()
      .single()

    if (testError || !data) {
      setCreating(false)
      setError(testError?.message || 'Failed to create test. Check that Supabase migrations have been run.')
      return
    }

    const { error: passageError } = await supabase.from('passages').insert({
      test_id: data.id,
      order_index: 1,
      title: 'Passage 1',
      body: '',
    })

    setCreating(false)

    if (passageError) {
      setError(passageError.message)
      return
    }

    navigate(`/tests/${data.id}/edit`)
  }

  const deleteTest = async (id: string) => {
    if (!confirm('Delete this draft test?')) return
    await supabase.from('tests').delete().eq('id', id)
    loadTests()
  }

  if (loading) return <p>Loading tests...</p>

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-md border border-royal-red/30 bg-red-50 px-4 py-3 text-sm text-royal-red">
          {error}
        </div>
      )}

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Reading Tests</h1>
        <button
          type="button"
          onClick={createTest}
          disabled={creating}
          className="rounded-md bg-royal-blue px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {creating ? 'Creating...' : 'Create test'}
        </button>
      </div>

      {tests.length === 0 ? (
        <button
          type="button"
          onClick={createTest}
          disabled={creating}
          className="w-full rounded-lg border border-dashed border-royal-blue/40 bg-white p-8 text-center text-slate-600 hover:border-royal-blue hover:bg-blue-50/30 disabled:opacity-50"
        >
          {creating ? 'Creating test...' : 'No tests yet. Click here to create your first IELTS Reading test.'}
        </button>
      ) : (
        <div className="space-y-3">
          {tests.map((test) => (
            <div key={test.id} className="flex items-center justify-between rounded-lg border border-slate-200 border-t-4 border-t-royal-blue bg-white p-4">
              <div>
                <h2 className="font-semibold text-slate-900">{test.title}</h2>
                <p className="text-sm text-slate-500">
                  {test.duration_minutes} min ·{' '}
                  <span className={test.status === 'published' ? 'text-green-600' : 'text-royal-yellow'}>
                    {test.status}
                  </span>
                </p>
              </div>
              <div className="flex gap-2">
                <Link
                  to={`/tests/${test.id}/edit`}
                  className="rounded-md bg-slate-100 px-3 py-1.5 text-sm hover:bg-slate-200"
                >
                  Edit
                </Link>
                {test.status === 'published' && (
                  <>
                    <Link
                      to={`/tests/${test.id}/assign`}
                      className="rounded-md bg-slate-100 px-3 py-1.5 text-sm hover:bg-slate-200"
                    >
                      Assign
                    </Link>
                    <Link
                      to={`/tests/${test.id}/results`}
                      className="rounded-md bg-slate-100 px-3 py-1.5 text-sm hover:bg-slate-200"
                    >
                      Results
                    </Link>
                  </>
                )}
                {test.status === 'draft' && (
                  <button
                    type="button"
                    onClick={() => deleteTest(test.id)}
                    className="rounded-md bg-red-50 px-3 py-1.5 text-sm text-royal-red hover:bg-red-100"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
