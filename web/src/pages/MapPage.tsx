import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { List, LocateFixed, Plus } from 'lucide-react'
import { BotChainBar } from '../components/Chrome'
import { Notice, Spinner } from '../components/Bits'
import { FilterBar, applyFilters } from '../components/FilterBar'
import type { MapController, MapMove } from '../components/MapCanvas'
import { MapStage } from '../components/MapStage'
import { StatusGlyph } from '../components/Pictograms'
import { SpotPanel } from '../components/SpotPanel'
import { STATUS, STATUS_META } from '../config/site'
import { cellsInBounds } from '../geo/cells'
import { NotDeployedError, fetchNewestSpotLocation, fetchPinsInCells, fetchRecentPins, fetchSpot } from '../lib/contract'
import type { Pin } from '../lib/contract'
import { describeError } from '../lib/errors'
import { href, navigate } from '../lib/router'
import {
  getMapView,
  markJustAdded,
  requestLocation,
  restoreLocationIfAllowed,
  setMapView,
  useDeviceLocation,
  useFilters,
  useJustAdded,
} from '../lib/store'
import type { View } from '../lib/store'
import { useAsync, useMedia } from '../lib/useAsync'

/** Indonesia, whole, for a first visit to an empty map. */
const DEFAULT_VIEW: View = { lat: -2.5, lng: 118, zoom: 4 }
const ASKED_KEY = 'colok.asked-location'

const withTimeout = <T,>(promise: Promise<T>, ms: number, fallback: T) =>
  Promise.race([promise, new Promise<T>((resolve) => window.setTimeout(() => resolve(fallback), ms))])

/** Where the map opens: the spot being linked to, the last view, the person, or the newest spots. */
function useInitialView(spotId: number | undefined, here: { lat: number; lng: number } | null) {
  const [stored] = useState(() => getMapView())
  const [start] = useState(here)
  return useAsync(`initial:${spotId ?? ''}`, async (): Promise<View> => {
    if (spotId) {
      try {
        const spot = await fetchSpot(spotId)
        return { lat: spot.lat / 1e6, lng: spot.lng / 1e6, zoom: 16 }
      } catch {
        // Fall through to the usual opening view.
      }
    }
    if (stored) return stored
    if (start) return { ...start, zoom: 15 }
    const place = await withTimeout(
      fetchNewestSpotLocation().catch(() => null),
      4000,
      null,
    )
    return place ? { ...place, zoom: 14 } : DEFAULT_VIEW
  })
}

const LEGEND = [STATUS.Verified, STATUS.New, STATUS.Stale, STATUS.ReportedGone]

function Legend() {
  const [open, setOpen] = useState(false)
  return (
    <div className={`legend${open ? ' is-open' : ''}`}>
      <button type="button" className="legend__toggle" aria-expanded={open} aria-controls="legend-list" onClick={() => setOpen((o) => !o)}>
        Key
      </button>
      {open ? (
        <ul id="legend-list" className="legend__list">
          {LEGEND.map((s) => (
            <li key={s}>
              <StatusGlyph status={s} size={24} />
              <span>
                <strong>{STATUS_META[s].label}</strong> {STATUS_META[s].explain}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

type Area = { pins: Pin[]; truncated: boolean; recent: boolean }

export function MapPage({ spotId }: { spotId?: number }) {
  const location = useDeviceLocation()
  const initial = useInitialView(spotId, location.status === 'granted' ? { lat: location.lat, lng: location.lng } : null)
  const controller = useRef<MapController | null>(null)
  const [move, setMove] = useState<MapMove | null>(null)
  const [tileTrouble, setTileTrouble] = useState(false)
  const [mapFailed, setMapFailed] = useState(false)
  const [locationNoticeClosed, setLocationNoticeClosed] = useState(false)
  const filters = useFilters()
  const justAdded = useJustAdded()
  const wide = useMedia('(min-width: 900px)')
  const panelRef = useRef<HTMLElement>(null)
  const [panelSize, setPanelSize] = useState({ width: 0, height: 0 })

  // Location: reuse an earlier permission silently; ask once per visit otherwise (PRD 7.1).
  useEffect(() => {
    void restoreLocationIfAllowed()
    try {
      if (!sessionStorage.getItem(ASKED_KEY)) {
        sessionStorage.setItem(ASKED_KEY, '1')
        void requestLocation()
      }
    } catch {
      // No session storage: wait for the locate button.
    }
  }, [])

  // Fly to the person when their position arrives during this visit (the permission prompt or
  // the locate button), unless a spot link is open. If the map is still loading, fly once it is ready.
  const pendingFly = useRef<{ lat: number; lng: number } | null>(null)
  const prevStatus = useRef(location.status)
  useEffect(() => {
    const was = prevStatus.current
    prevStatus.current = location.status
    if (location.status !== 'granted' || was === 'granted' || spotId) return
    if (controller.current) controller.current.flyTo(location.lat, location.lng, 15)
    else pendingFly.current = { lat: location.lat, lng: location.lng }
  }, [location, spotId])

  // Which cells are on screen decides what to read from the chain.
  const cells = move ? cellsInBounds(move.bounds) : undefined
  const areaKey = cells === undefined ? null : cells === null ? 'recent' : [...cells].sort((a, b) => a - b).join(',')
  const area = useAsync<Area>(
    areaKey,
    async () =>
      cells === null || cells === undefined
        ? { pins: await fetchRecentPins(20), truncated: false, recent: true }
        : { ...(await fetchPinsInCells(cells)), recent: false },
    { keep: true },
  )

  // The open spot always has a pin, even when it is outside the loaded area or filtered out.
  const selected = useAsync(spotId ? `spot:${spotId}` : null, () => fetchSpot(spotId!))
  const pins = useMemo(() => {
    const list = applyFilters(area.data?.pins ?? [], filters)
    const s = selected.data
    if (s && !s.hidden && !s.closed && !list.some((p) => p.id === s.id)) {
      list.push({
        id: s.id,
        lat: s.lat,
        lng: s.lng,
        amenities: s.amenities,
        place: s.place,
        score: s.score,
        status: s.status,
        lastSeenAt: s.lastConfirmedAt || s.createdAt,
        confirmations: s.confirmations,
        reports: s.reports,
        name: s.name,
      })
    }
    return list
  }, [area.data, filters, selected.data])

  // Move to a spot when its link opens while the map is already up.
  const flownTo = useRef<number | null>(null)
  useEffect(() => {
    const s = selected.data
    if (!s || flownTo.current === s.id) return
    flownTo.current = s.id
    controller.current?.flyTo(s.lat / 1e6, s.lng / 1e6, 16)
  }, [selected.data])

  useEffect(() => {
    if (justAdded == null) return
    const t = window.setTimeout(() => markJustAdded(null), 4000)
    return () => window.clearTimeout(t)
  }, [justAdded])

  // Keep the map centred in the part the detail panel does not cover.
  useEffect(() => {
    const el = panelRef.current
    if (!el) {
      setPanelSize({ width: 0, height: 0 })
      return
    }
    const ro = new ResizeObserver(() => setPanelSize({ width: el.offsetWidth, height: el.offsetHeight }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [spotId])
  // Escape closes the detail panel (the wallet dialog handles its own Escape).
  useEffect(() => {
    if (!spotId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('dialog[open]')) navigate(href.map)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [spotId])

  // 64 px keeps the pin clear of the filter row along the top.
  const padding = spotId
    ? wide
      ? { left: panelSize.width, bottom: 0, top: 64 }
      : { left: 0, bottom: panelSize.height, top: 64 }
    : undefined

  const allPins = area.data?.pins ?? []
  const hiddenByFilter = allPins.length > 0 && pins.length === 0
  const notDeployed = area.error instanceof NotDeployedError || initial.error instanceof NotDeployedError

  let banner: ReactNode = null
  if (notDeployed) {
    banner = <Notice tone="warn" title={describeError(new NotDeployedError())} />
  } else if (area.error) {
    banner = (
      <Notice
        tone="warn"
        title={describeError(area.error)}
        action={
          <button type="button" className="btn btn--ghost-dark btn--sm" onClick={area.reload}>
            Try again
          </button>
        }
      />
    )
  } else if (area.data?.recent) {
    banner = (
      <Notice title="Zoom in to load the spots in this area.">
        {allPins.length > 0 ? <p>Meanwhile the newest spots are shown.</p> : <p>No spots have been added yet.</p>}
      </Notice>
    )
  } else if (area.data && allPins.length === 0 && !area.loading) {
    banner = (
      <Notice title="No spots in this area yet." action={<a className="btn btn--yellow btn--sm" href={href.add}>Add the first one</a>} />
    )
  } else if (hiddenByFilter) {
    banner = <Notice title="No spots here match your filters." />
  } else if (area.data?.truncated) {
    banner = <Notice title="Some spots here are not shown. Zoom in to see them all." />
  }

  return (
    <main id="main" className={`map-page${spotId ? ' has-panel' : ''}${mapFailed ? ' map-failed' : ''}`}>
      <h1 className="visually-hidden">Colok map: public power outlets, Wi-Fi, water refills and seating</h1>
      <a className="skip-map" href={href.list}>
        Skip the map: open the nearby list
      </a>
      <div className="map-wrap" style={{ '--sheet-h': `${spotId && !wide ? panelSize.height : 0}px` } as CSSProperties}>
        {initial.data ? (
          <MapStage
            initial={initial.data}
            pins={pins}
            selectedId={spotId}
            pulseId={justAdded}
            you={location.status === 'granted' ? { lat: location.lat, lng: location.lng } : null}
            padding={padding}
            controller={controller}
            onMove={(m) => {
              setMove(m)
              setMapView({ lat: m.lat, lng: m.lng, zoom: m.zoom })
            }}
            onPinClick={(id) => navigate(href.spot(id))}
            onTileTrouble={setTileTrouble}
            onFailChange={setMapFailed}
            onReady={() => {
              const target = pendingFly.current
              pendingFly.current = null
              if (target) controller.current?.flyTo(target.lat, target.lng, 15)
            }}
          />
        ) : (
          <div className="map-stage">
            <div className="map-loading">
              <span>Finding a place to start…</span>
            </div>
          </div>
        )}

        <div className="map-top">
          <FilterBar variant="map" />
          <div className="map-banners" aria-live="polite">
            {banner}
            {tileTrouble ? <Notice tone="warn" title="Map tiles are not loading well. The list still works." /> : null}
            {location.status === 'denied' && !locationNoticeClosed ? (
              <Notice
                title="Location is off."
                action={
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => setLocationNoticeClosed(true)}>
                    OK
                  </button>
                }
              >
                <p>Move the map by hand, or allow location in your browser settings to centre it on you.</p>
              </Notice>
            ) : null}
            {area.loading && !area.data ? <Spinner label="Reading spots from BOT Chain…" /> : null}
          </div>
        </div>

        <div className="map-tools">
          <button
            type="button"
            className="icon-btn icon-btn--plate"
            aria-label="Centre the map on my location"
            disabled={location.status === 'asking'}
            onClick={async () => {
              const next = await requestLocation()
              if (next.status === 'granted') controller.current?.flyTo(next.lat, next.lng, 15)
            }}
          >
            <LocateFixed size={22} aria-hidden="true" />
          </button>
          <a className="icon-btn icon-btn--plate" href={href.list} aria-label="Show as a list">
            <List size={22} aria-hidden="true" />
          </a>
        </div>

        <Legend />

        {!spotId ? (
          <a className="fab-add" href={href.add}>
            <Plus size={22} strokeWidth={3} aria-hidden="true" />
            Add a spot
          </a>
        ) : null}

        {spotId ? (
          <aside ref={panelRef} className="panel" aria-label="Spot details">
            <SpotPanel id={spotId} onClose={() => navigate(href.map)} />
          </aside>
        ) : null}
      </div>
      <BotChainBar />
    </main>
  )
}
