import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { isEmailLogin } from '../lib/schoolAuth'
import type { Profile } from '../types/assessment'

interface AuthContextValue {
  user: { id: string; email?: string } | null
  profile: Profile | null
  loading: boolean
  signIn: (identifier: string, password: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = async (userId: string) => {
    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      setProfile(null)
    } else {
      setProfile(data)
    }
    setLoading(false)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user
      setUser(u ? { id: u.id, email: u.email } : null)
      if (u) fetchProfile(u.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user
      setUser(u ? { id: u.id, email: u.email } : null)
      if (u) fetchProfile(u.id)
      else {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (identifier: string, password: string) => {
    let email = identifier.trim()

    if (!isEmailLogin(email)) {
      const { data, error: resolveError } = await supabase.rpc('resolve_login_email', {
        p_identifier: identifier,
      })
      if (resolveError) {
        return { error: new Error(resolveError.message) }
      }
      email = data as string
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      return { error: new Error(error.message) }
    }

    const sessionUser = data.session?.user
    if (sessionUser) {
      setUser({ id: sessionUser.id, email: sessionUser.email })
      await fetchProfile(sessionUser.id)
    }

    return { error: null }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const refreshProfile = async () => {
    if (user?.id) await fetchProfile(user.id)
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
