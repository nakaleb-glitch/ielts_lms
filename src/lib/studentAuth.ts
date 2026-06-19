export const DEFAULT_STUDENT_PASSWORD = 'royal@123'
export const STUDENT_EMAIL_DOMAIN = 'student.royal.edu.vn'

export function normalizeStudentId(studentId: string): string {
  return studentId.trim()
}

export function studentIdToAuthEmail(studentId: string): string {
  return `${normalizeStudentId(studentId).toLowerCase()}@${STUDENT_EMAIL_DOMAIN}`
}

export function isEmailLogin(identifier: string): boolean {
  return identifier.includes('@')
}

export function toAuthIdentifier(identifier: string): string {
  const trimmed = identifier.trim()
  if (isEmailLogin(trimmed)) return trimmed
  return studentIdToAuthEmail(trimmed)
}
