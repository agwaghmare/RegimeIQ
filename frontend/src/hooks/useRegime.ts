import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import type { RegimeData } from '../types/regime'

interface UseRegimeResult {
  data: RegimeData | null
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useRegime(): UseRegimeResult {
  const [data, setData] = useState<RegimeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    api.getRegime()
      .then((d) => { if (!cancelled) { setData(d); setLoading(false) } })
      .catch((e: Error) => { if (!cancelled) { setError(e.message); setLoading(false) } })

    return () => { cancelled = true }
  }, [tick])

  return { data, loading, error, refetch: () => setTick((t) => t + 1) }
}
