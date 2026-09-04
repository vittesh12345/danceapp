import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// PWA: register the service worker in production builds only, so dev
// iterations never fight a cache. Demo-only preview builds are hosted
// where no service worker is served, so they skip registration.
if (import.meta.env.PROD && import.meta.env.VITE_DEMO_ONLY !== '1' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      // Offline support is a bonus; the app works without it.
    })
  })
}
