import { createContext, useContext } from 'react'

export type AuthStatus = 'loading' | 'unauthenticated' | 'authenticated'
export type AuthMode = 'supabase' | 'demo'

export interface AuthIdentity {
  readonly id: string
  readonly email: string
  readonly displayName: string
  readonly mode: AuthMode
}

export interface SignUpInput {
  readonly displayName: string
  readonly email: string
  readonly password: string
}

export interface SignUpResult {
  readonly needsEmailConfirmation: boolean
}

export interface AuthContextValue {
  readonly configured: boolean
  readonly status: AuthStatus
  readonly identity: AuthIdentity | null
  readonly signIn: (email: string, password: string) => Promise<void>
  readonly signUp: (input: SignUpInput) => Promise<SignUpResult>
  readonly resetPassword: (email: string) => Promise<void>
  readonly signOut: () => Promise<void>
  readonly continueDemo: () => void
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
