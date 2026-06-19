import { createClient } from 'jsr:@supabase/supabase-js@2'
import { DEFAULT_STUDENT_PASSWORD, studentIdToAuthEmail, normalizeStudentId } from './studentAuth.ts'

export async function createStudentAccount(
  adminClient: ReturnType<typeof createClient>,
  studentId: string,
  displayName?: string,
) {
  const normalizedId = normalizeStudentId(studentId)
  if (!normalizedId) {
    throw new Error('Student ID is required')
  }

  const { data: existing } = await adminClient
    .from('profiles')
    .select('id')
    .eq('student_id', normalizedId)
    .maybeSingle()

  if (existing) {
    throw new Error(`Student ID already exists: ${normalizedId}`)
  }

  const email = studentIdToAuthEmail(normalizedId)
  const name = displayName?.trim() || normalizedId

  const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password: DEFAULT_STUDENT_PASSWORD,
    email_confirm: true,
    user_metadata: {
      display_name: name,
      role: 'student',
      student_id: normalizedId,
      created_by_admin: true,
      must_change_password: true,
    },
  })

  if (createError) throw new Error(createError.message)

  if (newUser.user?.id) {
    await adminClient
      .from('profiles')
      .update({ must_change_password: true, student_id: normalizedId, display_name: name })
      .eq('id', newUser.user.id)
  }

  return { id: newUser.user?.id, student_id: normalizedId, display_name: name }
}
