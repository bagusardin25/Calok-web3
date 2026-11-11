import { useEffect, useRef, useState } from 'react'
import { Menu, Plus, Wallet, X } from 'lucide-react'
import { CONTRACT_ADDRESS, NETWORK, chain, explorerAddressUrl } from '../config/chains'
import { SITE, TILES } from '../config/site'
import { shortAddress } from '../lib/format'
import { href } from '../lib/router'
import type { Route } from '../lib/router'
import { useWallet } from '../lib/wallet'
import { Logo } from './Pictograms'

const NAV: { key: Route['name']; label: string; to: string }[] = [
  { key: 'map', label: 'Map', to: href.map },
  { key: 'list', label: 'Nearby', to: href.list },
  { key: 'mappers', label: 'Mappers', to: href.mappers },
  { key: 'me', label: 'My spots', to: href.me },
  { key: 'about', label: 'About', to: href.about },
]

const isCurrent = (route: Route, key: Route['name']) => route.name === key || (key === 'map' && route.name === 'spot')

function WalletButton() {
  const wallet = useWallet()
  if (wallet.active) {
    return (
      <button type="button" className="wallet-chip" onClick={wallet.openDialog} aria-label={`Wallet ${wallet.active.account}`}>
        <span className={`wallet-chip__dot${wallet.wrongChain ? ' is-wrong' : ''}`} aria-hidden="true" />
        <span className="mono">{shortAddress(wallet.active.account)}</span>
      </button>
    )
  }
  return (
    <button type="button" className="btn btn--ghost-dark btn--sm" onClick={wallet.openDialog}>
      <Wallet size={18} aria-hidden="true" />
      <span>Connect</span>
    </button>
  )
}

export function TopBar({ route }: { route: Route }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuButton = useRef<HTMLButtonElement>(null)
  const firstLink = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    firstLink.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false)
        menuButton.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  return (
    <header className="topbar">
      <a className="brand" href={href.map} aria-label="Colok, map home">
        <Logo size={34} />
        <span className="brand__word">COLOK</span>
      </a>

      <nav className="topnav" aria-label="Main">
        {NAV.map((item) => (
          <a key={item.key} href={item.to} className="topnav__link" aria-current={isCurrent(route, item.key) ? 'page' : undefined}>
            {item.label}
          </a>
        ))}
      </nav>

      <div className="topbar__actions">
        {route.name !== 'add' ? (
          <a className="btn btn--yellow btn--sm topbar__add" href={href.add}>
            <Plus size={18} strokeWidth={3} aria-hidden="true" />
            <span>Add a spot</span>
          </a>
        ) : null}
        <WalletButton />
        <button
          ref={menuButton}
          type="button"
          className="icon-btn icon-btn--dark topbar__menu"
          aria-expanded={menuOpen}
          aria-controls="nav-sheet"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          onClick={() => setMenuOpen((o) => !o)}
        >
          {menuOpen ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
        </button>
      </div>

      {menuOpen ? (
        <nav id="nav-sheet" className="nav-sheet" aria-label="Main">
          {NAV.map((item, i) => (
            <a
              key={item.key}
              ref={i === 0 ? firstLink : undefined}
              href={item.to}
              className="nav-sheet__link"
              aria-current={isCurrent(route, item.key) ? 'page' : undefined}
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </a>
          ))}
          <a href={href.add} className="nav-sheet__link nav-sheet__link--add" onClick={() => setMenuOpen(false)}>
            Add a spot
          </a>
        </nav>
      ) : null}
    </header>
  )
}

function NetworkTag() {
  if (NETWORK === 'mainnet') return null
  return <span className="net-tag">{NETWORK === 'local' ? 'Local chain' : 'Testnet'}</span>
}

/** The always-visible strip under the map: BOT Chain name and both required links. */
export function BotChainBar() {
  return (
    <div className="botbar" role="contentinfo" aria-label="About this site">
      <span className="botbar__built">
        Built on <strong>BOT Chain</strong>
      </span>
      <a href={SITE.botchainUrl} target="_blank" rel="noreferrer">
        botchain.ai
      </a>
      <a href={SITE.botchainScanUrl} target="_blank" rel="noreferrer">
        scan.botchain.ai
      </a>
      <NetworkTag />
      <a className="botbar__about" href={href.about}>
        How it works
      </a>
    </div>
  )
}

export function Footer() {
  const contractUrl = CONTRACT_ADDRESS ? explorerAddressUrl(CONTRACT_ADDRESS) : undefined
  return (
    <footer className="footer">
      <div className="footer__sign">
        <Logo size={28} />
        <p>
          <strong>Colok</strong> runs on <strong>BOT Chain</strong>. Every spot and every confirmation is a public record.
        </p>
      </div>
      <ul className="footer__links">
        <li>
          <a href={SITE.botchainUrl} target="_blank" rel="noreferrer">
            BOT Chain: botchain.ai
          </a>
        </li>
        <li>
          <a href={SITE.botchainScanUrl} target="_blank" rel="noreferrer">
            Explorer: scan.botchain.ai
          </a>
        </li>
        {SITE.xUrl ? (
          <li>
            <a href={SITE.xUrl} target="_blank" rel="noreferrer">
              Colok on X
            </a>
          </li>
        ) : null}
        <li>
          <a href={TILES.providerUrl} target="_blank" rel="noreferrer">
            Map tiles: {TILES.provider}
          </a>
        </li>
        <li>
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
            Map data: © OpenStreetMap contributors
          </a>
        </li>
      </ul>
      <p className="footer__contract">
        <span>Contract on {chain.name}: </span>
        {CONTRACT_ADDRESS ? (
          contractUrl ? (
            <a className="mono" href={contractUrl} target="_blank" rel="noreferrer">
              {CONTRACT_ADDRESS}
            </a>
          ) : (
            <span className="mono">{CONTRACT_ADDRESS}</span>
          )
        ) : (
          <span>not deployed yet</span>
        )}
        <NetworkTag />
      </p>
    </footer>
  )
}
