import { AddressLink } from '../components/Bits'
import { Footer } from '../components/Chrome'
import { StatusGlyph } from '../components/Pictograms'
import { CONTRACT_ADDRESS, chain } from '../config/chains'
import { REASONS, RULES, SITE, STATUS, STATUS_META, TILES } from '../config/site'
import { href } from '../lib/router'

const STATUS_ROWS = [
  { status: STATUS.New, rule: 'Score −1 to +1.' },
  { status: STATUS.Verified, rule: 'Score +2 or more, and confirmed within the last 90 days.' },
  { status: STATUS.Stale, rule: 'No confirmation for more than 90 days (the add counts as the first sighting).' },
  { status: STATUS.ReportedGone, rule: 'Score −2 or lower. Hidden from the map unless you switch it on.' },
]

export function AboutPage() {
  return (
    <>
      <main id="main" className="page page--prose">
        <header className="page-head">
          <p className="sign-label">About</p>
          <h1>A map of outlets, Wi-Fi and water that stays true</h1>
          <p className="page-head__lead">
            Colok (from <em>colokan</em>, Indonesian for a wall socket) maps public places where you can charge a phone, get
            online, refill a bottle or sit down to work. Anyone can add a spot. What keeps it honest is everyone else: people who
            pass by confirm it is still there, or report that it is not.
          </p>
        </header>

        <section aria-labelledby="how-title">
          <h2 id="how-title">How verification works</h2>
          <p>
            Every spot has a <strong>health score</strong> from −3 to +3. It starts at 0.
          </p>
          <ul className="sign-list">
            <li>
              <strong>Still here</strong> from another wallet: +1.
            </li>
            <li>
              <strong>Report a problem</strong> from another wallet: −1. Reasons: {REASONS.map((r) => r.label).join(', ')}.
            </li>
            <li>The person who added a spot cannot confirm or report it.</li>
            <li>Each wallet can move a spot’s score once every {RULES.cooldownDays} days.</li>
            <li>The score stops at +3 and −3, so an old spot never becomes immune to new reports.</li>
          </ul>

          <h3>What the pins mean</h3>
          <p>The shape always says the status, so the map reads without colour. The words are in every list and panel.</p>
          <ul className="status-key">
            {STATUS_ROWS.map(({ status, rule }) => (
              <li key={status}>
                <StatusGlyph status={status} size={36} />
                <div>
                  <p className="status-key__name">{STATUS_META[status].label}</p>
                  <p>{rule}</p>
                </div>
              </li>
            ))}
          </ul>
          <p>
            The contract works out the status from the score and the time of the last confirmation, so any app reading it gets
            the same answer as this one.
          </p>
          <p>
            The person who added a spot can <strong>close</strong> it. The moderator can <strong>hide</strong> a spot that breaks
            the rules, such as a private home or abusive text; the record stays on chain, but Colok stops showing it. The moderator
            cannot change any spot’s place, text or score.
          </p>
        </section>

        <section aria-labelledby="privacy-title">
          <h2 id="privacy-title">Privacy</h2>
          <ul className="sign-list">
            <li>
              <strong>Confirmations are public.</strong> Pressing Still here records that your wallet says it was at that spot at
              that time. The app reminds you before your first confirmation.
            </li>
            <li>
              <strong>Your device location never goes on chain.</strong> It is used in this browser to centre the map and sort the
              list, and it is not stored or sent anywhere. Only the coordinates of spots that people deliberately add are recorded.
            </li>
            <li>
              <strong>Public places only.</strong> Homes and restricted areas must not be mapped; the moderator hides them.
            </li>
            <li>
              <strong>No personal data.</strong> Spot names and notes are public and permanent. Leave out people’s names and phone
              numbers.
            </li>
          </ul>
        </section>

        <section aria-labelledby="limits-title">
          <h2 id="limits-title">What Colok cannot promise</h2>
          <p>
            There is no proof that someone who confirms a spot was really there. The 30-day limit, the score cap and reports from
            other people make cheating slow and visible, but not impossible. Treat a Verified spot as “several people say so”, not
            as a guarantee.
          </p>
        </section>

        <section aria-labelledby="chain-title">
          <h2 id="chain-title">On BOT Chain</h2>
          <p>
            Every spot, confirmation and report is a transaction on <strong>BOT Chain</strong>. There is no Colok server or
            database: the site reads the contract directly. Using Colok costs only gas; there is no token.
          </p>
          <dl className="facts">
            <div>
              <dt>Network</dt>
              <dd>
                {chain.name} (chain ID {chain.id})
              </dd>
            </div>
            <div>
              <dt>Contract</dt>
              <dd>{CONTRACT_ADDRESS ? <AddressLink address={CONTRACT_ADDRESS} label={CONTRACT_ADDRESS} /> : 'Not deployed yet'}</dd>
            </div>
            <div>
              <dt>BOT Chain</dt>
              <dd>
                <a href={SITE.botchainUrl} target="_blank" rel="noreferrer">
                  botchain.ai
                </a>
              </dd>
            </div>
            <div>
              <dt>Explorer</dt>
              <dd>
                <a href={SITE.botchainScanUrl} target="_blank" rel="noreferrer">
                  scan.botchain.ai
                </a>
              </dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby="credits-title">
          <h2 id="credits-title">Map credits</h2>
          <p>
            Map tiles by{' '}
            <a href={TILES.providerUrl} target="_blank" rel="noreferrer">
              {TILES.provider}
            </a>
            , built on{' '}
            <a href="https://openmaptiles.org" target="_blank" rel="noreferrer">
              OpenMapTiles
            </a>{' '}
            with data{' '}
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
              © OpenStreetMap contributors
            </a>
            . The map is drawn with MapLibre GL. If the tiles cannot load, the <a href={href.list}>nearby list</a> still shows
            every spot.
          </p>
        </section>
      </main>
      <Footer />
    </>
  )
}
