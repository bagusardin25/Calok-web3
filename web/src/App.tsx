import { useEffect } from 'react'
import { Footer, TopBar } from './components/Chrome'
import { WalletDialog } from './components/WalletDialog'
import { useRoute, href } from './lib/router'
import { WalletProvider } from './lib/wallet'
import { AboutPage } from './pages/AboutPage'
import { AddPage } from './pages/AddPage'
import { ListPage } from './pages/ListPage'
import { MapPage } from './pages/MapPage'
import { MappersPage } from './pages/MappersPage'
import { MePage } from './pages/MePage'

const TITLES: Record<string, string> = {
  map: 'Colok — public outlets, Wi-Fi and water, on BOT Chain',
  spot: 'Spot — Colok',
  add: 'Add a spot — Colok',
  list: 'Nearby spots — Colok',
  mappers: 'Mappers — Colok',
  me: 'My spots — Colok',
  about: 'About — Colok',
  notfound: 'Not found — Colok',
}

function NotFound() {
  return (
    <>
      <main id="main" className="page">
        <header className="page-head">
          <p className="sign-label">Wrong way</p>
          <h1>This page does not exist</h1>
          <p className="page-head__lead">
            <a href={href.map}>Back to the map</a> or <a href={href.list}>open the nearby list</a>.
          </p>
        </header>
      </main>
      <Footer />
    </>
  )
}

function Screen() {
  const route = useRoute()

  useEffect(() => {
    document.title = TITLES[route.name] ?? TITLES.map
  }, [route.name])

  const mapLike = route.name === 'map' || route.name === 'spot' || route.name === 'add'

  useEffect(() => {
    if (!mapLike) window.scrollTo(0, 0)
  }, [route, mapLike])

  return (
    <div className={`app${mapLike ? ' app--map' : ''}`}>
      <a
        className="skip-link"
        href="#main"
        onClick={(e) => {
          // Hash routing owns the URL fragment, so move focus instead of following the anchor.
          e.preventDefault()
          const main = document.getElementById('main')
          main?.setAttribute('tabindex', '-1')
          main?.focus()
        }}
      >
        Skip to content
      </a>
      <TopBar route={route} />
      {route.name === 'map' || route.name === 'spot' ? (
        <MapPage spotId={route.name === 'spot' ? route.id : undefined} />
      ) : route.name === 'add' ? (
        <AddPage />
      ) : route.name === 'list' ? (
        <ListPage />
      ) : route.name === 'mappers' ? (
        <MappersPage />
      ) : route.name === 'me' ? (
        <MePage />
      ) : route.name === 'about' ? (
        <AboutPage />
      ) : (
        <NotFound />
      )}
      <WalletDialog />
    </div>
  )
}

export default function App() {
  return (
    <WalletProvider>
      <Screen />
    </WalletProvider>
  )
}
