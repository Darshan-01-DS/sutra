'use client'
// src/components/signals/CollectionsView.tsx — FIXED

import { useState, useEffect } from 'react'
import type { Collection, Signal } from '@/types'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

interface CollectionsViewProps {
  collections: Collection[]
  activeCollectionId: string | null
  onSelectCollection: (id: string) => void
  onOpenDrawer: (id: string) => void
  onRefreshCollections: () => void
}

const COLLECTION_ICONS = ['◈', '◎', '◇', '△', '◻', '⬡', '✦', '❋', '⬘', '▣', '🧠', '📚', '🎯', '⚡']
const COLLECTION_COLORS = ['#C9A96E', '#9B8FF5', '#4ECDC4', '#E8705A', '#6BCB77', '#F7B731', '#A29BFE', '#FD79A8']

export function CollectionsView({
  collections,
  activeCollectionId,
  onSelectCollection,
  onOpenDrawer,
  onRefreshCollections,
}: CollectionsViewProps) {
  const [signals, setSignals] = useState<Signal[]>([])
  const [loadingSignals, setLoadingSignals] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newIcon, setNewIcon] = useState('◈')
  const [newColor, setNewColor] = useState('#C9A96E')
  const [saving, setSaving] = useState(false)
  const [createError, setCreateError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)

  useEffect(() => {
    if (!activeCollectionId) return
    setLoadingSignals(true)
    fetch(`/api/signals?collectionId=${activeCollectionId}&limit=50`)
      .then(r => r.json())
      .then(data => {
        setSignals(Array.isArray(data.data) ? data.data : [])
        setLoadingSignals(false)
      })
      .catch(() => setLoadingSignals(false))
  }, [activeCollectionId])

  const createCollection = async () => {
    const trimmedName = newName.trim()
    if (!trimmedName) { setCreateError('Please enter a collection name'); return }
    setSaving(true)
    setCreateError('')
    try {
      const res = await fetch('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedName, icon: newIcon, color: newColor }),
      })
      const data = await res.json()
      if (!res.ok) {
        setCreateError(data.error || 'Failed to create collection')
        return
      }
      setNewName('')
      setNewIcon('◈')
      setNewColor('#C9A96E')
      setCreating(false)
      await onRefreshCollections()
      // Auto-select the new collection
      if (data._id) onSelectCollection(data._id)
    } catch (e: any) {
      setCreateError(e?.message || 'Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const deleteCollection = async () => {
    if (!deleteTarget) return
    try {
      await fetch(`/api/collections/${deleteTarget.id}`, { method: 'DELETE' })
      setDeleteTarget(null)
      onRefreshCollections()
    } catch { /* silent */ }
  }

  const activeCol = collections.find(c => c._id === activeCollectionId)

  const typeIcons: Record<string, string> = {
    article: '▤', tweet: '𝕏', video: '▶', pdf: '⬚', image: '⊡', note: '✎',
  }
  const typeColors: Record<string, string> = {
    article: 'var(--violet)', tweet: 'var(--teal)', video: 'var(--coral)',
    pdf: 'var(--accent)', image: 'var(--green)', note: 'var(--accent)',
  }

  return (
    <div className="collections-view">
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete collection"
        body={`Remove "${deleteTarget?.name}"? All signals inside will remain safe — only the collection is deleted.`}
        confirmLabel="Delete"
        dangerous
        onConfirm={deleteCollection}
        onCancel={() => setDeleteTarget(null)}
      />

      <div className="cv-header">
        <div>
          <div className="cv-title">◇ Collections</div>
          <div className="cv-sub">{collections.length} collection{collections.length !== 1 ? 's' : ''}</div>
        </div>
        <button className="btn-primary" onClick={() => { setCreating(v => !v); setCreateError('') }}>
          {creating ? 'Cancel' : '+ New Collection'}
        </button>
      </div>

      {creating && (
        <div className="cv-create-form">
          <div className="cv-create-title">New collection</div>
          <input
            className="cv-input"
            placeholder="Collection name…"
            value={newName}
            onChange={e => { setNewName(e.target.value); setCreateError('') }}
            onKeyDown={e => e.key === 'Enter' && createCollection()}
            autoFocus
          />
          {createError && (
            <div style={{ fontSize: 12, color: 'var(--coral)', padding: '6px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>⚠</span> {createError}
            </div>
          )}
          <div className="form-label" style={{ marginTop: 4 }}>Icon</div>
          <div className="cv-icon-row">
            {COLLECTION_ICONS.map(ic => (
              <button
                key={ic}
                className={`cv-icon-btn ${newIcon === ic ? 'on' : ''}`}
                onClick={() => setNewIcon(ic)}
                type="button"
              >{ic}</button>
            ))}
          </div>
          <div className="form-label">Color</div>
          <div className="cv-color-row">
            {COLLECTION_COLORS.map(c => (
              <button
                key={c}
                type="button"
                className={`cv-color-btn ${newColor === c ? 'on' : ''}`}
                style={{ background: c }}
                onClick={() => setNewColor(c)}
              />
            ))}
          </div>
          <button
            className="btn-primary"
            onClick={createCollection}
            disabled={!newName.trim() || saving}
            style={{ marginTop: 8 }}
          >
            {saving ? 'Creating…' : 'Create collection →'}
          </button>
        </div>
      )}

      {/* Collections grid */}
      {collections.length === 0 && !creating ? (
        <div className="cv-empty" style={{ padding: '48px 20px', textAlign: 'center' }}>
          <div className="cv-empty-icon" style={{ fontSize: 40, opacity: 0.2, marginBottom: 16 }}>◇</div>
          <div className="cv-empty-text">No collections yet</div>
          <div className="cv-empty-sub" style={{ marginTop: 8 }}>Create your first collection to organize signals.</div>
          <button className="btn-primary" style={{ marginTop: 16 }} onClick={() => setCreating(true)}>
            + Create collection
          </button>
        </div>
      ) : (
        <div className="cv-grid">
          {collections.map(col => (
            <div
              key={col._id}
              className={`cv-card ${activeCollectionId === col._id ? 'active' : ''}`}
              onClick={() => onSelectCollection(col._id)}
            >
              <div className="cv-card-icon" style={{ background: `${col.color}20`, color: col.color }}>
                {col.icon ?? '◈'}
              </div>
              <div className="cv-card-name">{col.name}</div>
              <div className="cv-card-count">{(col as any).signalCount ?? 0} signals</div>
              <button
                className="cv-card-delete"
                onClick={e => { e.stopPropagation(); setDeleteTarget({ id: col._id, name: col.name }) }}
                title="Delete collection"
              >×</button>
            </div>
          ))}
        </div>
      )}

      {/* Active collection signals */}
      {activeCol && (
        <div className="cv-signals-section">
          <div className="cv-signals-header">
            <div className="cv-signals-label" style={{ color: activeCol.color }}>
              {activeCol.icon} {activeCol.name}
            </div>
            <div className="cv-signals-count">
              {loadingSignals ? '…' : `${signals.length} signals`}
            </div>
          </div>

          {loadingSignals ? (
            <div className="cv-signals-loading">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton" style={{ height: 64, borderRadius: 12, animationDelay: `${i * 0.08}s` }} />
              ))}
            </div>
          ) : signals.length === 0 ? (
            <div className="cv-empty">
              <div className="cv-empty-icon">◇</div>
              <div className="cv-empty-text">No signals in this collection yet.</div>
              <div className="cv-empty-sub">Select signals and use "Collect →" to add them here.</div>
            </div>
          ) : (
            <div className="cv-signals-list">
              {signals.map(s => (
                <div key={s._id} className="cv-signal-item" onClick={() => onOpenDrawer(s._id)}>
                  <div className="cvsi-icon" style={{ color: typeColors[s.type] }}>
                    {typeIcons[s.type] ?? '◈'}
                  </div>
                  <div className="cvsi-body">
                    <div className="cvsi-title">{s.title.slice(0, 70)}</div>
                    <div className="cvsi-tags">
                      {s.tags.slice(0, 4).map(t => (
                        <span key={t} className="cvsi-tag">#{t}</span>
                      ))}
                      <span className="cvsi-type">{s.type}</span>
                    </div>
                  </div>
                  <div className="cvsi-arrow">→</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
