'use client'
// src/components/layout/RightPanel.tsx

import { useEffect, useState } from 'react'
import { StatsData, SignalType } from '@/types'
import { KnowledgeGraph } from '@/components/panels/KnowledgeGraph'
import { TopicClusters } from '@/components/panels/TopicClusters'
import { ActivityFeed } from '@/components/panels/ActivityFeed'
import { AskAI } from '@/components/panels/AskAI'

interface RightPanelProps {
  tab: 'graph' | 'topics' | 'activity' | 'ask'
  onTabChange: (t: 'graph' | 'topics' | 'activity' | 'ask') => void
  stats: StatsData | null
  statsLoading: boolean
  onTopicClick: (topic: string) => void
  onQuickSave: (data: { url?: string; content?: string; type?: SignalType }) => void
  onOpenGraphFullscreen: () => void
  onOpenDrawer?: (id: string) => void
  saving: boolean
  apiKey?: string
}

export function RightPanel({
  tab, onTabChange, stats, statsLoading, onTopicClick, onQuickSave, onOpenGraphFullscreen, onOpenDrawer, saving, apiKey
}: RightPanelProps) {
  const [quickUrl, setQuickUrl] = useState('')
  const [tweetMsg, setTweetMsg] = useState('')

  // Clear tweet message after 3s
  useEffect(() => {
    if (!tweetMsg) return
    const t = setTimeout(() => setTweetMsg(''), 3000)
    return () => clearTimeout(t)
  }, [tweetMsg])

  const handleQuickSave = () => {
    if (!quickUrl.trim()) return
    const isUrl = /^https?:\/\//.test(quickUrl.trim())
    if (isUrl) {
      onQuickSave({ url: quickUrl.trim() })
    } else {
      onQuickSave({ content: quickUrl.trim() })
    }
    setQuickUrl('')
  }

  const handleTweetSave = () => {
    const u = quickUrl.trim()
    if (!u) {
      setTweetMsg('Paste a Twitter/X URL first')
      return
    }
    if (!u.includes('x.com') && !u.includes('twitter.com')) {
      setTweetMsg('Not a Twitter/X URL')
      return
    }
    onQuickSave({ url: u, type: 'tweet' })
    setQuickUrl('')
    setTweetMsg('Tweet saved!')
  }

  const TABS: { id: 'graph' | 'topics' | 'activity' | 'ask'; label: string }[] = [
    { id: 'graph',    label: 'Graph' },
    { id: 'topics',   label: 'Topics' },
    { id: 'activity', label: 'Activity' },
    { id: 'ask',      label: '✦ Ask' },
  ]

  return (
    <aside className="rpanel">
      <div className="rp-head">
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6.5" stroke="var(--accent)" strokeWidth="1.2"/>
          <circle cx="8" cy="8" r="2" fill="var(--accent)"/>
          <line x1="8" y1="1.5" x2="8" y2="4"    stroke="var(--accent)" strokeWidth="1.2"/>
          <line x1="8" y1="12"  x2="8" y2="14.5" stroke="var(--accent)" strokeWidth="1.2"/>
          <line x1="1.5" y1="8" x2="4"    y2="8" stroke="var(--accent)" strokeWidth="1.2"/>
          <line x1="12"  y1="8" x2="14.5" y2="8" stroke="var(--accent)" strokeWidth="1.2"/>
        </svg>
        <div className="rp-head-title">Knowledge panel</div>
      </div>

      <div className="rp-tabs">
        {TABS.map(t => (
          <button key={t.id} className={`rpt ${tab === t.id ? 'on' : ''}`} onClick={() => onTabChange(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="rp-body">
        {tab === 'graph'    && <KnowledgeGraph stats={stats} loading={statsLoading} onOpenFullscreen={onOpenGraphFullscreen} />}
        {tab === 'topics'   && <TopicClusters stats={stats} loading={statsLoading} onTopicClick={onTopicClick} />}
        {tab === 'activity' && <ActivityFeed stats={stats} loading={statsLoading} />}
        {tab === 'ask'      && <AskAI onOpenDrawer={onOpenDrawer} apiKey={apiKey} />}
      </div>

      {/* Quick save — hidden on the Ask tab */}
      {tab !== 'ask' && (
        <div className="rp-save">
          <input
            className="save-field"
            type="text"
            placeholder="Paste URL, tweet link, or quick note…"
            value={quickUrl}
            onChange={e => setQuickUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleQuickSave()}
          />
          {tweetMsg && (
            <div className="rp-tweet-msg" style={{ color: tweetMsg.includes('saved') ? 'var(--green)' : 'var(--coral)' }}>
              {tweetMsg}
            </div>
          )}
          <div className="save-row">
            <button
              className="sb"
              onClick={handleTweetSave}
              title="Save as Tweet (paste X/Twitter URL above)"
            >
              𝕏 Tweet
            </button>
            <button className="sb prime" onClick={handleQuickSave} disabled={saving || !quickUrl.trim()}>
              {saving ? '…' : 'Save →'}
            </button>
          </div>
        </div>
      )}
    </aside>
  )
}
