'use client'
// src/components/layout/Sidebar.tsx

import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import type { Collection, SignalType, StatsData } from '@/types'

interface SidebarProps {
  activeType: SignalType | 'all'
  activeTag: string | null
  activeView: string
  stats: StatsData | null
  onNavType: (type: SignalType | 'all') => void
  onNavView: (view: any) => void
  onNavTag: (tag: string) => void
  collections: Collection[]
  activeCollectionId: string | null
  onSelectCollection: (id: string) => void
  onRefreshCollections: () => void
}

const TYPE_NAVS: { type: SignalType; label: string; icon: string; color: string }[] = [
  { type: 'article', label: 'Articles', icon: '▤', color: 'var(--violet)' },
  { type: 'tweet',   label: 'Tweets',   icon: '𝕏', color: 'var(--teal)' },
  { type: 'video',   label: 'Videos',   icon: '▶', color: 'var(--coral)' },
  { type: 'pdf',     label: 'PDFs',     icon: '⬚', color: 'var(--accent)' },
  { type: 'image',   label: 'Images',   icon: '⊡', color: 'var(--green)' },
  { type: 'note',    label: 'Notes',    icon: '✎', color: 'var(--accent)' },
]

function getTagColorClass(tag: string): string {
  const colors = ['tp-vio', 'tp-teal', 'tp-coral', 'tp-gold', 'tp-grn']
  const hash = tag.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return colors[hash % colors.length]
}

export function Sidebar({
  activeType, activeTag, activeView, stats,
  onNavType, onNavView, onNavTag,
  collections,
  activeCollectionId,
  onSelectCollection,
  onRefreshCollections,
}: SidebarProps) {
  const byType = stats?.byType ?? {}
  const [tagSearch, setTagSearch] = useState('')

  const ids = useMemo(() => collections.map(c => c._id), [collections])

  const allTopics = stats?.topics ?? []
  const filteredTopics = tagSearch.trim()
    ? allTopics.filter(t => t.name.toLowerCase().includes(tagSearch.toLowerCase()))
    : allTopics

  const handleDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e
    if (!over) return
    const activeId = String(active.id)
    const overId = String(over.id)
    if (activeId === overId) return

    const oldIndex = ids.indexOf(activeId)
    const newIndex = ids.indexOf(overId)
    if (oldIndex < 0 || newIndex < 0) return

    const orderedIds = arrayMove(ids, oldIndex, newIndex)
    await fetch('/api/collections/reorder', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderedIds }),
    }).catch(() => null)
    onRefreshCollections()
  }

  const handleDeleteCollection = async (id: string, name: string) => {
    if (!confirm(`Delete collection "${name}"? Signals will remain in your library.`)) return
    await fetch(`/api/collections/${id}`, { method: 'DELETE' }).catch(() => null)
    onRefreshCollections()
  }

  function SortableCollectionItem({ collection }: { collection: Collection }) {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: collection._id })

    const style: CSSProperties = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.6 : 1,
    }

    return (
      <div
        ref={setNodeRef}
        className={`collection-item ${activeCollectionId === collection._id && activeView === 'collections' ? 'on' : ''}`}
        style={style}
        onClick={() => onSelectCollection(collection._id)}
      >
        <button
          type="button"
          className="collection-drag"
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
          onClick={e => e.stopPropagation()}
        >
          ⠿
        </button>

        <div className="collection-icon" style={{ background: `${collection.color}18`, color: collection.color }}>
          {collection.icon ?? '◈'}
        </div>
        <div className="collection-name">{collection.name}</div>
        <div className="collection-count">{(collection as any).signalCount ?? 0}</div>
        <button
          className="collection-delete-btn"
          aria-label="Delete collection"
          title="Delete collection"
          onClick={e => {
            e.stopPropagation()
            handleDeleteCollection(collection._id, collection.name)
          }}
        >×</button>
      </div>
    )
  }

  return (
    <nav className="sidebar">
      <div className="sidebar-label">Library</div>

      <div
        className={`nav-item ${activeType === 'all' && activeView === 'all' ? 'active' : ''}`}
        onClick={() => { onNavType('all'); onNavView('all') }}
      >
        <span className="ni-icon">◈</span>
        All signals
        <span className="ni-badge">{stats?.total ?? 0}</span>
      </div>

      <div
        className={`nav-item ${activeView === 'graph' ? 'active' : ''}`}
        onClick={() => onNavView('graph')}
      >
        <span className="ni-icon">◎</span>
        Graph view
      </div>

      <div
        className={`nav-item ${activeView === 'resurface' ? 'active' : ''}`}
        onClick={() => onNavView('resurface')}
      >
        <span className="ni-icon">↺</span>
        Resurface
        {(stats?.resurface?.length ?? 0) > 0 && (
          <span className="ni-badge" style={{ background: 'var(--coral)', color: '#fff' }}>
            {stats!.resurface!.length}
          </span>
        )}
      </div>

      <div
        className={`nav-item ${activeView === 'constellation' ? 'active' : ''}`}
        onClick={() => onNavView('constellation')}
      >
        <span className="ni-icon" style={{ color: 'var(--gold)' }}>★</span>
        Constellation
      </div>

      <div
        className={`nav-item ${activeView === 'collections' ? 'active' : ''}`}
        onClick={() => onNavView('collections')}
      >
        <span className="ni-icon">◇</span>
        Collections
        {collections.length > 0 && (
          <span className="ni-badge">{collections.length}</span>
        )}
      </div>

      <div className="sidebar-divider" />
      <div className="sidebar-label">By type</div>

      {TYPE_NAVS.map(({ type, label, icon, color }) => (
        <div
          key={type}
          className={`nav-item ${activeType === type ? 'active' : ''}`}
          onClick={() => onNavType(type)}
        >
          <span className="ni-icon" style={{ color }}>{icon}</span>
          {label}
          <span className="ni-badge">{(byType as any)[type] ?? 0}</span>
        </div>
      ))}

      <div className="sidebar-divider" />
      <div className="sidebar-label-row">
        <div className="sidebar-label">Topics & Tags</div>
      </div>

      {/* Tag search */}
      <div className="tag-search-wrap">
        <svg width="11" height="11" viewBox="0 0 16 16" fill="none" className="tag-search-icon">
          <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M11.5 11.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <input
          className="tag-search-input"
          type="text"
          placeholder="Search tags…"
          value={tagSearch}
          onChange={e => setTagSearch(e.target.value)}
        />
        {tagSearch && (
          <button className="tag-search-clear" onClick={() => setTagSearch('')}>×</button>
        )}
      </div>

      <div className="tags-wrap">
        {filteredTopics.slice(0, 20).map((topic, i) => (
          <span
            key={topic.name}
            className={`tag-pill ${getTagColorClass(topic.name)} ${activeTag === topic.name ? 'active' : ''}`}
            onClick={() => onNavTag(topic.name)}
            style={{ opacity: activeTag && activeTag !== topic.name ? 0.5 : 1 }}
          >
            #{topic.name}
          </span>
        ))}
        {filteredTopics.length === 0 && tagSearch && (
          <div className="tag-search-empty">No tags matching "{tagSearch}"</div>
        )}
      </div>

      <div className="sidebar-divider" />

      <div className="sidebar-label">Collections</div>

      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <div className="collections-list">
            {collections.map(c => (
              <SortableCollectionItem key={c._id} collection={c} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </nav>
  )
}
