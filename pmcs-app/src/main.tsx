import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { applyTheme, getSavedTheme } from './utils/theme'
import { installPreloadErrorHandler, registerServiceWorker } from './utils/pwa'
import './index.css'

applyTheme(getSavedTheme())
installPreloadErrorHandler()
registerServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
