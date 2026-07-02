import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ClerkProvider } from '@clerk/clerk-react'
import './index.css'
import App from './App.jsx'

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

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
      <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} afterSignOutUrl="/">
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ClerkProvider>
    </StrictMode>,
  )
}
