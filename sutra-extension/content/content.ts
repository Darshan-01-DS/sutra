const INTENT_META = {
  'Watch Later': { label: 'Watch Later', icon: 'play' },
  'Deep Read': { label: 'Deep Read', icon: 'book' },
  'Code Reference': { label: 'Code Reference', icon: 'code' },
  'Research Paper': { label: 'Research Paper', icon: 'beaker' },
  'Tweet / Thread': { label: 'Tweet / Thread', icon: 'x' },
  'Learn': { label: 'Learn', icon: 'lightbulb' },
  'PDF Document': { label: 'PDF Document', icon: 'document' },
  'Video': { label: 'Video', icon: 'play' },
  'Discussion': { label: 'Discussion', icon: 'bubble' },
  'Article': { label: 'Article', icon: 'newspaper' },
  'Hackathon Idea': { label: 'Hackathon Idea', icon: 'spark' },
  'Note to Self': { label: 'Note to Self', icon: 'note' }
} as const;

type IntentLabel = keyof typeof INTENT_META;

interface YouTubeMetadata {
  title: string;
  channelName?: string;
  duration?: string;
  currentTimestamp?: string;
}

interface PageAnalysis {
  url: string;
  title: string;
  domain: string;
  description?: string;
  ogImage?: string;
  favicon: string;
  wordCount: number;
  readTimeMinutes: number;
  isYouTube: boolean;
  isPDF: boolean;
  hasVideo: boolean;
  selectedText: string;
  pageType: IntentLabel;
  youtube?: YouTubeMetadata;
  loginRequired: boolean;
  rawTitle: string;
}

type ContentMessage = { type: 'GET_PAGE_ANALYSIS' } | { type: 'PING' };

interface ContentResponse {
  ok: boolean;
  data?: PageAnalysis;
}

function countWords(input: string): number {
  const normalized = input.replace(/\s+/g, ' ').trim();
  return normalized ? normalized.split(' ').length : 0;
}

function detectIntent(input: { url: string; title: string; wordCount: number; hasArticle: boolean; hasVideo: boolean; isPdf: boolean }): IntentLabel {
  const normalizedUrl = input.url.toLowerCase();
  const normalizedTitle = input.title.toLowerCase();

  if (normalizedUrl.includes('youtube.com') || normalizedUrl.includes('youtu.be')) return 'Watch Later';
  if (normalizedUrl.includes('github.com')) return 'Code Reference';
  if (normalizedUrl.includes('arxiv.org') || normalizedUrl.includes('scholar.google') || normalizedUrl.includes('pubmed') || normalizedUrl.includes('semanticscholar')) return 'Research Paper';
  if (input.hasArticle && input.wordCount > 800) return 'Deep Read';
  if (input.wordCount < 400 && (normalizedUrl.includes('twitter.com') || normalizedUrl.includes('x.com'))) return 'Tweet / Thread';
  if (normalizedUrl.includes('reddit.com')) return 'Discussion';
  if (/\b(tutorial|how to|guide|learn)\b/.test(normalizedTitle)) return 'Learn';
  if (input.isPdf || normalizedUrl.endsWith('.pdf')) return 'PDF Document';
  if (input.hasVideo) return 'Video';
  return 'Article';
}

function getMetaContent(selector: string): string | undefined {
  const content = document.querySelector<HTMLMetaElement>(selector)?.content?.trim();
  return content || undefined;
}

function normalizeUrl(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  try {
    return new URL(value, window.location.href).toString();
  } catch {
    return undefined;
  }
}

function getFavicon(): string {
  return document.querySelector<HTMLLinkElement>('link[rel*="icon"]')?.href || `${window.location.origin}/favicon.ico`;
}

function isLikelyLoginWall(): boolean {
  const bodyText = document.body?.innerText?.toLowerCase() ?? '';
  return ['sign in to continue', 'log in to continue', 'join to view', 'login required'].some((marker) => bodyText.includes(marker));
}

function safeTitle(url: string, title: string): string {
  const trimmed = title.trim();
  if (trimmed) return trimmed;
  try {
    return new URL(url).hostname;
  } catch {
    return 'Untitled';
  }
}

function formatTimestamp(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  const rounded = Math.floor(seconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const remainingSeconds = rounded % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
    : `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

function getYouTubeData(pageTitle: string): YouTubeMetadata | undefined {
  if (!(window.location.hostname.includes('youtube.com') || window.location.hostname.includes('youtu.be'))) return undefined;

  const strippedTitle = pageTitle.replace(/\s*-\s*YouTube$/i, '').trim();
  const authorMeta = document.querySelector<HTMLMetaElement>('meta[itemprop="author"]')?.content?.trim();
  const videoElement = document.querySelector<HTMLVideoElement>('video');
  const currentTimestamp = videoElement ? formatTimestamp(videoElement.currentTime) : '';
  let duration = document.querySelector<HTMLElement>('.ytp-time-duration')?.textContent?.trim() ?? '';

  if (!duration && videoElement && Number.isFinite(videoElement.duration)) {
    duration = formatTimestamp(videoElement.duration);
  }

  const initialData = Reflect.get(window as unknown as Record<string, unknown>, 'ytInitialData');
  let channelName = authorMeta;
  if (!channelName && typeof initialData === 'object' && initialData) {
    const match = JSON.stringify(initialData).match(/"ownerChannelName":"([^"]+)"/);
    if (match?.[1]) channelName = match[1];
  }

  return {
    title: strippedTitle || safeTitle(window.location.href, pageTitle),
    channelName: channelName || undefined,
    duration: duration || undefined,
    currentTimestamp: currentTimestamp || undefined
  };
}

function extractPageMetadata(): PageAnalysis {
  const url = window.location.href;
  const rawTitle = document.title ?? '';
  const title = safeTitle(url, rawTitle);
  const domain = window.location.hostname;
  const bodyText = document.body?.innerText ?? '';
  const wordCount = countWords(bodyText);
  const description = getMetaContent('meta[name="description"]') ?? getMetaContent('meta[property="og:description"]');
  const ogImage = normalizeUrl(getMetaContent('meta[property="og:image"]'));
  const selectedText = window.getSelection?.()?.toString().trim().slice(0, 280) ?? '';
  const isPDF = url.toLowerCase().endsWith('.pdf') || document.contentType === 'application/pdf';
  const hasVideo = Boolean(document.querySelector('video'));
  const pageType = detectIntent({
    url,
    title,
    wordCount,
    hasArticle: Boolean(document.querySelector('article')),
    hasVideo,
    isPdf: isPDF
  });

  return {
    url,
    title,
    rawTitle,
    domain,
    description,
    ogImage,
    favicon: normalizeUrl(getFavicon()) ?? `${window.location.origin}/favicon.ico`,
    wordCount,
    readTimeMinutes: Math.max(1, Math.ceil(wordCount / 238)),
    isYouTube: url.includes('youtube.com') || url.includes('youtu.be'),
    isPDF,
    hasVideo,
    selectedText,
    pageType,
    youtube: getYouTubeData(title),
    loginRequired: isLikelyLoginWall()
  };
}

function respondWithAnalysis(sendResponse: (response: ContentResponse) => void): void {
  try {
    sendResponse({ ok: true, data: extractPageMetadata() });
  } catch {
    sendResponse({ ok: false });
  }
}

chrome.runtime.onMessage.addListener((message: ContentMessage, _sender, sendResponse) => {
  if (message.type === 'PING') {
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === 'GET_PAGE_ANALYSIS') {
    respondWithAnalysis(sendResponse);
    return true;
  }

  return false;
});
