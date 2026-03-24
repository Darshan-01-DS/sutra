'use client'
// src/components/signals/ResurfaceBanner.tsx

import { ResurfaceItem } from '@/types'

interface ResurfaceBannerProps {
  item: ResurfaceItem
  onDismiss: () => void
}

export function ResurfaceBanner({ item, onDismiss }: ResurfaceBannerProps) {
  return (
    <div className="resurface">
      <div className="resurface-dot">✦</div>
      <div>
        <div className="resurface-label">Memory resurfaced</div>
        <div className="resurface-text">
          <strong>{item.daysAgo} days ago</strong> you saved{' '}
          <strong>&ldquo;{item.signal.title.slice(0, 60)}{item.signal.title.length > 60 ? '…' : ''}&rdquo;</strong>
          {' '}— {item.reason}
        </div>
      </div>
      <button className="resurface-close" onClick={onDismiss}>×</button>
    </div>
  )
}
