'use client'
// src/components/ui/ConfirmDialog.tsx
// Reusable styled confirmation dialog — replaces browser confirm()

import { useEffect } from 'react'

interface ConfirmDialogProps {
  open: boolean
  title: string
  body: string
  confirmLabel?: string
  cancelLabel?: string
  dangerous?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open, title, body,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  dangerous = false,
  onConfirm, onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
      if (e.key === 'Enter') onConfirm()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onCancel, onConfirm])

  if (!open) return null

  const btnStyle: React.CSSProperties = dangerous
    ? {
        height: 34, padding: '0 18px', background: 'rgba(232,112,90,0.1)',
        color: 'var(--coral)', border: '1px solid var(--coral-border)',
        borderRadius: 'var(--r)', fontSize: 13, fontWeight: 500,
        cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'var(--font-body)',
      }
    : {
        height: 34, padding: '0 18px', background: 'var(--accent)',
        color: '#0A0A0C', border: 'none',
        borderRadius: 'var(--r)', fontSize: 13, fontWeight: 500,
        cursor: 'pointer', transition: 'opacity 0.15s', fontFamily: 'var(--font-body)',
      }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: 'var(--bg2)', border: '1px solid var(--border2)',
          borderRadius: 'var(--r-lg)', padding: '24px 28px',
          maxWidth: 400, width: '100%',
          boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
          animation: 'confirm-slide 0.18s ease both',
        }}
        onClick={e => e.stopPropagation()}
      >
        <style>{`
          @keyframes confirm-slide {
            from { opacity: 0; transform: translateY(-8px) scale(0.97); }
            to   { opacity: 1; transform: translateY(0) scale(1); }
          }
        `}</style>

        <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 8, color: 'var(--text)' }}>
          {title}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 24 }}>
          {body}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            style={{
              height: 34, padding: '0 16px', background: 'none',
              color: 'var(--text2)', border: '1px solid var(--border2)',
              borderRadius: 'var(--r)', fontSize: 13, cursor: 'pointer',
              fontFamily: 'var(--font-body)',
            }}
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button style={btnStyle} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
