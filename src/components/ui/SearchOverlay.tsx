'use client'
// src/components/ui/SearchOverlay.tsx

import { useState, useEffect, useRef, useCallback } from 'react'
import { TYPE_CONFIG } from '@/lib/utils'

interface SearchResult {
  _id: string
  title: string
  type: string
  source?: string
  tags: string[]
  createdAt: string
  matchType: 'semantic' | 'keyword'
  url?: string
}

interface Props {
  onClose: () => void
  onOpenSignal: (id: string) => void
}

export function SearchOverlay({ onClose, onOpenSignal }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)
  const debounce = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setSelectedIndex(0); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setResults(data.data ?? [])
      setSelectedIndex(0)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value
    setQuery(q)
    clearTimeout(debounce.current)
    debounce.current = setTimeout(() => search(q), 300)
  }

  const handleResultClick = (result: SearchResult) => {
    if (result.url) {
      window.open(result.url, '_blank', 'noopener,noreferrer')
    }
    onOpenSignal(result._id)
    onClose()
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
      return
    }
    
    if (results.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : prev))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : prev))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      handleResultClick(results[selectedIndex])
    }
  }

  // Scroll active item into view
  useEffect(() => {
    if (resultsRef.current && results.length > 0) {
      const activeEl = resultsRef.current.children[selectedIndex] as HTMLElement
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [selectedIndex, results.length])

  return (
    <div className="search-overlay" onClick={onClose}>
      <div className="search-modal" onClick={e => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="search-modal-input"
          placeholder="Search your knowledge… try a concept, not just a keyword"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKey}
        />

        <div className="search-results" ref={resultsRef}>
          {loading && (
            <div className="search-empty">Searching…</div>
          )}

          {!loading && query && results.length === 0 && (
            <div className="search-empty">
              No results for &ldquo;{query}&rdquo;
            </div>
          )}

          {!loading && !query && (
            <div className="search-empty" style={{ padding: '24px' }}>
              Type to search across all your signals — semantically
            </div>
          )}

          {results.map((r, i) => {
            const cfg = TYPE_CONFIG[r.type as keyof typeof TYPE_CONFIG] ?? TYPE_CONFIG.article
            const isSelected = i === selectedIndex
            return (
              <div
                key={r._id}
                className="search-result-item"
                style={isSelected ? { borderColor: 'var(--accent)', background: 'var(--bg4)' } : undefined}
                onClick={() => handleResultClick(r)}
              >
                <span className={`search-result-type ${cfg.badgeClass}`}>{cfg.label}</span>
                <div className="search-result-title">{r.title}</div>
                <div className="search-result-match" style={{ color: r.matchType === 'semantic' ? 'var(--violet)' : 'var(--text3)' }}>
                  {r.matchType}
                </div>
              </div>
            )
          })}
        </div>

        {results.length > 0 && (
          <div style={{
            padding: '8px 12px',
            borderTop: '1px solid var(--border)',
            fontSize: 11,
            color: 'var(--text3)',
            display: 'flex',
            gap: 12,
          }}>
            <span>{results.length} results</span>
            <span style={{ color: 'var(--violet)' }}>● semantic</span>
            <span style={{ color: 'var(--text3)' }}>● keyword</span>
            <span style={{ marginLeft: 'auto' }}>↵ to open · Esc to close</span>
          </div>
        )}
      </div>
    </div>
  )
}
