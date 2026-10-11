import { useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../game/supabase'

export function Auth() {
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ text: string; bad: boolean } | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    const { data, error } =
      mode === 'in'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } })
    setBusy(false)
    if (error) setMsg({ text: error.message, bad: true })
    else if (mode === 'up' && !data.session)
      setMsg({ text: 'Check your email for a confirmation link, then sign in.', bad: false })
  }

  async function google() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) setMsg({ text: error.message, bad: true })
  }

  async function reset() {
    if (!email) return setMsg({ text: 'Type your email above first.', bad: true })
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
    setMsg(error ? { text: error.message, bad: true } : { text: 'Password reset email sent.', bad: false })
  }

  return (
    <div className="auth">
      <div className="auth-hero">
        <div className="logo">🌱</div>
        <h1>Study Valley</h1>
        <p>Study. Earn gold. Grow your garden.</p>
      </div>
      <form className="panel" onSubmit={submit}>
        <h2>{mode === 'in' ? 'Welcome back' : 'Create your valley'}</h2>
        <label>
          Email
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Password
          <input
            type="password"
            required
            minLength={6}
            autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {msg && <p className={msg.bad ? 'msg bad' : 'msg'}>{msg.text}</p>}
        <button className="btn" disabled={busy}>{busy ? '…' : mode === 'in' ? 'Sign in' : 'Sign up'}</button>
        <button type="button" className="btn ghost" onClick={google}>Continue with Google</button>
        <div className="auth-links">
          <button type="button" className="link" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>
            {mode === 'in' ? 'New here? Sign up' : 'Have an account? Sign in'}
          </button>
          {mode === 'in' && <button type="button" className="link" onClick={reset}>Forgot password?</button>}
        </div>
      </form>
    </div>
  )
}
