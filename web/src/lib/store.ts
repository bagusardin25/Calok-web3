import { useEffect, useSyncExternalStore } from 'react'
import { publicClient } from './client'

/** A tiny observable value, read in React with useSyncExternalStore. */
function observable<T>(initial: T) {
  let value = initial
  const listeners = new Set<() => void>()
  return {
    get: () => value,
    set(next: T) {
      if (Object.is(next, value)) return
      value = next
      listeners.forEach((notify) => notify())
    },
    subscribe(notify: () => void) {
      listeners.add(notify)
      return () => {
        listeners.delete(notify)
      }
    },
  }
}

const useObservable = <T,>(o: ReturnType<typeof observable<T>>): T => useSyncExternalStore(o.subscribe, o.get)

const readStorage = (key: string): string | null => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

const writeStorage = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Storage can be unavailable (private mode). The app still works; it just forgets.
  }
}

// ───────────────────────────── Revision ─────────────────────────────
// Bumped after every confirmed transaction so on-screen data refetches.

const revision = observable(0)
export const bumpRevision = () => revision.set(revision.get() + 1)
export const useRevision = () => useObservable(revision)

// ───────────────────────────── Chain clock ─────────────────────────────
// Status and cooldowns are decided by block time. The app measures how far the chain's clock
// is ahead of this device (a local chain may have been moved forward; a device clock may run
// slow) and uses that for "3 days ago" and "you can vote again on …".

const clockOffset = observable(0)
let syncedAtRevision = -1

async function syncClock(rev: number) {
  if (syncedAtRevision === rev) return
  syncedAtRevision = rev
  try {
    const block = await publicClient.getBlock({ blockTag: 'latest' })
    clockOffset.set(Math.max(0, Math.round(Number(block.timestamp) - Date.now() / 1000)))
  } catch {
    // Unreachable chain: keep the device clock. Reads will report the connection problem.
    syncedAtRevision = -1
  }
}

const tick = observable(Math.floor(Date.now() / 1000))
if (typeof window !== 'undefined') {
  window.setInterval(() => tick.set(Math.floor(Date.now() / 1000)), 30_000)
}

/** Current chain time in unix seconds, refreshed every 30 s and after each transaction. */
export function useChainNow(): number {
  const rev = useRevision()
  const offset = useObservable(clockOffset)
  const now = useObservable(tick)
  useEffect(() => {
    void syncClock(rev)
  }, [rev])
  return now + offset
}

// ───────────────────────────── Filters ─────────────────────────────

export type Filters = {
  /** Amenity bits a spot must all have. 0 shows every spot. */
  amenities: number
  showStale: boolean
  showGone: boolean
}

const FILTER_KEY = 'colok.filters'
const DEFAULT_FILTERS: Filters = { amenities: 0, showStale: true, showGone: false }

function loadFilters(): Filters {
  try {
    const raw = JSON.parse(readStorage(FILTER_KEY) ?? 'null') as Partial<Filters> | null
    if (!raw) return DEFAULT_FILTERS
    return {
      amenities: typeof raw.amenities === 'number' ? raw.amenities & 0x0f : 0,
      showStale: raw.showStale !== false,
      showGone: raw.showGone === true,
    }
  } catch {
    return DEFAULT_FILTERS
  }
}

const filters = observable<Filters>(loadFilters())
export const useFilters = () => useObservable(filters)
export function setFilters(next: Filters) {
  filters.set(next)
  writeStorage(FILTER_KEY, JSON.stringify(next))
}

// ───────────────────────────── Device location ─────────────────────────────
// Kept in memory only: never stored, never sent anywhere, never written to the chain.

export type LocationState =
  | { status: 'idle' | 'asking' | 'denied' | 'unavailable' | 'unsupported' }
  | { status: 'granted'; lat: number; lng: number; accuracy: number }

const location = observable<LocationState>({ status: 'idle' })
export const useDeviceLocation = () => useObservable(location)

export function requestLocation(): Promise<LocationState> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    location.set({ status: 'unsupported' })
    return Promise.resolve(location.get())
  }
  location.set({ status: 'asking' })
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        location.set({ status: 'granted', lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy })
        resolve(location.get())
      },
      (err) => {
        location.set({ status: err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable' })
        resolve(location.get())
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
    )
  })
}

/** Asks for the position only if the person already allowed it on an earlier visit. */
export async function restoreLocationIfAllowed() {
  try {
    const permission = await navigator.permissions?.query({ name: 'geolocation' as PermissionName })
    if (permission?.state === 'granted' && location.get().status === 'idle') await requestLocation()
  } catch {
    // Permissions API missing: wait for the person to press "Use my location".
  }
}

// ───────────────────────────── Map view ─────────────────────────────
// Where the map is looking, so the list can sort from the same place. Memory only.

export type View = { lat: number; lng: number; zoom: number }
const view = observable<View | null>(null)
export const useMapView = () => useObservable(view)
export const getMapView = () => view.get()
export const setMapView = (next: View) => view.set(next)

/** A spot the person just added, so its pin can pulse once. */
const justAdded = observable<number | null>(null)
export const useJustAdded = () => useObservable(justAdded)
export const markJustAdded = (id: number | null) => justAdded.set(id)

// ───────────────────────────── Privacy notice ─────────────────────────────
// Before a wallet's first "Still here", the app explains that confirmations are public.

const ACK_KEY = 'colok.public-ack'
const acked = observable<string>(readStorage(ACK_KEY) ?? '')
export const useAcknowledged = (wallet: string | undefined): boolean => {
  const list = useObservable(acked)
  return !!wallet && list.split(',').includes(wallet.toLowerCase())
}
export function acknowledge(wallet: string) {
  const list = acked.get().split(',').filter(Boolean)
  if (list.includes(wallet.toLowerCase())) return
  const next = [...list, wallet.toLowerCase()].join(',')
  acked.set(next)
  writeStorage(ACK_KEY, next)
}
