'use client'
// src/components/layout/Topbar.tsx — UPDATED with ExtensionModal

import { useState } from 'react'
import { SignalType } from '@/types'
import { ExtensionModal } from '@/components/ui/ExtensionModal'

interface TopbarProps {
  onSearchOpen: () => void
  onSave: (data: { url?: string; content?: string; type?: SignalType }) => void
  saving: boolean
  onOpenSettings: () => void
  onOpenExtension: () => void
  onCapture: () => void
}

export function Topbar({ onSearchOpen, saving, onOpenSettings, onOpenExtension, onCapture }: TopbarProps) {
  const [extensionModalOpen, setExtensionModalOpen] = useState(false)

  return (
    <>
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
          <button
            className="btn-ghost"
            onClick={() => setExtensionModalOpen(true)}
            title="Download Sutra Chrome Extension"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <path d="M8 2C4.69 2 2 4.69 2 8s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6z" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M8 5v5M5.5 7.5L8 10l2.5-2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Extension
          </button>
          <button
            type="button"
            className="avatar"
            onClick={onOpenSettings}
            title="Account Settings"
          >
            AK
          </button>
        </div>
      </header>

      <ExtensionModal
        open={extensionModalOpen}
        onClose={() => setExtensionModalOpen(false)}
      />
    </>
  )
}
