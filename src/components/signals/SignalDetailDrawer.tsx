'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Signal, SignalType } from '@/types'
import { TYPE_CONFIG } from '@/lib/utils'
import { TagAutocomplete } from './TagAutocomplete'

function looksCorruptedContent(text: string): boolean {
  const sample = text.slice(0, 3000)
  const replacementCount = (sample.match(/�/g) ?? []).length
  const binaryHeaderPattern = /(JFIF|Exif|PNG|IHDR|WEBP|RIFF|ftyp|PK\u0003\u0004)/
  const controlCount = (sample.match(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g) ?? []).length
  return binaryHeaderPattern.test(sample) || replacementCount > 12 || controlCount > 8
}

export function SignalDetailDrawer({
  open,
  signal,
  onClose,
  onAfterSave,
  onAfterDelete,
}: {
  open: boolean
  signal: Signal | null
  onClose: () => void
  onAfterSave: (updated: Signal) => void
  onAfterDelete: (deletedId: string) => void
}) {
  const [saving, setSaving] = useState(false)
  const [editedTags, setEditedTags] = useState<string[]>([])
  const [editingContent, setEditingContent] = useState(false)
  const [editedContent, setEditedContent] = useState('')
  const [editedTitle, setEditedTitle] = useState('')
  const [editingTitle, setEditingTitle] = useState(false)
  const [userNotes, setUserNotes] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [noteAdded, setNoteAdded] = useState(false)
  const [collections, setCollections] = useState<Array<{ _id: string; name: string; icon?: string }>>([])
  const [selectedCol, setSelectedCol] = useState('')
  const [addingCol, setAddingCol] = useState(false)
  const [collectErr, setCollectErr] = useState('')

  useEffect(() => {
    setEditedTags(signal?.tags ?? [])
    setEditedContent(signal?.content ?? '')
    setEditedTitle(signal?.title ?? '')
    setEditingContent(false)
    setEditingTitle(false)
    setUserNotes('')
    setNoteAdded(false)
    setSelectedCol('')
    setCollectErr('')

    if (open) {
      fetch('/api/collections')
        .then((response) => response.json())
        .then((data) => {
          const cols = Array.isArray(data) ? data : []
          setCollections(cols)
        })
        .catch(() => setCollections([]))
    }
  }, [signal?._id, open])

  const cfg = useMemo(() => {
    const type = (signal?.type ?? 'article') as SignalType
    return TYPE_CONFIG[type] ?? TYPE_CONFIG.article
  }, [signal?.type])

  const displayedContent = signal?.content ?? ''
  const corruptedContent = displayedContent ? looksCorruptedContent(displayedContent) : false

  const saveTags = async () => {
    if (!signal) return
    setSaving(true)
    try {
      const response = await fetch(`/api/signals/${signal._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: editedTags }),
      })
      if (!response.ok) return
      const updated = (await response.json()) as Signal
      onAfterSave(updated)
    } finally {
      setSaving(false)
    }
  }

  const saveContent = async () => {
    if (!signal) return
    setSaving(true)
    try {
      const response = await fetch(`/api/signals/${signal._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editedContent, title: editedTitle }),
      })
      if (!response.ok) return
      const updated = (await response.json()) as Signal
      onAfterSave(updated)
      setEditingContent(false)
      setEditingTitle(false)
    } finally {
      setSaving(false)
    }
  }

  const saveNote = async () => {
    if (!signal || !userNotes.trim()) return
    setSavingNote(true)
    try {
      const combined = signal.content
        ? `${signal.content}\n\n- Note added -\n${userNotes.trim()}`
        : userNotes.trim()
      const response = await fetch(`/api/signals/${signal._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: combined }),
      })
      if (!response.ok) return
      const updated = (await response.json()) as Signal
      onAfterSave(updated)
      setUserNotes('')
      setNoteAdded(true)
      setTimeout(() => setNoteAdded(false), 2000)
    } finally {
      setSavingNote(false)
    }
  }

  const del = async () => {
    if (!signal) return
    if (!confirm('Delete this signal?')) return
    setSaving(true)
    try {
      const response = await fetch(`/api/signals/${signal._id}`, { method: 'DELETE' })
      if (!response.ok) return
      onAfterDelete(signal._id)
    } finally {
      setSaving(false)
    }
  }

  const handleCollect = async () => {
    if (!signal || !selectedCol) return
    setAddingCol(true)
    setCollectErr('')
    try {
      const response = await fetch('/api/collections/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collectionId: selectedCol, signalIds: [signal._id], mode: 'add' })
      })
      if (!response.ok) {
        const err = await response.json().catch(() => ({})) as { error?: string }
        setCollectErr(err.error || 'Failed to add to collection')
        return
      }
      setSelectedCol('')
      setCollectErr('Added to collection.')
      setTimeout(() => setCollectErr(''), 2000)
    } catch (error) {
      setCollectErr(error instanceof Error ? error.message : 'Network error')
    } finally {
      setAddingCol(false)
    }
  }

  const tagsChanged = editedTags.join(',') !== (signal?.tags ?? []).join(',')

  return (
    <>
      <div className={`drawer-overlay ${open ? 'on' : ''}`} onClick={onClose} aria-hidden={!open} />

      <aside className={`signal-drawer ${open ? 'on' : ''}`} aria-hidden={!open}>
        <div className="drawer-head">
          <div className="drawer-title-row">
            <div className={`type-badge ${cfg.badgeClass}`}>{cfg.label}</div>
            <div className="drawer-head-actions">
              {signal?.url && (
                <button type="button" className="drawer-icon-btn" onClick={() => window.open(signal.url!, '_blank', 'noopener')} title="Open source">↗</button>
              )}
              <button type="button" className="drawer-close" onClick={onClose} aria-label="Close">×</button>
            </div>
          </div>

          {editingTitle ? (
            <div className="drawer-title-edit-row">
              <input
                className="drawer-title-input"
                value={editedTitle}
                onChange={(event) => setEditedTitle(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && void saveContent()}
                autoFocus
              />
              <button className="drawer-edit-save" onClick={() => void saveContent()} disabled={saving}>{saving ? '...' : '✓'}</button>
              <button className="drawer-edit-cancel" onClick={() => { setEditingTitle(false); setEditedTitle(signal?.title ?? '') }}>×</button>
            </div>
          ) : (
            <div className="drawer-main-title-row">
              <div className="drawer-main-title">{signal?.title ?? '-'}</div>
              <button className="drawer-title-edit-btn" onClick={() => setEditingTitle(true)} title="Edit title">✎</button>
            </div>
          )}
        </div>

        <div className="drawer-body">
          {!signal ? (
            <div className="skeleton" style={{ height: 420 }} />
          ) : (
            <>
              <div className="drawer-meta">
                <div className="drawer-meta-line">
                  <span className="drawer-meta-label">Source</span>
                  <span className="drawer-meta-value">{signal.source ?? '-'}</span>
                </div>
                <div className="drawer-meta-line">
                  <span className="drawer-meta-label">Created</span>
                  <span className="drawer-meta-value">{signal.createdAt ? new Date(signal.createdAt).toLocaleDateString() : '-'}</span>
                </div>
                {(signal as Signal & { fileSize?: number }).fileSize && (
                  <div className="drawer-meta-line">
                    <span className="drawer-meta-label">File size</span>
                    <span className="drawer-meta-value">{(((signal as Signal & { fileSize?: number }).fileSize ?? 0) / (1024 * 1024)).toFixed(2)} MB</span>
                  </div>
                )}
              </div>

              {(signal as Signal & { fileUrl?: string }).fileUrl && (
                <div className="drawer-section">
                  <div className="rp-section-label">File preview</div>
                  <div className="drawer-file-preview">
                    {signal.type === 'image' ? (
                      <img
                        src={(signal as Signal & { fileUrl?: string }).fileUrl}
                        alt={signal.title}
                        style={{ width: '100%', borderRadius: 'var(--r)', objectFit: 'contain', maxHeight: 400, background: 'var(--bg3)' }}
                      />
                    ) : signal.type === 'pdf' ? (
                      <a href={(signal as Signal & { fileUrl?: string }).fileUrl} target="_blank" rel="noopener noreferrer" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}>
                        Open PDF ↗
                      </a>
                    ) : (
                      <a href={(signal as Signal & { fileUrl?: string }).fileUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost" style={{ textDecoration: 'none' }}>
                        Download file ↗
                      </a>
                    )}
                  </div>
                </div>
              )}

              <div className="drawer-section">
                <div className="drawer-section-header">
                  <div className="rp-section-label">Full content</div>
                  <button className="drawer-section-edit-btn" onClick={() => setEditingContent((value) => !value)}>
                    {editingContent ? 'Cancel' : '✎ Edit'}
                  </button>
                </div>
                <div className="drawer-content">
                  {editingContent ? (
                    <>
                      <textarea className="drawer-content-textarea" value={editedContent} onChange={(event) => setEditedContent(event.target.value)} rows={8} />
                      <div className="drawer-edit-actions">
                        <button className="btn-primary" onClick={() => void saveContent()} disabled={saving}>
                          {saving ? 'Saving...' : 'Save content ->'}
                        </button>
                      </div>
                    </>
                  ) : corruptedContent ? (
                    <div className="drawer-empty-content">Stored content looks corrupted or binary. Re-save this item after the latest fix and Sutra will store clean text only.</div>
                  ) : signal.content ? (
                    <pre className="drawer-pre">{signal.content}</pre>
                  ) : (
                    <div className="drawer-empty-content">No text content captured for this signal.</div>
                  )}
                </div>
              </div>

              <div className="drawer-section">
                <div className="rp-section-label">Add a note</div>
                <textarea className="drawer-note-textarea" placeholder="Add your own thoughts, highlights, or annotations..." value={userNotes} onChange={(event) => setUserNotes(event.target.value)} rows={3} />
                <div className="drawer-note-actions">
                  {noteAdded && <span className="drawer-note-saved">Note saved.</span>}
                  <button className="btn-primary" onClick={() => void saveNote()} disabled={savingNote || !userNotes.trim()} style={{ marginLeft: 'auto' }}>
                    {savingNote ? 'Saving...' : 'Append note ->'}
                  </button>
                </div>
              </div>

              <div className="drawer-section">
                <div className="rp-section-label">Tags</div>
                <TagAutocomplete tags={editedTags} onChange={setEditedTags} />
                <div className="drawer-save-row">
                  <button type="button" className="btn-ghost" onClick={() => setEditedTags(signal.tags)}>Reset</button>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                    <button type="button" className="btn-ghost" onClick={() => void del()} disabled={saving}>Delete</button>
                    <button type="button" className="btn-primary" onClick={() => void saveTags()} disabled={saving || !tagsChanged}>
                      {saving ? 'Saving...' : 'Save tags ->'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="drawer-section">
                <div className="rp-section-label">Add to Collection</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <select className="search-input" style={{ flex: 1, paddingLeft: 10, background: 'var(--bg3)' }} value={selectedCol} onChange={(event) => { setSelectedCol(event.target.value); setCollectErr('') }}>
                    <option value="">Select a collection...</option>
                    {collections.map((collection) => (
                      <option key={collection._id} value={collection._id}>{collection.icon ?? '•'} {collection.name}</option>
                    ))}
                  </select>
                  <button className="btn-primary" disabled={!selectedCol || addingCol} onClick={() => void handleCollect()}>
                    {addingCol ? 'Adding...' : 'Add ->'}
                  </button>
                </div>
                {collectErr && (
                  <div style={{
                    fontSize: 12,
                    marginTop: 6,
                    padding: '6px 10px',
                    borderRadius: 6,
                    color: collectErr === 'Added to collection.' ? 'var(--accent)' : 'var(--coral)',
                    background: collectErr === 'Added to collection.' ? 'var(--accent-bg)' : 'var(--coral-bg)',
                    border: `1px solid ${collectErr === 'Added to collection.' ? 'var(--accent-border)' : 'var(--coral-border)'}`,
                  }}>{collectErr}</div>
                )}
              </div>
            </>
          )}
        </div>
      </aside>
    </>
  )
}