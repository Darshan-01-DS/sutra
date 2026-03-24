'use client'
// src/components/signals/SignalCard.tsx

import { useState, useCallback, useRef, useEffect } from 'react'
import { Signal } from '@/types'
import { TYPE_CONFIG, timeAgo } from '@/lib/utils'

interface SignalCardProps {
  signal: Signal
  onRefresh: () => void
  onOpenDrawer: (id: string) => void
  isActive: boolean
  selected: boolean
  onToggleSelected: (id: string) => void
}

export function SignalCard({
  signal,
  onRefresh,
  onOpenDrawer,
  isActive,
  selected,
  onToggleSelected,
}: SignalCardProps) {
  const [fav, setFav] = useState(signal.isFavorite)
  const cfg = TYPE_CONFIG[signal.type] ?? TYPE_CONFIG.article

  // Popover states
  const [showResurface, setShowResurface] = useState(false)
  const [resurfaceNote, setResurfaceNote] = useState('')
  const [showCollect, setShowCollect] = useState(false)
  const [collections, setCollections] = useState<any[]>([])
  
  const [isCreatingCol, setIsCreatingCol] = useState(false)
  const [newColName, setNewColName] = useState('')

  const showRealThumb = signal.thumbnail
    && signal.url
    && !signal.url.startsWith('blob:')
    && signal.type !== 'pdf'
    && signal.type !== 'image'

  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setShowResurface(false)
        setShowCollect(false)
        setIsCreatingCol(false)
      }
    }
    if (showResurface || showCollect) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showResurface, showCollect])

  const handleAddResurface = async (e: React.MouseEvent) => {
    e.stopPropagation()
    await fetch(`/api/signals/${signal._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ addedToResurface: true, resurfaceNote }),
    })
    setShowResurface(false)
    onRefresh()
  }

  const openCollect = async () => {
    setShowCollect(true)
    try {
      const res = await fetch('/api/collections')
      const data = await res.json()
      setCollections(data.collections || [])
    } catch {
      setCollections([])
    }
  }

  const handleCollect = async (colId: string) => {
    await fetch('/api/collections/collect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ collectionId: colId, signalIds: [signal._id], mode: 'add' })
    })
    setShowCollect(false)
    onRefresh()
  }

  const handleCreateCol = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    if (!newColName.trim()) return
    try {
      const res = await fetch('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newColName, icon: '◈', color: '#C9A96E' })
      })
      const data = await res.json()
      if (data._id) {
        await handleCollect(data._id)
        setNewColName('')
        setIsCreatingCol(false)
      }
    } catch {
      alert('Failed to create collection')
    }
  }

  const toggleFav = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    const newFav = !fav
    setFav(newFav)

    // Global toast event (assuming AppShell or similar handles it, else it's harmless)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sutra-toast', {
        detail: {
          message: newFav ? 'Added to Constellation ★' : 'Removed from Constellation',
          type: newFav ? 'success' : 'info'
        }
      }))
    }

    await fetch(`/api/signals/${signal._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isFavorite: newFav }),
    })
    
    // Refresh to remove it immediately if we're in a filtered view like Constellation
    onRefresh()
  }, [fav, signal._id, onRefresh])

  const handleOpen = useCallback(() => {
    if (showResurface || showCollect) return
    onOpenDrawer(signal._id)
  }, [onOpenDrawer, signal._id, showResurface, showCollect])

  const handleDelete = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Delete this signal?')) return
    await fetch(`/api/signals/${signal._id}`, { method: 'DELETE' })
    onRefresh()
  }, [signal._id, onRefresh])

  return (
    <div
      ref={cardRef}
      className={`signal-card ${signal.isFavorite ? 'highlight' : ''} ${isActive ? 'card-active' : ''}`}
      onClick={handleOpen}
      style={{ position: 'relative' }}
    >
      {signal.source && (
        <div className="url-hover-preview" aria-hidden="true">
          <img
            className="url-preview-favicon"
            alt=""
            src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(signal.source)}&sz=32`}
          />
          <div className="url-preview-domain">{signal.source}</div>
        </div>
      )}
      <button
        type="button"
        className={`bulk-check ${selected ? 'on' : ''}`}
        onClick={e => {
          e.stopPropagation()
          onToggleSelected(signal._id)
        }}
        aria-label={selected ? 'Deselect signal' : 'Select signal'}
        title={selected ? 'Selected' : 'Select'}
      >
        ✓
      </button>

      {/* Thumbnail */}
      <div className={`card-thumb ${cfg.thumbClass}`}>
        {showRealThumb ? (
          <img src={signal.thumbnail} alt="" loading="lazy" />
        ) : (signal as any).fileUrl && signal.type === 'image' ? (
          <img src={(signal as any).fileUrl} alt="" loading="lazy" />
        ) : (
          <span className="thumb-icon">{cfg.icon}</span>
        )}
        <span className={`type-badge ${cfg.badgeClass}`}>{cfg.label}</span>
      </div>

      {/* Body */}
      <div className="card-body">
        <div className="card-title">{signal.title}</div>
        <div className="card-source">
          {signal.source}
          {signal.readTime && ` · ${signal.readTime}`}
          {signal.duration && ` · ${signal.duration}`}
          {signal.pageCount && ` · ${signal.pageCount}p`}
        </div>
        {signal.tags.length > 0 && (
          <div className="card-tags-row">
            {signal.tags.slice(0, 3).map(tag => (
              <span key={tag} className="ctag">{tag}</span>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="card-foot" style={{ position: 'relative' }}>
        <span className="card-time">{timeAgo(signal.createdAt)}</span>
        <div className="card-acts">
          <button className={`ib ${fav ? 'active' : ''}`} onClick={toggleFav} title={fav ? 'Unfavorite' : 'Favorite'}>
            {fav ? '♥' : '♡'}
          </button>
          
          {/* Add to Resurface */}
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <button
              className="ib"
              onClick={e => { e.stopPropagation(); setShowResurface(!showResurface); setShowCollect(false) }}
              title="Add to Resurface"
            >
              ↺
            </button>
          </div>

          {/* Add to Collection */}
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <button
              className="ib"
              onClick={e => { e.stopPropagation(); openCollect(); setShowResurface(false) }}
              title="Add to collection"
            >
              ⊞
            </button>
          </div>

          {signal.url && (
            <button
              className="ib"
              onClick={e => { e.stopPropagation(); window.open(signal.url, '_blank', 'noopener') }}
              title="Open source"
            >
              ↗
            </button>
          )}
          <button className="ib" onClick={handleDelete} title="Delete" style={{ color: 'var(--text3)' }}>✕</button>
        </div>
      </div>

      {/* Popovers - moved to root for absolute sizing */}
      {showResurface && (
        <div
          className="popover"
          style={{ position: 'absolute', inset: 0, padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'center', background: 'rgba(10,10,12,0.92)', backdropFilter: 'blur(10px)', zIndex: 100, borderRadius: 'var(--r-xl)' }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, textAlign: 'center', fontFamily: 'var(--font-serif)' }}>Add to Resurface</div>
          <textarea
            className="search-input"
            style={{ width: '100%', padding: '12px', fontSize: 13, marginBottom: 16, background: 'var(--bg5)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', minHeight: 80, resize: 'none', color: 'var(--text)' }}
            placeholder="What should remind you about this?"
            value={resurfaceNote}
            onChange={e => setResurfaceNote(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddResurface(e as any) } }}
            autoFocus
          />
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button className="btn-ghost" style={{ padding: '8px 20px', fontSize: 13, border: '1px solid var(--border)' }} onClick={(e) => { e.stopPropagation(); setShowResurface(false) }}>Cancel</button>
            <button className="btn-primary" style={{ padding: '8px 20px', fontSize: 13 }} onClick={handleAddResurface}>Add to Queue</button>
          </div>
        </div>
      )}

      {showCollect && (
        <div
          className="popover"
          style={{ position: 'absolute', inset: 0, padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'center', background: 'rgba(10,10,12,0.92)', backdropFilter: 'blur(10px)', zIndex: 100, borderRadius: 'var(--r-xl)' }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, textAlign: 'center', fontFamily: 'var(--font-serif)' }}>Add to Collection</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '60%', overflowY: 'auto', marginBottom: 12, paddingRight: 4 }}>
            {collections.map(c => (
              <button
                key={c._id}
                className="btn-ghost"
                style={{ textAlign: 'left', justifyContent: 'flex-start', padding: '10px 14px', fontSize: 13, background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 'var(--r)' }}
                onClick={() => handleCollect(c._id)}
              >
                <span style={{ opacity: 0.6, marginRight: 8 }}>○</span> {c.name}
              </button>
            ))}
            {collections.length === 0 && !isCreatingCol && <div style={{ fontSize: 13, color: 'var(--text3)', textAlign: 'center', padding: '20px 0' }}>No collections found.</div>}
          </div>
          
          {!isCreatingCol ? (
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button className="btn-ghost" style={{ padding: '8px 20px', fontSize: 13, border: '1px solid var(--border)' }} onClick={(e) => { e.stopPropagation(); setShowCollect(false) }}>Cancel</button>
              <button className="btn-ghost" style={{ padding: '8px 20px', fontSize: 13, color: 'var(--accent)', border: '1px solid var(--accent-border)' }} onClick={e => { e.stopPropagation(); setIsCreatingCol(true) }}>+ New</button>
            </div>
          ) : (
            <div style={{ marginTop: 4 }} onClick={e => e.stopPropagation()}>
              <input
                autoFocus
                className="search-input"
                style={{ width: '100%', fontSize: 13, padding: '12px', marginBottom: 16, background: 'var(--bg5)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', color: 'var(--text)' }}
                placeholder="Collection name…"
                value={newColName}
                onChange={e => setNewColName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleCreateCol() }}
              />
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <button className="btn-ghost" style={{ fontSize: 13, padding: '8px 20px', border: '1px solid var(--border)' }} onClick={() => setIsCreatingCol(false)}>Cancel</button>
                <button className="btn-primary" style={{ fontSize: 13, padding: '8px 20px' }} onClick={handleCreateCol}>Create</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
