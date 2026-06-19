import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { Test, TestModule } from '../../types/assessment'

const MODULE_LABELS: Record<TestModule, string> = {
  reading: 'Reading',
  writing: 'Writing',
  listening: 'Listening',
}

const DEFAULT_INSTRUCTIONS: Record<TestModule, string> = {
  reading: 'Read each passage carefully and answer all questions.',
  writing: 'Complete all writing tasks within the time limit.',
  listening: 'Listen carefully and answer all questions.',
}

interface TestListProps {
  module: TestModule
}

export function TestList({ module }: TestListProps) {
  const { profile, user } = useAuth()
  const navigate = useNavigate()
  const [tests, setTests] = useState<Test[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newTestTitle, setNewTestTitle] = useState('')
  const label = MODULE_LABELS[module]
  const canCreate = module === 'reading'

  useEffect(() => {
    loadTests()
  }, [profile?.id, module])

  const loadTests = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('tests')
      .select('*')
      .eq('module', module)
      .order('updated_at', { ascending: false })
    setTests(data || [])
    setLoading(false)
  }

  const openCreateModal = () => {
    setError('')
    setNewTestTitle('')
    setShowCreateModal(true)
  }

  const createTest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canCreate) return
    setError('')

    const title = newTestTitle.trim()
    if (!title) {
      setError('Test name is required.')
      return
    }

    const userId = user?.id ?? profile?.id
    if (!userId) {
      setError('You must be signed in to create a test.')
      return
    }

    setCreating(true)

    const { data, error: testError } = await supabase
      .from('tests')
      .insert({
        title,
        instructions: DEFAULT_INSTRUCTIONS[module],
        duration_minutes: module === 'reading' ? 60 : module === 'writing' ? 60 : 30,
        module,
        created_by: userId,
      })
      .select()
      .single()

    if (testError || !data) {
      setCreating(false)
      setError(testError?.message || 'Failed to create test. Check that Supabase migrations have been run.')
      return
    }

    if (module === 'reading') {
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
    } else {
      setCreating(false)
    }

    setShowCreateModal(false)
    setNewTestTitle('')
    navigate(`/tests/${data.id}/edit`)
  }

  const deleteTest = async (id: string, status: string) => {
    const message = status === 'published'
      ? 'This will permanently delete the test and remove all student assignments and results. Continue?'
      : 'Delete this draft test?'
    if (!confirm(message)) return

    const { error: deleteError } = await supabase.from('tests').delete().eq('id', id)
    if (deleteError) {
      setError(deleteError.message)
      return
    }
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

      {!canCreate && (
        <div className="mb-4 rounded-md border border-royal-yellow/50 bg-yellow-50 px-4 py-3 text-sm text-slate-700">
          {label} test creation is coming soon. Only Reading tests can be created at this time.
        </div>
      )}

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">{label} Tests</h1>
        {canCreate && (
          <button
            type="button"
            onClick={openCreateModal}
            className="rounded-md bg-royal-blue px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Create Test
          </button>
        )}
      </div>

      {tests.length === 0 ? (
        canCreate ? (
          <button
            type="button"
            onClick={openCreateModal}
            className="w-full rounded-lg border border-dashed border-royal-blue/40 bg-white p-8 text-center text-slate-600 hover:border-royal-blue hover:bg-blue-50/30"
          >
            {`No tests yet. Click here to create your first IELTS ${label} test.`}
          </button>
        ) : (
          <div className="w-full rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">
            No {label.toLowerCase()} tests yet. Test creation for this module is coming soon.
          </div>
        )
      ) : (
        <div className="space-y-3">
          {tests.map((test) => (
            <div
              key={test.id}
              className="flex items-center justify-between rounded-lg border border-slate-200 border-t-4 border-t-royal-blue bg-white p-4"
            >
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
                <button
                  type="button"
                  onClick={() => deleteTest(test.id, test.status)}
                  className="rounded-md bg-red-50 px-3 py-1.5 text-sm text-royal-red hover:bg-red-100"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Create Test</h2>
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false)
                  setNewTestTitle('')
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
            <form onSubmit={createTest} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Test Name</label>
                <input
                  type="text"
                  placeholder="IELTS Reading Practice 1"
                  className="w-full rounded-md border border-slate-300 px-3 py-2"
                  value={newTestTitle}
                  onChange={(e) => setNewTestTitle(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false)
                    setNewTestTitle('')
                  }}
                  className="rounded-md px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-md bg-royal-blue px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
