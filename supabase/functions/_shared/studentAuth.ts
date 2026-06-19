export const DEFAULT_STUDENT_PASSWORD = 'royal@123'
export const STUDENT_EMAIL_DOMAIN = 'student.royal.edu.vn'

export function normalizeStudentId(studentId: string): string {
  return studentId.trim()
}

export function studentIdToAuthEmail(studentId: string): string {
  return `${normalizeStudentId(studentId).toLowerCase()}@${STUDENT_EMAIL_DOMAIN}`
}
