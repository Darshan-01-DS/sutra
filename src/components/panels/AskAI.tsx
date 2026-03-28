'use client'
// src/components/panels/AskAI.tsx
// RAG-powered question answering — works on saved signals AND uploaded PDFs

import { useState, useRef, useCallback, useEffect } from 'react'

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

interface AskAIProps {
  onOpenDrawer?: (id: string) => void
  apiKey?: string
}

export function AskAI({ onOpenDrawer, apiKey }: AskAIProps) {
  const [question, setQuestion]     = useState('')
  const [result, setResult]         = useState<AskResult | null>(null)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [hasKey, setHasKey]         = useState(false)
  const [mode, setMode]             = useState<'signals' | 'docs'>('signals')
  const [docs, setDocs]             = useState<ProcessedDoc[]>([])
  const [selectedDocs, setSelectedDocs] = useState<string[]>([])
  const [processing, setProcessing] = useState<string | null>(null)
  const [pdfSignals, setPdfSignals] = useState<any[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const storedKey = apiKey || (typeof window !== 'undefined' ? localStorage.getItem('sutra_openai_api_key') : null)
    setHasKey(!!storedKey?.trim())
  }, [apiKey])

  // Load processed docs and PDF signals when switching to docs mode
  useEffect(() => {
    if (mode !== 'docs') return
    loadDocs()
    loadPdfSignals()
  }, [mode])

  const loadDocs = async () => {
    try {
      const res = await fetch('/api/documents/query')
      const data = await res.json()
      if (Array.isArray(data)) setDocs(data)
    } catch {}
  }

  const loadPdfSignals = async () => {
    try {
      const res = await fetch('/api/signals?type=pdf&limit=50')
      const data = await res.json()
      setPdfSignals(Array.isArray(data.data) ? data.data : [])
    } catch {}
  }

  const processPdf = async (signalId: string) => {
    const key = apiKey || (typeof window !== 'undefined' ? localStorage.getItem('sutra_openai_api_key') ?? '' : '')
    const provider = typeof window !== 'undefined' ? localStorage.getItem('sutra_ai_provider') ?? 'openai' : 'openai'
    const baseUrl  = typeof window !== 'undefined' ? localStorage.getItem('sutra_ai_base_url') ?? '' : ''
    
    if (!key) { setError('Add an API key first'); return }
    setProcessing(signalId)
    setError('')
    try {
      const res = await fetch('/api/documents/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signalId, apiKey: key, provider, baseUrl }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Processing failed'); return }
      loadDocs()
    } catch (e: any) {
      setError(e.message ?? 'Processing error')
    } finally {
      setProcessing(null)
    }
  }

  const toggleDoc = (id: string) => {
    setSelectedDocs(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id])
  }

  const ask = useCallback(async () => {
    const q = question.trim()
    if (!q || loading) return
    setLoading(true)
    setError('')
    setResult(null)

    try {
      const key = apiKey || (typeof window !== 'undefined' ? localStorage.getItem('sutra_openai_api_key') ?? undefined : undefined)
      const provider = typeof window !== 'undefined' ? localStorage.getItem('sutra_ai_provider') ?? 'openai' : 'openai'
      const baseUrl  = typeof window !== 'undefined' ? localStorage.getItem('sutra_ai_base_url') ?? undefined : undefined
      const model    = typeof window !== 'undefined' ? localStorage.getItem('sutra_ai_model') ?? undefined : undefined

      if (mode === 'docs') {
        // PDF RAG mode
        const res = await fetch('/api/documents/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: q,
            signalIds: selectedDocs.length > 0 ? selectedDocs : undefined,
            apiKey: key,
            baseUrl,
            modelName: model,
            provider,
          }),
        })
        const data = await res.json()
        if (!res.ok) { setError(data.error ?? 'Query failed'); return }
        setResult({ answer: data.answer, sources: [], docSources: data.sources })
      } else {
        // Signal knowledge base mode
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (key) headers['x-openai-api-key'] = key
        if (provider) headers['x-ai-provider'] = provider
        if (baseUrl) headers['x-ai-base-url'] = baseUrl
        if (model) headers['x-ai-model'] = model

        const res = await fetch('/api/ask', { method: 'POST', headers, body: JSON.stringify({ question: q }) })
        const data = await res.json()
        if (!res.ok) { setError(data.error ?? 'Failed to get answer'); return }
        setResult(data)
      }
    } catch (e: any) {
      setError(e?.message ?? 'Network error')
    } finally {
      setLoading(false)
    }
  }, [question, loading, apiKey, mode, selectedDocs])

  const typeIcons: Record<string, string> = {
    article: '▤', tweet: '𝕏', video: '▶', pdf: '⬚', image: '⊡', note: '✎',
  }

  const processedIds = new Set(docs.map(d => d.signalId))

  return (
    <div className="ask-ai-panel">
      <div className="ask-ai-header">
        <span className="ask-ai-icon">✦</span>
        <div>
          <div className="ask-ai-title">Ask AI</div>
          <div className="ask-ai-sub">
            {mode === 'signals' ? 'Answers from your saved signals' : 'Answers from your PDF documents'}
          </div>
        </div>
      </div>

      {/* Mode toggle */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12, background: 'var(--bg3)', borderRadius: 'var(--r)', padding: 3 }}>
        {(['signals', 'docs'] as const).map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            style={{
              flex: 1, height: 28, border: 'none', borderRadius: 'calc(var(--r) - 2px)',
              cursor: 'pointer', fontSize: 11, fontWeight: 500,
              fontFamily: 'var(--font-body)',
              background: mode === m ? 'var(--accent)' : 'transparent',
              color: mode === m ? '#0A0A0C' : 'var(--text2)',
              transition: 'all 0.15s',
            }}
          >
            {m === 'signals' ? '◈ Signals' : '⬚ PDFs'}
          </button>
        ))}
      </div>

      {!hasKey && (
        <div style={{ padding: '10px 14px', background: 'var(--bg3)', color: 'var(--coral)', borderRadius: 'var(--r)', fontSize: 12, border: '1px solid var(--coral-border, rgba(232,112,90,0.25))', marginBottom: 12 }}>
          ⚠ Add an API key in <strong>Account → AI &amp; Keys</strong> to enable AI.
        </div>
      )}

      {/* PDF Documents mode */}
      {mode === 'docs' && (
        <div style={{ marginBottom: 12 }}>
          {/* Unprocessed PDFs */}
          {pdfSignals.filter(s => !processedIds.has(String(s._id))).length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, letterSpacing: '0.08em', color: 'var(--text3)', marginBottom: 6, textTransform: 'uppercase' }}>Unprocessed PDFs</div>
              {pdfSignals.filter(s => !processedIds.has(String(s._id))).map(s => (
                <div key={s._id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: 'var(--bg3)', borderRadius: 'var(--r)', marginBottom: 4, border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 12, color: 'var(--accent)' }}>⬚</span>
                  <span style={{ fontSize: 12, color: 'var(--text2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</span>
                  <button
                    onClick={() => processPdf(String(s._id))}
                    disabled={processing === String(s._id)}
                    style={{
                      height: 24, padding: '0 10px', fontSize: 10, fontWeight: 600,
                      background: 'var(--accent)', color: '#0A0A0C', border: 'none',
                      borderRadius: 'var(--r)', cursor: 'pointer', flexShrink: 0,
                      fontFamily: 'var(--font-body)',
                      opacity: processing === String(s._id) ? 0.6 : 1,
                    }}
                  >
                    {processing === String(s._id) ? '…' : 'Process'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Processed docs */}
          {docs.length > 0 && (
            <div>
              <div style={{ fontSize: 10, letterSpacing: '0.08em', color: 'var(--text3)', marginBottom: 6, textTransform: 'uppercase' }}>
                Ready to query {selectedDocs.length > 0 ? `· ${selectedDocs.length} selected` : '· all'}
              </div>
              {docs.map(d => (
                <div
                  key={d.signalId}
                  onClick={() => toggleDoc(d.signalId)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '7px 10px', borderRadius: 'var(--r)', marginBottom: 4,
                    cursor: 'pointer', border: '1px solid',
                    background: selectedDocs.includes(d.signalId) ? 'var(--accent-bg)' : 'var(--bg3)',
                    borderColor: selectedDocs.includes(d.signalId) ? 'var(--accent-border)' : 'var(--border)',
                    transition: 'all 0.12s',
                  }}
                >
                  <span style={{ fontSize: 12, color: selectedDocs.includes(d.signalId) ? 'var(--accent)' : 'var(--text3)' }}>
                    {selectedDocs.includes(d.signalId) ? '✓' : '⬚'}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.documentName}</span>
                  <span style={{ fontSize: 10, color: 'var(--text3)' }}>{d.chunks}c</span>
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
          placeholder={mode === 'docs' ? 'Ask about your PDFs…' : 'Ask anything about your library…'}
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
          <div className="ask-ai-dots"><span /><span /><span /></div>
          <span>{mode === 'docs' ? 'Reading documents…' : 'Searching your knowledge base…'}</span>
        </div>
      )}

      {error && <div className="ask-ai-error"><span>⚠</span> {error}</div>}

      {result && (
        <div className="ask-ai-result">
          {result.fallback && (
            <div className="ask-ai-fallback-note">
              💡 Using keyword search (add API key to enable semantic search)
            </div>
          )}
          <div className="ask-ai-answer">
            {result.answer.split('\n').map((line, i) => (
              <p key={i} style={{ margin: '4px 0' }}>{line}</p>
            ))}
          </div>

          {/* Signal sources */}
          {result.sources && result.sources.length > 0 && (
            <div className="ask-ai-sources">
              <div className="ask-ai-sources-label" style={{ display: 'inline-block', background: 'var(--bg5)', color: 'var(--text2)', padding: '2px 8px', borderRadius: 10, fontSize: 10, marginBottom: 8 }}>
                Sources: {result.sources.length} signals
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

          {/* PDF doc sources */}
          {result.docSources && result.docSources.length > 0 && (
            <div className="ask-ai-sources">
              <div style={{ display: 'inline-block', background: 'var(--bg5)', color: 'var(--text2)', padding: '2px 8px', borderRadius: 10, fontSize: 10, marginBottom: 8 }}>
                Sources: {result.docSources.length} document{result.docSources.length > 1 ? 's' : ''}
              </div>
              {result.docSources.map(d => (
                <button
                  key={d.signalId}
                  className="ask-ai-source-item"
                  onClick={() => onOpenDrawer?.(d.signalId)}
                  title="Open PDF signal"
                >
                  <span className="ask-ai-source-icon">⬚</span>
                  <span className="ask-ai-source-title">{d.documentName}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
