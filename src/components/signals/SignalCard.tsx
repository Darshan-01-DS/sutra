'use client'
// src/components/signals/SignalCard.tsx

import { useState, useCallback, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
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
  const [popoverRect, setPopoverRect] = useState<DOMRect | null>(null)

  // Compute card rect when showing a popover (for portal positioning)
  const openPopover = (which: 'resurface' | 'collect') => {
    const rect = cardRef.current?.getBoundingClientRect() ?? null
    setPopoverRect(rect)
    if (which === 'resurface') { setShowResurface(true); setShowCollect(false) }
    else { setShowCollect(true); setShowResurface(false) }
  }

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // Close if click is not inside any popover or the card
      const target = e.target as Node
      const card = cardRef.current
      const portal = document.getElementById('signal-popover-portal')
      if (!card?.contains(target) && !portal?.contains(target)) {
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
    const rect = cardRef.current?.getBoundingClientRect() ?? null
    setPopoverRect(rect)
    setShowCollect(true)
    setShowResurface(false)
    try {
      const res = await fetch('/api/collections')
      const data = await res.json()
      setCollections(Array.isArray(data) ? data : (data.collections || []))
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
              <span key={tag} className="ctag">#{tag}</span>
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
              onClick={e => { e.stopPropagation(); openPopover('resurface') }}
              title="Add to Resurface"
            >
              ↺
            </button>
          </div>

          {/* Add to Collection */}
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <button
              className="ib"
              onClick={e => { e.stopPropagation(); openCollect() }}
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
      {/* Portaled popovers — rendered outside scroll container to avoid clipping */}
      {(showResurface || showCollect) && popoverRect && typeof document !== 'undefined' && createPortal(
        <div
          id="signal-popover-portal"
          style={{
            position: 'fixed',
            left: popoverRect.left,
            top: Math.max(8, popoverRect.top - (showResurface ? 230 : Math.min(350, 60 + collections.length * 48))),
            width: popoverRect.width,
            zIndex: 9000,
          }}
        >
          {showResurface && (
            <div
              style={{ padding: 16, display: 'flex', flexDirection: 'column', background: 'var(--bg2)', border: '1px solid var(--border2)', backdropFilter: 'blur(12px)', borderRadius: 'var(--r-lg)', boxShadow: '0 12px 40px rgba(0,0,0,0.5)' }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: 'var(--text)' }}>Add to Resurface</div>
              <textarea
                style={{ width: '100%', padding: '10px 12px', fontSize: 12, marginBottom: 12, background: 'var(--bg4)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', minHeight: 70, resize: 'none', color: 'var(--text)', outline: 'none', fontFamily: 'var(--font-body)' }}
                placeholder="What should remind you about this?"
                value={resurfaceNote}
                onChange={e => setResurfaceNote(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddResurface(e as any) } }}
                autoFocus
              />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn-ghost" style={{ height: 32, padding: '0 14px', fontSize: 12 }} onClick={e => { e.stopPropagation(); setShowResurface(false) }}>Cancel</button>
                <button className="btn-primary" style={{ height: 32, padding: '0 14px', fontSize: 12 }} onClick={handleAddResurface}>Add to Queue</button>
              </div>
            </div>
          )}

          {showCollect && (
            <div
              style={{ padding: 16, display: 'flex', flexDirection: 'column', background: 'var(--bg2)', border: '1px solid var(--border2)', backdropFilter: 'blur(12px)', borderRadius: 'var(--r-lg)', boxShadow: '0 12px 40px rgba(0,0,0,0.5)', maxHeight: 320, overflowY: 'auto' }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: 'var(--text)' }}>Add to Collection</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                {collections.map(c => (
                  <button
                    key={c._id}
                    className="btn-ghost"
                    style={{ textAlign: 'left', justifyContent: 'flex-start', padding: '9px 12px', fontSize: 12, background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 'var(--r)' }}
                    onClick={() => handleCollect(c._id)}
                  >
                    <span style={{ opacity: 0.6, marginRight: 8 }}>{c.icon ?? '◈'}</span> {c.name}
                  </button>
                ))}
                {collections.length === 0 && !isCreatingCol && (
                  <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', padding: '12px 0' }}>No collections yet.</div>
                )}
              </div>

              {!isCreatingCol ? (
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button className="btn-ghost" style={{ height: 30, padding: '0 12px', fontSize: 12 }} onClick={e => { e.stopPropagation(); setShowCollect(false) }}>Cancel</button>
                  <button className="btn-ghost" style={{ height: 30, padding: '0 12px', fontSize: 12, color: 'var(--accent)', border: '1px solid var(--accent-border)' }} onClick={e => { e.stopPropagation(); setIsCreatingCol(true) }}>+ New</button>
                </div>
              ) : (
                <div onClick={e => e.stopPropagation()}>
                  <input
                    autoFocus
                    style={{ width: '100%', fontSize: 12, padding: '9px 12px', marginBottom: 10, background: 'var(--bg4)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', color: 'var(--text)', outline: 'none' }}
                    placeholder="Collection name…"
                    value={newColName}
                    onChange={e => setNewColName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleCreateCol() }}
                  />
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button className="btn-ghost" style={{ height: 30, padding: '0 12px', fontSize: 12 }} onClick={() => setIsCreatingCol(false)}>Cancel</button>
                    <button className="btn-primary" style={{ height: 30, padding: '0 12px', fontSize: 12 }} onClick={handleCreateCol}>Create</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  )
}
