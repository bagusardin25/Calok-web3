import { useMemo } from 'react'
import { AddressLink, Notice, Spinner } from '../components/Bits'
import { Footer } from '../components/Chrome'
import { fetchMappers } from '../lib/contract'
import { describeError } from '../lib/errors'
import { formatDate, sameAddress } from '../lib/format'
import { useAsync } from '../lib/useAsync'
import { useWallet } from '../lib/wallet'
import { StatsStrip } from './StatsStrip'

export function MappersPage() {
  const mappers = useAsync('mappers', fetchMappers)
  const wallet = useWallet()

  const ranked = useMemo(
    () =>
      [...(mappers.data ?? [])].sort(
        (a, b) => b.added + b.confirms + b.reports - (a.added + a.confirms + a.reports) || a.firstAt - b.firstAt,
      ),
    [mappers.data],
  )

  return (
    <>
      <main id="main" className="page">
        <header className="page-head">
          <p className="sign-label">Mappers</p>
          <h1>The people keeping the map true</h1>
          <p className="page-head__lead">
            Every wallet that has added a spot, confirmed one, or reported a problem. Ranked by everything they have done, read
            straight from the contract.
          </p>
        </header>

        <StatsStrip />

        {mappers.error ? (
          <Notice
            tone="warn"
            title={describeError(mappers.error)}
            action={
              <button type="button" className="btn btn--ink btn--sm" onClick={mappers.reload}>
                Try again
              </button>
            }
          />
        ) : !mappers.data ? (
          <Spinner label="Reading mappers from BOT Chain…" />
        ) : ranked.length === 0 ? (
          <Notice title="Nobody has mapped anything yet." />
        ) : (
          <div className="table-wrap" tabIndex={0} role="region" aria-label="Mappers table">
            <table className="board">
              <caption className="visually-hidden">Mappers ranked by contributions</caption>
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">Wallet</th>
                  <th scope="col" className="num">
                    Spots added
                  </th>
                  <th scope="col" className="num">
                    Confirmations
                  </th>
                  <th scope="col" className="num">
                    Reports
                  </th>
                  <th scope="col">Since</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((m, i) => {
                  const you = sameAddress(m.wallet, wallet.active?.account)
                  return (
                    <tr key={m.wallet} className={you ? 'is-you' : undefined}>
                      <td className="mono">{i + 1}</td>
                      <td>
                        <AddressLink address={m.wallet} />
                        {you ? <span className="you-tag">You</span> : null}
                      </td>
                      <td className="num mono">{m.added}</td>
                      <td className="num mono">{m.confirms}</td>
                      <td className="num mono">{m.reports}</td>
                      <td>{formatDate(m.firstAt)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
      <Footer />
    </>
  )
}
