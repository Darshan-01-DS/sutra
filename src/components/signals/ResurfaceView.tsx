'use client'
// src/components/signals/ResurfaceView.tsx

import { useState, useEffect } from 'react'
import type { Signal } from '@/types'
import { timeAgo } from '@/lib/utils'

interface ResurfaceViewProps {
  onOpenDrawer: (id: string) => void
  onRefresh: () => void
}

export function ResurfaceView({ onOpenDrawer, onRefresh }: ResurfaceViewProps) {
  const [manual, setManual] = useState<Signal[]>([])
  const [ai, setAi] = useState<Signal[]>([])
  const [loading, setLoading] = useState(true)

  const fetchQueue = () => {
    setLoading(true)
    fetch('/api/resurface')
      .then(r => r.json())
      .then(data => {
        setManual(data.manualQueue || [])
        setAi(data.aiQueue || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    fetchQueue()
  }, [])

  const handleRemoveManual = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    await fetch(`/api/signals/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ addedToResurface: false, resurfaceNote: '' })
    })
    setManual(prev => prev.filter(s => s._id !== id))
    onRefresh()
  }

  if (loading) {
    return (
      <div className="resurface-view" style={{ padding: '40px 60px' }}>
        <div style={{ fontSize: 24, fontWeight: 500, marginBottom: 40 }}>Resurface Queue</div>
        <div className="skeleton" style={{ height: 180, borderRadius: 16, marginBottom: 16 }} />
        <div className="skeleton" style={{ height: 180, borderRadius: 16 }} />
      </div>
    )
  }

  const total = manual.length + ai.length

  if (total === 0) {
    return (
      <div className="resurface-view" style={{ padding: '80px 60px', textAlign: 'center' }}>
        <div style={{ fontSize: 48, opacity: 0.2, marginBottom: 24 }}>◈</div>
        <div style={{ fontSize: 20, fontWeight: 500, marginBottom: 12 }}>Your resurface queue is empty</div>
        <div style={{ color: 'var(--text3)', maxWidth: 400, margin: '0 auto', lineHeight: 1.5 }}>
          When you find something you want to revisit later, click ↺ on any signal to add it here.
        </div>
      </div>
    )
  }

  const typeIcons: Record<string, string> = {
    article: '▤', tweet: '𝕏', video: '▶', pdf: '⬚', image: '⊡', note: '✎',
  }
  const typeColors: Record<string, string> = {
    article: '#9B8FF5', tweet: '#4ECDC4', video: '#E8705A', pdf: '#C9A96E', image: '#6BCB77', note: '#C9A96E',
  }

  const renderCard = (s: Signal, isManual: boolean) => {
    const c = typeColors[s.type] ?? '#9B8FF5'
    return (
      <div
        key={s._id}
        onClick={() => onOpenDrawer(s._id)}
        style={{
          background: 'var(--bg3)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-lg)',
          padding: 24,
          marginBottom: 16,
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ color: c, background: `${c}20`, padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
              {typeIcons[s.type]} {s.type.toUpperCase()}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>{timeAgo(s.createdAt)}</span>
          </div>
          {isManual && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-ghost" style={{ fontSize: 11, padding: '4px 12px' }} onClick={e => handleRemoveManual(e, s._id)}>
                Done — remove
              </button>
            </div>
          )}
        </div>
        
        <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 8 }}>{s.title}</div>
        
        {isManual && s.resurfaceNote && (
          <div style={{ background: 'var(--accent-bg)', color: 'var(--accent)', padding: '8px 12px', borderRadius: 8, fontSize: 13, marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
            <span>↺</span> {s.resurfaceNote}
          </div>
        )}

        {!isManual && (
          <div style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
            <span>✨</span> You saved this 2 weeks ago and haven't viewed it recently.
          </div>
        )}

        {s.summary && <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16, lineHeight: 1.5 }}>{s.summary.slice(0, 180)}...</div>}

        <div style={{ display: 'flex', gap: 8 }}>
          {s.tags.slice(0, 4).map(t => (
            <span key={t} style={{ fontSize: 11, background: 'var(--bg5)', color: 'var(--text2)', padding: '2px 8px', borderRadius: 12 }}>#{t}</span>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="resurface-view" style={{ padding: '40px 60px', maxWidth: 800, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 40 }}>
        <h1 style={{ fontSize: 24, fontWeight: 500, margin: 0 }}>Resurface Queue</h1>
        <span style={{ background: 'var(--accent)', color: '#000', padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>
          {total}
        </span>
      </div>

      {manual.length > 0 && (
        <div style={{ marginBottom: 48 }}>
          <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--accent)' }}>📌</span> Manually added
          </div>
          {manual.map(s => renderCard(s, true))}
        </div>
      )}

      {ai.length > 0 && (
        <div>
          <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--teal)' }}>✨</span> AI suggested
          </div>
          {ai.map(s => renderCard(s, false))}
        </div>
      )}
    </div>
  )
}
