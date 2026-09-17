import { useState, type FormEvent } from 'react'
import { ArrowRight, CheckCircle2, Eye, EyeOff, KeyRound, LockKeyhole, Mail, ShieldCheck, Sparkles, UserRound } from 'lucide-react'
import type { SignUpInput } from './authContext'
import styles from './AuthScreen.module.css'

interface AuthScreenProps {
  readonly configured: boolean
  readonly allowDemo: boolean
  readonly onSignIn: (email: string, password: string) => Promise<void>
  readonly onSignUp: (input: SignUpInput) => Promise<{ readonly needsEmailConfirmation: boolean }>
  readonly onResetPassword: (email: string) => Promise<void>
  readonly onContinueDemo: () => void
}

type AuthMode = 'signin' | 'signup'

function getPasswordStrength(password: string): { readonly label: string; readonly width: string; readonly tone: string } {
  if (!password) return { label: 'Use 8+ characters', width: '0%', tone: styles.strengthEmpty }
  let score = 0
  if (password.length >= 8) score += 1
  if (/[A-Z]/.test(password)) score += 1
  if (/[0-9]/.test(password)) score += 1
  if (/[^A-Za-z0-9]/.test(password)) score += 1
  if (score <= 1) return { label: 'Needs more strength', width: '28%', tone: styles.strengthWeak }
  if (score <= 2) return { label: 'Good foundation', width: '58%', tone: styles.strengthMedium }
  return { label: 'Strong password', width: '100%', tone: styles.strengthStrong }
}

export function AuthScreen({ configured, allowDemo, onSignIn, onSignUp, onResetPassword, onContinueDemo }: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>('signin')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const strength = getPasswordStrength(password)

  const selectMode = (nextMode: AuthMode) => {
    setMode(nextMode)
    setError('')
    setSuccess('')
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSuccess('')
    if (!email.trim() || !email.includes('@')) {
      setError('Enter a valid work email address.')
      return
    }
    if (password.length < 8) {
      setError('Use a password with at least 8 characters.')
      return
    }
    if (mode === 'signup') {
      if (!displayName.trim()) {
        setError('Add your name so the workspace can greet you properly.')
        return
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.')
        return
      }
    }

    setSubmitting(true)
    try {
      if (mode === 'signin') {
        await onSignIn(email, password)
      } else {
        const result = await onSignUp({ displayName, email, password })
        if (result.needsEmailConfirmation) {
          setSuccess('Account created. Check your inbox to confirm your email, then sign in.')
          setMode('signin')
          setPassword('')
          setConfirmPassword('')
        }
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Authentication failed. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const resetPassword = async () => {
    setError('')
    setSuccess('')
    if (!email.trim() || !email.includes('@')) {
      setError('Enter your work email first so we know where to send the reset link.')
      return
    }

    setSubmitting(true)
    try {
      await onResetPassword(email)
      setSuccess('If an account exists for that email, a password reset link is on its way.')
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not request a password reset.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.ambientGlow} aria-hidden="true" />
      <section className={styles.marketing} aria-label="FINTRACE product overview">
        <div className={styles.brandLine}>
          <div className={styles.brandMark} aria-hidden="true"><ShieldCheck size={20} strokeWidth={2.2} /></div>
          <span>FINTRACE</span>
        </div>
        <div className={styles.marketingCopy}>
          <p className={styles.eyebrow}><Sparkles size={13} aria-hidden="true" /> INVESTIGATION COMMAND CENTER</p>
          <h1>See the story<br /><em>behind the money.</em></h1>
          <p className={styles.lede}>A calm, explainable workspace for teams who need to move from transaction noise to confident human review.</p>
        </div>
        <div className={styles.featureRail}>
          <div className={styles.featureItem}><span className={styles.featureIcon}><KeyRound size={15} /></span><span><strong>Private by design</strong><small>RLS-ready analyst workspaces</small></span></div>
          <div className={styles.featureItem}><span className={styles.featureIcon}><ArrowRight size={15} /></span><span><strong>Follow the flow</strong><small>Chronological paths with evidence</small></span></div>
          <div className={styles.featureItem}><span className={styles.featureIcon}><CheckCircle2 size={15} /></span><span><strong>Review, don’t accuse</strong><small>Signals are context, never verdicts</small></span></div>
        </div>
        <div className={styles.marketingFooter}><span className={styles.statusDot} /> Secure workspace access <span className={styles.footerDivider}>·</span> Asia/Kolkata</div>
      </section>

      <section className={styles.authCard} aria-labelledby="auth-title">
        <div className={styles.mobileBrand}><div className={styles.brandMark} aria-hidden="true"><ShieldCheck size={19} /></div><span>FINTRACE</span></div>
        <div className={styles.cardIntro}>
          <span className={styles.cardKicker}>{mode === 'signin' ? 'WELCOME BACK' : 'START INVESTIGATING'}</span>
          <h2 id="auth-title">{mode === 'signin' ? 'Sign in to your workspace' : 'Create your analyst account'}</h2>
          <p>{mode === 'signin' ? 'Pick up where your investigation left off.' : 'Set up a secure home for your investigation work.'}</p>
        </div>

        <div className={styles.tabs} role="tablist" aria-label="Authentication options">
          <button type="button" role="tab" aria-selected={mode === 'signin'} className={mode === 'signin' ? styles.tabActive : ''} onClick={() => selectMode('signin')}>Sign in</button>
          <button type="button" role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? styles.tabActive : ''} onClick={() => selectMode('signup')}>Sign up</button>
        </div>

        {!configured ? (
          <div className={styles.setupNotice} role="status">
            <span className={styles.setupIcon}><LockKeyhole size={14} /></span>
            <span><strong>Auth setup pending</strong><small>Add Supabase values to <code>.env.local</code> to enable real accounts.</small></span>
          </div>
        ) : null}

        <form className={styles.form} onSubmit={(event) => void submit(event)}>
          {mode === 'signup' ? (
            <label className={styles.field}>
              <span>Your name</span>
              <span className={styles.inputShell}><UserRound size={16} aria-hidden="true" /><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Aarav Mehta" autoComplete="name" /></span>
            </label>
          ) : null}
          <label className={styles.field}>
            <span>Work email</span>
            <span className={styles.inputShell}><Mail size={16} aria-hidden="true" /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" autoComplete="email" /></span>
          </label>
          <label className={styles.field}>
            <span>Password</span>
            <span className={styles.inputShell}><LockKeyhole size={16} aria-hidden="true" /><input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} /><button type="button" className={styles.revealButton} onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></span>
          </label>
          {mode === 'signup' ? (
            <>
              <div className={styles.strength} aria-live="polite"><div className={styles.strengthTrack}><span className={strength.tone} style={{ width: strength.width }} /></div><small>{strength.label}</small></div>
              <label className={styles.field}>
                <span>Confirm password</span>
                <span className={styles.inputShell}><LockKeyhole size={16} aria-hidden="true" /><input type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="••••••••" autoComplete="new-password" /></span>
              </label>
            </>
          ) : <button type="button" className={styles.forgotButton} onClick={() => void resetPassword()} disabled={submitting}>Forgot password?</button>}

          {error ? <div className={styles.formError} role="alert"><span>!</span>{error}</div> : null}
          {success ? <div className={styles.formSuccess} role="status"><CheckCircle2 size={15} />{success}</div> : null}

          <button type="submit" className={styles.submitButton} disabled={submitting}>{submitting ? 'Working…' : mode === 'signin' ? 'Enter workspace' : 'Create account'}<ArrowRight size={16} aria-hidden="true" /></button>
        </form>

        {allowDemo ? (
          <div className={styles.demoArea}>
            <div className={styles.orLine}><span>or</span></div>
            <button type="button" className={styles.demoButton} onClick={onContinueDemo}>Continue with local demo <ArrowRight size={14} aria-hidden="true" /></button>
            <small>Demo data stays in this browser session and is never uploaded.</small>
          </div>
        ) : null}

        <p className={styles.legal}><ShieldCheck size={13} aria-hidden="true" /> By continuing, you agree to use FINTRACE only with authorised transaction records.</p>
      </section>
    </main>
  )
}

export function AuthLoadingScreen() {
  return <main className={styles.loadingPage}><div className={styles.loadingMark}><ShieldCheck size={22} /></div><span>Restoring secure session…</span></main>
}
