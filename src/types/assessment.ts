export type TestModule = 'reading' | 'writing' | 'listening'

export type UserRole = 'admin' | 'teacher' | 'student'

export type TestStatus = 'draft' | 'published'

export type SessionStatus = 'in_progress' | 'submitted' | 'expired'

export type QuestionType =
  | 'multiple_choice'
  | 'true_false_not_given'
  | 'yes_no_not_given'
  | 'summary_completion'
  | 'matching_information'
  | 'matching_headings'

export interface Profile {
  id: string
  role: UserRole
  display_name: string
  email: string | null
  student_id: string | null
  staff_id: string | null
  must_change_password: boolean
  created_at: string
}

export interface Test {
  id: string
  title: string
  instructions: string | null
  duration_minutes: number
  status: TestStatus
  module: TestModule
  access_password: string | null
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

export type McOptionCount = 3 | 4

export interface QuestionConfig {
  options?: string[]
  optionCount?: McOptionCount
  summaryText?: string
  wordBank?: string[]
  headings?: string[]
  paragraphLabels?: string[]
  allowReuse?: boolean
  directions?: string
  groupId?: string
  noteHeading?: string
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
  class_id: string | null
  due_at: string | null
  created_at: string
}

export interface AdminUserRow {
  id: string
  display_name: string
  student_id: string | null
  staff_id: string | null
  role: UserRole
  classes: string
}

export interface SchoolClass {
  id: string
  name: string
  created_by: string
  created_at: string
  member_count?: number
}

export interface ClassMember {
  class_id: string
  student_id: string
  added_at: string
}

export interface ClassTestAssignment {
  test_id: string
  class_id: string
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
