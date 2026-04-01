import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import type { RegimeData } from '../types/regime'

const LIVE_POLL_MS = Number(import.meta.env.VITE_REALTIME_POLL_MS ?? 15000)

interface UseRegimeResult {
  data: RegimeData | null
  loading: boolean
  error: string | null
  refetch: () => void
  lastUpdatedAt: number | null
  isLive: boolean
}

export function useRegime(): UseRegimeResult {
  const [data, setData] = useState<RegimeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null)
  const [isLive, setIsLive] = useState(false)

  useEffect(() => {
    let cancelled = false
    let timerId: number | null = null
    let inFlight = false

    setLoading(true)
    setError(null)

    const fetchLatest = async (showLoader: boolean) => {
      if (inFlight) return
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        if (!cancelled) {
          setIsLive(false)
          setError('You are offline. Waiting for connection to resume live updates.')
          setLoading(false)
        }
        return
      }

      inFlight = true
      if (showLoader && !cancelled) setLoading(true)

      try {
        const d = await api.getRegime()
        if (cancelled) return
        setData(d)
        setError(null)
        setIsLive(true)
        setLastUpdatedAt(Date.now())
      } catch (e) {
        if (cancelled) return
        setIsLive(false)
        setError((e as Error).message)
      } finally {
        inFlight = false
        if (!cancelled) setLoading(false)
      }
    }

    void fetchLatest(true)

    if (LIVE_POLL_MS > 0) {
      timerId = window.setInterval(() => {
        if (document.visibilityState !== 'visible') return
        void fetchLatest(false)
      }, LIVE_POLL_MS)
    }

    const handleOnline = () => {
      void fetchLatest(false)
    }

    window.addEventListener('online', handleOnline)

    return () => {
      cancelled = true
      if (timerId !== null) window.clearInterval(timerId)
      window.removeEventListener('online', handleOnline)
    }
  }, [tick])

  return {
    data,
    loading,
    error,
    refetch: () => setTick((t) => t + 1),
    lastUpdatedAt,
    isLive,
  }
}
