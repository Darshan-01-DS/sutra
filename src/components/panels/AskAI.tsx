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

interface DocSource {
  signalId: string
  documentName: string
}

interface AskResult {
  answer: string
  sources: Source[]
  docSources?: DocSource[]
  fallback?: boolean
}

interface ProcessedDoc {
  signalId: string
  documentName: string
  chunks: number
}

interface PdfSignal {
  _id: string
  title: string
}

interface AskAIProps {
  onOpenDrawer?: (id: string) => void
  apiKey?: string
}

function getStoredValue(key: string): string | undefined {
  if (typeof window === 'undefined') {
    return undefined
  }

  const value = window.localStorage.getItem(key)
  return value?.trim() ? value : undefined
}

export function AskAI({ onOpenDrawer, apiKey }: AskAIProps) {
  const [question, setQuestion] = useState('')
  const [result, setResult] = useState<AskResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'signals' | 'docs'>('signals')
  const [docs, setDocs] = useState<ProcessedDoc[]>([])
  const [selectedDocs, setSelectedDocs] = useState<string[]>([])
  const [processing, setProcessing] = useState<string | null>(null)
  const [pdfSignals, setPdfSignals] = useState<PdfSignal[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  const loadDocs = useCallback(async () => {
    try {
      const response = await fetch('/api/documents/query')
      const data = (await response.json().catch(() => ({}))) as { error?: string } | ProcessedDoc[]

      if (!response.ok) {
        setError(typeof data === 'object' && !Array.isArray(data) ? data.error ?? 'Failed to load processed PDFs.' : 'Failed to load processed PDFs.')
        return
      }

      setDocs(Array.isArray(data) ? data : [])
    } catch {
      setError('Failed to load processed PDFs.')
    }
  }, [])

  const loadPdfSignals = useCallback(async () => {
    try {
      const response = await fetch('/api/signals?type=pdf&limit=50')
      const data = (await response.json().catch(() => ({}))) as { error?: string; data?: PdfSignal[] }

      if (!response.ok) {
        setError(data.error ?? 'Failed to load PDF signals.')
        return
      }

      setPdfSignals(Array.isArray(data.data) ? data.data : [])
    } catch {
      setError('Failed to load PDF signals.')
    }
  }, [])

  useEffect(() => {
    if (mode !== 'docs') {
      return
    }

    void loadDocs()
    void loadPdfSignals()
  }, [loadDocs, loadPdfSignals, mode])

  const processPdf = async (signalId: string) => {
    const key = apiKey || getStoredValue('sutra_openai_api_key') || ''
    const provider = getStoredValue('sutra_ai_provider') || 'openai'
    const baseUrl = getStoredValue('sutra_ai_base_url') || ''

    setProcessing(signalId)
    setError('')

    try {
      const response = await fetch('/api/documents/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signalId, apiKey: key, provider, baseUrl }),
      })

      const data = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) {
        setError(data.error ?? 'Processing failed')
        return
      }

      await loadDocs()
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Processing error')
    } finally {
      setProcessing(null)
    }
  }

  const toggleDoc = (id: string) => {
    setSelectedDocs((current) => current.includes(id) ? current.filter((docId) => docId !== id) : [...current, id])
  }

  const ask = useCallback(async () => {
    const trimmedQuestion = question.trim()
    if (!trimmedQuestion || loading) {
      return
    }

    setLoading(true)
    setError('')
    setResult(null)

    try {
      const key = apiKey || getStoredValue('sutra_openai_api_key')
      const provider = getStoredValue('sutra_ai_provider') || 'openai'
      const baseUrl = getStoredValue('sutra_ai_base_url')
      const model = getStoredValue('sutra_ai_model')

      if (mode === 'docs') {
        const response = await fetch('/api/documents/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: trimmedQuestion,
            signalIds: selectedDocs.length > 0 ? selectedDocs : undefined,
            apiKey: key,
            baseUrl,
            modelName: model,
            provider,
          }),
        })

        const data = (await response.json().catch(() => ({}))) as {
          error?: string
          answer?: string
          sources?: DocSource[]
        }

        if (!response.ok) {
          setError(data.error ?? 'Query failed')
          return
        }

        setResult({ answer: data.answer ?? 'No answer generated.', sources: [], docSources: data.sources ?? [] })
        return
      }

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
  }, [apiKey, loading, mode, question, selectedDocs])

  const typeIcons: Record<string, string> = {
    article: 'Doc',
    tweet: 'Post',
    video: 'Play',
    pdf: 'PDF',
    image: 'Img',
    note: 'Note',
  }

  const processedIds = new Set(docs.map((doc) => doc.signalId))

  return (
    <div className="ask-ai-panel">
      <div className="ask-ai-header">
        <span className="ask-ai-icon">AI</span>
        <div>
          <div className="ask-ai-title">Ask AI</div>
          <div className="ask-ai-sub">
            {mode === 'signals' ? 'Answers from your saved signals' : 'Answers from your PDF documents'}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 12, background: 'var(--bg3)', borderRadius: 'var(--r)', padding: 3 }}>
        {(['signals', 'docs'] as const).map((nextMode) => (
          <button
            key={nextMode}
            onClick={() => setMode(nextMode)}
            style={{
              flex: 1,
              height: 28,
              border: 'none',
              borderRadius: 'calc(var(--r) - 2px)',
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 500,
              fontFamily: 'var(--font-body)',
              background: mode === nextMode ? 'var(--accent)' : 'transparent',
              color: mode === nextMode ? '#0A0A0C' : 'var(--text2)',
              transition: 'all 0.15s',
            }}
          >
            {nextMode === 'signals' ? 'Signals' : 'PDFs'}
          </button>
        ))}
      </div>

      {mode === 'docs' && (
        <div style={{ marginBottom: 12 }}>
          {pdfSignals.filter((signal) => !processedIds.has(String(signal._id))).length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, letterSpacing: '0.08em', color: 'var(--text3)', marginBottom: 6, textTransform: 'uppercase' }}>
                Unprocessed PDFs
              </div>
              {pdfSignals.filter((signal) => !processedIds.has(String(signal._id))).map((signal) => (
                <div
                  key={signal._id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '7px 10px',
                    background: 'var(--bg3)',
                    borderRadius: 'var(--r)',
                    marginBottom: 4,
                    border: '1px solid var(--border)',
                  }}
                >
                  <span style={{ fontSize: 12, color: 'var(--accent)' }}>PDF</span>
                  <span style={{ fontSize: 12, color: 'var(--text2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {signal.title}
                  </span>
                  <button
                    onClick={() => void processPdf(String(signal._id))}
                    disabled={processing === String(signal._id)}
                    style={{
                      height: 24,
                      padding: '0 10px',
                      fontSize: 10,
                      fontWeight: 600,
                      background: 'var(--accent)',
                      color: '#0A0A0C',
                      border: 'none',
                      borderRadius: 'var(--r)',
                      cursor: 'pointer',
                      flexShrink: 0,
                      fontFamily: 'var(--font-body)',
                      opacity: processing === String(signal._id) ? 0.6 : 1,
                    }}
                  >
                    {processing === String(signal._id) ? '...' : 'Process'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {docs.length > 0 && (
            <div>
              <div style={{ fontSize: 10, letterSpacing: '0.08em', color: 'var(--text3)', marginBottom: 6, textTransform: 'uppercase' }}>
                Ready to query {selectedDocs.length > 0 ? `- ${selectedDocs.length} selected` : '- all'}
              </div>
              {docs.map((doc) => (
                <div
                  key={doc.signalId}
                  onClick={() => toggleDoc(doc.signalId)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '7px 10px',
                    borderRadius: 'var(--r)',
                    marginBottom: 4,
                    cursor: 'pointer',
                    border: '1px solid',
                    background: selectedDocs.includes(doc.signalId) ? 'var(--accent-bg)' : 'var(--bg3)',
                    borderColor: selectedDocs.includes(doc.signalId) ? 'var(--accent-border)' : 'var(--border)',
                    transition: 'all 0.12s',
                  }}
                >
                  <span style={{ fontSize: 12, color: selectedDocs.includes(doc.signalId) ? 'var(--accent)' : 'var(--text3)' }}>
                    {selectedDocs.includes(doc.signalId) ? 'Yes' : 'PDF'}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {doc.documentName}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--text3)' }}>{doc.chunks}c</span>
                </div>
              ))}
            </div>
          )}

          {docs.length === 0 && pdfSignals.length === 0 && (
            <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text3)', fontSize: 12 }}>
              No PDF signals yet. Upload a PDF to get started.
            </div>
          )}
        </div>
      )}

      <div className="ask-ai-input-row">
        <input
          ref={inputRef}
          className="ask-ai-input"
          type="text"
          placeholder={mode === 'docs' ? 'Ask about your PDFs...' : 'Ask anything about your library...'}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && void ask()}
          disabled={loading}
        />
        <button className="ask-ai-btn" onClick={() => void ask()} disabled={loading || !question.trim()} title="Ask">
          {loading ? '...' : '->'}
        </button>
      </div>

      {loading && (
        <div className="ask-ai-loading">
          <div className="ask-ai-dots"><span /><span /><span /></div>
          <span>{mode === 'docs' ? 'Reading documents...' : 'Searching your knowledge base...'}</span>
        </div>
      )}

      {error && <div className="ask-ai-error"><span>!</span> {error}</div>}

      {result && (
        <div className="ask-ai-result">
          {result.fallback && (
            <div className="ask-ai-fallback-note">
              Using fallback retrieval while richer semantic context is unavailable.
            </div>
          )}

          <div className="ask-ai-answer">
            {result.answer.split('\n').map((line, index) => (
              <p key={index} style={{ margin: '4px 0' }}>{line}</p>
            ))}
          </div>

          {result.sources.length > 0 && (
            <div className="ask-ai-sources">
              <div className="ask-ai-sources-label" style={{ display: 'inline-block', background: 'var(--bg5)', color: 'var(--text2)', padding: '2px 8px', borderRadius: 10, fontSize: 10, marginBottom: 8 }}>
                Sources: {result.sources.length} signals
              </div>
              {result.sources.map((source, index) => (
                <button
                  key={source._id}
                  className="ask-ai-source-item"
                  onClick={() => onOpenDrawer?.(source._id)}
                  title="Open signal"
                >
                  <span className="ask-ai-source-icon">{typeIcons[source.type] ?? 'Item'}</span>
                  <span className="ask-ai-source-num">[{index + 1}]</span>
                  <span className="ask-ai-source-title">{source.title.slice(0, 50)}</span>
                  <span className="ask-ai-source-score">{Math.round(source.score * 100)}%</span>
                </button>
              ))}
            </div>
          )}

          {result.docSources && result.docSources.length > 0 && (
            <div className="ask-ai-sources">
              <div style={{ display: 'inline-block', background: 'var(--bg5)', color: 'var(--text2)', padding: '2px 8px', borderRadius: 10, fontSize: 10, marginBottom: 8 }}>
                Sources: {result.docSources.length} document{result.docSources.length > 1 ? 's' : ''}
              </div>
              {result.docSources.map((doc) => (
                <button
                  key={doc.signalId}
                  className="ask-ai-source-item"
                  onClick={() => onOpenDrawer?.(doc.signalId)}
                  title="Open PDF signal"
                >
                  <span className="ask-ai-source-icon">PDF</span>
                  <span className="ask-ai-source-title">{doc.documentName}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}