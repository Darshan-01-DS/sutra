'use client'
// src/components/signals/ConstellationView.tsx

import { useState, useEffect } from 'react'
import type { Signal } from '@/types'
import { SignalCard } from './SignalCard'

interface ConstellationViewProps {
  onOpenDrawer: (id: string) => void
  onRefresh: () => void
}

export function ConstellationView({ onOpenDrawer, onRefresh }: ConstellationViewProps) {
  const [signals, setSignals] = useState<Signal[]>([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState<string>('all')
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest')

  const fetchConstellation = () => {
    setLoading(true)
    // We'll just fetch all signals and filter by isFavorite=true 
    // since the API doesn't have a dedicated favorites endpoint yet.
    // Or we could pass ?favorites=true if we implemented it, but client filter is fine for MVP without auth.
    fetch('/api/signals?favorite=true&limit=500')
      .then(r => r.json())
      .then(data => {
        setSignals(data.data || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    fetchConstellation()
  }, [])

  let filtered = signals
  if (filterType !== 'all') {
    filtered = filtered.filter(s => s.type === filterType)
  }

  filtered.sort((a, b) => {
    const tA = new Date(a.createdAt).getTime()
    const tB = new Date(b.createdAt).getTime()
    return sortOrder === 'newest' ? tB - tA : tA - tB
  })

  if (loading) {
    return (
      <div style={{ padding: '40px 60px' }}>
        <div className="skeleton" style={{ height: 200, borderRadius: 16, marginBottom: 16 }} />
        <div className="skeleton" style={{ height: 200, borderRadius: 16 }} />
      </div>
    )
  }

  if (signals.length === 0) {
    return (
      <div style={{ padding: '80px 60px', textAlign: 'center' }}>
        <div style={{ fontSize: 64, color: 'var(--gold)', opacity: 0.3, marginBottom: 24 }}>★</div>
        <div style={{ fontSize: 20, fontWeight: 500, marginBottom: 12 }}>Your Constellation is empty</div>
        <div style={{ color: 'var(--text3)', maxWidth: 400, margin: '0 auto', lineHeight: 1.5 }}>
          Click ♡ on any signal to add it to your constellation.
          <br/>
          These are your most important saves — the ones worth revisiting.
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '40px 60px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 40 }}>
        <h1 style={{ fontSize: 28, fontWeight: 500, margin: '0 0 8px 0', color: 'var(--gold)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span>★</span> Constellation
        </h1>
        <div style={{ color: 'var(--text2)', fontSize: 14 }}>
          Your best signals — the ones that matter
        </div>
        <div style={{ color: 'var(--text3)', fontSize: 13, marginTop: 4 }}>
          {filtered.length} starred
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'center', flexWrap: 'wrap' }}>
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          style={{ background: 'var(--bg2)', border: '1px solid var(--border)', padding: '6px 12px', borderRadius: 'var(--r)', color: 'var(--text1)', fontSize: 13 }}
        >
          <option value="all">All types ▾</option>
          <option value="article">Articles</option>
          <option value="tweet">Tweets</option>
          <option value="video">Videos</option>
          <option value="pdf">PDFs</option>
          <option value="image">Images</option>
          <option value="note">Notes</option>
        </select>

        <select
          value={sortOrder}
          onChange={e => setSortOrder(e.target.value as any)}
          style={{ background: 'var(--bg2)', border: '1px solid var(--border)', padding: '6px 12px', borderRadius: 'var(--r)', color: 'var(--text1)', fontSize: 13 }}
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>

        <button
          className="btn-ghost"
          style={{ fontSize: 13, padding: '6px 12px' }}
          onClick={() => {
            const dataStr = JSON.stringify(filtered, null, 2)
            const blob = new Blob([dataStr], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `sutra-constellation-${Date.now()}.json`
            a.click()
            URL.revokeObjectURL(url)
          }}
        >
          Export starred
        </button>
      </div>

      {/* Masonry Grid */}
      <div style={{
        columnCount: 3,
        columnGap: 14,
        width: '100%',
      }}>
        {filtered.map(s => (
          <div key={s._id} style={{ breakInside: 'avoid', marginBottom: 14 }}>
            <div style={{
              borderRadius: 'var(--r-lg)',
              border: '1px solid var(--gold)',
              boxShadow: '0 0 10px rgba(201, 169, 110, 0.1)',
              background: 'var(--bg)',
              transition: 'all 0.2s',
              overflow: 'hidden',
            }}
            className="constellation-card-hover"
            >
              <SignalCard
                signal={s}
                onRefresh={() => { fetchConstellation(); onRefresh() }}
                onOpenDrawer={onOpenDrawer}
                isActive={false}
                selected={false}
                onToggleSelected={() => {}}
              />
            </div>
          </div>
        ))}
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        .constellation-card-hover:hover {
          box-shadow: 0 0 15px rgba(201, 169, 110, 0.25) !important;
          transform: translateY(-2px);
        }
        @media (max-width: 900px) {
          .constellation-card-hover { column-count: 2 !important; }
        }
        @media (max-width: 600px) {
          .constellation-card-hover { column-count: 1 !important; }
        }
      `}} />
    </div>
  )
}
