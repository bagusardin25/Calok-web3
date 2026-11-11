import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/overpass'
import '@fontsource-variable/overpass-mono'
import './styles/tokens.css'
import './styles/base.css'
import './styles/components.css'
import './styles/map.css'
import './styles/pages.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
