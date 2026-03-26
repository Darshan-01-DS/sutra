'use client'
// src/app/login/page.tsx — Split-screen login page

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import '@/app/(landing)/landing.css'

const QUOTES = [
  { text: "The purpose of a second brain is to free your first brain to do what it does best — create, connect, and think.", author: 'Tiago Forte', role: 'Author of Building a Second Brain' },
  { text: "Your mind is for having ideas, not holding them.", author: 'David Allen', role: 'Author of Getting Things Done' },
  { text: "Every signal you don't capture is a thought you've already lost.", author: 'Sutra Journal', role: 'On knowledge management' },
]

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) { setError('Email and password required'); return }
    setLoading(true); setError('')
    try {
      const res = await signIn('credentials', { email, password, redirect: false })
      if (res?.error) setError('Invalid email or password')
      else { router.push('/dashboard'); router.refresh() }
    } catch { setError('An error occurred during sign in') }
    finally { setLoading(false) }
  }

  return (
    <div className="auth-split">
      {/* LEFT — BRAND PANEL */}
      <div className="auth-brand">
        <div className="atmo-bg">
          <div className="atmo-glow" />
          <div className="atmo-grid" />
          <div className="atmo-noise" />
        </div>
        <div className="auth-brand-content">
          <div className="auth-brand-logo">Sutra</div>
          <div className="auth-brand-tagline">YOUR THINKING SYSTEM</div>
          {QUOTES.map((q, i) => (
            <div key={i} className="auth-quote">
              "{q.text}"
              <div className="auth-quote-author">— {q.author}, <em>{q.role}</em></div>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT — FORM PANEL */}
      <div className="auth-form-side">
        <div className="auth-form-inner">
          <h1 className="auth-form-title">Welcome back</h1>
          <p className="auth-form-sub">Sign in to your thinking system</p>

          {/* OAuth */}
          <button type="button" className="auth-oauth-btn" onClick={() => signIn('google', { callbackUrl: '/dashboard' })}>
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 002.38-5.88c0-.57-.05-.66-.15-1.18z" fill="#4285F4"/>
              <path d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.01c-.72.48-1.64.76-2.7.76-2.08 0-3.84-1.4-4.47-3.29H1.84v2.07A8 8 0 008.98 17z" fill="#34A853"/>
              <path d="M4.51 10.52A4.8 4.8 0 014.26 9c0-.53.09-1.04.25-1.52V5.41H1.84A8 8 0 00.98 9c0 1.29.31 2.51.86 3.59l2.67-2.07z" fill="#FBBC05"/>
              <path d="M8.98 3.58c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 008.98 1a8 8 0 00-7.14 4.41l2.67 2.07c.63-1.89 2.39-3.3 4.47-3.3z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>
          <button type="button" className="auth-oauth-btn" onClick={() => signIn('github', { callbackUrl: '/dashboard' })}>
            <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
            </svg>
            Continue with GitHub
          </button>

          <div className="auth-divider">
            <div className="auth-divider-line" />
            <span className="auth-divider-text">or continue with email</span>
            <div className="auth-divider-line" />
          </div>

          {error && <div className="auth-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>Email</div>
            <input className="auth-input" type="email" placeholder="you@example.com" value={email} onChange={e => { setEmail(e.target.value); setError('') }} required />
            <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>Password</div>
            <input className="auth-input" type="password" placeholder="••••••••" value={password} onChange={e => { setPassword(e.target.value); setError('') }} required />
            <button type="submit" className="auth-btn-primary" disabled={loading} style={{ marginTop: 4 }}>
              {loading ? 'Signing in…' : 'Sign in to Sutra'}
            </button>
          </form>

          <p className="auth-footer-text">No account? <Link href="/register" className="auth-link">Create one free →</Link></p>
        </div>
      </div>
    </div>
  )
}
