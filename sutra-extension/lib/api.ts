const DEFAULT_BASE_URL = 'https://sutra-three.vercel.app';
const BASE_URL_KEY = 'sutra_base_url';
const REQUEST_TIMEOUT_MS = 10_000;
const RETRY_ATTEMPTS = 1;
const DRAFT_STORAGE_KEY = 'sutra_drafts';

export interface SutraUser {
  name: string;
  email: string;
  avatar?: string;
}

export interface Collection {
  id: string;
  name: string;
  emoji: string;
}

export interface SaveSignalPayload {
  url: string;
  title: string;
  type: 'article' | 'video' | 'tweet' | 'pdf' | 'note' | 'image';
  intent: string;
  note?: string;
  collectionId?: string;
  selectedText?: string;
  metadata: {
    domain: string;
    ogImage?: string;
    readTimeMinutes?: number;
    wordCount?: number;
  };
}

export interface SaveSignalResponse {
  signalId: string;
  tags: string[];
  success: boolean;
}

export interface AuthResponse {
  isLoggedIn: boolean;
  user?: SutraUser;
}

export interface DuplicateSignal {
  id: string;
  title: string;
  url: string;
}

export interface DraftSignal {
  id: string;
  createdAt: number;
  payload: SaveSignalPayload;
}

interface SessionUserResponse {
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

interface SignalsListResponse {
  data?: Array<{ _id?: string; title?: string; url?: string }>;
}

interface CollectionsApiResponseItem {
  _id?: string;
  id?: string;
  name?: string;
  icon?: string;
  emoji?: string;
}

interface SaveApiResponse {
  _id?: string;
  id?: string;
  tags?: unknown;
}

export class ApiError extends Error {
  public readonly status?: number;
  public readonly code: 'network' | 'timeout' | 'http' | 'unknown';

  constructor(message: string, code: 'network' | 'timeout' | 'http' | 'unknown', status?: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/$/, '');
}

export async function getBaseUrl(): Promise<string> {
  const stored = await chrome.storage.local.get(BASE_URL_KEY);
  const configured = stored[BASE_URL_KEY];
  return typeof configured === 'string' && configured.trim() ? normalizeBaseUrl(configured) : DEFAULT_BASE_URL;
}

export async function setBaseUrl(url: string): Promise<void> {
  await chrome.storage.local.set({ [BASE_URL_KEY]: normalizeBaseUrl(url) });
}

async function requestJson<T>(input: string, init: RequestInit, attempt = 0): Promise<T> {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const baseUrl = await getBaseUrl();

  try {
    const response = await fetch(`${baseUrl}${input}`, {
      ...init,
      credentials: 'include',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers ?? {})
      }
    });

    if (!response.ok) {
      const message = response.status === 401 ? 'Unauthorized' : `Request failed with status ${response.status}`;
      throw new ApiError(message, 'http', response.status);
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      if (attempt < RETRY_ATTEMPTS) return requestJson<T>(input, init, attempt + 1);
      throw new ApiError('Request timed out', 'timeout');
    }
    if (attempt < RETRY_ATTEMPTS) return requestJson<T>(input, init, attempt + 1);
    if (error instanceof Error) throw new ApiError(error.message || 'Network error', 'network');
    throw new ApiError('Unknown network error', 'unknown');
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

function normalizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return tags.filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0);
}

function buildSaveBody(payload: SaveSignalPayload): Record<string, unknown> {
  if (payload.type === 'note') {
    return {
      content: payload.selectedText || payload.note || payload.url,
      title: payload.title,
      type: 'note',
      tags: [payload.intent.toLowerCase()],
      collectionIds: payload.collectionId ? [payload.collectionId] : []
    };
  }

  return {
    url: payload.url,
    title: payload.title,
    type: payload.type,
    content: payload.note || payload.selectedText || '',
    tags: [payload.intent.toLowerCase()],
    collectionIds: payload.collectionId ? [payload.collectionId] : []
  };
}

export async function saveSignal(payload: SaveSignalPayload): Promise<SaveSignalResponse> {
  const response = await requestJson<SaveApiResponse>('/api/signals', { method: 'POST', body: JSON.stringify(buildSaveBody(payload)) });
  return { signalId: response._id ?? response.id ?? '', tags: normalizeTags(response.tags), success: Boolean(response._id ?? response.id) };
}

export async function addToResurface(signalId: string, note?: string): Promise<void> {
  await requestJson<Record<string, unknown>>(`/api/signals/${signalId}`, {
    method: 'PATCH',
    body: JSON.stringify({ addedToResurface: true, resurfaceNote: note ?? '' })
  });
}

export async function getCollections(): Promise<Array<{ id: string; name: string; emoji: string }>> {
  const response = await requestJson<CollectionsApiResponseItem[]>('/api/collections', { method: 'GET' });
  return response
    .filter((item) => typeof item.name === 'string' && item.name.trim().length > 0)
    .map((item) => ({ id: item._id ?? item.id ?? '', name: item.name ?? 'Untitled', emoji: item.emoji ?? item.icon ?? '??' }))
    .filter((item) => item.id.length > 0)
    .slice(0, 50);
}

export async function createCollection(name: string, emoji: string): Promise<Collection> {
  const response = await requestJson<CollectionsApiResponseItem>('/api/collections', {
    method: 'POST',
    body: JSON.stringify({ name, icon: emoji, color: '#C9A96E' })
  });
  const id = response._id ?? response.id ?? '';
  if (!id) throw new ApiError('Failed to create collection', 'unknown');
  return { id, name: response.name ?? name, emoji: response.emoji ?? response.icon ?? emoji };
}

export async function checkAuth(): Promise<{ isLoggedIn: boolean; user?: { name: string; email: string; avatar?: string } }> {
  try {
    const response = await requestJson<SessionUserResponse>('/api/auth/session', { method: 'GET' });
    if (!response.user?.email) return { isLoggedIn: false };
    return {
      isLoggedIn: true,
      user: {
        name: response.user.name ?? response.user.email,
        email: response.user.email,
        avatar: response.user.image ?? undefined
      }
    };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return { isLoggedIn: false };
    throw error;
  }
}

export async function findDuplicate(url: string): Promise<DuplicateSignal | null> {
  const response = await requestJson<SignalsListResponse>(`/api/signals?url=${encodeURIComponent(url)}&limit=50`, { method: 'GET' });
  const match = response.data?.find((item) => item.url === url);
  if (!match?._id || !match.url) return null;
  return { id: match._id, title: match.title ?? 'Saved signal', url: match.url };
}

export async function savePlainNote(content: string, title: string): Promise<SaveSignalResponse> {
  const response = await requestJson<SaveApiResponse>('/api/signals', {
    method: 'POST',
    body: JSON.stringify({ content, title, type: 'note' })
  });
  return { signalId: response._id ?? response.id ?? '', tags: normalizeTags(response.tags), success: Boolean(response._id ?? response.id) };
}

async function getDrafts(): Promise<DraftSignal[]> {
  const stored = await chrome.storage.local.get(DRAFT_STORAGE_KEY);
  const drafts = stored[DRAFT_STORAGE_KEY];
  if (!Array.isArray(drafts)) return [];
  return drafts.filter((draft): draft is DraftSignal => typeof draft === 'object' && draft !== null && 'id' in draft && 'payload' in draft && 'createdAt' in draft);
}

export async function saveDraftLocally(payload: SaveSignalPayload): Promise<void> {
  const drafts = await getDrafts();
  drafts.push({ id: crypto.randomUUID(), createdAt: Date.now(), payload });
  await chrome.storage.local.set({ [DRAFT_STORAGE_KEY]: drafts });
}

export async function syncDrafts(): Promise<number> {
  const drafts = await getDrafts();
  if (!drafts.length) return 0;
  const pending: DraftSignal[] = [];
  let synced = 0;
  for (const draft of drafts) {
    try {
      await saveSignal(draft.payload);
      synced += 1;
    } catch {
      pending.push(draft);
    }
  }
  await chrome.storage.local.set({ [DRAFT_STORAGE_KEY]: pending });
  return synced;
}
