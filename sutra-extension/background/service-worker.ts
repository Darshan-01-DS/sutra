import { detectIntent, mapIntentToSignalType } from '../lib/ai'
import {
  addToResurface,
  checkAuth,
  getBaseUrl,
  savePlainNote,
  saveSignal,
  saveDraftLocally,
  setBaseUrl,
  syncDrafts,
  type SaveSignalPayload,
} from '../lib/api'
import { cacheAuthState } from '../lib/auth'
import type { PageAnalysis } from '../lib/parser'

const PRELOAD_KEY = 'sutra_pending_capture'
const notificationLinks = new Map<string, string>()
const loginTabIds = new Set<number>()
const SUTRA_HOSTS = new Set(['sutra-three.vercel.app', 'localhost', '127.0.0.1'])

interface ContextPendingCapture {
  url: string
  title: string
  selectedText?: string
}

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

async function syncBaseUrlFromTab(tab?: chrome.tabs.Tab): Promise<string> {
  const inferredOrigin = resolveSutraOrigin(tab?.url)
  if (inferredOrigin) {
    await setBaseUrl(inferredOrigin)
    return inferredOrigin
  }
  return getBaseUrl()
}

function buildAppUrl(baseUrl: string, path: string): string {
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`
}

function isRestrictedUrl(url: string): boolean {
  return /^(chrome|edge|about|chrome-extension|devtools):/i.test(url)
}

function truncate(input: string, maxLength: number): string {
  return input.length <= maxLength ? input : `${input.slice(0, maxLength - 3)}...`
}

async function notify(
  title: string,
  message: string,
  buttons?: chrome.notifications.NotificationButton[]
): Promise<string> {
  const notificationId = crypto.randomUUID()
  await chrome.notifications.create(notificationId, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon128.png'),
    title,
    message,
    buttons,
  })
  return notificationId
}

async function withTimeout<T>(promiseFactory: () => Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    const timer = globalThis.setTimeout(() => resolve(fallback), timeoutMs)

    promiseFactory()
      .then((result) => {
        globalThis.clearTimeout(timer)
        resolve(result)
      })
      .catch(() => {
        globalThis.clearTimeout(timer)
        resolve(fallback)
      })
  })
}

async function captureTab(tabId: number, tab: chrome.tabs.Tab): Promise<PageAnalysis | null> {
  if (!tab.url || isRestrictedUrl(tab.url)) {
    return null
  }

  return withTimeout<PageAnalysis | null>(
    async () => {
      const response = (await chrome.tabs.sendMessage(tabId, {
        type: 'GET_PAGE_ANALYSIS',
      })) as { ok: boolean; data?: PageAnalysis }

      return response?.ok && response.data ? response.data : null
    },
    800,
    null
  )
}

function buildFallbackPayload(tab: chrome.tabs.Tab): SaveSignalPayload | null {
  if (!tab.url || isRestrictedUrl(tab.url)) {
    return null
  }

  const url = tab.url
  const title = tab.title?.trim() || new URL(url).hostname
  const intent = detectIntent({
    url,
    title,
    wordCount: 0,
    hasArticle: false,
    hasVideo: false,
    isPdf: url.toLowerCase().endsWith('.pdf'),
  })

  return {
    url,
    title,
    type: mapIntentToSignalType(intent.label, url.toLowerCase().endsWith('.pdf'), false, url),
    intent: intent.label,
    metadata: {
      domain: new URL(url).hostname,
      wordCount: 0,
      readTimeMinutes: 1,
    },
  }
}

function buildPayloadFromAnalysis(analysis: PageAnalysis): SaveSignalPayload {
  const note = [
    analysis.youtube?.currentTimestamp ? `[${analysis.youtube.currentTimestamp}]` : '',
    analysis.selectedText,
    analysis.loginRequired ? 'Login required to view full content' : '',
  ]
    .filter(Boolean)
    .join(' ')
    .trim()

  return {
    url: analysis.url,
    title: analysis.youtube?.title || analysis.title,
    type: mapIntentToSignalType(analysis.pageType, analysis.isPDF, analysis.hasVideo, analysis.url),
    intent: analysis.pageType,
    note: note || undefined,
    selectedText: analysis.selectedText || undefined,
    metadata: {
      domain: analysis.domain,
      ogImage: analysis.ogImage,
      readTimeMinutes: analysis.youtube?.duration ? undefined : analysis.readTimeMinutes,
      wordCount: analysis.loginRequired ? undefined : analysis.wordCount,
    },
  }
}

async function saveCapturePayload(payload: SaveSignalPayload): Promise<{ signalId: string; title: string }> {
  if (!navigator.onLine) {
    await saveDraftLocally(payload)
    throw new Error('offline')
  }

  const response = await saveSignal(payload)
  if (!response.success || !response.signalId) {
    throw new Error('save_failed')
  }

  return { signalId: response.signalId, title: payload.title }
}

async function openLoginTab(baseUrl: string): Promise<void> {
  const created = await chrome.tabs.create({ url: buildAppUrl(baseUrl, '/login') })
  if (typeof created.id === 'number') {
    loginTabIds.add(created.id)
  }
}

async function handleInstantSave(tab: chrome.tabs.Tab): Promise<void> {
  const baseUrl = await syncBaseUrlFromTab(tab)
  const auth = await checkAuth().catch(() => ({ isLoggedIn: false as const }))

  if (!auth.isLoggedIn) {
    await openLoginTab(baseUrl)
    await notify('Sutra', 'Sign in to Sutra first.')
    return
  }

  const tabId = tab.id
  if (typeof tabId !== 'number') {
    return
  }

  const analysis = await captureTab(tabId, tab)
  const payload = analysis ? buildPayloadFromAnalysis(analysis) : buildFallbackPayload(tab)
  if (!payload) {
    await notify('Sutra', 'Cannot save this type of page.')
    return
  }

  try {
    const result = await saveCapturePayload(payload)
    const dashboardUrl = buildAppUrl(baseUrl, '/dashboard')
    const notificationId = await notify('Saved to Sutra', truncate(result.title, 50), [{ title: 'View in Sutra' }])
    notificationLinks.set(notificationId, dashboardUrl)
  } catch (error) {
    if (error instanceof Error && error.message === 'offline') {
      await notify('Sutra', 'Offline. Saved draft locally and will sync later.')
      return
    }

    await notify('Sutra', 'Could not save this page right now.')
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'sutra-save-link',
    title: 'Save link to Sutra',
    contexts: ['link'],
  })

  chrome.contextMenus.create({
    id: 'sutra-save-selection',
    title: 'Save selection to Sutra',
    contexts: ['selection'],
  })
})

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const baseUrl = await syncBaseUrlFromTab(tab)

  if (info.menuItemId === 'sutra-save-link' && info.linkUrl) {
    const pending: ContextPendingCapture = {
      url: info.linkUrl,
      title: info.selectionText || info.linkUrl,
    }

    await chrome.storage.local.set({ [PRELOAD_KEY]: pending })
    if ('openPopup' in chrome.action) {
      await chrome.action.openPopup()
    } else {
      await notify('Sutra', 'Click the extension to finish saving this link.')
    }
    return
  }

  if (info.menuItemId === 'sutra-save-selection' && info.selectionText) {
    const auth = await checkAuth().catch(() => ({ isLoggedIn: false as const }))
    if (!auth.isLoggedIn) {
      await openLoginTab(baseUrl)
      return
    }

    try {
      await savePlainNote(info.selectionText, truncate(info.selectionText, 80))
      await notify('Saved to Sutra', 'Saved selection to Sutra.')
    } catch {
      await notify('Sutra', 'Could not save selection.')
    }
  }
})

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || typeof tab.url !== 'string') {
    return
  }

  const origin = resolveSutraOrigin(tab.url)
  if (!origin || !tab.url.startsWith(buildAppUrl(origin, '/dashboard'))) {
    return
  }

  await setBaseUrl(origin)

  if (!loginTabIds.has(tabId)) {
    return
  }

  const auth = await checkAuth().catch(() => ({ isLoggedIn: false as const }))
  if (!auth.isLoggedIn) {
    return
  }

  loginTabIds.delete(tabId)
  await cacheAuthState(auth)
  await chrome.tabs.remove(tabId)
  await notify('Sutra', 'Signed in. Click the extension to capture again.')
})

chrome.tabs.onRemoved.addListener((tabId) => {
  loginTabIds.delete(tabId)
})

chrome.runtime.onStartup.addListener(() => {
  void syncDrafts()
})

chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  if (buttonIndex !== 0) {
    return
  }

  const url = notificationLinks.get(notificationId)
  if (!url) {
    return
  }

  void chrome.tabs.create({ url })
})

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command !== '_execute_action' && command !== 'save-current-page') {
    return
  }

  if (!tab) {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (activeTab) {
      await handleInstantSave(activeTab)
    }
    return
  }

  await handleInstantSave(tab)
})

chrome.runtime.onMessage.addListener((message: { type: string; signalId?: string; note?: string }) => {
  if (message.type === 'ADD_TO_RESURFACE' && message.signalId) {
    void addToResurface(message.signalId, message.note)
  }
})