'use client'
// src/components/ui/ExtensionModal.tsx

import { useState, useEffect } from 'react'

interface ExtensionModalProps {
  open: boolean
  onClose: () => void
}

export function ExtensionModal({ open, onClose }: ExtensionModalProps) {
  const [downloadClicked, setDownloadClicked] = useState(false)

  useEffect(() => {
    if (!open) { setDownloadClicked(false); return }
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const steps = [
    {
      num: '01',
      icon: '⬇️',
      title: 'Download the ZIP',
      body: 'Click "Download Extension" below. A file called sutra-extension.zip will save to your Downloads folder.',
      highlight: false,
    },
    {
      num: '02',
      icon: '📂',
      title: 'Extract / Unzip the folder',
      body: 'Right-click the ZIP → "Extract All" (Windows) or double-click (Mac). You need the extracted folder, NOT the ZIP itself.',
      highlight: true,
    },
    {
      num: '03',
      icon: '🔧',
      title: 'Enable Developer Mode in Chrome',
      body: 'Open a new tab, go to chrome://extensions and toggle on "Developer mode" in the top-right corner.',
      highlight: false,
    },
    {
      num: '04',
      icon: '📁',
      title: 'Load the extracted folder',
      body: 'Click "Load unpacked" → select the extracted sutra-extension folder (the one with manifest.json inside it).',
      highlight: false,
    },
    {
      num: '05',
      icon: '📌',
      title: 'Pin Sutra & start capturing',
      body: 'Click the puzzle icon in Chrome toolbar → pin Sutra. Now visit any page and click the Sutra icon to save signals!',
      highlight: false,
    },
  ]

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg2)',
          border: '1px solid var(--border2)',
          borderRadius: 20,
          padding: '28px 28px 24px',
          maxWidth: 500,
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 40px 120px rgba(0,0,0,0.8)',
          animation: 'fadeSlideIn 0.2s ease',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 46, height: 46,
              background: 'var(--accent-bg)',
              border: '1.5px solid var(--accent-border)',
              borderRadius: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <svg width="22" height="22" viewBox="0 0 20 20" fill="none">
                <path d="M10 3L15 10L10 17L5 10Z" stroke="#C9A96E" strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
                <path d="M10 6.5L13 10L10 13.5L7 10Z" fill="#C9A96E" opacity="0.4"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.01em' }}>Sutra Chrome Extension</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Save signals from any page in one click</div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 22, lineHeight: 1, padding: '2px 6px', borderRadius: 6 }}
          >×</button>
        </div>

        {/* Features chips */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 22 }}>
          {[
            { icon: '⚡', label: 'One-click capture' },
            { icon: '🏷️', label: 'AI auto-tagging' },
            { icon: '◇', label: 'Add to collections' },
            { icon: '🔖', label: 'Save from any site' },
          ].map(f => (
            <div key={f.label} style={{
              background: 'var(--bg3)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '9px 12px',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ fontSize: 15 }}>{f.icon}</span>
              <span style={{ fontSize: 12, color: 'var(--text2)' }}>{f.label}</span>
            </div>
          ))}
        </div>

        {/* Step-by-step guide */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
            Installation Guide — Follow in order
          </div>
          {steps.map(s => (
            <div
              key={s.num}
              style={{
                display: 'flex', gap: 12, marginBottom: 10, alignItems: 'flex-start',
                padding: '10px 12px',
                background: s.highlight ? 'rgba(201,169,110,0.06)' : 'var(--bg3)',
                border: `1px solid ${s.highlight ? 'rgba(201,169,110,0.25)' : 'var(--border)'}`,
                borderRadius: 10,
              }}
            >
              <div style={{
                width: 28, height: 28,
                background: s.highlight ? 'rgba(201,169,110,0.15)' : 'var(--bg5)',
                border: `1px solid ${s.highlight ? 'var(--accent-border)' : 'var(--border2)'}`,
                borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, fontSize: 14,
              }}>
                {s.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: 13, fontWeight: 600, marginBottom: 3,
                  color: s.highlight ? 'var(--accent)' : 'var(--text)',
                }}>
                  {s.num}. {s.title}
                  {s.highlight && (
                    <span style={{
                      marginLeft: 8, fontSize: 10, fontWeight: 600,
                      background: 'rgba(201,169,110,0.15)', color: 'var(--accent)',
                      border: '1px solid var(--accent-border)',
                      borderRadius: 4, padding: '1px 6px',
                    }}>
                      IMPORTANT
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>{s.body}</div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          <a
            href="/sutra-extension.zip"
            download="sutra-extension.zip"
            onClick={() => setDownloadClicked(true)}
            style={{
              flex: 1, height: 44,
              background: downloadClicked ? 'rgba(201,169,110,0.2)' : 'var(--accent)',
              color: downloadClicked ? 'var(--accent)' : '#0A0A0C',
              border: downloadClicked ? '1px solid var(--accent-border)' : 'none',
              borderRadius: 10, fontSize: 13, fontWeight: 600,
              fontFamily: 'inherit', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              textDecoration: 'none', transition: 'all 0.2s',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M8 2v9M4 8l4 4 4-4M2 14h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {downloadClicked ? '✓ Downloaded — now extract it!' : 'Download Extension ZIP'}
          </a>
          <button
            onClick={onClose}
            style={{
              height: 44, padding: '0 18px', background: 'none',
              color: 'var(--text2)', border: '1px solid var(--border2)',
              borderRadius: 10, fontSize: 13, cursor: 'pointer',
              fontFamily: 'inherit', transition: 'all 0.15s',
            }}
          >
            Close
          </button>
        </div>

        <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text3)', textAlign: 'center', lineHeight: 1.7 }}>
          Chrome & Chromium-based browsers only (Edge, Brave, Arc) · No Web Store needed<br/>
          <span style={{ color: 'rgba(201,169,110,0.6)' }}>
            ⚠️ You must extract (unzip) the file before loading it in Chrome
          </span>
        </div>
      </div>
    </div>
  )
}
