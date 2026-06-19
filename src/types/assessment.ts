export type TestModule = 'reading' | 'writing' | 'listening'

export type UserRole = 'admin' | 'teacher' | 'student'

export type TestStatus = 'draft' | 'published'

export type SessionStatus = 'in_progress' | 'submitted' | 'expired'

export type QuestionType =
  | 'multiple_choice'
  | 'true_false_not_given'
  | 'yes_no_not_given'
  | 'gap_fill'
  | 'matching'

export interface Profile {
  id: string
  role: UserRole
  display_name: string
  email: string | null
  created_at: string
}

export interface Test {
  id: string
  title: string
  instructions: string | null
  duration_minutes: number
  status: TestStatus
  module: TestModule
  created_by: string
  created_at: string
  updated_at: string
}

export interface Passage {
  id: string
  test_id: string
  order_index: number
  title: string
  body: string
}

export interface QuestionConfig {
  options?: string[]
  blanks?: string[]
  items?: string[]
  matchOptions?: string[]
}

export interface Question {
  id: string
  passage_id: string
  order_index: number
  global_order: number
  type: QuestionType
  prompt: string
  config: QuestionConfig
}

export interface QuestionAnswer {
  id: string
  question_id: string
  acceptable_answers: unknown
}

export interface TestAssignment {
  id: string
  test_id: string
  student_id: string
  assigned_by: string
  due_at: string | null
  created_at: string
}

export interface TestSession {
  id: string
  assignment_id: string
  started_at: string
  submitted_at: string | null
  status: SessionStatus
}

export interface Response {
  id: string
  session_id: string
  question_id: string
  value: unknown
  flagged: boolean
  saved_at: string
}

export interface SessionResult {
  id: string
  session_id: string
  raw_score: number
  total_questions: number
  band_score: number
  question_breakdown: QuestionBreakdownItem[]
  scored_at: string
}

export interface QuestionBreakdownItem {
  question_id: string
  global_order: number
  correct: boolean
  student_value: unknown
  correct_value: unknown
}

export type ResponseValue =
  | string
  | string[]
  | Record<string, string>

export interface TestWithPassages extends Test {
  passages: (Passage & { questions: (Question & { answer?: QuestionAnswer })[] })[]
}

export interface AssignmentWithTest extends TestAssignment {
  test: Test
  session?: TestSession | null
  result?: SessionResult | null
}
