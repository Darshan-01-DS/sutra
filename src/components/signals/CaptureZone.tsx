'use client'
// src/components/signals/CaptureZone.tsx

import { useState, useRef, useCallback } from 'react'
import { SignalType } from '@/types'

const TYPE_TABS: { label: string; value: SignalType | 'auto' }[] = [
  { label: 'Auto',    value: 'auto' },
  { label: 'Article', value: 'article' },
  { label: 'Note',    value: 'note' },
  { label: 'Video',   value: 'video' },
]

interface CaptureZoneProps {
  onSave: (data: { url?: string; content?: string; title?: string; type?: SignalType }) => void
  onUploadFile?: (file: File, notes?: string) => Promise<void>
  saving: boolean
  captureRef?: React.RefObject<HTMLTextAreaElement>
}

export function CaptureZone({ onSave, onUploadFile, saving, captureRef }: CaptureZoneProps) {
  const [text, setText]         = useState('')
  const [urlOpen, setUrlOpen]   = useState(false)
  const [url, setUrl]           = useState('')
  const [focused, setFocused]   = useState(false)
  const [typeTab, setTypeTab]   = useState<SignalType | 'auto'>('auto')
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')

  // File upload with notes
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [fileNotes, setFileNotes]     = useState('')

  const localTextareaRef = useRef<HTMLTextAreaElement>(null)
  const textareaRef = captureRef ?? localTextareaRef
  const urlRef      = useRef<HTMLInputElement>(null)

  const handleSend = useCallback(() => {
    const trimUrl  = url.trim()
    const trimText = text.trim()
    if (!trimUrl && !trimText) return

    const payload: any = {}
    if (trimUrl)  payload.url     = trimUrl
    if (trimText && !trimUrl) payload.content = trimText
    if (typeTab !== 'auto') payload.type = typeTab

    onSave(payload)
    setText('')
    setUrl('')
    setUrlOpen(false)
  }, [url, text, typeTab, onSave])

  const confirmUpload = useCallback(async () => {
    if (!pendingFile || !onUploadFile) return
    setUploading(true)
    setUploadProgress(`Uploading ${pendingFile.name}…`)
    try {
      await onUploadFile(pendingFile, fileNotes.trim())
      setPendingFile(null)
      setFileNotes('')
      setUploadProgress('')
    } catch (err: any) {
      setUploadProgress('')
      console.error('Upload failed:', err)
    } finally {
      setUploading(false)
    }
  }, [pendingFile, fileNotes, onUploadFile])

  const handleFileSelected = useCallback((file: File) => {
    if (!onUploadFile) {
      onSave({
        content: `File: ${file.name}`,
        title: file.name,
        type: file.type.includes('pdf') ? 'pdf' : file.type.includes('image') ? 'image' : 'note',
      })
      return
    }
    if (file.size > 25 * 1024 * 1024) {
      alert('File too large. Max 25MB.')
      return
    }
    setPendingFile(file)
    setFileNotes('')
  }, [onSave, onUploadFile])

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData.items
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.kind === 'file') {
        e.preventDefault()
        const file = item.getAsFile()
        if (file) handleFileSelected(file)
        return
      }
    }

    const pasted = e.clipboardData.getData('text')
    if (/^https?:\/\//.test(pasted.trim())) {
      e.preventDefault()
      setUrl(pasted.trim())
      setUrlOpen(true)
      setText('')
      setTimeout(() => urlRef.current?.focus(), 50)
    }
  }, [handleFileSelected])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) {
      handleFileSelected(file)
      return
    }
    const droppedUrl = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain')
    if (droppedUrl && /^https?:\/\//.test(droppedUrl)) {
      setUrl(droppedUrl)
      setUrlOpen(true)
    }
  }, [handleFileSelected])

  const toggleUrl = () => {
    setUrlOpen(prev => !prev)
    if (!urlOpen) setTimeout(() => urlRef.current?.focus(), 50)
  }

  const isBusy = saving || uploading

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

      {/* Pending file upload with notes */}
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
            placeholder="Add notes about this file (optional)… e.g. 'Chapter 3 of nanoparticles textbook'"
            value={fileNotes}
            onChange={e => setFileNotes(e.target.value)}
            rows={2}
          />
          <div className="upp-actions">
            <button className="btn-ghost" onClick={() => setPendingFile(null)}>Cancel</button>
            <button className="btn-primary" onClick={confirmUpload} disabled={uploading}>
              {uploading ? 'Uploading…' : `Upload ${pendingFile.name.slice(0, 20)} →`}
            </button>
          </div>
        </div>
      )}

      {uploadProgress && !pendingFile && (
        <div className="upload-progress-bar">
          <div className="upload-progress-pulse" />
          <span>{uploadProgress}</span>
        </div>
      )}

      {urlOpen && (
        <div className="url-inline-row">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ color: 'var(--text3)', flexShrink: 0 }}>
            <path d="M7 9a3.5 3.5 0 005 0l2-2a3.5 3.5 0 00-5-5L7.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M9 7a3.5 3.5 0 00-5 0L2 9a3.5 3.5 0 005 5L8.5 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
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
            <button
              onClick={() => { setUrl(''); setUrlOpen(false) }}
              style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: '0 6px', fontSize: 16 }}
            >×</button>
          )}
        </div>
      )}

      <div className="capture-footer">
        <label className="upload-btn" title="Upload a file">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <path d="M8 10V2M5 5l3-3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 11v2a1 1 0 001 1h10a1 1 0 001-1v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          {uploading ? 'Uploading…' : 'Upload file'}
          <input
            type="file"
            multiple={false}
            accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.mp4,.webm,.txt,.md"
            disabled={isBusy}
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) handleFileSelected(file)
              e.target.value = ''
            }}
          />
        </label>

        <button className={`url-btn ${urlOpen ? 'active' : ''}`} onClick={toggleUrl}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <path d="M7 9a3.5 3.5 0 005 0l2-2a3.5 3.5 0 00-5-5L7.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          URL
        </button>

        <div className="type-tabs">
          {TYPE_TABS.map(t => (
            <button
              key={t.value}
              className={`tt ${typeTab === t.value ? 'on' : ''}`}
              onClick={() => setTypeTab(t.value)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <button
          className="capture-send"
          onClick={handleSend}
          disabled={isBusy || (!text.trim() && !url.trim())}
        >
          {isBusy ? (uploading ? 'Uploading…' : 'Saving…') : 'Save signal'}
          {!isBusy && (
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <path d="M2 10L10 2M10 2H4M10 2v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}
