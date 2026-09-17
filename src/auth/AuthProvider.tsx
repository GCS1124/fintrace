import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import {
  AuthContext,
  type AuthContextValue,
  type AuthIdentity,
  type AuthStatus,
  type SignUpInput,
  type SignUpResult,
} from './authContext'

function displayNameForUser(user: User): string {
  const metadataName = typeof user.user_metadata?.display_name === 'string' ? user.user_metadata.display_name.trim() : ''
  if (metadataName) return metadataName
  return user.email?.split('@')[0] || 'Analyst'
}

function identityForUser(user: User): AuthIdentity {
  return {
    id: user.id,
    email: user.email ?? 'analyst@fintrace.local',
    displayName: displayNameForUser(user),
    mode: 'supabase',
  }
}

function authErrorMessage(message: string): Error {
  if (/email not confirmed/i.test(message)) return new Error('Confirm your email address before signing in.')
  if (/invalid login credentials/i.test(message)) return new Error('That email and password combination is not recognised.')
  if (/already registered|user already exists/i.test(message)) return new Error('An account with this email already exists. Try signing in.')
  return new Error(message)
}

export function AuthProvider({ children }: { readonly children: ReactNode }) {
  const [identity, setIdentity] = useState<AuthIdentity | null>(null)
  const [status, setStatus] = useState<AuthStatus>(supabase ? 'loading' : 'unauthenticated')

  useEffect(() => {
    if (!supabase) return
    let active = true

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setIdentity(data.session?.user ? identityForUser(data.session.user) : null)
      setStatus(data.session ? 'authenticated' : 'unauthenticated')
    }).catch(() => {
      if (!active) return
      setIdentity(null)
      setStatus('unauthenticated')
    })

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return
      setIdentity(session?.user ? identityForUser(session.user) : null)
      setStatus(session?.user ? 'authenticated' : 'unauthenticated')
    })

    return () => {
      active = false
      authListener.subscription.unsubscribe()
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Connect Supabase Auth in .env.local before using account sign-in.')
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) throw authErrorMessage(error.message)
  }, [])

  const signUp = useCallback(async ({ displayName, email, password }: SignUpInput): Promise<SignUpResult> => {
    if (!supabase) throw new Error('Connect Supabase Auth in .env.local before creating an account.')
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { display_name: displayName.trim() },
        emailRedirectTo: window.location.origin,
      },
    })
    if (error) throw authErrorMessage(error.message)
    return { needsEmailConfirmation: !data.session }
  }, [])

  const resetPassword = useCallback(async (email: string) => {
    if (!supabase) throw new Error('Connect Supabase Auth in .env.local before requesting a reset link.')
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
    })
    if (error) throw authErrorMessage(error.message)
  }, [])

  const signOut = useCallback(async () => {
    if (identity?.mode === 'demo') {
      setIdentity(null)
      setStatus('unauthenticated')
      return
    }
    if (!supabase) {
      setIdentity(null)
      setStatus('unauthenticated')
      return
    }
    const { error } = await supabase.auth.signOut()
    if (error) throw authErrorMessage(error.message)
  }, [identity?.mode])

  const continueDemo = useCallback(() => {
    setIdentity({
      id: 'demo-analyst',
      email: 'demo@fintrace.local',
      displayName: 'Demo analyst',
      mode: 'demo',
    })
    setStatus('authenticated')
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    configured: isSupabaseConfigured,
    status,
    identity,
    signIn,
    signUp,
    resetPassword,
    signOut,
    continueDemo,
  }), [continueDemo, identity, resetPassword, signIn, signOut, signUp, status])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
