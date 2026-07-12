import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ClerkProvider } from '@clerk/clerk-react'
import './index.css'
import App from './App.jsx'

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

// Mirrors vite.config.js's `base` — '/' normally, or e.g. '/sales-tasks/'
// when mounted under a path prefix (see docs/design.md's Multi Zones
// decision log entry). React Router's basename doesn't want a trailing
// slash except when it's exactly the root.
const BASE_PATH = import.meta.env.BASE_URL
const ROUTER_BASENAME = BASE_PATH === '/' ? '/' : BASE_PATH.replace(/\/$/, '')

if (!CLERK_PUBLISHABLE_KEY) {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <div style={{ fontFamily: 'sans-serif', padding: 40 }}>
        <h1>Missing VITE_CLERK_PUBLISHABLE_KEY</h1>
        <p>
          Add it to <code>frontend/.env.local</code> (see{' '}
          <code>frontend/.env.example</code>) and restart the dev server.
        </p>
      </div>
    </StrictMode>,
  )
} else {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} afterSignOutUrl={BASE_PATH}>
        <BrowserRouter basename={ROUTER_BASENAME}>
          <App />
        </BrowserRouter>
      </ClerkProvider>
    </StrictMode>,
  )
}
