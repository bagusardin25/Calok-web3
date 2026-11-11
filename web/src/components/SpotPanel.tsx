import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Check, ExternalLink, Flag, Navigation, X } from 'lucide-react'
import { PLACES, REASONS, RULES, STATUS, STATUS_META, amenitiesOf } from '../config/site'
import { VOTE_BLOCK, fetchMapper, fetchOwner, fetchSpot, fetchVote, prepare } from '../lib/contract'
import type { Spot } from '../lib/contract'
import { describeError } from '../lib/errors'
import { degrees, formatDate, formatScore, plural, sameAddress, timeAgo } from '../lib/format'
import { absoluteUrl, href } from '../lib/router'
import { acknowledge, useAcknowledged, useChainNow } from '../lib/store'
import { useTx } from '../lib/tx'
import { useAsync } from '../lib/useAsync'
import { useWallet } from '../lib/wallet'
import { AddressLink, Notice, ShareButton, Spinner, StatusBadge, TxStatus } from './Bits'
import { Pictogram } from './Pictograms'

function statusLine(spot: Spot, now: number): string {
  if (spot.status === STATUS.Hidden || spot.status === STATUS.Closed) return STATUS_META[spot.status].explain
  const seen = spot.lastConfirmedAt
    ? `Last confirmed ${timeAgo(spot.lastConfirmedAt, now)}`
    : `Added ${timeAgo(spot.createdAt, now)}, not confirmed yet`
  return `${seen}. ${STATUS_META[spot.status]?.explain ?? ''}`
}

function ScoreMeter({ score }: { score: number }) {
  const steps = [-3, -2, -1, 0, 1, 2, 3]
  return (
    <span className="meter" role="img" aria-label={`Health score ${formatScore(score)}, on a scale from −3 to +3`}>
      {steps.map((s) => (
        <span
          key={s}
          className={`meter__step${s === 0 ? ' is-zero' : ''}${(score > 0 && s > 0 && s <= score) || (score < 0 && s < 0 && s >= score) ? (score > 0 ? ' is-up' : ' is-down') : ''}`}
        />
      ))}
      <span className="meter__value mono">{formatScore(score)}</span>
    </span>
  )
}

const directionsUrl = (spot: Spot) =>
  `https://www.google.com/maps/dir/?api=1&destination=${degrees(spot.lat)},${degrees(spot.lng)}`
const osmUrl = (spot: Spot) =>
  `https://www.openstreetmap.org/?mlat=${degrees(spot.lat)}&mlon=${degrees(spot.lng)}#map=18/${degrees(spot.lat)}/${degrees(spot.lng)}`

/** Still here / Report a problem, with every reason the buttons may be unavailable. */
function VoteActions({ spot }: { spot: Spot }) {
  const wallet = useWallet()
  const account = wallet.active?.account
  const tx = useTx()
  const [mode, setMode] = useState<'idle' | 'ack' | 'report'>('idle')
  const [reason, setReason] = useState<number | null>(null)
  const [reasonError, setReasonError] = useState(false)
  const acked = useAcknowledged(account)
  const [lastAction, setLastAction] = useState<'confirm' | 'report'>('confirm')

  const vote = useAsync(account ? `vote:${spot.id}:${account}` : null, async () => {
    const [v, mapper] = await Promise.all([fetchVote(spot.id, account!), fetchMapper(account!)])
    return { ...v, confirms: mapper.confirms }
  })

  if (spot.status === STATUS.Hidden || spot.status === STATUS.Closed) return null

  const own = sameAddress(account, spot.adder)
  const block = vote.data?.block
  const cooling = block === VOTE_BLOCK.CoolingDown

  const confirm = async () => {
    setLastAction('confirm')
    const firstTime = !!account && !acked && (vote.data?.confirms ?? 0) === 0
    if (firstTime && mode !== 'ack') {
      setMode('ack')
      return
    }
    if (account) acknowledge(account)
    const done = await tx.run((who) => prepare.confirm(who, spot.id))
    if (done) setMode('idle')
  }

  const sendReport = async () => {
    setLastAction('report')
    if (reason === null) {
      setReasonError(true)
      return
    }
    const done = await tx.run((who) => prepare.report(who, spot.id, reason))
    if (done) {
      setMode('idle')
      setReason(null)
    }
  }

  if (own) {
    return (
      <div className="vote vote--blocked">
        <p className="vote__why">
          <strong>You added this spot.</strong> Other people confirm it: share the link with someone nearby.
        </p>
      </div>
    )
  }

  if (cooling && vote.data) {
    const v = vote.data.vote
    return (
      <div className="vote vote--blocked">
        <p className="vote__why">
          <strong>
            You {v.kind > 0 ? 'confirmed this spot' : `reported it as “${REASONS[v.reason]?.label ?? 'a problem'}”`} on{' '}
            {formatDate(v.votedAt)}.
          </strong>{' '}
          Each wallet can move a spot’s score once every {RULES.cooldownDays} days. You can vote again from{' '}
          {formatDate(vote.data.nextAt)}.
        </p>
        {tx.state.phase === 'done' ? <TxStatus state={tx.state} doneText={doneText(lastAction)} /> : null}
      </div>
    )
  }

  return (
    <div className="vote">
      {mode === 'report' ? (
        <fieldset className="reasons" aria-describedby={reasonError ? 'reason-error' : undefined}>
          <legend>What is wrong with it?</legend>
          {REASONS.map((r, i) => (
            <label key={r.label} className={`reason${reason === i ? ' is-on' : ''}`}>
              <input
                type="radio"
                name={`reason-${spot.id}`}
                value={i}
                checked={reason === i}
                onChange={() => {
                  setReason(i)
                  setReasonError(false)
                }}
              />
              <span className="reason__label">{r.label}</span>
              <span className="reason__hint">{r.hint}</span>
            </label>
          ))}
          {reasonError ? (
            <p id="reason-error" className="field-error">
              Pick the reason that fits best.
            </p>
          ) : null}
          <div className="vote__row">
            <button type="button" className="btn btn--yellow" onClick={() => void sendReport()} disabled={tx.busy}>
              <Flag size={18} aria-hidden="true" />
              Send report
            </button>
            <button type="button" className="btn btn--ghost-dark" onClick={() => setMode('idle')} disabled={tx.busy}>
              Cancel
            </button>
          </div>
        </fieldset>
      ) : mode === 'ack' ? (
        <div className="ack">
          <p className="sign-label">Before your first confirmation</p>
          <p>
            <strong>Confirmations are public.</strong> “Still here” records on BOT Chain that this wallet says it was at this
            spot at this time. Anyone can see it, and it cannot be deleted.
          </p>
          <p>Your device location is not sent; only your wallet’s confirmation of this spot is.</p>
          <div className="vote__row">
            <button type="button" className="btn btn--yellow" onClick={() => void confirm()} disabled={tx.busy}>
              <Check size={18} strokeWidth={3} aria-hidden="true" />I understand, confirm
            </button>
            <button type="button" className="btn btn--ghost-dark" onClick={() => setMode('idle')} disabled={tx.busy}>
              Not now
            </button>
          </div>
        </div>
      ) : (
        <div className="vote__row vote__row--main">
          <button type="button" className="btn btn--yellow btn--lg" onClick={() => void confirm()} disabled={tx.busy}>
            <Check size={20} strokeWidth={3} aria-hidden="true" />
            Still here
          </button>
          <button
            type="button"
            className="btn btn--ghost-dark btn--lg"
            onClick={() => {
              setMode('report')
              tx.reset()
            }}
            disabled={tx.busy}
          >
            <Flag size={18} aria-hidden="true" />
            Report a problem
          </button>
        </div>
      )}
      {account && vote.error ? <p className="tx-error">{describeError(vote.error)}</p> : null}
      {!account ? <p className="vote__hint">You will be asked to connect a wallet. Each vote costs a little BOT for gas.</p> : null}
      <TxStatus state={tx.state} doneText={doneText(lastAction)} />
      {vote.loading && !vote.data && account ? <Spinner label="Checking your wallet…" /> : null}
    </div>
  )
}

const doneText = (action: 'confirm' | 'report') =>
  action === 'confirm' ? 'Confirmed. Thanks for checking.' : 'Report sent. Thanks for keeping the map honest.'

/** Close (for the adder) and hide (for the moderator). */
function OwnerActions({ spot }: { spot: Spot }) {
  const wallet = useWallet()
  const account = wallet.active?.account
  const tx = useTx()
  const [confirming, setConfirming] = useState(false)
  const owner = useAsync(account ? 'owner' : null, fetchOwner)
  const isAdder = sameAddress(account, spot.adder)
  const isModerator = sameAddress(account, owner.data)
  if (!isAdder && !isModerator) return null

  return (
    <section className="owner-actions" aria-label="Manage this spot">
      {isAdder && !spot.closed ? (
        confirming ? (
          <div className="ack">
            <p>
              <strong>Closing is permanent.</strong> The spot leaves the map for everyone. Its history stays on chain.
            </p>
            <div className="vote__row">
              <button
                type="button"
                className="btn btn--yellow btn--sm"
                disabled={tx.busy}
                onClick={async () => {
                  if (await tx.run((who) => prepare.closeSpot(who, spot.id))) setConfirming(false)
                }}
              >
                Yes, close it
              </button>
              <button type="button" className="btn btn--ghost-dark btn--sm" onClick={() => setConfirming(false)} disabled={tx.busy}>
                Keep it
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn btn--ghost-dark btn--sm" onClick={() => setConfirming(true)}>
            Close this spot
          </button>
        )
      ) : null}
      {isModerator ? (
        <button
          type="button"
          className="btn btn--ghost-dark btn--sm"
          disabled={tx.busy}
          onClick={() => void tx.run((who) => prepare.setHidden(who, spot.id, !spot.hidden))}
        >
          {spot.hidden ? 'Moderator: show on the map again' : 'Moderator: hide from the map'}
        </button>
      ) : null}
      <TxStatus state={tx.state} doneText="Done." />
    </section>
  )
}

export function SpotPanel({ id, onClose, closeLabel = 'Close' }: { id: number; onClose(): void; closeLabel?: string }) {
  const spot = useAsync(`spot:${id}`, () => fetchSpot(id))
  const account = useWallet().active?.account
  const now = useChainNow()
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true })
  }, [id, spot.data?.id])

  const s = spot.data
  return (
    <article className="spot" aria-labelledby="spot-title">
      <div className="spot__bar">
        <span className="spot__number mono">No. {id}</span>
        <button type="button" className="icon-btn icon-btn--dark" onClick={onClose} aria-label={closeLabel}>
          {closeLabel === 'Back' ? <ArrowLeft size={22} aria-hidden="true" /> : <X size={22} aria-hidden="true" />}
        </button>
      </div>

      {!s ? (
        spot.error ? (
          <div className="spot__body">
            <h2 id="spot-title" ref={headingRef} tabIndex={-1} className="spot__title">
              Spot {id}
            </h2>
            <Notice
              tone="warn"
              title={describeError(spot.error)}
              action={
                <button type="button" className="btn btn--ghost-dark btn--sm" onClick={spot.reload}>
                  Try again
                </button>
              }
            />
          </div>
        ) : (
          <div className="spot__body">
            <h2 id="spot-title" ref={headingRef} tabIndex={-1} className="spot__title spot__title--loading">
              Loading spot {id}…
            </h2>
          </div>
        )
      ) : s.hidden ? (
        <div className="spot__body">
          <p className="sign-label">Hidden</p>
          <h2 id="spot-title" ref={headingRef} tabIndex={-1} className="spot__title">
            This spot is hidden
          </h2>
          <p className="spot__explain">
            The moderator hid it for breaking the rules (for example a private home or abusive text). Its record stays on BOT
            Chain, but Colok does not show it.
          </p>
          <OwnerActions spot={s} />
        </div>
      ) : (
        <div className="spot__body">
          <p className="sign-label">{PLACES[s.place] ?? 'Other'}</p>
          <h2 id="spot-title" ref={headingRef} tabIndex={-1} className="spot__title">
            {s.name}
          </h2>
          <div className="spot__status">
            <StatusBadge status={s.status} large />
            <p className="spot__explain">{statusLine(s, now)}</p>
          </div>

          <ul className="spot__amenities" aria-label="What is here">
            {amenitiesOf(s.amenities).map((a) => (
              <li key={a.key}>
                <span className="amenity-tile__icon">
                  <Pictogram amenity={a.key} size={22} />
                </span>
                <span>{a.label}</span>
              </li>
            ))}
          </ul>

          {s.note ? <p className="spot__note">{s.note}</p> : null}

          {/* Keyed so a different spot or wallet starts from a clean state. */}
          <VoteActions key={`${s.id}:${account ?? ''}`} spot={s} />

          <div className="spot__links">
            <a className="btn btn--ghost-dark btn--sm" href={directionsUrl(s)} target="_blank" rel="noreferrer">
              <Navigation size={18} aria-hidden="true" />
              Directions
            </a>
            <ShareButton url={absoluteUrl(href.spot(s.id))} title={`${s.name} on Colok`} />
          </div>

          <dl className="facts facts--dark">
            <div>
              <dt>Health score</dt>
              <dd>
                <ScoreMeter score={s.score} />
              </dd>
            </div>
            <div>
              <dt>Confirmations</dt>
              <dd>{plural(s.confirmations, 'confirmation')}</dd>
            </div>
            <div>
              <dt>Problem reports</dt>
              <dd>{plural(s.reports, 'report')}</dd>
            </div>
            <div>
              <dt>Last confirmed</dt>
              <dd>
                {s.lastConfirmedAt ? (
                  <>
                    {formatDate(s.lastConfirmedAt)} by <AddressLink address={s.lastConfirmer} />
                  </>
                ) : (
                  'Not yet'
                )}
              </dd>
            </div>
            <div>
              <dt>Added</dt>
              <dd>
                {formatDate(s.createdAt)} by <AddressLink address={s.adder} />
              </dd>
            </div>
            <div>
              <dt>Coordinates</dt>
              <dd className="mono">
                {degrees(s.lat)}, {degrees(s.lng)}{' '}
                <a href={osmUrl(s)} target="_blank" rel="noreferrer" className="inline-link">
                  OpenStreetMap
                  <ExternalLink size={14} aria-hidden="true" />
                </a>
              </dd>
            </div>
          </dl>

          <OwnerActions spot={s} />
        </div>
      )}
    </article>
  )
}
