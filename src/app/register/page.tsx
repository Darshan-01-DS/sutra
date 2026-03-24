'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { signIn } from 'next-auth/react'

export default function RegisterPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !email || !password) return setError('All fields required')
    if (password.length < 8) return setError('Password must be at least 8 characters')
    
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Registration failed')
      
      const loginRes = await signIn('credentials', { email, password, redirect: false })
      if (loginRes?.error) setError('Registered but login failed')
      else {
        router.push('/')
        router.refresh()
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-wrap">

      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">Sutra</div>
          <div className="login-sub">CREATE YOUR ACCOUNT</div>
        </div>
        <div className="login-body">
          {error && <div style={{ color: 'var(--coral)', fontSize: 13, marginBottom: 12, textAlign: 'center' }}>{error}</div>}

          <form onSubmit={handleRegister}>
            <div className="field-label">Name</div>
            <input 
              className="field-input" 
              type="text" 
              placeholder="Your name" 
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
            
            <div className="field-label">Email</div>
            <input 
              className="field-input" 
              type="email" 
              placeholder="you@example.com" 
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
            
            <div className="field-label">Password</div>
            <input 
              className="field-input" 
              type="password" 
              placeholder="At least 8 characters" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={8}
            />
            
            <button type="submit" className="btn-signin" disabled={loading}>
              {loading ? 'Creating...' : 'Create Account'}
            </button>
          </form>
        </div>
        <div className="login-footer">
          Already have an account? <Link href="/login">Sign in</Link>
        </div>
      </div>
    </div>
  )
}
