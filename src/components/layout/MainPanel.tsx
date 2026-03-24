'use client'
// src/components/layout/MainPanel.tsx

import { useRef, useEffect, useState, useCallback } from 'react'
import { Signal, ResurfaceItem, SignalType } from '@/types'
import { SignalCard } from '@/components/signals/SignalCard'
import { SignalListItem } from '@/components/signals/SignalListItem'
import { CaptureZone } from '@/components/signals/CaptureZone'
import { ResurfaceBanner } from '@/components/signals/ResurfaceBanner'
import { EmptyState } from '@/components/signals/EmptyState'
import { TagAutocomplete } from '@/components/signals/TagAutocomplete'
import { ResurfaceView } from '@/components/signals/ResurfaceView'
import { CollectionsView } from '@/components/signals/CollectionsView'
import { ConstellationView } from '@/components/signals/ConstellationView'
import type { Collection } from '@/types'

interface MainPanelProps {
  signals: Signal[]
  loading: boolean
  hasMore: boolean
  onLoadMore: () => void
  viewMode: 'grid' | 'list'
  onViewModeChange: (m: 'grid' | 'list') => void
  title: string
  subtitle: string
  onSave: (data: any) => void
  onUploadFile?: (file: File, notes?: string) => Promise<void>
  saving: boolean
  resurface: ResurfaceItem[]
  onRefresh: () => void
  onOpenDrawer: (id: string) => void
  activeCardId: string | null
  selectedIds: Set<string>
  onToggleSelected: (id: string) => void
  emptyType: SignalType | 'all'
  collections: Collection[]
  onBulkDelete: () => void
  onBulkAddTags: (tags: string[]) => void
  onBulkCollect: (collectionId: string) => void
  activeView: 'all' | 'graph' | 'collections' | 'resurface' | 'constellation'
  activeCollectionId: string | null
  onSelectCollection: (id: string) => void
  onRefreshCollections: () => void
  captureRef?: React.RefObject<HTMLTextAreaElement>
  activeType?: SignalType | 'all'
  activeTag?: string | null
  activeTopic?: string | null
  onClearFilter?: (key: 'tag' | 'topic' | 'type' | 'all') => void
}

export function MainPanel({
  signals, loading, hasMore, onLoadMore,
  viewMode, onViewModeChange,
  title, subtitle,
  onSave, onUploadFile, saving,
  resurface, onRefresh,
  onOpenDrawer,
  activeCardId,
  selectedIds,
  onToggleSelected,
  emptyType,
  collections,
  onBulkDelete,
  onBulkAddTags,
  onBulkCollect,
  activeView,
  activeCollectionId,
  onSelectCollection,
  onRefreshCollections,
  captureRef,
  activeType,
  activeTag,
  activeTopic,
  onClearFilter,
}: MainPanelProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const bottomRef = useRef<HTMLDivElement>(null)
  const selectedCount = selectedIds.size

  const [bulkTags, setBulkTags] = useState<string[]>([])
  const [bulkCollectionId, setBulkCollectionId] = useState<string>('')

  useEffect(() => {
    if (selectedCount === 0) setBulkTags([])
    if (!bulkCollectionId && collections.length) setBulkCollectionId(collections[0]._id)
  }, [selectedCount, collections, bulkCollectionId])

  // Infinite scroll
  useEffect(() => {
    const el = bottomRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting && hasMore && !loading) onLoadMore() },
      { threshold: 0.1 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [hasMore, loading, onLoadMore])

  const visibleResuface = resurface.filter(r => !dismissed.has(r.signal._id))

  const Skeletons = () => (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="skeleton" style={{ animationDelay: `${i * 0.08}s` }} />
      ))}
    </>
  )

  // === Specialized views ===
  if (activeView === 'resurface') {
    return (
      <main className="main">
        <div className="content-scroll">
          <ResurfaceView onOpenDrawer={onOpenDrawer} onRefresh={onRefresh} />
        </div>
      </main>
    )
  }

  if (activeView === 'collections') {
    return (
      <main className="main">
        <div className="content-scroll">
          <CollectionsView
            collections={collections}
            activeCollectionId={activeCollectionId}
            onSelectCollection={onSelectCollection}
            onOpenDrawer={onOpenDrawer}
            onRefreshCollections={onRefreshCollections}
          />
        </div>
      </main>
    )
  }

  if (activeView === 'constellation') {
    return (
      <main className="main">
        <div className="content-scroll">
          <ConstellationView onOpenDrawer={onOpenDrawer} onRefresh={onRefresh} />
        </div>
      </main>
    )
  }

  return (
    <main className="main">
      {/* Header */}
      <div className="main-header">
        <div>
          <div className="main-title">{title}</div>
          <div className="main-subtitle">{subtitle}</div>
        </div>
        <div className="view-btns">
          <button className={`vb ${viewMode === 'grid' ? 'on' : ''}`} onClick={() => onViewModeChange('grid')}>Grid</button>
          <button className={`vb ${viewMode === 'list' ? 'on' : ''}`} onClick={() => onViewModeChange('list')}>List</button>
        </div>
      </div>

      {(activeTag || activeTopic || (activeType && activeType !== 'all')) && (
        <div style={{ padding: '8px 22px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '8px', alignItems: 'center', background: 'var(--bg3)' }}>
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>Filtering by:</span>
          {activeTag && (
            <div style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--accent-border)', display: 'flex', gap: 6 }}>
              tag: {activeTag}
              <button style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }} onClick={() => onClearFilter?.('tag')}>×</button>
            </div>
          )}
          {activeTopic && (
            <div style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'var(--teal-bg)', color: 'var(--teal)', border: '1px solid var(--teal-border)', display: 'flex', gap: 6 }}>
              topic: {activeTopic}
              <button style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }} onClick={() => onClearFilter?.('topic')}>×</button>
            </div>
          )}
          {activeType && activeType !== 'all' && (
            <div style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'var(--violet-bg)', color: 'var(--violet)', border: '1px solid var(--violet-border)', display: 'flex', gap: 6 }}>
              type: {activeType}
              <button style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }} onClick={() => onClearFilter?.('type')}>×</button>
            </div>
          )}
          <button
            style={{ fontSize: 11, background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', marginLeft: 8 }}
            onClick={() => onClearFilter?.('all')}
          >
            Clear all
          </button>
        </div>
      )}

      {selectedCount > 0 && (
        <div className="bulk-actions">
          <div className="bulk-count">{selectedCount} selected</div>
          <button className="btn-ghost" onClick={onBulkDelete}>
            Delete selected
          </button>

          <div className="bulk-divider" />

          <div style={{ flex: 1, minWidth: 220 }}>
            <TagAutocomplete tags={bulkTags} onChange={setBulkTags} placeholder="Add tags to selected…" />
          </div>
          <button
            className="btn-primary"
            onClick={() => onBulkAddTags(bulkTags)}
            disabled={bulkTags.length === 0}
          >
            Apply tags →
          </button>

          <div className="bulk-divider" />

          <select
            className="bulk-select"
            value={bulkCollectionId}
            onChange={e => setBulkCollectionId(e.target.value)}
          >
            {collections.map(c => (
              <option key={c._id} value={c._id}>
                {c.icon} {c.name}
              </option>
            ))}
          </select>
          <button
            className="btn-primary"
            onClick={() => bulkCollectionId && onBulkCollect(bulkCollectionId)}
            disabled={!bulkCollectionId}
          >
            Collect →
          </button>
        </div>
      )}

      {/* Capture zone */}
      <CaptureZone onSave={onSave} onUploadFile={onUploadFile} saving={saving} captureRef={captureRef} />

      {/* Scrollable content */}
      <div className="content-scroll">
        {/* Resurface banners */}
        {visibleResuface.map(item => (
          <ResurfaceBanner
            key={item.signal._id}
            item={item}
            onDismiss={() =>
              setDismissed(prev => {
                const next = new Set(prev)
                next.add(item.signal._id)
                return next
              })
            }
          />
        ))}

        {/* Grid or List */}
        {viewMode === 'grid' ? (
          <div className="signals-grid">
            {loading && signals.length === 0
              ? <Skeletons />
              : signals.map(s => (
                  <SignalCard
                    key={s._id}
                    signal={s}
                    onRefresh={onRefresh}
                    onOpenDrawer={onOpenDrawer}
                    isActive={activeCardId === s._id}
                    selected={selectedIds.has(s._id)}
                    onToggleSelected={onToggleSelected}
                  />
                ))
            }
          </div>
        ) : (
          <div className="signals-list">
            {loading && signals.length === 0
              ? Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="skeleton" style={{ height: 56, borderRadius: 'var(--r)' }} />
                ))
              : signals.map(s => (
                  <SignalListItem
                    key={s._id}
                    signal={s}
                    onRefresh={onRefresh}
                    onOpenDrawer={onOpenDrawer}
                    isActive={activeCardId === s._id}
                    selected={selectedIds.has(s._id)}
                    onToggleSelected={onToggleSelected}
                  />
                ))
            }
          </div>
        )}

        {signals.length === 0 && !loading && (
          <div className="empty-state-wrap">
            <EmptyState type={emptyType} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 14, marginBottom: 6 }}>No signals yet</div>
              <div style={{ fontSize: 12 }}>Capture a URL, note, or file above to get started</div>
            </div>
          </div>
        )}

        {/* Load more trigger */}
        <div ref={bottomRef} style={{ height: 1 }} />
        {!loading && signals.length > 0 && !hasMore && (
          <div className="all-caught-up">All caught up ✦</div>
        )}

        {loading && signals.length > 0 && (
          <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text3)', fontSize: 12 }}>
            Loading more…
          </div>
        )}
      </div>
    </main>
  )
}
