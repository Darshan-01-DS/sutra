// src/lib/utils.ts
import { SignalType } from '@/types'
import { formatDistanceToNow } from 'date-fns'

export function timeAgo(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}

export const TYPE_CONFIG: Record<SignalType, {
  label: string
  icon: string
  badgeClass: string
  thumbClass: string
  color: string
}> = {
  article: {
    label: 'Article',
    icon: '▤',
    badgeClass: 'tb-a',
    thumbClass: 'thumb-art-a',
    color: '#9B8FF5',
  },
  tweet: {
    label: 'Tweet',
    icon: '𝕏',
    badgeClass: 'tb-t',
    thumbClass: 'thumb-art-t',
    color: '#4ECDC4',
  },
  video: {
    label: 'Video',
    icon: '▶',
    badgeClass: 'tb-v',
    thumbClass: 'thumb-art-v',
    color: '#E8705A',
  },
  pdf: {
    label: 'PDF',
    icon: '⬚',
    badgeClass: 'tb-p',
    thumbClass: 'thumb-art-p',
    color: '#C9A96E',
  },
  image: {
    label: 'Image',
    icon: '⊡',
    badgeClass: 'tb-i',
    thumbClass: 'thumb-art-i',
    color: '#6BCB77',
  },
  note: {
    label: 'Note',
    icon: '✎',
    badgeClass: 'tb-n',
    thumbClass: 'thumb-art-a',
    color: '#C9A96E',
  },
  link: {
    label: 'Link',
    icon: '↗',
    badgeClass: 'tb-l',
    thumbClass: 'thumb-art-t',
    color: '#4ECDC4',
  },
}

export function cx(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export function truncate(str: string, n: number): string {
  return str.length > n ? str.slice(0, n - 1) + '…' : str
}

export function detectTypeFromUrl(url: string): SignalType {
  const u = url.toLowerCase()
  if (u.includes('twitter.com') || u.includes('x.com')) return 'tweet'
  if (u.includes('youtube.com') || u.includes('youtu.be') || u.includes('vimeo.com')) return 'video'
  if (u.endsWith('.pdf')) return 'pdf'
  if (u.match(/\.(png|jpg|jpeg|gif|webp)$/)) return 'image'
  return 'article'
}

export const TOPIC_COLORS: Record<string, string> = {
  'Artificial Intelligence': '#9B8FF5',
  'Machine Learning': '#9B8FF5',
  'Product Design': '#4ECDC4',
  'UX Design': '#4ECDC4',
  'Startups': '#E8705A',
  'Entrepreneurship': '#E8705A',
  'Research': '#C9A96E',
  'Health': '#6BCB77',
  'Finance': '#6BCB77',
  'Technology': '#9B8FF5',
}

export function getTopicColor(topic: string): string {
  return TOPIC_COLORS[topic] ?? '#8A8895'
}
