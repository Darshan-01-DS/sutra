'use client'
// src/components/signals/CaptureZone.tsx — Premium redesign with TagsInput + Collection modal

import { useState, useRef, useCallback } from 'react'
import { SignalType } from '@/types'
import type { Collection } from '@/types'
import TagsInput from './TagsInput'
import AddToCollectionModal from './AddToCollectionModal'

const TYPE_TABS: { label: string; value: SignalType | 'auto' }[] = [
  { label: 'Auto',    value: 'auto' },
  { label: 'Article', value: 'article' },
  { label: 'Note',    value: 'note' },
  { label: 'Video',   value: 'video' },
]

interface CaptureZoneProps {
  onSave: (data: {
    url?: string; content?: string; title?: string; type?: SignalType
    tags?: string[]; collectionIds?: string[]
  }) => void
  onUploadFile?: (file: File, notes?: string, tags?: string[], collectionIds?: string[]) => Promise<void>
  saving: boolean
  captureRef?: React.RefObject<HTMLTextAreaElement>
  collections?: Collection[]
  onCreateCollection?: (name: string, emoji: string) => Promise<Collection>
}

export function CaptureZone({ onSave, onUploadFile, saving, captureRef, collections = [], onCreateCollection }: CaptureZoneProps) {
  const [text, setText]         = useState('')
  const [urlOpen, setUrlOpen]   = useState(false)
  const [url, setUrl]           = useState('')
  const [focused, setFocused]   = useState(false)
  const [typeTab, setTypeTab]   = useState<SignalType | 'auto'>('auto')
  const [dragOver, setDragOver] = useState(false)
  const [tags, setTags]         = useState<string[]>([])
  const [collectionIds, setCollectionIds] = useState<string[]>([])
  const [collModalOpen, setCollModalOpen] = useState(false)

  // File upload
  const [pendingFile, setPendingFile]         = useState<File | null>(null)
  const [fileNotes, setFileNotes]             = useState('')
  const [uploadProgress, setUploadProgress]   = useState(0)
  const [uploadStatus, setUploadStatus]       = useState<'idle' | 'uploading' | 'done' | 'error'>('idle')
  const [uploadMsg, setUploadMsg]             = useState('')

  const localTextareaRef = useRef<HTMLTextAreaElement>(null)
  const textareaRef = captureRef ?? localTextareaRef
  const urlRef = useRef<HTMLInputElement>(null)

  const handleSend = useCallback(() => {
    const trimUrl  = url.trim()
    const trimText = text.trim()
    if (!trimUrl && !trimText) return

    const payload: any = {}
    if (trimUrl)              payload.url     = trimUrl
    if (trimText && !trimUrl) payload.content = trimText
    if (typeTab !== 'auto')   payload.type    = typeTab
    if (tags.length)          payload.tags    = tags.map(t => t.replace(/^#/, ''))
    if (collectionIds.length) payload.collectionIds = collectionIds

    onSave(payload)
    setText(''); setUrl(''); setUrlOpen(false); setTags([]); setCollectionIds([])
  }, [url, text, typeTab, tags, collectionIds, onSave])

  // Direct ImageKit upload
  const doDirectUpload = useCallback(async (file: File): Promise<string | null> => {
    try {
      const authRes = await fetch('/api/imagekit/auth')
      if (!authRes.ok) return null
      const { token, expire, signature, publicKey } = await authRes.json()
      return await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        const fd = new FormData()
        fd.append('file', file)
        fd.append('publicKey', publicKey)
        fd.append('signature', signature)
        fd.append('expire', String(expire))
        fd.append('token', token)
        fd.append('fileName', file.name)
        fd.append('folder', '/sutra')
        xhr.upload.onprogress = (e) => { if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100)) }
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) { resolve(JSON.parse(xhr.responseText).url) }
          else reject(new Error('ImageKit upload failed'))
        }
        xhr.onerror = () => reject(new Error('Network error'))
        xhr.open('POST', 'https://upload.imagekit.io/api/v1/files/upload')
        xhr.send(fd)
      })
    } catch { return null }
  }, [])

  const confirmUpload = useCallback(async () => {
    if (!pendingFile) return
    if (pendingFile.size > 20 * 1024 * 1024) { setUploadMsg('File exceeds 20MB limit'); setUploadStatus('error'); return }
    setUploadStatus('uploading'); setUploadProgress(0); setUploadMsg(`Uploading ${pendingFile.name}…`)
    try {
      const normalizedTags = tags.map(t => t.replace(/^#/, ''))
      const directUrl = await doDirectUpload(pendingFile)
      if (directUrl) {
        await onSave({
          url: directUrl, title: pendingFile.name,
          type: pendingFile.type.includes('pdf') ? 'pdf' : pendingFile.type.includes('image') ? 'image' : 'note',
          content: fileNotes.trim() || undefined, tags: normalizedTags, collectionIds,
        })
      } else if (onUploadFile) {
        await onUploadFile(pendingFile, fileNotes.trim() || undefined, normalizedTags, collectionIds)
      }
      setUploadStatus('done'); setUploadMsg(`${pendingFile.name} uploaded ✦`)
      setPendingFile(null); setFileNotes(''); setTags([]); setCollectionIds([])
      setTimeout(() => { setUploadStatus('idle'); setUploadMsg('') }, 2000)
    } catch (err: any) {
      setUploadStatus('error'); setUploadMsg(err?.message ?? 'Upload failed')
      setTimeout(() => { setUploadStatus('idle'); setUploadMsg('') }, 3000)
    }
  }, [pendingFile, fileNotes, tags, collectionIds, onSave, onUploadFile, doDirectUpload])

  const handleFileSelected = useCallback((file: File) => {
    if (file.size > 20 * 1024 * 1024) {
      setUploadStatus('error'); setUploadMsg('File is too large. Maximum size is 20MB.')
      setTimeout(() => { setUploadStatus('idle'); setUploadMsg('') }, 3000); return
    }
    setPendingFile(file); setFileNotes(''); setUploadStatus('idle'); setUploadProgress(0)
  }, [])

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData.items
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === 'file') {
        e.preventDefault()
        const file = items[i].getAsFile()
        if (file) handleFileSelected(file)
        return
      }
    }
    const pasted = e.clipboardData.getData('text')
    if (/^https?:\/\//.test(pasted.trim())) {
      e.preventDefault(); setUrl(pasted.trim()); setUrlOpen(true); setText('')
      setTimeout(() => urlRef.current?.focus(), 50)
    }
  }, [handleFileSelected])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }, [handleSend])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) { handleFileSelected(file); return }
    const droppedUrl = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain')
    if (droppedUrl && /^https?:\/\//.test(droppedUrl)) { setUrl(droppedUrl); setUrlOpen(true) }
  }, [handleFileSelected])

  const isBusy = saving || uploadStatus === 'uploading'

  // Collection button label
  const selectedCollNames = collectionIds.map(id => {
    const c = collections.find(c => c._id === id)
    return c?.name ?? ''
  }).filter(Boolean)

  const handleCollSave = useCallback(async (ids: string[]) => {
    setCollectionIds(ids)
  }, [])

  const handleCreateCollection = useCallback(async (name: string, emoji: string): Promise<Collection> => {
    if (onCreateCollection) return onCreateCollection(name, emoji)
    // Fallback: create via API directly
    const res = await fetch('/api/collections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, icon: emoji, color: '#C9A96E' }),
    })
    const data = await res.json()
    return data
  }, [onCreateCollection])

  return (
    <div
      className={`capture-zone ${focused ? 'focused' : ''} ${dragOver ? 'focused' : ''}`}
      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <textarea
        ref={textareaRef as any}
        className="capture-textarea"
        placeholder={dragOver ? 'Drop to upload…' : 'Capture a signal… paste a URL, drop a thought, or upload a file'}
        value={text}
        onChange={e => setText(e.target.value)}
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        rows={3}
      />

      {/* Tags row — new premium component */}
      <TagsInput tags={tags} onChange={setTags} placeholder="Add tags..." />

      {/* Pending file panel */}
      {pendingFile && (
        <div className="upload-pending-panel">
          <div className="upp-file-info">
            <span className="upp-icon">📎</span>
            <div>
              <div className="upp-filename">{pendingFile.name}</div>
              <div className="upp-size">{(pendingFile.size / 1024).toFixed(1)} KB</div>
            </div>
            <button className="upp-remove" onClick={() => setPendingFile(null)}>×</button>
          </div>
          <textarea
            className="upp-notes"
            placeholder="Add notes about this file (optional)…"
            value={fileNotes}
            onChange={e => setFileNotes(e.target.value)}
            rows={2}
          />
          {uploadStatus === 'uploading' && (
            <div className="upload-progress-track">
              <div className="upload-progress-fill" style={{ width: `${uploadProgress}%` }} />
            </div>
          )}
          <div className="upp-actions">
            <button className="btn-ghost" onClick={() => setPendingFile(null)}>Cancel</button>
            <button className="btn-primary" onClick={confirmUpload} disabled={isBusy}>
              {uploadStatus === 'uploading' ? `Uploading… ${uploadProgress}%` : `Upload ${pendingFile.name.slice(0, 20)} →`}
            </button>
          </div>
        </div>
      )}

      {/* Upload status */}
      {uploadMsg && !pendingFile && (
        <div className={`upload-status-msg ${uploadStatus}`}>
          {uploadStatus === 'uploading' && (
            <div className="upload-progress-track" style={{ marginBottom: 4 }}>
              <div className="upload-progress-fill" style={{ width: `${uploadProgress}%` }} />
            </div>
          )}
          <span>{uploadMsg}</span>
        </div>
      )}

      {/* URL row */}
      {urlOpen && (
        <div className="url-inline-row">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ color: 'var(--text3)', flexShrink: 0 }}>
            <path d="M7 9a3.5 3.5 0 005 0l2-2a3.5 3.5 0 00-5-5L7.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input
            ref={urlRef}
            className="url-inline-input"
            type="url"
            placeholder="https://…"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
          />
          {url && (
            <button onClick={() => { setUrl(''); setUrlOpen(false) }} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: '0 6px', fontSize: 16 }}>×</button>
          )}
        </div>
      )}

      {/* Footer bar */}
      <div className="capture-footer">
        {/* Upload */}
        <label className="upload-btn" title="Upload a file (max 20MB)">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <path d="M8 10V2M5 5l3-3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 11v2a1 1 0 001 1h10a1 1 0 001-1v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          Upload file
          <input type="file" multiple={false} accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.mp4,.webm,.txt,.md" disabled={isBusy}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelected(f); e.target.value = '' }} />
        </label>

        {/* URL */}
        <button className={`url-btn ${urlOpen ? 'active' : ''}`} onClick={() => { setUrlOpen(p => !p); if (!urlOpen) setTimeout(() => urlRef.current?.focus(), 50) }}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <path d="M7 9a3.5 3.5 0 005 0l2-2a3.5 3.5 0 00-5-5L7.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          URL
        </button>

        {/* Collection button — opens modal */}
        <button
          type="button"
          className={`url-btn ${collectionIds.length > 0 ? 'active' : ''}`}
          onClick={() => setCollModalOpen(true)}
          title="Add to collection"
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
            <path d="M1 3.5A1.5 1.5 0 012.5 2h3.086a1.5 1.5 0 011.06.44l.915.914A1.5 1.5 0 008.621 4H13.5A1.5 1.5 0 0115 5.5v8a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 011 13.5v-10z" stroke="currentColor" strokeWidth="1.4"/>
          </svg>
          {collectionIds.length > 0
            ? selectedCollNames.length === 1
              ? selectedCollNames[0].slice(0, 14)
              : `${collectionIds.length} collections`
            : 'Collection'}
          {collectionIds.length > 0 && (
            <span style={{ background: 'var(--accent)', color: '#0a0a0a', borderRadius: 10, fontSize: 9, fontWeight: 600, padding: '1px 5px', marginLeft: 2 }}>
              {collectionIds.length}
            </span>
          )}
        </button>

        {/* Type tabs */}
        <div className="type-tabs">
          {TYPE_TABS.map(t => (
            <button key={t.value} className={`tt ${typeTab === t.value ? 'on' : ''}`} onClick={() => setTypeTab(t.value)}>{t.label}</button>
          ))}
        </div>

        {/* Save */}
        <button className="capture-send" onClick={handleSend} disabled={isBusy || (!text.trim() && !url.trim())}>
          {saving ? 'Saving…' : 'Save signal'}
          {!isBusy && (
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <path d="M2 10L10 2M10 2H4M10 2v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>
      </div>

      {/* Add to Collection Modal */}
      <AddToCollectionModal
        isOpen={collModalOpen}
        onClose={() => setCollModalOpen(false)}
        onSave={handleCollSave}
        collections={collections}
        onCreateCollection={handleCreateCollection}
        initialSelected={collectionIds}
      />
    </div>
  )
}
