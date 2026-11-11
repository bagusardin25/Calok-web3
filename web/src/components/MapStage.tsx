import { Component, Suspense, lazy, useState } from 'react'
import type { ReactNode } from 'react'
import { List, RotateCw } from 'lucide-react'
import { href } from '../lib/router'
import type { MapCanvasProps } from './MapCanvas'

const MapCanvas = lazy(() => import('./MapCanvas'))

/** Catches a failed download of the map chunk itself (offline, blocked). */
class ChunkBoundary extends Component<{ onFail(): void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch() {
    this.props.onFail()
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

type Props = Omit<MapCanvasProps, 'onFail'> & {
  /** Shown over the map when it cannot load; usually a pointer to the list. */
  failHint?: ReactNode
  /** Drawn over the map only while it is working (the crosshair on the add page). */
  overlay?: ReactNode
  onFailChange?(failed: boolean): void
}

const REASONS: Record<string, string> = {
  style: 'The map tiles could not be loaded.',
  webgl: 'This browser cannot draw the map (WebGL is off or unsupported).',
  timeout: 'The map is taking too long to load.',
  chunk: 'The map could not be downloaded.',
}

/**
 * The map area with its loading and failure states. The rest of the page never waits for it,
 * and when it fails the person is pointed to the list, which does everything the map does.
 */
export function MapStage({ failHint, overlay, onFailChange, ...props }: Props) {
  const [failure, setFailureState] = useState<string | null>(null)
  const setFailure = (next: string | null) => {
    setFailureState(next)
    onFailChange?.(next !== null)
  }
  const [ready, setReady] = useState(false)
  const [attempt, setAttempt] = useState(0)

  return (
    <div className={`map-stage${ready ? ' is-ready' : ''}`}>
      {failure ? (
        <div className="map-fallback" role="alert">
          <p className="sign-label">Map unavailable</p>
          <p className="map-fallback__title">{REASONS[failure] ?? REASONS.style}</p>
          {failHint ?? <p>Every spot is still in the nearby list, with the same filters and actions.</p>}
          <div className="map-fallback__actions">
            <a className="btn btn--yellow" href={href.list}>
              <List size={18} aria-hidden="true" />
              Open the nearby list
            </a>
            <button
              type="button"
              className="btn btn--ghost-dark"
              onClick={() => {
                setFailure(null)
                setReady(false)
                setAttempt((a) => a + 1)
              }}
            >
              <RotateCw size={18} aria-hidden="true" />
              Try the map again
            </button>
          </div>
        </div>
      ) : (
        <ChunkBoundary key={attempt} onFail={() => setFailure('chunk')}>
          <Suspense fallback={null}>
            <MapCanvas
              key={attempt}
              {...props}
              onReady={() => {
                setReady(true)
                props.onReady?.()
              }}
              onFail={(reason) => setFailure(reason)}
            />
          </Suspense>
        </ChunkBoundary>
      )}
      {!failure ? overlay : null}
      {!ready && !failure ? (
        <div className="map-loading" aria-hidden="true">
          <span>Loading map…</span>
        </div>
      ) : null}
    </div>
  )
}
