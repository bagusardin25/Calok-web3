import { Wallet } from 'lucide-react'
import { Notice, Spinner, StatusBadge } from '../components/Bits'
import { Footer } from '../components/Chrome'
import { REASONS } from '../config/site'
import { fetchMySpots } from '../lib/contract'
import { describeError } from '../lib/errors'
import { formatDate, plural, shortAddress } from '../lib/format'
import { href } from '../lib/router'
import { useChainNow } from '../lib/store'
import { useAsync } from '../lib/useAsync'
import { useWallet } from '../lib/wallet'

export function MePage() {
  const wallet = useWallet()
  const account = wallet.active?.account
  const mine = useAsync(account ? `mine:${account}` : null, () => fetchMySpots(account!))
  const now = useChainNow()

  return (
    <>
      <main id="main" className="page">
        <header className="page-head">
          <p className="sign-label">My spots</p>
          <h1>Your contributions</h1>
          {account ? (
            <p className="page-head__lead">
              Spots added and votes cast by <span className="mono">{shortAddress(account)}</span>.
            </p>
          ) : null}
        </header>

        {!account ? (
          <Notice
            title="Connect a wallet to see what you have added and confirmed."
            action={
              <button type="button" className="btn btn--yellow btn--sm" onClick={wallet.openDialog}>
                <Wallet size={18} aria-hidden="true" />
                Connect wallet
              </button>
            }
          />
        ) : mine.error ? (
          <Notice
            tone="warn"
            title={describeError(mine.error)}
            action={
              <button type="button" className="btn btn--ink btn--sm" onClick={mine.reload}>
                Try again
              </button>
            }
          />
        ) : !mine.data ? (
          <Spinner label="Reading your spots…" />
        ) : (
          <>
            <dl className="stats" aria-label="Your numbers">
              <div className="stats__item">
                <dt>Spots added</dt>
                <dd className="mono">{mine.data.mapper.added}</dd>
              </div>
              <div className="stats__item">
                <dt>Confirmations</dt>
                <dd className="mono">{mine.data.mapper.confirms}</dd>
              </div>
              <div className="stats__item">
                <dt>Reports</dt>
                <dd className="mono">{mine.data.mapper.reports}</dd>
              </div>
            </dl>

            <section className="list-section" aria-labelledby="added-title">
              <h2 id="added-title">Spots you added</h2>
              {mine.data.added.length === 0 ? (
                <Notice
                  title="You have not added a spot yet."
                  action={
                    <a className="btn btn--yellow btn--sm" href={href.add}>
                      Add a spot
                    </a>
                  }
                />
              ) : (
                <ul className="mine-list">
                  {mine.data.added.map((s) => (
                    <li key={s.id}>
                      <a href={href.spot(s.id)} className="mine-row">
                        <span className="mine-row__name">{s.name}</span>
                        <StatusBadge status={s.status} />
                        <span className="mine-row__meta">
                          Added {formatDate(s.createdAt)}, {plural(s.confirmations, 'confirmation')}, {plural(s.reports, 'report')}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="list-section" aria-labelledby="voted-title">
              <h2 id="voted-title">Spots you confirmed or reported</h2>
              {mine.data.voted.length === 0 ? (
                <Notice title="You have not confirmed or reported a spot yet.">
                  <p>
                    When you pass a spot on the{' '}
                    <a href={href.map}>map</a>, open it and press <strong>Still here</strong> or <strong>Report a problem</strong>.
                  </p>
                </Notice>
              ) : (
                <ul className="mine-list">
                  {mine.data.voted.map(({ spot, vote }) => (
                    <li key={spot.id}>
                      <a href={href.spot(spot.id)} className="mine-row">
                        <span className="mine-row__name">{spot.name}</span>
                        <StatusBadge status={spot.status} />
                        <span className="mine-row__meta">
                          {vote.kind > 0 ? 'You said Still here' : `You reported: ${REASONS[vote.reason]?.label ?? 'a problem'}`} on{' '}
                          {formatDate(vote.votedAt)}
                          {vote.nextAt > now ? `. You can vote again from ${formatDate(vote.nextAt)}.` : '. You can vote again now.'}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
      <Footer />
    </>
  )
}
