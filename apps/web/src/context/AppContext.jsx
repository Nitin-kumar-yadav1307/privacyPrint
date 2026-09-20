import { useState } from 'react'
import AppContext from './appContext.js'

// API base URL: set VITE_API_BASE_URL at build time for deployed environments.
// For local development, fallback to the laptop IP:3001; for Lambda hosting, fallback to window.location.origin.
const defaultLocalApi =
  typeof window !== 'undefined' && window.location.hostname
    ? (window.location.port === '5173'
        ? `http://${window.location.hostname}:3001`
        : window.location.origin)
    : 'http://localhost:3001'
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || defaultLocalApi).replace(/\/+$/, '')

export function AppProvider({ children }) {
  const [baseUrl, setApiBaseUrl] = useState(apiBaseUrl)

  return (
    <AppContext.Provider value={{ apiBaseUrl: baseUrl, setApiBaseUrl }}>
      {children}
    </AppContext.Provider>
  )
}

// Split into a separate hook file to satisfy react-refresh
