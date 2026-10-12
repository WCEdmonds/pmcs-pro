import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { applyTheme, getSavedTheme } from './utils/theme'
import { installPreloadErrorHandler, registerServiceWorker } from './utils/pwa'
import { startSyncListener } from './utils/syncEngine'
import './index.css'

applyTheme(getSavedTheme())
installPreloadErrorHandler()
registerServiceWorker()
// Outside the React tree on purpose: an error screen must never stop background sync.
startSyncListener()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
