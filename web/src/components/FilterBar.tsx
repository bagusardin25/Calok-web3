import { STATUS } from '../config/site'
import { setFilters, useFilters } from '../lib/store'
import type { Filters } from '../lib/store'
import type { Pin } from '../lib/contract'
import { ALL_AMENITIES, Pictogram, StatusGlyph } from './Pictograms'

/** Applies the shared filters: every chosen amenity must be present; stale and gone are opt-in/out. */
export function applyFilters(pins: Pin[], f: Filters): Pin[] {
  return pins.filter((p) => {
    if ((p.amenities & f.amenities) !== f.amenities) return false
    if (p.status === STATUS.Stale && !f.showStale) return false
    if (p.status === STATUS.ReportedGone && !f.showGone) return false
    return p.status !== STATUS.Closed && p.status !== STATUS.Hidden
  })
}

export function FilterBar({ variant }: { variant: 'map' | 'page' }) {
  const f = useFilters()
  const toggleAmenity = (bit: number) => setFilters({ ...f, amenities: f.amenities ^ bit })

  return (
    <div className={`filters filters--${variant}`} role="group" aria-label="Filter spots">
      <div className="filters__scroll">
        {ALL_AMENITIES.map((a) => {
          const on = (f.amenities & a.bit) !== 0
          return (
            <button
              key={a.key}
              type="button"
              className={`chip${on ? ' is-on' : ''}`}
              aria-pressed={on}
              onClick={() => toggleAmenity(a.bit)}
            >
              <span className="chip__icon">
                <Pictogram amenity={a.key} size={16} />
              </span>
              <span>{a.short}</span>
            </button>
          )
        })}
        <span className="filters__divider" aria-hidden="true" />
        <button
          type="button"
          className={`chip chip--status${f.showStale ? ' is-on' : ''}`}
          aria-pressed={f.showStale}
          onClick={() => setFilters({ ...f, showStale: !f.showStale })}
        >
          <StatusGlyph status={STATUS.Stale} size={18} />
          <span>Stale</span>
        </button>
        <button
          type="button"
          className={`chip chip--status${f.showGone ? ' is-on' : ''}`}
          aria-pressed={f.showGone}
          onClick={() => setFilters({ ...f, showGone: !f.showGone })}
        >
          <StatusGlyph status={STATUS.ReportedGone} size={18} />
          <span>Reported gone</span>
        </button>
      </div>
    </div>
  )
}
