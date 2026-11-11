// The MapLibre map. This module is loaded on demand (React.lazy), so the page frame and the
// nearby list render before the map library has downloaded.
import { useEffect, useImperativeHandle, useRef } from 'react'
import { AttributionControl, Map as MapLibre, Marker, NavigationControl, setWorkerUrl } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { PLACES, STATUS_META, TILES, amenitiesOf } from '../config/site'
import type { Pin } from '../lib/contract'
import { pinSvg, shapeOf } from './Pictograms'

setWorkerUrl(workerUrl)

export type MapMove = {
  lat: number
  lng: number
  zoom: number
  bounds: { south: number; west: number; north: number; east: number }
}

export type MapController = {
  flyTo(lat: number, lng: number, zoom?: number): void
  center(): { lat: number; lng: number } | null
}

export type MapCanvasProps = {
  initial: { lat: number; lng: number; zoom: number }
  pins: Pin[]
  selectedId?: number
  pulseId?: number | null
  you?: { lat: number; lng: number } | null
  /** Space covered by overlays (panel, filter bar), so the map centres in what stays visible. */
  padding?: { left: number; bottom: number; top?: number }
  interactivePins?: boolean
  controller?: { current: MapController | null }
  onMove(move: MapMove): void
  onPinClick?(id: number): void
  onReady?(): void
  onFail(reason: 'style' | 'webgl' | 'timeout'): void
  onTileTrouble?(trouble: boolean): void
}

const LOAD_TIMEOUT_MS = 15_000

function pinLabel(pin: Pin, selected: boolean): string {
  const status = STATUS_META[pin.status]?.label ?? 'Unknown status'
  const amenities = amenitiesOf(pin.amenities)
    .map((a) => a.short)
    .join(', ')
  return `${pin.name}. ${status}. ${PLACES[pin.place] ?? 'Other'}, ${amenities}.${selected ? ' Selected.' : ''}`
}

export default function MapCanvas(props: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibre | null>(null)
  const markers = useRef(new Map<number, { marker: Marker; el: HTMLButtonElement; key: string }>())
  const youMarker = useRef<Marker | null>(null)
  const latest = useRef(props)
  useEffect(() => {
    latest.current = props
  })

  // Create the map once.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const { initial } = latest.current
    let map: MapLibre
    try {
      map = new MapLibre({
        container,
        style: TILES.style,
        center: [initial.lng, initial.lat],
        zoom: initial.zoom,
        attributionControl: false,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        maxPitch: 0,
        minZoom: 1,
        maxZoom: 19,
      })
    } catch {
      latest.current.onFail('webgl')
      return
    }
    mapRef.current = map
    // OpenStreetMap credit stays expanded at every size; it is never folded behind a button.
    map.addControl(new AttributionControl({ compact: false }), 'bottom-right')
    map.addControl(new NavigationControl({ showCompass: false }), 'bottom-right')
    map.touchZoomRotate.disableRotation()

    let loaded = false
    let tileErrors = 0
    let troubled = false
    const timeout = window.setTimeout(() => {
      if (!loaded) latest.current.onFail('timeout')
    }, LOAD_TIMEOUT_MS)

    const report = () => {
      const c = map.getCenter()
      const b = map.getBounds()
      latest.current.onMove({
        lat: c.lat,
        lng: c.lng,
        zoom: map.getZoom(),
        bounds: { south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() },
      })
    }

    // Ready as soon as the style is in. The 'load' event waits for every tile of the first view,
    // which on a slow connection can take long enough to trip the timeout and delays the pins.
    const markReady = () => {
      if (loaded) return
      loaded = true
      window.clearTimeout(timeout)
      latest.current.onReady?.()
      report()
    }
    map.once('style.load', markReady)
    map.once('load', markReady)
    // Marks the container once every visible tile has rendered (used by the README screenshots).
    map.on('idle', () => {
      container.dataset.idle = 'true'
    })
    map.on('movestart', () => {
      delete container.dataset.idle
    })
    map.on('moveend', () => {
      if (loaded) report()
    })
    map.on('error', () => {
      if (!loaded) {
        window.clearTimeout(timeout)
        latest.current.onFail('style')
        return
      }
      // After the style is in, single tile failures are normal on a shaky connection.
      // Many in a row mean the tile server is unreachable.
      tileErrors += 1
      if (tileErrors >= 6 && !troubled) {
        troubled = true
        latest.current.onTileTrouble?.(true)
      }
    })
    map.on('data', (event) => {
      if (troubled && event.dataType === 'source' && 'tile' in event && event.tile) {
        troubled = false
        tileErrors = 0
        latest.current.onTileTrouble?.(false)
      }
    })

    const markerMap = markers.current
    const you = youMarker
    return () => {
      window.clearTimeout(timeout)
      markerMap.forEach(({ marker }) => marker.remove())
      markerMap.clear()
      you.current?.remove()
      you.current = null
      map.remove()
      mapRef.current = null
    }
    // The map is created once per mount; later prop changes are applied by the effects below.
  }, [])

  // Let the page move the map (open a spot, centre on the person).
  useImperativeHandle(
    props.controller,
    () => ({
      flyTo(lat: number, lng: number, zoom?: number) {
        const map = mapRef.current
        if (!map) return
        // Jump instead of animating for reduced motion, and in a background tab where animation
        // frames do not run and an eased move would never finish.
        const reduce =
          window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.visibilityState !== 'visible'
        map.easeTo({ center: [lng, lat], zoom: zoom ?? Math.max(map.getZoom(), 15), duration: reduce ? 0 : 700 })
      },
      center() {
        const c = mapRef.current?.getCenter()
        return c ? { lat: c.lat, lng: c.lng } : null
      },
    }),
    [],
  )

  // Keep the pins in step with the data.
  const { pins, selectedId, pulseId, interactivePins = true } = props
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const seen = new Set<number>()
    for (const pin of pins) {
      seen.add(pin.id)
      const selected = pin.id === selectedId
      const shape = shapeOf(pin.status)
      const key = `${shape}|${selected}|${pin.name}|${pin.amenities}|${pin.status}`
      const existing = markers.current.get(pin.id)
      if (existing) {
        if (existing.key !== key) {
          existing.el.className = `pin pin--${shape}${selected ? ' is-selected' : ''}`
          existing.el.innerHTML = pinSvg(shape)
          existing.el.setAttribute('aria-label', pinLabel(pin, selected))
          existing.el.setAttribute('aria-pressed', String(selected))
          existing.marker.getElement().style.zIndex = selected ? '3' : shape === 'solid' ? '2' : '1'
          existing.key = key
        }
        const pos = existing.marker.getLngLat()
        if (pos.lat !== pin.lat / 1e6 || pos.lng !== pin.lng / 1e6) existing.marker.setLngLat([pin.lng / 1e6, pin.lat / 1e6])
        continue
      }
      const el = document.createElement('button')
      el.type = 'button'
      el.className = `pin pin--${shape}${selected ? ' is-selected' : ''}`
      el.innerHTML = pinSvg(shape)
      el.setAttribute('aria-label', pinLabel(pin, selected))
      el.setAttribute('aria-pressed', String(selected))
      if (!interactivePins) {
        // Context only: no focus, no hit area, hidden from assistive tech (the form is the way in).
        el.tabIndex = -1
        el.style.pointerEvents = 'none'
        el.setAttribute('aria-hidden', 'true')
      }
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        latest.current.onPinClick?.(pin.id)
      })
      const marker = new Marker({ element: el, anchor: 'bottom' }).setLngLat([pin.lng / 1e6, pin.lat / 1e6]).addTo(map)
      marker.getElement().style.zIndex = selected ? '3' : shape === 'solid' ? '2' : '1'
      markers.current.set(pin.id, { marker, el, key })
    }
    for (const [id, entry] of markers.current) {
      if (!seen.has(id)) {
        entry.marker.remove()
        markers.current.delete(id)
      }
    }
  }, [pins, selectedId, interactivePins])

  // One pulse for a spot that was just added.
  useEffect(() => {
    if (pulseId == null) return
    const entry = markers.current.get(pulseId)
    if (!entry) return
    entry.el.classList.add('pin--pulse')
    const done = () => entry.el.classList.remove('pin--pulse')
    entry.el.addEventListener('animationend', done, { once: true })
  }, [pulseId, pins])

  // The person's own position, shown as a dot. It stays in this browser.
  const { you } = props
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (!you) {
      youMarker.current?.remove()
      youMarker.current = null
      return
    }
    if (!youMarker.current) {
      const el = document.createElement('div')
      el.className = 'you-dot'
      el.setAttribute('role', 'img')
      el.setAttribute('aria-label', 'Your location')
      youMarker.current = new Marker({ element: el }).setLngLat([you.lng, you.lat]).addTo(map)
    } else {
      youMarker.current.setLngLat([you.lng, you.lat])
    }
  }, [you])

  const padLeft = props.padding?.left ?? 0
  const padBottom = props.padding?.bottom ?? 0
  const padTop = props.padding?.top ?? 0
  useEffect(() => {
    mapRef.current?.setPadding({ left: padLeft, bottom: padBottom, top: padTop, right: 0 })
  }, [padLeft, padBottom, padTop])

  return <div ref={containerRef} className="map-canvas" />
}
