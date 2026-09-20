import { useState } from 'react'
import AppContext from './appContext.js'

// API base URL: set VITE_API_BASE_URL at build time for deployed environments.
// For local development, fallback to the current host's IP so mobile testing works.
const defaultLocalApi =
  typeof window !== 'undefined' && window.location.hostname
    ? `http://${window.location.hostname}:3001`
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
