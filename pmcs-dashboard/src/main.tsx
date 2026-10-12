import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

// After a deploy, an old tab may request a code-split chunk that no longer
// exists (Hosting returns 404 for missing /assets/**). Reload once to pick up
// the new build instead of showing a blank page.
window.addEventListener('vite:preloadError', () => {
  const KEY = 'pmcs-dashboard-preload-reload'
  let last = 0
  try {
    last = Number(sessionStorage.getItem(KEY) ?? 0)
    sessionStorage.setItem(KEY, String(Date.now()))
  } catch {
    // storage unavailable: still reload
  }
  // Avoid a reload loop if the new build is broken too: the ErrorBoundary shows a Reload button instead.
  if (Date.now() - last < 10_000) return
  window.location.reload()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
