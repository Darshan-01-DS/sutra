import { detectIntent, type IntentLabel } from './ai';

export interface YouTubeMetadata {
  title: string;
  channelName?: string;
  duration?: string;
  currentTimestamp?: string;
}

export interface PageAnalysis {
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

export function countWords(input: string): number {
  const normalized = input.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return 0;
  }
  return normalized.split(' ').length;
}

function getMetaContent(selector: string): string | undefined {
  const content = document.querySelector<HTMLMetaElement>(selector)?.content?.trim();
  return content || undefined;
}

function normalizeUrl(value: string | null | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  try {
    return new URL(value, window.location.href).toString();
  } catch {
    return undefined;
  }
}

function getFavicon(): string {
  const icon = document.querySelector<HTMLLinkElement>('link[rel*="icon"]')?.href;
  return icon || `${window.location.origin}/favicon.ico`;
}

function isLikelyLoginWall(): boolean {
  const bodyText = document.body?.innerText?.toLowerCase() ?? '';
  const markers = ['sign in to continue', 'log in to continue', 'join to view', 'login required'];
  return markers.some((marker) => bodyText.includes(marker));
}

function safeTitle(url: string, title: string): string {
  const trimmed = title.trim();
  if (trimmed) {
    return trimmed;
  }

  try {
    return new URL(url).hostname;
  } catch {
    return 'Untitled';
  }
}

function formatTimestamp(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '';
  }

  const rounded = Math.floor(seconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const remainingSeconds = rounded % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  }

  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

function getYouTubeData(pageTitle: string): YouTubeMetadata | undefined {
  const isYouTube = window.location.hostname.includes('youtube.com') || window.location.hostname.includes('youtu.be');
  if (!isYouTube) {
    return undefined;
  }

  const strippedTitle = pageTitle.replace(/\s*-\s*YouTube$/i, '').trim();
  const authorMeta = document.querySelector<HTMLMetaElement>('meta[itemprop="author"]')?.content?.trim();
  const videoElement = document.querySelector<HTMLVideoElement>('video');
  const currentTimestamp = videoElement ? formatTimestamp(videoElement.currentTime) : '';

  let duration = document.querySelector<HTMLElement>('.ytp-time-duration')?.textContent?.trim() ?? '';
  if (!duration && videoElement && Number.isFinite(videoElement.duration)) {
    duration = formatTimestamp(videoElement.duration);
  }

  const globalData = Reflect.get(window as unknown as Record<string, unknown>, 'ytInitialData');
  let channelName = authorMeta;
  if (!channelName && typeof globalData === 'object' && globalData) {
    const serialized = JSON.stringify(globalData);
    const match = serialized.match(/"ownerChannelName":"([^"]+)"/);
    if (match?.[1]) {
      channelName = match[1];
    }
  }

  return {
    title: strippedTitle || safeTitle(window.location.href, pageTitle),
    channelName: channelName || undefined,
    duration: duration || undefined,
    currentTimestamp: currentTimestamp || undefined
  };
}

export function extractPageMetadata(): PageAnalysis {
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
  const intent = detectIntent({
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
    pageType: intent.label,
    youtube: getYouTubeData(title),
    loginRequired: isLikelyLoginWall()
  };
}