'use client'
// src/app/page.tsx — Landing page (client component, no route group)

import { useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import './(landing)/landing.css'

// Intersection Observer hook for scroll animations
function useReveal() {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current; if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect() } }, { threshold: 0.12 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return { ref, visible }
}

const FEATURES = [
  {
    title: 'Capture Signals',
    body: 'Save ideas, articles, tweets, files, and URLs in seconds. Sutra handles the structure — you focus on the thought.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M12 5v14M5 12l7-7 7 7"/>
        <circle cx="12" cy="19" r="2"/>
      </svg>
    ),
  },
  {
    title: 'Build Collections',
    body: 'Group signals into collections that evolve with your thinking. Private, organized, always yours.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M3 7a2 2 0 012-2h3.17a2 2 0 011.41.59l.84.84A2 2 0 0011.83 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/>
      </svg>
    ),
  },
  {
    title: 'AI-Powered Connections',
    body: "Sutra's knowledge graph surfaces hidden connections between your signals. Discover what you already know.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <circle cx="12" cy="12" r="2"/><circle cx="4" cy="6" r="2"/><circle cx="20" cy="6" r="2"/>
        <circle cx="4" cy="18" r="2"/><circle cx="20" cy="18" r="2"/>
        <line x1="12" y1="10" x2="4" y2="7"/><line x1="12" y1="10" x2="20" y2="7"/>
        <line x1="12" y1="14" x2="4" y2="17"/><line x1="12" y1="14" x2="20" y2="17"/>
      </svg>
    ),
  },
  {
    title: 'Tag & Find Instantly',
    body: 'Tag signals on capture. Find anything in milliseconds. Your second brain, always searchable.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/>
        <line x1="7" y1="7" x2="7.01" y2="7"/>
      </svg>
    ),
  },
]

const STEPS = [
  { num: '01', title: 'Capture', body: 'Paste a URL, type a thought, or drop a file. Sutra auto-categorizes it instantly.' },
  { num: '02', title: 'Organize', body: "Add tags and collections at capture. Or let it sit — organize whenever you're ready." },
  { num: '03', title: 'Connect', body: "Your knowledge graph grows with every signal. AI finds the threads you didn't know existed." },
]

function FeatCard({ feat, delay }: { feat: typeof FEATURES[0]; delay: number }) {
  const { ref, visible } = useReveal()
  return (
    <div ref={ref} className={`ld-feat-card ${visible ? 'visible' : ''}`} style={{ transitionDelay: `${delay}ms` }}>
      <div className="ld-feat-icon">{feat.icon}</div>
      <h3 className="ld-feat-title">{feat.title}</h3>
      <p className="ld-feat-body">{feat.body}</p>
    </div>
  )
}

function StepCard({ step, delay }: { step: typeof STEPS[0]; delay: number }) {
  const { ref, visible } = useReveal()
  return (
    <div ref={ref} className={`ld-step ${visible ? 'visible' : ''}`} style={{ transitionDelay: `${delay}ms` }}>
      <div className="ld-step-num">{step.num}</div>
      <h3 className="ld-step-title">{step.title}</h3>
      <p className="ld-step-body">{step.body}</p>
    </div>
  )
}

export default function LandingPage() {
  const { status } = useSession()
  const router = useRouter()
  const [scrolled, setScrolled] = useState(false)

  // Redirect logged-in users to dashboard
  useEffect(() => {
    if (status === 'authenticated') router.replace('/dashboard')
  }, [status, router])

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  if (status === 'loading' || status === 'authenticated') return null

  return (
    <div className="ld-page">
      {/* ── NAV ── */}
      <nav className={`ld-nav ${scrolled ? 'scrolled' : ''}`}>
        <Link href="/" className="ld-logo">
          <span className="ld-logo-word">Sutra</span>
          <span className="ld-logo-sub">thinking system</span>
        </Link>
        <div className="ld-nav-right">
          <Link href="/login" className="ld-btn-ghost">Sign in</Link>
          <Link href="/register" className="ld-btn-gold">Get Started</Link>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="ld-hero" id="hero">
        <div className="atmo-bg">
          <div className="atmo-glow" />
          <div className="atmo-grid" />
          <div className="atmo-noise" />
        </div>
        <div className="ld-hero-content">
          <h1 className="ld-hero-headline">
            <span className="ld-hero-line">Capture Everything.</span>
            <span className="ld-hero-line">Forget Nothing.</span>
            <span className="ld-hero-line">Think Better.</span>
          </h1>
          <p className="ld-hero-sub">
            Sutra is your second brain — capture signals, build collections,
            and let AI surface the connections you&apos;d otherwise miss.
          </p>
          <div className="ld-hero-cta">
            <Link href="/register" className="ld-cta-primary">
              Start for free
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M3 13L13 3M13 3H6M13 3v7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </Link>
            <a href="#features" className="ld-cta-secondary">See how it works</a>
          </div>
        </div>
      </section>

      {/* ── PRODUCT PREVIEW ── */}
      <div style={{ marginTop: 48, marginBottom: 32, paddingInline: 24, position: 'relative', zIndex: 1, maxWidth: 860, marginInline: 'auto' }}>
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 18, padding: 10, boxShadow: '0 32px 80px rgba(0,0,0,0.45)', overflow: 'hidden' }}>
          {/* App bar mockup */}
          <div style={{ background: 'var(--bg)', borderRadius: 12, padding: '14px 18px', display: 'flex', gap: 10, fontSize: 12, color: 'var(--text3)', borderBottom: '1px solid var(--border)', marginBottom: 12, alignItems: 'center' }}>
            <span style={{ color: 'var(--accent)', fontWeight: 500 }}>◈</span>
            <span style={{ color: 'var(--text2)', fontSize: 13 }}>All signals</span>
            <span style={{ marginLeft: 'auto', fontSize: 11 }}>3 saved · 3 new this week</span>
          </div>
          {/* Signal cards mockup */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, padding: '0 4px 4px' }}>
            {[
              { type: 'TWEET', color: 'var(--teal)', title: 'The best way to think clearly is to write clearly...', tag: '#productivity' },
              { type: 'VIDEO', color: 'var(--coral)', title: 'Deep Work — Full Lecture Series by Cal Newport', tag: '#focus' },
              { type: 'NOTE',  color: 'var(--violet)', title: 'Key insight: complexity scales linearly with connections', tag: '#systems' },
            ].map((c) => (
              <div key={c.type} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 14px 12px', fontSize: 12 }}>
                <div style={{ color: c.color, fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', marginBottom: 8 }}>{c.type}</div>
                <div style={{ fontSize: 12.5, color: 'var(--text)', lineHeight: 1.45, marginBottom: 10 }}>{c.title}</div>
                <div style={{ fontSize: 10, color: 'var(--text3)', background: 'var(--bg4)', display: 'inline-block', padding: '2px 8px', borderRadius: 20, border: '1px solid var(--border)' }}>{c.tag}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── SOCIAL PROOF ── */}
      <div className="ld-proof">
        <div className="ld-proof-line" />
        <div className="ld-proof-text">
          Built for people who think deeply. No ads. Your data stays yours.
        </div>
        <div className="ld-proof-line" />
      </div>

      {/* ── FEATURES ── */}
      <section className="ld-section" id="features">
        <h2 className="ld-section-title">One system for all your thinking</h2>
        <p className="ld-section-sub">Everything you need. Nothing you don&apos;t.</p>
        <div className="ld-features-grid">
          {FEATURES.map((feat, i) => <FeatCard key={feat.title} feat={feat} delay={i * 80} />)}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="ld-section" style={{ background: 'var(--bg2)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <h2 className="ld-section-title">From signal to insight, in three steps</h2>
        <p className="ld-section-sub">The simplest workflow for your most complex thinking.</p>
        <div className="ld-steps">
          {STEPS.map((step, i) => (
            <>
              <StepCard key={step.num} step={step} delay={i * 120} />
              {i < STEPS.length - 1 && (
                <div className="ld-arrow" key={`arrow-${i}`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                    <path d="M5 12h14M14 7l5 5-5 5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              )}
            </>
          ))}
        </div>
      </section>

      {/* ── PRICING ── */}
      <section className="ld-section" id="pricing">
        <h2 className="ld-section-title">Simple, honest pricing</h2>
        <p className="ld-section-sub">Start free. Upgrade when you need more power.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 20, maxWidth: 640, margin: '0 auto', padding: '0 24px' }}>
          {/* Free */}
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 16, padding: '28px 24px' }}>
            <div style={{ fontSize: 11, letterSpacing: '0.12em', color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 12 }}>Free</div>
            <div style={{ fontSize: 36, fontWeight: 300, color: 'var(--text)', marginBottom: 4 }}>$0</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 24 }}>forever</div>
            {['500 signals', 'Basic search', 'Tags & Collections', 'Manual resurface'].map(f => (
              <div key={f} style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 8, display: 'flex', gap: 8 }}>
                <span style={{ color: 'var(--accent)' }}>✓</span> {f}
              </div>
            ))}
            <Link href="/register" className="ld-btn-ghost" style={{ display: 'block', textAlign: 'center', marginTop: 24, padding: '10px 0', textDecoration: 'none' }}>Get Started</Link>
          </div>
          {/* Pro */}
          <div style={{ background: 'linear-gradient(135deg, rgba(201,169,110,0.08), rgba(201,169,110,0.04))', border: '1px solid var(--accent-border)', borderRadius: 16, padding: '28px 24px', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 14, right: 14, fontSize: 9, letterSpacing: '0.12em', background: 'var(--accent)', color: '#000', padding: '3px 8px', borderRadius: 20, fontWeight: 600 }}>POPULAR</div>
            <div style={{ fontSize: 11, letterSpacing: '0.12em', color: 'var(--accent)', textTransform: 'uppercase', marginBottom: 12 }}>Pro</div>
            <div style={{ fontSize: 36, fontWeight: 300, color: 'var(--text)', marginBottom: 4 }}>$9<span style={{ fontSize: 14, color: 'var(--text3)' }}>/mo</span></div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 24 }}>billed monthly</div>
            {['Unlimited signals', 'AI auto-tagging', 'Semantic search', 'Knowledge graph', 'Smart resurface (SM-2)', 'Ask AI'].map(f => (
              <div key={f} style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 8, display: 'flex', gap: 8 }}>
                <span style={{ color: 'var(--accent)' }}>✓</span> {f}
              </div>
            ))}
            <Link href="/register" className="ld-cta-primary" style={{ display: 'block', textAlign: 'center', marginTop: 24, padding: '10px 0', textDecoration: 'none' }}>Start Pro Trial →</Link>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="ld-section">
        <div className="ld-cta-section">
          <div className="atmo-bg">
            <div className="atmo-glow" style={{ right: '-10%', left: 'auto', bottom: '-30%' }} />
            <div className="atmo-grid" />
          </div>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <h2 className="ld-cta-title">Your second brain is waiting.</h2>
            <p className="ld-cta-sub">Join thinkers who never lose a good idea.</p>
            <Link href="/register" className="ld-cta-primary" style={{ display: 'inline-flex' }}>
              Get Started Free →
            </Link>
            <p className="ld-cta-fine">No credit card required. Free forever on the base plan.</p>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="ld-footer">
        <div className="ld-logo-word" style={{ fontSize: 14 }}>Sutra</div>
        <div style={{ color: 'var(--text3)', fontSize: 11 }}>© 2025 Sutra</div>
        <div className="ld-footer-links">
          <a href="#">Privacy</a>
          <a href="#">Terms</a>
        </div>
      </footer>
    </div>
  )
}
