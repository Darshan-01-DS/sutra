'use client'
// src/components/panels/AskAI.tsx
// RAG-powered question answering from your personal knowledge base

import { useState, useRef, useCallback, useEffect } from 'react'

interface Source {
  _id: string
  title: string
  url?: string
  source?: string
  type: string
  score: number
}

interface AskResult {
  answer: string
  sources: Source[]
  fallback?: boolean
}

interface AskAIProps {
  onOpenDrawer?: (id: string) => void
  apiKey?: string
}

export function AskAI({ onOpenDrawer, apiKey }: AskAIProps) {
  const [question, setQuestion] = useState('')
  const [result, setResult] = useState<AskResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [hasKey, setHasKey] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const storedKey = apiKey || (typeof window !== 'undefined' ? localStorage.getItem('sutra_openai_api_key') : null)
    setHasKey(!!storedKey?.trim())
  }, [apiKey])

  const ask = useCallback(async () => {
    const q = question.trim()
    if (!q || loading) return

    setLoading(true)
    setError('')
    setResult(null)

    try {
      const key = apiKey || (typeof window !== 'undefined' ? localStorage.getItem('sutra_openai_api_key') ?? undefined : undefined)
      const provider = typeof window !== 'undefined' ? localStorage.getItem('sutra_ai_provider') ?? 'openai' : 'openai'
      const baseUrl = typeof window !== 'undefined' ? localStorage.getItem('sutra_ai_base_url') ?? undefined : undefined
      const model = typeof window !== 'undefined' ? localStorage.getItem('sutra_ai_model') ?? undefined : undefined

      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (key) headers['x-openai-api-key'] = key
      if (provider) headers['x-ai-provider'] = provider
      if (baseUrl) headers['x-ai-base-url'] = baseUrl
      if (model) headers['x-ai-model'] = model

      const res = await fetch('/api/ask', {
        method: 'POST',
        headers,
        body: JSON.stringify({ question: q }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to get answer')
        return
      }
      setResult(data)
    } catch (e: any) {
      setError(e?.message ?? 'Network error')
    } finally {
      setLoading(false)
    }
  }, [question, loading, apiKey])

  const typeIcons: Record<string, string> = {
    article: '▤', tweet: '𝕏', video: '▶', pdf: '⬚', image: '⊡', note: '✎',
  }

  return (
    <div className="ask-ai-panel">
      <div className="ask-ai-header">
        <span className="ask-ai-icon">✦</span>
        <div>
          <div className="ask-ai-title">Ask your knowledge</div>
          <div className="ask-ai-sub">Answers from your saved signals</div>
        </div>
      </div>

      {!hasKey && (
        <div style={{ padding: '12px 16px', background: 'var(--bg3)', color: '#E8705A', borderRadius: 'var(--r)', fontSize: 13, border: '1px solid #E8705A40', marginBottom: 16 }}>
          <span style={{ marginRight: 6 }}>⚠</span> Add your AI Provider API key in <strong>Account → AI & Keys</strong> to enable AI answers.
        </div>
      )}

      <div className="ask-ai-input-row">
        <input
          ref={inputRef}
          className="ask-ai-input"
          type="text"
          placeholder="Ask anything about your library…"
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && ask()}
          disabled={loading}
        />
        <button
          className="ask-ai-btn"
          onClick={ask}
          disabled={loading || !question.trim()}
          title="Ask"
        >
          {loading ? '…' : '→'}
        </button>
      </div>

      {loading && (
        <div className="ask-ai-loading">
          <div className="ask-ai-dots">
            <span /><span /><span />
          </div>
          <span>Searching your knowledge base…</span>
        </div>
      )}

      {error && (
        <div className="ask-ai-error">
          <span>⚠</span> {error}
        </div>
      )}

      {result && (
        <div className="ask-ai-result">
          {result.fallback && (
            <div className="ask-ai-fallback-note">
              💡 Using keyword search (no AI embeddings yet — add API key to enable semantic search)
            </div>
          )}
          <div className="ask-ai-answer">
            {result.answer.split('\n').map((line, i) => (
              <p key={i} style={{ margin: '4px 0' }}>{line}</p>
            ))}
          </div>

          {result.sources.length > 0 && (
            <div className="ask-ai-sources">
              <div className="ask-ai-sources-label" style={{ display: 'inline-block', background: 'var(--bg5)', color: 'var(--text2)', padding: '2px 8px', borderRadius: 10, fontSize: 10, marginBottom: 8 }}>
                Sources used: {result.sources.length} signals
              </div>
              {result.sources.map((s, i) => (
                <button
                  key={s._id}
                  className="ask-ai-source-item"
                  onClick={() => onOpenDrawer?.(s._id)}
                  title="Open signal"
                >
                  <span className="ask-ai-source-icon">{typeIcons[s.type] ?? '◈'}</span>
                  <span className="ask-ai-source-num">[{i + 1}]</span>
                  <span className="ask-ai-source-title">{s.title.slice(0, 50)}</span>
                  <span className="ask-ai-source-score">{Math.round(s.score * 100)}%</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
