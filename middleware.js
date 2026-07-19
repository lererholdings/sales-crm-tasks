import { next } from '@vercel/functions'

// Only Production is built with VITE_BASE_PATH=/sales-tasks/ (see vite.config.js
// and docs/design.md's Multi Zones decision log) — Preview/Development builds
// serve unprefixed at root, so redirecting them here would send the browser to
// a path the app was never built to handle, breaking React Router's basename
// match. VERCEL_ENV is a Vercel system var, always accurate without extra config.
export const config = {
  matcher: ['/((?!api/|sales-tasks/).*)'],
}

export default function middleware(request) {
  if (process.env.VERCEL_ENV !== 'production') {
    return next()
  }

  const url = new URL(request.url)
  url.pathname = `/sales-tasks${url.pathname}`
  return Response.redirect(url, 307)
}
