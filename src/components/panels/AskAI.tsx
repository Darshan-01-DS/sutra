'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

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

function getStoredValue(key: string): string | undefined {
  if (typeof window === 'undefined') return undefined
  const value = window.localStorage.getItem(key)
  return value?.trim() ? value : undefined
}

export function AskAI({ onOpenDrawer, apiKey }: AskAIProps) {
  const [question, setQuestion] = useState('')
  const [result, setResult] = useState<AskResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const ask = useCallback(async () => {
    const trimmedQuestion = question.trim()
    if (!trimmedQuestion || loading) return

    setLoading(true)
    setError('')
    setResult(null)

    try {
      const key = apiKey || getStoredValue('sutra_openai_api_key')
      const provider = getStoredValue('sutra_ai_provider') || 'openai'
      const baseUrl = getStoredValue('sutra_ai_base_url')
      const model = getStoredValue('sutra_ai_model')

      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (key) headers['x-openai-api-key'] = key
      if (provider) headers['x-ai-provider'] = provider
      if (baseUrl) headers['x-ai-base-url'] = baseUrl
      if (model) headers['x-ai-model'] = model

      const response = await fetch('/api/ask', {
        method: 'POST',
        headers,
        body: JSON.stringify({ question: trimmedQuestion }),
      })

      const data = (await response.json().catch(() => ({}))) as AskResult & { error?: string }
      if (!response.ok) {
        setError(data.error ?? 'Failed to get answer')
        return
      }

      setResult(data)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }, [apiKey, loading, question])

  const typeLabel: Record<string, string> = {
    article: 'Article',
    tweet: 'Post',
    video: 'Video',
    pdf: 'PDF',
    image: 'Image',
    note: 'Note',
    chunk: 'PDF',
  }

  return (
    <div className="ask-ai-panel">
      <div className="ask-ai-header">
        <span className="ask-ai-icon">✦</span>
        <div>
          <div className="ask-ai-title">Ask your knowledge base</div>
          <div className="ask-ai-sub">
            Searches signals, notes, and uploaded PDFs with AI
          </div>
        </div>
      </div>

      <div className="ask-ai-input-row">
        <input
          ref={inputRef}
          className="ask-ai-input"
          type="text"
          placeholder="Ask anything about your saved knowledge…"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && void ask()}
          disabled={loading}
        />
        <button
          className="ask-ai-btn"
          onClick={() => void ask()}
          disabled={loading || !question.trim()}
          title="Ask"
        >
          {loading ? '…' : '→'}
        </button>
      </div>

      {loading && (
        <div className="ask-ai-loading">
          <div className="ask-ai-dots"><span /><span /><span /></div>
          <span>Searching your knowledge base…</span>
        </div>
      )}

      {error && (
        <div className="ask-ai-error">
          <span>!</span> {error}
        </div>
      )}

      {result && (
        <div className="ask-ai-result">
          {result.fallback && (
            <div className="ask-ai-fallback-note">
              Using keyword search — add more content on this topic for semantic answers.
            </div>
          )}

          <div className="ask-ai-answer">
            {result.answer.split('\n').map((line, index) => {
              if (line.startsWith('## ')) {
                return <h3 key={index} style={{ margin: '12px 0 4px', fontSize: 13, color: 'var(--text)' }}>{line.slice(3)}</h3>
              }
              if (line.startsWith('# ')) {
                return <h2 key={index} style={{ margin: '12px 0 4px', fontSize: 14, color: 'var(--text)' }}>{line.slice(2)}</h2>
              }
              if (line.startsWith('- ') || line.startsWith('* ')) {
                return <div key={index} style={{ margin: '2px 0', paddingLeft: 12, color: 'var(--text2)', fontSize: 12 }}>• {line.slice(2)}</div>
              }
              if (line.trim() === '') {
                return <div key={index} style={{ height: 6 }} />
              }
              return <p key={index} style={{ margin: '3px 0', fontSize: 12, color: 'var(--text2)', lineHeight: 1.55 }}>{line}</p>
            })}
          </div>

          {result.sources.length > 0 && (
            <div className="ask-ai-sources">
              <div
                className="ask-ai-sources-label"
                style={{ display: 'inline-block', background: 'var(--bg5)', color: 'var(--text2)', padding: '2px 8px', borderRadius: 10, fontSize: 10, marginBottom: 8 }}
              >
                {result.sources.length} source{result.sources.length > 1 ? 's' : ''} used
              </div>
              {result.sources.map((source, index) => (
                <button
                  key={source._id}
                  className="ask-ai-source-item"
                  onClick={() => onOpenDrawer?.(source._id)}
                  title="Open signal"
                >
                  <span className="ask-ai-source-icon">{typeLabel[source.type] ?? 'Item'}</span>
                  <span className="ask-ai-source-num">[{index + 1}]</span>
                  <span className="ask-ai-source-title">{source.title.slice(0, 55)}</span>
                  <span className="ask-ai-source-score">{Math.round(source.score * 100)}%</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {!result && !loading && !error && (
        <div style={{ padding: '20px 0', textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.6 }}>
            Ask questions about your saved articles, videos,<br />
            notes, and uploaded PDFs. The AI searches across<br />
            your entire library automatically.
          </div>
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {[
              'What have I saved about React?',
              'Summarise my notes on investing',
              'What does the uploaded PDF say about…',
            ].map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => { setQuestion(suggestion); inputRef.current?.focus() }}
                style={{
                  background: 'var(--bg3)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--r)',
                  padding: '5px 10px',
                  fontSize: 11,
                  color: 'var(--text2)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'var(--font-body)',
                  transition: 'all 0.12s',
                }}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}