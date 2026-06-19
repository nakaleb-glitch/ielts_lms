export const DEFAULT_STUDENT_PASSWORD = 'royal@123'
export const STUDENT_EMAIL_DOMAIN = 'student.royal.edu.vn'
export const STAFF_EMAIL_DOMAIN = 'staff.royal.edu.vn'

export function normalizeSchoolId(id: string): string {
  return id.trim()
}

export function studentIdToAuthEmail(studentId: string): string {
  return `${normalizeSchoolId(studentId).toLowerCase()}@${STUDENT_EMAIL_DOMAIN}`
}

export function staffIdToAuthEmail(staffId: string): string {
  return `${normalizeSchoolId(staffId).toLowerCase()}@${STAFF_EMAIL_DOMAIN}`
}

export function isEmailLogin(identifier: string): boolean {
  return identifier.includes('@')
}

/** @deprecated Use normalizeSchoolId */
export const normalizeStudentId = normalizeSchoolId
