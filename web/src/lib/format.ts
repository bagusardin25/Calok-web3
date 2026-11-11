const encoder = new TextEncoder()

/** The contract limits text by UTF-8 bytes, not characters. */
export const byteLength = (text: string): number => encoder.encode(text).length

/** Names and notes are one run of text: collapse line breaks and repeated spaces. */
export const cleanText = (text: string): string => text.replace(/\s+/g, ' ').trim()

export const shortAddress = (address: string): string => `${address.slice(0, 6)}…${address.slice(-4)}`

export const sameAddress = (a?: string, b?: string): boolean => !!a && !!b && a.toLowerCase() === b.toLowerCase()

export const plural = (count: number, one: string, many = `${one}s`): string => `${count} ${count === 1 ? one : many}`

const DAY = 86_400

/** "3 days ago", measured against `now` in unix seconds (use the chain clock). */
export function timeAgo(timestamp: number, now: number): string {
  const seconds = Math.max(0, now - timestamp)
  if (seconds < 45) return 'just now'
  if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))} min ago`
  if (seconds < DAY) return `${Math.round(seconds / 3600)} h ago`
  if (seconds < DAY * 60) return plural(Math.round(seconds / DAY), 'day') + ' ago'
  return `on ${formatDate(timestamp)}`
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatDistance(metres: number): string {
  if (metres < 50) return '< 50 m'
  if (metres < 1000) return `${Math.round(metres / 10) * 10} m`
  if (metres < 10_000) return `${(metres / 1000).toFixed(1)} km`
  return `${Math.round(metres / 1000)} km`
}

/** Microdegrees as a degrees string with five decimals, the precision the app stores. */
export const degrees = (micro: number): string => (micro / 1_000_000).toFixed(5)

export const formatScore = (score: number): string => (score > 0 ? `+${score}` : `${score}`)
