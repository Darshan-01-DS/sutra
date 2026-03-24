// src/hooks/useStats.ts
'use client'

import { useState, useEffect, useCallback } from 'react'
import { StatsData } from '@/types'

export function useStats() {
  const [stats, setStats]     = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/stats')
      const text = await res.text()
      if (!res.ok) {
        // When MongoDB fails, Next may return HTML or an empty body.
        console.error('Stats fetch failed:', res.status, text.slice(0, 300))
        setStats(null)
        return
      }

      try {
        const data = JSON.parse(text)
        setStats(data)
      } catch (e) {
        console.error('Stats response was not valid JSON:', text.slice(0, 300), e)
        setStats(null)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return { stats, loading, refresh }
}
