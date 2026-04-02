import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/700.css'
import './popup.css'

import { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  addToResurface,
  ApiError,
  checkAuth,
  createCollection,
  findDuplicate,
  getBaseUrl,
  getCollections,
  saveDraftLocally,
  savePlainNote,
  saveSignal,
  setBaseUrl,
  syncDrafts,
  type Collection,
  type DuplicateSignal,
  type SutraUser,
} from '../lib/api'
import {
  getIntentMeta,
  getIntentOptions,
  mapIntentToSignalType,
  type IntentDefinition,
  type IntentIconName,
  type IntentLabel,
} from '../lib/ai'
import { ensureFreshAuth } from '../lib/auth'
import type { PageAnalysis } from '../lib/parser'

type PopupMode = 'loading' | 'login' | 'capture' | 'success' | 'error'

interface UnsupportedState {
  canOnlySaveNote: boolean
  message: string
}

interface ErrorState {
  message: string
  action: 'retry' | 'login' | 'offline'
}

interface PendingCapture {
  url: string
  title: string
  selectedText?: string
}

const DEFAULT_BASE_URL = 'https://sutra-three.vercel.app'
const PRELOAD_KEY = 'sutra_pending_capture'
const SUTRA_HOSTS = new Set(['sutra-three.vercel.app', 'localhost', '127.0.0.1'])

function resolveSutraOrigin(url?: string): string | null {
  if (!url) {
    return null
  }

  try {
    const parsed = new URL(url)
    if (!SUTRA_HOSTS.has(parsed.hostname)) {
      return null
    }
    return parsed.origin
  } catch {
    return null
  }
}

function buildAppUrl(baseUrl: string, path: string): string {
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`
}

function SutraLogo({ pulsing = false }: { pulsing?: boolean }) {
  return (
    <span className={`sutra-mark${pulsing ? ' is-pulsing' : ''}`}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M8 2L13 8L8 14L3 8Z" stroke="#C9A84C" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M8 5L11 8L8 11L5 8Z" fill="#C9A84C" opacity="0.4" />
      </svg>
    </span>
  )
}

function CloseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M3 9l4.5 4.5L15 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function PencilIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
      <path d="M2 11l1.5-1.5L10 3l-1.5-1.5L2 8V11z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  )
}

function FolderIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
      <rect x="1.5" y="4" width="10" height="7.5" rx="1.5" stroke="currentColor" strokeWidth="1.1" />
      <path d="M4.5 4V3a2 2 0 0 1 4 0v1" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  )
}

function ChevronDownIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
      <path d="M3 4.5l2.5 2.5L8 4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ExternalLinkIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 9 9" fill="none" aria-hidden="true">
      <path d="M2 7L7 2M7 2H4M7 2v3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function openTab(url: string): void {
  void chrome.tabs.create({ url })
}

function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  return chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => tab)
}

function isUnsupportedUrl(url: string): boolean {
  return /^(chrome|edge|about|chrome-extension|devtools):/i.test(url)
}

function formatDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function summarizeMeta(analysis: PageAnalysis, intent: IntentLabel): string {
  if (analysis.youtube?.duration) return analysis.youtube.duration
  if (analysis.isPDF) return 'PDF'
  if (intent === 'Watch Later' || intent === 'Video') return 'Video'
  return `${analysis.readTimeMinutes} min read`
}

function iconForIntent(name: IntentIconName) {
  switch (name) {
    case 'play':
      return (
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
          <circle cx="5.5" cy="5.5" r="4.5" stroke="currentColor" strokeWidth="1.2" />
          <path d="M5.5 3v2.5l1.5 1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      )
    case 'code':
      return (
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
          <path d="M4 2.5 1.8 5.5 4 8.5M7 2.5 9.2 5.5 7 8.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'book':
      return (
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
          <path d="M2.4 2.2h5.3A1.1 1.1 0 0 1 8.8 3.3v5.5H3.3A1.1 1.1 0 0 0 2.2 9.9V3.3a1.1 1.1 0 0 1 1.1-1.1Z" stroke="currentColor" strokeWidth="1.1" />
        </svg>
      )
    case 'beaker':
      return (
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
          <path d="M4 2h3v1l2 4a1.4 1.4 0 0 1-1.2 2H3.2A1.4 1.4 0 0 1 2 7l2-4V2Z" stroke="currentColor" strokeWidth="1.05" />
        </svg>
      )
    case 'x':
      return (
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
          <path d="M2.5 2.2h1.7L5.9 4.7l1.5-2.5h1.3L6.6 5.1 8.8 8.8H7.1L5.3 6 3.7 8.8H2.4l2.2-3.6-2.1-3Z" fill="currentColor" />
        </svg>
      )
    case 'lightbulb':
      return (
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
          <path d="M5.5 1.9A3.1 3.1 0 0 1 7.4 7.5v1.2H3.6V7.5a3.1 3.1 0 0 1 1.9-5.6Z" stroke="currentColor" strokeWidth="1.05" />
          <path d="M4.2 9.4h2.6" stroke="currentColor" strokeWidth="1.05" strokeLinecap="round" />
        </svg>
      )
    case 'document':
      return (
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
          <path d="M3 1.8h3.5l2 2V9.2H3V1.8Z" stroke="currentColor" strokeWidth="1.05" />
          <path d="M6.5 1.8v2h2" stroke="currentColor" strokeWidth="1.05" />
        </svg>
      )
    case 'bubble':
      return (
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
          <path d="M5.5 2c2.2 0 4 1.4 4 3.2S7.7 8.4 5.5 8.4c-.4 0-.8-.1-1.2-.2L2 9l.8-1.7C2.3 6.8 2 6.1 2 5.2 2 3.4 3.8 2 5.5 2Z" stroke="currentColor" strokeWidth="1.05" strokeLinejoin="round" />
        </svg>
      )
    case 'note':
      return (
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
          <path d="M2.5 2.3h6v6.4h-6z" stroke="currentColor" strokeWidth="1.05" />
          <path d="M3.8 4h3.4M3.8 5.7h3.4M3.8 7.4h2.1" stroke="currentColor" strokeWidth="1.05" strokeLinecap="round" />
        </svg>
      )
    case 'spark':
      return (
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
          <path d="M5.5 1.5 6.6 4 9 5.1 6.6 6.2 5.5 8.7 4.4 6.2 2 5.1 4.4 4 5.5 1.5Z" stroke="currentColor" strokeWidth="1.05" strokeLinejoin="round" />
        </svg>
      )
    case 'newspaper':
    default:
      return (
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
          <path d="M2.2 2.2h6.6v6.6H2.2z" stroke="currentColor" strokeWidth="1.05" />
          <path d="M3.4 4h4.2M3.4 5.6h4.2M3.4 7.2h2.5" stroke="currentColor" strokeWidth="1.05" strokeLinecap="round" />
        </svg>
      )
  }
}

function buildFallbackAnalysis(tab: chrome.tabs.Tab, pending?: PendingCapture): PageAnalysis {
  const url = pending?.url ?? tab.url ?? ''
  const title = pending?.title ?? tab.title?.trim() ?? formatDomain(url)

  return {
    url,
    title,
    rawTitle: title,
    domain: formatDomain(url),
    description: undefined,
    ogImage: undefined,
    favicon: '',
    wordCount: 0,
    readTimeMinutes: 1,
    isYouTube: url.includes('youtube.com') || url.includes('youtu.be'),
    isPDF: url.toLowerCase().endsWith('.pdf'),
    hasVideo: false,
    selectedText: pending?.selectedText ?? '',
    pageType: 'Article',
    youtube: undefined,
    loginRequired: false,
  }
}

async function getPendingCapture(): Promise<PendingCapture | undefined> {
  const stored = await chrome.storage.local.get(PRELOAD_KEY)
  const pending = stored[PRELOAD_KEY]
  await chrome.storage.local.remove(PRELOAD_KEY)

  if (!pending || typeof pending !== 'object') {
    return undefined
  }

  const record = pending as Record<string, unknown>
  if (typeof record.url !== 'string' || typeof record.title !== 'string') {
    return undefined
  }

  return {
    url: record.url,
    title: record.title,
    selectedText: typeof record.selectedText === 'string' ? record.selectedText : undefined,
  }
}

async function getPageAnalysis(tab: chrome.tabs.Tab, pending?: PendingCapture): Promise<PageAnalysis> {
  if (pending) return buildFallbackAnalysis(tab, pending)
  if (!tab.url || isUnsupportedUrl(tab.url)) return buildFallbackAnalysis(tab)

  const tabId = tab.id
  if (typeof tabId !== 'number') return buildFallbackAnalysis(tab)

  const response = await new Promise<{ ok: boolean; data?: PageAnalysis }>((resolve) => {
    const timer = window.setTimeout(() => resolve({ ok: false }), 500)
    chrome.tabs.sendMessage(tabId, { type: 'GET_PAGE_ANALYSIS' }, (message) => {
      window.clearTimeout(timer)
      if (chrome.runtime.lastError) {
        resolve({ ok: false })
        return
      }
      resolve((message as { ok: boolean; data?: PageAnalysis }) ?? { ok: false })
    })
  })

  return response.ok && response.data ? response.data : buildFallbackAnalysis(tab)
}

function buildSavePayload(
  analysis: PageAnalysis,
  intent: IntentLabel,
  note: string,
  collectionId?: string
) {
  const computedNote = note.trim() || (analysis.loginRequired ? 'Login required to view full content' : '')

  return {
    url: analysis.url,
    title: analysis.youtube?.title || analysis.title || analysis.domain,
    type: mapIntentToSignalType(intent, analysis.isPDF, analysis.hasVideo, analysis.url),
    intent,
    note: computedNote || undefined,
    collectionId,
    selectedText: analysis.selectedText || undefined,
    metadata: {
      domain: analysis.domain,
      ogImage: analysis.ogImage,
      readTimeMinutes: analysis.readTimeMinutes,
      wordCount: analysis.loginRequired ? undefined : analysis.wordCount,
    },
  }
}

function SafeImage({
  src,
  alt,
  className,
}: {
  src?: string
  alt: string
  className: string
}) {
  const [failed, setFailed] = useState(false)

  if (!src || failed || !/^https?:/i.test(src)) {
    return null
  }

  return <img className={className} src={src} alt={alt} referrerPolicy="no-referrer" onError={() => setFailed(true)} />
}

function ErrorBanner({ error }: { error: ErrorState }) {
  return (
    <div className="state-body centered-state error-state">
      <div className="error-circle">!</div>
      <div className="state-title">Could not save. Tap to retry.</div>
      <div className="state-copy">{error.message}</div>
    </div>
  )
}

function App() {
  const [mode, setMode] = useState<PopupMode>('loading')
  const [baseUrl, setBaseUrlState] = useState(DEFAULT_BASE_URL)
  const [analysis, setAnalysis] = useState<PageAnalysis | null>(null)
  const [selectedIntent, setSelectedIntent] = useState<IntentLabel>('Article')
  const [note, setNote] = useState('')
  const [collections, setCollections] = useState<Collection[]>([])
  const [collectionsOpen, setCollectionsOpen] = useState(false)
  const [collectionQuery, setCollectionQuery] = useState('')
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | undefined>()
  const [loadingCollections, setLoadingCollections] = useState(false)
  const [isCreatingCollection, setIsCreatingCollection] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [errorState, setErrorState] = useState<ErrorState | null>(null)
  const [successTags, setSuccessTags] = useState<string[]>([])
  const [savedSignalId, setSavedSignalId] = useState('')
  const [duplicate, setDuplicate] = useState<DuplicateSignal | null>(null)
  const [user, setUser] = useState<SutraUser | undefined>()
  const [unsupported, setUnsupported] = useState<UnsupportedState | null>(null)

  const openAppPath = (path: string): void => {
    openTab(buildAppUrl(baseUrl, path))
  }

  useEffect(() => {
    void (async () => {
      try {
        const [activeTab, pendingCapture, storedBaseUrl] = await Promise.all([
          getActiveTab(),
          getPendingCapture(),
          getBaseUrl(),
        ])

        const inferredBaseUrl = resolveSutraOrigin(activeTab?.url) ?? storedBaseUrl ?? DEFAULT_BASE_URL
        setBaseUrlState(inferredBaseUrl)
        await setBaseUrl(inferredBaseUrl)

        const auth = await ensureFreshAuth(true)
        setUser(auth.user)
        if (!auth.isLoggedIn) {
          setMode('login')
          return
        }

        if (!activeTab?.url) {
          setUnsupported({ canOnlySaveNote: true, message: 'Cannot save this type of page' })
          setMode('capture')
          return
        }

        if (isUnsupportedUrl(activeTab.url) && !pendingCapture) {
          setUnsupported({ canOnlySaveNote: true, message: 'Cannot save this type of page' })
          setAnalysis(buildFallbackAnalysis(activeTab))
          setSelectedIntent('Note to Self')
          setMode('capture')
          return
        }

        const page = await getPageAnalysis(activeTab, pendingCapture)
        setAnalysis(page)
        setSelectedIntent(page.pageType)
        setNote(page.youtube?.currentTimestamp ? `[${page.youtube.currentTimestamp}] ${page.selectedText}`.trim() : page.selectedText)

        const authCheck = await checkAuth()
        if (!authCheck.isLoggedIn) {
          setMode('login')
          return
        }

        setUser(authCheck.user)
        if (navigator.onLine && page.url) {
          const existing = await findDuplicate(page.url).catch(() => null)
          setDuplicate(existing)
        }

        if (navigator.onLine) {
          void syncDrafts()
        }

        setMode('capture')
      } catch {
        setErrorState({ message: 'No connection. Will retry when online.', action: 'offline' })
        setMode('error')
      }
    })()
  }, [])

  useEffect(() => {
    if (!collectionsOpen || collections.length > 0 || loadingCollections) {
      return
    }

    setLoadingCollections(true)
    void getCollections()
      .then((result) => setCollections(result.slice(0, 5)))
      .catch(() => setCollections([]))
      .finally(() => setLoadingCollections(false))
  }, [collections.length, collectionsOpen, loadingCollections])

  useEffect(() => {
    if (mode !== 'success') {
      return
    }

    const timer = window.setTimeout(() => window.close(), 4000)
    return () => window.clearTimeout(timer)
  }, [mode])

  const intentOptions = useMemo<IntentDefinition[]>(
    () => getIntentOptions(selectedIntent, Boolean(analysis?.selectedText)),
    [analysis?.selectedText, selectedIntent]
  )

  const visibleCollections = useMemo(() => {
    const query = collectionQuery.trim().toLowerCase()
    return collections.filter((collection) => collection.name.toLowerCase().includes(query)).slice(0, 5)
  }, [collectionQuery, collections])

  const canCreateCollection = useMemo(() => {
    const query = collectionQuery.trim().toLowerCase()
    return Boolean(query) && !collections.some((collection) => collection.name.toLowerCase() === query)
  }, [collectionQuery, collections])

  const previewTags = useMemo(() => {
    if (!analysis) return ['#sutra']

    return [
      `#${selectedIntent.toLowerCase().replace(/\s+/g, '-')}`,
      `#${analysis.domain.replace(/\./g, '-')}`,
      analysis.isYouTube ? '#youtube' : '#web',
    ].slice(0, 3)
  }, [analysis, selectedIntent])

  const handleCreateCollection = async (): Promise<void> => {
    const name = collectionQuery.trim()
    if (!name || isCreatingCollection) return

    setIsCreatingCollection(true)
    try {
      const created = await createCollection(name, 'Folder')
      setCollections((current) => [created, ...current.filter((item) => item.id !== created.id)].slice(0, 5))
      setSelectedCollectionId(created.id)
      setCollectionQuery('')
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setErrorState({ message: 'Session expired. Sign in again ->', action: 'login' })
        setMode('error')
      }
    } finally {
      setIsCreatingCollection(false)
    }
  }

  const handleSave = async (): Promise<void> => {
    if (!analysis) return

    const payload = buildSavePayload(analysis, selectedIntent, note, selectedCollectionId)
    setIsSaving(true)
    setErrorState(null)

    try {
      if (!navigator.onLine) {
        await saveDraftLocally(payload)
        setErrorState({ message: 'No connection. Will retry when online.', action: 'offline' })
        setMode('error')
        return
      }

      const response = await saveSignal(payload)
      if (!response.success) {
        throw new Error('Unknown save error')
      }

      setSavedSignalId(response.signalId)
      setSuccessTags(response.tags)
      setMode('success')
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setErrorState({ message: 'Session expired. Sign in again ->', action: 'login' })
      } else if (error instanceof ApiError && error.status === 500) {
        setErrorState({ message: 'Sutra server error. Try again in a moment.', action: 'retry' })
      } else if (!navigator.onLine || (error instanceof ApiError && (error.code === 'network' || error.code === 'timeout'))) {
        setErrorState({ message: 'No connection. Will retry when online.', action: 'offline' })
      } else {
        setErrorState({ message: 'Could not save this page right now.', action: 'retry' })
      }
      setMode('error')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveAsNote = async (): Promise<void> => {
    if (!analysis) return

    setIsSaving(true)
    try {
      const plainContent = [analysis.title, analysis.url].filter(Boolean).join('\n')
      const response = await savePlainNote(plainContent, analysis.title)
      setSavedSignalId(response.signalId)
      setSuccessTags(response.tags)
      setMode('success')
    } catch {
      setErrorState({ message: 'Could not save. Tap to retry.', action: 'retry' })
      setMode('error')
    } finally {
      setIsSaving(false)
    }
  }

  const handleAddToResurface = async (): Promise<void> => {
    if (!savedSignalId) return

    await addToResurface(savedSignalId, note.trim() || undefined).catch(() => undefined)
    openAppPath('/dashboard')
    window.close()
  }

  if (mode === 'login') {
    return (
      <main className="popup-frame" dir="auto">
        <div className="popup-card centered-state">
          <div className="header-row login-header">
            <div className="brand-lockup">
              <SutraLogo />
              <div>
                <div className="brand-name">Sutra</div>
                <div className="brand-caption">thinking system</div>
              </div>
            </div>
          </div>
          <div className="state-title">Your thinking system</div>
          <div className="state-copy">Sign in to capture anything from the web directly into Sutra.</div>
          <button className="save-btn" onClick={() => openAppPath('/login')}>Open Sutra to sign in</button>
        </div>
      </main>
    )
  }

  if (mode === 'loading') {
    return (
      <main className="popup-frame" dir="auto">
        <div className="popup-card">
          <div className="top-loader" />
          <div className="header-row">
            <div className="brand-lockup">
              <SutraLogo pulsing />
              <div>
                <div className="brand-name">Sutra</div>
                <div className="brand-caption">thinking system</div>
              </div>
            </div>
          </div>
          <div className="state-body centered-state compact-center">
            <div className="state-title">Reading this page...</div>
            <div className="state-copy">Gathering the signal.</div>
          </div>
        </div>
      </main>
    )
  }

  if (mode === 'success' && analysis) {
    return (
      <main className="popup-frame" dir="auto">
        <div className="popup-card centered-state success-panel">
          <div className="success-check"><CheckIcon /></div>
          <div className="state-title">Saved to your brain</div>
          <div className="state-copy">Added to {selectedIntent} Â· AI tagged</div>
          {successTags.length > 0 ? (
            <div className="auto-tags-row centered-tags">
              {successTags.map((tag) => (
                <span key={tag} className="auto-tag">#{tag.replace(/^#+/, '')}</span>
              ))}
            </div>
          ) : null}
          <div className="dual-actions">
            <button className="soft-btn" onClick={() => void handleAddToResurface()}>Add to Queue</button>
            <button className="save-btn" onClick={() => openAppPath('/dashboard')}>View in Sutra</button>
          </div>
        </div>
      </main>
    )
  }

  if (mode === 'error' && errorState) {
    return (
      <main className="popup-frame" dir="auto">
        <div className="popup-card has-error-top">
          <ErrorBanner error={errorState} />
          <div className="dual-actions padded-actions">
            <button
              className="save-btn"
              onClick={() => {
                if (errorState.action === 'login') {
                  openAppPath('/login')
                } else {
                  window.location.reload()
                }
              }}
            >
              {errorState.action === 'login' ? 'Open login' : 'Retry'}
            </button>
            <button className="soft-btn" onClick={() => void handleSaveAsNote()}>Save as note</button>
          </div>
        </div>
      </main>
    )
  }

  const previewIntentMeta = getIntentMeta(selectedIntent)

  return (
    <main className="popup-frame" dir="auto">
      <div className="popup-card">
        <div className="header-row">
          <div className="brand-lockup">
            <SutraLogo />
            <div>
              <div className="brand-name">Sutra</div>
              <div className="brand-caption">thinking system</div>
            </div>
          </div>
          <button className="close-btn" onClick={() => window.close()} aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        {analysis ? (
          <div className="page-preview-card">
            <div className="preview-icon-box">
              <SafeImage src={analysis.favicon} alt="Site icon" className="preview-favicon" />
              {!analysis.favicon ? iconForIntent(previewIntentMeta.icon) : null}
            </div>
            <div className="preview-main">
              <div className="preview-title">{analysis.title || analysis.domain}</div>
              <div className="preview-meta-line">
                <span>{analysis.domain}</span>
                <span className="preview-dot">Â·</span>
                <span>{summarizeMeta(analysis, selectedIntent)}</span>
              </div>
            </div>
            <SafeImage src={analysis.ogImage} alt="Preview thumbnail" className="preview-thumb" />
          </div>
        ) : null}

        {unsupported ? (
          <div className="inline-alert">
            <div className="state-title small-title">{unsupported.message}</div>
            <div className="state-copy">You can still save this as a simple note.</div>
          </div>
        ) : null}

        <div className="section-label">Save as</div>
        <div className="intent-wrap">
          {intentOptions.map((intent) => (
            <button
              key={intent.label}
              className={`intent-chip${intent.label === selectedIntent ? ' active' : ''}`}
              onClick={() => setSelectedIntent(intent.label)}
            >
              {iconForIntent(intent.icon)}
              <span>{intent.label}</span>
            </button>
          ))}
        </div>

        <div className="note-shell">
          <span className="note-pencil"><PencilIcon /></span>
          <input
            type="text"
            className="note-field"
            placeholder="Add a thought or highlight..."
            value={note}
            maxLength={280}
            onChange={(event) => setNote(event.target.value)}
          />
        </div>

        <div className="row-split">
          <button className="subtle-row-button" onClick={() => setCollectionsOpen((value) => !value)}>
            <span className="subtle-row-stack"><FolderIcon /><span>Add to collection</span></span>
          </button>
          <div className="subtle-row-right"><span>Tags</span><ChevronDownIcon /></div>
        </div>

        {collectionsOpen ? (
          <div className="collection-box">
            <input
              className="collection-search"
              placeholder="Search collections..."
              value={collectionQuery}
              onChange={(event) => setCollectionQuery(event.target.value)}
            />
            <div className="collection-items">
              {loadingCollections ? <div className="tiny-copy">Loading collections...</div> : null}
              {!loadingCollections && visibleCollections.map((collection) => (
                <button
                  key={collection.id}
                  className={`collection-row${collection.id === selectedCollectionId ? ' active' : ''}`}
                  onClick={() => setSelectedCollectionId((current) => current === collection.id ? undefined : collection.id)}
                >
                  <span>{collection.emoji} {collection.name}</span>
                  <span>{collection.id === selectedCollectionId ? 'Selected' : 'Add'}</span>
                </button>
              ))}
              {!loadingCollections && visibleCollections.length === 0 ? <div className="tiny-copy">No collections yet.</div> : null}
            </div>
            {canCreateCollection ? (
              <button className="soft-btn compact-btn" onClick={() => void handleCreateCollection()} disabled={isCreatingCollection}>
                {isCreatingCollection ? 'Creating...' : `Create "${collectionQuery.trim()}"`}
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="auto-tags-row">
          {previewTags.map((tag) => <span key={tag} className="auto-tag">{tag}</span>)}
          <span className="ai-tag-pill">AI tagged</span>
        </div>

        {duplicate ? (
          <button className="save-btn muted-save" onClick={() => openAppPath('/dashboard')}>
            Already in Sutra Â· View signal
          </button>
        ) : (
          <button className="save-btn" onClick={() => void handleSave()} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save signal'}
          </button>
        )}

        <div className="footer-row">
          <span className="footer-metric">{user ? `Signed in as ${user.name}` : 'Sutra ready'}</span>
          <button className="footer-link" onClick={() => openAppPath('/dashboard')}>
            <span>Open dashboard</span>
            <ExternalLinkIcon />
          </button>
        </div>
      </div>
    </main>
  )
}

createRoot(document.getElementById('root') as HTMLElement).render(<App />)