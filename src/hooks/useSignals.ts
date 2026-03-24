// src/hooks/useSignals.ts
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Signal, SignalType } from '@/types'

interface UseSignalsOptions {
  type?:  SignalType
  tag?:   string
  topic?: string
  collectionId?: string
  sort?:  string
}

export function useSignals(opts: UseSignalsOptions = {}) {
  const [signals, setSignals] = useState<Signal[]>([])
  const [total, setTotal]     = useState(0)
  const [page, setPage]       = useState(1)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [saving, setSaving]   = useState(false)
  const optsRef = useRef(opts)

  const fetchPage = useCallback(async (pg: number, replace = false) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(pg), limit: '24' })
      if (optsRef.current.type)  params.set('type',  optsRef.current.type)
      if (optsRef.current.tag)   params.set('tag',   optsRef.current.tag)
      if (optsRef.current.topic) params.set('topic', optsRef.current.topic)
      if (optsRef.current.collectionId) params.set('collectionId', optsRef.current.collectionId)
      if (optsRef.current.sort)  params.set('sort',  optsRef.current.sort)

      const res  = await fetch(`/api/signals?${params}`)
      const text = await res.text()
      if (!res.ok) {
        console.error('Signals fetch failed:', res.status, text.slice(0, 300))
        setHasMore(false)
        return
      }

      let data: any = null
      try {
        data = JSON.parse(text)
      } catch (e) {
        console.error('Signals response was not valid JSON:', text.slice(0, 300), e)
        setHasMore(false)
        return
      }

      setSignals(prev => replace ? data.data : [...prev, ...data.data])
      setTotal(data.total)
      setHasMore(data.hasMore)
    } finally {
      setLoading(false)
    }
  }, [])

  // Reset when filter changes
  useEffect(() => {
    optsRef.current = opts
    setPage(1)
    fetchPage(1, true)
  }, [opts.type, opts.tag, opts.topic, opts.collectionId, opts.sort]) // eslint-disable-line

  const loadMore = useCallback(() => {
    const next = page + 1
    setPage(next)
    fetchPage(next, false)
  }, [page, fetchPage])

  const refresh = useCallback(() => {
    setPage(1)
    fetchPage(1, true)
  }, [fetchPage])

  const saveSignal = useCallback(async (data: {
    url?: string
    content?: string
    title?: string
    type?: SignalType
  }): Promise<{ signal: Signal | null; error?: string }> => {
    setSaving(true)
    try {
      const apiKey = typeof window !== 'undefined' ? window.localStorage.getItem('sutra_openai_api_key') ?? undefined : undefined
      const provider = typeof window !== 'undefined' ? window.localStorage.getItem('sutra_ai_provider') ?? undefined : undefined
      const baseUrl = typeof window !== 'undefined' ? window.localStorage.getItem('sutra_ai_base_url') ?? undefined : undefined
      const model = typeof window !== 'undefined' ? window.localStorage.getItem('sutra_ai_model') ?? undefined : undefined
      
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (apiKey) headers['x-openai-api-key'] = apiKey
      if (provider) headers['x-ai-provider'] = provider
      if (baseUrl) headers['x-ai-base-url'] = baseUrl
      if (model) headers['x-ai-model'] = model

      const res = await fetch('/api/signals', {
        method:  'POST',
        headers,
        body:    JSON.stringify(data),
      })
      const text = await res.text()

      if (!res.ok) {
        let message = 'Failed to save signal'
        try {
          const parsed = JSON.parse(text)
          message = parsed?.error ?? parsed?.details ?? message
        } catch {
          message = text?.slice(0, 300) ?? message
        }
        console.error('Save signal failed:', res.status, message)
        return { signal: null, error: message }
      }

      let signal: Signal | null = null
      try {
        signal = JSON.parse(text) as Signal
      } catch {
        return { signal: null, error: 'Server returned invalid JSON for saved signal.' }
      }

      if (!signal) return { signal: null, error: 'Failed to save signal (empty response).' }

      setSignals(prev => [signal as Signal, ...prev])
      setTotal(prev => prev + 1)
      return { signal }
    } catch (e: any) {
      return { signal: null, error: e?.message ? String(e.message) : 'Network error while saving signal.' }
    } finally {
      setSaving(false)
    }
  }, [])

  const uploadFile = useCallback(async (file: File, notes?: string): Promise<{ signal: Signal | null; error?: string }> => {
    setSaving(true)
    try {
      const apiKey = typeof window !== 'undefined' ? window.localStorage.getItem('sutra_openai_api_key') ?? undefined : undefined
      const provider = typeof window !== 'undefined' ? window.localStorage.getItem('sutra_ai_provider') ?? undefined : undefined
      const baseUrl = typeof window !== 'undefined' ? window.localStorage.getItem('sutra_ai_base_url') ?? undefined : undefined
      const model = typeof window !== 'undefined' ? window.localStorage.getItem('sutra_ai_model') ?? undefined : undefined

      const formData = new FormData()
      formData.append('file', file)
      if (notes?.trim()) formData.append('notes', notes.trim())

      const headers: Record<string, string> = {}
      if (apiKey) headers['x-openai-api-key'] = apiKey
      if (provider) headers['x-ai-provider'] = provider
      if (baseUrl) headers['x-ai-base-url'] = baseUrl
      if (model) headers['x-ai-model'] = model

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers,
        body: formData,
      })
      const text = await res.text()

      if (!res.ok) {
        let message = 'Failed to upload file'
        try {
          const parsed = JSON.parse(text)
          message = parsed?.error ?? parsed?.details ?? message
        } catch {
          message = text?.slice(0, 300) ?? message
        }
        console.error('Upload failed:', res.status, message)
        return { signal: null, error: message }
      }

      let signal: Signal | null = null
      try {
        signal = JSON.parse(text) as Signal
      } catch {
        return { signal: null, error: 'Server returned invalid JSON for uploaded file.' }
      }

      if (!signal) return { signal: null, error: 'Failed to upload file (empty response).' }

      setSignals(prev => [signal as Signal, ...prev])
      setTotal(prev => prev + 1)
      return { signal }
    } catch (e: any) {
      return { signal: null, error: e?.message ? String(e.message) : 'Network error while uploading.' }
    } finally {
      setSaving(false)
    }
  }, [])

  return { signals, total, loading, hasMore, loadMore, refresh, saving, saveSignal, uploadFile }
}
