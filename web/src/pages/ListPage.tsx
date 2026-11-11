import { useMemo } from 'react'
import { LocateFixed, Map as MapIcon, Plus } from 'lucide-react'
import { Notice, SpotRow, Spinner } from '../components/Bits'
import { Footer } from '../components/Chrome'
import { FilterBar, applyFilters } from '../components/FilterBar'
import { cellsAround, toMicro } from '../geo/cells'
import { distanceMetres } from '../geo/distance'
import { fetchNewestSpotLocation, fetchPinsInCells, fetchRecentPins } from '../lib/contract'
import { describeError } from '../lib/errors'
import { href } from '../lib/router'
import { requestLocation, useChainNow, useDeviceLocation, useFilters, useMapView } from '../lib/store'
import { useAsync } from '../lib/useAsync'
import { StatsStrip } from './StatsStrip'

/** 5 x 5 cells around the reference point: roughly 55 km across near the equator. */
const RADIUS_CELLS = 2

type Ref = { lat: number; lng: number; source: 'you' | 'map' | 'newest' }

export function ListPage() {
  const location = useDeviceLocation()
  const mapView = useMapView()
  const filters = useFilters()
  const now = useChainNow()

  const fallback = useAsync(location.status !== 'granted' && !mapView ? 'newest-location' : null, fetchNewestSpotLocation)

  const ref: Ref | null =
    location.status === 'granted'
      ? { lat: location.lat, lng: location.lng, source: 'you' }
      : mapView
        ? { lat: mapView.lat, lng: mapView.lng, source: 'map' }
        : fallback.data
          ? { ...fallback.data, source: 'newest' }
          : null

  // The block of cells is the key, so small moves inside the same cells do not refetch.
  const cells = ref ? cellsAround(toMicro(ref.lat), toMicro(ref.lng), RADIUS_CELLS) : null
  const nearby = useAsync(cells ? `near:${cells[0]}:${cells[cells.length - 1]}` : null, () => fetchPinsInCells(cells!))
  const recent = useAsync(fallback.data === null ? 'recent-any' : null, () => fetchRecentPins(20))

  const refLat = ref?.lat
  const refLng = ref?.lng
  const rows = useMemo(() => {
    if (refLat === undefined || refLng === undefined || !nearby.data) return []
    return applyFilters(nearby.data.pins, filters)
      .map((pin) => ({ pin, distance: distanceMetres(refLat, refLng, pin.lat / 1e6, pin.lng / 1e6) }))
      .sort((a, b) => a.distance - b.distance)
  }, [nearby.data, filters, refLat, refLng])

  const sortedFrom =
    ref?.source === 'you'
      ? 'Sorted by distance from your location.'
      : ref?.source === 'map'
        ? 'Sorted by distance from the centre of the map you last looked at.'
        : ref?.source === 'newest'
          ? 'Location is off, so this starts from the area of the newest spot.'
          : ''

  const error = nearby.error ?? fallback.error
  const total = nearby.data?.pins.length ?? 0

  return (
    <>
      <main id="main" className="page">
        <header className="page-head">
          <p className="sign-label">Nearby</p>
          <h1>Spots near you</h1>
          <p className="page-head__lead">
            The list holds the same spots as the map, nearest first. It works without the map and with a keyboard or screen
            reader.
          </p>
          <div className="page-head__actions">
            <button
              type="button"
              className="btn btn--ink btn--sm"
              onClick={() => void requestLocation()}
              disabled={location.status === 'asking'}
            >
              <LocateFixed size={18} aria-hidden="true" />
              {location.status === 'asking' ? 'Finding you…' : location.status === 'granted' ? 'Update my location' : 'Use my location'}
            </button>
            <a className="btn btn--ghost btn--sm" href={href.map}>
              <MapIcon size={18} aria-hidden="true" />
              Show the map
            </a>
            <a className="btn btn--yellow btn--sm" href={href.add}>
              <Plus size={18} strokeWidth={3} aria-hidden="true" />
              Add a spot
            </a>
          </div>
          {location.status === 'denied' ? (
            <p className="hint hint--warn">Location is blocked for this site, so the list starts from the map area instead.</p>
          ) : null}
          {location.status === 'unavailable' || location.status === 'unsupported' ? (
            <p className="hint hint--warn">Your device could not share a position, so the list starts from the map area instead.</p>
          ) : null}
        </header>

        <StatsStrip />

        <section className="list-section" aria-labelledby="nearby-title">
          <div className="list-section__head">
            <h2 id="nearby-title">Within about 25 km</h2>
            <p className="hint">{sortedFrom}</p>
          </div>
          <FilterBar variant="page" />

          {error ? (
            <Notice
              tone="warn"
              title={describeError(error)}
              action={
                <button type="button" className="btn btn--ink btn--sm" onClick={nearby.reload}>
                  Try again
                </button>
              }
            />
          ) : null}

          {!error && (nearby.loading || fallback.loading) && rows.length === 0 ? <Spinner label="Reading spots from BOT Chain…" /> : null}

          {!error && nearby.data ? (
            rows.length > 0 ? (
              <>
                <p className="list-count" aria-live="polite">
                  {rows.length === total ? `${rows.length} spots` : `${rows.length} of ${total} spots match your filters`}
                  {nearby.data.truncated ? '; the busiest areas show their 30 newest spots' : ''}
                </p>
                <ol className="spot-list">
                  {rows.map(({ pin, distance }) => (
                    <SpotRow key={pin.id} pin={pin} distance={distance} now={now} />
                  ))}
                </ol>
              </>
            ) : total > 0 ? (
              <Notice title="No spots nearby match your filters." />
            ) : (
              <Notice
                title="No spots within about 25 km yet."
                action={
                  <a className="btn btn--yellow btn--sm" href={href.add}>
                    Add the first one
                  </a>
                }
              />
            )
          ) : null}

          {fallback.data === null && recent.data ? (
            recent.data.length > 0 ? (
              <ol className="spot-list">
                {applyFilters(recent.data, filters).map((pin) => (
                  <SpotRow key={pin.id} pin={pin} now={now} />
                ))}
              </ol>
            ) : (
              <Notice
                title="No spots have been added yet."
                action={
                  <a className="btn btn--yellow btn--sm" href={href.add}>
                    Add the first one
                  </a>
                }
              />
            )
          ) : null}
        </section>
      </main>
      <Footer />
    </>
  )
}
