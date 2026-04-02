'use client'
// src/components/signals/AddToCollectionModal.tsx — Premium collection picker modal

import { useState, useEffect, useRef, useCallback } from 'react'
import type { Collection } from '@/types'

const EMOJI_OPTIONS = ['📌', '🧠', '🎨', '⚡', '🔖', '💡', '🌱', '🚀', '📚', '🗂️', '🔬', '💼']

interface AddToCollectionModalProps {
  isOpen: boolean
  onClose: () => void
  /** Called with array of selected collectionIds; resolves after API call */
  onSave: (collectionIds: string[]) => Promise<void>
  collections: Collection[]
  /** Called when user creates a new collection inline */
  onCreateCollection: (name: string, emoji: string) => Promise<Collection>
  /** Pre-selected collection IDs (e.g. already assigned to the signal) */
  initialSelected?: string[]
}

export default function AddToCollectionModal({
  isOpen,
  onClose,
  onSave,
  collections,
  onCreateCollection,
  initialSelected = [],
}: AddToCollectionModalProps) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialSelected))
  const [search, setSearch] = useState('')
  const [showNewForm, setShowNewForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [emojiIdx, setEmojiIdx] = useState(0)
  const [saving, setSaving] = useState(false)
  const [creating, setCreating] = useState(false)
  const [localColls, setLocalColls] = useState<Collection[]>(collections)
  const modalRef = useRef<HTMLDivElement>(null)
  const newNameRef = useRef<HTMLInputElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // Sync collections prop
  useEffect(() => { setLocalColls(collections) }, [collections])

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setSelected(new Set(initialSelected))
      setSearch('')
      setShowNewForm(false)
      setNewName('')
      setEmojiIdx(0)
      setTimeout(() => searchRef.current?.focus(), 60)
    }
  }, [isOpen]) // eslint-disable-line

  useEffect(() => {
    if (showNewForm) setTimeout(() => newNameRef.current?.focus(), 50)
  }, [showNewForm])

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) onClose()
    }
    if (isOpen) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isOpen, onClose])

  // Close on Escape
  useEffect(() => {
    function handler(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    if (isOpen) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  const filtered = localColls.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleSave() {
    if (!selected.size || saving) return
    setSaving(true)
    try {
      await onSave(Array.from(selected))
      onClose()
    } finally {
      setSaving(false)
    }
  }

  async function handleCreate() {
    const name = newName.trim()
    if (!name || creating) return
    setCreating(true)
    try {
      const created = await onCreateCollection(name, EMOJI_OPTIONS[emojiIdx])
      setLocalColls(prev => [...prev, created])
      setSelected(prev => new Set(Array.from(prev).concat([created._id])))
      setNewName('')
      setEmojiIdx(0)
      setShowNewForm(false)
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to create collection')
    } finally {
      setCreating(false)
    }
  }

  if (!isOpen) return null

  const btnBase: React.CSSProperties = {
    cursor: 'pointer', fontFamily: 'inherit', border: 'none',
    padding: 0, background: 'none',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
    }}>
      <div
        ref={modalRef}
        style={{
          width: '300px', background: '#1a1b1d',
          border: '0.5px solid rgba(255,255,255,0.12)',
          borderRadius: '12px', overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
          display: 'flex', flexDirection: 'column',
          animation: 'sutra-modal-in .2s cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        {/* Header */}
        <div style={{ padding: '14px 14px 12px', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.82)' }}>
              Add to Collection
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {selected.size > 0 && (
                <span style={{
                  fontSize: '11px', color: 'rgba(200,169,110,0.75)',
                  background: 'rgba(200,169,110,0.1)', borderRadius: '4px', padding: '2px 7px',
                }}>
                  {selected.size} selected
                </span>
              )}
              <button
                onClick={onClose}
                style={{ ...btnBase, width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 5, color: 'rgba(255,255,255,0.3)', fontSize: 14, background: 'rgba(255,255,255,0.04)', cursor: 'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'rgba(255,255,255,0.3)' }}
              >✕</button>
            </div>
          </div>

          {/* Search */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.08)',
            borderRadius: '7px', padding: '6px 10px',
          }}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="1.6">
              <circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5L13 13" />
            </svg>
            <input
              ref={searchRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search collections..."
              style={{
                background: 'transparent', border: 'none', outline: 'none',
                fontSize: '12px', fontFamily: 'inherit',
                color: 'rgba(255,255,255,0.65)', width: '100%',
              }}
            />
          </div>
        </div>

        {/* Collection list */}
        <div style={{
          maxHeight: '220px', overflowY: 'auto', padding: '6px',
          scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent',
        }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '28px 16px', textAlign: 'center', color: 'rgba(255,255,255,0.28)', fontSize: '12.5px' }}>
              {search ? 'No collections match.' : 'No collections yet. Create one below.'}
            </div>
          ) : (
            filtered.map(c => {
              const isSelected = selected.has(c._id)
              return (
                <div
                  key={c._id}
                  onClick={() => toggleSelect(c._id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '8px 10px', borderRadius: '7px', cursor: 'pointer',
                    background: isSelected ? 'rgba(200,169,110,0.08)' : 'transparent',
                    border: isSelected ? '0.5px solid rgba(200,169,110,0.2)' : '0.5px solid transparent',
                    transition: 'background .12s, border-color .12s',
                    marginBottom: 2,
                  }}
                  onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)' }}
                  onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  <span style={{ fontSize: '17px', width: '22px', textAlign: 'center', flexShrink: 0 }}>
                    {(c as any).icon ?? (c as any).emoji ?? '📌'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '12.5px', fontWeight: 500,
                      color: isSelected ? 'rgba(200,169,110,0.9)' : 'rgba(255,255,255,0.7)',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>{c.name}</div>
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', marginTop: '1px' }}>
                      {(c as any).signalCount ?? 0} signal{((c as any).signalCount ?? 0) !== 1 ? 's' : ''}
                    </div>
                  </div>
                  {/* Check circle */}
                  <div style={{
                    width: '16px', height: '16px', borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: isSelected ? 'none' : '0.5px solid rgba(255,255,255,0.18)',
                    background: isSelected ? 'rgba(200,169,110,0.9)' : 'transparent',
                    transition: 'all .15s cubic-bezier(0.34,1.56,0.64,1)',
                    transform: isSelected ? 'scale(1)' : 'scale(0.9)',
                  }}>
                    {isSelected && (
                      <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="#1a1b1d" strokeWidth="2.2">
                        <path d="M2 6l3 3 5-5" />
                      </svg>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* New collection form */}
        {showNewForm && (
          <div style={{
            padding: '10px 12px', borderTop: '0.5px solid rgba(255,255,255,0.07)',
            background: 'rgba(255,255,255,0.02)',
          }}>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => setEmojiIdx(i => (i + 1) % EMOJI_OPTIONS.length)}
                style={{
                  width: '32px', height: '30px',
                  background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.1)',
                  borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '15px', cursor: 'pointer', flexShrink: 0, transition: 'background .15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                title="Click to cycle emoji"
              >
                {EMOJI_OPTIONS[emojiIdx]}
              </button>
              <input
                ref={newNameRef}
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleCreate()
                  if (e.key === 'Escape') setShowNewForm(false)
                }}
                placeholder="Collection name..."
                style={{
                  flex: 1, height: '30px',
                  background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)',
                  borderRadius: '6px', outline: 'none', padding: '0 8px',
                  fontSize: '12px', fontFamily: 'inherit', color: 'rgba(255,255,255,0.75)',
                  transition: 'border-color .15s',
                }}
                onFocus={e => { e.target.style.borderColor = 'rgba(200,169,110,0.4)' }}
                onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)' }}
              />
              <button
                type="button"
                onClick={handleCreate}
                disabled={!newName.trim() || creating}
                style={{
                  padding: '5px 11px', background: '#c8a96e', border: 'none',
                  borderRadius: '6px', fontSize: '11.5px', fontWeight: 500,
                  color: '#1a1b1d', cursor: newName.trim() ? 'pointer' : 'not-allowed',
                  fontFamily: 'inherit', opacity: newName.trim() ? 1 : 0.35,
                  transition: 'opacity .1s, background .1s',
                  flexShrink: 0,
                }}
                onMouseEnter={e => { if (newName.trim()) e.currentTarget.style.background = '#d4b87a' }}
                onMouseLeave={e => { e.currentTarget.style.background = '#c8a96e' }}
              >
                {creating ? '...' : 'Create'}
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{
          padding: '10px 12px', borderTop: '0.5px solid rgba(255,255,255,0.07)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
        }}>
          <button
            type="button"
            onClick={() => setShowNewForm(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              padding: '6px 11px', background: showNewForm ? 'rgba(255,255,255,0.07)' : 'transparent',
              border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: '7px',
              fontSize: '12px', color: showNewForm ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.4)',
              cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)' }}
            onMouseLeave={e => { e.currentTarget.style.background = showNewForm ? 'rgba(255,255,255,0.07)' : 'transparent'; e.currentTarget.style.color = showNewForm ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.4)' }}
          >
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 3v10M3 8h10" />
            </svg>
            New
          </button>

          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '6px 11px', background: 'transparent',
                border: '0.5px solid rgba(255,255,255,0.09)', borderRadius: '7px',
                fontSize: '12px', color: 'rgba(255,255,255,0.4)',
                cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'rgba(255,255,255,0.65)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.4)' }}
            >Cancel</button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!selected.size || saving}
              style={{
                padding: '6px 16px', background: '#c8a96e', border: 'none',
                borderRadius: '7px', fontSize: '12px', fontWeight: 500,
                color: '#1a1b1d', cursor: selected.size ? 'pointer' : 'not-allowed',
                fontFamily: 'inherit', opacity: selected.size ? 1 : 0.35,
                transition: 'opacity .12s, background .12s',
              }}
              onMouseEnter={e => { if (selected.size) e.currentTarget.style.background = '#d4b87a' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#c8a96e' }}
            >
              {saving ? 'Saving...' : 'Save →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
