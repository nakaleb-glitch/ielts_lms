import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { QuestionInput } from '../../components/questions/QuestionInput'
import { defaultAnswer, defaultConfig, QUESTION_TYPE_LABELS } from '../../components/questions/questionDefaults'
import type { Passage, Question, QuestionType, Test } from '../../types/assessment'

type PassageWithQuestions = Passage & { questions: (Question & { answer?: { acceptable_answers: unknown } })[] }

export function TestBuilder() {
  const { testId } = useParams<{ testId: string }>()
  const [test, setTest] = useState<Test | null>(null)
  const [passages, setPassages] = useState<PassageWithQuestions[]>([])
  const [activePassageId, setActivePassageId] = useState<string | null>(null)
  const [previewQuestionId, setPreviewQuestionId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<'edit' | 'preview'>('edit')

  const load = useCallback(async () => {
    if (!testId) return
    const { data: testData } = await supabase.from('tests').select('*').eq('id', testId).single()
    setTest(testData)

    const { data: passageData } = await supabase
      .from('passages')
      .select(`
        *,
        questions(
          *,
          question_answers(acceptable_answers)
        )
      `)
      .eq('test_id', testId)
      .order('order_index')

    const mapped = (passageData || []).map((p) => ({
      ...p,
      questions: (p.questions || [])
        .sort((a: Question, b: Question) => a.order_index - b.order_index)
        .map((q: Question & { question_answers: { acceptable_answers: unknown }[] }) => ({
          ...q,
          answer: q.question_answers?.[0],
        })),
    }))

    setPassages(mapped)
    if (mapped.length && !activePassageId) setActivePassageId(mapped[0].id)
  }, [testId, activePassageId])

  useEffect(() => {
    load()
  }, [load])

  const recomputeGlobalOrder = async () => {
    let order = 1
    for (const p of passages) {
      for (const q of p.questions) {
        await supabase.from('questions').update({ global_order: order }).eq('id', q.id)
        order++
      }
    }
    await load()
  }

  const saveTestMeta = async (updates: Partial<Test>) => {
    if (!testId) return
    setSaving(true)
    await supabase.from('tests').update(updates).eq('id', testId)
    setTest((t) => (t ? { ...t, ...updates } : t))
    setSaving(false)
  }

  const savePassage = async (passage: Passage) => {
    await supabase.from('passages').update({
      title: passage.title,
      body: passage.body,
    }).eq('id', passage.id)
  }

  const addPassage = async () => {
    if (!testId) return
    const order = passages.length + 1
    const { data } = await supabase
      .from('passages')
      .insert({ test_id: testId, order_index: order, title: `Passage ${order}`, body: '' })
      .select()
      .single()
    if (data) {
      await load()
      setActivePassageId(data.id)
    }
  }

  const addQuestion = async (type: QuestionType) => {
    const passage = passages.find((p) => p.id === activePassageId)
    if (!passage) return
    const order = passage.questions.length + 1
    const globalOrder = passages.reduce((acc, p) => acc + p.questions.length, 0) + 1

    const { data: q } = await supabase
      .from('questions')
      .insert({
        passage_id: passage.id,
        order_index: order,
        global_order: globalOrder,
        type,
        prompt: 'Enter question prompt...',
        config: defaultConfig(type),
      })
      .select()
      .single()

    if (q) {
      await supabase.from('question_answers').insert({
        question_id: q.id,
        acceptable_answers: defaultAnswer(type),
      })
      await load()
    }
  }

  const updateQuestion = async (q: Question, answer?: unknown) => {
    await supabase.from('questions').update({
      prompt: q.prompt,
      type: q.type,
      config: q.config,
    }).eq('id', q.id)

    if (answer !== undefined) {
      await supabase.from('question_answers').upsert({
        question_id: q.id,
        acceptable_answers: answer,
      }, { onConflict: 'question_id' })
    }
    await load()
  }

  const deleteQuestion = async (id: string) => {
    await supabase.from('questions').delete().eq('id', id)
    await recomputeGlobalOrder()
  }

  const publish = async () => {
    await recomputeGlobalOrder()
    await saveTestMeta({ status: 'published' })
  }

  const activePassage = passages.find((p) => p.id === activePassageId)
  const allQuestions = passages.flatMap((p) => p.questions)
  const previewQuestion = allQuestions.find((q) => q.id === previewQuestionId) || allQuestions[0]

  if (!test) return <p>Loading...</p>

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <Link to="/tests" className="text-sm text-royal-blue hover:underline">← Back to tests</Link>
        <div className="flex gap-2">
          {test.status === 'draft' && (
            <button
              type="button"
              onClick={publish}
              className="rounded-md bg-royal-red px-4 py-2 text-sm text-white hover:opacity-90"
            >
              Publish
            </button>
          )}
          {test.status === 'published' && (
            <Link
              to={`/tests/${testId}/assign`}
              className="rounded-md bg-royal-blue px-4 py-2 text-sm text-white hover:opacity-90"
            >
              Assign students
            </Link>
          )}
        </div>
      </div>

      <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
        <input
          className="mb-2 w-full text-xl font-bold outline-none"
          value={test.title}
          onChange={(e) => setTest({ ...test, title: e.target.value })}
          onBlur={() => saveTestMeta({ title: test.title })}
        />
        <textarea
          className="mb-2 w-full rounded-md border border-slate-200 p-2 text-sm"
          rows={2}
          placeholder="Instructions"
          value={test.instructions || ''}
          onChange={(e) => setTest({ ...test, instructions: e.target.value })}
          onBlur={() => saveTestMeta({ instructions: test.instructions })}
        />
        <div className="flex items-center gap-4 text-sm">
          <label className="flex items-center gap-2">
            Duration (min)
            <input
              type="number"
              className="w-20 rounded-md border border-slate-200 px-2 py-1"
              value={test.duration_minutes}
              onChange={(e) => setTest({ ...test, duration_minutes: Number(e.target.value) })}
              onBlur={() => saveTestMeta({ duration_minutes: test.duration_minutes })}
            />
          </label>
          <span className="text-slate-500">{saving ? 'Saving...' : `Status: ${test.status}`}</span>
        </div>
      </div>

      <div className="mb-4 flex gap-2">
        <button
          type="button"
          className={`rounded-md px-3 py-1.5 text-sm ${tab === 'edit' ? 'bg-royal-blue text-white' : 'bg-white border'}`}
          onClick={() => setTab('edit')}
        >
          Edit
        </button>
        <button
          type="button"
          className={`rounded-md px-3 py-1.5 text-sm ${tab === 'preview' ? 'bg-royal-blue text-white' : 'bg-white border'}`}
          onClick={() => setTab('preview')}
        >
          Preview
        </button>
      </div>

      {tab === 'preview' ? (
        <div className="grid grid-cols-2 gap-4 rounded-lg border border-slate-200 bg-white p-4" style={{ minHeight: 400 }}>
          <div className="overflow-auto border-r border-slate-200 pr-4">
            <h3 className="mb-2 font-semibold">{activePassage?.title}</h3>
            <div className="whitespace-pre-wrap text-sm leading-relaxed">{activePassage?.body}</div>
          </div>
          <div>
            {previewQuestion && (
              <>
                <p className="mb-1 text-xs text-slate-500">Question {previewQuestion.global_order}</p>
                <p className="mb-4 font-medium">{previewQuestion.prompt}</p>
                <QuestionInput question={previewQuestion} value={null} onChange={() => {}} disabled />
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-3 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Passages</h3>
              <button type="button" onClick={addPassage} className="text-sm text-royal-blue">+ Add</button>
            </div>
            {passages.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setActivePassageId(p.id)}
                className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
                  p.id === activePassageId ? 'border-royal-blue bg-blue-50' : 'border-slate-200 bg-white'
                }`}
              >
                {p.title} ({p.questions.length} Q)
              </button>
            ))}
          </div>

          <div className="col-span-9 space-y-4">
            {activePassage && (
              <>
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <input
                    className="mb-2 w-full font-semibold outline-none"
                    value={activePassage.title}
                    onChange={(e) => {
                      const updated = passages.map((p) =>
                        p.id === activePassage.id ? { ...p, title: e.target.value } : p
                      )
                      setPassages(updated)
                    }}
                    onBlur={() => savePassage(activePassage)}
                  />
                  <textarea
                    className="w-full rounded-md border border-slate-200 p-2 text-sm"
                    rows={8}
                    placeholder="Passage text (plain text or markdown-style paragraphs)"
                    value={activePassage.body}
                    onChange={(e) => {
                      const updated = passages.map((p) =>
                        p.id === activePassage.id ? { ...p, body: e.target.value } : p
                      )
                      setPassages(updated)
                    }}
                    onBlur={() => savePassage(activePassage)}
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => addQuestion(type)}
                      className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs hover:bg-slate-50"
                    >
                      + {QUESTION_TYPE_LABELS[type]}
                    </button>
                  ))}
                </div>

                {activePassage.questions.map((q) => (
                  <QuestionEditor
                    key={q.id}
                    question={q}
                    onSave={(updated, answer) => updateQuestion(updated, answer)}
                    onDelete={() => deleteQuestion(q.id)}
                    onPreview={() => setPreviewQuestionId(q.id)}
                  />
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function QuestionEditor({
  question,
  onSave,
  onDelete,
  onPreview,
}: {
  question: Question & { answer?: { acceptable_answers: unknown } }
  onSave: (q: Question, answer?: unknown) => void
  onDelete: () => void
  onPreview: () => void
}) {
  const [local, setLocal] = useState(question)
  const [answerJson, setAnswerJson] = useState(JSON.stringify(question.answer?.acceptable_answers ?? defaultAnswer(question.type), null, 2))

  useEffect(() => {
    setLocal(question)
    setAnswerJson(JSON.stringify(question.answer?.acceptable_answers ?? defaultAnswer(question.type), null, 2))
  }, [question.id])

  const save = () => {
    try {
      const parsed = JSON.parse(answerJson)
      onSave(local, parsed)
    } catch {
      alert('Invalid answer JSON')
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">
          Q{question.global_order} · {QUESTION_TYPE_LABELS[question.type]}
        </span>
        <div className="flex gap-2">
          <button type="button" onClick={onPreview} className="text-xs text-royal-blue">Preview</button>
          <button type="button" onClick={onDelete} className="text-xs text-red-600">Delete</button>
        </div>
      </div>
      <textarea
        className="mb-3 w-full rounded-md border border-slate-200 p-2 text-sm"
        rows={2}
        value={local.prompt}
        onChange={(e) => setLocal({ ...local, prompt: e.target.value })}
      />

      {local.type === 'multiple_choice' && (
        <div className="mb-3 space-y-1">
          {(local.config.options || []).map((opt, i) => (
            <input
              key={i}
              className="w-full rounded-md border border-slate-200 px-2 py-1 text-sm"
              value={opt}
              onChange={(e) => {
                const options = [...(local.config.options || [])]
                options[i] = e.target.value
                setLocal({ ...local, config: { ...local.config, options } })
              }}
            />
          ))}
        </div>
      )}

      {local.type === 'gap_fill' && (
        <input
          className="mb-3 w-full rounded-md border border-slate-200 px-2 py-1 text-sm"
          placeholder="Blank labels comma-separated"
          value={(local.config.blanks || []).join(', ')}
          onChange={(e) =>
            setLocal({
              ...local,
              config: { ...local.config, blanks: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) },
            })
          }
        />
      )}

      {local.type === 'matching' && (
        <div className="mb-3 grid grid-cols-2 gap-2">
          <textarea
            className="rounded-md border border-slate-200 p-2 text-sm"
            rows={3}
            placeholder="Items (one per line)"
            value={(local.config.items || []).join('\n')}
            onChange={(e) =>
              setLocal({ ...local, config: { ...local.config, items: e.target.value.split('\n').filter(Boolean) } })
            }
          />
          <textarea
            className="rounded-md border border-slate-200 p-2 text-sm"
            rows={3}
            placeholder="Match options (one per line)"
            value={(local.config.matchOptions || []).join('\n')}
            onChange={(e) =>
              setLocal({
                ...local,
                config: { ...local.config, matchOptions: e.target.value.split('\n').filter(Boolean) },
              })
            }
          />
        </div>
      )}

      <label className="mb-1 block text-xs text-slate-500">Answer key (JSON)</label>
      <textarea
        className="mb-2 w-full rounded-md border border-slate-200 p-2 font-mono text-xs"
        rows={3}
        value={answerJson}
        onChange={(e) => setAnswerJson(e.target.value)}
      />
      <button
        type="button"
        onClick={save}
        className="rounded-md bg-royal-blue px-3 py-1.5 text-sm text-white hover:opacity-90"
      >
        Save question
      </button>
    </div>
  )
}
