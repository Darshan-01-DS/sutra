'use client'
// src/components/ui/ExtensionModal.tsx

import { useState, useEffect } from 'react'

interface ExtensionModalProps {
  open: boolean
  onClose: () => void
}

export function ExtensionModal({ open, onClose }: ExtensionModalProps) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const steps = [
    { num: '01', title: 'Download the extension', body: 'Click the download button to get the Sutra extension ZIP file.' },
    { num: '02', title: 'Open Chrome Extensions', body: 'Navigate to chrome://extensions in your browser and enable Developer Mode.' },
    { num: '03', title: 'Load unpacked extension', body: 'Click "Load unpacked" and select the extracted extension folder.' },
    { num: '04', title: 'Pin and start capturing', body: 'Pin Sutra to your toolbar. Click it on any page to save signals instantly.' },
  ]

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg2)',
          border: '1px solid var(--border2)',
          borderRadius: 18,
          padding: 32,
          maxWidth: 480,
          width: '100%',
          boxShadow: '0 32px 100px rgba(0,0,0,0.7)',
          animation: 'fadeSlideIn 0.2s ease',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, background: 'var(--accent-bg)', border: '1.5px solid var(--accent-border)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 3L15 10L10 17L5 10Z" stroke="#C9A96E" strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
                <path d="M10 6.5L13 10L10 13.5L7 10Z" fill="#C9A96E" opacity="0.4"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 500 }}>Sutra Browser Extension</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Save signals from any webpage, instantly</div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: '4px 8px' }}
          >×</button>
        </div>

        {/* Features */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
          {[
            { icon: '⚡', label: 'One-click capture' },
            { icon: '🏷️', label: 'AI auto-tagging' },
            { icon: '◇', label: 'Add to collections' },
            { icon: '★', label: 'Mark as constellation' },
          ].map(f => (
            <div key={f.label} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>{f.icon}</span>
              <span style={{ fontSize: 12, color: 'var(--text2)' }}>{f.label}</span>
            </div>
          ))}
        </div>

        {/* Install steps */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>How to install</div>
          {steps.map((s, i) => (
            <div key={s.num} style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'flex-start' }}>
              <div style={{ width: 24, height: 24, background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 9, fontWeight: 600, color: 'var(--accent)', letterSpacing: '0.02em' }}>
                {s.num}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{s.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>{s.body}</div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div style={{ display: 'flex', gap: 10 }}>
          <a
            href="/sutra-extension.zip"
            download="sutra-extension.zip"
            style={{
              flex: 1, height: 42, background: 'var(--accent)', color: '#0A0A0C',
              border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600,
              fontFamily: 'inherit', cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center', gap: 8,
              textDecoration: 'none', transition: 'opacity 0.15s',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M8 2v9M4 8l4 4 4-4M2 14h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Download Extension
          </a>
          <button
            onClick={onClose}
            style={{
              height: 42, padding: '0 18px', background: 'none',
              color: 'var(--text2)', border: '1px solid var(--border2)',
              borderRadius: 10, fontSize: 13, cursor: 'pointer',
              fontFamily: 'inherit', transition: 'all 0.15s',
            }}
          >
            Close
          </button>
        </div>

        <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text3)', textAlign: 'center', lineHeight: 1.6 }}>
          Chrome only (Chromium-based browsers supported) · No Chrome Web Store needed
        </div>
      </div>
    </div>
  )
}
