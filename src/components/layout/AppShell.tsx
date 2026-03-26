'use client'
// src/components/layout/AppShell.tsx

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Topbar } from './Topbar'
import { Sidebar } from './Sidebar'
import { MainPanel } from './MainPanel'
import { RightPanel } from './RightPanel'
import { SearchOverlay } from '@/components/ui/SearchOverlay'
import { ToastContainer } from '@/components/ui/Toast'
import { useSignals } from '@/hooks/useSignals'
import { useStats } from '@/hooks/useStats'
import { useToast } from '@/hooks/useToast'
import { useHotkeys } from 'react-hotkeys-hook'
import type { Collection, Signal, SignalType } from '@/types'
import { SignalDetailDrawer } from '@/components/signals/SignalDetailDrawer'
import { FullScreenGraph } from '@/components/panels/FullScreenGraph'
import { OnboardingModal } from '@/components/OnboardingModal'

export function AppShell() {
  const router = useRouter()
  const [activeType, setActiveType]       = useState<SignalType | 'all'>('all')
  const [activeTag, setActiveTag]         = useState<string | null>(null)
  const [activeTopic, setActiveTopic]     = useState<string | null>(null)
  const [activeView, setActiveView]       = useState<'all' | 'graph' | 'collections' | 'resurface' | 'constellation'>('all')
  const [viewMode, setViewMode]           = useState<'grid' | 'list'>('grid')
  const [searchOpen, setSearchOpen]       = useState(false)
  const [rpTab, setRpTab]                 = useState<'graph' | 'topics' | 'activity' | 'ask'>('graph')

  const [activeCardId, setActiveCardId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds]   = useState<Set<string>>(() => new Set())
  const [drawerOpen, setDrawerOpen]     = useState(false)
  const [drawerSignal, setDrawerSignal] = useState<Signal | null>(null)

  const [collections, setCollections] = useState<Collection[]>([])
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null)
  const [graphFullscreenOpen, setGraphFullscreenOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)

  const [apiKey, setApiKey] = useState('')
  const [theme, setTheme] = useState<'default' | 'violet' | 'teal' | 'coral'>('default')
  const [uiScale, setUiScale] = useState(1)

  // Ref to focus capture textarea via Capture button
  const captureRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    try {
      const storedKey = localStorage.getItem('sutra_openai_api_key') ?? ''
      const storedTheme = localStorage.getItem('sutra_theme') as any
      const storedScale = parseFloat(localStorage.getItem('sutra_ui_scale') ?? '1')
      setApiKey(storedKey)
      if (storedTheme === 'violet' || storedTheme === 'teal' || storedTheme === 'coral') setTheme(storedTheme)
      if (Number.isFinite(storedScale) && storedScale > 0) setUiScale(storedScale)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    try {
      document.documentElement.dataset.theme = theme
    } catch {
      // ignore
    }
  }, [theme])

  useEffect(() => {
    try {
      document.body.style.zoom = uiScale.toString()
    } catch {
      // ignore
    }
  }, [uiScale])

  const { toasts, addToast, removeToast } = useToast()

  useEffect(() => {
    const handleToast = (e: any) => addToast(e.detail.message, e.detail.type)
    window.addEventListener('sutra-toast', handleToast)
    return () => window.removeEventListener('sutra-toast', handleToast)
  }, [addToast])

  // Check onboarding on mount
  useEffect(() => {
    fetch('/api/user/profile').then(r => r.json()).then((u: any) => {
      if (u && u.hasSeenOnboarding === false) setShowOnboarding(true)
    }).catch(() => {})
  }, [])

  const { signals, total, loading, hasMore, loadMore, refresh, saving, saveSignal, uploadFile } = useSignals({
    type:  activeType === 'all' ? undefined : activeType,
    tag:   activeTag ?? undefined,
    topic: activeTopic ?? undefined,
    // Only filter by collection in 'all' view when no dedicated collections view
    collectionId: activeView === 'all' && activeCollectionId ? activeCollectionId : undefined,
  })

  const { stats, loading: statsLoading, refresh: refreshStats } = useStats()

  const exportJson = useCallback(() => {
    const payload = {
      exportedAt: new Date().toISOString(),
      filters: { activeType, activeTag, activeTopic, activeView, activeCollectionId },
      total,
      signals,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sutra-export-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [activeCollectionId, activeTag, activeTopic, activeType, activeView, signals, total])

  const refreshCollections = useCallback(async () => {
    try {
      const r = await fetch('/api/collections')
      const data = await r.json()
      setCollections(Array.isArray(data) ? data : [])
    } catch {
      setCollections([])
    }
  }, [])

  useEffect(() => {
    refreshCollections()
  }, [refreshCollections])

  const ignoreHotkey = (t: EventTarget | null) => {
    const el = t as HTMLElement | null
    if (!el) return false
    const tag = (el.tagName || '').toLowerCase()
    return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable
  }

  useHotkeys('meta+k, ctrl+k', (e) => {
    e.preventDefault()
    setSearchOpen(true)
  })
  useHotkeys('escape', () => {
    if (settingsOpen) return setSettingsOpen(false)
    if (graphFullscreenOpen) return setGraphFullscreenOpen(false)
    if (drawerOpen) return setDrawerOpen(false)
    setSearchOpen(false)
  })

  useHotkeys('n', (e) => {
    if (ignoreHotkey(e.target)) return
    e.preventDefault()
    // Focus the capture textarea
    captureRef.current?.focus()
    // If in a special view, switch back to all signals
    if (activeView !== 'all') {
      setActiveView('all')
    }
  })

  useHotkeys('g', (e) => {
    if (ignoreHotkey(e.target)) return
    e.preventDefault()
    setViewMode(v => (v === 'grid' ? 'list' : 'grid'))
  })

  useHotkeys('j', (e) => {
    if (ignoreHotkey(e.target)) return
    if (!signals.length) return
    e.preventDefault()
    setActiveCardId(prev => {
      const idx = prev ? signals.findIndex(s => s._id === prev) : -1
      const next = idx >= 0 ? (idx + 1) % signals.length : 0
      return signals[next]?._id ?? null
    })
  })

  useHotkeys('k', (e) => {
    if (ignoreHotkey(e.target)) return
    if (!signals.length) return
    e.preventDefault()
    setActiveCardId(prev => {
      const idx = prev ? signals.findIndex(s => s._id === prev) : -1
      const next = idx >= 0 ? (idx - 1 + signals.length) % signals.length : 0
      return signals[next]?._id ?? null
    })
  })

  useHotkeys('enter', (e) => {
    if (ignoreHotkey(e.target)) return
    if (!activeCardId) return
    e.preventDefault()
    openDrawer(activeCardId)
  })

  useEffect(() => {
    if (!signals.length) { setActiveCardId(null); return }
    if (activeCardId && signals.some(s => s._id === activeCardId)) return
    setActiveCardId(signals[0]._id)
  }, [signals, activeCardId])

  const handleSave = useCallback(async (data: {
    url?: string; content?: string; title?: string; type?: SignalType
    tags?: string[]; collectionIds?: string[]
  }) => {
    const result = await saveSignal(data)
    if (result.signal) {
      addToast('Signal saved ✦', 'success')
      refreshStats()
      if (data.collectionIds?.length) refreshCollections()
    } else {
      addToast(result.error ?? 'Failed to save signal', 'error')
    }
  }, [saveSignal, addToast, refreshStats, refreshCollections])

  const handleUploadFile = useCallback(async (file: File, notes?: string, tags?: string[], collectionIds?: string[]) => {
    const result = await uploadFile(file, notes)
    if (result.signal) {
      addToast('File uploaded ✦', 'success')
      refreshStats()
      if (collectionIds?.length) refreshCollections()
    } else {
      addToast(result.error ?? 'Failed to upload file', 'error')
    }
  }, [uploadFile, addToast, refreshStats, refreshCollections])

  const openDrawer = useCallback(async (id: string) => {
    setActiveCardId(id)
    setDrawerOpen(true)
    const existing = signals.find(s => s._id === id)
    if (existing) setDrawerSignal(existing)
    else setDrawerSignal(null)
    try {
      const r = await fetch(`/api/signals/${id}`)
      if (!r.ok) return
      const data = await r.json()
      setDrawerSignal(data as Signal)
    } catch {
      // Keep existing if available
    }
  }, [signals])

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const bulkDeleteSelected = useCallback(async () => {
    const ids = Array.from(selectedIds)
    if (!ids.length) return
    if (!confirm(`Delete ${ids.length} selected signal(s)?`)) return
    await Promise.all(ids.map(id => fetch(`/api/signals/${id}`, { method: 'DELETE' }).catch(() => null)))
    setSelectedIds(new Set())
    setDrawerOpen(false)
    setDrawerSignal(null)
    refresh()
    refreshStats()
    refreshCollections()
  }, [selectedIds, refresh, refreshStats, refreshCollections])

  const bulkAddTags = useCallback(async (tags: string[]) => {
    const ids = Array.from(selectedIds)
    if (!ids.length || !tags.length) return
    const nextTags = Array.from(new Set(tags)).filter(Boolean)
    if (!nextTags.length) return
    const toUpdate = signals.filter(s => selectedIds.has(s._id))
    await Promise.all(
      toUpdate.map(s => {
        const merged = Array.from(new Set([...s.tags, ...nextTags]))
        return fetch(`/api/signals/${s._id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tags: merged }),
        }).catch(() => null)
      })
    )
    setSelectedIds(new Set())
    refresh()
    refreshStats()
  }, [selectedIds, signals, refresh, refreshStats])

  const bulkCollect = useCallback(async (collectionId: string) => {
    const ids = Array.from(selectedIds)
    if (!ids.length) return
    await fetch('/api/collections/collect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ collectionId, signalIds: ids, mode: 'add' }),
    }).catch(() => null)
    setSelectedIds(new Set())
    refresh()
    refreshStats()
    refreshCollections()
  }, [selectedIds, refresh, refreshStats, refreshCollections])

  const handleNavType = useCallback((type: SignalType | 'all') => {
    setActiveType(type)
    setActiveTag(null)
    setActiveTopic(null)
    setActiveCollectionId(null)
    setActiveView('all')
  }, [])

  const handleNavTag = useCallback((tag: string) => {
    setActiveTag(prev => prev === tag ? null : tag)
    setActiveType('all')
    setActiveTopic(null)
    setActiveCollectionId(null)
    setActiveView('all')
  }, [])

  const handleNavTopic = useCallback((topic: string) => {
    handleNavTag(topic)
  }, [handleNavTag])

  const handleNavView = useCallback((v: any) => {
    setActiveView(v)
    if (v !== 'collections') setActiveCollectionId(null)
    // Graph view opens fullscreen immediately
    if (v === 'graph') {
      setGraphFullscreenOpen(true)
      // Stay on 'all' signals in main panel
      setActiveView('all')
    }
  }, [])

  useEffect(() => {
    if (activeView !== 'collections') return
    if (activeCollectionId) return
    if (collections.length) setActiveCollectionId(collections[0]._id)
  }, [activeView, collections, activeCollectionId])

  const titleMap: Record<string, string> = {
    all:         'All signals',
    graph:       'Graph view',
    collections: 'Collections',
    resurface:   'Resurface',
    constellation: 'Constellation',
  }

  const subtitleMap = () => {
    if (activeTag)   return `tag: ${activeTag}`
    if (activeTopic) return `topic: ${activeTopic}`
    if (activeType !== 'all') return `${activeType}s only`
    return `${total} saved · ${stats?.thisWeek ?? 0} new this week`
  }

  const emptyType: SignalType | 'all' = activeType === 'all' ? 'all' : activeType

  // Capture button: focus capture textarea, switch to 'all' view if needed
  const handleCapture = useCallback(() => {
    if (activeView !== 'all' && activeView !== 'resurface') {
      setActiveView('all')
      setTimeout(() => captureRef.current?.focus(), 100)
    } else {
      captureRef.current?.focus()
      captureRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [activeView])

  return (
    <>
      <div className="app">
        <Topbar
          onSearchOpen={() => setSearchOpen(true)}
          onSave={handleSave}
          saving={saving}
          onOpenSettings={() => router.push('/account')}
          onOpenExtension={() => addToast('Extension coming soon', 'info')}
          onCapture={handleCapture}
        />
        <Sidebar
          activeType={activeType}
          activeTag={activeTag}
          activeView={activeView}
          stats={stats}
          onNavType={handleNavType}
          onNavView={handleNavView}
          onNavTag={handleNavTag}
          collections={collections}
          activeCollectionId={activeCollectionId}
          onSelectCollection={(id) => {
            setActiveView('collections')
            setActiveCollectionId(id)
          }}
          onRefreshCollections={refreshCollections}
        />
        <MainPanel
          signals={signals}
          loading={loading}
          hasMore={hasMore}
          onLoadMore={loadMore}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          title={activeView !== 'all' ? titleMap[activeView] : (activeType === 'all' ? 'All signals' : `${activeType}s`)}
          subtitle={subtitleMap()}
          onSave={handleSave}
          onUploadFile={handleUploadFile}
          saving={saving}
          resurface={stats?.resurface ?? []}
          onRefresh={refresh}
          onOpenDrawer={openDrawer}
          activeCardId={activeCardId}
          selectedIds={selectedIds}
          onToggleSelected={toggleSelected}
          emptyType={emptyType}
          collections={collections}
          onBulkDelete={bulkDeleteSelected}
          onBulkAddTags={(tags) => bulkAddTags(tags)}
          onBulkCollect={bulkCollect}
          activeView={activeView}
          activeCollectionId={activeCollectionId}
          onSelectCollection={(id) => {
            setActiveView('collections')
            setActiveCollectionId(id)
          }}
          onRefreshCollections={refreshCollections}
          captureRef={captureRef}
          activeType={activeType}
          activeTag={activeTag}
          activeTopic={activeTopic}
          onClearFilter={(k) => {
            if (k === 'tag') setActiveTag(null)
            if (k === 'topic') setActiveTopic(null)
            if (k === 'type') setActiveType('all')
            if (k === 'all') {
              setActiveTag(null)
              setActiveTopic(null)
              setActiveType('all')
            }
          }}
          onCreateCollection={async (name, emoji) => {
            const res = await fetch('/api/collections', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name, icon: emoji, color: '#C9A96E' }),
            })
            const created = await res.json()
            await refreshCollections()
            return created
          }}
        />
        <RightPanel
          tab={rpTab}
          onTabChange={setRpTab}
          stats={stats}
          statsLoading={statsLoading}
          onTopicClick={handleNavTopic}
          onQuickSave={handleSave}
          onOpenGraphFullscreen={() => setGraphFullscreenOpen(true)}
          onOpenDrawer={openDrawer}
          saving={saving}
          apiKey={apiKey}
        />
      </div>

      {searchOpen && (
        <SearchOverlay 
          onClose={() => setSearchOpen(false)} 
          onOpenSignal={openDrawer}
        />
      )}

      <SignalDetailDrawer
        open={drawerOpen}
        signal={drawerSignal}
        onClose={() => setDrawerOpen(false)}
        onAfterSave={(updated) => {
          setDrawerSignal(updated)
          refresh()
          refreshStats()
        }}
        onAfterDelete={(deletedId) => {
          setDrawerOpen(false)
          setDrawerSignal(null)
          setSelectedIds(prev => {
            const next = new Set(prev)
            next.delete(deletedId)
            return next
          })
          refresh()
          refreshStats()
        }}
      />

      <FullScreenGraph
        open={graphFullscreenOpen}
        onClose={() => setGraphFullscreenOpen(false)}
        onNodeClick={(id) => {
          openDrawer(id)
          setGraphFullscreenOpen(false)
        }}
      />

      {showOnboarding && (
        <OnboardingModal onDone={() => setShowOnboarding(false)} />
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  )
}
