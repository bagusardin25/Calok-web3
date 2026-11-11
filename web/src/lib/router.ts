import { useMemo, useSyncExternalStore } from 'react'

export type Route =
  | { name: 'map' }
  | { name: 'spot'; id: number }
  | { name: 'add' }
  | { name: 'list' }
  | { name: 'mappers' }
  | { name: 'me' }
  | { name: 'about' }
  | { name: 'notfound' }

/** Hash routes, so the app deploys as static files with no server rewrites. */
export const href = {
  map: '#/',
  spot: (id: number | bigint) => `#/spot/${id}`,
  add: '#/add',
  list: '#/list',
  mappers: '#/mappers',
  me: '#/me',
  about: '#/about',
} as const

function parse(hash: string): Route {
  const parts = hash.replace(/^#/, '').split('/').filter(Boolean)
  if (parts.length === 0) return { name: 'map' }
  const [head, arg] = parts
  if (head === 'spot' && parts.length === 2 && arg && /^[1-9]\d{0,9}$/.test(arg)) return { name: 'spot', id: Number(arg) }
  if (parts.length !== 1) return { name: 'notfound' }
  if (head === 'add') return { name: 'add' }
  if (head === 'list') return { name: 'list' }
  if (head === 'mappers') return { name: 'mappers' }
  if (head === 'me') return { name: 'me' }
  if (head === 'about') return { name: 'about' }
  return { name: 'notfound' }
}

function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash)
  return useMemo(() => parse(hash), [hash])
}

export function navigate(to: string) {
  window.location.hash = to
}

/** Absolute link to a route, for copying and sharing. */
export function absoluteUrl(to: string): string {
  return `${window.location.origin}${window.location.pathname}${to}`
}
