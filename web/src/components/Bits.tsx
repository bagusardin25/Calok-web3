import { useEffect, useState } from 'react'
import { Check, Copy, LoaderCircle, Share2, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { chain, explorerAddressUrl, explorerTxUrl } from '../config/chains'
import { PLACES, STATUS_META, amenitiesOf } from '../config/site'
import type { Pin } from '../lib/contract'
import { formatDistance, shortAddress, timeAgo } from '../lib/format'
import { href } from '../lib/router'
import type { TxState } from '../lib/tx'
import { AmenityTiles, StatusGlyph } from './Pictograms'

export function StatusBadge({ status, large = false }: { status: number; large?: boolean }) {
  const meta = STATUS_META[status]
  return (
    <span className={`status status--${meta?.shape ?? 'none'}${large ? ' status--lg' : ''}`}>
      <StatusGlyph status={status} size={large ? 24 : 18} />
      <span className="status__label">{meta?.label ?? 'Unknown'}</span>
    </span>
  )
}

export function Spinner({ label }: { label: string }) {
  return (
    <span className="spinner" role="status">
      <LoaderCircle size={18} className="spin" aria-hidden="true" />
      <span>{label}</span>
    </span>
  )
}

/** A hazard-striped notice. `tone` only changes the stripe; the icon and words carry the meaning. */
export function Notice({
  title,
  children,
  tone = 'info',
  action,
}: {
  title: string
  children?: ReactNode
  tone?: 'info' | 'warn'
  action?: ReactNode
}) {
  return (
    <div className={`notice notice--${tone}`} role={tone === 'warn' ? 'alert' : undefined}>
      {tone === 'warn' ? <TriangleAlert size={20} className="notice__icon" aria-hidden="true" /> : null}
      <div className="notice__body">
        <p className="notice__title">{title}</p>
        {children ? <div className="notice__text">{children}</div> : null}
        {action ? <div className="notice__action">{action}</div> : null}
      </div>
    </div>
  )
}

export function AddressLink({ address, label }: { address: string; label?: string }) {
  const url = explorerAddressUrl(address)
  const text = label ?? shortAddress(address)
  return url ? (
    <a className="mono" href={url} target="_blank" rel="noreferrer" title={address}>
      {text}
    </a>
  ) : (
    <span className="mono" title={address}>
      {text}
    </span>
  )
}

export function CopyButton({ text, label, dark = false }: { text: string; label: string; dark?: boolean }) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const t = window.setTimeout(() => setCopied(false), 2000)
    return () => window.clearTimeout(t)
  }, [copied])
  return (
    <button
      type="button"
      className={`btn ${dark ? 'btn--ghost-dark' : 'btn--ghost'} btn--sm`}
      onClick={() => {
        navigator.clipboard?.writeText(text).then(
          () => setCopied(true),
          () => setCopied(false),
        )
      }}
    >
      {copied ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
      <span aria-live="polite">{copied ? 'Copied' : label}</span>
    </button>
  )
}

export function ShareButton({ url, title }: { url: string; title: string }) {
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'
  if (!canShare) return <CopyButton text={url} label="Copy link" dark />
  return (
    <button
      type="button"
      className="btn btn--ghost-dark btn--sm"
      onClick={() => {
        navigator.share({ title, url }).catch(() => undefined)
      }}
    >
      <Share2 size={18} aria-hidden="true" />
      <span>Share link</span>
    </button>
  )
}

/** Progress and outcome of one transaction, announced to screen readers. */
export function TxStatus({ state, doneText }: { state: TxState; doneText: string }) {
  const link = state.hash ? explorerTxUrl(state.hash) : undefined
  let text: ReactNode = null
  if (state.phase === 'preparing') text = <Spinner label="Checking the rules…" />
  if (state.phase === 'wallet') text = <Spinner label="Confirm in your wallet…" />
  if (state.phase === 'mining') text = <Spinner label={`Writing to ${chain.name}…`} />
  if (state.phase === 'done') {
    text = (
      <span className="tx-done">
        <Check size={18} aria-hidden="true" />
        <span>{doneText}</span>
        {link ? (
          <>
            {' '}
            <a href={link} target="_blank" rel="noreferrer">
              View transaction
            </a>
          </>
        ) : null}
      </span>
    )
  }
  if (state.phase === 'error') {
    text = (
      <span className="tx-error">
        <TriangleAlert size={18} aria-hidden="true" />
        <span>{state.error}</span>
      </span>
    )
  }
  return (
    <div className="tx" aria-live="polite">
      {text}
    </div>
  )
}

/** One spot in a list: a link to its page, with shape, status words, amenities and distance. */
export function SpotRow({ pin, distance, now }: { pin: Pin; distance?: number; now: number }) {
  const meta = STATUS_META[pin.status]
  const amenityNames = amenitiesOf(pin.amenities)
    .map((a) => a.short)
    .join(', ')
  return (
    <li className={`spot-row spot-row--${meta?.shape ?? 'none'}`}>
      <a className="spot-row__link" href={href.spot(pin.id)}>
        <span className="spot-row__glyph">
          <StatusGlyph status={pin.status} size={34} />
        </span>
        <span className="spot-row__main">
          <span className="spot-row__name">{pin.name}</span>
          <span className="spot-row__meta">
            <span className="spot-row__status">{meta?.label}</span>
            <span className="sep" aria-hidden="true" />
            <span>{PLACES[pin.place] ?? 'Other'}</span>
            <span className="sep" aria-hidden="true" />
            <span>
              {pin.confirmations > 0 ? `seen ${timeAgo(pin.lastSeenAt, now)}` : `added ${timeAgo(pin.lastSeenAt, now)}`}
            </span>
          </span>
          <span className="visually-hidden">Offers {amenityNames}.</span>
          <AmenityTiles mask={pin.amenities} size="sm" />
        </span>
        {distance !== undefined ? <span className="spot-row__dist">{formatDistance(distance)}</span> : null}
      </a>
    </li>
  )
}
