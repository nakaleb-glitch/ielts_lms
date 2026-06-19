import { createClient } from 'jsr:@supabase/supabase-js@2'
import { DEFAULT_STUDENT_PASSWORD, staffIdToAuthEmail, normalizeSchoolId } from './studentAuth.ts'

export async function createStaffAccount(
  adminClient: ReturnType<typeof createClient>,
  staffId: string,
  role: 'teacher' | 'admin',
  displayName?: string,
) {
  const normalizedId = normalizeSchoolId(staffId)
  if (!normalizedId) {
    throw new Error('Staff ID is required')
  }

  const { data: existing } = await adminClient
    .from('profiles')
    .select('id')
    .eq('staff_id', normalizedId)
    .maybeSingle()

  if (existing) {
    throw new Error(`Staff ID already exists: ${normalizedId}`)
  }

  const email = staffIdToAuthEmail(normalizedId)
  const name = displayName?.trim() || normalizedId
  const mustChange = role === 'teacher'

  const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password: DEFAULT_STUDENT_PASSWORD,
    email_confirm: true,
    user_metadata: {
      display_name: name,
      role,
      staff_id: normalizedId,
      created_by_admin: true,
      must_change_password: mustChange,
    },
  })

  if (createError) throw new Error(createError.message)

  if (newUser.user?.id) {
    await adminClient
      .from('profiles')
      .update({
        must_change_password: mustChange,
        staff_id: normalizedId,
        display_name: name,
        role,
      })
      .eq('id', newUser.user.id)
  }

  return { id: newUser.user?.id, staff_id: normalizedId, display_name: name, role }
}
