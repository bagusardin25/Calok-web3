import { useCallback, useEffect, useRef, useState } from 'react'
import { useRevision } from './store'

export type Async<T> = {
  data: T | undefined
  error: unknown
  /** True while a request is in flight, including background refreshes. */
  loading: boolean
  reload: () => void
}

type Slot<T> = { key: string | null; data?: T; error?: unknown; loading: boolean }

/**
 * Runs `load` whenever `key` changes, after any confirmed transaction, or on reload().
 * Data from the previous run stays visible during a refresh. When the key changes it is dropped,
 * unless `keep` is set (the map keeps its pins while the next area loads).
 * Pass a null key to skip loading.
 */
export function useAsync<T>(key: string | null, load: () => Promise<T>, { keep = false } = {}): Async<T> {
  const revision = useRevision()
  const [tick, setTick] = useState(0)
  const [slot, setSlot] = useState<Slot<T>>({ key, loading: key !== null })

  const loadRef = useRef(load)
  useEffect(() => {
    loadRef.current = load
  })

  useEffect(() => {
    if (key === null) {
      setSlot((prev) => (keep ? { ...prev, key, loading: false } : { key, loading: false }))
      return
    }
    let cancelled = false
    setSlot((prev) => (prev.key === key || keep ? { ...prev, key, error: undefined, loading: true } : { key, loading: true }))
    loadRef.current().then(
      (data) => {
        if (!cancelled) setSlot({ key, data, loading: false })
      },
      (error: unknown) => {
        if (!cancelled) setSlot((prev) => ({ key, data: prev.key === key || keep ? prev.data : undefined, error, loading: false }))
      },
    )
    return () => {
      cancelled = true
    }
  }, [key, revision, tick, keep])

  const reload = useCallback(() => setTick((t) => t + 1), [])

  const current = slot.key === key || keep
  return {
    data: current ? slot.data : undefined,
    error: current ? slot.error : undefined,
    loading: current ? slot.loading : key !== null,
    reload,
  }
}

/** Tracks a CSS media query. */
export function useMedia(query: string): boolean {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => setMatches(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])
  return matches
}
