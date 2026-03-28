'use client'
// src/components/layout/Topbar.tsx

import { SignalType } from '@/types'

interface TopbarProps {
  onSearchOpen: () => void
  onSave: (data: { url?: string; content?: string; type?: SignalType }) => void
  saving: boolean
  onOpenSettings: () => void
  onOpenExtension: () => void
  onCapture: () => void
}

export function Topbar({ onSearchOpen, saving, onOpenSettings, onOpenExtension, onCapture }: TopbarProps) {
  return (
    <header className="topbar">
      <div className="logo">
        <span className="logo-word">Sutra</span>
        <span className="logo-tag">thinking system</span>
      </div>

      <div className="topbar-divider" />

      <div className="search-wrap">
        <svg className="s-icon" width="14" height="14" viewBox="0 0 16 16" fill="none">
          <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M11.5 11.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <input
          className="search-input"
          type="text"
          placeholder="Search signals, ideas, URLs…"
          readOnly
          onClick={onSearchOpen}
          onFocus={onSearchOpen}
        />
        <span className="search-kbd">⌘K / Ctrl+K</span>
      </div>

      <div className="topbar-actions">
        <button className="btn-ghost" onClick={onOpenExtension}>
          Extension
        </button>
        <button type="button" className="avatar" onClick={onOpenSettings} title="Settings">
          AK
        </button>
      </div>
    </header>
  )
}
