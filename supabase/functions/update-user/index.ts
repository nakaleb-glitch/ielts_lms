import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import {
  normalizeSchoolId,
  normalizeStudentId,
  staffIdToAuthEmail,
  studentIdToAuthEmail,
} from '../_shared/studentAuth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const { user_id, display_name, student_id, staff_id } = await req.json()

    if (!user_id) {
      return new Response(JSON.stringify({ error: 'user_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: targetProfile, error: profileError } = await adminClient
      .from('profiles')
      .select('id, role, display_name, student_id, staff_id, email')
      .eq('id', user_id)
      .single()

    if (profileError || !targetProfile) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const profileUpdates: Record<string, string | null> = {}
    const authUpdates: { email?: string; user_metadata?: Record<string, string> } = {}

    if (display_name !== undefined) {
      const name = display_name?.trim() || targetProfile.display_name
      profileUpdates.display_name = name
      authUpdates.user_metadata = { ...(authUpdates.user_metadata || {}), display_name: name }
    }

    if (targetProfile.role === 'student' && student_id !== undefined) {
      const normalizedId = normalizeStudentId(student_id)
      if (!normalizedId) {
        return new Response(JSON.stringify({ error: 'Student ID is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      if (normalizedId !== targetProfile.student_id) {
        const { data: existing } = await adminClient
          .from('profiles')
          .select('id')
          .eq('student_id', normalizedId)
          .neq('id', user_id)
          .maybeSingle()

        if (existing) {
          return new Response(JSON.stringify({ error: `Student ID already exists: ${normalizedId}` }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        const email = studentIdToAuthEmail(normalizedId)
        profileUpdates.student_id = normalizedId
        profileUpdates.email = email
        authUpdates.email = email
        authUpdates.user_metadata = {
          ...(authUpdates.user_metadata || {}),
          student_id: normalizedId,
        }
      }
    }

    if (targetProfile.role !== 'student' && staff_id !== undefined) {
      const normalizedId = normalizeSchoolId(staff_id)
      if (!normalizedId) {
        return new Response(JSON.stringify({ error: 'Staff ID is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      if (normalizedId !== targetProfile.staff_id) {
        const { data: existing } = await adminClient
          .from('profiles')
          .select('id')
          .eq('staff_id', normalizedId)
          .neq('id', user_id)
          .maybeSingle()

        if (existing) {
          return new Response(JSON.stringify({ error: `Staff ID already exists: ${normalizedId}` }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        const email = staffIdToAuthEmail(normalizedId)
        profileUpdates.staff_id = normalizedId
        profileUpdates.email = email
        authUpdates.email = email
        authUpdates.user_metadata = {
          ...(authUpdates.user_metadata || {}),
          staff_id: normalizedId,
        }
      }
    }

    if (Object.keys(authUpdates).length > 0) {
      const { error: authError } = await adminClient.auth.admin.updateUserById(user_id, authUpdates)
      if (authError) {
        return new Response(JSON.stringify({ error: authError.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    if (Object.keys(profileUpdates).length > 0) {
      const { error: updateError } = await adminClient
        .from('profiles')
        .update(profileUpdates)
        .eq('id', user_id)

      if (updateError) {
        return new Response(JSON.stringify({ error: updateError.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    return new Response(JSON.stringify({ success: true }), {
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
