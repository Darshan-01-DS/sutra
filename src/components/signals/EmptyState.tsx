'use client'

import type { SignalType } from '@/types'

const SVG_COMMON_PROPS = {
  width: 72,
  height: 72,
  viewBox: '0 0 72 72',
  fill: 'none',
  xmlns: 'http://www.w3.org/2000/svg',
} as const

function Base({ children }: { children: React.ReactNode }) {
  return (
    <svg {...SVG_COMMON_PROPS}>
      <defs>
        <linearGradient id="g" x1="10" y1="10" x2="62" y2="62" gradientUnits="userSpaceOnUse">
          <stop stopColor="rgba(201,169,110,0.95)" />
          <stop offset="1" stopColor="rgba(155,143,245,0.95)" />
        </linearGradient>
      </defs>
      {children}
    </svg>
  )
}

export function EmptyState({
  type,
}: {
  type: SignalType | 'all' | 'resurface' | 'collections'
}) {
  const tone = (() => {
    switch (type) {
      case 'tweet':
        return { a: '#4ECDC4', b: '#9B8FF5' }
      case 'video':
        return { a: '#E8705A', b: '#4ECDC4' }
      case 'pdf':
        return { a: '#C9A96E', b: '#E8705A' }
      case 'image':
        return { a: '#6BCB77', b: '#C9A96E' }
      case 'note':
        return { a: '#C9A96E', b: '#4ECDC4' }
      case 'link':
        return { a: '#4ECDC4', b: '#9B8FF5' }
      case 'collections':
        return { a: '#9B8FF5', b: '#C9A96E' }
      case 'resurface':
        return { a: '#E8705A', b: '#9B8FF5' }
      case 'article':
      default:
        return { a: '#9B8FF5', b: '#4ECDC4' }
    }
  })()

  const { a, b } = tone

  return (
    <div style={{ display: 'grid', placeItems: 'center', gap: 14 }}>
      <Base>
        <circle cx="36" cy="36" r="26" stroke={a} strokeOpacity="0.35" strokeWidth="1.5" />
        <path
          d="M24 36c7-15 17-15 24 0-7 15-17 15-24 0Z"
          fill="url(#g)"
          opacity="0.18"
        />
        <path
          d="M25 45c7-6 15-9 22-10"
          stroke={a}
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.85"
        />
        <path
          d="M28 24h16"
          stroke={b}
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.65"
        />
      </Base>
    </div>
  )
}

