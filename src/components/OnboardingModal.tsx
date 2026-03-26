'use client'
// src/components/OnboardingModal.tsx — Premium 6-step fullscreen onboarding

import { useState, useEffect, useCallback } from 'react'

interface OnboardingModalProps {
  onDone: () => void
}

// ── Data ──────────────────────────────────────────────────────────────────────

const STEPS = [
  // STEP 0: Welcome
  {
    type: 'welcome' as const,
  },
  // STEP 1: Capture
  {
    type: 'feature' as const,
    label: 'Feature 01 — Capture',
    title: <>Write without <em>friction</em></>,
    desc: 'A distraction-free canvas that gets out of your way and lets your thinking flow.',
    layout: 'cols-3' as const,
    cards: [
      {
        icon: <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>,
        icon2: <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>,
        what: 'Core Editor', name: 'Rich Text Notes',
        body: 'A clean, block-based editor with full markdown support. Write prose, add headers, embed code, create tables — everything in one document.',
      },
      {
        icon: <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></>,
        what: 'Templates', name: 'Quick Capture',
        body: 'Start from pre-built templates for meeting notes, research briefs, daily logs, and more. Never stare at a blank page again.',
        tag: 'Smart',
      },
      {
        icon: <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>,
        what: 'Collaboration', name: 'Shared Docs',
        body: 'Invite teammates to view and co-create documents. Sutra tracks who contributed what and when.',
      },
    ],
  },
  // STEP 2: AI
  {
    type: 'feature' as const,
    label: 'Feature 02 — Intelligence',
    title: <>AI that <em>understands</em> you</>,
    desc: "Sutra's AI layer reads your notes, finds patterns, and surfaces insights you didn't know to look for.",
    layout: 'cols-2' as const,
    cards: [
      {
        icon: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>,
        what: 'AI Synthesis', name: 'Intelligent Summaries',
        body: "Select any document or collection of notes and Sutra's AI will distill the core ideas into a concise, structured summary — in seconds.",
        tag: 'Powered by GPT-4',
      },
      {
        icon: <><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>,
        what: 'Semantic Search', name: 'Meaning-Based Search',
        body: "Don't remember the exact words? Search by concept. Sutra understands intent, not just keywords — surfacing conceptually related notes.",
        tag: 'Vector Search',
      },
      {
        icon: <><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></>,
        what: 'Auto-tagging', name: 'Smart Labels',
        body: 'Sutra reads your notes and automatically suggests relevant tags, topics, and connections — keeping your knowledge base organized without manual effort.',
      },
      {
        icon: <><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/><path d="M8 10h8M8 14h5" strokeLinecap="round"/></>,
        what: 'AI Chat', name: 'Ask Your Notes',
        body: 'Chat directly with your knowledge base. Ask questions, request clarifications, or get Sutra to draft new content based on everything you\'ve captured.',
        tag: 'Conversational',
      },
    ],
  },
  // STEP 3: Visualize
  {
    type: 'feature' as const,
    label: 'Feature 03 — Visualize',
    title: <>See how ideas <em>connect</em></>,
    desc: "Maps aren't just diagrams — they're a different mode of thinking. Sutra makes visual thinking a first-class experience.",
    layout: 'cols-3' as const,
    cards: [
      {
        icon: <><circle cx="12" cy="12" r="3"/><circle cx="12" cy="4" r="2"/><circle cx="20" cy="16" r="2"/><circle cx="4" cy="16" r="2"/><line x1="12" y1="6" x2="12" y2="9"/><line x1="18.5" y1="15" x2="14.5" y2="13"/><line x1="5.5" y1="15" x2="9.5" y2="13"/></>,
        what: 'Mindmap', name: 'Radial Mind Maps',
        body: 'Start with a central idea and branch outward. Drag, resize, recolor, and connect nodes freely with an intuitive canvas built on D3.js.',
      },
      {
        icon: <><rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="3" width="6" height="6" rx="1"/><rect x="9" y="15" width="6" height="6" rx="1"/><line x1="6" y1="9" x2="6" y2="12"/><line x1="18" y1="9" x2="18" y2="12"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="12" y1="12" x2="12" y2="15"/></>,
        what: 'Knowledge Graph', name: 'Auto-Generated Graphs',
        body: 'Sutra analyzes your linked notes and builds a live knowledge graph — letting you see the shape of your thinking at a glance.',
        tag: 'Auto-linked',
      },
      {
        icon: <><path d="M14.5 10c-.83 0-1.5-.67-1.5-1.5v-5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5z"/><path d="M20.5 10H19V8.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/><path d="M9.5 14c.83 0 1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5S8 21.33 8 20.5v-5c0-.83.67-1.5 1.5-1.5z"/><path d="M3.5 14H5v1.5c0 .83-.67 1.5-1.5 1.5S2 16.33 2 15.5 2.67 14 3.5 14z"/><path d="M14 14.5c0-.83.67-1.5 1.5-1.5h5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-5c-.83 0-1.5-.67-1.5-1.5z"/></>,
        what: 'Canvas', name: 'Infinite Whiteboard',
        body: 'A freeform canvas for diagrams, flowcharts, and rough thinking. Embed notes, images, and connections anywhere you want.',
      },
    ],
  },
  // STEP 4: Organize
  {
    type: 'feature' as const,
    label: 'Feature 04 — Organize',
    title: <>A place for <em>everything</em></>,
    desc: 'Folders, tags, links, and filters — a complete organizational system that bends to your mental model.',
    layout: 'cols-4' as const,
    cards: [
      {
        icon: <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>,
        what: 'Structure', name: 'Collections',
        body: 'Separate ideas into dedicated collections with their own signals, maps, and settings.',
      },
      {
        icon: <><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></>,
        what: 'Taxonomy', name: 'Flexible Tags',
        body: 'Multi-dimensional tagging that crosses collection boundaries. Find anything fast.',
      },
      {
        icon: <><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></>,
        what: 'Graph', name: 'Knowledge Links',
        body: 'Sutra maps connections between your signals automatically. Watch your thinking graph grow.',
        tag: 'AI-powered',
      },
      {
        icon: <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>,
        what: 'Priority', name: 'Smart Resurface',
        body: 'SM-2 algorithm surfaces forgotten signals at the right moment. Your knowledge stays fresh.',
      },
    ],
  },
  // STEP 5: Final
  {
    type: 'final' as const,
  },
]

const TOTAL = STEPS.length

// ── Helpers ───────────────────────────────────────────────────────────────────

function FeatIcon({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ width: 40, height: 40, borderRadius: 3, background: 'rgba(201,169,110,0.12)', border: '1px solid rgba(201,169,110,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18, flexShrink: 0 }}>
      <svg viewBox="0 0 24 24" fill="none" stroke="#c9a96e" strokeWidth="1.5" style={{ width: 18, height: 18 }}>
        {children}
      </svg>
    </div>
  )
}

function FeatCard({ card, delay = 0 }: { card: any; delay?: number }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#111214', border: `1px solid ${hovered ? 'rgba(201,169,110,0.22)' : 'rgba(255,255,255,0.07)'}`,
        borderRadius: 4, padding: '28px 24px', textAlign: 'left',
        position: 'relative', overflow: 'hidden', cursor: 'default',
        transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
        boxShadow: hovered ? '0 20px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(201,169,110,0.06)' : 'none',
        transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
        animation: `ob-card-reveal 0.5s ease ${delay}s both`,
      }}
    >
      {/* Top shimmer on hover */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, #c9a96e, transparent)', opacity: hovered ? 0.6 : 0, transition: 'opacity 0.3s' }} />
      <FeatIcon>{card.icon}</FeatIcon>
      <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#c9a96e', marginBottom: 8, fontFamily: 'inherit' }}>{card.what}</div>
      <div style={{ fontFamily: '"Cormorant Garamond", "Instrument Serif", Georgia, serif', fontSize: 18, fontWeight: 500, color: '#f0ede8', marginBottom: 8, letterSpacing: '0.02em' }}>{card.name}</div>
      <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.38)', lineHeight: 1.75 }}>{card.body}</p>
      {card.tag && (
        <span style={{ display: 'inline-block', marginTop: 14, padding: '4px 10px', borderRadius: 100, fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', background: 'rgba(124,110,240,0.1)', border: '1px solid rgba(124,110,240,0.2)', color: '#a099f5' }}>{card.tag}</span>
      )}
    </div>
  )
}

const gridCols: Record<string, string> = {
  'cols-2': 'repeat(2, 1fr)',
  'cols-3': 'repeat(3, 1fr)',
  'cols-4': 'repeat(4, 1fr)',
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function OnboardingModal({ onDone }: OnboardingModalProps) {
  const [current, setCurrent] = useState(0)
  const [visible, setVisible] = useState(false)
  const [transitioning, setTransitioning] = useState(false)
  const [slideDir, setSlideDir] = useState<'in' | 'out'>('in')

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80)
    return () => clearTimeout(t)
  }, [])

  const dismiss = useCallback(async () => {
    setVisible(false)
    setTimeout(onDone, 600)
    try { await fetch('/api/user/onboarding', { method: 'PATCH' }) } catch {}
  }, [onDone])

  const goTo = useCallback((n: number) => {
    if (transitioning || n < 0 || n >= TOTAL) return
    setTransitioning(true)
    setSlideDir('out')
    setTimeout(() => { setCurrent(n); setSlideDir('in'); setTransitioning(false) }, 250)
  }, [transitioning])

  const next = useCallback(() => {
    if (current === TOTAL - 1) { dismiss(); return }
    goTo(current + 1)
  }, [current, dismiss, goTo])

  // Keyboard nav
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') next()
      if (e.key === 'ArrowLeft') goTo(current - 1)
      if (e.key === 'Escape') dismiss()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [current, next, goTo, dismiss])

  const step = STEPS[current]!
  const pct = ((current + 1) / TOTAL) * 100
  const isFinal = current === TOTAL - 1

  return (
    <>
      {/* Fonts */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />

      <style>{`
        @keyframes ob-blob-float {
          from { transform: translate(0,0) scale(1); }
          to   { transform: translate(28px,18px) scale(1.08); }
        }
        @keyframes ob-reveal {
          from { opacity: 0; transform: translateY(22px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes ob-card-reveal {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes ob-pulse-ring {
          0%,100% { box-shadow: 0 0 40px rgba(201,169,110,.15), inset 0 0 20px rgba(201,169,110,.05); }
          50%      { box-shadow: 0 0 80px rgba(201,169,110,.3),  inset 0 0 30px rgba(201,169,110,.1); }
        }
      `}</style>

      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: '#0a0a0b',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.6s cubic-bezier(0.4,0,0.2,1)',
        overflow: 'hidden',
        fontFamily: '"DM Mono", monospace',
      }}>
        {/* Grain overlay */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.25, zIndex: 0,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E")`,
        }} />

        {/* Ambient glow blobs */}
        <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: '#c9a96e', top: -100, left: -100, filter: 'blur(100px)', opacity: 0.13, pointerEvents: 'none', animation: 'ob-blob-float 12s ease-in-out infinite alternate', zIndex: 0 }} />
        <div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: '#7c6ef0', bottom: -80, right: -80, filter: 'blur(100px)', opacity: 0.12, pointerEvents: 'none', animation: 'ob-blob-float 12s ease-in-out infinite alternate', animationDelay: '-4s', zIndex: 0 }} />
        <div style={{ position: 'absolute', width: 300, height: 300, borderRadius: '50%', background: '#4a8fa8', top: '40%', left: '50%', filter: 'blur(100px)', opacity: 0.06, pointerEvents: 'none', animation: 'ob-blob-float 12s ease-in-out infinite alternate', animationDelay: '-8s', zIndex: 0 }} />

        {/* Progress bar */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'rgba(255,255,255,0.07)', zIndex: 100 }}>
          <div style={{ height: '100%', background: 'linear-gradient(90deg, #c9a96e, #e8c98a)', width: `${pct}%`, transition: 'width 0.5s cubic-bezier(0.4,0,0.2,1)', boxShadow: '0 0 12px rgba(201,169,110,0.4)' }} />
        </div>

        {/* Content */}
        <div style={{
          position: 'relative', zIndex: 10,
          width: '100%', height: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '60px 48px',
          opacity: transitioning ? 0 : 1,
          transform: transitioning ? (slideDir === 'out' ? 'translateY(-8px)' : 'translateY(8px)') : 'translateY(0)',
          transition: 'opacity 0.22s ease, transform 0.22s ease',
        }}>

          {/* WELCOME STEP */}
          {step.type === 'welcome' && (
            <div style={{ textAlign: 'center', maxWidth: 700, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
              {/* Logo */}
              <div style={{ marginBottom: 48, animation: 'ob-reveal 0.8s ease both' }}>
                <div style={{ width: 52, height: 52, border: '1.5px solid #c9a96e', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', boxShadow: '0 0 32px rgba(201,169,110,0.22)', position: 'relative' }}>
                  <div style={{ position: 'absolute', inset: 5, borderRadius: '50%', background: 'radial-gradient(circle at 35% 35%, rgba(201,169,110,0.25), transparent 65%)' }} />
                  <svg viewBox="0 0 24 24" fill="none" stroke="#c9a96e" strokeWidth="1.5" style={{ width: 22, height: 22, position: 'relative', zIndex: 1 }}>
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
                    <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div style={{ fontFamily: '"Cormorant Garamond", serif', fontSize: 13, fontWeight: 300, letterSpacing: '0.4em', color: '#f0ede8', textTransform: 'uppercase' }}>Sutra</div>
                <div style={{ fontSize: 9, letterSpacing: '0.25em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginTop: 4 }}>Your Thinking System</div>
              </div>

              <div style={{ fontSize: 9, letterSpacing: '0.35em', color: '#c9a96e', textTransform: 'uppercase', marginBottom: 20, animation: 'ob-reveal 0.6s ease 0.1s both' }}>Welcome to Sutra</div>
              <h1 style={{ fontFamily: '"Cormorant Garamond", serif', fontSize: 'clamp(52px,7vw,80px)', fontWeight: 300, lineHeight: 1.05, color: '#f0ede8', marginBottom: 28, animation: 'ob-reveal 0.6s ease 0.15s both' }}>
                Think <em style={{ fontStyle: 'italic', color: '#c9a96e' }}>deeper,</em><br />build clearer.
              </h1>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', maxWidth: 460, lineHeight: 1.85, marginBottom: 52, animation: 'ob-reveal 0.6s ease 0.2s both' }}>
                Sutra is your second brain — a unified system for capturing ideas, connecting knowledge, and surfacing clarity from complexity.
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', animation: 'ob-reveal 0.6s ease 0.28s both' }}>
                {['AI-Powered Thinking', 'Knowledge Graphs', 'Smart Capture', 'Research Synthesis', 'Smart Resurface'].map(c => (
                  <span key={c} style={{ padding: '8px 16px', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 100, fontSize: 10, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.05em', background: '#111214', transition: 'all 0.25s ease', cursor: 'default' }}>{c}</span>
                ))}
              </div>
            </div>
          )}

          {/* FEATURE STEPS */}
          {step.type === 'feature' && (
            <div style={{ width: '100%', maxWidth: 960 }}>
              <div style={{ marginBottom: 44, textAlign: 'center', animation: 'ob-reveal 0.5s ease both' }}>
                <div style={{ fontSize: 9, letterSpacing: '0.3em', color: '#c9a96e', textTransform: 'uppercase', marginBottom: 12 }}>{step.label}</div>
                <h2 style={{ fontFamily: '"Cormorant Garamond", serif', fontSize: 'clamp(34px,5vw,54px)', fontWeight: 300, color: '#f0ede8' }}>{step.title}</h2>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.42)', maxWidth: 480, margin: '12px auto 0', lineHeight: 1.8 }}>{step.desc}</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: gridCols[step.layout] ?? 'repeat(3,1fr)', gap: 16 }}>
                {step.cards.map((card: any, i: number) => (
                  <FeatCard key={i} card={card} delay={0.04 + i * 0.05} />
                ))}
              </div>
            </div>
          )}

          {/* FINAL STEP */}
          {step.type === 'final' && (
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
              <div style={{ width: 80, height: 80, border: '1px solid rgba(201,169,110,0.4)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 32px', animation: 'ob-pulse-ring 3s ease-in-out infinite' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="#c9a96e" strokeWidth="1.2" style={{ width: 36, height: 36 }}>
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
                  <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div style={{ width: 60, height: 1, background: 'linear-gradient(90deg,transparent,#c9a96e,transparent)', marginBottom: 28 }} />
              <h2 style={{ fontFamily: '"Cormorant Garamond", serif', fontSize: 'clamp(44px,6vw,68px)', fontWeight: 300, color: '#f0ede8', marginBottom: 16, animation: 'ob-reveal 0.6s ease both' }}>
                You're <em style={{ fontStyle: 'italic', color: '#c9a96e' }}>ready.</em>
              </h2>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.42)', lineHeight: 1.85, maxWidth: 420, margin: '0 auto 44px', animation: 'ob-reveal 0.6s ease 0.1s both' }}>
                Your thinking system is set up and waiting. Start with a signal, open the knowledge graph, or ask the AI a question — Sutra meets you wherever you are.
              </p>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', animation: 'ob-reveal 0.6s ease 0.2s both' }}>
                {['✦ Capture your first signal', '✦ Browse the knowledge graph', '✦ Create a collection'].map(chip => (
                  <span key={chip} style={{ padding: '8px 18px', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 100, fontSize: 10, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.05em', background: '#111214' }}>{chip}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Step dots */}
        <div style={{
          position: 'fixed', bottom: 40, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', gap: 8, zIndex: 100, alignItems: 'center',
        }}>
          {STEPS.map((_, i) => (
            <div
              key={i}
              onClick={() => goTo(i)}
              title={`Go to step ${i + 1}`}
              style={{
                height: 4, borderRadius: 2, cursor: 'pointer',
                width: i === current ? 24 : 4,
                background: i === current ? '#c9a96e' : i < current ? 'rgba(201,169,110,0.4)' : 'rgba(255,255,255,0.15)',
                transition: 'all 0.4s cubic-bezier(0.4,0,0.2,1)',
              }}
            />
          ))}
        </div>

        {/* Nav buttons */}
        <div style={{ position: 'fixed', bottom: 28, right: 44, display: 'flex', gap: 12, zIndex: 100 }}>
          {!isFinal && (
            <button
              onClick={dismiss}
              style={{
                height: 38, padding: '0 20px', borderRadius: 3,
                fontFamily: '"DM Mono", monospace', fontSize: 10, letterSpacing: '0.15em',
                textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.25s ease',
                background: 'transparent', border: '1px solid rgba(255,255,255,0.12)',
                color: 'rgba(255,255,255,0.35)',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.35)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)' }}
            >Skip tour</button>
          )}
          <button
            onClick={next}
            style={{
              height: 38, padding: '0 24px', borderRadius: 3,
              fontFamily: '"DM Mono", monospace', fontSize: 10, letterSpacing: '0.15em',
              textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.25s ease',
              background: isFinal
                ? 'linear-gradient(135deg, rgba(201,169,110,0.25), rgba(201,169,110,0.12))'
                : 'linear-gradient(135deg, rgba(201,169,110,0.18), rgba(201,169,110,0.08))',
              border: `1px solid ${isFinal ? '#c9a96e' : 'rgba(201,169,110,0.4)'}`,
              color: '#c9a96e',
              boxShadow: isFinal ? '0 0 24px rgba(201,169,110,0.12)' : 'none',
            }}
            onMouseEnter={e => {
              if (isFinal) {
                e.currentTarget.style.background = 'linear-gradient(135deg, #c9a96e, #b8904a)'
                e.currentTarget.style.color = '#0a0a0b'
                e.currentTarget.style.boxShadow = '0 8px 32px rgba(201,169,110,0.28)'
              } else {
                e.currentTarget.style.borderColor = '#c9a96e'
                e.currentTarget.style.color = '#f0ede8'
              }
            }}
            onMouseLeave={e => {
              if (isFinal) {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(201,169,110,0.25), rgba(201,169,110,0.12))'
                e.currentTarget.style.color = '#c9a96e'
                e.currentTarget.style.boxShadow = '0 0 24px rgba(201,169,110,0.12)'
              } else {
                e.currentTarget.style.borderColor = 'rgba(201,169,110,0.4)'
                e.currentTarget.style.color = '#c9a96e'
              }
            }}
          >
            {isFinal ? 'Enter Sutra ✦' : 'Next →'}
          </button>
        </div>

        {/* Keyboard hint */}
        <div style={{ position: 'fixed', bottom: 32, left: 44, zIndex: 100, fontSize: 9, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.12em', display: 'flex', alignItems: 'center', gap: 8 }}>
          {(['→', 'Esc'] as const).map(k => (
            <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, border: '1px solid rgba(255,255,255,0.15)', borderRadius: 3, fontFamily: '"DM Mono", monospace', fontSize: 9, color: 'rgba(255,255,255,0.4)', background: '#1a1a1f' }}>{k}</span>
              {k === '→' ? 'next' : 'skip'}
              {k === '→' && <>&nbsp;</>}
            </span>
          ))}
        </div>
      </div>
    </>
  )
}
