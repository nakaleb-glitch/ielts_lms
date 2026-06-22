import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { groupQuestionsInPassage, organizePassageSections, formatQuestionRange } from '../../lib/questionGroups'
import type { PassageSection } from '../../lib/questionGroups'
import { QuestionGroupPane } from '../player/components/QuestionGroupPane'
import { PassageBody } from '../player/components/PassagePane'
import { labeledPassagePlaceholder } from '../../lib/labeledPassage'
import { AnswerKeyInput } from '../../components/questions/AnswerKeyInput'
import {
  defaultAnswer,
  defaultConfig,
  defaultPrompt,
  DEFAULT_DIRECTIONS,
  defaultHeadings,
  formatParagraphLabelRange,
  formatRomanRange,
  generateParagraphLabels,
  generateRomanNumerals,
  QUESTION_TYPE_LABELS,
} from '../../components/questions/questionDefaults'
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
  const [groupModal, setGroupModal] = useState<{
    type: QuestionType
    directions: string
    count: number
    noteHeading: string
    paragraphCount: number
    headingCount: number
    allowReuse: boolean
  } | null>(null)

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

  const addQuestionGroup = async (
    type: QuestionType,
    directions: string,
    count: number,
    noteHeading?: string,
    paragraphLabels?: string[],
    allowReuse?: boolean,
    headings?: string[]
  ) => {
    const passage = passages.find((p) => p.id === activePassageId)
    if (!passage || count < 1) return

    const groupId = crypto.randomUUID()
    let globalOrder = passages.reduce((acc, p) => acc + p.questions.length, 0)
    let orderIndex = passage.questions.length
    const labels =
      paragraphLabels ||
      (type === 'matching_headings' ? generateParagraphLabels(4) : undefined)
    const questionCount = type === 'matching_headings' ? (labels?.length ?? count) : count
    const headingList = headings || (type === 'matching_headings' ? defaultHeadings(9) : undefined)

    for (let i = 0; i < questionCount; i++) {
      globalOrder++
      orderIndex++
      const config = {
        ...defaultConfig(type),
        directions,
        groupId,
        ...(noteHeading ? { noteHeading } : {}),
        ...(labels ? { paragraphLabels: labels } : {}),
        ...(allowReuse !== undefined ? { allowReuse } : {}),
        ...(headingList ? { headings: headingList } : {}),
      }

      const paragraphLabel = labels?.[i]
      const { data: q } = await supabase
        .from('questions')
        .insert({
          passage_id: passage.id,
          order_index: orderIndex,
          global_order: globalOrder,
          type,
          prompt: defaultPrompt(type, i + 1, paragraphLabel),
          config,
        })
        .select()
        .single()

      if (q) {
        await supabase.from('question_answers').insert({
          question_id: q.id,
          acceptable_answers: defaultAnswer(type),
        })
      }
    }

    await load()
    setGroupModal(null)
  }

  const updateGroupMeta = async (
    groupId: string,
    updates: {
      directions?: string
      noteHeading?: string
      paragraphLabels?: string[]
      allowReuse?: boolean
      headings?: string[]
    }
  ) => {
    const passage = passages.find((p) => p.id === activePassageId)
    if (!passage) return

    const inGroup = passage.questions.filter((q) => q.config.groupId === groupId)
    for (const q of inGroup) {
      await supabase
        .from('questions')
        .update({
          config: {
            ...q.config,
            ...(updates.directions !== undefined ? { directions: updates.directions } : {}),
            ...(updates.noteHeading !== undefined ? { noteHeading: updates.noteHeading } : {}),
            ...(updates.paragraphLabels !== undefined ? { paragraphLabels: updates.paragraphLabels } : {}),
            ...(updates.allowReuse !== undefined ? { allowReuse: updates.allowReuse } : {}),
            ...(updates.headings !== undefined ? { headings: updates.headings } : {}),
          },
        })
        .eq('id', q.id)
    }
    await load()
  }

  const deleteGroup = async (groupId: string) => {
    const passage = passages.find((p) => p.id === activePassageId)
    if (!passage) return
    const ids = passage.questions.filter((q) => q.config.groupId === groupId).map((q) => q.id)
    for (const id of ids) {
      await supabase.from('questions').delete().eq('id', id)
    }
    await recomputeGlobalOrder()
  }

  const openGroupModal = (type: QuestionType) => {
    const paragraphCount = type === 'matching_headings' ? 4 : 8
    const headingCount = 9
    setGroupModal({
      type,
      directions: DEFAULT_DIRECTIONS[type],
      count:
        type === 'gap_fill' ? 7 : type === 'matching_information' ? 6 : type === 'matching_headings' ? 4 : 6,
      noteHeading: '',
      paragraphCount,
      headingCount,
      allowReuse: type === 'matching_information',
    })
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
  const previewGroups = activePassage ? groupQuestionsInPassage(activePassage.questions) : []
  const sortedPreviewQs = activePassage
    ? [...activePassage.questions].sort((a, b) => a.global_order - b.global_order)
    : []
  const previewRange = sortedPreviewQs.length
    ? formatQuestionRange(sortedPreviewQs[0].global_order, sortedPreviewQs[sortedPreviewQs.length - 1].global_order)
    : '—'

  if (!test) return <p>Loading...</p>

  const listPath = `/tests/${test.module || 'reading'}`

  if (test.module && test.module !== 'reading') {
    return (
      <div>
        <div className="mb-4 flex items-center justify-between">
          <Link to={listPath} className="text-sm text-royal-blue hover:underline">
            ← Back to {test.module} tests
          </Link>
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

        <div className="mb-4 rounded-lg border border-royal-yellow/50 bg-yellow-50 px-4 py-3 text-sm text-slate-700">
          Full {test.module} test builder coming soon. You can edit basic test settings below.
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
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
          <label className="flex items-center gap-2 text-sm">
            Duration (min)
            <input
              type="number"
              className="w-20 rounded-md border border-slate-200 px-2 py-1"
              value={test.duration_minutes}
              onChange={(e) => setTest({ ...test, duration_minutes: Number(e.target.value) })}
              onBlur={() => saveTestMeta({ duration_minutes: test.duration_minutes })}
            />
          </label>
          <label className="mt-3 block text-sm">
            <span className="font-medium text-slate-700">Exam access password</span>
            <input
              type="text"
              className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1"
              placeholder="Optional — give to students on test day"
              value={test.access_password || ''}
              onChange={(e) => setTest({ ...test, access_password: e.target.value || null })}
              onBlur={() => saveTestMeta({ access_password: test.access_password || null })}
            />
            <span className="mt-1 block text-xs text-slate-500">
              Leave blank for no password. Students must enter this before starting the exam.
            </span>
          </label>
          <p className="mt-2 text-xs text-slate-500">{saving ? 'Saving...' : `Status: ${test.status}`}</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <Link to={listPath} className="text-sm text-royal-blue hover:underline">← Back to tests</Link>
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
        <div className="flex flex-wrap items-center gap-4 text-sm">
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
        <label className="mt-3 block text-sm">
          <span className="font-medium text-slate-700">Exam access password</span>
          <input
            type="text"
            className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1"
            placeholder="Optional — give to students on test day"
            value={test.access_password || ''}
            onChange={(e) => setTest({ ...test, access_password: e.target.value || null })}
            onBlur={() => saveTestMeta({ access_password: test.access_password || null })}
          />
          <span className="mt-1 block text-xs text-slate-500">
            Leave blank for no password. Students must enter this before starting the exam.
          </span>
        </label>
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
        <div>
          <div className="mb-2 flex flex-wrap gap-2">
            {passages.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setActivePassageId(p.id)}
                className={`rounded-md px-3 py-1.5 text-sm ${
                  p.id === activePassageId ? 'bg-royal-blue text-white' : 'border border-slate-200 bg-white'
                }`}
              >
                Part {p.order_index}
              </button>
            ))}
          </div>
          <div className="mb-2 rounded-md border border-slate-200 bg-white px-4 py-2">
            <p className="text-sm font-semibold">Part {activePassage?.order_index ?? 1}</p>
            <p className="text-xs text-slate-600">Read the text and answer questions {previewRange}.</p>
          </div>
          <div className="grid grid-cols-2 gap-0 rounded-lg border border-slate-200 bg-white" style={{ minHeight: 480 }}>
            <div className="overflow-auto border-r border-slate-200">
              <div className="border-b border-slate-200 px-4 py-3">
                <h3 className="text-sm font-semibold text-slate-800">{activePassage?.title}</h3>
              </div>
              <div className="px-4 py-4">
                <PassageBody body={activePassage?.body ?? ''} />
              </div>
            </div>
            <QuestionGroupPane
              groups={previewGroups}
              responses={new Map()}
              activeQuestionId={previewQuestion?.id ?? null}
              onChange={() => {}}
              readOnly
            />
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
                    placeholder={`Passage text (plain text or markdown). For labeled paragraphs use:\n\n${labeledPassagePlaceholder()}`}
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
                      onClick={() => openGroupModal(type)}
                      className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs hover:bg-slate-50"
                    >
                      + {QUESTION_TYPE_LABELS[type]}
                    </button>
                  ))}
                </div>

                {activePassage.questions.length > 0 &&
                  organizePassageSections(activePassage.questions).map((section) =>
                    section.kind === 'group' ? (
                      <GroupEditorSection
                        key={section.groupId}
                        section={section}
                        onUpdateMeta={(updates) => updateGroupMeta(section.groupId, updates)}
                        onDeleteGroup={() => deleteGroup(section.groupId)}
                        onSaveQuestion={(q, answer) => updateQuestion(q, answer)}
                        onDeleteQuestion={(id) => deleteQuestion(id)}
                        onPreview={(id) => {
                          setPreviewQuestionId(id)
                          setTab('preview')
                        }}
                      />
                    ) : (
                      <QuestionEditor
                        key={section.question.id}
                        question={section.question}
                        onSave={(updated, answer) => updateQuestion(updated, answer)}
                        onDelete={() => deleteQuestion(section.question.id)}
                        onPreview={() => {
                          setPreviewQuestionId(section.question.id)
                          setTab('preview')
                        }}
                      />
                    )
                  )}
              </>
            )}
          </div>
        </div>
      )}

      {groupModal && (
        <GroupModal
          modal={groupModal}
          onChange={setGroupModal}
          onClose={() => setGroupModal(null)}
          onSubmit={() => {
            const labels =
              groupModal.type === 'matching_information' || groupModal.type === 'matching_headings'
                ? generateParagraphLabels(groupModal.paragraphCount)
                : undefined
            const headings =
              groupModal.type === 'matching_headings'
                ? defaultHeadings(groupModal.headingCount)
                : undefined
            const count =
              groupModal.type === 'matching_headings'
                ? groupModal.paragraphCount
                : groupModal.count
            addQuestionGroup(
              groupModal.type,
              groupModal.directions,
              count,
              groupModal.noteHeading || undefined,
              labels,
              groupModal.type === 'matching_information' ? groupModal.allowReuse : undefined,
              headings
            )
          }}
        />
      )}
    </div>
  )
}

function GroupModal({
  modal,
  onChange,
  onClose,
  onSubmit,
}: {
  modal: {
    type: QuestionType
    directions: string
    count: number
    noteHeading: string
    paragraphCount: number
    headingCount: number
    allowReuse: boolean
  }
  onChange: (m: typeof modal) => void
  onClose: () => void
  onSubmit: () => void
}) {
  const paragraphLabels = generateParagraphLabels(modal.paragraphCount)
  const labelRange = formatParagraphLabelRange(paragraphLabels)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <h3 className="mb-4 text-lg font-semibold">Add {QUESTION_TYPE_LABELS[modal.type]} group</h3>

        <label className="mb-3 block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Directions</span>
          <textarea
            className="w-full rounded-md border border-slate-200 p-2 text-sm"
            rows={4}
            value={modal.directions}
            onChange={(e) => onChange({ ...modal, directions: e.target.value })}
          />
        </label>

        <label className="mb-3 block">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            {modal.type === 'matching_headings' ? 'Number of paragraphs' : 'Number of questions'}
          </span>
          <input
            type="number"
            min={1}
            max={20}
            className="w-24 rounded-md border border-slate-200 px-2 py-1 text-sm"
            value={modal.type === 'matching_headings' ? modal.paragraphCount : modal.count}
            onChange={(e) => {
              const n = Math.min(20, Math.max(1, Number(e.target.value) || 1))
              if (modal.type === 'matching_headings') {
                onChange({ ...modal, paragraphCount: Math.min(8, Math.max(2, n)), count: n })
              } else {
                onChange({ ...modal, count: n })
              }
            }}
          />
        </label>

        {modal.type === 'gap_fill' && (
          <label className="mb-3 block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Note heading (optional)</span>
            <input
              type="text"
              className="w-full rounded-md border border-slate-200 px-2 py-1 text-sm"
              placeholder="e.g. Marie Curie's research on radioactivity"
              value={modal.noteHeading}
              onChange={(e) => onChange({ ...modal, noteHeading: e.target.value })}
            />
          </label>
        )}

        {modal.type === 'matching_information' && (
          <>
            <label className="mb-3 block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                Paragraph labels ({labelRange})
              </span>
              <input
                type="number"
                min={4}
                max={13}
                className="w-24 rounded-md border border-slate-200 px-2 py-1 text-sm"
                value={modal.paragraphCount}
                onChange={(e) =>
                  onChange({
                    ...modal,
                    paragraphCount: Math.min(13, Math.max(4, Number(e.target.value) || 8)),
                  })
                }
              />
            </label>
            <label className="mb-3 flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={modal.allowReuse}
                onChange={(e) => onChange({ ...modal, allowReuse: e.target.checked })}
              />
              Allow letter reuse (NB note)
            </label>
          </>
        )}

        {modal.type === 'matching_headings' && (
          <label className="mb-3 block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Number of headings ({formatRomanRange(generateRomanNumerals(modal.headingCount))})
            </span>
            <input
              type="number"
              min={modal.paragraphCount + 1}
              max={15}
              className="w-24 rounded-md border border-slate-200 px-2 py-1 text-sm"
              value={modal.headingCount}
              onChange={(e) =>
                onChange({
                  ...modal,
                  headingCount: Math.min(15, Math.max(modal.paragraphCount + 1, Number(e.target.value) || 9)),
                })
              }
            />
          </label>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-slate-200 px-4 py-2 text-sm">
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            className="rounded-md bg-royal-blue px-4 py-2 text-sm text-white hover:opacity-90"
          >
            Add questions
          </button>
        </div>
      </div>
    </div>
  )
}

function GroupEditorSection({
  section,
  onUpdateMeta,
  onDeleteGroup,
  onSaveQuestion,
  onDeleteQuestion,
  onPreview,
}: {
  section: Extract<PassageSection, { kind: 'group' }>
  onUpdateMeta: (updates: {
    directions?: string
    noteHeading?: string
    paragraphLabels?: string[]
    allowReuse?: boolean
    headings?: string[]
  }) => void
  onDeleteGroup: () => void
  onSaveQuestion: (q: Question, answer?: unknown) => void
  onDeleteQuestion: (id: string) => void
  onPreview: (id: string) => void
}) {
  const range = formatQuestionRange(
    section.questions[0]?.global_order ?? 0,
    section.questions[section.questions.length - 1]?.global_order ?? 0
  )
  const [directions, setDirections] = useState(section.directions)
  const [noteHeading, setNoteHeading] = useState(section.noteHeading || '')
  const initialLabels = section.questions[0]?.config.paragraphLabels || generateParagraphLabels(8)
  const [paragraphCount, setParagraphCount] = useState(initialLabels.length)
  const [allowReuse, setAllowReuse] = useState(section.questions[0]?.config.allowReuse ?? false)
  const initialHeadings = section.questions[0]?.config.headings || defaultHeadings(9)
  const [headingsText, setHeadingsText] = useState(initialHeadings.join('\n'))

  useEffect(() => {
    setDirections(section.directions)
    setNoteHeading(section.noteHeading || '')
    const labels = section.questions[0]?.config.paragraphLabels || generateParagraphLabels(8)
    setParagraphCount(labels.length)
    setAllowReuse(section.questions[0]?.config.allowReuse ?? false)
    const h = section.questions[0]?.config.headings || defaultHeadings(9)
    setHeadingsText(h.join('\n'))
  }, [section.groupId, section.directions, section.noteHeading, section.questions])

  return (
    <div className="rounded-lg border border-royal-blue/30 bg-blue-50/30 p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex-1">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-royal-blue">
            Questions {range} · {QUESTION_TYPE_LABELS[section.type]}
          </p>
          <textarea
            className="mb-2 w-full rounded-md border border-slate-200 bg-white p-2 text-sm"
            rows={2}
            value={directions}
            onChange={(e) => setDirections(e.target.value)}
            onBlur={() => {
              if (directions !== section.directions) onUpdateMeta({ directions })
            }}
            placeholder="Directions for this group"
          />
          {section.type === 'gap_fill' && (
            <input
              className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-sm"
              placeholder="Note heading (optional)"
              value={noteHeading}
              onChange={(e) => setNoteHeading(e.target.value)}
              onBlur={() => {
                if (noteHeading !== (section.noteHeading || '')) onUpdateMeta({ noteHeading })
              }}
            />
          )}
          {section.type === 'matching_information' && (
            <div className="mb-2 flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <span>Paragraphs ({formatParagraphLabelRange(generateParagraphLabels(paragraphCount))})</span>
                <input
                  type="number"
                  min={4}
                  max={13}
                  className="w-16 rounded-md border border-slate-200 px-2 py-1 text-sm"
                  value={paragraphCount}
                  onChange={(e) => {
                    const count = Math.min(13, Math.max(4, Number(e.target.value) || 8))
                    setParagraphCount(count)
                  }}
                  onBlur={() => {
                    const labels = generateParagraphLabels(paragraphCount)
                    const current = section.questions[0]?.config.paragraphLabels || []
                    if (labels.join() !== current.join()) {
                      onUpdateMeta({ paragraphLabels: labels })
                    }
                  }}
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={allowReuse}
                  onChange={(e) => {
                    setAllowReuse(e.target.checked)
                    onUpdateMeta({ allowReuse: e.target.checked })
                  }}
                />
                Allow letter reuse (NB)
              </label>
            </div>
          )}
          {section.type === 'matching_headings' && (
            <textarea
              className="mb-2 w-full rounded-md border border-slate-200 bg-white p-2 text-sm"
              rows={5}
              placeholder="Headings (one per line)"
              value={headingsText}
              onChange={(e) => setHeadingsText(e.target.value)}
              onBlur={() => {
                const next = headingsText.split('\n').map((s) => s.trim()).filter(Boolean)
                const current = section.questions[0]?.config.headings || []
                if (next.join('\n') !== current.join('\n')) {
                  onUpdateMeta({ headings: next })
                }
              }}
            />
          )}
        </div>
        <button type="button" onClick={onDeleteGroup} className="shrink-0 text-xs text-red-600 hover:underline">
          Delete group
        </button>
      </div>

      <div className="space-y-3">
        {section.questions.map((q) => (
          <QuestionEditor
            key={q.id}
            question={q}
            compact
            onSave={(updated, answer) => onSaveQuestion(updated, answer)}
            onDelete={() => onDeleteQuestion(q.id)}
            onPreview={() => onPreview(q.id)}
          />
        ))}
      </div>
    </div>
  )
}

function QuestionEditor({
  question,
  onSave,
  onDelete,
  onPreview,
  compact,
}: {
  question: Question & { answer?: { acceptable_answers: unknown } }
  onSave: (q: Question, answer?: unknown) => void
  onDelete: () => void
  onPreview: () => void
  compact?: boolean
}) {
  const [local, setLocal] = useState(question)
  const [answer, setAnswer] = useState<unknown>(
    question.answer?.acceptable_answers ?? defaultAnswer(question.type)
  )

  useEffect(() => {
    setLocal(question)
    setAnswer(question.answer?.acceptable_answers ?? defaultAnswer(question.type))
  }, [question.id])

  const save = () => {
    onSave(local, answer)
  }

  return (
    <div className={`rounded-lg border border-slate-200 bg-white p-4 ${compact ? 'shadow-sm' : ''}`}>
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
        rows={compact ? 1 : 2}
        value={local.prompt}
        onChange={(e) => setLocal({ ...local, prompt: e.target.value })}
      />

      {local.type === 'multiple_choice' && (
        <div className="mb-3 space-y-1">
          <p className="text-xs text-slate-500">Options (click answer key below to mark correct)</p>
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

      <AnswerKeyInput
        type={local.type}
        config={local.config}
        value={answer}
        onChange={setAnswer}
      />
      <button
        type="button"
        onClick={save}
        className="mt-3 rounded-md bg-royal-blue px-3 py-1.5 text-sm text-white hover:opacity-90"
      >
        Save question
      </button>
    </div>
  )
}
