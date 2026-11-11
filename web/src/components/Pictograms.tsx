// Sign-style pictograms and the socket pin. One drawing per idea, reused by the map markers
// (as an SVG string) and by React components (as JSX), so the two never drift apart.
import { AMENITIES, STATUS_META, amenitiesOf } from '../config/site'
import type { Amenity } from '../config/site'

const PICTOGRAM_PATHS: Record<Amenity['key'], string> = {
  power: '<path d="M13.6 2 4.8 13.4h5.7L9.4 22l9.8-12.2h-5.9L14.9 2z" fill="currentColor"/>',
  wifi:
    '<g fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M2.8 9.2a13.2 13.2 0 0 1 18.4 0"/><path d="M6.2 12.8a8.4 8.4 0 0 1 11.6 0"/><path d="M9.6 16.3a3.6 3.6 0 0 1 4.8 0"/></g><circle cx="12" cy="19.6" r="1.9" fill="currentColor"/>',
  water:
    '<path d="M12 2.4C8.3 7.1 5.3 10.8 5.3 14.5a6.7 6.7 0 0 0 13.4 0c0-3.7-3-7.4-6.7-12.1z" fill="currentColor"/><path d="M9.1 14.6a3 3 0 0 0 2.6 3" fill="none" stroke="var(--pictogram-cut, #111)" stroke-width="1.8" stroke-linecap="round"/>',
  seating:
    '<path d="M6 2.5h3.2v9.3h8.6v3.4h-1.3V21.5h-2.8v-6.3H9.2v6.3H6.4v-6.3H6z" fill="currentColor"/>',
}

export function Pictogram({ amenity, size = 24 }: { amenity: Amenity['key']; size?: number }) {
  return (
    <svg
      className="pictogram"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      dangerouslySetInnerHTML={{ __html: PICTOGRAM_PATHS[amenity] }}
    />
  )
}

/** A row of black pictogram tiles, with the amenity names for screen readers or on screen. */
export function AmenityTiles({ mask, labels = false, size = 'md' }: { mask: number; labels?: boolean; size?: 'sm' | 'md' }) {
  const list = amenitiesOf(mask)
  return (
    <ul className={`amenity-tiles amenity-tiles--${size}`} aria-label={labels ? undefined : list.map((a) => a.short).join(', ')}>
      {list.map((a) => (
        <li key={a.key} className="amenity-tile">
          <span className="amenity-tile__icon">
            <Pictogram amenity={a.key} size={size === 'sm' ? 16 : 22} />
          </span>
          {labels ? <span className="amenity-tile__label">{a.label}</span> : null}
        </li>
      ))}
    </ul>
  )
}

export const ALL_AMENITIES = AMENITIES

// ───────────────────────────── Socket ─────────────────────────────
// A round two-hole wall socket. The shape carries the status, so it reads without colour:
// outline = New, solid = Verified, faded and dashed = Stale, struck through = Reported gone.

export type PinShape = 'outline' | 'solid' | 'faded' | 'struck' | 'none'

export const shapeOf = (status: number): PinShape => STATUS_META[status]?.shape ?? 'outline'

function socketFace(shape: PinShape, cy: number): string {
  const strike =
    shape === 'struck'
      ? `<path d="M8.5 ${cy - 11.5} 31.5 ${cy + 11.5}" stroke="#fff" stroke-width="7" stroke-linecap="round"/><path d="M8.5 ${cy - 11.5} 31.5 ${cy + 11.5}" stroke="#111" stroke-width="3.4" stroke-linecap="round"/>`
      : ''
  return (
    `<circle class="sock-plate" cx="20" cy="${cy}" r="16.5"/>` +
    `<circle class="sock-recess" cx="20" cy="${cy}" r="10.5"/>` +
    `<circle class="sock-hole" cx="15.6" cy="${cy}" r="2.5"/>` +
    `<circle class="sock-hole" cx="24.4" cy="${cy}" r="2.5"/>` +
    strike
  )
}

/** Markup for a map marker: the socket with a pointer underneath, tip at the bottom centre. */
export function pinSvg(shape: PinShape): string {
  return (
    `<svg class="sock sock--${shape}" viewBox="0 0 40 50" width="40" height="50" aria-hidden="true" focusable="false">` +
    `<path class="sock-tail" d="M13.5 31.5h13L20 48.5z"/>` +
    socketFace(shape, 19) +
    `</svg>`
  )
}

/** The status shape on its own, for lists, badges and the legend. */
export function StatusGlyph({ status, size = 22 }: { status: number; size?: number }) {
  const shape = shapeOf(status)
  return (
    <svg
      className={`sock sock--${shape}`}
      viewBox="1 1 38 38"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      dangerouslySetInnerHTML={{ __html: socketFace(shape, 20) }}
    />
  )
}

/** The Colok mark: a yellow socket face on a black sign tile. */
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg className="logo" viewBox="0 0 40 40" width={size} height={size} aria-hidden="true" focusable="false">
      <rect width="40" height="40" rx="5" fill="#111" />
      <circle cx="20" cy="20" r="14" fill="#FFC400" />
      <circle cx="20" cy="20" r="8.6" fill="none" stroke="#111" strokeWidth="2.4" />
      <circle cx="16.3" cy="20" r="2.3" fill="#111" />
      <circle cx="23.7" cy="20" r="2.3" fill="#111" />
    </svg>
  )
}
