'use client'
// src/components/signals/SignalListItem.tsx

import { Signal } from '@/types'
import { TYPE_CONFIG, timeAgo } from '@/lib/utils'

export function SignalListItem({
  signal,
  onRefresh,
  onOpenDrawer,
  isActive,
  selected,
  onToggleSelected,
}: {
  signal: Signal
  onRefresh: () => void
  onOpenDrawer: (id: string) => void
  isActive: boolean
  selected: boolean
  onToggleSelected: (id: string) => void
}) {
  const cfg = TYPE_CONFIG[signal.type] ?? TYPE_CONFIG.article

  return (
    <div
      className={`signal-list-item ${isActive ? 'card-active' : ''}`}
      onClick={() => onOpenDrawer(signal._id)}
    >
      {signal.source && (
        <div className="url-hover-preview url-hover-preview-list" aria-hidden="true">
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
        style={{ top: 10, right: 10, position: 'absolute' }}
      >
        ✓
      </button>

      <div className={`list-thumb ${cfg.thumbClass}`} style={{ background: `${cfg.color}18`, color: cfg.color, borderRadius: 8 }}>
        {cfg.icon}
      </div>
      <span className={`type-badge ${cfg.badgeClass}`} style={{ position: 'static', flexShrink: 0 }}>{cfg.label}</span>
      <div className="list-title">{signal.title}</div>
      {signal.tags.slice(0, 2).map(t => (
        <span key={t} className="ctag" style={{ flexShrink: 0 }}>#{t}</span>
      ))}
      <div className="list-meta">{timeAgo(signal.createdAt)}</div>
      <button
        className="ib"
        onClick={async e => {
          e.stopPropagation()
          if (!confirm('Delete?')) return
          await fetch(`/api/signals/${signal._id}`, { method: 'DELETE' })
          onRefresh()
        }}
      >✕</button>
    </div>
  )
}
