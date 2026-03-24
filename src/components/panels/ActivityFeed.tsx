'use client'
// src/components/panels/ActivityFeed.tsx

import { StatsData } from '@/types'
import { timeAgo } from '@/lib/utils'

interface Props { stats: StatsData | null; loading: boolean }

const ACT_COLORS: Record<string, string> = {
  saved:        '#C9A96E',
  tagged:       '#9B8FF5',
  linked:       '#4ECDC4',
  viewed:       '#E8705A',
  highlighted:  '#C9A96E',
  cluster_grew: '#6BCB77',
}

export function ActivityFeed({ stats, loading }: Props) {
  const activities = stats?.recentActivity ?? []

  if (loading) {
    return (
      <div>
        <div className="rp-section-label">Recent activity</div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{ display: 'flex', gap: 9, marginBottom: 11 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--border2)', marginTop: 5, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div className="skeleton" style={{ height: 14, borderRadius: 4, marginBottom: 4 }} />
              <div className="skeleton" style={{ height: 10, borderRadius: 4, width: '40%' }} />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (!activities.length) {
    return (
      <div>
        <div className="rp-section-label">Recent activity</div>
        <div style={{ color: 'var(--text3)', fontSize: 12, padding: '12px 0' }}>
          Activity appears as you save and explore signals
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="rp-section-label">Recent activity</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
        {activities.slice(0, 10).map((act: any) => (
          <div key={act._id} className="act-item">
            <div className="act-dot" style={{ background: ACT_COLORS[act.type] ?? 'var(--accent)' }} />
            <div>
              <div className="act-text" dangerouslySetInnerHTML={{
                __html: act.message.replace(/"([^"]+)"/g, '<strong>"$1"</strong>')
              }} />
              <div className="act-time">{timeAgo(act.createdAt)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
