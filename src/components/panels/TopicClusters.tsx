'use client'
// src/components/panels/TopicClusters.tsx

import { StatsData } from '@/types'
import { getTopicColor } from '@/lib/utils'

const ICONS = ['⬡', '◈', '✦', '◎', '⬢', '◇']

interface Props { stats: StatsData | null; loading: boolean; onTopicClick: (t: string) => void }

export function TopicClusters({ stats, loading, onTopicClick }: Props) {
  const topics = stats?.topics ?? []
  const maxCount = Math.max(...topics.map(t => t.count), 1)

  if (loading) {
    return (
      <div>
        <div className="rp-section-label">Top topics this month</div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 52, borderRadius: 'var(--r)', marginBottom: 6 }} />
        ))}
      </div>
    )
  }

  if (!topics.length) {
    return (
      <div className="rp-empty" style={{ padding: '20px 0' }}>
        <div style={{ fontWeight: 500 }}>No topics yet</div>
        <div style={{ color: 'var(--text3)', fontSize: 12, marginTop: 4 }}>
          Topics appear after saving signals with AI tagging enabled
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="rp-section-label">Top topics this month</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {topics.slice(0, 10).map((topic, i) => {
          const color = getTopicColor(topic.name)
          const pct   = Math.round((topic.count / maxCount) * 100)
          return (
            <div key={topic.name} className="cluster-row" onClick={() => onTopicClick(topic.name)} title={`Filter by ${topic.name}`}>
              <div className="cluster-icon" style={{ background: `${color}18`, color }}>
                {ICONS[i % ICONS.length]}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
                  <div className="cluster-name" style={{ fontSize: 13, fontWeight: 500 }}>{topic.name}</div>
                  <div className="cluster-count" style={{ fontSize: 11, opacity: 0.6 }}>{topic.count}</div>
                </div>
                <div className="cluster-bar" style={{ height: 3, background: 'var(--bg4)', borderRadius: 2, overflow: 'hidden' }}>
                  <div className="cluster-fill" style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2 }} />
                </div>
              </div>
            </div>
          )
        })}
      </div>
      {topics.length > 10 && (
        <div style={{ fontSize: 11, textAlign: 'center', marginTop: 12, color: 'var(--text3)', fontStyle: 'italic' }}>
          + {topics.length - 10} more topics in your vault
        </div>
      )}
    </div>
  )
}
