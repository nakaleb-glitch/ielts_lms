import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { createStudentAccount } from '../_shared/createStudent.ts'
import { normalizeStudentId } from '../_shared/studentAuth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ImportRow {
  student_id: string
  class: string
  name?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const adminClient = createClient(supabaseUrl, serviceKey)

    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: adminProfile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (adminProfile?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { rows } = await req.json() as { rows: ImportRow[] }
    if (!Array.isArray(rows) || rows.length === 0) {
      return new Response(JSON.stringify({ error: 'rows array is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const classCache = new Map<string, string>()
    let createdStudents = 0
    let createdClasses = 0
    let assigned = 0
    const errors: string[] = []

    const getOrCreateClass = async (className: string): Promise<string | null> => {
      const name = className.trim()
      if (!name) return null

      const cached = classCache.get(name.toLowerCase())
      if (cached) return cached

      const { data: existing } = await adminClient
        .from('classes')
        .select('id')
        .ilike('name', name)
        .maybeSingle()

      if (existing) {
        classCache.set(name.toLowerCase(), existing.id)
        return existing.id
      }

      const { data: created, error } = await adminClient
        .from('classes')
        .insert({ name, created_by: user.id })
        .select('id')
        .single()

      if (error || !created) {
        errors.push(`Failed to create class "${name}": ${error?.message}`)
        return null
      }

      createdClasses++
      classCache.set(name.toLowerCase(), created.id)
      return created.id
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNum = i + 1
      const studentId = normalizeStudentId(row.student_id || '')
      const className = (row.class || '').trim()

      if (!studentId || !className) {
        errors.push(`Row ${rowNum}: student_id and class are required`)
        continue
      }

      try {
        let profileId: string | undefined

        const { data: existingProfile } = await adminClient
          .from('profiles')
          .select('id')
          .eq('student_id', studentId)
          .maybeSingle()

        if (existingProfile) {
          profileId = existingProfile.id
        } else {
          const created = await createStudentAccount(adminClient, studentId, row.name)
          profileId = created.id
          createdStudents++
        }

        const classId = await getOrCreateClass(className)
        if (!classId || !profileId) continue

        const { error: memberError } = await adminClient
          .from('class_members')
          .upsert({ class_id: classId, student_id: profileId }, { onConflict: 'class_id,student_id' })

        if (memberError) {
          errors.push(`Row ${rowNum}: ${memberError.message}`)
        } else {
          assigned++
        }
      } catch (err) {
        errors.push(`Row ${rowNum}: ${String(err)}`)
      }
    }

    return new Response(JSON.stringify({
      created_students: createdStudents,
      created_classes: createdClasses,
      assigned,
      errors,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
